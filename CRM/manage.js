/* Admissions CRM — Admissions desk (documents + fees), Manage, Settings.
 * Everything an admin can configure lives here: programmes, counsellors,
 * sources, pipeline stages, CSV import, backup/restore.
 */

let admView = "documents";   // "documents" | "fees"

/* ---------------- Admissions desk ---------------- */

function renderAdmissions() {
  const leads = visibleLeads();
  const inFlight = leads.filter(l => {
    const o = stageById(l.stage).order || 0;
    return o >= (stageById("applied").order || 5) && isOpen(l);
  });

  const docPending = inFlight.filter(l => {
    const docs = courseById(l.courseId).docs || [];
    return docs.some(d => !(l.docs || {})[d] || !l.docs[d].verified);
  });
  const toVerify = inFlight.filter(l => {
    const docs = courseById(l.courseId).docs || [];
    return docs.some(d => (l.docs || {})[d] && l.docs[d].received && !l.docs[d].verified);
  });

  const duePayments = cache.payments.filter(p => p.status !== "paid" && leads.some(l => l.id === p.leadId));
  const dueTotal = duePayments.reduce((s, p) => s + p.amount, 0);
  const collected = cache.payments.filter(p => p.status === "paid" && leads.some(l => l.id === p.leadId))
    .reduce((s, p) => s + p.amount, 0);

  $("#view").innerHTML = `
    <div class="toolbar">
      <div>
        <h2>Admissions desk</h2>
        <div class="sub-note">Document verification and fee collection for everyone past application stage.</div>
      </div>
      <div class="spacer"></div>
      <div class="chip-row">
        <button class="chip ${admView === "documents" ? "active" : ""}" data-av="documents">Documents</button>
        <button class="chip ${admView === "fees" ? "active" : ""}" data-av="fees">Fees</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat blue"><div class="n">${inFlight.length}</div><div class="l">In admission</div><div class="d">applied or beyond</div></div>
      <div class="stat amber"><div class="n">${toVerify.length}</div><div class="l">Awaiting verification</div><div class="d">documents submitted</div></div>
      <div class="stat red"><div class="n">${docPending.length}</div><div class="l">Incomplete files</div><div class="d">missing documents</div></div>
      <div class="stat green"><div class="n">${moneyShort(collected)}</div><div class="l">Fees collected</div><div class="d">${moneyShort(dueTotal)} outstanding</div></div>
    </div>

    ${admView === "documents" ? docQueueHtml(inFlight) : feeQueueHtml(leads, duePayments)}`;

  $$("[data-av]").forEach(b => b.addEventListener("click", () => { admView = b.dataset.av; render(); }));
  $$("[data-lead]").forEach(el => el.addEventListener("click", e => {
    e.stopPropagation();
    openLead(el.dataset.lead, el.dataset.tab || "documents");
  }));
}

function docQueueHtml(leads) {
  const rows = leads.map(l => {
    const docs = courseById(l.courseId).docs || [];
    const st = l.docs || {};
    const ver = docs.filter(d => st[d] && st[d].verified).length;
    const recv = docs.filter(d => st[d] && st[d].received).length;
    const missing = docs.filter(d => !st[d] || !st[d].received);
    return { l, docs, ver, recv, missing, pct: docs.length ? Math.round((ver / docs.length) * 100) : 100 };
  }).sort((a, b) => (b.recv - b.ver) - (a.recv - a.ver) || a.pct - b.pct);

  return `<div class="section">
    <h3>Document verification queue</h3>
    <div class="sub-note">Sorted by what needs a human right now — submitted but unverified first.</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Student</th><th>Programme</th><th>Stage</th><th style="width:150px">Verified</th><th>Awaiting check</th><th>Missing</th><th></th></tr></thead>
      <tbody>${rows.map(r => `
        <tr class="row-link" data-lead="${r.l.id}" data-tab="documents">
          <td><b>${esc(r.l.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(r.l.phone)}</div></td>
          <td style="font-size:12.5px">${esc(courseById(r.l.courseId).name)}</td>
          <td><span class="badge s-${r.l.stage}">${esc(stageById(r.l.stage).name)}</span></td>
          <td><div class="bar ${r.pct === 100 ? "green" : r.pct >= 50 ? "amber" : "red"}"><b style="width:${r.pct}%"></b></div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">${r.ver} of ${r.docs.length}</div></td>
          <td>${r.recv - r.ver ? `<span class="tag warm">${r.recv - r.ver} to check</span>` : '<span style="color:var(--muted);font-size:12px">—</span>'}</td>
          <td style="font-size:12px;color:var(--muted);max-width:230px">${r.missing.length ? esc(r.missing.join(", ")) : "None"}</td>
          <td><button class="btn xs" data-lead="${r.l.id}" data-tab="documents">Open</button></td>
        </tr>`).join("") || `<tr><td colspan="7"><div class="empty">Nothing in the admission stage yet.</div></td></tr>`}
      </tbody></table></div>
  </div>`;
}

function feeQueueHtml(leads, duePayments) {
  const rows = duePayments.map(p => ({ p, l: leadById(p.leadId) })).filter(r => r.l)
    .sort((a, b) => (a.p.dueAt || 0) - (b.p.dueAt || 0));

  // per-programme collection summary — the number a director actually asks for
  const byCourse = cache.courses.map(c => {
    const enrolled = leads.filter(l => l.courseId === c.id && isWon(l));
    const ids = new Set(leads.filter(l => l.courseId === c.id).map(l => l.id));
    const got = cache.payments.filter(p => p.status === "paid" && ids.has(p.leadId)).reduce((s, p) => s + p.amount, 0);
    const expected = enrolled.length * c.fee;
    return { c, enrolled: enrolled.length, got, expected, pct: expected ? Math.round((got / expected) * 100) : 0 };
  }).filter(r => r.enrolled || r.got);

  return `
    <div class="section">
      <h3>Outstanding payments</h3>
      <div class="sub-note">Every raised-but-unpaid instalment, oldest due date first.</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Student</th><th>Programme</th><th>Instalment</th><th class="num">Amount</th><th>Due</th><th></th></tr></thead>
        <tbody>${rows.map(r => {
          const late = r.p.dueAt && r.p.dueAt < Date.now();
          return `<tr class="row-link" data-lead="${r.l.id}" data-tab="payments">
            <td><b>${esc(r.l.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(r.l.phone)}</div></td>
            <td style="font-size:12.5px">${esc(courseById(r.l.courseId).name)}</td>
            <td style="font-size:12.5px">${esc(r.p.type)}</td>
            <td class="num">${money(r.p.amount)}</td>
            <td style="font-size:12.5px;color:${late ? "var(--red)" : "var(--muted)"}">${r.p.dueAt ? fmtDate(r.p.dueAt) : "—"}${late ? " · overdue" : ""}</td>
            <td style="white-space:nowrap"><button class="btn xs green" data-paid2="${r.p.id}">Mark paid</button></td>
          </tr>`;
        }).join("") || `<tr><td colspan="6"><div class="empty">Nothing outstanding. Every raised instalment is paid.</div></td></tr>`}
        </tbody></table></div>
    </div>

    <div class="section">
      <h3>Collection by programme</h3>
      <div class="sub-note">Against the full fee of confirmed enrolments.</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Programme</th><th class="num">Enrolled</th><th class="num">Collected</th><th class="num">Expected</th><th style="width:160px">Progress</th></tr></thead>
        <tbody>${byCourse.map(r => `
          <tr><td>${esc(r.c.name)}</td>
            <td class="num">${r.enrolled}</td>
            <td class="num">${moneyShort(r.got)}</td>
            <td class="num">${moneyShort(r.expected)}</td>
            <td><div class="bar ${r.pct >= 90 ? "green" : r.pct >= 50 ? "amber" : "red"}"><b style="width:${Math.min(100, r.pct)}%"></b></div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">${r.pct}%</div></td></tr>`).join("")
          || `<tr><td colspan="5"><div class="empty">No enrolments yet.</div></td></tr>`}
        </tbody></table></div>
    </div>`;
}

/* bind mark-paid buttons that live in the admissions table */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-paid2]");
  if (!b) return;
  e.stopPropagation();
  await markPaid(b.dataset.paid2);
});

/* ---------------- Manage ---------------- */

let manageTab = "courses";

function renderManage() {
  const tabs = [["courses", "Programmes"], ["users", "Team"], ["sources", "Sources"], ["stages", "Pipeline"], ["import", "Import"]];
  $("#view").innerHTML = `
    <div class="toolbar">
      <div><h2>Manage</h2><div class="sub-note">Everything here is data, not code — change it and the whole CRM follows.</div></div>
      <div class="spacer"></div>
      <div class="chip-row">${tabs.map(([k, lbl]) =>
        `<button class="chip ${manageTab === k ? "active" : ""}" data-mt="${k}">${lbl}</button>`).join("")}</div>
    </div>
    ${{ courses: coursesHtml, users: usersHtml, sources: sourcesHtml, stages: stagesHtml, import: importHtml }[manageTab]()}`;

  $$("[data-mt]").forEach(b => b.addEventListener("click", () => { manageTab = b.dataset.mt; render(); }));
  ({ courses: bindCourses, users: bindUsers, sources: bindSources, stages: bindStages, import: bindImport }[manageTab])();
}

function coursesHtml() {
  return `<div class="section">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h3 style="flex:1">Programmes</h3>
      <button class="btn brand sm" id="cAdd">+ Add programme</button>
    </div>
    <div class="sub-note">Fee, seats and the document checklist each programme demands.</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Programme</th><th>Level</th><th class="num">Fee</th><th class="num">Seats</th><th class="num">Filled</th><th>Intake</th><th>Documents</th><th></th></tr></thead>
      <tbody>${cache.allCourses.map(c => {
        const filled = cache.leads.filter(l => l.courseId === c.id && isWon(l)).length;
        const pct = c.seats ? Math.round((filled / c.seats) * 100) : 0;
        return `<tr ${c.active === false ? 'style="opacity:0.5"' : ""}>
          <td><b>${esc(c.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(c.duration || "")}${c.active === false ? " · archived" : ""}</div></td>
          <td>${esc(c.level)}</td>
          <td class="num">${money(c.fee)}</td>
          <td class="num">${c.seats}</td>
          <td class="num" style="color:${pct >= 90 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--muted)"}">${filled} <span style="font-size:11px">(${pct}%)</span></td>
          <td style="font-size:12.5px">${esc(c.intake || "—")}</td>
          <td style="font-size:11.5px;color:var(--muted);max-width:220px">${(c.docs || []).length} required</td>
          <td style="white-space:nowrap">
            <button class="btn xs" data-cedit="${c.id}">Edit</button>
            <button class="btn xs ghost" data-carch="${c.id}">${c.active === false ? "Restore" : "Archive"}</button>
          </td></tr>`;
      }).join("")}</tbody></table></div>
  </div>`;
}

function bindCourses() {
  $("#cAdd").addEventListener("click", () => showCourseModal(null));
  $$("[data-cedit]").forEach(b => b.addEventListener("click", () => showCourseModal(b.dataset.cedit)));
  $$("[data-carch]").forEach(b => b.addEventListener("click", async () => {
    const c = courseById(b.dataset.carch);
    c.active = c.active === false;
    await Store.put("courses", c);
    await addLog(`Programme ${c.active ? "restored" : "archived"}: ${c.name}.`);
    await refresh(); toast(c.active ? "Restored" : "Archived"); render();
  }));
}

function showCourseModal(id) {
  const c = id ? courseById(id) : null;
  openModal(`
    <h3>${c ? "Edit programme" : "New programme"}</h3>
    <div class="sub">The document list becomes the verification checklist on every lead for this programme.</div>
    <label>Name *</label><input id="cName" value="${esc(c ? c.name : "")}">
    <div class="row2">
      <div><label>Level</label><select id="cLevel">${["UG", "PG", "Diploma", "PhD", "Certificate"].map(x => `<option ${c && c.level === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div><label>Duration</label><input id="cDur" value="${esc(c ? c.duration : "")}" placeholder="4 years"></div>
    </div>
    <div class="row2">
      <div><label>Total fee</label><input id="cFee" type="number" min="0" value="${c ? c.fee : 0}"></div>
      <div><label>Seats</label><input id="cSeats" type="number" min="0" value="${c ? c.seats : 60}"></div>
    </div>
    <label>Intake</label><input id="cIntake" value="${esc(c ? c.intake : "")}" placeholder="Aug 2026">
    <label>Required documents (one per line)</label>
    <textarea id="cDocs" style="min-height:130px">${esc((c && c.docs ? c.docs : ["10th Marksheet", "12th Marksheet", "Aadhaar", "Passport Photo"]).join("\n"))}</textarea>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="cGo">Save</button></div>`);
  $("#cGo").addEventListener("click", async () => {
    const name = $("#cName").value.trim();
    if (!name) { $("#cName").focus(); return; }
    let doc = c;
    if (!doc) doc = { id: await Store.nextId("CRS"), active: true, filled: 0 };
    Object.assign(doc, {
      name, level: $("#cLevel").value, duration: $("#cDur").value.trim(),
      fee: Number($("#cFee").value) || 0, seats: Number($("#cSeats").value) || 0,
      intake: $("#cIntake").value.trim(),
      docs: $("#cDocs").value.split("\n").map(s => s.trim()).filter(Boolean)
    });
    await Store.put("courses", doc);
    await addLog(`${c ? "Programme updated" : "New programme"}: ${name}.`);
    await refresh(); closeModal(); toast(`${name} saved`); render();
  });
  $("#cName").focus();
}

function usersHtml() {
  return `<div class="section">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h3 style="flex:1">Team</h3>
      <button class="btn brand sm" id="uAdd">+ Add member</button>
    </div>
    <div class="sub-note">Counsellors own leads; admins see everything and unlock Manage with the PIN.</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th class="num">Leads</th><th class="num">Open</th><th class="num">Enrolled</th><th class="num">Target</th><th></th></tr></thead>
      <tbody>${cache.allUsers.map(u => {
        const mine = cache.leads.filter(l => l.ownerId === u.id);
        return `<tr ${u.active === false ? 'style="opacity:0.5"' : ""}>
          <td><b>${esc(u.name)}</b>${u.active === false ? '<div style="font-size:11.5px;color:var(--muted)">inactive</div>' : ""}</td>
          <td><span class="badge plain">${esc(u.role)}</span></td>
          <td style="font-size:12.5px;color:var(--muted)">${esc(u.email)}<br>${esc(u.phone)}</td>
          <td class="num">${mine.length}</td>
          <td class="num">${mine.filter(isOpen).length}</td>
          <td class="num" style="color:var(--green)">${mine.filter(isWon).length}</td>
          <td class="num">${u.target || "—"}</td>
          <td style="white-space:nowrap">
            <button class="btn xs" data-uedit="${u.id}">Edit</button>
            <button class="btn xs ghost" data-uarch="${u.id}">${u.active === false ? "Restore" : "Deactivate"}</button>
          </td></tr>`;
      }).join("")}</tbody></table></div>
  </div>`;
}

function bindUsers() {
  $("#uAdd").addEventListener("click", () => showUserModal(null));
  $$("[data-uedit]").forEach(b => b.addEventListener("click", () => showUserModal(b.dataset.uedit)));
  $$("[data-uarch]").forEach(b => b.addEventListener("click", async () => {
    const u = userById(b.dataset.uarch);
    const open = cache.leads.filter(l => l.ownerId === u.id && isOpen(l));
    if (u.active !== false && open.length) {
      toast(`${u.name} still owns ${open.length} open leads — reassign them first`);
      return;
    }
    u.active = u.active === false;
    await Store.put("users", u);
    await addLog(`Team member ${u.active ? "restored" : "deactivated"}: ${u.name}.`);
    await refresh(); toast(u.active ? "Restored" : "Deactivated"); render();
  }));
}

function showUserModal(id) {
  const u = id ? userById(id) : null;
  openModal(`
    <h3>${u ? "Edit member" : "Add team member"}</h3>
    <div class="sub">Roles: counsellor and telecaller see only their own leads; admin sees everything.</div>
    <label>Name *</label><input id="uName" value="${esc(u ? u.name : "")}">
    <div class="row2">
      <div><label>Role</label><select id="uRole">${["counsellor", "telecaller", "admin"].map(r => `<option ${u && u.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div><label>Enrolment target</label><input id="uTarget" type="number" min="0" value="${u ? u.target || 0 : 30}"></div>
    </div>
    <div class="row2">
      <div><label>Email</label><input id="uEmail" type="email" value="${esc(u ? u.email : "")}"></div>
      <div><label>Phone</label><input id="uPhone" value="${esc(u ? u.phone : "")}"></div>
    </div>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="uGo">Save</button></div>`);
  $("#uGo").addEventListener("click", async () => {
    const name = $("#uName").value.trim();
    if (!name) { $("#uName").focus(); return; }
    let doc = u;
    if (!doc) doc = { id: await Store.nextId("USR"), active: true };
    Object.assign(doc, {
      name, role: $("#uRole").value, target: Number($("#uTarget").value) || 0,
      email: $("#uEmail").value.trim(), phone: $("#uPhone").value.trim()
    });
    await Store.put("users", doc);
    await addLog(`${u ? "Team member updated" : "New team member"}: ${name} (${doc.role}).`);
    await refresh(); closeModal(); toast(`${name} saved`); render();
  });
  $("#uName").focus();
}

function sourcesHtml() {
  return `<div class="section">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h3 style="flex:1">Lead sources</h3>
      <button class="btn brand sm" id="sAdd">+ Add source</button>
    </div>
    <div class="sub-note">Spend drives cost-per-lead and cost-per-admission. Quality (0–1) feeds the lead score.</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Source</th><th class="num">Spend</th><th class="num">Leads</th><th class="num">Cost/lead</th><th class="num">Enrolled</th><th class="num">Cost/adm.</th><th class="num">Quality</th><th></th></tr></thead>
      <tbody>${cache.allSources.map(s => {
        const ls = cache.leads.filter(l => l.sourceId === s.id);
        const w = ls.filter(isWon).length;
        return `<tr ${s.active === false ? 'style="opacity:0.5"' : ""}>
          <td><b>${esc(s.name)}</b></td>
          <td class="num">${moneyShort(s.spend)}</td>
          <td class="num">${ls.length}</td>
          <td class="num">${ls.length ? moneyShort(s.spend / ls.length) : "—"}</td>
          <td class="num">${w}</td>
          <td class="num" style="font-weight:700">${w ? moneyShort(s.spend / w) : "—"}</td>
          <td class="num">${(s.quality != null ? s.quality : 0.5).toFixed(2)}</td>
          <td style="white-space:nowrap">
            <button class="btn xs" data-sedit="${s.id}">Edit</button>
            <button class="btn xs ghost" data-sarch="${s.id}">${s.active === false ? "Restore" : "Archive"}</button>
          </td></tr>`;
      }).join("")}</tbody></table></div>
  </div>`;
}

function bindSources() {
  $("#sAdd").addEventListener("click", () => showSourceModal(null));
  $$("[data-sedit]").forEach(b => b.addEventListener("click", () => showSourceModal(b.dataset.sedit)));
  $$("[data-sarch]").forEach(b => b.addEventListener("click", async () => {
    const s = sourceById(b.dataset.sarch);
    s.active = s.active === false;
    await Store.put("sources", s);
    await refresh(); toast(s.active ? "Restored" : "Archived"); render();
  }));
}

function showSourceModal(id) {
  const s = id ? sourceById(id) : null;
  openModal(`
    <h3>${s ? "Edit source" : "New source"}</h3>
    <div class="sub">Quality is your own judgement of how well this channel converts — a walk-in is 1.0, a scraped portal list is 0.3.</div>
    <label>Name *</label><input id="sName" value="${esc(s ? s.name : "")}">
    <div class="row2">
      <div><label>Season spend</label><input id="sSpend" type="number" min="0" value="${s ? s.spend : 0}"></div>
      <div><label>Quality (0–1)</label><input id="sQual" type="number" min="0" max="1" step="0.05" value="${s ? (s.quality != null ? s.quality : 0.5) : 0.5}"></div>
    </div>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="sGo">Save</button></div>`);
  $("#sGo").addEventListener("click", async () => {
    const name = $("#sName").value.trim();
    if (!name) { $("#sName").focus(); return; }
    let doc = s;
    if (!doc) doc = { id: await Store.nextId("SRC"), active: true };
    Object.assign(doc, {
      name, spend: Number($("#sSpend").value) || 0,
      quality: Math.max(0, Math.min(1, Number($("#sQual").value) || 0.5))
    });
    await Store.put("sources", doc);
    await refresh(); closeModal(); toast(`${name} saved`); render();
  });
  $("#sName").focus();
}

function stagesHtml() {
  return `<div class="section">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h3 style="flex:1">Pipeline stages</h3>
      <button class="btn brand sm" id="stAdd">+ Add stage</button>
    </div>
    <div class="sub-note">Your admission process, not ours. SLA is the number of days a lead may sit here before the board flags it as stalled.</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>#</th><th>Stage</th><th>Type</th><th class="num">SLA (days)</th><th class="num">Leads</th><th>Colour</th><th></th></tr></thead>
      <tbody>${cache.stages.map((s, i) => `
        <tr>
          <td class="mono" style="color:var(--muted)">${s.order}</td>
          <td><b style="color:var(--${s.color || "brand"})">${esc(s.name)}</b><div class="mono" style="font-size:11px;color:var(--muted)">${esc(s.id)}</div></td>
          <td><span class="badge plain">${esc(s.kind)}</span></td>
          <td class="num">${s.sla || "—"}</td>
          <td class="num">${cache.leads.filter(l => l.stage === s.id).length}</td>
          <td><span style="display:inline-block;width:18px;height:18px;border-radius:5px;background:var(--${s.color || "brand"})"></span></td>
          <td style="white-space:nowrap">
            <button class="btn xs" data-stedit="${s.id}">Edit</button>
            <button class="btn xs ghost" data-stup="${s.id}" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="btn xs ghost" data-stdn="${s.id}" ${i === cache.stages.length - 1 ? "disabled" : ""}>↓</button>
          </td></tr>`).join("")}</tbody></table></div>
    <div class="hint">Every pipeline needs exactly one <b>won</b> stage and one <b>lost</b> stage — the funnel maths, conversion rates and revenue reports all key off them.</div>
  </div>`;
}

function bindStages() {
  $("#stAdd").addEventListener("click", () => showStageEditModal(null));
  $$("[data-stedit]").forEach(b => b.addEventListener("click", () => showStageEditModal(b.dataset.stedit)));
  const swap = async (id, dir) => {
    const i = cache.stages.findIndex(s => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= cache.stages.length) return;
    const a = cache.stages[i], b = cache.stages[j];
    const t = a.order; a.order = b.order; b.order = t;
    await Store.put("stages", a); await Store.put("stages", b);
    await refresh(); render();
  };
  $$("[data-stup]").forEach(b => b.addEventListener("click", () => swap(b.dataset.stup, -1)));
  $$("[data-stdn]").forEach(b => b.addEventListener("click", () => swap(b.dataset.stdn, 1)));
}

function showStageEditModal(id) {
  const s = id ? stageById(id) : null;
  const colors = ["blue", "cyan", "violet", "amber", "orange", "teal", "pink", "green", "red", "brand"];
  openModal(`
    <h3>${s ? "Edit stage" : "New stage"}</h3>
    <div class="sub">${s ? "Renaming is safe — leads reference the stage id, not its label." : "New stages are added at the end; reorder with the arrows."}</div>
    <label>Name *</label><input id="stName" value="${esc(s ? s.name : "")}">
    <div class="row2">
      <div><label>Type</label><select id="stKind">${["open", "won", "lost"].map(k => `<option ${s && s.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
      <div><label>SLA (days, 0 = none)</label><input id="stSla" type="number" min="0" value="${s ? s.sla || 0 : 3}"></div>
    </div>
    <label>Colour</label>
    <select id="stColor">${colors.map(c => `<option ${s && s.color === c ? "selected" : ""}>${c}</option>`).join("")}</select>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="stGo">Save</button></div>`);
  $("#stGo").addEventListener("click", async () => {
    const name = $("#stName").value.trim();
    if (!name) { $("#stName").focus(); return; }
    const kind = $("#stKind").value;
    // guard the invariant the funnel depends on
    const clash = cache.stages.find(x => x.kind === kind && x.id !== (s && s.id) && kind !== "open");
    if (clash) { toast(`"${clash.name}" is already the ${kind} stage — change it first`); return; }
    let doc = s;
    if (!doc) doc = { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20), order: cache.stages.length + 1 };
    Object.assign(doc, { name, kind, sla: Number($("#stSla").value) || 0, color: $("#stColor").value });
    await Store.put("stages", doc);
    await addLog(`Pipeline stage ${s ? "updated" : "added"}: ${name}.`);
    await refresh(); closeModal(); toast(`${name} saved`); render();
  });
  $("#stName").focus();
}

/* ---------------- CSV import ----------------
 * Every institution arrives with an Excel of enquiries. If import is painful
 * they never migrate, so this maps columns and flags duplicates before writing.
 */

let importRows = null;

function importHtml() {
  return `<div class="section">
    <h3>Import enquiries from CSV</h3>
    <div class="sub-note">Paste rows straight out of Excel or Google Sheets. First row must be a header.</div>
    <label>Recognised columns</label>
    <div class="preview">name, phone, email, city, course, source, guardian, guardianphone, marks, school, notes</div>
    <div class="hint">Only <b>name</b> and <b>phone</b> are required. Unknown <b>course</b> or <b>source</b> values fall back to the first configured one. Rows whose phone or email already exists are marked duplicate and skipped.</div>
    <label>CSV data</label>
    <textarea id="impData" style="min-height:170px;font-family:var(--mono);font-size:12.5px" placeholder="name,phone,email,city,course,source
Rahul Sharma,9812345678,rahul@example.com,Pune,B.Tech — Computer Science,Walk-in"></textarea>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <button class="btn" id="impPreview">Preview</button>
      <button class="btn brand" id="impGo" disabled>Import</button>
      <div style="flex:1"></div>
      <button class="btn" id="impSample">Load sample</button>
    </div>
    <div id="impOut"></div>
  </div>`;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function bindImport() {
  $("#impSample").addEventListener("click", () => {
    $("#impData").value = `name,phone,email,city,course,source,marks
Rahul Sharma,9812345670,rahul.s@example.com,Pune,B.Tech — Computer Science,Walk-in,88
Sneha Kulkarni,9812345671,sneha.k@example.com,Mumbai,MBA — Finance & Analytics,Education Fair,79
Amit Verma,9812345672,amit.v@example.com,Nashik,B.Tech — Mechanical,Google Ads,71`;
    toast("Sample loaded — hit Preview");
  });

  $("#impPreview").addEventListener("click", () => {
    const rows = parseCsv($("#impData").value.trim());
    if (rows.length < 2) { toast("Need a header row plus at least one data row"); return; }
    const head = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
    const idx = (k) => head.indexOf(k);
    const parsed = rows.slice(1).map(r => {
      const get = (k) => { const i = idx(k); return i >= 0 ? String(r[i] || "").trim() : ""; };
      const courseName = get("course");
      const sourceName = get("source");
      const course = cache.courses.find(c => c.name.toLowerCase() === courseName.toLowerCase()) || cache.courses[0];
      const source = cache.sources.find(s => s.name.toLowerCase() === sourceName.toLowerCase()) || cache.sources[0];
      const name = get("name"), phone = get("phone"), email = get("email");
      const dup = findDuplicate(phone, email, null);
      return {
        name, phone, email, city: get("city"),
        guardianName: get("guardian"), guardianPhone: get("guardianphone"),
        marks12: Number(get("marks")) || 0, prevSchool: get("school"), notes: get("notes"),
        courseId: course ? course.id : null, sourceId: source ? source.id : null,
        courseName: course ? course.name : "—", sourceName: source ? source.name : "—",
        dup, valid: !!(name && phone)
      };
    });
    importRows = parsed;
    const ok = parsed.filter(p => p.valid && !p.dup);
    const bad = parsed.filter(p => !p.valid);
    const dups = parsed.filter(p => p.valid && p.dup);
    $("#impOut").innerHTML = `
      ${ok.length ? `<div class="ok-box">${ok.length} row${ok.length > 1 ? "s" : ""} ready to import.</div>` : ""}
      ${dups.length ? `<div class="warn-box"><b>${dups.length} duplicate${dups.length > 1 ? "s" : ""} will be skipped:</b> ${esc(dups.map(d => d.name + " → " + d.dup.name + " (" + d.dup.id + ")").join("; "))}</div>` : ""}
      ${bad.length ? `<div class="err-box">${bad.length} row${bad.length > 1 ? "s" : ""} missing name or phone — these will be skipped.</div>` : ""}
      <div class="tbl-wrap" style="margin-top:14px"><table>
        <thead><tr><th>Name</th><th>Phone</th><th>Programme</th><th>Source</th><th>Status</th></tr></thead>
        <tbody>${parsed.slice(0, 25).map(p => `<tr>
          <td>${esc(p.name) || '<span style="color:var(--red)">missing</span>'}</td>
          <td class="mono" style="font-size:12px">${esc(p.phone) || '<span style="color:var(--red)">missing</span>'}</td>
          <td style="font-size:12.5px">${esc(p.courseName)}</td>
          <td style="font-size:12.5px">${esc(p.sourceName)}</td>
          <td>${!p.valid ? '<span class="tag hot">invalid</span>' : p.dup ? '<span class="tag warm">duplicate</span>' : '<span class="tag cold">new</span>'}</td>
        </tr>`).join("")}</tbody></table></div>
      ${parsed.length > 25 ? `<div class="hint">Showing first 25 of ${parsed.length} rows.</div>` : ""}`;
    $("#impGo").disabled = !ok.length;
  });

  $("#impGo").addEventListener("click", async () => {
    const ok = (importRows || []).filter(p => p.valid && !p.dup);
    let n = 0;
    for (const p of ok) {
      const id = await Store.nextId("LD");
      await Store.put("leads", {
        id, name: p.name, phone: p.phone, email: p.email, city: p.city,
        guardianName: p.guardianName, guardianPhone: p.guardianPhone,
        courseId: p.courseId, sourceId: p.sourceId,
        ownerId: await pickOwner(p.courseId),
        stage: cache.stages[0].id, createdAt: Date.now(), lastActivityAt: Date.now(),
        marks12: p.marks12, prevSchool: p.prevSchool, notes: p.notes,
        firstResponseMins: null, enrolledAt: null, lostReason: null, docs: {}, tags: ["imported"]
      });
      await refresh();
      n++;
    }
    await addLog(`CSV import: ${n} enquiries added.`);
    importRows = null;
    await refresh();
    toast(`${n} enquiries imported`);
    render();
  });
}

/* ---------------- Settings ---------------- */

const COLLECTIONS = ["settings", "users", "courses", "sources", "stages", "leads", "activities", "tasks", "payments", "templates", "events", "log"];

function renderSettings() {
  const s = cache.settings;
  const w = s.scoreWeights || {};
  $("#view").innerHTML = `
    <div class="toolbar"><div><h2>Settings</h2><div class="sub-note">Institution profile, SLAs, scoring and data.</div></div></div>

    <div class="section">
      <h3>Institution</h3>
      <div class="set-grid">
        <div><label class="set-label">Name</label><input class="set-input" id="sOrg" value="${esc(s.orgName)}"></div>
        <div><label class="set-label">Short code</label><input class="set-input" id="sShort" value="${esc(s.orgShort || "")}"></div>
        <div><label class="set-label">Academic year</label><input class="set-input" id="sYear" value="${esc(s.academicYear)}"></div>
        <div><label class="set-label">Currency symbol</label><input class="set-input" id="sCur" value="${esc(s.currency)}"></div>
        <div><label class="set-label">Admin PIN</label><input class="set-input" id="sPin" value="${esc(s.adminPin)}"></div>
      </div>
    </div>

    <div class="section">
      <h3>Response &amp; follow-up rules</h3>
      <div class="sub-note">These drive the SLA-breach and stalled flags everywhere in the app.</div>
      <div class="set-grid">
        <div><label class="set-label">First-response SLA (minutes)</label><input class="set-input" id="sSla" type="number" min="1" value="${s.firstResponseSlaMins}"></div>
        <div><label class="set-label">Lead goes cold after (days)</label><input class="set-input" id="sCold" type="number" min="1" value="${s.coldAfterDays}"></div>
        <div><label class="set-label">Auto-assign new leads</label>
          <select class="set-input" id="sAssign">
            <option value="round_robin" ${s.assignMode === "round_robin" ? "selected" : ""}>Round-robin by lowest open load</option>
            <option value="by_course" ${s.assignMode === "by_course" ? "selected" : ""}>Fixed counsellor per programme</option>
            <option value="manual" ${s.assignMode === "manual" ? "selected" : ""}>Manual — leave unassigned</option>
          </select></div>
      </div>
    </div>

    <div class="section">
      <h3>Lead score weights</h3>
      <div class="sub-note">Five signals, each scored 0–5 then multiplied by its weight. Raise what your institution actually converts on.</div>
      <div class="set-grid">
        <div><label class="set-label">Engagement (touches)</label><input class="set-input" id="wAct" type="number" min="0" max="30" value="${w.activity}"></div>
        <div><label class="set-label">Funnel progress</label><input class="set-input" id="wStage" type="number" min="0" max="30" value="${w.stage}"></div>
        <div><label class="set-label">Recency of contact</label><input class="set-input" id="wRec" type="number" min="0" max="30" value="${w.recency}"></div>
        <div><label class="set-label">Source quality</label><input class="set-input" id="wSrc" type="number" min="0" max="30" value="${w.source}"></div>
        <div><label class="set-label">Academic fit</label><input class="set-input" id="wFit" type="number" min="0" max="30" value="${w.fit}"></div>
      </div>
    </div>

    <div class="section">
      <h3>Data</h3>
      <div class="sub-note">Adapter in use: <b class="mono">${esc((window.APP_CONFIG || {}).adapter || "local")}</b> · namespace <b class="mono">${esc((window.APP_CONFIG || {}).namespace || "crm_v2")}</b></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        <button class="btn" id="expJson">⬇ Export backup (JSON)</button>
        <button class="btn" id="expLeads">⬇ Export leads (CSV)</button>
        <button class="btn" id="expPipe">⬇ Export pipeline report (CSV)</button>
        <button class="btn" id="impJson">⬆ Import backup</button>
        <div style="flex:1"></div>
        <button class="btn danger" id="resetAll">Reset to demo data</button>
      </div>
      <input type="file" id="fileIn" accept="application/json" style="display:none">
      <div class="hint">A JSON backup is also the migration path: dump it, load it into your database, flip <b class="mono">config.js</b> to the REST adapter, and every screen keeps working unchanged.</div>
    </div>

    <div class="section">
      <h3>Activity log</h3>
      <div class="sub-note">Append-only audit trail — the last ${cache.log.length} events.</div>
      <div style="max-height:300px;overflow-y:auto;margin-top:10px">
        ${cache.log.map(e => `<div style="font-size:12.5px;padding:8px 0;border-bottom:1px solid var(--line2);color:var(--ink2);line-height:1.5">
          <span class="mono" style="font-size:11px;color:var(--muted);margin-right:10px">${fmtDateTime(e.ts)}</span>${esc(e.msg)}</div>`).join("")
          || `<div class="empty">Nothing logged yet.</div>`}
      </div>
    </div>

    <div class="toolbar"><div class="spacer"></div><button class="btn brand" id="setSave">Save settings</button></div>`;

  $("#setSave").addEventListener("click", async () => {
    Object.assign(cache.settings, {
      orgName: $("#sOrg").value.trim() || "Your Institution",
      orgShort: $("#sShort").value.trim(),
      academicYear: $("#sYear").value.trim(),
      currency: $("#sCur").value.trim() || "₹",
      adminPin: $("#sPin").value.trim() || "1234",
      firstResponseSlaMins: Number($("#sSla").value) || 60,
      coldAfterDays: Number($("#sCold").value) || 7,
      assignMode: $("#sAssign").value,
      scoreWeights: {
        activity: Number($("#wAct").value) || 0, stage: Number($("#wStage").value) || 0,
        recency: Number($("#wRec").value) || 0, source: Number($("#wSrc").value) || 0,
        fit: Number($("#wFit").value) || 0
      }
    });
    await Store.put("settings", cache.settings);
    await addLog("Settings updated.");
    await refresh(); toast("Settings saved"); render();
  });

  $("#expJson").addEventListener("click", async () => {
    const dump = await Store.exportAll(COLLECTIONS);
    downloadFile(`crm-backup-${todayStr()}.json`, JSON.stringify(dump, null, 2), "application/json");
    toast("Backup downloaded");
  });

  $("#expLeads").addEventListener("click", () => {
    const head = ["ID", "Name", "Phone", "Email", "City", "Guardian", "Programme", "Source", "Stage", "Score",
      "Counsellor", "Marks", "Created", "Last activity", "First response (min)", "Lost reason"];
    const rows = cache.leads.map(l => [
      l.id, l.name, l.phone, l.email, l.city, l.guardianName,
      courseById(l.courseId).name, sourceById(l.sourceId).name, stageById(l.stage).name, scoreLead(l),
      userById(l.ownerId).name, l.marks12, new Date(l.createdAt).toISOString().slice(0, 10),
      new Date(l.lastActivityAt).toISOString().slice(0, 10), l.firstResponseMins == null ? "" : l.firstResponseMins,
      l.lostReason || ""
    ]);
    downloadFile(`leads-${todayStr()}.csv`, toCsv([head, ...rows]), "text/csv");
    toast("Leads exported");
  });

  $("#expPipe").addEventListener("click", () => {
    const head = ["Stage", "Leads", "Pipeline value", "Avg score", "Avg days in stage"];
    const rows = cache.stages.map(s => {
      const ls = cache.leads.filter(l => l.stage === s.id);
      const val = ls.reduce((sum, l) => sum + courseById(l.courseId).fee, 0);
      const avgS = ls.length ? Math.round(ls.reduce((a, l) => a + scoreLead(l), 0) / ls.length) : 0;
      const avgD = ls.length ? Math.round(ls.reduce((a, l) => a + (Date.now() - l.lastActivityAt) / DAYMS, 0) / ls.length) : 0;
      return [s.name, ls.length, val, avgS, avgD];
    });
    downloadFile(`pipeline-${todayStr()}.csv`, toCsv([head, ...rows]), "text/csv");
    toast("Pipeline report exported");
  });

  $("#impJson").addEventListener("click", () => $("#fileIn").click());
  $("#fileIn").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const dump = JSON.parse(await f.text());
      await Store.importAll(dump);
      await addLog("Backup imported.");
      await refresh(); toast("Backup imported"); render();
    } catch (err) { toast("Could not read that file"); }
  });

  $("#resetAll").addEventListener("click", () => {
    openModal(`
      <h3>Reset to demo data?</h3>
      <div class="sub">This wipes every lead, activity, payment and setting in this namespace and reloads the demo admission season. Export a backup first if you need one.</div>
      <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn danger" id="rGo">Wipe &amp; reload demo</button></div>`);
    $("#rGo").addEventListener("click", async () => {
      await Store.clearAll();
      await writeSeed();
      await refresh();
      me = cache.users[0] || null;
      adminUnlocked = false;
      currentTab = "dashboard";
      closeModal(); toast("Demo data restored");
      boot();
    });
  });
}

/* ---------------- CSV helpers ---------------- */

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows) { return rows.map(r => r.map(csvCell).join(",")).join("\n"); }

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
