/* Gear Wall — app logic
 * Tabs: Wall (gear library) / Calendar (shoots + booking) / Scanner (QR pickup & return) / Activity
 * Admin mode toggle gates approvals, damage marking and adding gear.
 * Persistence: localStorage. QR encode: qrcode-generator. QR decode: jsQR + getUserMedia.
 */

const LS_KEY = "gearwall_state_v1";
const QR_PREFIX = "gearwall:";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- state ---------------- */

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function freshState() {
  return {
    gear: SEED_GEAR.map(g => ({ ...g })),
    shoots: SEED_SHOOTS.map((s, i) => ({
      id: "SH-" + String(i + 1).padStart(3, "0"),
      name: s.name, location: s.location, project: s.project,
      requester: s.requester, gearIds: [...s.gearIds],
      date: todayStr(s.offset), status: s.status, pickups: {}
    })),
    log: [{ ts: Date.now(), msg: "Gear Wall initialized with seed inventory (" + SEED_GEAR.length + " items)." }],
    nextShoot: SEED_SHOOTS.length + 1,
    admin: false
  };
}

let state = (() => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through to fresh */ }
  const s = freshState();
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  return s;
})();

function persist() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function addLog(msg) {
  state.log.unshift({ ts: Date.now(), msg });
  state.log = state.log.slice(0, 120);
}

/* ---------------- helpers ---------------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function gearById(id) { return state.gear.find(g => g.id === id); }
function shootById(id) { return state.shoots.find(s => s.id === id); }
function fmtTime(ts) { return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function fmtClock(ts) { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h " + (m % 60) + "m";
  return Math.floor(h / 24) + "d " + (h % 24) + "h";
}

// The shoot a gear item is currently out on (picked up, not returned)
function activePickup(gearId) {
  for (const s of state.shoots) {
    const p = s.pickups[gearId];
    if (p && p.pickedAt && !p.returnedAt) return { shoot: s, pickup: p };
  }
  return null;
}
// The next approved shoot that includes this gear and hasn't picked it up yet
function nextApprovedBooking(gearId) {
  return state.shoots
    .filter(s => s.status === "approved" && s.gearIds.includes(gearId) && !(s.pickups[gearId] && s.pickups[gearId].pickedAt))
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
function pendingCount() { return state.shoots.filter(s => s.status === "pending").length; }

/* ---------------- QR ---------------- */

function qrSvg(text, sizePx) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = Math.max(1, Math.floor(sizePx / n));
  const dim = n * cell;
  let rects = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}

/* ---------------- toast ---------------- */

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ---------------- tabs ---------------- */

let currentTab = "wall";
let calCursor = new Date(); // month shown in calendar

function setTab(tab) {
  stopScanner();
  currentTab = tab;
  $$("nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  render();
}

function render() {
  updateNavBadge();
  const view = { wall: renderWall, calendar: renderCalendar, scanner: renderScanner, activity: renderActivity }[currentTab];
  view();
}

function updateNavBadge() {
  const n = pendingCount();
  $("#pendingBadge").innerHTML = n && state.admin ? `<span class="badge-inline"></span>` : "";
  $("#calTabBtn").innerHTML = `Calendar${n ? ` <span class="badge">${n}</span>` : ""}`;
}

/* ---------------- Wall ---------------- */

let wallFilter = "All";
let wallTick = null;

function renderWall() {
  clearInterval(wallTick);
  const cats = ["All", ...new Set(state.gear.map(g => g.category))];
  const avail = state.gear.filter(g => g.status === "available").length;
  const inUse = state.gear.filter(g => g.status === "in_use").length;
  const damaged = state.gear.filter(g => g.status === "damaged").length;
  const activeShoots = state.shoots.filter(s => s.status === "approved" && Object.values(s.pickups).some(p => p.pickedAt && !p.returnedAt)).length;

  const cards = state.gear
    .filter(g => wallFilter === "All" || g.category === wallFilter)
    .map(g => {
      const out = activePickup(g.id);
      const booking = nextApprovedBooking(g.id);
      let useInfo = "";
      if (out) {
        useInfo = `<div class="use-info">Out for <b>${esc(out.shoot.name)}</b> · picked up ${fmtClock(out.pickup.pickedAt)} · in use <b data-since="${out.pickup.pickedAt}">${elapsed(Date.now() - out.pickup.pickedAt)}</b></div>`;
      } else if (booking && g.status !== "damaged") {
        useInfo = `<div class="use-info">Reserved for <b>${esc(booking.name)}</b> on ${booking.date}</div>`;
      }
      const actions = [];
      if (out) actions.push(`<button class="btn sm green" data-return="${g.id}">↩ Return</button>`);
      if (state.admin && g.status !== "in_use") {
        actions.push(g.status === "damaged"
          ? `<button class="btn sm" data-fix="${g.id}">✓ Mark repaired</button>`
          : `<button class="btn sm danger" data-damage="${g.id}">⚠ Mark damaged</button>`);
      }
      return `
        <div class="gear-card">
          <div class="top">
            <div>
              <h3>${esc(g.name)}</h3>
              <div class="cat">${esc(g.category)}</div>
            </div>
            <div class="qr" data-zoom="${g.id}" title="Show printable QR label">${qrSvg(QR_PREFIX + g.id, 58)}</div>
          </div>
          <div class="id">${g.id}</div>
          <div class="home">📍 ${esc(g.home)}</div>
          <div class="status-row">
            <span class="badge ${g.status}">${{ available: "Available", in_use: "In use", damaged: "Damaged" }[g.status]}</span>
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
      <div class="stat blue"><div class="n">${activeShoots}</div><div class="l">Active shoots</div></div>
      <div class="stat"><div class="n">${state.gear.length}</div><div class="l">Total gear</div></div>
    </div>
    <div class="toolbar">
      <h2>The Wall</h2>
      <div class="chip-row">${cats.map(c => `<button class="chip ${c === wallFilter ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="spacer"></div>
      <button class="btn" id="printBtn">🖨 Print QR labels</button>
      ${state.admin ? `<button class="btn amber" id="addGearBtn">+ Add gear</button>` : ""}
    </div>
    <div class="wall">${cards || `<div class="empty">No gear in this category.</div>`}</div>`;

  $$("[data-cat]").forEach(b => b.addEventListener("click", () => { wallFilter = b.dataset.cat; renderWall(); }));
  $$("[data-zoom]").forEach(b => b.addEventListener("click", () => showQrModal(b.dataset.zoom)));
  $$("[data-return]").forEach(b => b.addEventListener("click", () => returnGear(b.dataset.return)));
  $$("[data-damage]").forEach(b => b.addEventListener("click", () => setDamaged(b.dataset.damage, true)));
  $$("[data-fix]").forEach(b => b.addEventListener("click", () => setDamaged(b.dataset.fix, false)));
  $("#printBtn").addEventListener("click", () => window.print());
  if (state.admin) $("#addGearBtn").addEventListener("click", showAddGearModal);

  // live "in use" timers
  wallTick = setInterval(() => {
    $$("[data-since]").forEach(el => { el.textContent = elapsed(Date.now() - Number(el.dataset.since)); });
  }, 30000);
}

function setDamaged(id, damaged) {
  const g = gearById(id);
  if (!g) return;
  g.status = damaged ? "damaged" : "available";
  if (!damaged) g.notes = "";
  else if (!g.notes) g.notes = "Marked damaged — pending inspection";
  addLog(`${g.name} (${g.id}) marked ${damaged ? "DAMAGED" : "repaired & available"}.`);
  persist();
  toast(damaged ? `${g.name} marked damaged` : `${g.name} back in service`);
  render();
}

function showQrModal(id) {
  const g = gearById(id);
  openModal(`
    <div class="qr-zoom">
      <h3>${esc(g.name)}</h3>
      <div class="sub">Stick this label on the equipment. Scanning it picks up / returns the item.</div>
      <div class="qr-big">${qrSvg(QR_PREFIX + g.id, 220)}</div>
      <div class="id">${QR_PREFIX}${g.id}</div>
      <div class="actions" style="justify-content:center">
        <button class="btn" data-close>Close</button>
      </div>
    </div>`);
}

function showAddGearModal() {
  const cats = [...new Set(state.gear.map(g => g.category))];
  openModal(`
    <h3>Add gear</h3>
    <div class="sub">New equipment gets a QR identity immediately.</div>
    <label>Name</label><input id="ngName" placeholder="e.g. Sony A7S III" maxlength="60">
    <label>Category</label>
    <select id="ngCat">${cats.map(c => `<option>${esc(c)}</option>`).join("")}<option>Other</option></select>
    <label>Home location</label><input id="ngHome" placeholder="e.g. Studio 1 · Shelf B" maxlength="60">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="ngSave">Add to wall</button>
    </div>`);
  $("#ngSave").addEventListener("click", () => {
    const name = $("#ngName").value.trim();
    if (!name) { $("#ngName").focus(); return; }
    const cat = $("#ngCat").value;
    const prefix = "GW-" + cat.slice(0, 3).toUpperCase() + "-";
    const maxNum = state.gear.filter(g => g.id.startsWith(prefix))
      .reduce((m, g) => Math.max(m, Number(g.id.slice(prefix.length)) || 0), 0);
    const id = prefix + String(maxNum + 1).padStart(3, "0");
    state.gear.push({ id, name, category: cat, home: $("#ngHome").value.trim() || "Unassigned", status: "available", notes: "" });
    addLog(`New gear added: ${name} (${id}).`);
    persist();
    closeModal();
    toast(`${name} added as ${id}`);
    render();
  });
}

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
  const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  dows.forEach(d => cells += `<div class="cal-dow">${d}</div>`);

  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const dateStr = inMonth ? `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : null;
    const shoots = inMonth ? state.shoots.filter(s => s.date === dateStr && s.status !== "rejected") : [];
    const chips = shoots.slice(0, 3).map(s =>
      `<div class="cal-shoot ${s.status}" title="${esc(s.name)} — ${s.status}">${s.status === "pending" ? "⏳ " : ""}${esc(s.name)}</div>`).join("");
    const more = shoots.length > 3 ? `<div class="cal-shoot done">+${shoots.length - 3} more</div>` : "";
    cells += `<div class="cal-cell ${inMonth ? "" : "other"} ${dateStr === today ? "today" : ""}" ${inMonth ? `data-date="${dateStr}"` : ""}>
      ${inMonth ? `<span class="d">${dayNum}</span>${chips}${more}` : ""}
    </div>`;
  }

  const upcoming = state.shoots
    .filter(s => s.status !== "rejected")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => shootCard(s)).join("");

  $("#view").innerHTML = `
    <div class="toolbar">
      <h2>Shoot Calendar</h2>
      <div class="spacer"></div>
      <button class="btn amber" id="plusShoot">+ Shoot</button>
    </div>
    <div class="cal-head">
      <button class="btn sm" id="calPrev">←</button>
      <h3>${monthName}</h3>
      <button class="btn sm" id="calNext">→</button>
      <button class="btn sm" id="calToday">Today</button>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="toolbar" style="margin-top:30px"><h2>All shoots</h2></div>
    <div class="shoot-list">${upcoming || `<div class="empty">No shoots yet — schedule one with “+ Shoot”.</div>`}</div>`;

  $("#calPrev").addEventListener("click", () => { calCursor = new Date(y, m - 1, 1); renderCalendar(); });
  $("#calNext").addEventListener("click", () => { calCursor = new Date(y, m + 1, 1); renderCalendar(); });
  $("#calToday").addEventListener("click", () => { calCursor = new Date(); renderCalendar(); });
  $("#plusShoot").addEventListener("click", () => showShootModal(today));
  $$(".cal-cell[data-date]").forEach(c => c.addEventListener("click", e => {
    if (e.target.closest(".cal-shoot")) return showDayModal(c.dataset.date);
    showShootModal(c.dataset.date);
  }));
  wireShootCardActions();
}

function shootCard(s) {
  const d = new Date(s.date + "T00:00:00");
  const statusBadge = {
    pending: `<span class="badge pending">Pending approval</span>`,
    approved: `<span class="badge available">Approved</span>`,
    done: `<span class="badge in_use" style="background:var(--panel2);color:var(--muted)">Done</span>`,
    rejected: `<span class="badge damaged">Rejected</span>`
  }[s.status];
  const tags = s.gearIds.map(id => {
    const g = gearById(id);
    const p = s.pickups[id];
    const cls = p && p.returnedAt ? "returned" : (p && p.pickedAt ? "picked" : "");
    const suffix = p && p.returnedAt ? " ✓" : (p && p.pickedAt ? " ·out" : "");
    return `<span class="gear-tag ${cls}" title="${esc(g ? g.name : id)}">${esc(g ? g.name : id)}${suffix}</span>`;
  }).join("");
  const adminBtns = state.admin && s.status === "pending"
    ? `<button class="btn sm green" data-approve="${s.id}">✓ Approve</button>
       <button class="btn sm danger" data-reject="${s.id}">✕ Reject</button>` : "";
  const doneBtn = state.admin && s.status === "approved"
    ? `<button class="btn sm" data-done="${s.id}">Mark done</button>` : "";
  return `
    <div class="shoot-card">
      <div class="when">
        <div class="dd">${String(d.getDate()).padStart(2, "0")}</div>
        <div class="mm">${d.toLocaleString([], { month: "short" })}</div>
      </div>
      <div class="info">
        <h4>${esc(s.name)}</h4>
        <div class="meta">📍 ${esc(s.location)} &nbsp;·&nbsp; 🎬 ${esc(s.project)} &nbsp;·&nbsp; requested by <b>${esc(s.requester)}</b></div>
        <div class="gear-tags">${tags}</div>
      </div>
      <div class="side">
        ${statusBadge}
        <div style="display:flex;gap:8px">${adminBtns}${doneBtn}</div>
      </div>
    </div>`;
}

function wireShootCardActions() {
  $$("[data-approve]").forEach(b => b.addEventListener("click", () => {
    const s = shootById(b.dataset.approve);
    s.status = "approved";
    addLog(`Shoot “${s.name}” approved — gear can now be picked up by scanning.`);
    persist(); toast(`Approved: ${s.name}`); render();
  }));
  $$("[data-reject]").forEach(b => b.addEventListener("click", () => {
    const s = shootById(b.dataset.reject);
    s.status = "rejected";
    addLog(`Shoot “${s.name}” rejected.`);
    persist(); toast(`Rejected: ${s.name}`); render();
  }));
  $$("[data-done]").forEach(b => b.addEventListener("click", () => {
    const s = shootById(b.dataset.done);
    // return anything still out
    Object.entries(s.pickups).forEach(([gid, p]) => {
      if (p.pickedAt && !p.returnedAt) doReturn(gid, s, true);
    });
    s.status = "done";
    addLog(`Shoot “${s.name}” marked done.`);
    persist(); toast(`Done: ${s.name}`); render();
  }));
}

function showDayModal(dateStr) {
  const shoots = state.shoots.filter(s => s.date === dateStr && s.status !== "rejected");
  openModal(`
    <h3>${new Date(dateStr + "T00:00:00").toDateString()}</h3>
    <div class="sub">${shoots.length} shoot${shoots.length !== 1 ? "s" : ""} scheduled</div>
    <div class="shoot-list">${shoots.map(shootCard).join("") || `<div class="empty">Nothing scheduled.</div>`}</div>
    <div class="actions">
      <button class="btn" data-close>Close</button>
      <button class="btn amber" id="dayPlus">+ Shoot on this day</button>
    </div>`);
  wireShootCardActions();
  $("#dayPlus").addEventListener("click", () => { closeModal(); showShootModal(dateStr); });
}

function showShootModal(dateStr) {
  const gearOptions = state.gear.map(g => {
    const disabled = g.status === "damaged";
    return `
      <label class="${disabled ? "disabled" : ""}">
        <input type="checkbox" value="${g.id}" ${disabled ? "disabled" : ""}>
        <span>${esc(g.name)}<span class="sub-id">${g.id}${disabled ? " · damaged" : ""}</span></span>
      </label>`;
  }).join("");
  openModal(`
    <h3>Schedule a shoot</h3>
    <div class="sub">Booking gear puts a request in front of an admin. Once approved, scan the QR on each item to pick it up.</div>
    <label>Shoot name</label><input id="shName" placeholder="e.g. VM shoot one" maxlength="60">
    <label>Date</label><input id="shDate" type="date" value="${dateStr}">
    <label>Location</label>
    <select id="shLoc">${LOCATIONS.map(l => `<option>${esc(l)}</option>`).join("")}</select>
    <div id="shOutdoorWrap" style="display:none"><label>Where outdoors?</label><input id="shOutdoor" placeholder="e.g. Indiranagar rooftop" maxlength="60"></div>
    <label>IP / Project</label>
    <select id="shProj">${PROJECTS.map(p => `<option>${esc(p)}</option>`).join("")}</select>
    <label>Gear needed</label>
    <div class="gear-pick">${gearOptions}</div>
    <label>Your name</label><input id="shWho" placeholder="Requester" maxlength="40">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn amber" id="shSave">Request booking</button>
    </div>`);

  const locSel = $("#shLoc");
  locSel.addEventListener("change", () => {
    $("#shOutdoorWrap").style.display = locSel.value === "Outdoor" ? "" : "none";
  });
  $$(".gear-pick input").forEach(cb => cb.addEventListener("change", () => {
    cb.closest("label").classList.toggle("sel", cb.checked);
  }));
  $("#shSave").addEventListener("click", () => {
    const name = $("#shName").value.trim();
    const who = $("#shWho").value.trim();
    const picked = $$(".gear-pick input:checked").map(cb => cb.value);
    if (!name) { $("#shName").focus(); return; }
    if (!who) { $("#shWho").focus(); return; }
    if (!picked.length) { toast("Pick at least one piece of gear"); return; }
    let location = locSel.value;
    if (location === "Outdoor") {
      const where = $("#shOutdoor").value.trim();
      location = where ? `Outdoor — ${where}` : "Outdoor";
    }
    const id = "SH-" + String(state.nextShoot++).padStart(3, "0");
    state.shoots.push({
      id, name, location, project: $("#shProj").value,
      requester: who, gearIds: picked, date: $("#shDate").value || todayStr(),
      status: "pending", pickups: {}
    });
    addLog(`Booking requested: “${name}” by ${who} (${picked.length} item${picked.length > 1 ? "s" : ""}) — pending approval.`);
    persist();
    closeModal();
    toast("Request sent — pending admin approval");
    render();
  });
}

/* ---------------- Scanner ---------------- */

let scanStream = null;
let scanRAF = null;

function renderScanner() {
  $("#view").innerHTML = `
    <div class="scanner-wrap">
      <div class="toolbar" style="justify-content:center"><h2>Scan gear QR</h2></div>
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
        ${state.gear.slice(0, 6).map(g => `<button class="btn sm" data-sim="${g.id}">▣ Simulate scan · ${g.id}</button>`).join("")}
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
      Use the manual entry or a simulate button below instead — same flow, no camera needed.</p></div>`;
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
  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
}

function handleCode(raw) {
  if (!raw) return;
  const id = raw.startsWith(QR_PREFIX) ? raw.slice(QR_PREFIX.length) : raw;
  const g = gearById(id.toUpperCase());
  const box = $("#scanResult");
  if (!g) {
    box.innerHTML = `<div class="scan-result err"><h4>Unknown code</h4>
      <p><code>${esc(raw)}</code> doesn't match anything on the wall.</p></div>`;
    return;
  }
  const out = activePickup(g.id);
  if (out) {
    // gear is out → this scan is a return
    doReturn(g.id, out.shoot);
    const p = out.shoot.pickups[g.id];
    box.innerHTML = `<div class="scan-result ok"><h4>↩ ${esc(g.name)} returned</h4>
      <p>Back from <b>${esc(out.shoot.name)}</b> after ${elapsed(p.returnedAt - p.pickedAt)}. Status: <b>Available</b>. Put it back at ${esc(g.home)}.</p></div>`;
    return;
  }
  if (g.status === "damaged") {
    box.innerHTML = `<div class="scan-result err"><h4>⚠ ${esc(g.name)} is marked damaged</h4>
      <p>${esc(g.notes || "This item is out of service.")} Talk to an admin before taking it.</p></div>`;
    return;
  }
  const booking = nextApprovedBooking(g.id);
  if (!booking) {
    const pendingBooking = state.shoots.find(s => s.status === "pending" && s.gearIds.includes(g.id));
    box.innerHTML = `<div class="scan-result warn"><h4>${esc(g.name)} — no approved booking</h4>
      <p>${pendingBooking
        ? `It's requested for <b>${esc(pendingBooking.name)}</b> but that shoot is still <b>pending approval</b>. Ask an admin to approve it first.`
        : `Nobody has booked this item. Schedule a shoot on the calendar first, get it approved, then scan to pick up.`}</p></div>`;
    return;
  }
  // pick up
  booking.pickups[g.id] = { pickedAt: Date.now(), returnedAt: null };
  g.status = "in_use";
  addLog(`${g.name} (${g.id}) PICKED UP for “${booking.name}” by ${booking.requester}.`);
  persist();
  toast(`${g.name} picked up`);
  box.innerHTML = `<div class="scan-result ok"><h4>✓ ${esc(g.name)} picked up</h4>
    <p>Checked out for <b>${esc(booking.name)}</b> (${booking.date}, ${esc(booking.location)}). Scan the same code when you bring it back — the wall now shows it as <b>In use</b>.</p></div>`;
}

function doReturn(gearId, shoot, silent = false) {
  const g = gearById(gearId);
  const p = shoot.pickups[gearId];
  if (!p || p.returnedAt) return;
  p.returnedAt = Date.now();
  g.status = "available";
  addLog(`${g.name} (${g.id}) RETURNED from “${shoot.name}” after ${elapsed(p.returnedAt - p.pickedAt)}.`);
  persist();
  if (!silent) toast(`${g.name} returned`);
}

function returnGear(gearId) {
  const out = activePickup(gearId);
  if (out) { doReturn(gearId, out.shoot); render(); }
}

/* ---------------- Activity ---------------- */

function renderActivity() {
  const pend = state.shoots.filter(s => s.status === "pending");
  const usage = [];
  state.shoots.forEach(s => Object.entries(s.pickups).forEach(([gid, p]) => {
    if (p.pickedAt) usage.push({ gear: gearById(gid), shoot: s, p });
  }));
  usage.sort((a, b) => b.p.pickedAt - a.p.pickedAt);

  $("#view").innerHTML = `
    <div class="toolbar"><h2>Activity</h2></div>
    ${state.admin && pend.length ? `
      <div class="admin-section">
        <h3>⏳ Pending approvals (${pend.length})</h3>
        <div class="shoot-list">${pend.map(shootCard).join("")}</div>
      </div>` : ""}
    <div class="admin-section">
      <h3>Usage history</h3>
      ${usage.length ? `<table>
        <tr><th>Gear</th><th>Shoot</th><th>Picked up</th><th>Returned</th><th>Duration</th></tr>
        ${usage.map(u => `<tr>
          <td><b>${esc(u.gear ? u.gear.name : "?")}</b><br><span style="font-family:var(--mono);font-size:11px;color:var(--muted)">${u.gear ? u.gear.id : ""}</span></td>
          <td>${esc(u.shoot.name)}</td>
          <td>${fmtTime(u.p.pickedAt)}</td>
          <td>${u.p.returnedAt ? fmtTime(u.p.returnedAt) : `<span class="badge in_use">still out</span>`}</td>
          <td style="font-family:var(--mono)">${elapsed((u.p.returnedAt || Date.now()) - u.p.pickedAt)}</td>
        </tr>`).join("")}</table>` : `<div class="empty">No pickups yet — approve a shoot and scan some gear.</div>`}
    </div>
    <div class="admin-section">
      <h3>Event log</h3>
      ${state.log.map(l => `<div class="log-line"><span class="t">${fmtTime(l.ts)}</span><b></b>${esc(l.msg)}</div>`).join("") || `<div class="empty">Quiet so far.</div>`}
    </div>`;
  wireShootCardActions();
}

/* ---------------- modal ---------------- */

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
function closeModal() {
  const m = $("#modalBack");
  if (m) m.remove();
}

/* ---------------- header wiring & boot ---------------- */

$$("nav button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
const adminSwitch = $("#adminSwitch");
function reflectAdmin() {
  adminSwitch.classList.toggle("on", state.admin);
  $("#adminLabel").textContent = state.admin ? "Admin mode" : "Crew mode";
}
adminSwitch.addEventListener("click", () => {
  state.admin = !state.admin;
  persist();
  reflectAdmin();
  toast(state.admin ? "Admin mode — you can approve shoots" : "Crew mode");
  render();
});
window.addEventListener("beforeunload", stopScanner);

reflectAdmin();
render();
