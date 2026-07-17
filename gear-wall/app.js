/* Gear Wall — core: boot, cache, helpers, Wall, Scanner, Activity.
 * Calendar/booking/manage/settings live in manage.js.
 * All persistence goes through Store (store.js) — no direct localStorage use.
 */

const QR_PREFIX = "gearwall:";
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- in-memory cache over the Store ---------------- */

const cache = { settings: null, members: [], projects: [], gear: [], bookings: [], log: [] };

async function refresh() {
  const [settingsList, members, projects, gear, bookings, log] = await Promise.all([
    Store.list("settings"), Store.list("members"), Store.list("projects"),
    Store.list("gear"), Store.list("bookings"), Store.list("log")
  ]);
  cache.settings = settingsList.find(s => s.id === "settings") ||
    { id: "settings", orgName: "Your Studio", adminPin: "1234", currency: "₹", pickupGraceDays: 1 };
  cache.members = members.filter(m => m.active !== false);
  cache.projects = projects;
  cache.gear = gear.filter(g => !g.archived);
  cache.allGear = gear;
  cache.bookings = bookings;
  cache.log = log.sort((a, b) => b.ts - a.ts).slice(0, 150);
}

async function addLog(msg) {
  const id = await Store.nextId("LOG");
  await Store.put("log", { id, ts: Date.now(), msg });
}

/* ---------------- session (current member + manager unlock) ---------------- */

let me = null;                 // current member doc
let managerUnlocked = false;   // PIN entered this session

function isManager() { return me && me.role === "manager" && managerUnlocked; }

async function requireManager(then) {
  if (isManager()) return then();
  if (!me || me.role !== "manager") { toast("Switch to a manager profile first (top right)"); return; }
  openModal(`
    <h3>Manager PIN</h3>
    <div class="sub">Enter the admin PIN to unlock manager actions for this session.</div>
    <label>PIN</label><input id="pinInput" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="pinGo">Unlock</button>
    </div>`);
  const tryPin = () => {
    if ($("#pinInput").value === String(cache.settings.adminPin)) {
      managerUnlocked = true;
      closeModal();
      toast("Manager actions unlocked");
      render();
      then();
    } else {
      toast("Wrong PIN");
      $("#pinInput").value = "";
      $("#pinInput").focus();
    }
  };
  $("#pinGo").addEventListener("click", tryPin);
  $("#pinInput").addEventListener("keydown", e => { if (e.key === "Enter") tryPin(); });
  $("#pinInput").focus();
}

/* ---------------- domain helpers ---------------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function gearById(id) { return cache.allGear.find(g => g.id === id); }
function memberById(id) { return cache.members.find(m => m.id === id) || { name: "Unknown" }; }
function projectById(id) { return cache.projects.find(p => p.id === id) || { name: "—", client: "" }; }
function bookingById(id) { return cache.bookings.find(b => b.id === id); }
function fmtTime(ts) { return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function fmtClock(ts) { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDateStr(ds) { return new Date(ds + "T00:00:00").toLocaleDateString([], { day: "numeric", month: "short" }); }
function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h " + (m % 60) + "m";
  return Math.floor(h / 24) + "d " + (h % 24) + "h";
}
function rangeLabel(b) { return b.start === b.end ? fmtDateStr(b.start) : fmtDateStr(b.start) + " – " + fmtDateStr(b.end); }

function activePickup(gearId) {
  for (const b of cache.bookings) {
    const p = b.pickups && b.pickups[gearId];
    if (p && p.pickedAt && !p.returnedAt) return { booking: b, pickup: p };
  }
  return null;
}
function overlaps(a, b) { return a.start <= b.end && b.start <= a.end; }

// bookings (pending or approved, not this one) that clash with [start,end] for a gear id
function conflictsFor(gearId, start, end, excludeBookingId) {
  return cache.bookings.filter(b =>
    b.id !== excludeBookingId &&
    (b.status === "approved" || b.status === "pending") &&
    b.gearIds.includes(gearId) &&
    overlaps({ start, end }, b)
  );
}

// the approved booking whose pickup window covers today for this gear
function pickupableBooking(gearId) {
  const t = todayStr();
  const grace = Number(cache.settings.pickupGraceDays || 0);
  return cache.bookings
    .filter(b => b.status === "approved" && b.gearIds.includes(gearId) &&
      !(b.pickups[gearId] && b.pickups[gearId].pickedAt))
    .filter(b => {
      const earliest = new Date(new Date(b.start + "T00:00:00").getTime() - grace * 86400000).toISOString().slice(0, 10);
      return earliest <= t && t <= b.end;
    })
    .sort((a, b) => a.start.localeCompare(b.start))[0] || null;
}
function nextReservation(gearId) {
  const t = todayStr();
  return cache.bookings
    .filter(b => b.status === "approved" && b.gearIds.includes(gearId) &&
      !(b.pickups[gearId] && b.pickups[gearId].pickedAt) && b.end >= t)
    .sort((a, b) => a.start.localeCompare(b.start))[0] || null;
}
function isOverdue(b) {
  return b.status === "approved" && b.end < todayStr() &&
    Object.entries(b.pickups || {}).some(([, p]) => p.pickedAt && !p.returnedAt);
}
function gearState(g) {
  if (g.condition === "damaged") return "damaged";
  if (activePickup(g.id)) return "in_use";
  return "available";
}
function pendingCount() { return cache.bookings.filter(b => b.status === "pending").length; }
function overdueCount() { return cache.bookings.filter(isOverdue).length; }

/* ---------------- QR ---------------- */

function qrSvg(text, sizePx) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = Math.max(1, Math.floor(sizePx / n));
  const dim = n * cell;
  let rects = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) rects += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}

/* ---------------- toast & modal ---------------- */

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
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

/* ---------------- tabs ---------------- */

let currentTab = "wall";

function setTab(tab) {
  stopScanner();
  currentTab = tab;
  $$("nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  render();
}

function render() {
  updateChrome();
  const view = {
    wall: renderWall, calendar: renderCalendar, scanner: renderScanner,
    activity: renderActivity, manage: renderManage, settings: renderSettings
  }[currentTab];
  view();
}

function updateChrome() {
  $("#orgName").textContent = cache.settings.orgName;
  const n = pendingCount(), o = overdueCount();
  $("#calTabBtn").innerHTML = `Calendar${n ? ` <span class="badge">${n}</span>` : ""}`;
  $("#actTabBtn").innerHTML = `Activity${o ? ` <span class="badge">${o}</span>` : ""}`;
  const mgTab = $("#manageTabBtn");
  mgTab.style.display = me && me.role === "manager" ? "" : "none";
  $("#settingsTabBtn").style.display = me && me.role === "manager" ? "" : "none";
  // member picker
  const sel = $("#memberSel");
  sel.innerHTML = `<option value="">Who are you?</option>` + cache.members.map(m =>
    `<option value="${m.id}" ${me && me.id === m.id ? "selected" : ""}>${esc(m.name)}${m.role === "manager" ? " ★" : ""}</option>`).join("");
}

/* ---------------- Wall ---------------- */

let wallFilter = "All";
let wallTick = null;

function renderWall() {
  clearInterval(wallTick);
  const cats = ["All", ...new Set(cache.gear.map(g => g.category))];
  const states = cache.gear.map(g => gearState(g));
  const avail = states.filter(s => s === "available").length;
  const inUse = states.filter(s => s === "in_use").length;
  const damaged = states.filter(s => s === "damaged").length;
  const activeBookings = cache.bookings.filter(b => b.status === "approved" &&
    Object.values(b.pickups || {}).some(p => p.pickedAt && !p.returnedAt)).length;
  const overdue = overdueCount();

  const cards = cache.gear
    .filter(g => wallFilter === "All" || g.category === wallFilter)
    .map(g => {
      const st = gearState(g);
      const out = activePickup(g.id);
      const resv = !out && st !== "damaged" ? nextReservation(g.id) : null;
      let useInfo = "";
      if (out) {
        const late = isOverdue(out.booking) ? ` <span class="late">OVERDUE</span>` : "";
        useInfo = `<div class="use-info">Out for <b>${esc(out.booking.name)}</b> (${esc(memberById(out.booking.requesterId).name)}) · since ${fmtClock(out.pickup.pickedAt)} · <b data-since="${out.pickup.pickedAt}">${elapsed(Date.now() - out.pickup.pickedAt)}</b>${late}</div>`;
      } else if (resv) {
        useInfo = `<div class="use-info">Reserved: <b>${esc(resv.name)}</b> · ${rangeLabel(resv)}</div>`;
      }
      const actions = [];
      if (out) actions.push(`<button class="btn sm green" data-return="${g.id}">↩ Return</button>`);
      if (me && me.role === "manager") {
        actions.push(`<button class="btn sm" data-edit-gear="${g.id}">✎ Edit</button>`);
        if (st !== "in_use") actions.push(g.condition === "damaged"
          ? `<button class="btn sm" data-fix="${g.id}">✓ Repaired</button>`
          : `<button class="btn sm danger" data-damage="${g.id}">⚠ Damaged</button>`);
      }
      return `
        <div class="gear-card">
          <div class="top">
            <div>
              <h3>${esc(g.name)}</h3>
              <div class="cat">${esc(g.category)}${g.serial ? ` · <span class="mono">${esc(g.serial)}</span>` : ""}</div>
            </div>
            <div class="qr" data-zoom="${g.id}" title="Show printable QR label">${qrSvg(QR_PREFIX + g.id, 58)}</div>
          </div>
          <div class="id">${g.id}${g.dayRate ? ` · ${cache.settings.currency}${g.dayRate}/day` : ""}</div>
          <div class="home">📍 ${esc(g.home)}</div>
          <div class="status-row">
            <span class="badge ${st}">${{ available: "Available", in_use: "In use", damaged: "Damaged" }[st]}</span>
          </div>
          ${useInfo}
          ${g.notes ? `<div class="notes">⚠ ${esc(g.notes)}</div>` : ""}
          ${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}
        </div>`;
    }).join("");

  $("#view").innerHTML = `
    <div class="stats">
      <div class="stat green"><div class="n">${avail}</div><div class="l">Available</div></div>
      <div class="stat amber"><div class="n">${inUse}</div><div class="l">In use</div></div>
      <div class="stat red"><div class="n">${damaged}</div><div class="l">Damaged</div></div>
      <div class="stat blue"><div class="n">${activeBookings}</div><div class="l">Active shoots</div></div>
      <div class="stat ${overdue ? "red" : ""}"><div class="n">${overdue}</div><div class="l">Overdue</div></div>
    </div>
    <div class="toolbar">
      <h2>The Wall</h2>
      <div class="chip-row">${cats.map(c => `<button class="chip ${c === wallFilter ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="spacer"></div>
      <button class="btn" id="printBtn">🖨 QR labels</button>
      ${me && me.role === "manager" ? `<button class="btn amber" id="addGearBtn">+ Add gear</button>` : ""}
    </div>
    <div class="wall">${cards || `<div class="empty">No gear here yet${me && me.role === "manager" ? " — add your first item" : ""}.</div>`}</div>`;

  $$("[data-cat]").forEach(b => b.addEventListener("click", () => { wallFilter = b.dataset.cat; renderWall(); }));
  $$("[data-zoom]").forEach(b => b.addEventListener("click", () => showQrModal(b.dataset.zoom)));
  $$("[data-return]").forEach(b => b.addEventListener("click", () => startReturnFlow(b.dataset.return)));
  $$("[data-damage]").forEach(b => b.addEventListener("click", () => requireManager(() => setDamaged(b.dataset.damage, true))));
  $$("[data-fix]").forEach(b => b.addEventListener("click", () => requireManager(() => setDamaged(b.dataset.fix, false))));
  $$("[data-edit-gear]").forEach(b => b.addEventListener("click", () => requireManager(() => showGearModal(b.dataset.editGear))));
  $("#printBtn").addEventListener("click", () => window.print());
  const addBtn = $("#addGearBtn");
  if (addBtn) addBtn.addEventListener("click", () => requireManager(() => showGearModal(null)));

  wallTick = setInterval(() => {
    $$("[data-since]").forEach(el => { el.textContent = elapsed(Date.now() - Number(el.dataset.since)); });
  }, 30000);
}

async function setDamaged(id, damaged) {
  const g = gearById(id);
  if (!g) return;
  if (damaged) {
    openModal(`
      <h3>Mark ${esc(g.name)} damaged</h3>
      <label>What's wrong?</label><input id="dmgNote" placeholder="e.g. focus ring loose" maxlength="120">
      <div class="actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn danger" id="dmgGo">Mark damaged</button>
      </div>`);
    $("#dmgGo").addEventListener("click", async () => {
      g.condition = "damaged";
      g.notes = $("#dmgNote").value.trim() || "Marked damaged — pending inspection";
      await Store.put("gear", g);
      await addLog(`${g.name} (${g.id}) marked DAMAGED: ${g.notes}`);
      await refresh();
      closeModal();
      toast(`${g.name} marked damaged`);
      render();
    });
  } else {
    g.condition = "ok";
    g.notes = "";
    await Store.put("gear", g);
    await addLog(`${g.name} (${g.id}) repaired & back in service.`);
    await refresh();
    toast(`${g.name} back in service`);
    render();
  }
}

function showQrModal(id) {
  const g = gearById(id);
  openModal(`
    <div class="qr-zoom">
      <h3>${esc(g.name)}</h3>
      <div class="sub">${esc(cache.settings.orgName)} · stick this label on the equipment.</div>
      <div class="qr-big">${qrSvg(QR_PREFIX + g.id, 220)}</div>
      <div class="id">${QR_PREFIX}${g.id}${g.serial ? " · SN " + esc(g.serial) : ""}</div>
      <div class="actions" style="justify-content:center"><button class="btn" data-close>Close</button></div>
    </div>`);
}

/* ---------------- Scanner ---------------- */

let scanStream = null;
let scanRAF = null;

function renderScanner() {
  $("#view").innerHTML = `
    <div class="scanner-wrap">
      <div class="toolbar" style="justify-content:center"><h2>Scan gear QR</h2></div>
      ${!me ? `<div class="scan-result warn"><h4>Pick your profile first</h4><p>Use the "Who are you?" selector in the header — pickups are recorded against your name.</p></div>` : ""}
      <div class="scanner-box" id="scanBox">
        <div class="scanner-idle" id="scanIdle">
          Point the camera at the QR label on the equipment.<br><br>
          <button class="btn amber" id="camStart">📷 Open scanner</button>
        </div>
        <video id="scanVideo" playsinline style="display:none"></video>
        <div class="reticle" id="reticle" style="display:none"><i></i></div>
      </div>
      <div class="manual-row">
        <input id="manualCode" placeholder="…or type a gear ID, e.g. GW-CAM-002" autocomplete="off">
        <button class="btn" id="manualGo">Go</button>
      </div>
      <div class="sim-grid">
        ${cache.gear.slice(0, 6).map(g => `<button class="btn sm" data-sim="${g.id}">▣ Simulate scan · ${g.id}</button>`).join("")}
      </div>
      <div id="scanResult"></div>
    </div>`;

  $("#camStart").addEventListener("click", startScanner);
  $("#manualGo").addEventListener("click", () => handleCode($("#manualCode").value.trim()));
  $("#manualCode").addEventListener("keydown", e => { if (e.key === "Enter") handleCode(e.target.value.trim()); });
  $$("[data-sim]").forEach(b => b.addEventListener("click", () => handleCode(b.dataset.sim)));
}

async function startScanner() {
  const video = $("#scanVideo");
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (err) {
    $("#scanResult").innerHTML = `<div class="scan-result err"><h4>Camera unavailable</h4>
      <p>${esc(err.name === "NotAllowedError" ? "Camera permission was denied." : "Could not open the camera (" + err.name + ").")}
      Use manual entry or a simulate button — same flow, no camera needed.</p></div>`;
    return;
  }
  $("#scanIdle").style.display = "none";
  video.style.display = "";
  $("#reticle").style.display = "";
  video.srcObject = scanStream;
  await video.play();
  const canvas = document.createElement("canvas");
  const cctx = canvas.getContext("2d", { willReadFrequently: true });
  const loop = () => {
    if (!scanStream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      cctx.drawImage(video, 0, 0);
      const img = cctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        stopScanner();
        renderScanner();
        handleCode(code.data);
        return;
      }
    }
    scanRAF = requestAnimationFrame(loop);
  };
  scanRAF = requestAnimationFrame(loop);
}

function stopScanner() {
  if (scanRAF) cancelAnimationFrame(scanRAF);
  scanRAF = null;
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
}

async function handleCode(raw) {
  if (!raw) return;
  const id = (raw.startsWith(QR_PREFIX) ? raw.slice(QR_PREFIX.length) : raw).toUpperCase();
  const g = gearById(id);
  const box = $("#scanResult");
  const show = html => { if (box) box.innerHTML = html; };

  if (!g) return show(`<div class="scan-result err"><h4>Unknown code</h4><p><code>${esc(raw)}</code> doesn't match anything on the wall.</p></div>`);

  const out = activePickup(g.id);
  if (out) return startReturnFlow(g.id);

  if (g.condition === "damaged")
    return show(`<div class="scan-result err"><h4>⚠ ${esc(g.name)} is marked damaged</h4><p>${esc(g.notes || "Out of service.")} Talk to a manager before taking it.</p></div>`);

  const booking = pickupableBooking(g.id);
  if (!booking) {
    const pending = cache.bookings.find(b => b.status === "pending" && b.gearIds.includes(g.id) && b.end >= todayStr());
    const future = nextReservation(g.id);
    return show(`<div class="scan-result warn"><h4>${esc(g.name)} — nothing to pick up today</h4>
      <p>${pending
        ? `It's requested for <b>${esc(pending.name)}</b> (${rangeLabel(pending)}) but that booking is still <b>pending approval</b>.`
        : future
          ? `Next approved booking is <b>${esc(future.name)}</b> starting ${fmtDateStr(future.start)} — pickup opens ${cache.settings.pickupGraceDays || 0} day(s) before.`
          : `No booking includes this item. Book it on the calendar first, get approval, then scan.`}</p></div>`);
  }

  // condition check-out
  openModal(`
    <h3>Pick up ${esc(g.name)}</h3>
    <div class="sub">For <b>${esc(booking.name)}</b> · ${rangeLabel(booking)} · ${esc(booking.location)}</div>
    <label>Condition on the way out</label>
    <select id="outCond"><option value="ok">Good — no visible issues</option><option value="scuffed">Cosmetic wear (note below)</option></select>
    <label>Note (optional)</label><input id="outNote" placeholder="e.g. small scratch on top plate" maxlength="120">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="puGo">Confirm pickup</button>
    </div>`);
  $("#puGo").addEventListener("click", async () => {
    booking.pickups[g.id] = {
      pickedAt: Date.now(), returnedAt: null,
      outCond: $("#outCond").value, outNote: $("#outNote").value.trim(),
      byId: me ? me.id : booking.requesterId
    };
    await Store.put("bookings", booking);
    await addLog(`${g.name} (${g.id}) PICKED UP for “${booking.name}” by ${me ? me.name : memberById(booking.requesterId).name}.`);
    await refresh();
    closeModal();
    toast(`${g.name} picked up`);
    render();
    show(`<div class="scan-result ok"><h4>✓ ${esc(g.name)} picked up</h4>
      <p>Checked out for <b>${esc(booking.name)}</b> until ${fmtDateStr(booking.end)}. Scan again when you bring it back.</p></div>`);
  });
}

function startReturnFlow(gearId) {
  const out = activePickup(gearId);
  if (!out) return;
  const g = gearById(gearId);
  openModal(`
    <h3>Return ${esc(g.name)}</h3>
    <div class="sub">Out for <b>${esc(out.booking.name)}</b> since ${fmtTime(out.pickup.pickedAt)} (${elapsed(Date.now() - out.pickup.pickedAt)}).</div>
    <label>Condition on return</label>
    <select id="inCond">
      <option value="ok">Good — ready for the shelf</option>
      <option value="check">Needs a check (note below)</option>
      <option value="damaged">Damaged — take out of service</option>
    </select>
    <label>Note (optional unless damaged)</label><input id="inNote" placeholder="e.g. battery door loose" maxlength="120">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn green" id="retGo">Confirm return</button>
    </div>`);
  $("#retGo").addEventListener("click", async () => {
    const cond = $("#inCond").value;
    const note = $("#inNote").value.trim();
    if (cond === "damaged" && !note) { $("#inNote").focus(); toast("Describe the damage"); return; }
    out.pickup.returnedAt = Date.now();
    out.pickup.inCond = cond;
    out.pickup.inNote = note;
    await Store.put("bookings", out.booking);
    if (cond === "damaged") {
      g.condition = "damaged";
      g.notes = note;
      await Store.put("gear", g);
      await addLog(`${g.name} (${g.id}) RETURNED DAMAGED from “${out.booking.name}”: ${note}`);
    } else {
      await addLog(`${g.name} (${g.id}) RETURNED from “${out.booking.name}” after ${elapsed(out.pickup.returnedAt - out.pickup.pickedAt)}.${note ? " Note: " + note : ""}`);
    }
    await refresh();
    closeModal();
    toast(`${g.name} returned${cond === "damaged" ? " — marked damaged" : ""}`);
    render();
  });
}

/* ---------------- Activity ---------------- */

function renderActivity() {
  const pend = cache.bookings.filter(b => b.status === "pending");
  const overdue = cache.bookings.filter(isOverdue);
  const usage = [];
  cache.bookings.forEach(b => Object.entries(b.pickups || {}).forEach(([gid, p]) => {
    if (p.pickedAt) usage.push({ gear: gearById(gid), booking: b, p });
  }));
  usage.sort((a, b) => b.p.pickedAt - a.p.pickedAt);

  $("#view").innerHTML = `
    <div class="toolbar"><h2>Activity</h2><div class="spacer"></div>
      <button class="btn" id="csvUsage">⬇ Usage CSV</button></div>
    ${overdue.length ? `
      <div class="admin-section" style="border-color:var(--red)">
        <h3>🚨 Overdue returns (${overdue.length})</h3>
        <div class="shoot-list">${overdue.map(bookingCard).join("")}</div>
      </div>` : ""}
    ${me && me.role === "manager" && pend.length ? `
      <div class="admin-section">
        <h3>⏳ Pending approvals (${pend.length})</h3>
        <div class="shoot-list">${pend.map(bookingCard).join("")}</div>
      </div>` : ""}
    <div class="admin-section">
      <h3>Usage history</h3>
      ${usage.length ? `<table>
        <tr><th>Gear</th><th>Booking</th><th>By</th><th>Picked up</th><th>Returned</th><th>Duration</th></tr>
        ${usage.slice(0, 40).map(u => `<tr>
          <td><b>${esc(u.gear ? u.gear.name : "?")}</b><br><span class="mono" style="font-size:11px;color:var(--muted)">${u.gear ? u.gear.id : ""}</span></td>
          <td>${esc(u.booking.name)}</td>
          <td>${esc(memberById(u.p.byId || u.booking.requesterId).name)}</td>
          <td>${fmtTime(u.p.pickedAt)}</td>
          <td>${u.p.returnedAt ? fmtTime(u.p.returnedAt) + (u.p.inCond === "damaged" ? ` <span class="late">DMG</span>` : "") : `<span class="badge in_use">still out</span>`}</td>
          <td class="mono">${elapsed((u.p.returnedAt || Date.now()) - u.p.pickedAt)}</td>
        </tr>`).join("")}</table>` : `<div class="empty">No pickups yet — approve a booking and scan some gear.</div>`}
    </div>
    <div class="admin-section">
      <h3>Event log</h3>
      ${cache.log.map(l => `<div class="log-line"><span class="t">${fmtTime(l.ts)}</span>${esc(l.msg)}</div>`).join("") || `<div class="empty">Quiet so far.</div>`}
    </div>`;
  wireBookingCardActions();
  $("#csvUsage").addEventListener("click", exportUsageCsv);
}

/* ---------------- boot ---------------- */

async function boot() {
  if ((window.APP_CONFIG || {}).loadDemoSeed !== false) await loadSeedIfEmpty();
  await refresh();
  // restore session member
  const savedId = sessionStorage.getItem("gw_member");
  me = cache.members.find(m => m.id === savedId) || null;
  $$("nav button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $("#memberSel").addEventListener("change", e => {
    me = cache.members.find(m => m.id === e.target.value) || null;
    managerUnlocked = false;
    sessionStorage.setItem("gw_member", me ? me.id : "");
    toast(me ? `Hi ${me.name}` : "Signed out");
    render();
  });
  window.addEventListener("beforeunload", stopScanner);
  render();
}
// Boot after ALL scripts (manage.js defines calendar/manage/settings views).
window.addEventListener("DOMContentLoaded", boot);
