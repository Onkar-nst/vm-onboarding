# Katta — Vibe-Coded Internal Tools Suite

Working replicas of **apps #2, #3 and #4** from Varun Mayya's video
[*"5 Apps I Built With AI to Run My 500-Person Company"*](https://www.youtube.com/watch?v=M1E4ZzdpOco).

Three self-contained web apps — no build step, no backend, no API keys.
All data persists in your browser's `localStorage` (the "database"), and the
Q&A app ships with a fully local retrieval engine (the "AI" stand-in), so
everything works offline out of the box.

![Hub](docs/screenshots/hub.png)

## Quick start

```sh
./run.sh          # serves everything at http://localhost:4173
```

or `python3 -m http.server 4173` from this folder, then open
**http://localhost:4173**. (Serving over `localhost` also enables the camera
for Gear Wall's QR scanner. Opening the `index.html` files directly works too,
minus the camera.)

---

## App No. 2 — VM Onboarding  (`vm-onboarding/`)

The internal "ed-tech platform" that replaces a long onboarding document for
the video-editing team.

![VM Onboarding](docs/screenshots/vm-onboarding.png)

- **8 short modules** (Welcome & Setup, Pacing, Hook & Intro, AI Asset
  Generation, B-Rolls & Screenshots, Articles & Collages, Typography &
  Subtitles, Audio & Export), each with written lessons and house rules —
  e.g. *"for at least 90% of a reel, VM's face should not be on screen"* and
  the 1080×1920 sequence settings.
- **Quick-check MCQ gating** — each module unlocks the next only when you
  answer its quick check; correct answers throw **confetti**, wrong attempts
  are logged as gaps.
- **Final Quiz** (8 questions, pass mark 5) once all modules are done.
- **"Your Final Edit"** day-one assignment: a 10-point self-checklist, a
  link upload (Drive / Frame.io / YouTube) and notes, submitted for review.
- **Leads view** — per-person progress, most-missed questions (so feedback
  targets only the gaps), and every Final Edit submission.

## App No. 3 — Gear Wall  (`gear-wall/`)

The equipment room, digitized — cameras, lights and mics with QR identities.

![Gear Wall](docs/screenshots/gear-wall.png)

- **The Wall** — every piece of gear as a card with live status
  (**Available / In use / Damaged**), home location, printable **QR label**
  and, when out, which shoot has it and for how long.
- **Calendar** — month view of shoots. **“+ Shoot”** books gear: name, date,
  location (Studio 1 / Studio 2 / Outdoor + where), IP/project, gear
  multi-select, requester → the request lands as **Pending approval**.
- **Admin mode** (header toggle) — approve/reject bookings, mark gear
  damaged/repaired, add new gear (it gets a QR identity instantly).
- **Scanner** — scan the QR sticker with the camera (jsQR + getUserMedia):
  first scan **picks up** gear for its approved shoot, second scan
  **returns** it and records the usage duration. Manual ID entry and
  "simulate scan" buttons cover machines without a camera.
- **Activity** — pending approvals, full usage history with durations, and
  an event log.

## App No. 4 — Katta Knowledge Interface  (`katta-knowledge/`)

Ask anything the internal "Katta" sessions have covered — without rewatching
an hour of video.

![Katta Knowledge](docs/screenshots/katta-knowledge.png)

- Big theatrical ask box with suggestion chips (*"What is GTO?"*,
  *"What makes a good hire?"* …).
- A local **retrieval engine** scores 8 indexed sessions (24 timestamped
  segments) against your question and composes the answer.
- The answer **types itself out with sound** (WebAudio — no audio files),
  ending in a chime; sound is mutable and the preference persists.
- **Sources with exact timestamps** — each answer cites episode + timestamp
  chip; hovering a source pops up a large **thumbnail preview**, and clicking
  opens the episode library.
- Question **history** persists and is re-askable in one click.
- To make it "real AI": swap `search()` in `app.js` for an embeddings + LLM
  call and point the sources at your recordings — the UI needs no changes.

---

## Testing

`.tests/harness.html` drives all three apps end-to-end in iframes
(login → quiz gating → persistence; QR pickup → return → blocked-pending →
unknown-code; retrieval accuracy → typewriter → history). Run it by opening
`http://localhost:4173/.tests/harness.html` — headless run at build time:
**34/34 checks passed**.

## Tech

Vanilla HTML/CSS/JS. Vendored libraries: `qrcode-generator` (QR encoding) and
`jsQR` (camera decoding) in `gear-wall/vendor/`. Everything else is
hand-rolled: confetti, calendar, typewriter, WebAudio sounds, SVG thumbnails,
retrieval engine.
