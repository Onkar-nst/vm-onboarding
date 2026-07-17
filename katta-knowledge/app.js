/* Katta Knowledge Interface — app logic
 * Ask a question → local retrieval engine scores episode segments →
 * answer types itself out with sound → sources cite episode + timestamp
 * with hover thumbnail previews. History persists in localStorage.
 */

const LS_HISTORY = "katta_history_v1";
const LS_SOUND = "katta_sound_v1";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- helpers ---------------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- SVG thumbnails (generated, offline) ---------------- */

function epThumb(ep, w = 320) {
  const h = Math.round(w * 9 / 16);
  const hue = ep.hue;
  const short = ep.title.split(":")[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 320 180">
    <defs>
      <linearGradient id="g${ep.id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue}, 45%, 16%)"/>
        <stop offset="1" stop-color="hsl(${hue}, 60%, 7%)"/>
      </linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#g${ep.id})"/>
    <circle cx="270" cy="40" r="70" fill="hsl(${hue}, 70%, 45%)" opacity="0.12"/>
    <circle cx="40" cy="160" r="50" fill="hsl(${hue}, 70%, 55%)" opacity="0.10"/>
    <text x="22" y="46" font-family="Georgia, serif" font-size="30" fill="hsl(${hue}, 55%, 78%)">KATTA</text>
    <text x="22" y="70" font-family="Georgia, serif" font-size="15" fill="hsl(${hue}, 25%, 60%)" font-style="italic">Session ${String(ep.no).padStart(2, "0")}</text>
    <text x="22" y="132" font-family="Georgia, serif" font-size="19" fill="#f2ead8">${esc(short)}</text>
    <rect x="22" y="146" width="60" height="3" fill="hsl(${hue}, 70%, 60%)"/>
    <rect x="262" y="152" width="46" height="18" rx="4" fill="rgba(0,0,0,0.65)"/>
    <text x="285" y="165" font-family="monospace" font-size="11" fill="#fff" text-anchor="middle">${ep.duration}</text>
  </svg>`;
}

/* ---------------- retrieval engine ---------------- */

const STOP = new Set(("a an the is are was were be been being do does did what which who whom whose why how when where " +
  "i we you they he she it my our your their of in on at to for from with without about into over under and or but not " +
  "so if then than as by that this these those there here can could should would will shall may might must have has had " +
  "me us them him her its make makes made get gets got go goes went really very just some any tell explain talk say said").split(" "));

function tokens(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/)
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(w => w.replace(/(ing|ers|er|ed|es|s)$/, m => (m === "es" || m === "s") && w.length <= 4 ? m : ""))
    .map(w => w || null).filter(Boolean);
}

// crude stem both sides so "hiring" matches "hire"
function stem(w) { return w.replace(/(ing|ers|er|ed|es|s)$/, ""); }

function scoreSegment(qTokens, seg, ep) {
  const kw = new Set(seg.keywords.map(stem));
  const txt = new Set(tokens(seg.text).map(stem));
  const topics = new Set(ep.topics.flatMap(t => tokens(t)).map(stem));
  let score = 0;
  for (const t of qTokens) {
    const s = stem(t);
    if (kw.has(s)) score += 5;
    if (txt.has(s)) score += 1.2;
    if (topics.has(s)) score += 1.5;
  }
  return score;
}

function search(query) {
  const q = tokens(query);
  if (!q.length) return { best: null, supports: [] };
  const scored = [];
  for (const ep of EPISODES) {
    for (const seg of ep.segments) {
      const s = scoreSegment(q, seg, ep);
      if (s > 0) scored.push({ ep, seg, s });
    }
  }
  scored.sort((a, b) => b.s - a.s);
  const best = scored[0] && scored[0].s >= 5 ? scored[0] : null;
  const supports = best
    ? scored.slice(1, 4).filter(x => x.s >= Math.max(4, best.s * 0.35) && x.ep.id !== best.ep.id).slice(0, 2)
    : [];
  return { best, supports };
}

/* ---------------- sound (WebAudio, no assets) ---------------- */

let soundOn = localStorage.getItem(LS_SOUND) !== "off";
let audioCtx = null;

function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function blip() {
  if (!soundOn) return;
  try {
    const ctx = ac();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 620 + Math.random() * 500;
    g.gain.setValueAtTime(0.012, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.05);
  } catch (e) { /* audio blocked — fine */ }
}
function chime() {
  if (!soundOn) return;
  try {
    const ctx = ac();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.05, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.55);
    });
  } catch (e) { /* fine */ }
}

/* ---------------- history ---------------- */

function loadHistory() { return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]"); }
function saveHistory(h) { localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(0, 12))); }

/* ---------------- typewriter ---------------- */

let typeTimer = null;

function typeOut(el, text, done) {
  clearInterval(typeTimer);
  el.innerHTML = `<span class="caret"></span>`;
  let i = 0;
  const caret = el.querySelector(".caret");
  typeTimer = setInterval(() => {
    const step = 2 + Math.floor(Math.random() * 3); // 2–4 chars per tick
    i = Math.min(text.length, i + step);
    caret.insertAdjacentText("beforebegin", text.slice(Math.max(0, i - step), i));
    if (i % 6 < 3) blip();
    if (i >= text.length) {
      clearInterval(typeTimer);
      setTimeout(() => caret.remove(), 1200);
      if (done) done();
    }
  }, 24);
}

/* ---------------- render ---------------- */

const answerZone = $("#answerZone");
const askInput = $("#askInput");
const askBtn = $("#askBtn");

function sourceCard(hit) {
  const { ep, seg } = hit;
  return `
    <div class="source-card" data-ep="${ep.id}" data-t="${seg.t}" title="Katta Session ${ep.no} · ${seg.t}">
      <div class="thumb">${epThumb(ep, 160)}</div>
      <div class="s-info">
        <div class="s-title">${esc(ep.title)}</div>
        <div class="s-meta"><span class="ts-chip">▶ ${seg.t}</span>Session ${String(ep.no).padStart(2, "0")} · ${ep.date}</div>
      </div>
      <div class="preview">
        ${epThumb(ep, 300)}
        <div class="p-cap">Jumps to <span class="t">${seg.t}</span> — ${esc(ep.title)}</div>
      </div>
    </div>`;
}

function ask(query) {
  query = query.trim();
  if (!query) return;
  askInput.value = query;
  askBtn.disabled = true;
  clearInterval(typeTimer);

  answerZone.innerHTML = `
    <div class="thinking"><span class="orb"></span> Scanning ${EPISODES.length} Katta sessions…</div>`;

  // theatrical delay, like the real thing
  setTimeout(() => {
    const { best, supports } = search(query);
    if (!best) {
      answerZone.innerHTML = `
        <div class="answer-card">
          <div class="q-echo">You asked · <b>${esc(query)}</b></div>
          <div class="answer-text no-match"></div>
        </div>`;
      typeOut($(".answer-text", answerZone),
        "The Katta hasn't covered that one yet. Try the sessions on decisions, hiring, coordination, risk, distribution, leverage, pricing, or learning — or ask it in the next Katta.",
        null);
      askBtn.disabled = false;
      return;
    }

    const hits = [best, ...supports];
    answerZone.innerHTML = `
      <div class="answer-card">
        <div class="q-echo">The Katta answers · <b>${esc(query)}</b></div>
        <div class="answer-text"></div>
        <div class="sources" style="opacity:0; transition: opacity 0.6s">
          <div class="s-label">Sources & timestamps</div>
          <div class="source-row">${hits.map(sourceCard).join("")}</div>
          <details class="peek">
            <summary>Read the transcript excerpt</summary>
            <blockquote><span class="who">Session ${String(best.ep.no).padStart(2, "0")} · ${best.seg.t} · ${esc(best.ep.title)}</span>${esc(best.seg.text)}</blockquote>
          </details>
        </div>
      </div>`;

    typeOut($(".answer-text", answerZone), best.seg.text, () => {
      chime();
      $(".sources", answerZone).style.opacity = "1";
      askBtn.disabled = false;
    });
    // reveal sources even while typing finishes, after a beat
    setTimeout(() => { const s = $(".sources", answerZone); if (s) s.style.opacity = "1"; }, Math.min(6000, best.seg.text.length * 14));

    // history
    const h = loadHistory().filter(x => x.q.toLowerCase() !== query.toLowerCase());
    h.unshift({ q: query, ep: `S${String(best.ep.no).padStart(2, "0")} · ${best.seg.t}`, at: Date.now() });
    saveHistory(h);
    renderHistory();

    $$(".source-card", answerZone).forEach(c => c.addEventListener("click", () => showEpisodeModal(c.dataset.ep, c.dataset.t)));
  }, 900 + Math.random() * 700);
}

/* ---------------- history UI ---------------- */

function renderHistory() {
  const h = loadHistory();
  const wrap = $("#history");
  if (!h.length) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = `
    <h3>Previously asked</h3>
    <div class="history-list">
      ${h.map(x => `<button class="hist-item" data-q="${esc(x.q)}">
        <span class="h-q">${esc(x.q)}</span><span class="h-ep">${esc(x.ep)}</span>
      </button>`).join("")}
    </div>`;
  $$(".hist-item", wrap).forEach(b => b.addEventListener("click", () => ask(b.dataset.q)));
}

/* ---------------- episode library modal ---------------- */

function showEpisodeModal(epId, t) {
  const back = document.createElement("div");
  back.className = "modal-back";
  const list = EPISODES.map(ep => `
    <div class="ep-row" style="${ep.id === epId ? "border-color: var(--gold-deep)" : ""}">
      <div class="thumb">${epThumb(ep, 216)}</div>
      <div>
        <h4>${esc(ep.title)}</h4>
        <div class="meta">Session ${String(ep.no).padStart(2, "0")} · ${ep.date} · ${ep.duration}<br>
        Topics: ${ep.topics.join(", ")}${ep.id === epId && t ? `<br><span class="ts-chip" style="margin-top:6px">▶ your answer is at ${t}</span>` : ""}</div>
      </div>
    </div>`).join("");
  back.innerHTML = `
    <div class="modal">
      <h3>The Katta Library</h3>
      <div class="sub">Every internal Katta session, indexed and timestamped. In production each card links to the recording at the exact moment.</div>
      ${list}
      <div class="actions"><button class="btn" id="closeLib">Close</button></div>
    </div>`;
  document.body.appendChild(back);
  back.addEventListener("click", e => { if (e.target === back) back.remove(); });
  $("#closeLib", back).addEventListener("click", () => back.remove());
}

/* ---------------- wiring ---------------- */

askBtn.addEventListener("click", () => ask(askInput.value));
askInput.addEventListener("keydown", e => { if (e.key === "Enter") ask(askInput.value); });

$("#chips").innerHTML = SUGGESTIONS.map(s => `<button class="chip">${esc(s)}</button>`).join("");
$$("#chips .chip").forEach(c => c.addEventListener("click", () => ask(c.textContent)));

const soundBtn = $("#soundBtn");
function reflectSound() {
  soundBtn.textContent = soundOn ? "🔊" : "🔇";
  soundBtn.classList.toggle("active", soundOn);
  soundBtn.title = soundOn ? "Sound on" : "Sound off";
}
soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  localStorage.setItem(LS_SOUND, soundOn ? "on" : "off");
  reflectSound();
  if (soundOn) blip();
});
$("#libBtn").addEventListener("click", () => showEpisodeModal(null, null));

reflectSound();
renderHistory();
