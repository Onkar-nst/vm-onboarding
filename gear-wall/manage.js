/* Gear Wall — Calendar (range bookings + conflict detection), booking modal,
 * Manage (gear / projects / members CRUD), Settings, CSV exports.
 */

let calCursor = new Date();

/* ---------------- Calendar ---------------- */

function renderCalendar() {
  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  const monthName = calCursor.toLocaleString([], { month: "long", year: "numeric" });
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayStr();

  let cells = "";
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(d => cells += `<div class="cal-dow">${d}</div>`);
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const dateStr = inMonth ? `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : null;
    const dayBookings = inMonth
      ? cache.bookings.filter(b => b.status !== "rejected" && b.start <= dateStr && dateStr <= b.end)
      : [];
    const chips = dayBookings.slice(0, 3).map(b =>
      `<div class="cal-shoot ${b.status}${isOverdue(b) ? " overdue" : ""}" title="${esc(b.name)} — ${b.status}">${b.status === "pending" ? "⏳ " : ""}${esc(b.name)}</div>`).join("");
    const more = dayBookings.length > 3 ? `<div class="cal-shoot done">+${dayBookings.length - 3} more</div>` : "";
    cells += `<div class="cal-cell ${inMonth ? "" : "other"} ${dateStr === today ? "today" : ""}" ${inMonth ? `data-date="${dateStr}"` : ""}>
      ${inMonth ? `<span class="d">${dayNum}</span>${chips}${more}` : ""}</div>`;
  }

  const all = cache.bookings
    .filter(b => b.status !== "rejected")
    .sort((a, b) => a.start.localeCompare(b.start));

  $("#view").innerHTML = `
    <div class="toolbar">
      <h2>Booking Calendar</h2>
      <div class="spacer"></div>
      <button class="btn amber" id="plusShoot">+ Booking</button>
    </div>
    <div class="cal-head">
      <button class="btn sm" id="calPrev">←</button>
      <h3>${monthName}</h3>
      <button class="btn sm" id="calNext">→</button>
      <button class="btn sm" id="calToday">Today</button>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="toolbar" style="margin-top:30px"><h2>All bookings</h2></div>
    <div class="shoot-list">${all.map(bookingCard).join("") || `<div class="empty">No bookings yet — create one with “+ Booking”.</div>`}</div>`;

  $("#calPrev").addEventListener("click", () => { calCursor = new Date(y, m - 1, 1); renderCalendar(); });
  $("#calNext").addEventListener("click", () => { calCursor = new Date(y, m + 1, 1); renderCalendar(); });
  $("#calToday").addEventListener("click", () => { calCursor = new Date(); renderCalendar(); });
  $("#plusShoot").addEventListener("click", () => showBookingModal(today));
  $$(".cal-cell[data-date]").forEach(c => c.addEventListener("click", e => {
    if (e.target.closest(".cal-shoot")) return showDayModal(c.dataset.date);
    showBookingModal(c.dataset.date);
  }));
  wireBookingCardActions();
}

function bookingCard(b) {
  const d = new Date(b.start + "T00:00:00");
  const overdue = isOverdue(b);
  const statusBadge = overdue
    ? `<span class="badge damaged">Overdue return</span>`
    : {
      pending: `<span class="badge pending">Pending approval</span>`,
      approved: `<span class="badge available">Approved</span>`,
      done: `<span class="badge" style="background:var(--panel2);color:var(--muted)">Done</span>`,
      rejected: `<span class="badge damaged">Rejected</span>`,
      cancelled: `<span class="badge" style="background:var(--panel2);color:var(--muted)">Cancelled</span>`
    }[b.status];
  const proj = projectById(b.projectId);
  const tags = b.gearIds.map(id => {
    const g = gearById(id);
    const p = b.pickups && b.pickups[id];
    const cls = p && p.returnedAt ? "returned" : (p && p.pickedAt ? "picked" : "");
    const suffix = p && p.returnedAt ? " ✓" : (p && p.pickedAt ? " ·out" : "");
    return `<span class="gear-tag ${cls}" title="${esc(g ? g.name : id)}">${esc(g ? g.name : id)}${suffix}</span>`;
  }).join("");
  const btns = [];
  if (me && me.role === "manager" && b.status === "pending") {
    btns.push(`<button class="btn sm green" data-approve="${b.id}">✓ Approve</button>`);
    btns.push(`<button class="btn sm danger" data-reject="${b.id}">✕ Reject</button>`);
  }
  if (b.status === "pending" && me && (me.id === b.requesterId) )
    btns.push(`<button class="btn sm" data-cancel="${b.id}">Withdraw</button>`);
  if (me && me.role === "manager" && b.status === "approved")
    btns.push(`<button class="btn sm" data-done="${b.id}">Mark done</button>`);
  return `
    <div class="shoot-card ${overdue ? "overdue" : ""}">
      <div class="when">
        <div class="dd">${String(d.getDate()).padStart(2, "0")}</div>
        <div class="mm">${d.toLocaleString([], { month: "short" })}</div>
        ${b.start !== b.end ? `<div class="mm">→ ${fmtDateStr(b.end)}</div>` : ""}
      </div>
      <div class="info">
        <h4>${esc(b.name)} <span class="mono" style="font-size:11px;color:var(--muted)">${b.id}</span></h4>
        <div class="meta">📍 ${esc(b.location)} · 🎬 ${esc(proj.name)}${proj.client ? " (" + esc(proj.client) + ")" : ""} · by <b>${esc(memberById(b.requesterId).name)}</b></div>
        ${b.notes ? `<div class="meta">📝 ${esc(b.notes)}</div>` : ""}
        <div class="gear-tags">${tags}</div>
      </div>
      <div class="side">
        ${statusBadge}
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${btns.join("")}</div>
      </div>
    </div>`;
}

function wireBookingCardActions() {
  $$("[data-approve]").forEach(btn => btn.addEventListener("click", () => requireManager(async () => {
    const b = bookingById(btn.dataset.approve);
    // final conflict check against other APPROVED bookings
    const clashes = [];
    for (const gid of b.gearIds) {
      conflictsFor(gid, b.start, b.end, b.id)
        .filter(c => c.status === "approved")
        .forEach(c => clashes.push(`${(gearById(gid) || { name: gid }).name} ↔ “${c.name}” (${rangeLabel(c)})`));
    }
    if (clashes.length) {
      openModal(`<h3>Can't approve — gear clash</h3>
        <div class="sub">These items are already committed to approved bookings in the same window:</div>
        ${clashes.map(c => `<div class="log-line">⚠ ${esc(c)}</div>`).join("")}
        <div class="actions"><button class="btn" data-close>Close</button></div>`);
      return;
    }
    b.status = "approved";
    await Store.put("bookings", b);
    await addLog(`Booking “${b.name}” approved by ${me.name}.`);
    await refresh(); toast(`Approved: ${b.name}`); render();
  })));
  $$("[data-reject]").forEach(btn => btn.addEventListener("click", () => requireManager(async () => {
    const b = bookingById(btn.dataset.reject);
    b.status = "rejected";
    await Store.put("bookings", b);
    await addLog(`Booking “${b.name}” rejected by ${me.name}.`);
    await refresh(); toast(`Rejected: ${b.name}`); render();
  })));
  $$("[data-cancel]").forEach(btn => btn.addEventListener("click", async () => {
    const b = bookingById(btn.dataset.cancel);
    b.status = "cancelled";
    await Store.put("bookings", b);
    await addLog(`Booking “${b.name}” withdrawn by requester.`);
    await refresh(); toast("Booking withdrawn"); render();
  }));
  $$("[data-done]").forEach(btn => btn.addEventListener("click", () => requireManager(async () => {
    const b = bookingById(btn.dataset.done);
    const stillOut = Object.entries(b.pickups || {}).filter(([, p]) => p.pickedAt && !p.returnedAt);
    if (stillOut.length) { toast(`${stillOut.length} item(s) still out — return them first`); return; }
    b.status = "done";
    await Store.put("bookings", b);
    await addLog(`Booking “${b.name}” marked done.`);
    await refresh(); toast(`Done: ${b.name}`); render();
  })));
}

function showDayModal(dateStr) {
  const dayBookings = cache.bookings.filter(b => b.status !== "rejected" && b.start <= dateStr && dateStr <= b.end);
  openModal(`
    <h3>${new Date(dateStr + "T00:00:00").toDateString()}</h3>
    <div class="sub">${dayBookings.length} booking${dayBookings.length !== 1 ? "s" : ""} on this day</div>
    <div class="shoot-list">${dayBookings.map(bookingCard).join("") || `<div class="empty">Nothing scheduled.</div>`}</div>
    <div class="actions">
      <button class="btn" data-close>Close</button>
      <button class="btn amber" id="dayPlus">+ Booking this day</button>
    </div>`);
  wireBookingCardActions();
  $("#dayPlus").addEventListener("click", () => { closeModal(); showBookingModal(dateStr); });
}

/* ---------------- Booking modal with live conflict detection ---------------- */

function showBookingModal(dateStr) {
  if (!me) { toast("Pick your profile first (top right)"); return; }
  const activeProjects = cache.projects.filter(p => p.active !== false);
  openModal(`
    <h3>New booking</h3>
    <div class="sub">Requests go to a manager for approval. Gear that clashes with another booking in your dates is flagged live.</div>
    <label>Booking name</label><input id="bkName" placeholder="e.g. Wedding — sangeet coverage" maxlength="60">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><label>From</label><input id="bkStart" type="date" value="${dateStr}"></div>
      <div><label>To</label><input id="bkEnd" type="date" value="${dateStr}"></div>
    </div>
    <label>Location</label>
    <select id="bkLoc"><option>Studio 1</option><option>Studio 2</option><option>Outdoor</option></select>
    <div id="bkOutdoorWrap" style="display:none"><label>Where outdoors?</label><input id="bkOutdoor" placeholder="e.g. Cubbon Park" maxlength="60"></div>
    <label>Project / client</label>
    <select id="bkProj">${activeProjects.map(p => `<option value="${p.id}">${esc(p.name)}${p.client ? " — " + esc(p.client) : ""}</option>`).join("")}</select>
    <label>Gear</label>
    <div class="gear-pick" id="bkGearPick"></div>
    <div id="bkEstimate" class="sub" style="margin-top:10px"></div>
    <label>Notes (optional)</label><input id="bkNotes" placeholder="Anything the approver should know" maxlength="140">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="bkSave">Request booking</button>
    </div>`);

  const locSel = $("#bkLoc");
  locSel.addEventListener("change", () => { $("#bkOutdoorWrap").style.display = locSel.value === "Outdoor" ? "" : "none"; });

  function repaintGearPick() {
    const start = $("#bkStart").value, end = $("#bkEnd").value;
    const selected = new Set($$("#bkGearPick input:checked").map(cb => cb.value));
    $("#bkGearPick").innerHTML = cache.gear.map(g => {
      const damaged = g.condition === "damaged";
      const clashes = (start && end) ? conflictsFor(g.id, start, end, null) : [];
      const hardClash = clashes.find(c => c.status === "approved");
      const softClash = !hardClash && clashes.find(c => c.status === "pending");
      const disabled = damaged || !!hardClash;
      const sub = damaged ? "damaged"
        : hardClash ? `booked: ${hardClash.name} (${rangeLabel(hardClash)})`
        : softClash ? `also requested by “${softClash.name}”` : (g.dayRate ? cache.settings.currency + g.dayRate + "/day" : g.id);
      return `<label class="${disabled ? "disabled" : ""} ${selected.has(g.id) && !disabled ? "sel" : ""} ${softClash ? "soft" : ""}">
        <input type="checkbox" value="${g.id}" ${disabled ? "disabled" : ""} ${selected.has(g.id) && !disabled ? "checked" : ""}>
        <span>${esc(g.name)}<span class="sub-id">${esc(sub)}</span></span>
      </label>`;
    }).join("");
    $$("#bkGearPick input").forEach(cb => cb.addEventListener("change", () => {
      cb.closest("label").classList.toggle("sel", cb.checked);
      paintEstimate();
    }));
    paintEstimate();
  }
  function paintEstimate() {
    const start = $("#bkStart").value, end = $("#bkEnd").value;
    const days = start && end && end >= start ? (new Date(end) - new Date(start)) / 86400000 + 1 : 0;
    const picked = $$("#bkGearPick input:checked").map(cb => gearById(cb.value)).filter(Boolean);
    const rate = picked.reduce((s, g) => s + (Number(g.dayRate) || 0), 0);
    $("#bkEstimate").innerHTML = picked.length && days
      ? `${picked.length} item(s) × ${days} day(s) — internal cost reference ≈ <b>${cache.settings.currency}${(rate * days).toLocaleString()}</b>`
      : "";
  }
  $("#bkStart").addEventListener("change", () => {
    if ($("#bkEnd").value < $("#bkStart").value) $("#bkEnd").value = $("#bkStart").value;
    repaintGearPick();
  });
  $("#bkEnd").addEventListener("change", repaintGearPick);
  repaintGearPick();

  $("#bkSave").addEventListener("click", async () => {
    const name = $("#bkName").value.trim();
    const start = $("#bkStart").value, end = $("#bkEnd").value;
    const picked = $$("#bkGearPick input:checked").map(cb => cb.value);
    if (!name) { $("#bkName").focus(); return; }
    if (!start || !end || end < start) { toast("Check the dates"); return; }
    if (!picked.length) { toast("Pick at least one piece of gear"); return; }
    let location = locSel.value;
    if (location === "Outdoor") {
      const where = $("#bkOutdoor").value.trim();
      location = where ? `Outdoor — ${where}` : "Outdoor";
    }
    const id = await Store.nextId("BK");
    await Store.put("bookings", {
      id, name, projectId: $("#bkProj").value, location, start, end,
      gearIds: picked, requesterId: me.id, status: "pending", pickups: {},
      notes: $("#bkNotes").value.trim(), createdAt: Date.now()
    });
    await addLog(`Booking requested: “${name}” by ${me.name} (${picked.length} items, ${start} → ${end}).`);
    await refresh();
    closeModal();
    toast("Request sent — pending manager approval");
    render();
  });
}

/* ---------------- Manage (gear / projects / members) ---------------- */

let manageTab = "gear";

function renderManage() {
  if (!(me && me.role === "manager")) { setTab("wall"); return; }
  const tabs = [["gear", "Gear"], ["projects", "Projects"], ["members", "Team"]];
  let body = "";
  if (manageTab === "gear") {
    body = `<table>
      <tr><th>ID</th><th>Name</th><th>Category</th><th>Serial</th><th>Day rate</th><th>Home</th><th>State</th><th></th></tr>
      ${cache.gear.map(g => `<tr>
        <td class="mono">${g.id}</td><td><b>${esc(g.name)}</b></td><td>${esc(g.category)}</td>
        <td class="mono">${esc(g.serial || "—")}</td><td>${g.dayRate ? cache.settings.currency + g.dayRate : "—"}</td>
        <td>${esc(g.home)}</td><td><span class="badge ${gearState(g)}">${gearState(g).replace("_", " ")}</span></td>
        <td style="white-space:nowrap">
          <button class="btn sm" data-edit-gear="${g.id}">✎</button>
          <button class="btn sm danger" data-archive-gear="${g.id}">Archive</button>
        </td></tr>`).join("")}
    </table>`;
  } else if (manageTab === "projects") {
    body = `<table>
      <tr><th>ID</th><th>Project</th><th>Client</th><th>Status</th><th></th></tr>
      ${cache.projects.map(p => `<tr>
        <td class="mono">${p.id}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.client || "—")}</td>
        <td>${p.active !== false ? `<span class="badge available">Active</span>` : `<span class="badge" style="background:var(--panel2);color:var(--muted)">Closed</span>`}</td>
        <td style="white-space:nowrap">
          <button class="btn sm" data-edit-proj="${p.id}">✎</button>
          <button class="btn sm" data-toggle-proj="${p.id}">${p.active !== false ? "Close" : "Reopen"}</button>
        </td></tr>`).join("")}
    </table>`;
  } else {
    body = `<table>
      <tr><th>ID</th><th>Name</th><th>Role</th><th></th></tr>
      ${cache.members.map(mm => `<tr>
        <td class="mono">${mm.id}</td><td><b>${esc(mm.name)}</b></td>
        <td>${mm.role === "manager" ? "★ Manager" : "Crew"}</td>
        <td><button class="btn sm" data-edit-member="${mm.id}">✎</button></td></tr>`).join("")}
    </table>`;
  }
  $("#view").innerHTML = `
    <div class="toolbar">
      <h2>Manage</h2>
      <div class="chip-row">${tabs.map(([k, l]) => `<button class="chip ${manageTab === k ? "active" : ""}" data-mtab="${k}">${l}</button>`).join("")}</div>
      <div class="spacer"></div>
      <button class="btn" id="csvGear">⬇ Inventory CSV</button>
      <button class="btn amber" id="mAdd">+ Add ${manageTab === "gear" ? "gear" : manageTab === "projects" ? "project" : "member"}</button>
    </div>
    <div class="admin-section">${body}</div>`;
  $$("[data-mtab]").forEach(b => b.addEventListener("click", () => { manageTab = b.dataset.mtab; renderManage(); }));
  $("#csvGear").addEventListener("click", exportGearCsv);
  $("#mAdd").addEventListener("click", () => requireManager(() =>
    manageTab === "gear" ? showGearModal(null) : manageTab === "projects" ? showProjectModal(null) : showMemberModal(null)));
  $$("[data-edit-gear]").forEach(b => b.addEventListener("click", () => requireManager(() => showGearModal(b.dataset.editGear))));
  $$("[data-archive-gear]").forEach(b => b.addEventListener("click", () => requireManager(async () => {
    const g = gearById(b.dataset.archiveGear);
    if (activePickup(g.id)) { toast("Can't archive — item is out"); return; }
    g.archived = true;
    await Store.put("gear", g);
    await addLog(`${g.name} (${g.id}) archived (removed from the wall, history kept).`);
    await refresh(); toast(`${g.name} archived`); render();
  })));
  $$("[data-edit-proj]").forEach(b => b.addEventListener("click", () => requireManager(() => showProjectModal(b.dataset.editProj))));
  $$("[data-toggle-proj]").forEach(b => b.addEventListener("click", () => requireManager(async () => {
    const p = projectById(b.dataset.toggleProj);
    p.active = p.active === false;
    await Store.put("projects", p);
    await refresh(); render();
  })));
  $$("[data-edit-member]").forEach(b => b.addEventListener("click", () => requireManager(() => showMemberModal(b.dataset.editMember))));
}

function showGearModal(id) {
  const g = id ? gearById(id) : null;
  const cats = [...new Set(cache.gear.map(x => x.category))];
  openModal(`
    <h3>${g ? "Edit " + esc(g.name) : "Add gear"}</h3>
    <label>Name</label><input id="gName" value="${g ? esc(g.name) : ""}" placeholder="e.g. Sony A7S III" maxlength="60">
    <label>Category</label>
    <select id="gCat">${[...new Set([...cats, "Camera", "Lens", "Light", "Audio", "Grip", "Monitor", "Drone", "Other"])].map(c =>
      `<option ${g && g.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <label>Serial number</label><input id="gSerial" value="${g ? esc(g.serial || "") : ""}" placeholder="optional" maxlength="40">
    <label>Day rate (${cache.settings.currency}, internal reference)</label><input id="gRate" type="number" min="0" value="${g ? (g.dayRate || "") : ""}" placeholder="0">
    <label>Home location</label><input id="gHome" value="${g ? esc(g.home) : ""}" placeholder="e.g. Studio 1 · Shelf B" maxlength="60">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="gSave">${g ? "Save" : "Add to wall"}</button>
    </div>`);
  $("#gSave").addEventListener("click", async () => {
    const name = $("#gName").value.trim();
    if (!name) { $("#gName").focus(); return; }
    const cat = $("#gCat").value;
    let doc = g;
    if (!doc) {
      const prefix = "GW-" + cat.slice(0, 3).toUpperCase();
      doc = { id: await Store.nextId(prefix), condition: "ok", notes: "", archived: false };
    }
    Object.assign(doc, {
      name, category: cat,
      serial: $("#gSerial").value.trim(),
      dayRate: Number($("#gRate").value) || 0,
      home: $("#gHome").value.trim() || "Unassigned"
    });
    await Store.put("gear", doc);
    await addLog(`${g ? "Gear updated" : "New gear added"}: ${name} (${doc.id}).`);
    await refresh(); closeModal(); toast(`${name} saved`); render();
  });
}

function showProjectModal(id) {
  const p = id ? projectById(id) : null;
  openModal(`
    <h3>${p ? "Edit project" : "New project"}</h3>
    <label>Project name</label><input id="pName" value="${p ? esc(p.name) : ""}" placeholder="e.g. Wedding — Rao x Iyer" maxlength="60">
    <label>Client</label><input id="pClient" value="${p ? esc(p.client || "") : ""}" placeholder="e.g. Private / brand name" maxlength="60">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="pSave">Save</button>
    </div>`);
  $("#pSave").addEventListener("click", async () => {
    const name = $("#pName").value.trim();
    if (!name) { $("#pName").focus(); return; }
    const doc = p || { id: await Store.nextId("PRJ"), active: true };
    doc.name = name;
    doc.client = $("#pClient").value.trim();
    await Store.put("projects", doc);
    await refresh(); closeModal(); toast("Project saved"); render();
  });
}

function showMemberModal(id) {
  const mm = id ? cache.members.find(x => x.id === id) : null;
  openModal(`
    <h3>${mm ? "Edit member" : "Add team member"}</h3>
    <label>Name</label><input id="mName" value="${mm ? esc(mm.name) : ""}" maxlength="40">
    <label>Role</label>
    <select id="mRole">
      <option value="crew" ${mm && mm.role === "crew" ? "selected" : ""}>Crew — book & scan</option>
      <option value="manager" ${mm && mm.role === "manager" ? "selected" : ""}>Manager — approve, manage, settings (PIN)</option>
    </select>
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="mSave">Save</button>
    </div>`);
  $("#mSave").addEventListener("click", async () => {
    const name = $("#mName").value.trim();
    if (!name) { $("#mName").focus(); return; }
    const doc = mm || { id: await Store.nextId("MB"), active: true };
    doc.name = name;
    doc.role = $("#mRole").value;
    await Store.put("members", doc);
    await refresh(); closeModal(); toast("Member saved"); render();
  });
}

/* ---------------- Settings ---------------- */

function renderSettings() {
  if (!(me && me.role === "manager")) { setTab("wall"); return; }
  const s = cache.settings;
  $("#view").innerHTML = `
    <div class="toolbar"><h2>Settings</h2></div>
    <div class="admin-section" style="max-width:560px">
      <h3>Workspace</h3>
      <label class="set-label">Studio / agency name</label>
      <input class="set-input" id="setOrg" value="${esc(s.orgName)}" maxlength="50">
      <label class="set-label">Manager PIN</label>
      <input class="set-input" id="setPin" value="${esc(String(s.adminPin))}" maxlength="8">
      <label class="set-label">Currency symbol</label>
      <input class="set-input" id="setCur" value="${esc(s.currency || "₹")}" maxlength="3">
      <label class="set-label">Early pickup window (days before booking start)</label>
      <input class="set-input" id="setGrace" type="number" min="0" max="7" value="${s.pickupGraceDays || 0}">
      <div style="margin-top:16px"><button class="btn amber" id="setSave">Save settings</button></div>
    </div>
    <div class="admin-section" style="max-width:560px">
      <h3>Data</h3>
      <p class="sub" style="margin-bottom:12px">Adapter in use: <b class="mono">${(window.APP_CONFIG || {}).adapter || "local"}</b>.
      Export gives you a full JSON backup — it's also the migration file when you connect a real database (see README).</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" id="setExport">⬇ Export backup (JSON)</button>
        <button class="btn" id="setImport">⬆ Import backup</button>
        <button class="btn danger" id="setReset">Reset to demo data</button>
      </div>
      <input type="file" id="setFile" accept="application/json" style="display:none">
    </div>`;
  $("#setSave").addEventListener("click", () => requireManager(async () => {
    s.orgName = $("#setOrg").value.trim() || s.orgName;
    s.adminPin = $("#setPin").value.trim() || s.adminPin;
    s.currency = $("#setCur").value.trim() || "₹";
    s.pickupGraceDays = Number($("#setGrace").value) || 0;
    await Store.put("settings", s);
    await refresh(); toast("Settings saved"); render();
  }));
  $("#setExport").addEventListener("click", async () => {
    const dump = await Store.exportAll(["settings", "members", "projects", "gear", "bookings", "log"]);
    downloadFile("gearwall-backup.json", JSON.stringify(dump, null, 2), "application/json");
  });
  $("#setImport").addEventListener("click", () => $("#setFile").click());
  $("#setFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dump = JSON.parse(await file.text());
      await Store.importAll(dump);
      await refresh(); toast("Backup imported"); render();
    } catch (err) { toast("Import failed: not a valid backup file"); }
  });
  $("#setReset").addEventListener("click", () => requireManager(async () => {
    openModal(`<h3>Reset to demo data?</h3>
      <div class="sub">This clears the current workspace on this device and reloads the demo dataset. Export a backup first if you need the data.</div>
      <div class="actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn danger" id="resetGo">Yes, reset</button>
      </div>`);
    $("#resetGo").addEventListener("click", async () => {
      await Store.clearAll();
      await writeSeed();
      await refresh();
      me = null; managerUnlocked = false;
      sessionStorage.removeItem("gw_member");
      closeModal(); toast("Demo data restored"); render();
    });
  }));
}

/* ---------------- CSV ---------------- */

function csvCell(v) { return `"${String(v == null ? "" : v).replace(/"/g, '""')}"`; }
function downloadFile(name, content, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportGearCsv() {
  const rows = [["ID", "Name", "Category", "Serial", "DayRate", "Home", "Condition", "State"]];
  cache.gear.forEach(g => rows.push([g.id, g.name, g.category, g.serial || "", g.dayRate || 0, g.home, g.condition, gearState(g)]));
  downloadFile("gear-inventory.csv", rows.map(r => r.map(csvCell).join(",")).join("\n"), "text/csv");
}
function exportUsageCsv() {
  const rows = [["Gear", "GearID", "Booking", "Project", "By", "PickedUp", "Returned", "Hours", "ReturnCondition"]];
  cache.bookings.forEach(b => Object.entries(b.pickups || {}).forEach(([gid, p]) => {
    if (!p.pickedAt) return;
    const g = gearById(gid);
    rows.push([
      g ? g.name : gid, gid, b.name, projectById(b.projectId).name,
      memberById(p.byId || b.requesterId).name,
      new Date(p.pickedAt).toISOString(),
      p.returnedAt ? new Date(p.returnedAt).toISOString() : "",
      p.returnedAt ? ((p.returnedAt - p.pickedAt) / 3600000).toFixed(1) : "",
      p.inCond || ""
    ]);
  }));
  downloadFile("gear-usage.csv", rows.map(r => r.map(csvCell).join(",")).join("\n"), "text/csv");
}
