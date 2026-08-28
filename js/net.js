/* ============================================================
   net.js — peer-to-peer transport (WebRTC via PeerJS)

   There is no database and no application server. The host's
   browser IS the game server: it holds all state, decides all
   scores, and pushes updates to every player over a direct
   WebRTC data channel.

   PeerJS's public broker is used for signalling only — it
   introduces two browsers to each other and then gets out of
   the way. No game data is stored anywhere.
   ============================================================ */

const ID_PREFIX = 'snuq-v1-';
const PING_MS = 5000;
const DEAD_MS = 22000;

/** Optional self-hosted PeerServer: ?peerhost=example.com&peerport=443 */
function peerOptions() {
  const q = new URLSearchParams(location.search);
  const host = q.get('peerhost');
  if (!host) return { debug: 0 };
  return {
    host,
    port: Number(q.get('peerport') || 443),
    path: q.get('peerpath') || '/',
    secure: q.get('peersecure') !== '0',
    debug: 0,
  };
}

function randomPin() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

/** Strip control characters, bidi overrides and zero-width tricks from a nickname. */
export function cleanName(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14);
}

/** Character ids travel over the wire, so keep them to a boring alphabet. */
function cleanCharId(raw) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
}

function isPeerAvailable() {
  return typeof window.Peer === 'function';
}

/* ══════════════════════ HOST ══════════════════════ */

/**
 * Start hosting. Resolves with a handle once the broker assigns our PIN.
 *
 * handlers: {
 *   onJoin(player), onLeave(player), onAnswer(player, msg), onStatus(text),
 *   onChar(player),                  // a player swapped character
 *   resolveChar(player, wantedId),   // returns the id the player actually gets
 *   greeting(),                      // extra fields folded into `welcome`
 * }
 *
 * Characters are opaque here: net.js only ferries ids around and lets the
 * host settle who gets what, so the transport never has to know a rabbit
 * from a robot.
 */
export function startHost(handlers = {}) {
  return new Promise((resolve, reject) => {
    if (!isPeerAvailable()) {
      reject(new Error('Networking library failed to load. Reload the page, or use Solo practice.'));
      return;
    }

    const players = new Map();     // pid -> { id, name, char, conn, score, streak, correct, lastSeen, answers }
    let peer = null;
    let pin = null;
    let attempts = 0;
    let settled = false;
    let acceptingJoins = true;
    let destroyed = false;

    const api = {
      get pin() { return pin; },
      get players() { return [...players.values()]; },
      player(pid) { return players.get(pid); },
      get open() { return !!peer && !peer.destroyed; },

      setAcceptingJoins(v) { acceptingJoins = v; },

      /** Character ids currently spoken for, optionally ignoring one player. */
      takenChars(exceptPid) {
        return [...players.values()]
          .filter((p) => p.id !== exceptPid && p.char)
          .map((p) => p.char);
      },

      send(pid, msg) {
        const p = players.get(pid);
        if (p && p.conn && p.conn.open) { try { p.conn.send(msg); } catch (_) {} }
      },
      broadcast(msg) {
        for (const p of players.values()) {
          if (p.conn && p.conn.open) { try { p.conn.send(msg); } catch (_) {} }
        }
      },
      /** msg may be a function (player) => payload, for per-player data. */
      broadcastEach(fn) {
        for (const p of players.values()) {
          if (p.conn && p.conn.open) {
            const m = fn(p);
            if (m) { try { p.conn.send(m); } catch (_) {} }
          }
        }
      },
      kick(pid, reason) {
        const p = players.get(pid);
        if (!p) return;
        try { p.conn.send({ t: 'kick', msg: reason || 'Removed by host' }); } catch (_) {}
        setTimeout(() => { try { p.conn.close(); } catch (_) {} }, 120);
        players.delete(pid);
        handlers.onLeave && handlers.onLeave(p);
      },
      destroy() {
        destroyed = true;
        clearInterval(heartbeat);
        try { api.broadcast({ t: 'kick', msg: 'Host ended the game' }); } catch (_) {}
        setTimeout(() => { try { peer && peer.destroy(); } catch (_) {} }, 150);
        players.clear();
      },
    };

    const heartbeat = setInterval(() => {
      const now = Date.now();
      for (const p of [...players.values()]) {
        if (p.conn && p.conn.open) {
          try { p.conn.send({ t: 'ping' }); } catch (_) {}
        }
        if (now - p.lastSeen > DEAD_MS) {
          players.delete(p.id);
          try { p.conn.close(); } catch (_) {}
          handlers.onLeave && handlers.onLeave(p);
        }
      }
    }, PING_MS);

    function uniqueName(want) {
      const base = cleanName(want) || 'Player';
      const taken = new Set([...players.values()].map((p) => p.name.toLowerCase()));
      if (!taken.has(base.toLowerCase())) return base;
      for (let n = 2; n < 100; n++) {
        const cand = `${base.slice(0, 11)} ${n}`;
        if (!taken.has(cand.toLowerCase())) return cand;
      }
      return `${base.slice(0, 10)} ${randomPin().slice(0, 3)}`;
    }

    function wire(conn) {
      let pid = null;
      const guard = setTimeout(() => {
        if (!pid) { try { conn.close(); } catch (_) {} }
      }, 15000);           // never let a silent socket linger

      conn.on('data', (raw) => {
        const msg = raw && typeof raw === 'object' ? raw : null;
        if (!msg || typeof msg.t !== 'string') return;

        if (msg.t === 'join') {
          if (pid) return;                                  // already joined
          if (!acceptingJoins) {
            try { conn.send({ t: 'kick', msg: 'That game has already started' }); } catch (_) {}
            setTimeout(() => { try { conn.close(); } catch (_) {} }, 120);
            return;
          }
          if (players.size >= 60) {
            try { conn.send({ t: 'kick', msg: 'This game is full' }); } catch (_) {}
            setTimeout(() => { try { conn.close(); } catch (_) {} }, 120);
            return;
          }
          clearTimeout(guard);
          pid = conn.peer;
          const player = {
            id: pid,
            conn,
            name: uniqueName(msg.name),
            char: '',
            score: 0,
            streak: 0,
            bestStreak: 0,
            correct: 0,
            answers: [],
            lastSeen: Date.now(),
          };
          players.set(pid, player);
          // Seat them before choosing a character so the host can see the
          // rest of the room when it works out what is still free.
          if (handlers.resolveChar) player.char = handlers.resolveChar(player, cleanCharId(msg.char));
          const extra = handlers.greeting ? handlers.greeting() : {};
          try { conn.send({ t: 'welcome', pid, name: player.name, char: player.char, ...extra }); } catch (_) {}
          handlers.onJoin && handlers.onJoin(player);
          return;
        }

        const p = pid && players.get(pid);
        if (!p) return;
        p.lastSeen = Date.now();

        if (msg.t === 'answer') { handlers.onAnswer && handlers.onAnswer(p, msg); return; }

        if (msg.t === 'char') {
          // The host has the last word: a taken character comes back as
          // whatever it decided to give out instead.
          const id = handlers.resolveChar ? handlers.resolveChar(p, cleanCharId(msg.id)) : '';
          p.char = id;
          try { conn.send({ t: 'char', id }); } catch (_) {}
          handlers.onChar && handlers.onChar(p);
        }
      });

      const drop = () => {
        clearTimeout(guard);
        const p = pid && players.get(pid);
        if (p) { players.delete(pid); handlers.onLeave && handlers.onLeave(p); }
      };
      conn.on('close', drop);
      conn.on('error', drop);
    }

    function spin() {
      if (destroyed) return;
      pin = randomPin();
      attempts++;
      try { peer && peer.destroy(); } catch (_) {}
      peer = new window.Peer(ID_PREFIX + pin, peerOptions());

      peer.on('open', () => {
        if (settled) return;
        settled = true;
        handlers.onStatus && handlers.onStatus('ready');
        resolve(api);
      });

      peer.on('connection', wire);

      peer.on('disconnected', () => {
        handlers.onStatus && handlers.onStatus('reconnecting');
        if (!destroyed) { try { peer.reconnect(); } catch (_) {} }
      });

      peer.on('error', (err) => {
        const type = err && err.type;
        if (type === 'unavailable-id' && attempts < 6 && !settled) {
          spin();                                            // PIN collision — pick another
          return;
        }
        if (type === 'peer-unavailable') return;             // a player vanished; not fatal
        if (settled) {
          handlers.onStatus && handlers.onStatus('error:' + (type || 'unknown'));
          return;
        }
        settled = true;
        reject(new Error(describe(type)));
      });
    }

    spin();
  });
}

/* ══════════════════════ PLAYER ══════════════════════ */

/**
 * Join a hosted game.
 * handlers: { onMessage(msg), onClose(reason), onStatus(text), char }
 *
 * `char` is only a request — the host hands back the character actually
 * assigned in its welcome, which may be a different one if someone else
 * got there first.
 */
export function joinGame(pin, name, handlers = {}) {
  return new Promise((resolve, reject) => {
    if (!isPeerAvailable()) {
      reject(new Error('Networking library failed to load. Reload the page and try again.'));
      return;
    }

    let peer = null;
    let conn = null;
    let settled = false;
    let closed = false;
    let lastSeen = Date.now();

    const fail = (msg) => {
      if (settled) { handlers.onClose && !closed && (closed = true, handlers.onClose(msg)); return; }
      settled = true;
      clearInterval(watchdog);
      try { peer && peer.destroy(); } catch (_) {}
      reject(new Error(msg));
    };

    const watchdog = setInterval(() => {
      if (settled && Date.now() - lastSeen > DEAD_MS) {
        clearInterval(watchdog);
        if (!closed) { closed = true; handlers.onClose && handlers.onClose('Lost connection to the host'); }
        try { peer && peer.destroy(); } catch (_) {}
      }
    }, PING_MS);

    const timeout = setTimeout(() => {
      if (!settled) fail('No game found with that PIN. Check the number on the host screen.');
    }, 20000);

    peer = new window.Peer(null, peerOptions());

    peer.on('open', () => {
      conn = peer.connect(ID_PREFIX + String(pin).trim(), {
        reliable: true,
        metadata: { v: 1 },
      });

      conn.on('open', () => {
        conn.send({ t: 'join', name, char: cleanCharId(handlers.char) });
      });

      conn.on('data', (raw) => {
        const msg = raw && typeof raw === 'object' ? raw : null;
        if (!msg || typeof msg.t !== 'string') return;
        lastSeen = Date.now();

        if (msg.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (_) {} return; }

        if (msg.t === 'welcome' && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve({
            pid: msg.pid,
            name: msg.name,
            char: msg.char || '',
            pack: msg.pack || null,
            letPick: msg.letPick !== false,
            anims: msg.anims !== false,
            send(m) { if (conn && conn.open) { try { conn.send(m); } catch (_) {} } },
            leave() {
              closed = true;
              clearInterval(watchdog);
              try { conn && conn.close(); } catch (_) {}
              setTimeout(() => { try { peer && peer.destroy(); } catch (_) {} }, 100);
            },
          });
          return;
        }

        handlers.onMessage && handlers.onMessage(msg);

        if (msg.t === 'kick') {
          closed = true;
          clearInterval(watchdog);
          setTimeout(() => { try { peer && peer.destroy(); } catch (_) {} }, 150);
        }
      });

      conn.on('close', () => {
        clearInterval(watchdog);
        if (!settled) fail('The host closed the connection.');
        else if (!closed) { closed = true; handlers.onClose && handlers.onClose('Disconnected from the host'); }
      });

      conn.on('error', () => {
        if (!settled) fail('Could not reach that game. Check the PIN and try again.');
      });
    });

    peer.on('error', (err) => {
      const type = err && err.type;
      clearTimeout(timeout);
      if (type === 'peer-unavailable') {
        fail('No game found with PIN ' + pin + '. Check the number on the host screen.');
      } else {
        fail(describe(type));
      }
    });

    peer.on('disconnected', () => {
      handlers.onStatus && handlers.onStatus('reconnecting');
      if (!closed) { try { peer.reconnect(); } catch (_) {} }
    });
  });
}

function describe(type) {
  switch (type) {
    case 'browser-incompatible':
      return 'This browser does not support WebRTC. Try Chrome, Edge, Safari or Firefox.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Cannot reach the matchmaking service. Check your internet connection and try again.';
    case 'ssl-unavailable':
      return 'A secure connection could not be established.';
    case 'webrtc':
      return 'WebRTC failed. A firewall or VPN may be blocking peer-to-peer traffic.';
    default:
      return 'Connection failed (' + (type || 'unknown') + '). Please try again.';
  }
}
