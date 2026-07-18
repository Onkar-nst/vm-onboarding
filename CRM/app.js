/* Admissions CRM — core: boot, cache, helpers, scoring, Dashboard, My Day.
 * Pipeline board + lead 360 live in pipeline.js.
 * Admissions/manage/settings in manage.js. Outreach/events/reports in reports.js.
 * All persistence goes through Store (store.js) — no direct localStorage use for data.
 */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const DAYMS = 86400000;

/* ---------------- in-memory cache over the Store ---------------- */

const cache = {
  settings: null, users: [], allUsers: [], courses: [], allCourses: [],
  sources: [], allSources: [], stages: [], leads: [], activities: [],
  tasks: [], payments: [], templates: [], events: [], log: []
};

async function refresh() {
  const [settingsList, users, courses, sources, stages, leads, activities, tasks, payments, templates, events, log] =
    await Promise.all([
      Store.list("settings"), Store.list("users"), Store.list("courses"), Store.list("sources"),
      Store.list("stages"), Store.list("leads"), Store.list("activities"), Store.list("tasks"),
      Store.list("payments"), Store.list("templates"), Store.list("events"), Store.list("log")
    ]);

  cache.settings = settingsList.find(s => s.id === "settings") || {
    id: "settings", orgName: "Your Institution", orgShort: "INST", adminPin: "1234",
    currency: "₹", academicYear: "2026–27", firstResponseSlaMins: 60, coldAfterDays: 7,
    assignMode: "round_robin", wonStage: "enrolled", lostStage: "lost",
    scoreWeights: { activity: 6, stage: 10, recency: 12, source: 8, fit: 10 }
  };

  cache.allUsers = users;
  cache.users = users.filter(u => u.active !== false);
  cache.allCourses = courses;
  cache.courses = courses.filter(c => c.active !== false);
  cache.allSources = sources;
  cache.sources = sources.filter(s => s.active !== false);
  cache.stages = stages.sort((a, b) => a.order - b.order);
  cache.leads = leads;
  cache.activities = activities.sort((a, b) => b.ts - a.ts);
  cache.tasks = tasks;
  cache.payments = payments;
  cache.templates = templates;
  cache.events = events.filter(e => e.active !== false);
  cache.allEvents = events;
  cache.log = log.sort((a, b) => b.ts - a.ts).slice(0, 200);
}

async function addLog(msg) {
  const id = await Store.nextId("LOG");
  await Store.put("log", { id, ts: Date.now(), msg });
}

/* ---------------- session (current user + admin unlock) ---------------- */

let me = null;              // current user doc
let adminUnlocked = false;  // PIN entered this session

function isAdmin() { return me && me.role === "admin" && adminUnlocked; }

async function requireAdmin(then) {
  if (isAdmin()) return then();
  if (!me || me.role !== "admin") { toast("Switch to an admin profile first (top right)"); return; }
  openModal(`
    <h3>Admin PIN</h3>
    <div class="sub">Enter the admin PIN to unlock management actions for this session.</div>
    <label>PIN</label><input id="pinInput" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn brand" id="pinGo">Unlock</button>
    </div>`);
  const tryPin = () => {
    if ($("#pinInput").value === String(cache.settings.adminPin)) {
      adminUnlocked = true;
      closeModal();
      toast("Admin actions unlocked");
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

/* ---------------- primitives ---------------- */

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2800);
}
function openModal(html, wide) {
  closeModal();
  const back = document.createElement("div");
  back.className = "modal-back";
  back.id = "modalBack";
  back.innerHTML = `<div class="modal${wide ? " wide" : ""}">${html}</div>`;
  document.body.appendChild(back);
  back.addEventListener("click", e => { if (e.target === back) closeModal(); });
  $$("[data-close]", back).forEach(b => b.addEventListener("click", closeModal));
}
function closeModal() { const m = $("#modalBack"); if (m) m.remove(); }

function money(n) {
  const cur = (cache.settings && cache.settings.currency) || "₹";
  const v = Math.round(Number(n) || 0);
  // Indian grouping — the market this is sold into reads 1,85,000 not 185,000
  const s = String(Math.abs(v));
  let out;
  if (s.length <= 3) out = s;
  else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    out = rest + "," + last3;
  }
  return (v < 0 ? "-" : "") + cur + out;
}
function moneyShort(n) {
  const cur = (cache.settings && cache.settings.currency) || "₹";
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000000) return cur + (v / 10000000).toFixed(2) + " Cr";
  if (Math.abs(v) >= 100000) return cur + (v / 100000).toFixed(1) + " L";
  if (Math.abs(v) >= 1000) return cur + Math.round(v / 1000) + "k";
  return money(v);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" }) : "—"; }
function fmtDateTime(ts) { return ts ? new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function ago(ts) {
  if (!ts) return "never";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 30) return d + "d ago";
  return Math.floor(d / 30) + "mo ago";
}
function dueLabel(ts) {
  const days = Math.round((ts - startOfToday()) / DAYMS);
  if (days < -1) return Math.abs(days) + " days overdue";
  if (days === -1) return "1 day overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return "Due in " + days + " days";
}

/* ---------------- domain lookups ---------------- */

function leadById(id) { return cache.leads.find(l => l.id === id); }
function userById(id) { return cache.allUsers.find(u => u.id === id) || { id, name: "Unassigned", role: "—" }; }
function courseById(id) { return cache.allCourses.find(c => c.id === id) || { id, name: "—", fee: 0, docs: [] }; }
function sourceById(id) { return cache.allSources.find(s => s.id === id) || { id, name: "—", spend: 0, quality: 0.5 }; }
function stageById(id) { return cache.stages.find(s => s.id === id) || { id, name: id, kind: "open", sla: 0 }; }
function activitiesFor(id) { return cache.activities.filter(a => a.leadId === id); }
function tasksFor(id) { return cache.tasks.filter(t => t.leadId === id); }
function paymentsFor(id) { return cache.payments.filter(p => p.leadId === id); }
function openStages() { return cache.stages.filter(s => s.kind === "open"); }
function wonStageId() { return (cache.stages.find(s => s.kind === "won") || { id: "enrolled" }).id; }
function lostStageId() { return (cache.stages.find(s => s.kind === "lost") || { id: "lost" }).id; }
function isOpen(l) { return stageById(l.stage).kind === "open"; }
function isWon(l) { return stageById(l.stage).kind === "won"; }
function isLost(l) { return stageById(l.stage).kind === "lost"; }

/* ---------------- lead scoring ----------------
 * Five weighted signals, all tunable in Settings. The point is not statistical
 * purity — it is that a counsellor opening the board at 9am sees the 20 leads
 * worth calling first, instead of 400 rows sorted by date.
 */

function scoreLead(l) {
  const w = cache.settings.scoreWeights || { activity: 6, stage: 10, recency: 12, source: 8, fit: 10 };
  const acts = activitiesFor(l.id);
  let score = 0;

  // engagement: how much two-way contact has happened (caps out at 5 touches)
  score += Math.min(5, acts.length) * w.activity;

  // progress: how far down the funnel they already are
  const order = stageById(l.stage).order || 1;
  score += Math.min(5, order) * w.stage;

  // recency: a lead touched today is worth far more than one cold for a month
  const days = (Date.now() - (l.lastActivityAt || l.createdAt)) / DAYMS;
  const recency = days <= 1 ? 5 : days <= 3 ? 4 : days <= 7 ? 3 : days <= 14 ? 2 : days <= 30 ? 1 : 0;
  score += recency * w.recency;

  // source quality: a walk-in converts far better than a portal scrape
  score += (sourceById(l.sourceId).quality || 0.5) * 5 * w.source;

  // academic fit: marks against the programme's typical bar
  const marks = Number(l.marks12) || 0;
  const fit = marks >= 90 ? 5 : marks >= 80 ? 4 : marks >= 70 ? 3 : marks >= 60 ? 2 : marks > 0 ? 1 : 2;
  score += fit * w.fit;

  const max = 5 * (w.activity + w.stage + w.recency + w.source + w.fit);
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
}
function scoreBand(s) { return s >= 67 ? "hot" : s >= 40 ? "warm" : "cold"; }
function scoreHtml(l) {
  const s = scoreLead(l), b = scoreBand(s);
  return `<span class="score ${b}" title="Lead score ${s}/100"><i><b style="width:${s}%"></b></i>${s}</span>`;
}

/* ---------------- health signals ---------------- */

// a new lead nobody has responded to inside the SLA window
function slaBreached(l) {
  if (!isOpen(l)) return false;
  if (l.firstResponseMins != null) return false;
  const mins = (Date.now() - l.createdAt) / 60000;
  return mins > (Number(cache.settings.firstResponseSlaMins) || 60);
}
// sitting in the current stage longer than that stage allows
function isStalled(l) {
  if (!isOpen(l)) return false;
  const sla = Number(stageById(l.stage).sla) || 0;
  if (!sla) return false;
  return (Date.now() - (l.lastActivityAt || l.createdAt)) / DAYMS > sla;
}
function isCold(l) {
  if (!isOpen(l)) return false;
  return (Date.now() - (l.lastActivityAt || l.createdAt)) / DAYMS > (Number(cache.settings.coldAfterDays) || 7);
}
function openTasksFor(id) { return tasksFor(id).filter(t => !t.done); }
function hasOverdueTask(l) { return openTasksFor(l.id).some(t => t.dueAt < startOfToday()); }

// leads the current user should see: counsellors see their own, admins see all
function visibleLeads() {
  if (!me || me.role === "admin") return cache.leads;
  return cache.leads.filter(l => l.ownerId === me.id);
}

/* ---------------- assignment ---------------- */

// round-robin over counsellors by current open load, so the newest lead lands
// with whoever is least busy rather than whoever is alphabetically first
async function pickOwner(courseId) {
  const mode = cache.settings.assignMode || "round_robin";
  const pool = cache.users.filter(u => u.role === "counsellor" || u.role === "telecaller");
  if (!pool.length) return (cache.users[0] || {}).id || null;
  if (mode === "manual") return null;
  if (mode === "by_course") {
    // stable hash of the course id → same counsellor owns a programme's funnel
    const idx = String(courseId).split("").reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length;
    return pool[idx].id;
  }
  const load = pool.map(u => ({
    u, n: cache.leads.filter(l => l.ownerId === u.id && stageById(l.stage).kind === "open").length
  }));
  load.sort((a, b) => a.n - b.n);
  return load[0].u.id;
}

// phone/email collision check — duplicate enquiries are the #1 data-hygiene
// complaint in every admissions office that runs on spreadsheets
function findDuplicate(phone, email, exceptId) {
  const p = String(phone || "").replace(/\D/g, "").slice(-10);
  const e = String(email || "").trim().toLowerCase();
  return cache.leads.find(l => {
    if (l.id === exceptId) return false;
    const lp = String(l.phone || "").replace(/\D/g, "").slice(-10);
    const le = String(l.email || "").trim().toLowerCase();
    return (p && lp === p) || (e && le === e);
  });
}

/* ---------------- shared writers ---------------- */

async function logActivity(leadId, type, note, extra) {
  const id = await Store.nextId("ACT");
  const act = {
    id, leadId, userId: me ? me.id : null, type, ts: Date.now(),
    note: note || "", outcome: "", durationSec: 0, ...(extra || {})
  };
  await Store.put("activities", act);
  const lead = leadById(leadId);
  if (lead) {
    lead.lastActivityAt = act.ts;
    // first outbound touch closes the response-time SLA
    if (lead.firstResponseMins == null && type !== "note") {
      lead.firstResponseMins = Math.max(1, Math.round((act.ts - lead.createdAt) / 60000));
    }
    await Store.put("leads", lead);
  }
  return act;
}

async function moveStage(leadId, toStage, reason) {
  const lead = leadById(leadId);
  if (!lead || lead.stage === toStage) return;
  const from = stageById(lead.stage).name, to = stageById(toStage).name;
  const fromOrder = stageById(lead.stage).order || 0;
  lead.stage = toStage;
  lead.lastActivityAt = Date.now();
  if (stageById(toStage).kind === "won") lead.enrolledAt = Date.now();
  if (stageById(toStage).kind === "lost") {
    lead.lostReason = reason || lead.lostReason || "Not specified";
    lead.lastStageOrder = fromOrder;   // remember where in the funnel it died
  }
  await Store.put("leads", lead);
  await logActivity(leadId, "stage", `Moved ${from} → ${to}${reason ? " · " + reason : ""}`);
  await addLog(`${lead.name} (${lead.id}) moved ${from} → ${to}.`);
}

/* ---------------- merge fields for templates ---------------- */

function mergeFields(lead) {
  const c = courseById(lead.courseId);
  const owner = userById(lead.ownerId);
  const done = Object.keys(lead.docs || {});
  return {
    name: lead.name,
    firstname: String(lead.name || "").split(" ")[0],
    course: c.name,
    fee: money(c.fee),
    intake: c.intake || "",
    org: cache.settings.orgName,
    year: cache.settings.academicYear,
    counsellor: owner.name,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    docchecklist: (c.docs || []).map(d => (done.includes(d) ? "✓ " : "• ") + d).join("\n")
  };
}
function applyTemplate(body, lead) {
  const f = mergeFields(lead);
  return String(body || "").replace(/\{\{(\w+)\}\}/g, (m, k) => (f[k] != null ? f[k] : m));
}

/* ---------------- render dispatch ---------------- */

let currentTab = "dashboard";

function updateChrome() {
  $("#orgName").textContent = cache.settings.orgName + " · " + cache.settings.academicYear;
  document.title = cache.settings.orgShort
    ? cache.settings.orgShort + " Admissions CRM"
    : "Admissions CRM";

  const admin = isAdmin();
  $("#manageTabBtn").style.display = admin ? "" : "none";
  $("#settingsTabBtn").style.display = admin ? "" : "none";

  const tag = $("#roleTag");
  tag.textContent = me ? (me.role === "admin" ? (admin ? "Admin" : "Admin · locked") : me.role) : "—";
  tag.className = "role-tag" + (admin ? " admin" : "");

  const due = myTasks().filter(t => t.dueAt <= startOfToday() + DAYMS - 1).length;
  const badge = $("#dueCount");
  badge.textContent = due;
  badge.style.display = due ? "" : "none";

  $$("nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === currentTab));
}

function render() {
  updateChrome();
  const view = {
    dashboard: renderDashboard,
    myday: renderMyDay,
    pipeline: renderPipeline,
    admissions: renderAdmissions,
    outreach: renderOutreach,
    events: renderEvents,
    reports: renderReports,
    manage: renderManage,
    settings: renderSettings
  }[currentTab] || renderDashboard;
  view();
}

function go(tab) { currentTab = tab; render(); window.scrollTo(0, 0); }

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
  const leads = visibleLeads();
  const open = leads.filter(isOpen);
  const won = leads.filter(isWon);
  const breached = open.filter(slaBreached);
  const stalled = open.filter(isStalled);
  const newToday = leads.filter(l => l.createdAt >= startOfToday());

  // pipeline value: fee of every open lead's target programme, weighted by score
  const weighted = open.reduce((sum, l) => sum + courseById(l.courseId).fee * (scoreLead(l) / 100), 0);
  const revenue = won.reduce((sum, l) => sum + courseById(l.courseId).fee, 0);
  const convRate = leads.length ? Math.round((won.length / leads.length) * 100) : 0;

  const funnelRows = cache.stages.filter(s => s.kind !== "lost").map(s => ({
    stage: s, n: leads.filter(l => l.stage === s.id).length
  }));
  const funnelMax = Math.max(1, ...funnelRows.map(r => r.n));

  // leads that reached at least this stage — the honest "funnel" view
  const reached = cache.stages.filter(s => s.kind !== "lost").map(s => ({
    stage: s,
    n: leads.filter(l => (stageById(l.stage).order || 0) >= s.order && !isLost(l)).length
  }));
  const top = reached.length ? reached[0].n : 0;

  $("#view").innerHTML = `
    <div class="toolbar">
      <div>
        <h2>Admissions dashboard</h2>
        <div class="sub-note">${esc(cache.settings.academicYear)} season · ${leads.length} enquiries · ${me ? esc(me.name) : "—"}</div>
      </div>
      <div class="spacer"></div>
      <button class="btn" id="dPub">Enquiry form ↗</button>
      <button class="btn brand" id="dNew">+ New enquiry</button>
    </div>

    <div class="stats">
      <div class="stat blue clickable" data-jump="pipeline"><div class="n">${open.length}</div><div class="l">Open leads</div><div class="d">${newToday.length} added today</div></div>
      <div class="stat green"><div class="n">${won.length}</div><div class="l">Enrolled</div><div class="d">${convRate}% of all enquiries</div></div>
      <div class="stat brand"><div class="n">${moneyShort(weighted)}</div><div class="l">Weighted pipeline</div><div class="d">${moneyShort(revenue)} confirmed</div></div>
      <div class="stat red clickable" data-jump="myday"><div class="n">${breached.length}</div><div class="l">SLA breached</div><div class="d">No reply in ${cache.settings.firstResponseSlaMins}m</div></div>
      <div class="stat amber clickable" data-jump="pipeline"><div class="n">${stalled.length}</div><div class="l">Stalled</div><div class="d">Past stage SLA</div></div>
      <div class="stat violet"><div class="n">${avgResponseMins(leads)}</div><div class="l">Avg 1st response</div><div class="d">minutes to first touch</div></div>
    </div>

    <div class="grid2">
      <div class="section">
        <h3>Admission funnel</h3>
        <div class="sub-note">Leads that reached each stage, and where they drop off.</div>
        <div class="funnel">
          ${reached.map((r, i) => {
            const pct = top ? Math.round((r.n / top) * 100) : 0;
            const prev = i > 0 ? reached[i - 1].n : r.n;
            const drop = prev - r.n;
            return `<div class="fn-row">
              <div class="lbl">${esc(r.stage.name)}</div>
              <div class="fn-track"><div class="fn-fill" style="width:${Math.max(pct, 4)}%;background:var(--${r.stage.color || "brand"})">${r.n}</div></div>
              <div class="pct">${pct}%${drop > 0 && i > 0 ? `<div class="fn-drop">−${drop}</div>` : ""}</div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="section">
        <h3>Counsellor leaderboard</h3>
        <div class="sub-note">Enrolments against target this season.</div>
        ${cache.users.filter(u => u.role !== "admin").map(u => {
          const mine = cache.leads.filter(l => l.ownerId === u.id);
          const w = mine.filter(isWon).length;
          const pct = u.target ? Math.min(100, Math.round((w / u.target) * 100)) : 0;
          return { u, mine, w, pct };
        }).sort((a, b) => b.w - a.w).map((r, i) => `
          <div class="lb-row">
            <div class="rk">${i + 1}</div>
            <div class="nm"><b>${esc(r.u.name)}</b><span>${r.mine.length} leads · ${r.mine.filter(isOpen).length} open</span></div>
            <div><div class="bar ${r.pct >= 80 ? "green" : r.pct >= 45 ? "" : "amber"}"><b style="width:${r.pct}%"></b></div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">${r.w} of ${r.u.target || "—"} target</div></div>
            <div class="vv">${r.pct}%</div>
          </div>`).join("") || `<div class="empty">No counsellors yet.</div>`}
      </div>
    </div>

    <div class="grid2">
      <div class="section">
        <h3>Needs attention now</h3>
        <div class="sub-note">Highest-scoring leads that are stalling — call these first.</div>
        ${(() => {
          const urgent = open.filter(l => isStalled(l) || slaBreached(l) || hasOverdueTask(l))
            .sort((a, b) => scoreLead(b) - scoreLead(a)).slice(0, 8);
          if (!urgent.length) return `<div class="empty">Nothing stalling. The whole board is inside SLA. 🎉</div>`;
          return `<div class="tbl-wrap"><table>
            <thead><tr><th>Lead</th><th>Stage</th><th>Score</th><th>Last touch</th><th>Flag</th></tr></thead>
            <tbody>${urgent.map(l => `
              <tr class="row-link" data-lead="${l.id}">
                <td><b>${esc(l.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(courseById(l.courseId).name)}</div></td>
                <td><span class="badge s-${l.stage}">${esc(stageById(l.stage).name)}</span></td>
                <td>${scoreHtml(l)}</td>
                <td style="font-size:12.5px;color:var(--muted)">${ago(l.lastActivityAt)}</td>
                <td>${slaBreached(l) ? '<span class="tag hot">SLA</span>' : hasOverdueTask(l) ? '<span class="tag hot">Overdue</span>' : '<span class="tag warm">Stalled</span>'}</td>
              </tr>`).join("")}</tbody></table></div>`;
        })()}
      </div>

      <div class="section">
        <h3>Where enquiries come from</h3>
        <div class="sub-note">Volume and conversion by source, this season.</div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Source</th><th class="num">Leads</th><th class="num">Enrolled</th><th class="num">Conv.</th><th class="num">Cost/adm.</th></tr></thead>
          <tbody>${cache.sources.map(s => {
            const ls = leads.filter(l => l.sourceId === s.id);
            const w = ls.filter(isWon).length;
            const conv = ls.length ? Math.round((w / ls.length) * 100) : 0;
            const cpa = w ? s.spend / w : null;
            return { s, n: ls.length, w, conv, cpa };
          }).filter(r => r.n).sort((a, b) => b.n - a.n).map(r => `
            <tr><td>${esc(r.s.name)}</td>
              <td class="num">${r.n}</td>
              <td class="num">${r.w}</td>
              <td class="num" style="color:${r.conv >= 20 ? "var(--green)" : r.conv >= 10 ? "var(--amber)" : "var(--red)"}">${r.conv}%</td>
              <td class="num">${r.cpa == null ? "—" : moneyShort(r.cpa)}</td></tr>`).join("")}
          </tbody></table></div>
      </div>
    </div>`;

  $("#dNew").addEventListener("click", () => showLeadModal(null));
  $("#dPub").addEventListener("click", () => window.open("enquiry.html", "_blank"));
  $$("[data-jump]").forEach(el => el.addEventListener("click", () => go(el.dataset.jump)));
  $$("[data-lead]").forEach(el => el.addEventListener("click", () => openLead(el.dataset.lead)));
}

function avgResponseMins(leads) {
  const vals = leads.map(l => l.firstResponseMins).filter(v => v != null && v > 0);
  if (!vals.length) return "—";
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/* ---------------- My Day ---------------- */

function myTasks() {
  if (!me) return [];
  return cache.tasks.filter(t => !t.done && (me.role === "admin" || t.userId === me.id));
}

function renderMyDay() {
  const tasks = myTasks().sort((a, b) => a.dueAt - b.dueAt);
  const todayEnd = startOfToday() + DAYMS - 1;
  const overdue = tasks.filter(t => t.dueAt < startOfToday());
  const today = tasks.filter(t => t.dueAt >= startOfToday() && t.dueAt <= todayEnd);
  const later = tasks.filter(t => t.dueAt > todayEnd);

  const mine = visibleLeads();
  const breached = mine.filter(slaBreached).sort((a, b) => a.createdAt - b.createdAt);
  const cold = mine.filter(l => isCold(l) && !openTasksFor(l.id).length)
    .sort((a, b) => scoreLead(b) - scoreLead(a)).slice(0, 10);

  const taskRow = (t, cls) => {
    const l = leadById(t.leadId);
    if (!l) return "";
    return `<div class="task-row ${cls}">
      <button class="tick" data-done="${t.id}" title="Mark done"></button>
      <div class="who">
        <b>${esc(l.name)}</b> — ${esc(t.title)}
        <div>${esc(courseById(l.courseId).name)} · <span class="badge s-${l.stage} plain" style="padding:2px 8px">${esc(stageById(l.stage).name)}</span> · ${esc(l.phone)}</div>
      </div>
      ${scoreHtml(l)}
      <div class="due ${t.dueAt < startOfToday() ? "late" : ""}">${dueLabel(t.dueAt)}</div>
      <button class="btn sm" data-lead="${l.id}">Open</button>
      <a class="btn sm" href="tel:${encodeURIComponent(l.phone)}">Call</a>
    </div>`;
  };

  $("#view").innerHTML = `
    <div class="toolbar">
      <div>
        <h2>My day</h2>
        <div class="sub-note">${overdue.length} overdue · ${today.length} due today · ${later.length} upcoming</div>
      </div>
      <div class="spacer"></div>
      <button class="btn brand" id="mNew">+ New enquiry</button>
    </div>

    ${breached.length ? `
    <div class="section" style="border-color:var(--red)">
      <h3 style="color:var(--red)">${breached.length} lead${breached.length > 1 ? "s" : ""} past first-response SLA</h3>
      <div class="sub-note">Nobody has contacted these yet. Every minute here costs conversion.</div>
      ${breached.slice(0, 6).map(l => `
        <div class="task-row overdue">
          <div class="who"><b>${esc(l.name)}</b> — new ${esc(sourceById(l.sourceId).name)} enquiry
            <div>${esc(courseById(l.courseId).name)} · ${esc(l.city)} · ${esc(l.phone)}</div></div>
          ${scoreHtml(l)}
          <div class="due late">waiting ${ago(l.createdAt).replace(" ago", "")}</div>
          <button class="btn sm brand" data-lead="${l.id}">Respond</button>
        </div>`).join("")}
    </div>` : ""}

    <div class="section">
      <h3>Follow-ups</h3>
      <div class="sub-note">Your scheduled callbacks, newest deadline first.</div>
      ${overdue.length ? `<div class="set-label" style="color:var(--red)">Overdue · ${overdue.length}</div>${overdue.map(t => taskRow(t, "overdue")).join("")}` : ""}
      ${today.length ? `<div class="set-label" style="color:var(--amber)">Today · ${today.length}</div>${today.map(t => taskRow(t, "today")).join("")}` : ""}
      ${later.length ? `<div class="set-label">Upcoming · ${later.length}</div>${later.slice(0, 12).map(t => taskRow(t, "")).join("")}` : ""}
      ${!tasks.length ? `<div class="empty">No open follow-ups. Add one from any lead's profile.</div>` : ""}
    </div>

    ${cold.length ? `
    <div class="section">
      <h3>Going cold — no follow-up scheduled</h3>
      <div class="sub-note">Untouched for over ${cache.settings.coldAfterDays} days with nothing booked. These are the ones that quietly disappear.</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Lead</th><th>Programme</th><th>Stage</th><th>Score</th><th>Last touch</th><th></th></tr></thead>
        <tbody>${cold.map(l => `
          <tr class="row-link" data-lead="${l.id}">
            <td><b>${esc(l.name)}</b></td>
            <td style="font-size:12.5px">${esc(courseById(l.courseId).name)}</td>
            <td><span class="badge s-${l.stage}">${esc(stageById(l.stage).name)}</span></td>
            <td>${scoreHtml(l)}</td>
            <td style="font-size:12.5px;color:var(--muted)">${ago(l.lastActivityAt)}</td>
            <td style="white-space:nowrap"><button class="btn sm" data-lead="${l.id}">Open</button></td>
          </tr>`).join("")}</tbody></table></div>
    </div>` : ""}`;

  $("#mNew").addEventListener("click", () => showLeadModal(null));
  $$("[data-lead]").forEach(el => el.addEventListener("click", e => { e.stopPropagation(); openLead(el.dataset.lead); }));
  $$("[data-done]").forEach(el => el.addEventListener("click", async () => {
    const t = cache.tasks.find(x => x.id === el.dataset.done);
    if (!t) return;
    t.done = true; t.doneAt = Date.now();
    await Store.put("tasks", t);
    await logActivity(t.leadId, "note", "Follow-up completed: " + t.title);
    await refresh(); toast("Follow-up closed"); render();
  }));
}

/* ---------------- boot ---------------- */

async function boot() {
  await refresh();
  if (!cache.leads.length && !(await Store.getMeta("seeded"))) {
    await loadSeedIfEmpty();
    await refresh();
  }

  // restore session identity
  const savedId = sessionStorage.getItem("crm_user");
  me = cache.users.find(u => u.id === savedId) || cache.users[0] || null;

  const sel = $("#userSel");
  const paint = () => {
    sel.innerHTML = cache.users.map(u =>
      `<option value="${u.id}" ${me && u.id === me.id ? "selected" : ""}>${esc(u.name)} — ${esc(u.role)}</option>`
    ).join("");
  };
  paint();
  sel.addEventListener("change", () => {
    me = cache.users.find(u => u.id === sel.value) || null;
    adminUnlocked = false;             // switching identity always re-locks admin
    sessionStorage.setItem("crm_user", me ? me.id : "");
    if (currentTab === "manage" || currentTab === "settings") currentTab = "dashboard";
    toast("Signed in as " + (me ? me.name : "—"));
    render();
  });

  $$("nav button").forEach(b => b.addEventListener("click", () => {
    const tab = b.dataset.tab;
    if (tab === "manage" || tab === "settings") return requireAdmin(() => go(tab));
    go(tab);
  }));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeModal(); closeLead(); }
  });

  render();
}

document.addEventListener("DOMContentLoaded", boot);
