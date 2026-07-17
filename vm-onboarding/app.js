/* VM Onboarding — app logic
 * Views: login → home (module grid) → module → final quiz → final edit → done
 * Admin view shows every profile's progress, gaps and submissions.
 * All state persists in localStorage.
 */

const LS_PROFILES = "vmob_profiles";   // { [name]: profile }
const LS_CURRENT = "vmob_current";     // name of active profile
const LS_SUBMISSIONS = "vmob_submissions"; // [ {name, link, notes, checklist, at} ]

const $ = (sel, el = document) => el.querySelector(sel);
const app = $("#app");

/* ---------------- state ---------------- */

function loadProfiles() { return JSON.parse(localStorage.getItem(LS_PROFILES) || "{}"); }
function saveProfiles(p) { localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }
function loadSubmissions() { return JSON.parse(localStorage.getItem(LS_SUBMISSIONS) || "[]"); }
function saveSubmissions(s) { localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(s)); }

function newProfile(name) {
  return {
    name,
    createdAt: Date.now(),
    passed: [],            // module ids passed
    wrongAnswers: [],      // { moduleId, question, picked } — the "gaps"
    finalQuiz: null,       // { score, total, wrong: [q], at }
    finalEdit: null        // { link, notes, checklist: [bool], at }
  };
}

let profiles = loadProfiles();
let currentName = localStorage.getItem(LS_CURRENT) || null;
let me = currentName ? profiles[currentName] : null;

function persist() {
  if (me) profiles[me.name] = me;
  saveProfiles(profiles);
}

/* ---------------- confetti ---------------- */

const confettiCanvas = $("#confetti");
const ctx = confettiCanvas.getContext("2d");
let confettiPieces = [];
let confettiRunning = false;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeConfetti);
resizeConfetti();

function burstConfetti(big = false) {
  const colors = ["#ff5c29", "#ffb020", "#1f9d55", "#4a90d9", "#e858a1", "#f5efe4"];
  const count = big ? 220 : 120;
  const cx = window.innerWidth / 2;
  for (let i = 0; i < count; i++) {
    confettiPieces.push({
      x: cx + (Math.random() - 0.5) * 240,
      y: window.innerHeight * (big ? 0.45 : 0.35),
      vx: (Math.random() - 0.5) * 14,
      vy: -6 - Math.random() * 10,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 130 + Math.random() * 60
    });
  }
  if (!confettiRunning) { confettiRunning = true; tickConfetti(); }
}

function tickConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiPieces.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.vx *= 0.99; p.rot += p.vr; p.life--;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  });
  confettiPieces = confettiPieces.filter(p => p.life > 0 && p.y < confettiCanvas.height + 40);
  if (confettiPieces.length) requestAnimationFrame(tickConfetti);
  else { confettiRunning = false; ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

/* ---------------- toast ---------------- */

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------------- helpers ---------------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function moduleState(mod, idx) {
  if (me.passed.includes(mod.id)) return "passed";
  const firstLockedIdx = COURSE.modules.findIndex(m => !me.passed.includes(m.id));
  return idx === firstLockedIdx ? "available" : "locked";
}
function allModulesPassed() { return COURSE.modules.every(m => me.passed.includes(m.id)); }
function finalQuizPassed() { return me.finalQuiz && me.finalQuiz.score >= COURSE.finalQuiz.passScore; }
function fmtDate(ts) { return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }

function setHeader() {
  const pill = $("#progressPill");
  const adminBtn = $("#adminBtn");
  const switchBtn = $("#switchBtn");
  if (!me) { pill.style.display = "none"; adminBtn.style.display = "none"; switchBtn.style.display = "none"; return; }
  pill.style.display = "";
  adminBtn.style.display = "";
  switchBtn.style.display = "";
  const total = COURSE.modules.length;
  pill.innerHTML = `<b>${esc(me.name)}</b> &middot; ${me.passed.length}/${total} modules`;
}

/* ---------------- views ---------------- */

function render(view, arg) {
  setHeader();
  if (!me) return viewLogin();
  switch (view) {
    case "module": return viewModule(arg);
    case "finalQuiz": return viewFinalQuiz();
    case "finalEdit": return viewFinalEdit();
    case "done": return viewDone();
    case "admin": return viewAdmin();
    default: return viewHome();
  }
}

/* ----- login ----- */

function viewLogin() {
  app.innerHTML = `
    <div class="login-box">
      <div class="big-icon">🎬</div>
      <h2>VM Onboarding</h2>
      <p>${esc(COURSE.tagline)}<br>Enter your name to start (or continue) your onboarding.</p>
      <input id="nameInput" placeholder="Your name" maxlength="40" autocomplete="off">
      <button class="btn accent" id="startBtn" style="width:100%">Start Onboarding</button>
    </div>`;
  const input = $("#nameInput");
  const go = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    currentName = name;
    localStorage.setItem(LS_CURRENT, name);
    if (!profiles[name]) profiles[name] = newProfile(name);
    me = profiles[name];
    persist();
    toast(`Welcome, ${name}!`);
    render("home");
  };
  $("#startBtn").addEventListener("click", go);
  input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  input.focus();
}

/* ----- home ----- */

function viewHome() {
  const total = COURSE.modules.length;
  const passed = me.passed.length;
  const cards = COURSE.modules.map((m, i) => {
    const st = moduleState(m, i);
    const stateLabel = { locked: "🔒 Locked", available: "▶ Start", passed: "✓ Passed" }[st];
    return `
      <div class="mod-card ${st} ${st !== "locked" ? "clickable" : ""}" data-mod="${m.id}" data-state="${st}">
        <div class="idx">${String(i + 1).padStart(2, "0")}</div>
        <div class="icon">${m.icon}</div>
        <h3>${esc(m.title)}</h3>
        <div class="meta">${m.minutes} min &middot; ${m.sections.length} sections + quick check</div>
        <span class="state ${st}">${stateLabel}</span>
      </div>`;
  }).join("");

  const fqState = !allModulesPassed() ? "locked" : (finalQuizPassed() ? "passed" : "available");
  const feState = !finalQuizPassed() ? "locked" : (me.finalEdit ? "passed" : "available");

  app.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <div>
          <h1>Welcome to <span>${esc(COURSE.team)}</span></h1>
          <p>${esc(COURSE.tagline)} Each module unlocks the next once you nail the quick check. Finish with the final quiz and your day-one Final Edit.</p>
        </div>
        <div class="hero-stats">
          <div class="stat"><div class="n">${passed}/${total}</div><div class="l">Modules</div></div>
          <div class="stat"><div class="n">${me.finalQuiz ? me.finalQuiz.score + "/" + me.finalQuiz.total : "—"}</div><div class="l">Final quiz</div></div>
          <div class="stat"><div class="n">${me.finalEdit ? "✓" : "—"}</div><div class="l">Final edit</div></div>
        </div>
      </div>
      <div class="modules">
        ${cards}
        <div class="mod-card special ${fqState} ${fqState !== "locked" ? "clickable" : ""}" id="finalQuizCard">
          <div class="idx">🏁</div>
          <div class="icon">📝</div>
          <h3>Final Quiz</h3>
          <div class="meta">${COURSE.finalQuiz.questions.length} questions &middot; pass ${COURSE.finalQuiz.passScore}+</div>
          <span class="state ${fqState}">${fqState === "locked" ? "🔒 Finish all modules" : fqState === "passed" ? "✓ Passed" : "▶ Start"}</span>
        </div>
        <div class="mod-card special ${feState} ${feState !== "locked" ? "clickable" : ""}" id="finalEditCard">
          <div class="idx">🎞️</div>
          <div class="icon">🚀</div>
          <h3>Your Final Edit</h3>
          <div class="meta">Day-one assignment &middot; checklist + submission</div>
          <span class="state ${feState}">${feState === "locked" ? "🔒 Pass the final quiz" : feState === "passed" ? "✓ Submitted" : "▶ Start"}</span>
        </div>
      </div>
    </div>`;

  app.querySelectorAll(".mod-card[data-mod]").forEach(card => {
    if (card.dataset.state === "locked") return;
    card.addEventListener("click", () => render("module", card.dataset.mod));
  });
  if (fqState !== "locked") $("#finalQuizCard").addEventListener("click", () => render(fqState === "passed" ? "home" : "finalQuiz"));
  if (feState !== "locked") $("#finalEditCard").addEventListener("click", () => render(me.finalEdit ? "done" : "finalEdit"));
}

/* ----- module ----- */

function viewModule(id) {
  const idx = COURSE.modules.findIndex(m => m.id === id);
  const mod = COURSE.modules[idx];
  const alreadyPassed = me.passed.includes(id);

  const sections = mod.sections.map(s => `
    <div class="lesson">
      <h2>${esc(s.h)}</h2>
      <div class="body">${s.body}</div>
    </div>`).join("");

  const opts = mod.quiz.options.map((o, i) => `
    <button class="opt" data-i="${i}"><span class="key">${"ABCD"[i]}</span> ${esc(o)}</button>`).join("");

  app.innerHTML = `
    <div class="wrap">
      <div class="mod-head">
        <div class="crumb"><a id="backHome">← All modules</a> &nbsp;/&nbsp; Module ${idx + 1} of ${COURSE.modules.length}</div>
        <h1>${mod.icon} ${esc(mod.title)}</h1>
        <p class="sub">${esc(mod.intro)}</p>
      </div>
      ${sections}
      <div class="quiz">
        <div class="tag">Quick check ${alreadyPassed ? "· already passed ✓" : "· pass to unlock the next module"}</div>
        <h2>${esc(mod.quiz.q)}</h2>
        <div class="opts">${opts}</div>
        <div class="feedback" id="quizFeedback"></div>
        <div class="actions">
          <button class="btn primary" id="nextBtn" style="display:none">Continue →</button>
        </div>
      </div>
    </div>`;

  $("#backHome").addEventListener("click", () => render("home"));

  const optBtns = [...app.querySelectorAll(".opt")];
  const feedback = $("#quizFeedback");
  const nextBtn = $("#nextBtn");
  let solved = false;

  optBtns.forEach(btn => btn.addEventListener("click", () => {
    if (solved) return;
    const i = Number(btn.dataset.i);
    if (i === mod.quiz.correct) {
      solved = true;
      btn.classList.add("right");
      feedback.className = "feedback good";
      feedback.textContent = "Correct! " + mod.quiz.explain;
      burstConfetti();
      if (!me.passed.includes(mod.id)) {
        me.passed.push(mod.id);
        persist();
        toast(idx + 1 < COURSE.modules.length ? "Module passed — next one unlocked!" : "All modules passed!");
      }
      nextBtn.style.display = "";
      nextBtn.textContent = idx + 1 < COURSE.modules.length ? `Next: ${COURSE.modules[idx + 1].title} →` : "Go to Final Quiz →";
      nextBtn.onclick = () => idx + 1 < COURSE.modules.length ? render("module", COURSE.modules[idx + 1].id) : render("finalQuiz");
      setHeader();
    } else {
      btn.classList.add("wrong");
      btn.disabled = true;
      feedback.className = "feedback bad";
      feedback.textContent = "Wrong — check the sections above and try again.";
      me.wrongAnswers.push({ moduleId: mod.id, module: mod.title, question: mod.quiz.q, picked: mod.quiz.options[i], at: Date.now() });
      persist();
    }
  }));
}

/* ----- final quiz ----- */

function viewFinalQuiz() {
  const qs = COURSE.finalQuiz.questions;
  let qi = 0;
  let score = 0;
  const wrong = [];

  function draw() {
    if (qi >= qs.length) return finish();
    const q = qs[qi];
    const opts = q.options.map((o, i) => `
      <button class="opt" data-i="${i}"><span class="key">${"ABCD"[i]}</span> ${esc(o)}</button>`).join("");
    app.innerHTML = `
      <div class="wrap" style="max-width:760px">
        <div class="mod-head">
          <div class="crumb"><a id="backHome">← All modules</a> &nbsp;/&nbsp; Final Quiz</div>
          <h1>📝 ${esc(COURSE.finalQuiz.title)}</h1>
          <p class="sub">One attempt per question. Score ${COURSE.finalQuiz.passScore}+ of ${qs.length} to unlock your Final Edit.</p>
        </div>
        <div class="fq-progress">Question ${qi + 1} of ${qs.length} &middot; score ${score}</div>
        <div class="fq-bar"><i style="width:${(qi / qs.length) * 100}%"></i></div>
        <div class="quiz">
          <div class="tag">Final quiz</div>
          <h2>${esc(q.q)}</h2>
          <div class="opts">${opts}</div>
          <div class="feedback" id="quizFeedback"></div>
        </div>
      </div>`;
    $("#backHome").addEventListener("click", () => render("home"));
    let answered = false;
    app.querySelectorAll(".opt").forEach(btn => btn.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const i = Number(btn.dataset.i);
      const fb = $("#quizFeedback");
      app.querySelectorAll(".opt").forEach(b => b.disabled = true);
      if (i === q.correct) {
        score++;
        btn.classList.add("right");
        fb.className = "feedback good"; fb.textContent = "Correct!";
      } else {
        btn.classList.add("wrong");
        app.querySelector(`.opt[data-i="${q.correct}"]`).classList.add("right");
        fb.className = "feedback bad"; fb.textContent = "Not this one.";
        wrong.push(q.q);
      }
      setTimeout(() => { qi++; draw(); }, 900);
    }));
  }

  function finish() {
    const passed = score >= COURSE.finalQuiz.passScore;
    me.finalQuiz = { score, total: qs.length, wrong, at: Date.now() };
    persist();
    if (passed) burstConfetti(true);
    app.innerHTML = `
      <div class="wrap" style="max-width:640px">
        <div class="done-box">
          <div class="big">${passed ? "🏆" : "😬"}</div>
          <h1>${passed ? "Final quiz passed!" : "Not quite there yet"}</h1>
          <p>You scored <b>${score} / ${qs.length}</b>. ${passed
            ? "Your Final Edit assignment is now unlocked — that's the real test."
            : `You need ${COURSE.finalQuiz.passScore}+ to pass. Re-read the modules and take it again — the gaps are logged for your lead.`}</p>
          <button class="btn accent" id="fqNext">${passed ? "Go to Final Edit →" : "Retake quiz"}</button>
          <button class="btn ghost" id="fqHome">Back to modules</button>
        </div>
      </div>`;
    $("#fqNext").addEventListener("click", () => passed ? render("finalEdit") : render("finalQuiz"));
    $("#fqHome").addEventListener("click", () => render("home"));
  }

  draw();
}

/* ----- final edit ----- */

function viewFinalEdit() {
  const fe = COURSE.finalEdit;
  const items = fe.checklist.map((c, i) => `
    <label class="check-item" data-i="${i}">
      <input type="checkbox" data-i="${i}">
      <span>${esc(c)}</span>
    </label>`).join("");

  app.innerHTML = `
    <div class="wrap" style="max-width:760px">
      <div class="mod-head">
        <div class="crumb"><a id="backHome">← All modules</a> &nbsp;/&nbsp; Final Edit</div>
        <h1>🎞️ ${esc(fe.title)}</h1>
      </div>
      <div class="brief">${fe.brief}</div>
      <h3 style="margin-bottom:12px">Self-check every item before you submit</h3>
      <div class="check-list">${items}</div>
      <div class="submit-form">
        <label>Link to your reel</label>
        <input id="linkInput" placeholder="Drive / Frame.io / YouTube link" autocomplete="off">
        <div class="hint">Upload anywhere your lead can open — Drive, Frame.io or an unlisted YouTube link.</div>
        <label>Notes for your reviewer</label>
        <textarea id="notesInput" placeholder="Anything you struggled with, choices you made, questions you have…"></textarea>
        <div style="margin-top:20px; display:flex; gap:10px; align-items:center">
          <button class="btn accent" id="submitBtn" disabled>Submit for review</button>
          <span class="hint" id="submitHint">Check all ${fe.checklist.length} items and add your link to submit.</span>
        </div>
      </div>
    </div>`;

  $("#backHome").addEventListener("click", () => render("home"));
  const boxes = [...app.querySelectorAll(".check-item input")];
  const linkInput = $("#linkInput");
  const submitBtn = $("#submitBtn");

  function refresh() {
    boxes.forEach(b => b.closest(".check-item").classList.toggle("done", b.checked));
    const allChecked = boxes.every(b => b.checked);
    const hasLink = linkInput.value.trim().length > 4;
    submitBtn.disabled = !(allChecked && hasLink);
    $("#submitHint").textContent = allChecked
      ? (hasLink ? "Ready to submit." : "Add your reel link to submit.")
      : `Check all ${fe.checklist.length} items and add your link to submit.`;
  }
  boxes.forEach(b => b.addEventListener("change", refresh));
  linkInput.addEventListener("input", refresh);

  submitBtn.addEventListener("click", () => {
    const record = {
      name: me.name,
      link: linkInput.value.trim(),
      notes: $("#notesInput").value.trim(),
      checklist: boxes.map(b => b.checked),
      at: Date.now()
    };
    me.finalEdit = record;
    persist();
    const subs = loadSubmissions();
    subs.push(record);
    saveSubmissions(subs);
    burstConfetti(true);
    render("done");
  });
}

/* ----- done ----- */

function viewDone() {
  app.innerHTML = `
    <div class="wrap" style="max-width:640px">
      <div class="done-box">
        <div class="big">🎉</div>
        <h1>Onboarding complete!</h1>
        <p>Your Final Edit is submitted and your lead has been notified. They'll review it against the
        checklist and give you feedback <b>only on your gaps</b> — then you're on the team for real.
        Welcome to ${esc(COURSE.team)}, ${esc(me.name)}.</p>
        <p style="font-size:13px">Submitted ${me.finalEdit ? fmtDate(me.finalEdit.at) : ""} &middot; <a href="${esc(me.finalEdit ? me.finalEdit.link : "#")}" target="_blank" rel="noopener">your reel ↗</a></p>
        <button class="btn primary" id="homeBtn">Back to modules</button>
      </div>
    </div>`;
  $("#homeBtn").addEventListener("click", () => render("home"));
}

/* ----- admin ----- */

function viewAdmin() {
  const all = Object.values(loadProfiles()).sort((a, b) => b.createdAt - a.createdAt);
  const subs = loadSubmissions().slice().reverse();
  const totalMods = COURSE.modules.length;

  const rows = all.map(p => {
    const modPill = p.passed.length === totalMods
      ? `<span class="pill g">All ${totalMods} passed</span>`
      : `<span class="pill o">${p.passed.length}/${totalMods}</span>`;
    const fq = p.finalQuiz
      ? (p.finalQuiz.score >= COURSE.finalQuiz.passScore
        ? `<span class="pill g">${p.finalQuiz.score}/${p.finalQuiz.total}</span>`
        : `<span class="pill r">${p.finalQuiz.score}/${p.finalQuiz.total}</span>`)
      : `<span class="pill m">—</span>`;
    const fe = p.finalEdit ? `<span class="pill g">Submitted</span>` : `<span class="pill m">—</span>`;
    const gaps = p.wrongAnswers.length
      ? `<span class="pill r">${p.wrongAnswers.length} wrong attempt${p.wrongAnswers.length > 1 ? "s" : ""}</span>`
      : `<span class="pill g">Clean run</span>`;
    return `<tr><td><b>${esc(p.name)}</b></td><td>${modPill}</td><td>${fq}</td><td>${fe}</td><td>${gaps}</td></tr>`;
  }).join("");

  // aggregate gaps: which questions get missed the most
  const gapCounts = {};
  all.forEach(p => p.wrongAnswers.forEach(w => {
    const key = `${w.module}: ${w.question}`;
    gapCounts[key] = (gapCounts[key] || 0) + 1;
  }));
  all.forEach(p => (p.finalQuiz ? p.finalQuiz.wrong : []).forEach(q => {
    const key = `Final quiz: ${q}`;
    gapCounts[key] = (gapCounts[key] || 0) + 1;
  }));
  const gapList = Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => `<div class="gap-item"><b>${n}×</b> — ${esc(k)}</div>`).join("");

  const subRows = subs.map(s => `
    <tr>
      <td><b>${esc(s.name)}</b><br><span style="font-size:12px;color:var(--muted)">${fmtDate(s.at)}</span></td>
      <td><a href="${esc(s.link)}" target="_blank" rel="noopener">Open reel ↗</a></td>
      <td>${s.checklist.filter(Boolean).length}/${s.checklist.length} self-checked</td>
      <td style="max-width:280px">${esc(s.notes || "—")}</td>
    </tr>`).join("");

  app.innerHTML = `
    <div class="wrap">
      <div class="mod-head">
        <div class="crumb"><a id="backHome">← Back</a> &nbsp;/&nbsp; Leads view</div>
        <h1>📊 Team progress</h1>
        <p class="sub">Who has finished onboarding, where the gaps are, and every Final Edit submission — so feedback lands only where it's needed.</p>
      </div>
      <div class="admin-grid">
        <div class="admin-card">
          <h3>People (${all.length})</h3>
          ${all.length ? `<table>
            <tr><th>Name</th><th>Modules</th><th>Final quiz</th><th>Final edit</th><th>Quick-check gaps</th></tr>
            ${rows}</table>` : `<div class="empty">Nobody has started onboarding on this machine yet.</div>`}
        </div>
        <div class="admin-card">
          <h3>Most-missed questions</h3>
          ${gapList || `<div class="empty">No wrong answers logged — either a perfect team or nobody has taken a quiz yet.</div>`}
        </div>
        <div class="admin-card">
          <h3>Final Edit submissions (${subs.length})</h3>
          ${subs.length ? `<table>
            <tr><th>Who</th><th>Reel</th><th>Checklist</th><th>Notes</th></tr>
            ${subRows}</table>` : `<div class="empty">No submissions yet.</div>`}
        </div>
      </div>
    </div>`;
  $("#backHome").addEventListener("click", () => render("home"));
}

/* ---------------- header wiring ---------------- */

$("#adminBtn").addEventListener("click", () => render("admin"));
$("#switchBtn").addEventListener("click", () => {
  localStorage.removeItem(LS_CURRENT);
  currentName = null;
  me = null;
  render("home");
});

/* ---------------- boot ---------------- */

render("home");
