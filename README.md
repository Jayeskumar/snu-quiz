# SNU Quiz

A Kahoot-style **live** quiz on Java data structures — Linked Lists, Stacks, Queues, and the
classic LeetCode problems built on them.

**▶ Play: https://jayeskumar.github.io/snu-quiz/**

Host puts the game PIN on the projector, everyone joins from their phone, questions appear,
fastest correct answer scores most. Everyone plays as a drawn character — a rabbit whose
ears flop as it jumps, a penguin that waddles, a robot that stomps — and they dance in the
lobby, jump when their player answers and cheer or slump on the reveal. Podium, crown and
confetti at the end.

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

## Characters

Every player is a character from a **pack** the teacher picks on the setup screen. They
dance in the lobby, jump when that player answers, cheer or slump on the reveal, and dance
on the podium under a crown at the end.

The characters are **drawn**, not emoji — each one is an inline SVG whose ears, arms, legs,
tail and eyes are separate pieces that move independently, so a dance is a real dance and
not a wobbling icon. Ten idle loops and ten dances share one skeleton, so every character
can perform every move.

Two packs ship today:

| Pack | What is in it | Characters |
|---|---|---:|
| **Animals** | 🐰 jumping, hopping, waddling creatures | 28 |
| **Cartoon crew** | 🤖 robots, wizards, heroes and other troublemakers | 28 |

The host hands each phone a character nobody else has as it joins. Leave **Let players pick
their own character** on and a student can swap to any free one from their phone; the ones
already taken are greyed out, and if two students reach for the same animal at the same
instant the host settles it and tells the loser what they got instead. A phone remembers its
choice, so the same student turns up as the same fox next lesson.

It is all SVG and CSS keyframes — no sprite sheets, no animation library, no image files
and no extra requests. The **Animations** switch stops all of it for everyone, as does the
browser's own `prefers-reduced-motion`.

### Adding a pack

A pack is data in `PACKS` in `js/avatars.js`; the artwork for each character is a line in
`SPECS` in `js/characters.js`. Add both and the pack appears in the teacher's picker, in
every player's chooser and on the podium — nothing else to wire up:

```js
{
  key: 'space',                 // unique; saved in the host's config
  label: 'Space crew',          // shown to the teacher
  icon: '\u{1F680}',            // one glyph for the pack card
  blurb: 'One line under the pack name.',
  characters: [
    { id: 'rocket', name: 'Rocket', glyph: '\u{1F680}', anim: 'zoom', dance: 'slide' },
    // 16+ characters keeps a whole class from clashing
  ],
}
```

`anim` is the idle loop and `dance` the celebration, both drawn in `css/style.css`:

| | |
|---|---|
| `anim` | `jump` `hop` `bounce` `waddle` `float` `wiggle` `spin` `zoom` `sway` `stomp` |
| `dance` | `disco` `shimmy` `bop` `twirl` `groove` `jive` `slide` `headbang` `worm` `robot` |

`dance` is optional — leave it out and one is picked from the id, so a character always
dances the same way. To add a move, write the keyframes and a matching rule next to the
others and add the name to `ANIMS` or `DANCES`.

Then draw the character. `SPECS` in `js/characters.js` maps a character id to one of seven
templates — `critter`, `bird`, `swim`, `bug`, `person`, `bot`, `orb` — plus colours and the
two or three features that make it recognisable:

```js
rocket: { tpl: 'bot', main: '#e8503a', alt: '#c53a26', glow: '#a8e6ff', oneAntenna: true },
```

Every template lays its pieces on the same skeleton in a 100 x 100 box, and each moving
piece carries its own `transform-origin`, which is why one keyframe can rotate a rabbit's
ear and a penguin's wing alike. A character with no `SPECS` entry falls back to its emoji,
still animated by the body loops.

The host sends the whole pack definition to each player when they join, so a class on an
older cached copy of the page still sees a pack that only the teacher's build knows about —
as emoji, since that build has no artwork for it.

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
js/avatars.js       character packs, their motion, and the pickers
js/characters.js    the drawn characters — SVG templates and per-character art
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
* **Character pack** — which set of characters the class plays as.
* **Animations** — turn all motion off, for everyone.
* **Let players pick their own character** — off means the host's assignment is final.
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
are distinguishable without colour vision, plus `aria-label`s naming the shape. Every
character is announced by name rather than as a bare emoji. Focus rings are visible
throughout, and `prefers-reduced-motion` disables the animations — the characters included,
whatever the teacher's switch says.

## Licence

MIT — see [LICENSE](LICENSE).

Not affiliated with or endorsed by Kahoot!. The look is an homage; the code is original.
