/* Onboarding Academy — lead area: dashboard, review queue, course builder,
 * people management, settings. PIN-gated via requireLead() in app.js.
 */

let leadTab = "dashboard";

function renderLeadArea(tab) {
  if (tab) leadTab = tab;
  if (!isLead()) return render("home");
  const tabs = [
    ["dashboard", "📊 Dashboard"], ["review", "🎬 Review queue"],
    ["builder", "🛠 Course builder"], ["people", "👥 People"], ["settings", "⚙ Settings"]
  ];
  const pendingReviews = cache.submissions.filter(s => s.status === "submitted").length;
  app.innerHTML = `
    <div class="wrap">
      <div class="mod-head">
        <div class="crumb"><a id="backHome">← Learner view</a> &nbsp;/&nbsp; Lead tools</div>
        <div class="lead-tabs">${tabs.map(([k, l]) =>
          `<button class="lead-tab ${leadTab === k ? "active" : ""}" data-lt="${k}">${l}${k === "review" && pendingReviews ? ` <span class="count-dot">${pendingReviews}</span>` : ""}</button>`).join("")}</div>
      </div>
      <div id="leadBody"></div>
    </div>`;
  $("#backHome").addEventListener("click", () => render("home"));
  $$(".lead-tab").forEach(b => b.addEventListener("click", () => renderLeadArea(b.dataset.lt)));
  ({ dashboard: leadDashboard, review: leadReview, builder: leadBuilder, people: leadPeople, settings: leadSettings })[leadTab]();
}

/* ---------------- dashboard ---------------- */

function leadDashboard() {
  const rows = [];
  for (const person of cache.people.filter(p => p.role !== "lead")) {
    for (const course of cache.courses.filter(c => c.active !== false)) {
      const mods = modulesOf(course.id);
      const prog = progressOf(person.id, course.id);
      if (!prog && !mods.length) continue;
      const passed = prog ? prog.passed.filter(id => mods.some(m => m.id === id)).length : 0;
      const sub = submissionOf(person.id, course.id);
      const fq = prog && prog.finalQuiz;
      rows.push(`<tr>
        <td><b>${esc(person.name)}</b></td>
        <td>${esc(course.title)}</td>
        <td>${passed === mods.length && mods.length ? `<span class="pill g">All ${mods.length}</span>` : `<span class="pill o">${passed}/${mods.length}</span>`}</td>
        <td>${fq ? (fq.score >= course.finalQuiz.passScore ? `<span class="pill g">${fq.score}/${fq.total}</span>` : `<span class="pill r">${fq.score}/${fq.total}</span>`) : `<span class="pill m">—</span>`}</td>
        <td>${sub ? { submitted: `<span class="pill o">In review</span>`, changes_requested: `<span class="pill r">Changes req.</span>`, approved: `<span class="pill g">Approved</span>` }[sub.status] : `<span class="pill m">—</span>`}</td>
        <td>${prog && prog.wrongAnswers.length ? `<span class="pill r">${prog.wrongAnswers.length} wrong</span>` : `<span class="pill g">Clean</span>`}</td>
      </tr>`);
    }
  }
  const gapCounts = {};
  cache.progress.forEach(p => {
    p.wrongAnswers.forEach(w => { const k = `${w.module}: ${w.question}`; gapCounts[k] = (gapCounts[k] || 0) + 1; });
    (p.finalQuiz ? p.finalQuiz.wrong : []).forEach(q => { const k = `Final quiz: ${q}`; gapCounts[k] = (gapCounts[k] || 0) + 1; });
  });
  const gapList = Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => `<div class="gap-item"><b>${n}×</b> — ${esc(k)}</div>`).join("");

  $("#leadBody").innerHTML = `
    <div class="admin-grid">
      <div class="admin-card">
        <div class="card-head"><h3>Trainee progress</h3>
          <button class="btn" id="csvProgress">⬇ CSV</button></div>
        ${rows.length ? `<table><tr><th>Who</th><th>Course</th><th>Modules</th><th>Final quiz</th><th>Assignment</th><th>Quick-check gaps</th></tr>${rows.join("")}</table>`
          : `<div class="empty">No trainee activity yet.</div>`}
      </div>
      <div class="admin-card">
        <h3>Most-missed questions</h3>
        ${gapList || `<div class="empty">No wrong answers logged yet.</div>`}
        <p class="sub-p" style="margin-top:10px">If a question keeps getting missed, the lesson above it needs a rewrite — edit it in the Course Builder.</p>
      </div>
    </div>`;
  $("#csvProgress").addEventListener("click", () => {
    const data = [["Person", "Course", "ModulesPassed", "ModulesTotal", "FinalQuiz", "AssignmentStatus", "WrongAnswers"]];
    cache.people.filter(p => p.role !== "lead").forEach(person =>
      cache.courses.forEach(course => {
        const mods = modulesOf(course.id);
        const prog = progressOf(person.id, course.id);
        if (!prog) return;
        const sub = submissionOf(person.id, course.id);
        data.push([person.name, course.title,
          prog.passed.filter(id => mods.some(m => m.id === id)).length, mods.length,
          prog.finalQuiz ? `${prog.finalQuiz.score}/${prog.finalQuiz.total}` : "",
          sub ? sub.status : "", prog.wrongAnswers.length]);
      }));
    downloadFile("academy-progress.csv", data.map(r => r.map(csvCell).join(",")).join("\n"), "text/csv");
  });
}

/* ---------------- review queue ---------------- */

function leadReview() {
  const subs = cache.submissions.slice().sort((a, b) => {
    const rank = { submitted: 0, changes_requested: 1, approved: 2 };
    return rank[a.status] - rank[b.status] || b.at - a.at;
  });
  $("#leadBody").innerHTML = `
    <div class="admin-card">
      <h3>Submissions (${subs.length})</h3>
      ${subs.length ? `<table><tr><th>Who</th><th>Course</th><th>Submitted</th><th>Status</th><th></th></tr>
        ${subs.map(s => `<tr>
          <td><b>${esc(personById(s.personId).name)}</b>${s.resubmission ? ` <span class="pill o">resub</span>` : ""}</td>
          <td>${esc((courseById(s.courseId) || { title: "?" }).title)}</td>
          <td>${fmtDate(s.at)}</td>
          <td>${{ submitted: `<span class="pill o">Awaiting review</span>`, changes_requested: `<span class="pill r">Changes requested</span>`, approved: `<span class="pill g">Approved</span>` }[s.status]}</td>
          <td><button class="btn" data-review="${s.id}">${s.status === "submitted" ? "Review" : "Open"}</button></td>
        </tr>`).join("")}</table>` : `<div class="empty">No submissions yet.</div>`}
    </div>`;
  $$("[data-review]").forEach(b => b.addEventListener("click", () => showReviewModal(b.dataset.review)));
}

function showReviewModal(subId) {
  const s = cache.submissions.find(x => x.id === subId);
  const course = courseById(s.courseId);
  const items = course.assignment.checklist.map((c, i) => `
    <label class="check-item ${s.gapItems.includes(i) ? "gap" : ""}">
      <input type="checkbox" data-gap="${i}" ${s.gapItems.includes(i) ? "checked" : ""}>
      <span>${esc(c)} ${s.checklist[i] ? "" : "<b class='gap-flag'>(not self-checked)</b>"}</span>
    </label>`).join("");
  openModal(`
    <h3>Review — ${esc(personById(s.personId).name)}</h3>
    <p class="sub-p">${esc(course.title)} · submitted ${fmtDate(s.at)} · <a href="${esc(s.link)}" target="_blank" rel="noopener">open their work ↗</a></p>
    ${s.notes ? `<p class="sub-p"><b>Their notes:</b> ${esc(s.notes)}</p>` : ""}
    <h4 style="margin:14px 0 8px">Tick every item that has a gap</h4>
    <div class="check-list" style="max-height:260px;overflow-y:auto">${items}</div>
    <label style="display:block;font-weight:700;font-size:13px;margin:14px 0 6px">Feedback (they see exactly this)</label>
    <textarea id="rvFeedback" class="modal-input" style="min-height:80px">${esc(s.feedback || "")}</textarea>
    <div class="m-actions">
      <button class="btn" data-close>Close</button>
      <button class="btn" id="rvChanges">✎ Request changes</button>
      <button class="btn accent" id="rvApprove">✓ Approve</button>
    </div>`);
  const gaps = () => $$("[data-gap]:checked").map(cb => Number(cb.dataset.gap));
  $("#rvChanges").addEventListener("click", async () => {
    s.status = "changes_requested";
    s.gapItems = gaps();
    s.feedback = $("#rvFeedback").value.trim() || "Please revisit the flagged checklist items.";
    s.reviewedAt = Date.now();
    await Store.put("submissions", s);
    await refresh(); closeModal(); toast("Changes requested"); renderLeadArea("review");
  });
  $("#rvApprove").addEventListener("click", async () => {
    s.status = "approved";
    s.gapItems = gaps();
    s.feedback = $("#rvFeedback").value.trim();
    s.reviewedAt = Date.now();
    await Store.put("submissions", s);
    await refresh(); closeModal(); toast("Approved 🎉"); renderLeadArea("review");
  });
}

/* ---------------- course builder ---------------- */

function leadBuilder() {
  $("#leadBody").innerHTML = `
    <div class="admin-card">
      <div class="card-head"><h3>Courses</h3><button class="btn accent" id="addCourse">+ New course</button></div>
      ${cache.courses.length ? `<table><tr><th>Course</th><th>Modules</th><th>Status</th><th></th></tr>
        ${cache.courses.map(c => `<tr>
          <td><b>${c.icon || "📘"} ${esc(c.title)}</b><br><span class="sub-p">${esc(c.tagline || "")}</span></td>
          <td>${modulesOf(c.id).length}</td>
          <td>${c.active !== false ? `<span class="pill g">Active</span>` : `<span class="pill m">Draft</span>`}</td>
          <td style="white-space:nowrap">
            <button class="btn" data-edit-course="${c.id}">Open</button>
            <button class="btn ghost" data-toggle-course="${c.id}">${c.active !== false ? "Unpublish" : "Publish"}</button>
          </td></tr>`).join("")}</table>` : `<div class="empty">No courses yet — create your first one.</div>`}
    </div>
    <div id="courseEditor"></div>`;
  $("#addCourse").addEventListener("click", () => showCourseModal(null));
  $$("[data-edit-course]").forEach(b => b.addEventListener("click", () => openCourseEditor(b.dataset.editCourse)));
  $$("[data-toggle-course]").forEach(b => b.addEventListener("click", async () => {
    const c = courseById(b.dataset.toggleCourse);
    c.active = c.active === false;
    await Store.put("courses", c);
    await refresh(); leadBuilder(); toast(c.active ? "Course published" : "Course unpublished");
  }));
}

function showCourseModal(id) {
  const c = id ? courseById(id) : null;
  openModal(`
    <h3>${c ? "Edit course" : "New course"}</h3>
    <label class="f-label">Title</label><input id="crTitle" class="modal-input" value="${c ? esc(c.title) : ""}" maxlength="80">
    <label class="f-label">Tagline</label><input id="crTag" class="modal-input" value="${c ? esc(c.tagline || "") : ""}" maxlength="120">
    <label class="f-label">Icon (emoji)</label><input id="crIcon" class="modal-input" value="${c ? esc(c.icon || "📘") : "📘"}" maxlength="4">
    <div class="m-actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn accent" id="crSave">Save</button>
    </div>`);
  $("#crSave").addEventListener("click", async () => {
    const title = $("#crTitle").value.trim();
    if (!title) { $("#crTitle").focus(); return; }
    const doc = c || {
      id: await Store.nextId("CRS"), active: false, order: cache.courses.length + 1,
      finalQuiz: { passScore: 1, questions: [] },
      assignment: { title: "Practical assignment", brief: "Describe the day-one assignment here (edit me in the builder).", checklist: ["Add checklist items in the builder"] },
      createdAt: Date.now()
    };
    doc.title = title;
    doc.tagline = $("#crTag").value.trim();
    doc.icon = $("#crIcon").value.trim() || "📘";
    await Store.put("courses", doc);
    await refresh(); closeModal(); leadBuilder();
    if (!c) openCourseEditor(doc.id);
  });
}

function openCourseEditor(cid) {
  const c = courseById(cid);
  const mods = modulesOf(cid);
  $("#courseEditor").innerHTML = `
    <div class="admin-card" style="margin-top:16px">
      <div class="card-head">
        <h3>${c.icon} ${esc(c.title)} — structure</h3>
        <div style="display:flex;gap:8px">
          <button class="btn" id="edCourseMeta">✎ Course info</button>
          <button class="btn accent" id="addModule">+ Module</button>
        </div>
      </div>
      <table><tr><th style="width:40px">#</th><th>Module</th><th>Sections</th><th>Quiz</th><th></th></tr>
        ${mods.map((m, i) => `<tr>
          <td class="drag-num">${i + 1}</td>
          <td><b>${m.icon || "📘"} ${esc(m.title)}</b></td>
          <td>${m.sections.length}</td>
          <td>${m.quiz && m.quiz.q ? "✓" : `<span class="pill r">missing</span>`}</td>
          <td style="white-space:nowrap">
            ${i > 0 ? `<button class="btn ghost" data-up="${m.id}">↑</button>` : ""}
            ${i < mods.length - 1 ? `<button class="btn ghost" data-down="${m.id}">↓</button>` : ""}
            <button class="btn" data-edit-mod="${m.id}">Edit</button>
          </td></tr>`).join("") || `<tr><td colspan="5" class="empty">No modules yet.</td></tr>`}
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">
        <div class="mini-panel">
          <h4>🏁 Final quiz — ${c.finalQuiz.questions.length} questions, pass ${c.finalQuiz.passScore}+</h4>
          <button class="btn" id="edFinalQuiz">Edit final quiz</button>
        </div>
        <div class="mini-panel">
          <h4>🎞️ Assignment — “${esc(c.assignment.title)}” (${c.assignment.checklist.length} checklist items)</h4>
          <button class="btn" id="edAssignment">Edit assignment</button>
        </div>
      </div>
    </div>`;
  $("#edCourseMeta").addEventListener("click", () => showCourseModal(cid));
  $("#addModule").addEventListener("click", () => showModuleModal(cid, null));
  $$("[data-edit-mod]").forEach(b => b.addEventListener("click", () => showModuleModal(cid, b.dataset.editMod)));
  $$("[data-up]").forEach(b => b.addEventListener("click", () => moveModule(cid, b.dataset.up, -1)));
  $$("[data-down]").forEach(b => b.addEventListener("click", () => moveModule(cid, b.dataset.down, 1)));
  $("#edFinalQuiz").addEventListener("click", () => showFinalQuizModal(cid));
  $("#edAssignment").addEventListener("click", () => showAssignmentModal(cid));
}

async function moveModule(cid, modId, dir) {
  const mods = modulesOf(cid);
  const i = mods.findIndex(m => m.id === modId);
  const j = i + dir;
  if (j < 0 || j >= mods.length) return;
  [mods[i].order, mods[j].order] = [mods[j].order, mods[i].order];
  await Store.put("modules", mods[i]);
  await Store.put("modules", mods[j]);
  await refresh(); openCourseEditor(cid);
}

function showModuleModal(cid, modId) {
  const m = modId ? cache.modules.find(x => x.id === modId) : null;
  const sectionsText = m ? m.sections.map(s => `## ${s.h}\n${s.body}`).join("\n\n") : "## Section heading\nSection content — plain text or simple HTML (<b>, <ul>, <code>…)";
  const q = m ? m.quiz : { q: "", options: ["", "", "", ""], correct: 0, explain: "" };
  openModal(`
    <h3>${m ? "Edit module" : "New module"}</h3>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
      <div><label class="f-label">Title</label><input id="mdTitle" class="modal-input" value="${m ? esc(m.title) : ""}" maxlength="60"></div>
      <div><label class="f-label">Icon</label><input id="mdIcon" class="modal-input" value="${m ? esc(m.icon || "") : "📘"}" maxlength="4"></div>
      <div><label class="f-label">Minutes</label><input id="mdMin" class="modal-input" type="number" min="1" value="${m ? (m.minutes || 5) : 5}"></div>
    </div>
    <label class="f-label">Intro line</label><input id="mdIntro" class="modal-input" value="${m ? esc(m.intro || "") : ""}" maxlength="160">
    <label class="f-label">Sections — start each with "## Heading"</label>
    <textarea id="mdSections" class="modal-input mono-area">${esc(sectionsText)}</textarea>
    <h4 style="margin:16px 0 4px">Quick check</h4>
    <label class="f-label">Question</label><input id="qzQ" class="modal-input" value="${esc(q.q)}" maxlength="200">
    ${[0, 1, 2, 3].map(i => `
      <div class="opt-row">
        <input type="radio" name="qzCorrect" value="${i}" ${q.correct === i ? "checked" : ""} title="correct answer">
        <input id="qzO${i}" class="modal-input" value="${esc(q.options[i] || "")}" placeholder="Option ${"ABCD"[i]}" maxlength="160">
      </div>`).join("")}
    <label class="f-label">Explanation shown on correct answer</label><input id="qzExp" class="modal-input" value="${esc(q.explain || "")}" maxlength="240">
    <div class="m-actions">
      ${m ? `<button class="btn ghost" id="mdDelete" style="margin-right:auto;color:var(--red)">Remove module</button>` : ""}
      <button class="btn" data-close>Cancel</button>
      <button class="btn accent" id="mdSave">Save module</button>
    </div>`);
  $("#mdSave").addEventListener("click", async () => {
    const title = $("#mdTitle").value.trim();
    if (!title) { $("#mdTitle").focus(); return; }
    const sections = $("#mdSections").value.split(/^## /m).map(s => s.trim()).filter(Boolean).map(chunk => {
      const nl = chunk.indexOf("\n");
      return nl === -1 ? { h: chunk, body: "" } : { h: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1).trim() };
    });
    if (!sections.length) { toast("Add at least one ## section"); return; }
    const options = [0, 1, 2, 3].map(i => $("#qzO" + i).value.trim()).filter(Boolean);
    if (options.length < 2 || !$("#qzQ").value.trim()) { toast("Quiz needs a question and 2+ options"); return; }
    const correctEl = document.querySelector("input[name=qzCorrect]:checked");
    const correct = Math.min(Number(correctEl ? correctEl.value : 0), options.length - 1);
    const doc = m || { id: await Store.nextId("MOD"), courseId: cid, order: modulesOf(cid).length + 1 };
    Object.assign(doc, {
      title, icon: $("#mdIcon").value.trim() || "📘",
      minutes: Number($("#mdMin").value) || 5,
      intro: $("#mdIntro").value.trim(),
      sections,
      quiz: { q: $("#qzQ").value.trim(), options, correct, explain: $("#qzExp").value.trim() }
    });
    await Store.put("modules", doc);
    await refresh(); closeModal(); toast("Module saved"); renderLeadArea("builder"); openCourseEditor(cid);
  });
  const del = $("#mdDelete");
  if (del) del.addEventListener("click", async () => {
    await Store.remove("modules", m.id);
    await refresh(); closeModal(); toast("Module removed"); renderLeadArea("builder"); openCourseEditor(cid);
  });
}

function showFinalQuizModal(cid) {
  const c = courseById(cid);
  const text = c.finalQuiz.questions.map(q =>
    `Q: ${q.q}\n${q.options.map((o, i) => `${i === q.correct ? "*" : "-"} ${o}`).join("\n")}`).join("\n\n");
  openModal(`
    <h3>Final quiz — ${esc(c.title)}</h3>
    <p class="sub-p">One block per question: a "Q:" line, then options one per line — mark the correct one with <b>*</b> instead of -.</p>
    <textarea id="fqText" class="modal-input mono-area" style="min-height:260px">${esc(text)}</textarea>
    <label class="f-label">Pass score</label>
    <input id="fqPass" class="modal-input" type="number" min="1" value="${c.finalQuiz.passScore}" style="max-width:120px">
    <div class="m-actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn accent" id="fqSave">Save</button>
    </div>`);
  $("#fqSave").addEventListener("click", async () => {
    const blocks = $("#fqText").value.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const questions = [];
    for (const b of blocks) {
      const lines = b.split("\n").map(l => l.trim()).filter(Boolean);
      const qLine = lines.find(l => l.startsWith("Q:"));
      const opts = lines.filter(l => /^[-*]\s/.test(l));
      if (!qLine || opts.length < 2) continue;
      questions.push({
        q: qLine.slice(2).trim(),
        options: opts.map(o => o.slice(2).trim()),
        correct: Math.max(0, opts.findIndex(o => o.startsWith("*")))
      });
    }
    if (!questions.length) { toast("Couldn't parse any questions"); return; }
    c.finalQuiz.questions = questions;
    c.finalQuiz.passScore = Math.min(Number($("#fqPass").value) || 1, questions.length);
    await Store.put("courses", c);
    await refresh(); closeModal(); toast(`Saved ${questions.length} questions`); renderLeadArea("builder"); openCourseEditor(cid);
  });
}

function showAssignmentModal(cid) {
  const c = courseById(cid);
  openModal(`
    <h3>Assignment — ${esc(c.title)}</h3>
    <label class="f-label">Assignment title</label><input id="asTitle" class="modal-input" value="${esc(c.assignment.title)}" maxlength="80">
    <label class="f-label">Brief (simple HTML allowed)</label>
    <textarea id="asBrief" class="modal-input" style="min-height:110px">${esc(c.assignment.brief)}</textarea>
    <label class="f-label">Checklist — one item per line</label>
    <textarea id="asCheck" class="modal-input mono-area" style="min-height:160px">${esc(c.assignment.checklist.join("\n"))}</textarea>
    <div class="m-actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn accent" id="asSave">Save</button>
    </div>`);
  $("#asSave").addEventListener("click", async () => {
    const checklist = $("#asCheck").value.split("\n").map(l => l.trim()).filter(Boolean);
    if (!checklist.length) { toast("Checklist needs at least one item"); return; }
    c.assignment = {
      title: $("#asTitle").value.trim() || "Practical assignment",
      brief: $("#asBrief").value.trim(),
      checklist
    };
    await Store.put("courses", c);
    await refresh(); closeModal(); toast("Assignment saved"); renderLeadArea("builder"); openCourseEditor(cid);
  });
}

/* ---------------- people ---------------- */

function leadPeople() {
  $("#leadBody").innerHTML = `
    <div class="admin-card">
      <div class="card-head"><h3>Team (${cache.people.length})</h3><button class="btn accent" id="addPerson">+ Add person</button></div>
      <table><tr><th>Name</th><th>Role</th><th>Joined</th><th></th></tr>
        ${cache.people.map(p => `<tr>
          <td><b>${esc(p.name)}</b></td>
          <td>${p.role === "lead" ? "★ Lead" : "Trainee"}</td>
          <td>${p.createdAt ? fmtDate(p.createdAt) : "—"}</td>
          <td style="white-space:nowrap">
            <button class="btn" data-edit-person="${p.id}">✎</button>
            <button class="btn ghost" data-deact="${p.id}">Deactivate</button>
          </td></tr>`).join("")}</table>
    </div>`;
  $("#addPerson").addEventListener("click", () => showPersonModal(null));
  $$("[data-edit-person]").forEach(b => b.addEventListener("click", () => showPersonModal(b.dataset.editPerson)));
  $$("[data-deact]").forEach(b => b.addEventListener("click", async () => {
    const p = personById(b.dataset.deact);
    if (p.id === me.id) { toast("You can't deactivate yourself"); return; }
    p.active = false;
    await Store.put("people", p);
    await refresh(); leadPeople(); toast(`${p.name} deactivated (history kept)`);
  }));
}

function showPersonModal(id) {
  const p = id ? personById(id) : null;
  openModal(`
    <h3>${p ? "Edit person" : "Add person"}</h3>
    <label class="f-label">Name</label><input id="ppName" class="modal-input" value="${p ? esc(p.name) : ""}" maxlength="40">
    <label class="f-label">Role</label>
    <select id="ppRole" class="modal-input">
      <option value="trainee" ${p && p.role === "trainee" ? "selected" : ""}>Trainee</option>
      <option value="lead" ${p && p.role === "lead" ? "selected" : ""}>Lead (PIN-gated tools)</option>
    </select>
    <div class="m-actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn accent" id="ppSave">Save</button>
    </div>`);
  $("#ppSave").addEventListener("click", async () => {
    const name = $("#ppName").value.trim();
    if (!name) { $("#ppName").focus(); return; }
    const doc = p || { id: await Store.nextId("PPL"), active: true, createdAt: Date.now() };
    doc.name = name;
    doc.role = $("#ppRole").value;
    await Store.put("people", doc);
    await refresh(); closeModal(); leadPeople(); toast("Saved");
  });
}

/* ---------------- settings ---------------- */

function leadSettings() {
  const s = cache.settings;
  $("#leadBody").innerHTML = `
    <div class="admin-card" style="max-width:560px">
      <h3>Workspace</h3>
      <label class="f-label">Agency / team name</label>
      <input id="setOrg" class="modal-input" value="${esc(s.orgName)}" maxlength="50">
      <label class="f-label">Lead PIN</label>
      <input id="setPin" class="modal-input" value="${esc(String(s.adminPin))}" maxlength="8">
      <div style="margin-top:16px"><button class="btn accent" id="setSave">Save settings</button></div>
    </div>
    <div class="admin-card" style="max-width:560px;margin-top:16px">
      <h3>Data</h3>
      <p class="sub-p">Adapter in use: <b>${(window.APP_CONFIG || {}).adapter || "local"}</b>. Export is a full JSON backup — and the migration file when you connect a real database (see README).</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="setExport">⬇ Export backup</button>
        <button class="btn" id="setImport">⬆ Import backup</button>
        <button class="btn ghost" id="setReset" style="color:var(--red)">Reset to demo data</button>
      </div>
      <input type="file" id="setFile" accept="application/json" style="display:none">
    </div>`;
  $("#setSave").addEventListener("click", async () => {
    s.orgName = $("#setOrg").value.trim() || s.orgName;
    s.adminPin = $("#setPin").value.trim() || s.adminPin;
    await Store.put("settings", s);
    await refresh(); setHeader(); toast("Settings saved"); leadSettings();
  });
  $("#setExport").addEventListener("click", async () => {
    const dump = await Store.exportAll(["settings", "courses", "modules", "people", "progress", "submissions"]);
    downloadFile("academy-backup.json", JSON.stringify(dump, null, 2), "application/json");
  });
  $("#setImport").addEventListener("click", () => $("#setFile").click());
  $("#setFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await Store.importAll(JSON.parse(await file.text()));
      await refresh(); toast("Backup imported"); renderLeadArea("dashboard");
    } catch (err) { toast("Import failed: not a valid backup"); }
  });
  $("#setReset").addEventListener("click", () => {
    openModal(`<h3>Reset to demo data?</h3>
      <p class="sub-p">Clears this workspace on this device and reloads the demo course. Export a backup first if needed.</p>
      <div class="m-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn accent" id="resetGo" style="background:var(--red);border-color:var(--red)">Yes, reset</button>
      </div>`);
    $("#resetGo").addEventListener("click", async () => {
      await Store.clearAll();
      await writeSeed();
      await refresh();
      me = null; courseId = null; leadUnlocked = false;
      sessionStorage.clear();
      closeModal(); toast("Demo data restored"); render("home");
    });
  });
}

/* ---------------- shared utils ---------------- */

function csvCell(v) { return `"${String(v == null ? "" : v).replace(/"/g, '""')}"`; }
function downloadFile(name, content, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
