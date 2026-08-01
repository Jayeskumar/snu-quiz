# SNU Quiz

A Kahoot-style **live** quiz on Java data structures — Linked Lists, Stacks, Queues, and the
classic LeetCode problems built on them.

**▶ Play: https://jayeskumar.github.io/snu-quiz/**

Host puts the game PIN on the projector, everyone joins from their phone, questions appear,
fastest correct answer scores most. Podium and confetti at the end.

There is **no backend and no database**. It is a folder of static files on GitHub Pages.

---

## How live play works without a server

The host's browser *is* the game server.

```
   Host browser  ──────── WebRTC data channel ────────►  Player phone
  (owns quiz,                    direct                  (renders tiles,
   clock, scores)                                         sends answers)
```

* Players connect straight to the host over **WebRTC** (via [PeerJS](https://peerjs.com/)).
* The PeerJS broker is used **only for the introduction** — the six-digit PIN is the host's
  temporary peer id. Once the two browsers have found each other, all game traffic is
  peer-to-peer. No question, answer, nickname or score is stored anywhere.
* Close the host tab and the game is gone. Nothing to clean up, nothing to leak.

The host is authoritative: it holds the answer key, runs the clock, and computes every score.
Players are never sent the correct answer until the question is locked, so you cannot read it
out of the network tab mid-question.

### What this means in practice

| | |
|---|---|
| Works on GitHub Pages | Yes — static files only |
| Needs an account | No |
| Host must stay on the page | **Yes.** Closing the host tab ends the game. |
| Players can rejoin after refresh | No — a refresh is a new peer, and joins close at start |
| Practical group size | Comfortable to ~30, capped at 60 |
| Restrictive corporate firewall | May block WebRTC; use Solo practice or a phone hotspot |

## Modes

* **Host a live game** — pick topics, open a lobby, share the PIN or QR, press Start.
* **Join** — enter the PIN and a nickname, or scan the QR / open the invite link.
* **Solo practice** — the same questions and scoring with no network at all.
* **Browse questions** — read the whole bank with answers and explanations.

## Scoring

Same shape as Kahoot:

```
points = round( (1 - (timeTaken / timeLimit) / 2) * 1000 )     // correct answers only
streak bonus = min(500, (consecutiveCorrect - 1) * 100)        // optional
```

An instant correct answer is worth ~1000; a correct answer on the buzzer is worth ~500.
Wrong answers and time-outs score zero and reset the streak.

## The question bank

**140 questions** across six topics:

| Topic | Questions |
|---|---:|
| Linked Lists in Java | 26 |
| LeetCode: Linked Lists | 26 |
| Stacks | 24 |
| Queues & Deques | 24 |
| LeetCode: Stacks & Queues | 22 |
| Problem Solving & Complexity | 18 |

Roughly 42 easy / 61 medium / 37 hard, and 45 of them include a Java snippet.

Every answer key was checked twice: once by a reviewer that saw the proposed answer, and
again by two independent solvers that were given the questions **with the answer key removed**
and had to solve them from scratch. All 140 agreed. That does not make them infallible —
if you spot a wrong key, please open an issue.

### Editing or adding questions

Questions live in `data/*.json`, one file per topic, listed in `data/index.json`.
No build step — edit the JSON, commit, done.

```jsonc
{
  "id": "stk-25",                       // unique
  "topic": "Stacks",
  "difficulty": "easy",                 // easy | medium | hard
  "question": "Keep it under ~160 characters so it reads on a projector.",
  "code": "Deque<Integer> s = new ArrayDeque<>();\ns.push(1);",   // "" for no snippet
  "options": ["exactly", "four", "short", "options"],
  "answer": 2,                          // 0-based index into options
  "explanation": "One or two sentences shown after the reveal."
}
```

To add a whole new topic, drop a `data/mytopic.json` with `{ "key", "label", "questions" }`
and add a matching entry to `data/index.json`. It appears in the topic picker automatically.

Malformed questions (missing fields, not exactly four options, answer out of range) are
skipped at load time rather than crashing the app.

## Running locally

ES modules and `fetch` need a real HTTP origin, so `file://` will not work.

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123.

To test live play on one machine, open a second tab (or a private window) and join with the
PIN — two tabs are two independent peers.

## Deploying to GitHub Pages

Already set up for this repo. For a fork:

1. **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**
2. Wait a minute, then open `https://<user>.github.io/<repo>/`

`.nojekyll` is committed so Jekyll does not touch the files.

Pages must be served over **HTTPS** for WebRTC to work — GitHub Pages is, so this is
automatic.

## Layout

```
index.html          all screens as <section data-screen="...">
css/style.css       the whole theme
js/app.js           bootstrap, routing, setup screen, question browser
js/host.js          authoritative game loop (lobby → question → reveal → board → podium)
js/player.js        joined client; purely reactive to host messages
js/solo.js          offline single-player loop
js/net.js           WebRTC transport, PIN allocation, heartbeats, reconnect
js/engine.js        bank loading, quiz building, scoring, ranking
js/ui.js            DOM helpers and shared screen rendering
js/sound.js         WebAudio effects — no audio files
js/confetti.js      canvas confetti
vendor/             PeerJS + QR generator, committed so there are no CDN calls at runtime
data/               the question bank
```

Both third-party libraries are vendored, so the published page makes **zero external
requests** — only the WebRTC signalling connection when you actually host or join a game.

## Options

Set per game on the setup screen:

* **Shuffle answer order** — same question, different tile positions each game.
* **Streak bonus points** — reward consecutive correct answers.
* **Show explanations** — display the "why" after each reveal.
* **Auto-advance** — run hands-free; the host moves on by itself.
* **Projector mode** — hide the question text on phones so players look up at the big screen.
  Leave it off for remote play, where the phone is the only screen.

Keyboard: `1`–`4` to answer, `Enter`/`Space` to advance, and the speaker icon mutes.

## Using a private signalling server

The default PeerJS broker is a free shared service and can rate-limit. To point at your own
[PeerServer](https://github.com/peers/peerjs-server), add query parameters:

```
?peerhost=peer.example.com&peerport=443&peerpath=/&peersecure=1
```

Both host and players need the same parameters.

## Accessibility

Answer tiles carry both a colour and a shape (triangle / diamond / circle / square) so they
are distinguishable without colour vision, plus `aria-label`s naming the shape. Focus rings
are visible throughout, and `prefers-reduced-motion` disables the animations.

## Licence

MIT — see [LICENSE](LICENSE).

Not affiliated with or endorsed by Kahoot!. The look is an homage; the code is original.
