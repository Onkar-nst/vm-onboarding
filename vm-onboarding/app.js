/* Onboarding Academy — learner experience + shared core.
 * Lead tools (dashboard, review queue, course builder, people, settings) are in builder.js.
 * All persistence goes through Store (store.js); backend chosen in config.js.
 */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const app = $("#app");

/* ---------------- cache ---------------- */

const cache = { settings: null, courses: [], modules: [], people: [], progress: [], submissions: [] };

async function refresh() {
  const [settingsList, courses, modules, people, progress, submissions] = await Promise.all([
    Store.list("settings"), Store.list("courses"), Store.list("modules"),
    Store.list("people"), Store.list("progress"), Store.list("submissions")
  ]);
  cache.settings = settingsList.find(s => s.id === "settings") || { id: "settings", orgName: "Your Agency", adminPin: "1234" };
  cache.courses = courses.sort((a, b) => (a.order || 0) - (b.order || 0));
  cache.modules = modules;
  cache.people = people.filter(p => p.active !== false);
  cache.progress = progress;
  cache.submissions = submissions;
}

/* ---------------- session ---------------- */

let me = null;            // person doc
let courseId = null;      // active course
let leadUnlocked = false; // PIN entered this session

function isLead() { return me && me.role === "lead" && leadUnlocked; }

function modulesOf(cid) {
  return cache.modules.filter(m => m.courseId === cid).sort((a, b) => (a.order || 0) - (b.order || 0));
}
function courseById(cid) { return cache.courses.find(c => c.id === cid); }
function personById(pid) { return cache.people.find(p => p.id === pid) || { name: "Unknown" }; }
function progressOf(pid, cid) {
  return cache.progress.find(p => p.personId === pid && p.courseId === cid) || null;
}
async function ensureProgress(pid, cid) {
  let p = progressOf(pid, cid);
  if (!p) {
    p = { id: pid + ":" + cid, personId: pid, courseId: cid, passed: [], wrongAnswers: [], finalQuiz: null };
    await Store.put("progress", p);
    cache.progress.push(p);
  }
  return p;
}
function submissionOf(pid, cid) {
  return cache.submissions.filter(s => s.personId === pid && s.courseId === cid).sort((a, b) => b.at - a.at)[0] || null;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(ts) { return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }

/* ---------------- confetti ---------------- */

const confettiCanvas = $("#confetti");
const ctx = confettiCanvas.getContext("2d");
let confettiPieces = [];
let confettiRunning = false;
function resizeConfetti() { confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight; }
window.addEventListener("resize", resizeConfetti);
resizeConfetti();
function burstConfetti(big = false) {
  const colors = ["#ff5c29", "#ffb020", "#1f9d55", "#4a90d9", "#e858a1", "#f5efe4"];
  const count = big ? 220 : 120;
  const cx = window.innerWidth / 2;
  for (let i = 0; i < count; i++) {
    confettiPieces.push({
      x: cx + (Math.random() - 0.5) * 240, y: window.innerHeight * (big ? 0.45 : 0.35),
      vx: (Math.random() - 0.5) * 14, vy: -6 - Math.random() * 10,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)], life: 130 + Math.random() * 60
    });
  }
  if (!confettiRunning) { confettiRunning = true; tickConfetti(); }
}
function tickConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiPieces.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.vx *= 0.99; p.rot += p.vr; p.life--;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
    ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
  });
  confettiPieces = confettiPieces.filter(p => p.life > 0 && p.y < confettiCanvas.height + 40);
  if (confettiPieces.length) requestAnimationFrame(tickConfetti);
  else { confettiRunning = false; ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

/* ---------------- toast & modal ---------------- */

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
function openModal(html) {
  closeModal();
  const back = document.createElement("div");
  back.className = "modal-back";
  back.id = "modalBack";
  back.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(back);
  back.addEventListener("click", e => { if (e.target === back) closeModal(); });
  $$("[data-close]", back).forEach(b => b.addEventListener("click", closeModal));
}
function closeModal() { const m = $("#modalBack"); if (m) m.remove(); }

async function requireLead(then) {
  if (isLead()) return then();
  if (!me || me.role !== "lead") { toast("Switch to a lead profile first"); return; }
  openModal(`
    <h3>Lead PIN</h3>
    <p class="sub-p">Enter the admin PIN to unlock lead tools for this session.</p>
    <input id="pinInput" type="password" inputmode="numeric" maxlength="8" autocomplete="off" class="modal-input" placeholder="PIN">
    <div class="m-actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn accent" id="pinGo">Unlock</button>
    </div>`);
  const tryPin = () => {
    if ($("#pinInput").value === String(cache.settings.adminPin)) {
      leadUnlocked = true;
      closeModal(); toast("Lead tools unlocked"); setHeader(); then();
    } else { toast("Wrong PIN"); $("#pinInput").value = ""; $("#pinInput").focus(); }
  };
  $("#pinGo").addEventListener("click", tryPin);
  $("#pinInput").addEventListener("keydown", e => { if (e.key === "Enter") tryPin(); });
  $("#pinInput").focus();
}

/* ---------------- header ---------------- */

function setHeader() {
  $("#orgLabel").textContent = cache.settings.orgName + " Academy";
  const pill = $("#progressPill");
  const leadsBtn = $("#adminBtn");
  const switchBtn = $("#switchBtn");
  if (!me) { pill.style.display = "none"; leadsBtn.style.display = "none"; switchBtn.style.display = "none"; return; }
  switchBtn.style.display = "";
  leadsBtn.style.display = me.role === "lead" ? "" : "none";
  if (courseId) {
    const mods = modulesOf(courseId);
    const prog = progressOf(me.id, courseId);
    pill.style.display = "";
    pill.innerHTML = `<b>${esc(me.name)}</b> · ${prog ? prog.passed.filter(id => mods.some(m => m.id === id)).length : 0}/${mods.length} modules`;
  } else {
    pill.style.display = "";
    pill.innerHTML = `<b>${esc(me.name)}</b>`;
  }
}

/* ---------------- router ---------------- */

function render(view, arg) {
  setHeader();
  if (!me) return viewLogin();
  if (view === "lead") return renderLeadArea(arg);        // builder.js
  if (!courseId) return viewCourses();
  switch (view) {
    case "module": return viewModule(arg);
    case "finalQuiz": return viewFinalQuiz();
    case "assignment": return viewAssignment();
    case "done": return viewDone();
    default: return viewHome();
  }
}

/* ---------------- login ---------------- */

function viewLogin() {
  const options = cache.people.map(p =>
    `<button class="person-btn" data-pid="${p.id}">${esc(p.name)}${p.role === "lead" ? " <span class='lead-star'>★ lead</span>" : ""}</button>`).join("");
  app.innerHTML = `
    <div class="login-box">
      <div class="big-icon">🎓</div>
      <h2>${esc(cache.settings.orgName)} Academy</h2>
      <p>Pick your profile, or join as a new team member.</p>
      <div class="person-list">${options || "<p class='sub-p'>No profiles yet — create the first one below.</p>"}</div>
      <div class="join-row">
        <input id="nameInput" placeholder="New member name" maxlength="40" autocomplete="off">
        <button class="btn accent" id="joinBtn">Join</button>
      </div>
    </div>`;
  $$(".person-btn").forEach(b => b.addEventListener("click", () => {
    me = cache.people.find(p => p.id === b.dataset.pid);
    leadUnlocked = false;
    sessionStorage.setItem("ac_person", me.id);
    toast(`Welcome, ${me.name}`);
    render("home");
  }));
  const join = async () => {
    const name = $("#nameInput").value.trim();
    if (!name) { $("#nameInput").focus(); return; }
    const person = { id: await Store.nextId("PPL"), name, role: "trainee", active: true, createdAt: Date.now() };
    await Store.put("people", person);
    await refresh();
    me = person;
    sessionStorage.setItem("ac_person", me.id);
    toast(`Welcome aboard, ${name}!`);
    render("home");
  };
  $("#joinBtn").addEventListener("click", join);
  $("#nameInput").addEventListener("keydown", e => { if (e.key === "Enter") join(); });
}

/* ---------------- course picker ---------------- */

function viewCourses() {
  const active = cache.courses.filter(c => c.active !== false);
  if (active.length === 1) { courseId = active[0].id; sessionStorage.setItem("ac_course", courseId); return render("home"); }
  app.innerHTML = `
    <div class="wrap">
      <div class="hero"><div>
        <h1>Choose your <span>track</span></h1>
        <p>Your onboarding is split into tracks. Start with the one your lead assigned you.</p>
      </div></div>
      <div class="modules">
        ${active.map(c => {
          const mods = modulesOf(c.id);
          const prog = me ? progressOf(me.id, c.id) : null;
          const done = prog ? prog.passed.filter(id => mods.some(m => m.id === id)).length : 0;
          return `<div class="mod-card clickable" data-cid="${c.id}">
            <div class="icon">${c.icon || "📘"}</div>
            <h3>${esc(c.title)}</h3>
            <div class="meta">${mods.length} modules · ${esc(c.tagline || "")}</div>
            <span class="state ${done === mods.length && mods.length ? "passed" : "available"}">${done}/${mods.length} done</span>
          </div>`;
        }).join("") || `<div class="empty">No active courses yet — a lead can create one in the Course Builder.</div>`}
      </div>
    </div>`;
  $$("[data-cid]").forEach(c => c.addEventListener("click", () => {
    courseId = c.dataset.cid;
    sessionStorage.setItem("ac_course", courseId);
    render("home");
  }));
}

/* ---------------- home ---------------- */

function moduleState(prog, mods, mod, idx) {
  if (prog && prog.passed.includes(mod.id)) return "passed";
  const firstOpen = mods.findIndex(m => !(prog && prog.passed.includes(m.id)));
  return idx === firstOpen ? "available" : "locked";
}

async function viewHome() {
  const course = courseById(courseId);
  if (!course) { courseId = null; return render("home"); }
  const mods = modulesOf(courseId);
  const prog = await ensureProgress(me.id, courseId);
  const passedCount = prog.passed.filter(id => mods.some(m => m.id === id)).length;
  const allPassed = mods.length > 0 && passedCount === mods.length;
  const fqPassed = prog.finalQuiz && prog.finalQuiz.score >= (course.finalQuiz.passScore || 1);
  const sub = submissionOf(me.id, courseId);

  const cards = mods.map((m, i) => {
    const st = moduleState(prog, mods, m, i);
    const stateLabel = { locked: "🔒 Locked", available: "▶ Start", passed: "✓ Passed" }[st];
    return `
      <div class="mod-card ${st} ${st !== "locked" ? "clickable" : ""}" data-mod="${m.id}" data-state="${st}">
        <div class="idx">${String(i + 1).padStart(2, "0")}</div>
        <div class="icon">${m.icon || "📘"}</div>
        <h3>${esc(m.title)}</h3>
        <div class="meta">${m.minutes || 5} min · ${m.sections.length} sections + quick check</div>
        <span class="state ${st}">${stateLabel}</span>
      </div>`;
  }).join("");

  const fqState = !allPassed ? "locked" : (fqPassed ? "passed" : "available");
  const subState = !fqPassed ? "locked" : (sub ? (sub.status === "approved" ? "passed" : "available") : "available");
  const subLabel = !fqPassed ? "🔒 Pass the final quiz"
    : !sub ? "▶ Start"
    : sub.status === "approved" ? "✓ Approved"
    : sub.status === "changes_requested" ? "✎ Changes requested"
    : "⏳ In review";

  app.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <div>
          <h1>${course.icon || "📘"} <span>${esc(course.title)}</span></h1>
          <p>${esc(course.tagline || "")} Each module unlocks the next once you nail the quick check.</p>
          ${cache.courses.filter(c => c.active !== false).length > 1 ? `<p style="margin-top:6px"><a class="linkish" id="switchCourse">↩ switch track</a></p>` : ""}
        </div>
        <div class="hero-stats">
          <div class="stat"><div class="n">${passedCount}/${mods.length}</div><div class="l">Modules</div></div>
          <div class="stat"><div class="n">${prog.finalQuiz ? prog.finalQuiz.score + "/" + prog.finalQuiz.total : "—"}</div><div class="l">Final quiz</div></div>
          <div class="stat"><div class="n">${sub ? (sub.status === "approved" ? "✓" : sub.status === "changes_requested" ? "✎" : "⏳") : "—"}</div><div class="l">Assignment</div></div>
        </div>
      </div>
      ${sub && sub.status === "changes_requested" ? `
        <div class="feedback-banner">
          <b>Your lead requested changes:</b> ${esc(sub.feedback || "See the assignment page.")}
          <button class="btn sm-btn" id="goResubmit">Open assignment →</button>
        </div>` : ""}
      <div class="modules">
        ${cards}
        <div class="mod-card special ${fqState} ${fqState !== "locked" ? "clickable" : ""}" id="finalQuizCard">
          <div class="idx">🏁</div><div class="icon">📝</div>
          <h3>Final Quiz</h3>
          <div class="meta">${course.finalQuiz.questions.length} questions · pass ${course.finalQuiz.passScore}+</div>
          <span class="state ${fqState}">${fqState === "locked" ? "🔒 Finish all modules" : fqState === "passed" ? "✓ Passed" : "▶ Start"}</span>
        </div>
        <div class="mod-card special ${subState === "locked" ? "locked" : ""} ${subState !== "locked" ? "clickable" : ""}" id="assignmentCard">
          <div class="idx">🎞️</div><div class="icon">🚀</div>
          <h3>${esc(course.assignment.title)}</h3>
          <div class="meta">Practical assignment · checklist + review</div>
          <span class="state ${subState === "passed" ? "passed" : subState === "locked" ? "locked" : "available"}">${subLabel}</span>
        </div>
      </div>
    </div>`;

  $$(".mod-card[data-mod]").forEach(card => {
    if (card.dataset.state === "locked") return;
    card.addEventListener("click", () => render("module", card.dataset.mod));
  });
  if (fqState !== "locked" && !fqPassed) $("#finalQuizCard").addEventListener("click", () => render("finalQuiz"));
  if (subState !== "locked") $("#assignmentCard").addEventListener("click", () => render(sub && sub.status !== "changes_requested" ? "done" : "assignment"));
  const sw = $("#switchCourse");
  if (sw) sw.addEventListener("click", () => { courseId = null; sessionStorage.removeItem("ac_course"); render("home"); });
  const rs = $("#goResubmit");
  if (rs) rs.addEventListener("click", () => render("assignment"));
}

/* ---------------- module ---------------- */

function viewModule(modId) {
  const mods = modulesOf(courseId);
  const idx = mods.findIndex(m => m.id === modId);
  const mod = mods[idx];
  const prog = progressOf(me.id, courseId);
  const alreadyPassed = prog.passed.includes(mod.id);

  const sections = mod.sections.map(s => `
    <div class="lesson"><h2>${esc(s.h)}</h2><div class="body">${s.body}</div></div>`).join("");
  const opts = mod.quiz.options.map((o, i) => `
    <button class="opt" data-i="${i}"><span class="key">${"ABCD"[i] || i + 1}</span> ${esc(o)}</button>`).join("");

  app.innerHTML = `
    <div class="wrap">
      <div class="mod-head">
        <div class="crumb"><a id="backHome">← All modules</a> &nbsp;/&nbsp; Module ${idx + 1} of ${mods.length}</div>
        <h1>${mod.icon || "📘"} ${esc(mod.title)}</h1>
        <p class="sub">${esc(mod.intro || "")}</p>
      </div>
      ${sections}
      <div class="quiz">
        <div class="tag">Quick check ${alreadyPassed ? "· already passed ✓" : "· pass to unlock the next module"}</div>
        <h2>${esc(mod.quiz.q)}</h2>
        <div class="opts">${opts}</div>
        <div class="feedback" id="quizFeedback"></div>
        <div class="actions"><button class="btn primary" id="nextBtn" style="display:none">Continue →</button></div>
      </div>
    </div>`;

  $("#backHome").addEventListener("click", () => render("home"));
  const nextBtn = $("#nextBtn");
  let solved = false;
  $$(".opt", app).forEach(btn => btn.addEventListener("click", async () => {
    if (solved) return;
    const i = Number(btn.dataset.i);
    const feedback = $("#quizFeedback");
    if (i === mod.quiz.correct) {
      solved = true;
      btn.classList.add("right");
      feedback.className = "feedback good";
      feedback.textContent = "Correct! " + (mod.quiz.explain || "");
      burstConfetti();
      if (!prog.passed.includes(mod.id)) {
        prog.passed.push(mod.id);
        await Store.put("progress", prog);
        toast(idx + 1 < mods.length ? "Module passed — next one unlocked!" : "All modules passed!");
      }
      nextBtn.style.display = "";
      nextBtn.textContent = idx + 1 < mods.length ? `Next: ${mods[idx + 1].title} →` : "Go to Final Quiz →";
      nextBtn.onclick = () => idx + 1 < mods.length ? render("module", mods[idx + 1].id) : render("finalQuiz");
      setHeader();
    } else {
      btn.classList.add("wrong");
      btn.disabled = true;
      feedback.className = "feedback bad";
      feedback.textContent = "Wrong — check the sections above and try again.";
      prog.wrongAnswers.push({ moduleId: mod.id, module: mod.title, question: mod.quiz.q, picked: mod.quiz.options[i], at: Date.now() });
      await Store.put("progress", prog);
    }
  }));
}

/* ---------------- final quiz ---------------- */

function viewFinalQuiz() {
  const course = courseById(courseId);
  const qs = course.finalQuiz.questions;
  const prog = progressOf(me.id, courseId);
  let qi = 0, score = 0;
  const wrong = [];

  function draw() {
    if (qi >= qs.length) return finish();
    const q = qs[qi];
    app.innerHTML = `
      <div class="wrap" style="max-width:760px">
        <div class="mod-head">
          <div class="crumb"><a id="backHome">← All modules</a> &nbsp;/&nbsp; Final Quiz</div>
          <h1>📝 Final Quiz</h1>
          <p class="sub">One attempt per question. Score ${course.finalQuiz.passScore}+ of ${qs.length} to unlock the assignment.</p>
        </div>
        <div class="fq-progress">Question ${qi + 1} of ${qs.length} · score ${score}</div>
        <div class="fq-bar"><i style="width:${(qi / qs.length) * 100}%"></i></div>
        <div class="quiz">
          <div class="tag">Final quiz</div>
          <h2>${esc(q.q)}</h2>
          <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${"ABCD"[i] || i + 1}</span> ${esc(o)}</button>`).join("")}</div>
          <div class="feedback" id="quizFeedback"></div>
        </div>
      </div>`;
    $("#backHome").addEventListener("click", () => render("home"));
    let answered = false;
    $$(".opt", app).forEach(btn => btn.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const i = Number(btn.dataset.i);
      $$(".opt", app).forEach(b => b.disabled = true);
      const fb = $("#quizFeedback");
      if (i === q.correct) { score++; btn.classList.add("right"); fb.className = "feedback good"; fb.textContent = "Correct!"; }
      else {
        btn.classList.add("wrong");
        const right = app.querySelector(`.opt[data-i="${q.correct}"]`);
        if (right) right.classList.add("right");
        fb.className = "feedback bad"; fb.textContent = "Not this one.";
        wrong.push(q.q);
      }
      setTimeout(() => { qi++; draw(); }, 900);
    }));
  }

  async function finish() {
    const passed = score >= course.finalQuiz.passScore;
    prog.finalQuiz = { score, total: qs.length, wrong, at: Date.now() };
    await Store.put("progress", prog);
    if (passed) burstConfetti(true);
    app.innerHTML = `
      <div class="wrap" style="max-width:640px">
        <div class="done-box">
          <div class="big">${passed ? "🏆" : "😬"}</div>
          <h1>${passed ? "Final quiz passed!" : "Not quite there yet"}</h1>
          <p>You scored <b>${score} / ${qs.length}</b>. ${passed
            ? "The practical assignment is now unlocked — that's the real test."
            : `You need ${course.finalQuiz.passScore}+ to pass. Re-read the modules and take it again — gaps are logged for your lead.`}</p>
          <button class="btn accent" id="fqNext">${passed ? "Go to assignment →" : "Retake quiz"}</button>
          <button class="btn ghost" id="fqHome">Back to modules</button>
        </div>
      </div>`;
    $("#fqNext").addEventListener("click", () => passed ? render("assignment") : render("finalQuiz"));
    $("#fqHome").addEventListener("click", () => render("home"));
  }
  draw();
}

/* ---------------- assignment (submit / resubmit) ---------------- */

function viewAssignment() {
  const course = courseById(courseId);
  const a = course.assignment;
  const prev = submissionOf(me.id, courseId);
  const resubmitting = prev && prev.status === "changes_requested";

  const items = a.checklist.map((c, i) => `
    <label class="check-item ${resubmitting && prev.gapItems.includes(i) ? "gap" : ""}" data-i="${i}">
      <input type="checkbox" data-i="${i}">
      <span>${esc(c)}${resubmitting && prev.gapItems.includes(i) ? " <b class='gap-flag'>← fix this</b>" : ""}</span>
    </label>`).join("");

  app.innerHTML = `
    <div class="wrap" style="max-width:760px">
      <div class="mod-head">
        <div class="crumb"><a id="backHome">← All modules</a> &nbsp;/&nbsp; ${esc(a.title)}</div>
        <h1>🎞️ ${esc(a.title)}${resubmitting ? " — resubmission" : ""}</h1>
      </div>
      ${resubmitting ? `<div class="feedback-banner"><b>Lead feedback:</b> ${esc(prev.feedback || "")}</div>` : ""}
      <div class="brief">${a.brief}</div>
      <h3 style="margin-bottom:12px">Self-check every item before you submit</h3>
      <div class="check-list">${items}</div>
      <div class="submit-form">
        <label>Link to your work</label>
        <input id="linkInput" placeholder="Drive / Frame.io / YouTube link" autocomplete="off" value="${resubmitting ? esc(prev.link) : ""}">
        <label>Notes for your reviewer</label>
        <textarea id="notesInput" placeholder="Anything you struggled with, choices you made…">${resubmitting ? esc(prev.notes) : ""}</textarea>
        <div style="margin-top:20px; display:flex; gap:10px; align-items:center">
          <button class="btn accent" id="submitBtn" disabled>${resubmitting ? "Resubmit for review" : "Submit for review"}</button>
          <span class="hint" id="submitHint"></span>
        </div>
      </div>
    </div>`;

  $("#backHome").addEventListener("click", () => render("home"));
  const boxes = $$(".check-item input", app);
  const linkInput = $("#linkInput");
  const submitBtn = $("#submitBtn");
  function refreshForm() {
    boxes.forEach(b => b.closest(".check-item").classList.toggle("done", b.checked));
    const allChecked = boxes.every(b => b.checked);
    const hasLink = linkInput.value.trim().length > 4;
    submitBtn.disabled = !(allChecked && hasLink);
    $("#submitHint").textContent = allChecked ? (hasLink ? "Ready to submit." : "Add your link to submit.")
      : `Check all ${a.checklist.length} items and add your link.`;
  }
  boxes.forEach(b => b.addEventListener("change", refreshForm));
  linkInput.addEventListener("input", refreshForm);
  refreshForm();

  submitBtn.addEventListener("click", async () => {
    const doc = {
      id: resubmitting ? prev.id : await Store.nextId("SUB"),
      personId: me.id, courseId,
      link: linkInput.value.trim(),
      notes: $("#notesInput").value.trim(),
      checklist: boxes.map(b => b.checked),
      at: Date.now(),
      status: "submitted", feedback: resubmitting ? prev.feedback : "", gapItems: [], reviewedAt: null,
      resubmission: !!resubmitting
    };
    await Store.put("submissions", doc);
    await refresh();
    burstConfetti(true);
    render("done");
  });
}

/* ---------------- done / status ---------------- */

function viewDone() {
  const sub = submissionOf(me.id, courseId);
  const statusLine = !sub ? "" :
    sub.status === "approved" ? `<p class="status-ok">✅ <b>Approved!</b> ${esc(sub.feedback || "Great work — you're fully onboarded.")}</p>` :
    sub.status === "changes_requested" ? `<p class="status-warn">✎ <b>Changes requested:</b> ${esc(sub.feedback || "")}</p>` :
    `<p class="status-wait">⏳ In review — your lead will give feedback only on your gaps.</p>`;
  app.innerHTML = `
    <div class="wrap" style="max-width:640px">
      <div class="done-box">
        <div class="big">${sub && sub.status === "approved" ? "🎉" : "📨"}</div>
        <h1>${sub && sub.status === "approved" ? "Onboarding complete!" : "Assignment submitted"}</h1>
        ${statusLine}
        <p style="font-size:13px">Submitted ${sub ? fmtDate(sub.at) : ""} · <a href="${esc(sub ? sub.link : "#")}" target="_blank" rel="noopener">your work ↗</a></p>
        ${sub && sub.status === "changes_requested" ? `<button class="btn accent" id="resubBtn">Fix & resubmit</button>` : ""}
        <button class="btn primary" id="homeBtn">Back to modules</button>
      </div>
    </div>`;
  $("#homeBtn").addEventListener("click", () => render("home"));
  const rb = $("#resubBtn");
  if (rb) rb.addEventListener("click", () => render("assignment"));
}

/* ---------------- boot ---------------- */

$("#adminBtn").addEventListener("click", () => requireLead(() => render("lead", "dashboard")));
$("#switchBtn").addEventListener("click", () => {
  me = null; courseId = null; leadUnlocked = false;
  sessionStorage.removeItem("ac_person");
  sessionStorage.removeItem("ac_course");
  render("home");
});

(async function boot() {
  if ((window.APP_CONFIG || {}).loadDemoSeed !== false) await loadSeedIfEmpty();
  await refresh();
  me = cache.people.find(p => p.id === sessionStorage.getItem("ac_person")) || null;
  courseId = sessionStorage.getItem("ac_course") || null;
  if (courseId && !courseById(courseId)) courseId = null;
  render("home");
})();
