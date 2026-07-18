/* Admissions CRM — pipeline board, lead table, and the lead 360 drawer.
 * The board is the screen counsellors keep open all day; the drawer is where
 * every call, document, payment and message on a lead is recorded.
 */

let pipeFilters = { q: "", stage: "", owner: "", course: "", source: "", band: "", flag: "" };
let pipeView = "board";   // "board" | "table"
let selectedLeads = new Set();

/* ---------------- filtering ---------------- */

function filteredLeads() {
  const f = pipeFilters;
  const q = f.q.trim().toLowerCase();
  return visibleLeads().filter(l => {
    if (q) {
      const hay = [l.name, l.phone, l.email, l.city, l.id, courseById(l.courseId).name].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.stage && l.stage !== f.stage) return false;
    if (f.owner && l.ownerId !== f.owner) return false;
    if (f.course && l.courseId !== f.course) return false;
    if (f.source && l.sourceId !== f.source) return false;
    if (f.band && scoreBand(scoreLead(l)) !== f.band) return false;
    if (f.flag === "sla" && !slaBreached(l)) return false;
    if (f.flag === "stalled" && !isStalled(l)) return false;
    if (f.flag === "overdue" && !hasOverdueTask(l)) return false;
    if (f.flag === "unassigned" && l.ownerId) return false;
    return true;
  });
}

function filterBar() {
  const f = pipeFilters;
  return `
    <div class="toolbar">
      <input class="search" id="pq" placeholder="Search name, phone, email, ID…" value="${esc(f.q)}">
      <select class="search" id="pOwner" style="min-width:150px">
        <option value="">All counsellors</option>
        ${cache.users.map(u => `<option value="${u.id}" ${f.owner === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}
      </select>
      <select class="search" id="pCourse" style="min-width:150px">
        <option value="">All programmes</option>
        ${cache.courses.map(c => `<option value="${c.id}" ${f.course === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
      </select>
      <select class="search" id="pSource" style="min-width:140px">
        <option value="">All sources</option>
        ${cache.sources.map(s => `<option value="${s.id}" ${f.source === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
      </select>
      <div class="spacer"></div>
      <div class="chip-row">
        <button class="chip ${f.band === "hot" ? "active" : ""}" data-band="hot">Hot</button>
        <button class="chip ${f.band === "warm" ? "active" : ""}" data-band="warm">Warm</button>
        <button class="chip ${f.flag === "sla" ? "active" : ""}" data-flag="sla">SLA breach</button>
        <button class="chip ${f.flag === "stalled" ? "active" : ""}" data-flag="stalled">Stalled</button>
        <button class="chip ${f.flag === "overdue" ? "active" : ""}" data-flag="overdue">Overdue task</button>
      </div>
      <button class="chip" id="pClear">Clear</button>
      <button class="btn sm" id="pToggle">${pipeView === "board" ? "☰ Table" : "▦ Board"}</button>
      <button class="btn brand" id="pNew">+ New enquiry</button>
    </div>`;
}

function bindFilterBar() {
  const q = $("#pq");
  if (q) {
    q.addEventListener("input", () => {
      pipeFilters.q = q.value;
      const pos = q.selectionStart;
      render();
      const nq = $("#pq");
      if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
    });
  }
  const bind = (sel, key) => {
    const el = $(sel);
    if (el) el.addEventListener("change", () => { pipeFilters[key] = el.value; render(); });
  };
  bind("#pOwner", "owner"); bind("#pCourse", "course"); bind("#pSource", "source");
  $$("[data-band]").forEach(b => b.addEventListener("click", () => {
    pipeFilters.band = pipeFilters.band === b.dataset.band ? "" : b.dataset.band; render();
  }));
  $$("[data-flag]").forEach(b => b.addEventListener("click", () => {
    pipeFilters.flag = pipeFilters.flag === b.dataset.flag ? "" : b.dataset.flag; render();
  }));
  const clear = $("#pClear");
  if (clear) clear.addEventListener("click", () => {
    pipeFilters = { q: "", stage: "", owner: "", course: "", source: "", band: "", flag: "" }; render();
  });
  const tog = $("#pToggle");
  if (tog) tog.addEventListener("click", () => { pipeView = pipeView === "board" ? "table" : "board"; render(); });
  const nw = $("#pNew");
  if (nw) nw.addEventListener("click", () => showLeadModal(null));
}

/* ---------------- pipeline view ---------------- */

function renderPipeline() {
  const leads = filteredLeads();
  $("#view").innerHTML = `
    <div class="toolbar" style="margin-bottom:6px">
      <div>
        <h2>Pipeline</h2>
        <div class="sub-note">${leads.length} of ${visibleLeads().length} leads${pipeView === "board" ? " · drag a card to move it between stages" : ""}</div>
      </div>
    </div>
    ${filterBar()}
    ${pipeView === "board" ? boardHtml(leads) : tableHtml(leads)}`;

  bindFilterBar();
  if (pipeView === "board") bindBoard(); else bindTable();
}

function leadCardHtml(l) {
  const overdue = hasOverdueTask(l);
  const breach = slaBreached(l);
  const t = openTasksFor(l.id).sort((a, b) => a.dueAt - b.dueAt)[0];
  return `<div class="lead-card ${overdue ? "overdue" : ""} ${breach ? "breach" : ""}" draggable="true" data-card="${l.id}">
    <div class="n">${esc(l.name)}</div>
    <div class="c">${esc(courseById(l.courseId).name)}<br>${esc(l.city)} · ${esc(sourceById(l.sourceId).name)}</div>
    <div class="r">
      ${scoreHtml(l)}
      ${breach ? '<span class="tag hot">SLA</span>' : ""}
      ${overdue ? '<span class="tag hot">Overdue</span>' : isStalled(l) ? '<span class="tag warm">Stalled</span>' : ""}
    </div>
    <div class="r">
      <span class="own">${esc(userById(l.ownerId).name)}</span>
      <div style="flex:1"></div>
      <span class="own">${t ? dueLabel(t.dueAt) : ago(l.lastActivityAt)}</span>
    </div>
  </div>`;
}

function boardHtml(leads) {
  return `<div class="board">${cache.stages.map(s => {
    const inStage = leads.filter(l => l.stage === s.id).sort((a, b) => scoreLead(b) - scoreLead(a));
    const value = inStage.reduce((sum, l) => sum + courseById(l.courseId).fee, 0);
    return `<div class="col" data-stage="${s.id}">
      <div class="col-head">
        <div class="t"><h4 style="color:var(--${s.color || "brand"})">${esc(s.name)}</h4><span class="c">${inStage.length}</span></div>
        <div class="v">${moneyShort(value)}${s.sla ? ` · ${s.sla}d SLA` : ""}</div>
      </div>
      <div class="col-body">
        ${inStage.map(leadCardHtml).join("") || `<div class="col-empty">Nothing here</div>`}
      </div>
    </div>`;
  }).join("")}</div>`;
}

function bindBoard() {
  let dragId = null;

  $$("[data-card]").forEach(card => {
    card.addEventListener("click", () => openLead(card.dataset.card));
    card.addEventListener("dragstart", e => {
      dragId = card.dataset.card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
    });
    card.addEventListener("dragend", () => { card.classList.remove("dragging"); dragId = null; });
  });

  $$(".col").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave", () => col.classList.remove("drop"));
    col.addEventListener("drop", async e => {
      e.preventDefault();
      col.classList.remove("drop");
      const id = dragId || e.dataTransfer.getData("text/plain");
      const to = col.dataset.stage;
      const lead = leadById(id);
      if (!lead || lead.stage === to) return;
      // moving to a lost stage must capture a reason — otherwise the loss
      // analysis in Reports is worthless
      if (stageById(to).kind === "lost") return showLostModal(id);
      if (stageById(to).kind === "won") return showEnrolModal(id);
      await moveStage(id, to);
      await refresh(); toast(`${lead.name} → ${stageById(to).name}`); render();
    });
  });
}

/* ---------------- table view ---------------- */

function tableHtml(leads) {
  const sorted = leads.slice().sort((a, b) => scoreLead(b) - scoreLead(a));
  return `
    ${selectedLeads.size ? `<div class="section" style="padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <b style="font-size:13.5px">${selectedLeads.size} selected</b>
      <div class="spacer" style="flex:1"></div>
      <button class="btn sm" id="bulkAssign">Reassign</button>
      <button class="btn sm" id="bulkStage">Move stage</button>
      <button class="btn sm" id="bulkTask">Schedule follow-up</button>
      <button class="btn sm ghost" id="bulkClear">Clear</button>
    </div>` : ""}
    <div class="section"><div class="tbl-wrap"><table>
      <thead><tr>
        <th style="width:28px"><input type="checkbox" id="selAll" style="width:auto"></th>
        <th>Lead</th><th>Programme</th><th>Stage</th><th>Score</th>
        <th>Counsellor</th><th>Source</th><th>Last touch</th><th>Next</th><th></th>
      </tr></thead>
      <tbody>${sorted.map(l => {
        const t = openTasksFor(l.id).sort((a, b) => a.dueAt - b.dueAt)[0];
        return `<tr class="row-link" data-row="${l.id}">
          <td><input type="checkbox" class="selBox" data-sel="${l.id}" style="width:auto" ${selectedLeads.has(l.id) ? "checked" : ""}></td>
          <td><b>${esc(l.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(l.city)} · ${esc(l.phone)}</div></td>
          <td style="font-size:12.5px">${esc(courseById(l.courseId).name)}</td>
          <td><span class="badge s-${l.stage}">${esc(stageById(l.stage).name)}</span></td>
          <td>${scoreHtml(l)}</td>
          <td style="font-size:12.5px">${esc(userById(l.ownerId).name)}</td>
          <td style="font-size:12.5px;color:var(--muted)">${esc(sourceById(l.sourceId).name)}</td>
          <td style="font-size:12.5px;color:var(--muted)">${ago(l.lastActivityAt)}</td>
          <td style="font-size:12px">${t ? `<span style="color:${t.dueAt < startOfToday() ? "var(--red)" : "var(--muted)"}">${dueLabel(t.dueAt)}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
          <td style="white-space:nowrap"><button class="btn xs" data-open="${l.id}">Open</button></td>
        </tr>`;
      }).join("") || `<tr><td colspan="10"><div class="empty">No leads match these filters.</div></td></tr>`}
      </tbody></table></div></div>`;
}

function bindTable() {
  $$("[data-row]").forEach(r => r.addEventListener("click", e => {
    if (e.target.closest("input,button")) return;
    openLead(r.dataset.row);
  }));
  $$("[data-open]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); openLead(b.dataset.open); }));
  $$(".selBox").forEach(b => b.addEventListener("change", () => {
    if (b.checked) selectedLeads.add(b.dataset.sel); else selectedLeads.delete(b.dataset.sel);
    render();
  }));
  const all = $("#selAll");
  if (all) all.addEventListener("change", () => {
    if (all.checked) filteredLeads().forEach(l => selectedLeads.add(l.id));
    else selectedLeads.clear();
    render();
  });
  const clear = $("#bulkClear");
  if (clear) clear.addEventListener("click", () => { selectedLeads.clear(); render(); });
  const ba = $("#bulkAssign"); if (ba) ba.addEventListener("click", showBulkAssign);
  const bs = $("#bulkStage"); if (bs) bs.addEventListener("click", showBulkStage);
  const bt = $("#bulkTask"); if (bt) bt.addEventListener("click", showBulkTask);
}

function showBulkAssign() {
  openModal(`
    <h3>Reassign ${selectedLeads.size} lead${selectedLeads.size > 1 ? "s" : ""}</h3>
    <div class="sub">Transfer ownership — useful when a counsellor leaves mid-season.</div>
    <label>New counsellor</label>
    <select id="bOwner">${cache.users.map(u => `<option value="${u.id}">${esc(u.name)} — ${esc(u.role)}</option>`).join("")}</select>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="bGo">Reassign</button></div>`);
  $("#bGo").addEventListener("click", async () => {
    const owner = $("#bOwner").value;
    for (const id of selectedLeads) {
      const l = leadById(id);
      if (!l) continue;
      l.ownerId = owner;
      await Store.put("leads", l);
      await logActivity(id, "note", "Reassigned to " + userById(owner).name);
    }
    await addLog(`${selectedLeads.size} leads reassigned to ${userById(owner).name}.`);
    selectedLeads.clear();
    await refresh(); closeModal(); toast("Leads reassigned"); render();
  });
}

function showBulkStage() {
  openModal(`
    <h3>Move ${selectedLeads.size} lead${selectedLeads.size > 1 ? "s" : ""}</h3>
    <div class="sub">Bulk-advance the pipeline — e.g. everyone who attended an open day.</div>
    <label>Move to stage</label>
    <select id="bStage">${cache.stages.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="bGo">Move</button></div>`);
  $("#bGo").addEventListener("click", async () => {
    const st = $("#bStage").value;
    for (const id of selectedLeads) await moveStage(id, st, "Bulk update");
    selectedLeads.clear();
    await refresh(); closeModal(); toast("Leads moved"); render();
  });
}

function showBulkTask() {
  openModal(`
    <h3>Schedule follow-up for ${selectedLeads.size} lead${selectedLeads.size > 1 ? "s" : ""}</h3>
    <div class="sub">Creates one task per lead, assigned to that lead's counsellor.</div>
    <label>Task</label><input id="bTitle" value="Follow-up call" >
    <label>Due date</label><input id="bDue" type="date" value="${todayStr()}">
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="bGo">Schedule</button></div>`);
  $("#bGo").addEventListener("click", async () => {
    const title = $("#bTitle").value.trim() || "Follow-up call";
    const due = new Date($("#bDue").value + "T09:00:00").getTime();
    for (const id of selectedLeads) {
      const l = leadById(id);
      if (!l) continue;
      await Store.put("tasks", {
        id: await Store.nextId("TSK"), leadId: id, userId: l.ownerId,
        title, dueAt: due, done: false, createdAt: Date.now()
      });
    }
    await addLog(`Follow-up "${title}" scheduled for ${selectedLeads.size} leads.`);
    selectedLeads.clear();
    await refresh(); closeModal(); toast("Follow-ups scheduled"); render();
  });
}

/* ---------------- create / edit lead ---------------- */

function showLeadModal(id) {
  const l = id ? leadById(id) : null;
  openModal(`
    <h3>${l ? "Edit enquiry" : "New enquiry"}</h3>
    <div class="sub">${l ? esc(l.id) + " · added " + fmtDate(l.createdAt) : "Capture a walk-in or phone enquiry. Duplicates are checked on phone and email."}</div>
    <div class="row2">
      <div><label>Student name *</label><input id="lName" value="${esc(l ? l.name : "")}"></div>
      <div><label>City</label><input id="lCity" value="${esc(l ? l.city : "")}"></div>
    </div>
    <div class="row2">
      <div><label>Phone *</label><input id="lPhone" inputmode="tel" value="${esc(l ? l.phone : "")}"></div>
      <div><label>Email</label><input id="lEmail" type="email" value="${esc(l ? l.email : "")}"></div>
    </div>
    <div class="row2">
      <div><label>Parent / guardian</label><input id="lGName" value="${esc(l ? l.guardianName : "")}"></div>
      <div><label>Guardian phone</label><input id="lGPhone" inputmode="tel" value="${esc(l ? l.guardianPhone : "")}"></div>
    </div>
    <div class="row2">
      <div><label>Programme *</label><select id="lCourse">${cache.courses.map(c => `<option value="${c.id}" ${l && l.courseId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div><label>Source</label><select id="lSource">${cache.sources.map(s => `<option value="${s.id}" ${l && l.sourceId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
    </div>
    <div class="row2">
      <div><label>Counsellor</label><select id="lOwner"><option value="">Auto-assign</option>${cache.users.map(u => `<option value="${u.id}" ${l && l.ownerId === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>
      <div><label>Class 12 / qualifying %</label><input id="lMarks" type="number" min="0" max="100" value="${l && l.marks12 ? l.marks12 : ""}"></div>
    </div>
    <label>Previous school / college</label><input id="lSchool" value="${esc(l ? l.prevSchool : "")}">
    <label>Notes</label><textarea id="lNotes" placeholder="What did they ask about?">${esc(l ? l.notes : "")}</textarea>
    <div id="dupWarn"></div>
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn brand" id="lSave">${l ? "Save changes" : "Create enquiry"}</button>
    </div>`);

  const checkDup = () => {
    const d = findDuplicate($("#lPhone").value, $("#lEmail").value, id);
    $("#dupWarn").innerHTML = d
      ? `<div class="warn-box"><b>Possible duplicate:</b> ${esc(d.name)} (${esc(d.id)}) — ${esc(courseById(d.courseId).name)}, ${esc(stageById(d.stage).name)}, owned by ${esc(userById(d.ownerId).name)}. Saving will create a second record.</div>`
      : "";
  };
  $("#lPhone").addEventListener("blur", checkDup);
  $("#lEmail").addEventListener("blur", checkDup);

  $("#lSave").addEventListener("click", async () => {
    const name = $("#lName").value.trim();
    if (!name) { $("#lName").focus(); return; }
    const phone = $("#lPhone").value.trim();
    if (!phone) { $("#lPhone").focus(); return; }

    let doc = l;
    const creating = !doc;
    if (creating) {
      doc = {
        id: await Store.nextId("LD"), createdAt: Date.now(), lastActivityAt: Date.now(),
        stage: cache.stages[0].id, docs: {}, tags: [], firstResponseMins: null,
        enrolledAt: null, lostReason: null
      };
    }
    const chosenOwner = $("#lOwner").value;
    Object.assign(doc, {
      name, phone,
      email: $("#lEmail").value.trim(),
      city: $("#lCity").value.trim(),
      guardianName: $("#lGName").value.trim(),
      guardianPhone: $("#lGPhone").value.trim(),
      courseId: $("#lCourse").value,
      sourceId: $("#lSource").value,
      ownerId: chosenOwner || doc.ownerId || await pickOwner($("#lCourse").value),
      marks12: Number($("#lMarks").value) || 0,
      prevSchool: $("#lSchool").value.trim(),
      notes: $("#lNotes").value.trim()
    });
    await Store.put("leads", doc);
    await addLog(`${creating ? "New enquiry" : "Enquiry updated"}: ${name} (${doc.id}) — ${courseById(doc.courseId).name}.`);
    await refresh();
    if (creating) await logActivity(doc.id, "note", "Enquiry captured via " + sourceById(doc.sourceId).name);
    await refresh();
    closeModal();
    toast(creating ? `${name} added — assigned to ${userById(doc.ownerId).name}` : `${name} saved`);
    render();
    if (creating) openLead(doc.id);
  });
  $("#lName").focus();
}

/* ---------------- stage-change modals ---------------- */

function showLostModal(id) {
  const l = leadById(id);
  openModal(`
    <h3>Mark ${esc(l.name)} as lost</h3>
    <div class="sub">Loss reasons drive the drop-off analysis in Reports — this is the field that tells you whether you have a pricing problem or a follow-up problem.</div>
    <label>Reason</label>
    <select id="lostR">${LOST_REASONS.map(r => `<option>${esc(r)}</option>`).join("")}<option>Other</option></select>
    <label>Detail (optional)</label><textarea id="lostD" placeholder="Which college did they pick? What was the deciding factor?"></textarea>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn danger" id="lostGo">Mark lost</button></div>`);
  $("#lostGo").addEventListener("click", async () => {
    const reason = $("#lostR").value;
    const detail = $("#lostD").value.trim();
    await moveStage(id, lostStageId(), reason + (detail ? " — " + detail : ""));
    const lead = leadById(id);
    lead.lostReason = reason;
    await Store.put("leads", lead);
    // close any open follow-ups; chasing a lost lead wastes counsellor hours
    for (const t of openTasksFor(id)) { t.done = true; t.doneAt = Date.now(); await Store.put("tasks", t); }
    await refresh(); closeModal(); toast(`${lead.name} marked lost`);
    if (openLeadId === id) paintLead();
    render();
  });
}

function showEnrolModal(id) {
  const l = leadById(id);
  const c = courseById(l.courseId);
  const paid = paymentsFor(id).filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const missing = (c.docs || []).filter(d => !(l.docs || {})[d] || !l.docs[d].verified);
  openModal(`
    <h3>Confirm enrolment — ${esc(l.name)}</h3>
    <div class="sub">${esc(c.name)} · ${esc(c.intake || "")}</div>
    ${missing.length ? `<div class="warn-box"><b>${missing.length} document${missing.length > 1 ? "s" : ""} not yet verified:</b> ${esc(missing.join(", "))}. You can still enrol, but the file will be incomplete.</div>` : `<div class="ok-box">All documents verified.</div>`}
    <div class="kv" style="margin-top:16px">
      <dt>Programme fee</dt><dd>${money(c.fee)}</dd>
      <dt>Collected</dt><dd>${money(paid)}</dd>
      <dt>Outstanding</dt><dd style="color:${c.fee - paid > 0 ? "var(--amber)" : "var(--green)"}">${money(Math.max(0, c.fee - paid))}</dd>
      <dt>Seats left</dt><dd>${seatsLeft(c.id)} of ${c.seats}</dd>
    </div>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn green" id="enrolGo">Confirm enrolment</button></div>`);
  $("#enrolGo").addEventListener("click", async () => {
    await moveStage(id, wonStageId(), "Seat confirmed");
    for (const t of openTasksFor(id)) { t.done = true; t.doneAt = Date.now(); await Store.put("tasks", t); }
    await refresh(); closeModal(); toast(`🎉 ${l.name} enrolled in ${c.name}`);
    if (openLeadId === id) paintLead();
    render();
  });
}

function seatsLeft(courseId) {
  const c = courseById(courseId);
  const taken = cache.leads.filter(l => l.courseId === courseId && isWon(l)).length;
  return Math.max(0, (c.seats || 0) - taken);
}

/* ---------------- lead 360 drawer ---------------- */

let openLeadId = null;
let leadTab = "timeline";

function closeLead() {
  const b = $("#drawerBack"), d = $("#drawer");
  if (b) b.remove();
  if (d) d.remove();
  openLeadId = null;
}

function openLead(id, tab) {
  openLeadId = id;
  leadTab = tab || "timeline";
  paintLead();
}

function paintLead() {
  const l = leadById(openLeadId);
  if (!l) return closeLead();
  closeLead();
  openLeadId = l.id;

  const c = courseById(l.courseId);
  const owner = userById(l.ownerId);
  const score = scoreLead(l);

  const back = document.createElement("div");
  back.className = "drawer-back"; back.id = "drawerBack";
  back.addEventListener("click", closeLead);

  const d = document.createElement("aside");
  d.className = "drawer"; d.id = "drawer";
  d.innerHTML = `
    <div class="drawer-head">
      <div class="top">
        <div style="flex:1;min-width:0">
          <h3>${esc(l.name)}</h3>
          <div class="meta">
            ${esc(c.name)} · ${esc(c.intake || "")}<br>
            ${esc(l.city)} · ${esc(l.phone)}${l.email ? " · " + esc(l.email) : ""}<br>
            <span class="mono" style="font-size:11.5px">${esc(l.id)}</span> · ${esc(sourceById(l.sourceId).name)} · added ${fmtDate(l.createdAt)}
          </div>
        </div>
        <button class="btn ghost" id="dClose" style="font-size:20px;line-height:1;padding:4px 10px">×</button>
      </div>
      <div class="row">
        <span class="badge s-${l.stage}">${esc(stageById(l.stage).name)}</span>
        ${scoreHtml(l)}
        ${slaBreached(l) ? '<span class="tag hot">SLA breach</span>' : ""}
        ${isStalled(l) ? '<span class="tag warm">Stalled</span>' : ""}
        ${(l.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}
        <div style="flex:1"></div>
        <span style="font-size:12px;color:var(--muted)">${esc(owner.name)}</span>
      </div>
      <div class="row">
        <a class="btn sm" href="tel:${encodeURIComponent(l.phone)}" id="aCall">📞 Call</a>
        <a class="btn sm" href="https://wa.me/91${encodeURIComponent(String(l.phone).replace(/\D/g, "").slice(-10))}" target="_blank" rel="noopener" id="aWa">💬 WhatsApp</a>
        <button class="btn sm" id="aMsg">✉ Send template</button>
        <button class="btn sm" id="aTask">＋ Follow-up</button>
        <div style="flex:1"></div>
        <button class="btn sm" id="aEdit">Edit</button>
        <button class="btn sm brand" id="aStage">Move stage</button>
      </div>
      <div class="drawer-tabs">
        ${["timeline", "details", "documents", "payments"].map(t =>
          `<button data-dtab="${t}" class="${leadTab === t ? "active" : ""}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
      </div>
    </div>
    <div class="drawer-body" id="drawerBody">${leadTabHtml(l)}</div>`;

  document.body.appendChild(back);
  document.body.appendChild(d);

  $("#dClose").addEventListener("click", closeLead);
  $$("[data-dtab]", d).forEach(b => b.addEventListener("click", () => { leadTab = b.dataset.dtab; paintLead(); }));
  $("#aEdit").addEventListener("click", () => showLeadModal(l.id));
  $("#aTask").addEventListener("click", () => showTaskModal(l.id));
  $("#aMsg").addEventListener("click", () => showMessageModal(l.id));
  $("#aStage").addEventListener("click", () => showStageModal(l.id));
  $("#aCall").addEventListener("click", () => setTimeout(() => showCallModal(l.id), 350));
  $("#aWa").addEventListener("click", () => setTimeout(() => logQuick(l.id, "whatsapp", "WhatsApp opened from CRM"), 400));

  bindLeadTab(l);
}

function leadTabHtml(l) {
  if (leadTab === "details") return detailsHtml(l);
  if (leadTab === "documents") return documentsHtml(l);
  if (leadTab === "payments") return paymentsHtml(l);
  return timelineHtml(l);
}

function bindLeadTab(l) {
  if (leadTab === "timeline") {
    $$("[data-logtype]").forEach(b => b.addEventListener("click", () => {
      const t = b.dataset.logtype;
      if (t === "call") showCallModal(l.id); else showNoteModal(l.id, t);
    }));
  }
  if (leadTab === "documents") {
    $$("[data-doc]").forEach(b => b.addEventListener("click", () => cycleDoc(l.id, b.dataset.doc)));
  }
  if (leadTab === "payments") {
    const b = $("#payAdd");
    if (b) b.addEventListener("click", () => showPaymentModal(l.id));
    $$("[data-paid]").forEach(x => x.addEventListener("click", () => markPaid(x.dataset.paid)));
  }
  const tk = $$("[data-tdone]");
  tk.forEach(b => b.addEventListener("click", async () => {
    const t = cache.tasks.find(x => x.id === b.dataset.tdone);
    if (!t) return;
    t.done = true; t.doneAt = Date.now();
    await Store.put("tasks", t);
    await logActivity(t.leadId, "note", "Follow-up completed: " + t.title);
    await refresh(); toast("Follow-up closed"); paintLead(); render();
  }));
}

const ACT_ICON = { call: "📞", whatsapp: "💬", email: "✉", visit: "🏫", note: "📝", stage: "→", payment: "₹" };
const ACT_LABEL = { call: "Call", whatsapp: "WhatsApp", email: "Email", visit: "Campus visit", note: "Note", stage: "Stage change", payment: "Payment" };

function timelineHtml(l) {
  const acts = activitiesFor(l.id);
  const tasks = openTasksFor(l.id).sort((a, b) => a.dueAt - b.dueAt);
  const pays = paymentsFor(l.id).filter(p => p.status === "paid")
    .map(p => ({ id: p.id, type: "payment", ts: p.at, note: `${p.type} — ${money(p.amount)} via ${p.mode}`, userId: null, receipt: p.receiptNo }));
  const items = [...acts, ...pays].sort((a, b) => b.ts - a.ts);

  return `
    <div class="chip-row" style="margin-bottom:16px">
      <button class="chip" data-logtype="call">📞 Log call</button>
      <button class="chip" data-logtype="whatsapp">💬 Log WhatsApp</button>
      <button class="chip" data-logtype="email">✉ Log email</button>
      <button class="chip" data-logtype="visit">🏫 Log campus visit</button>
      <button class="chip" data-logtype="note">📝 Add note</button>
    </div>

    ${tasks.length ? `<div class="section" style="padding:14px 16px">
      <h3 style="font-size:14px;margin-bottom:10px">Open follow-ups</h3>
      ${tasks.map(t => `<div class="task-row ${t.dueAt < startOfToday() ? "overdue" : ""}" style="margin-bottom:6px;box-shadow:none">
        <button class="tick" data-tdone="${t.id}" title="Mark done"></button>
        <div class="who"><b>${esc(t.title)}</b><div>${esc(userById(t.userId).name)}</div></div>
        <div class="due ${t.dueAt < startOfToday() ? "late" : ""}">${dueLabel(t.dueAt)}</div>
      </div>`).join("")}
    </div>` : ""}

    <div class="section">
      <h3 style="font-size:14px">Activity — ${items.length} record${items.length === 1 ? "" : "s"}</h3>
      <div class="sub-note">Everything anyone has done on this lead, newest first.</div>
      <div class="timeline">
        ${items.map(a => `
          <div class="tl-item ${a.type}">
            <div class="h">
              <b>${ACT_ICON[a.type] || "•"} ${ACT_LABEL[a.type] || a.type}</b>
              <span class="t">${fmtDateTime(a.ts)}</span>
              ${a.userId ? `<span class="t">· ${esc(userById(a.userId).name)}</span>` : ""}
              ${a.durationSec ? `<span class="t">· ${Math.floor(a.durationSec / 60)}m ${a.durationSec % 60}s</span>` : ""}
            </div>
            ${a.note ? `<div class="b">${esc(a.note)}</div>` : ""}
            ${a.outcome ? `<div class="o">Outcome: ${esc(a.outcome)}</div>` : ""}
            ${a.receipt ? `<div class="o">Receipt ${esc(a.receipt)}</div>` : ""}
          </div>`).join("") || `<div class="empty">Nothing logged yet.</div>`}
      </div>
    </div>`;
}

function detailsHtml(l) {
  const c = courseById(l.courseId);
  return `<div class="section">
    <h3 style="font-size:14px">Student record</h3>
    <dl class="kv" style="margin-top:12px">
      <dt>Student</dt><dd>${esc(l.name)}</dd>
      <dt>Phone</dt><dd>${esc(l.phone)}</dd>
      <dt>Email</dt><dd>${esc(l.email) || "—"}</dd>
      <dt>City</dt><dd>${esc(l.city) || "—"}</dd>
      <dt>Guardian</dt><dd>${esc(l.guardianName) || "—"}${l.guardianPhone ? " · " + esc(l.guardianPhone) : ""}</dd>
      <dt>Previous school</dt><dd>${esc(l.prevSchool) || "—"}</dd>
      <dt>Qualifying %</dt><dd>${l.marks12 ? l.marks12 + "%" : "—"}</dd>
      <dt>Programme</dt><dd>${esc(c.name)} · ${money(c.fee)}</dd>
      <dt>Intake</dt><dd>${esc(c.intake) || "—"} · ${seatsLeft(c.id)} of ${c.seats} seats left</dd>
      <dt>Source</dt><dd>${esc(sourceById(l.sourceId).name)}</dd>
      <dt>Counsellor</dt><dd>${esc(userById(l.ownerId).name)}</dd>
      <dt>Stage</dt><dd>${esc(stageById(l.stage).name)}</dd>
      <dt>Lead score</dt><dd>${scoreLead(l)} / 100 · ${scoreBand(scoreLead(l))}</dd>
      <dt>First response</dt><dd>${l.firstResponseMins != null ? l.firstResponseMins + " min" : '<span style="color:var(--red)">not yet contacted</span>'}</dd>
      <dt>Created</dt><dd>${fmtDateTime(l.createdAt)}</dd>
      <dt>Last activity</dt><dd>${fmtDateTime(l.lastActivityAt)} (${ago(l.lastActivityAt)})</dd>
      ${l.enrolledAt ? `<dt>Enrolled</dt><dd>${fmtDateTime(l.enrolledAt)}</dd>` : ""}
      ${l.lostReason ? `<dt>Lost reason</dt><dd style="color:var(--red)">${esc(l.lostReason)}</dd>` : ""}
    </dl>
    ${l.notes ? `<div style="margin-top:16px"><div class="set-label">Notes</div><div class="preview">${esc(l.notes)}</div></div>` : ""}
  </div>`;
}

function documentsHtml(l) {
  const c = courseById(l.courseId);
  const docs = c.docs || [];
  const state = l.docs || {};
  const recv = docs.filter(d => state[d] && state[d].received).length;
  const ver = docs.filter(d => state[d] && state[d].verified).length;
  const pct = docs.length ? Math.round((ver / docs.length) * 100) : 0;

  return `<div class="section">
    <h3 style="font-size:14px">Document checklist — ${esc(c.name)}</h3>
    <div class="sub-note">Click a row to cycle: missing → received → verified.</div>
    <div style="margin:14px 0 6px"><div class="bar ${pct === 100 ? "green" : pct >= 50 ? "amber" : "red"}"><b style="width:${pct}%"></b></div></div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${ver} verified · ${recv - ver} received, pending check · ${docs.length - recv} missing</div>
    ${docs.map(dn => {
      const s = state[dn] || {};
      const cls = s.verified ? "ver" : s.received ? "recv" : "";
      const mark = s.verified ? "✓" : s.received ? "•" : "";
      return `<div class="doc-row">
        <button class="doc-state ${cls}" data-doc="${esc(dn)}" title="Cycle state">${mark}</button>
        <div class="nm">${esc(dn)}</div>
        <div style="font-size:11.5px;color:var(--muted)">${s.verified ? "Verified" : s.received ? "Received " + fmtDate(s.at) : "Not received"}</div>
      </div>`;
    }).join("") || `<div class="empty">No checklist configured for this programme.</div>`}
  </div>`;
}

async function cycleDoc(leadId, docName) {
  const l = leadById(leadId);
  if (!l) return;
  l.docs = l.docs || {};
  const s = l.docs[docName];
  let msg;
  if (!s || !s.received) { l.docs[docName] = { received: true, verified: false, at: Date.now() }; msg = "received"; }
  else if (!s.verified) { l.docs[docName] = { ...s, verified: true, verifiedAt: Date.now() }; msg = "verified"; }
  else { delete l.docs[docName]; msg = "cleared"; }
  l.lastActivityAt = Date.now();
  await Store.put("leads", l);
  await logActivity(leadId, "note", `Document "${docName}" marked ${msg}.`);
  await refresh();
  toast(`${docName} ${msg}`);
  paintLead();
}

function paymentsHtml(l) {
  const c = courseById(l.courseId);
  const pays = paymentsFor(l.id).sort((a, b) => (b.at || b.dueAt || 0) - (a.at || a.dueAt || 0));
  const paid = pays.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pending = pays.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0);
  const pct = c.fee ? Math.min(100, Math.round((paid / c.fee) * 100)) : 0;

  return `<div class="section">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <h3 style="font-size:14px;flex:1">Fees</h3>
      <button class="btn sm brand" id="payAdd">+ Record payment</button>
    </div>
    <div class="sub-note">${esc(c.name)} · total programme fee ${money(c.fee)}</div>
    <div style="margin:14px 0 6px"><div class="bar ${pct === 100 ? "green" : "amber"}"><b style="width:${pct}%"></b></div></div>
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:14px">
      ${money(paid)} collected (${pct}%) · ${money(Math.max(0, c.fee - paid))} outstanding${pending ? " · " + money(pending) + " awaiting payment" : ""}
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Instalment</th><th class="num">Amount</th><th>Mode</th><th>Status</th><th>Date</th><th>Receipt</th><th></th></tr></thead>
      <tbody>${pays.map(p => `
        <tr>
          <td>${esc(p.type)}</td>
          <td class="num">${money(p.amount)}</td>
          <td style="font-size:12.5px">${esc(p.mode || "—")}</td>
          <td><span class="badge ${p.status === "paid" ? "s-enrolled" : "s-fee"}">${esc(p.status)}</span></td>
          <td style="font-size:12.5px;color:var(--muted)">${p.at ? fmtDate(p.at) : p.dueAt ? "due " + fmtDate(p.dueAt) : "—"}</td>
          <td class="mono" style="font-size:11.5px">${esc(p.receiptNo) || "—"}</td>
          <td>${p.status !== "paid" ? `<button class="btn xs green" data-paid="${p.id}">Mark paid</button>` : ""}</td>
        </tr>`).join("") || `<tr><td colspan="7"><div class="empty">No payments recorded.</div></td></tr>`}
      </tbody></table></div>
  </div>`;
}

function showPaymentModal(leadId) {
  const l = leadById(leadId);
  const c = courseById(l.courseId);
  openModal(`
    <h3>Record payment — ${esc(l.name)}</h3>
    <div class="sub">${esc(c.name)} · programme fee ${money(c.fee)}</div>
    <div class="row2">
      <div><label>Instalment</label><select id="pType">
        <option>Application Fee</option><option>Registration Fee</option>
        <option>Tuition — Instalment 1</option><option>Tuition — Instalment 2</option>
        <option>Hostel Fee</option><option>Exam Fee</option><option>Other</option></select></div>
      <div><label>Amount</label><input id="pAmt" type="number" min="0" value="25000"></div>
    </div>
    <div class="row2">
      <div><label>Mode</label><select id="pMode"><option>UPI</option><option>NEFT</option><option>Card</option><option>Cash</option><option>Cheque</option><option>Education Loan</option></select></div>
      <div><label>Status</label><select id="pStat"><option value="paid">Paid</option><option value="pending">Pending</option></select></div>
    </div>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="pGo">Record</button></div>`);
  $("#pGo").addEventListener("click", async () => {
    const status = $("#pStat").value;
    const amount = Number($("#pAmt").value) || 0;
    const type = $("#pType").value;
    const seq = (await Store.getMeta("seq.RCP")) || 4200;
    const doc = {
      id: await Store.nextId("PAY"), leadId, type, amount,
      mode: $("#pMode").value, status,
      at: status === "paid" ? Date.now() : null,
      dueAt: status === "paid" ? null : Date.now() + 7 * DAYMS,
      receiptNo: status === "paid" ? "RCP" + (seq + 1) : null
    };
    if (status === "paid") await Store.setMeta("seq.RCP", seq + 1);
    await Store.put("payments", doc);
    await logActivity(leadId, "note", `${type} ${status === "paid" ? "received" : "raised"}: ${money(amount)}`);
    await addLog(`${type} ${status} — ${money(amount)} for ${l.name} (${l.id}).`);
    await refresh(); closeModal(); toast("Payment recorded"); paintLead(); render();
  });
}

async function markPaid(payId) {
  const p = cache.payments.find(x => x.id === payId);
  if (!p) return;
  const seq = (await Store.getMeta("seq.RCP")) || 4200;
  p.status = "paid"; p.at = Date.now(); p.receiptNo = "RCP" + (seq + 1);
  await Store.setMeta("seq.RCP", seq + 1);
  await Store.put("payments", p);
  await logActivity(p.leadId, "note", `${p.type} received: ${money(p.amount)} · receipt ${p.receiptNo}`);
  await refresh(); toast("Marked paid — receipt " + p.receiptNo); paintLead(); render();
}

/* ---------------- activity capture modals ---------------- */

function showCallModal(leadId) {
  const l = leadById(leadId);
  openModal(`
    <h3>Log call — ${esc(l.name)}</h3>
    <div class="sub">${esc(l.phone)} · logging a call closes the response-time SLA on this lead.</div>
    <label>Outcome</label>
    <select id="cOut">${CALL_OUTCOMES.map(o => `<option>${esc(o)}</option>`).join("")}</select>
    <div class="row2">
      <div><label>Duration (minutes)</label><input id="cDur" type="number" min="0" value="3"></div>
      <div><label>Next follow-up</label><input id="cNext" type="date" value="${new Date(Date.now() + 2 * DAYMS).toISOString().slice(0, 10)}"></div>
    </div>
    <label>Notes</label><textarea id="cNote" placeholder="What was discussed? Any objection?"></textarea>
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn brand" id="cGo">Save call</button>
    </div>`);
  $("#cGo").addEventListener("click", async () => {
    await logActivity(leadId, "call", $("#cNote").value.trim(), {
      outcome: $("#cOut").value, durationSec: Math.round((Number($("#cDur").value) || 0) * 60)
    });
    const next = $("#cNext").value;
    if (next) {
      await Store.put("tasks", {
        id: await Store.nextId("TSK"), leadId, userId: l.ownerId,
        title: "Follow-up call", dueAt: new Date(next + "T09:00:00").getTime(),
        done: false, createdAt: Date.now()
      });
    }
    await refresh(); closeModal(); toast("Call logged"); paintLead(); render();
  });
}

function showNoteModal(leadId, type) {
  const l = leadById(leadId);
  openModal(`
    <h3>${ACT_LABEL[type] || "Note"} — ${esc(l.name)}</h3>
    <div class="sub">Recorded on the lead's timeline and visible to everyone on the team.</div>
    <label>Detail</label><textarea id="nBody" placeholder="What happened?"></textarea>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="nGo">Save</button></div>`);
  $("#nGo").addEventListener("click", async () => {
    const body = $("#nBody").value.trim();
    if (!body) { $("#nBody").focus(); return; }
    await logActivity(leadId, type, body);
    await refresh(); closeModal(); toast(ACT_LABEL[type] + " logged"); paintLead(); render();
  });
  $("#nBody").focus();
}

async function logQuick(leadId, type, note) {
  await logActivity(leadId, type, note);
  await refresh();
  if (openLeadId === leadId) paintLead();
  render();
}

function showTaskModal(leadId) {
  const l = leadById(leadId);
  openModal(`
    <h3>Schedule follow-up — ${esc(l.name)}</h3>
    <div class="sub">Appears in My Day for the assigned counsellor.</div>
    <label>Task</label><input id="tTitle" value="Follow-up call">
    <div class="row2">
      <div><label>Due</label><input id="tDue" type="date" value="${new Date(Date.now() + DAYMS).toISOString().slice(0, 10)}"></div>
      <div><label>Assign to</label><select id="tWho">${cache.users.map(u => `<option value="${u.id}" ${u.id === l.ownerId ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>
    </div>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="tGo">Schedule</button></div>`);
  $("#tGo").addEventListener("click", async () => {
    await Store.put("tasks", {
      id: await Store.nextId("TSK"), leadId, userId: $("#tWho").value,
      title: $("#tTitle").value.trim() || "Follow-up", dueAt: new Date($("#tDue").value + "T09:00:00").getTime(),
      done: false, createdAt: Date.now()
    });
    await refresh(); closeModal(); toast("Follow-up scheduled"); paintLead(); render();
  });
}

function showStageModal(leadId) {
  const l = leadById(leadId);
  openModal(`
    <h3>Move ${esc(l.name)}</h3>
    <div class="sub">Currently in <b>${esc(stageById(l.stage).name)}</b>.</div>
    <div class="pickers" style="margin-top:14px">
      ${cache.stages.map(s => `<label class="${s.id === l.stage ? "sel" : ""}" data-st="${s.id}">
        <span style="width:9px;height:9px;border-radius:50%;background:var(--${s.color || "brand"});display:inline-block"></span>
        ${esc(s.name)}</label>`).join("")}
    </div>
    <div class="actions"><button class="btn" data-close>Cancel</button></div>`);
  $$("[data-st]").forEach(b => b.addEventListener("click", async () => {
    const to = b.dataset.st;
    closeModal();
    if (to === l.stage) return;
    if (stageById(to).kind === "lost") return showLostModal(leadId);
    if (stageById(to).kind === "won") return showEnrolModal(leadId);
    await moveStage(leadId, to);
    await refresh(); toast(`Moved to ${stageById(to).name}`); paintLead(); render();
  }));
}

/* ---------------- template messaging ----------------
 * The CRM cannot actually send email or WhatsApp — it composes the message,
 * hands it to the channel the counsellor already uses, and logs that it went
 * out. Honest, and it still removes the retyping.
 */

function showMessageModal(leadId) {
  const l = leadById(leadId);
  const tpls = cache.templates;
  if (!tpls.length) { toast("No templates yet — add them under Outreach"); return; }
  const first = tpls[0];
  openModal(`
    <h3>Send to ${esc(l.name)}</h3>
    <div class="sub">Merge fields are filled from this lead's record. Sending opens your own WhatsApp or mail client, then logs the message here.</div>
    <label>Template</label>
    <select id="mTpl">${tpls.map(t => `<option value="${t.id}">${esc(t.name)} — ${t.channel}</option>`).join("")}</select>
    <label>Preview</label>
    <div class="preview" id="mPrev"></div>
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn" id="mCopy">Copy text</button>
      <button class="btn brand" id="mSend">Open &amp; log</button>
    </div>`, true);

  const paint = () => {
    const t = cache.templates.find(x => x.id === $("#mTpl").value) || first;
    const body = applyTemplate(t.body, l);
    $("#mPrev").textContent = (t.subject ? "Subject: " + applyTemplate(t.subject, l) + "\n\n" : "") + body;
  };
  $("#mTpl").addEventListener("change", paint);
  paint();

  $("#mCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#mPrev").textContent); toast("Copied to clipboard"); }
    catch (e) { toast("Copy failed — select the text manually"); }
  });

  $("#mSend").addEventListener("click", async () => {
    const t = cache.templates.find(x => x.id === $("#mTpl").value) || first;
    const body = applyTemplate(t.body, l);
    const phone = String(l.phone).replace(/\D/g, "").slice(-10);
    if (t.channel === "whatsapp") {
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(body)}`, "_blank");
    } else if (t.channel === "email") {
      window.open(`mailto:${encodeURIComponent(l.email || "")}?subject=${encodeURIComponent(applyTemplate(t.subject, l))}&body=${encodeURIComponent(body)}`);
    } else {
      window.open(`sms:${phone}?body=${encodeURIComponent(body)}`);
    }
    await logActivity(leadId, t.channel === "email" ? "email" : "whatsapp", `Sent "${t.name}"`);
    await refresh(); closeModal(); toast("Message logged"); paintLead(); render();
  });
}
