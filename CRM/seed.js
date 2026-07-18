/* Admission CRM — demo dataset.
 *
 * Loaded only when the database is empty (or from Settings → Reset demo data).
 * Dates are stored as day-offsets relative to seed time and converted to real
 * timestamps in writeSeed(), so the demo always looks like "this admission season".
 *
 * Collections
 *   settings     singleton doc id "settings"
 *   users        counsellors / telecallers / admins
 *   courses      programmes on offer (fee, seats, intake, document checklist)
 *   sources      lead sources with spend, for cost-per-lead / cost-per-admission
 *   stages       the admission pipeline, fully editable
 *   leads        the central entity — one enquiry
 *   activities   calls, walk-ins, WhatsApp, email, notes (append-only per lead)
 *   tasks        scheduled follow-ups
 *   payments     application / registration / tuition receipts
 *   templates    email / SMS / WhatsApp templates with merge fields
 *   events       open days, education fairs, webinars
 *   log          append-only audit trail
 */

const SEED = {
  settings: {
    id: "settings",
    orgName: "Sahyadri Institute of Technology",
    orgShort: "SIT",
    adminPin: "1234",
    currency: "₹",
    academicYear: "2026–27",
    // response-time SLA: a new lead untouched beyond this many minutes is breached
    firstResponseSlaMins: 60,
    // a lead with no activity for this many days is flagged "going cold"
    coldAfterDays: 7,
    // auto-assignment of incoming leads: "round_robin" | "by_course" | "manual"
    assignMode: "round_robin",
    // lead score weights — tuned in Settings, applied by scoreLead()
    scoreWeights: { activity: 6, stage: 10, recency: 12, source: 8, fit: 10 },
    // stages that count as won / lost for funnel math
    wonStage: "enrolled",
    lostStage: "lost"
  },

  users: [
    { id: "USR-001", name: "Priya Deshmukh",  role: "admin",      email: "priya@sahyadri.edu.in",  phone: "9820011001", target: 0,  active: true },
    { id: "USR-002", name: "Rahul Kulkarni",  role: "counsellor", email: "rahul@sahyadri.edu.in",  phone: "9820011002", target: 40, active: true },
    { id: "USR-003", name: "Sneha Patil",     role: "counsellor", email: "sneha@sahyadri.edu.in",  phone: "9820011003", target: 40, active: true },
    { id: "USR-004", name: "Imran Shaikh",    role: "counsellor", email: "imran@sahyadri.edu.in",  phone: "9820011004", target: 35, active: true },
    { id: "USR-005", name: "Anjali Rao",      role: "telecaller", email: "anjali@sahyadri.edu.in", phone: "9820011005", target: 25, active: true }
  ],

  courses: [
    { id: "CRS-001", name: "B.Tech — Computer Science", level: "UG", duration: "4 years", fee: 185000, seats: 120, filled: 0,
      intake: "Aug 2026", active: true,
      docs: ["10th Marksheet", "12th Marksheet", "Transfer Certificate", "Aadhaar", "Passport Photo", "JEE Scorecard"] },
    { id: "CRS-002", name: "B.Tech — Mechanical",       level: "UG", duration: "4 years", fee: 155000, seats: 60,  filled: 0,
      intake: "Aug 2026", active: true,
      docs: ["10th Marksheet", "12th Marksheet", "Transfer Certificate", "Aadhaar", "Passport Photo"] },
    { id: "CRS-003", name: "B.Tech — Electronics",      level: "UG", duration: "4 years", fee: 155000, seats: 60,  filled: 0,
      intake: "Aug 2026", active: true,
      docs: ["10th Marksheet", "12th Marksheet", "Transfer Certificate", "Aadhaar", "Passport Photo"] },
    { id: "CRS-004", name: "MBA — Finance & Analytics", level: "PG", duration: "2 years", fee: 340000, seats: 60,  filled: 0,
      intake: "Jul 2026", active: true,
      docs: ["Degree Certificate", "Consolidated Marksheet", "CAT/MAT Scorecard", "Aadhaar", "Passport Photo", "Work Experience Letter"] },
    { id: "CRS-005", name: "MCA",                       level: "PG", duration: "2 years", fee: 210000, seats: 60,  filled: 0,
      intake: "Jul 2026", active: true,
      docs: ["Degree Certificate", "Consolidated Marksheet", "Aadhaar", "Passport Photo"] },
    { id: "CRS-006", name: "B.Sc — Data Science",       level: "UG", duration: "3 years", fee: 120000, seats: 40,  filled: 0,
      intake: "Aug 2026", active: true,
      docs: ["10th Marksheet", "12th Marksheet", "Aadhaar", "Passport Photo"] }
  ],

  // `spend` drives cost-per-lead and cost-per-admission in Reports.
  // `quality` (0–1) feeds the lead score: a walk-in is worth more than a portal scrape.
  sources: [
    { id: "SRC-001", name: "Website Enquiry Form", spend: 0,      quality: 0.7, active: true },
    { id: "SRC-002", name: "Google Ads",           spend: 240000, quality: 0.5, active: true },
    { id: "SRC-003", name: "Meta Ads",             spend: 160000, quality: 0.4, active: true },
    { id: "SRC-004", name: "Walk-in",              spend: 0,      quality: 1.0, active: true },
    { id: "SRC-005", name: "Referral — Student",   spend: 45000,  quality: 0.9, active: true },
    { id: "SRC-006", name: "Education Fair",       spend: 180000, quality: 0.7, active: true },
    { id: "SRC-007", name: "Shiksha / CollegeDunia", spend: 120000, quality: 0.35, active: true },
    { id: "SRC-008", name: "Consultant / Agent",   spend: 90000,  quality: 0.6, active: true }
  ],

  // Fully editable pipeline. `kind` drives funnel maths: open | won | lost.
  // `sla` = days a lead may sit in this stage before it is flagged stalled.
  stages: [
    { id: "new",        name: "New Enquiry",   order: 1, kind: "open", sla: 1,  color: "blue"   },
    { id: "contacted",  name: "Contacted",     order: 2, kind: "open", sla: 3,  color: "cyan"   },
    { id: "qualified",  name: "Qualified",     order: 3, kind: "open", sla: 5,  color: "violet" },
    { id: "visit",      name: "Campus Visit",  order: 4, kind: "open", sla: 7,  color: "amber"  },
    { id: "applied",    name: "Applied",       order: 5, kind: "open", sla: 7,  color: "orange" },
    { id: "documents",  name: "Documents",     order: 6, kind: "open", sla: 5,  color: "teal"   },
    { id: "fee",        name: "Fee Pending",   order: 7, kind: "open", sla: 4,  color: "pink"   },
    { id: "enrolled",   name: "Enrolled",      order: 8, kind: "won",  sla: 0,  color: "green"  },
    { id: "lost",       name: "Lost",          order: 9, kind: "lost", sla: 0,  color: "red"    }
  ],

  templates: [
    { id: "TPL-001", channel: "whatsapp", name: "New enquiry — instant reply",
      subject: "",
      body: "Hi {{name}}, thanks for your interest in {{course}} at {{org}}! I'm {{counsellor}}, your admission counsellor. Fee is {{fee}} and the {{year}} intake is filling fast. Can I call you today to walk you through the process?" },
    { id: "TPL-002", channel: "email", name: "Prospectus + fee structure",
      subject: "{{course}} at {{org}} — prospectus, fees & next steps",
      body: "Dear {{name}},\n\nThank you for enquiring about our {{course}} programme for the {{year}} session.\n\nProgramme fee: {{fee}}\nIntake: {{intake}}\n\nI've attached the prospectus and the detailed fee structure. The next step is a short campus visit — I can block a slot for you this week.\n\nWarm regards,\n{{counsellor}}\nAdmissions Office, {{org}}" },
    { id: "TPL-003", channel: "whatsapp", name: "Follow-up — no response",
      subject: "",
      body: "Hi {{name}}, {{counsellor}} here from {{org}}. I tried reaching you about the {{course}} admission. Seats for {{intake}} are limited — shall I hold one for you? Just reply YES and I'll share the application link." },
    { id: "TPL-004", channel: "sms", name: "Campus visit confirmation",
      subject: "",
      body: "{{name}}, your campus visit to {{org}} is confirmed. Please carry a photo ID. Ask for {{counsellor}} at the Admissions desk. - {{org}}" },
    { id: "TPL-005", channel: "email", name: "Document checklist",
      subject: "Documents required to confirm your {{course}} seat",
      body: "Dear {{name}},\n\nCongratulations on completing your application to {{course}}.\n\nTo confirm your seat, please upload or bring the following:\n{{docchecklist}}\n\nOnce verified, you can pay the registration fee and your admission is locked in.\n\nRegards,\n{{counsellor}}\nAdmissions Office, {{org}}" },
    { id: "TPL-006", channel: "whatsapp", name: "Fee reminder",
      subject: "",
      body: "Hi {{name}}, your seat in {{course}} is confirmed pending the fee payment of {{fee}}. Seats are released if unpaid by the deadline. Pay online or visit the accounts desk — I'm here if you need help. - {{counsellor}}, {{org}}" }
  ],

  // dayOffset is relative to seed time; negative = past
  events: [
    { id: "EVT-001", name: "Open Day — Engineering Block", type: "Open Day",       dayOffset: -12, venue: "Main Campus, Pune",         cost: 45000,  expected: 150, attended: 0, active: true },
    { id: "EVT-002", name: "Maharashtra Education Fair",   type: "Education Fair", dayOffset: -5,  venue: "Auto Cluster, Chinchwad",   cost: 120000, expected: 400, attended: 0, active: true },
    { id: "EVT-003", name: "MBA Info Webinar",             type: "Webinar",        dayOffset: 3,   venue: "Online (Zoom)",             cost: 8000,   expected: 200, attended: 0, active: true },
    { id: "EVT-004", name: "Open Day — Management Block",  type: "Open Day",       dayOffset: 11,  venue: "Main Campus, Pune",         cost: 45000,  expected: 120, attended: 0, active: true }
  ]
};

/* ---------------- generated leads ----------------
 * A hand-written 45-lead table would be unreadable; this builds a realistic
 * season from a compact spec. Every field is still plain data in the Store —
 * nothing here is referenced by the app at runtime.
 */

const SEED_LEAD_SPECS = [
  // name, city, courseIdx, sourceIdx, stage, ownerIdx, createdDaysAgo, lastTouchDaysAgo, marks12
  ["Aarav Joshi",      "Pune",        0, 1, "enrolled",  1, 62, 9,  88],
  ["Isha Nair",        "Mumbai",      0, 4, "enrolled",  2, 58, 12, 92],
  ["Rohan Bhosale",    "Nashik",      1, 3, "enrolled",  1, 55, 14, 76],
  ["Ananya Kulkarni",  "Pune",        3, 0, "enrolled",  2, 51, 8,  81],
  ["Vivaan Mehta",     "Thane",       0, 5, "enrolled",  3, 49, 16, 90],
  ["Diya Sharma",      "Pune",        5, 1, "enrolled",  2, 44, 11, 79],
  ["Kabir Singh",      "Nagpur",      4, 7, "enrolled",  3, 41, 19, 72],
  ["Meera Iyer",       "Pune",        3, 4, "enrolled",  1, 38, 6,  86],
  ["Arjun Pawar",      "Satara",      1, 3, "fee",       1, 34, 2,  74],
  ["Saanvi Gupta",     "Mumbai",      0, 1, "fee",       2, 32, 1,  91],
  ["Aditya Rane",      "Pune",        2, 0, "fee",       3, 30, 3,  77],
  ["Riya Chavan",      "Kolhapur",    5, 5, "fee",       2, 29, 1,  83],
  ["Kian Desai",       "Pune",        0, 4, "documents", 1, 28, 2,  89],
  ["Nisha Verma",      "Aurangabad",  3, 6, "documents", 3, 27, 4,  70],
  ["Yash Deshpande",   "Pune",        4, 0, "documents", 2, 26, 1,  75],
  ["Tara Menon",       "Mumbai",      0, 1, "documents", 1, 25, 3,  94],
  ["Advait Kale",      "Solapur",     1, 2, "applied",   3, 24, 5,  68],
  ["Zara Khan",        "Pune",        3, 5, "applied",   2, 23, 2,  85],
  ["Neel Agarwal",     "Nagpur",      0, 6, "applied",   1, 22, 6,  80],
  ["Prisha Reddy",     "Pune",        5, 0, "applied",   2, 21, 3,  78],
  ["Om Jadhav",        "Ahmednagar",  2, 3, "applied",   3, 20, 4,  71],
  ["Anika Bose",       "Mumbai",      3, 4, "visit",     1, 19, 2,  87],
  ["Reyansh Shah",     "Pune",        0, 1, "visit",     2, 18, 1,  82],
  ["Myra Fernandes",   "Thane",       5, 5, "visit",     3, 17, 3,  76],
  ["Dhruv Salunkhe",   "Sangli",      1, 2, "visit",     1, 16, 5,  69],
  ["Sara Qureshi",     "Pune",        4, 0, "qualified", 2, 15, 2,  73],
  ["Ayaan Malik",      "Nashik",      0, 6, "qualified", 3, 14, 4,  84],
  ["Kiara Sethi",      "Mumbai",      3, 1, "qualified", 1, 13, 1,  88],
  ["Veer Patankar",    "Pune",        2, 3, "qualified", 2, 12, 3,  67],
  ["Aadhya Kamath",    "Belgaum",     5, 7, "qualified", 3, 11, 6,  79],
  ["Ishaan Gokhale",   "Pune",        0, 1, "contacted", 1, 10, 2,  86],
  ["Navya Pillai",     "Mumbai",      3, 2, "contacted", 2, 9,  1,  81],
  ["Arnav Thakur",     "Jalgaon",     1, 6, "contacted", 3, 8,  3,  70],
  ["Pari Sinha",       "Pune",        4, 0, "contacted", 1, 7,  1,  77],
  ["Shaurya Dixit",    "Nagpur",      2, 3, "contacted", 2, 6,  2,  72],
  ["Anvi Raut",        "Pune",        5, 1, "new",       3, 4,  4,  80],
  ["Vihaan Nikam",     "Latur",       0, 2, "new",       1, 3,  3,  75],
  ["Amaira Kapoor",    "Mumbai",      3, 0, "new",       2, 2,  2,  90],
  ["Rudra Shinde",     "Pune",        1, 5, "new",       3, 1,  1,  74],
  ["Larisa D'Souza",   "Goa",         5, 6, "new",       1, 1,  1,  83],
  ["Hriday Marathe",   "Pune",        0, 1, "new",       2, 0,  0,  87],
  ["Trisha Wagh",      "Pune",        4, 4, "new",       3, 0,  0,  0 ],
  ["Samar Bhatt",      "Surat",       0, 7, "lost",      1, 40, 21, 65],
  ["Ira Chatterjee",   "Pune",        3, 2, "lost",      2, 36, 24, 71],
  ["Ved Hegde",        "Hubli",       1, 6, "lost",      3, 33, 26, 63],
  ["Kyra Bajaj",       "Mumbai",      5, 2, "lost",      1, 30, 28, 68]
];

const LOST_REASONS = [
  "Chose another college", "Fee too high", "Not eligible — cut-off",
  "Relocating out of state", "Unreachable after 6 attempts"
];

const CALL_OUTCOMES = [
  "Connected — interested", "Connected — will decide after results",
  "Not picked up", "Asked to call back later", "Connected — wants campus visit",
  "Parent spoke — comparing 3 colleges", "Switched off"
];

/* ---------------- writer ---------------- */

const DAY = 86400000;

async function writeSeed() {
  const now = Date.now();
  const ago = (days) => now - Math.round(days * DAY);
  const dayStr = (ts) => new Date(ts).toISOString().slice(0, 10);

  await Store.put("settings", SEED.settings);
  for (const u of SEED.users) await Store.put("users", u);
  for (const c of SEED.courses) await Store.put("courses", c);
  for (const s of SEED.sources) await Store.put("sources", s);
  for (const s of SEED.stages) await Store.put("stages", s);
  for (const t of SEED.templates) await Store.put("templates", t);

  for (const e of SEED.events) {
    await Store.put("events", { ...e, date: dayStr(now + e.dayOffset * DAY), dayOffset: undefined });
  }

  const stageOrder = Object.fromEntries(SEED.stages.map(s => [s.id, s.order]));
  let actN = 0, taskN = 0, payN = 0;

  for (let i = 0; i < SEED_LEAD_SPECS.length; i++) {
    const [name, city, ci, si, stage, oi, createdAgo, touchedAgo, marks] = SEED_LEAD_SPECS[i];
    const course = SEED.courses[ci];
    const source = SEED.sources[si];
    const owner = SEED.users[oi];
    const id = "LD-" + String(i + 1).padStart(3, "0");
    const createdAt = ago(createdAgo);
    const lastActivityAt = ago(touchedAgo);
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");

    const lead = {
      id, name,
      phone: "9" + String(700000000 + i * 137911).slice(0, 9),
      email: slug + "@gmail.com",
      city,
      guardianName: ["Mr. ", "Mrs. "][i % 2] + name.split(" ")[1],
      guardianPhone: "9" + String(810000000 + i * 91733).slice(0, 9),
      courseId: course.id,
      sourceId: source.id,
      stage,
      ownerId: owner.id,
      createdAt,
      lastActivityAt,
      // academic fit signals — feed the lead score
      marks12: marks,
      prevSchool: ["Fergusson College", "St. Xavier's", "DAV Public School", "Kendriya Vidyalaya", "Modern College"][i % 5],
      // first response: how many minutes until the first outbound touch
      firstResponseMins: stage === "new" ? null : 20 + ((i * 37) % 260),
      // enrolled leads carry the confirmed seat
      enrolledAt: stage === "enrolled" ? lastActivityAt : null,
      lostReason: stage === "lost" ? LOST_REASONS[i % LOST_REASONS.length] : null,
      // the stage a lost lead died in — drives the "Lost here" column in Reports
      lastStageOrder: stage === "lost" ? 2 + (i % 3) : null,
      // documents collected so far (subset of the course checklist)
      docs: {},
      tags: [],
      notes: ""
    };

    // documents: further along the pipeline → more collected & verified
    const stageIdx = stageOrder[stage];
    if (stageIdx >= stageOrder.documents) {
      const upto = stageIdx >= stageOrder.fee ? course.docs.length : Math.ceil(course.docs.length * 0.6);
      course.docs.slice(0, upto).forEach((d, k) => {
        lead.docs[d] = { received: true, verified: stageIdx > stageOrder.documents || k % 3 !== 0, at: ago(touchedAgo + 1) };
      });
    }

    if (source.id === "SRC-004") lead.tags.push("walk-in");
    if (marks >= 88) lead.tags.push("high-scorer");
    if (source.id === "SRC-005") lead.tags.push("referral");

    await Store.put("leads", lead);

    // ---- activity history: denser the further the lead travelled ----
    const touches = Math.min(9, Math.max(1, stageIdx));
    for (let t = 0; t < touches; t++) {
      const at = createdAt + Math.round(((lastActivityAt - createdAt) / touches) * (t + 1));
      const kind = ["call", "whatsapp", "call", "email", "visit", "call", "whatsapp", "note", "call"][t];
      await Store.put("activities", {
        id: "ACT-" + String(++actN).padStart(3, "0"),
        leadId: id,
        userId: owner.id,
        type: kind,
        ts: at,
        outcome: kind === "call" ? CALL_OUTCOMES[(i + t) % CALL_OUTCOMES.length] : "",
        durationSec: kind === "call" ? 40 + ((i * 17 + t * 53) % 500) : 0,
        note: {
          call: "Spoke about fee structure and scholarship eligibility.",
          whatsapp: "Sent prospectus + fee breakup on WhatsApp.",
          email: "Emailed prospectus and application link.",
          visit: "Campus visit — toured labs and hostel with parents.",
          note: "Parents comparing us with two other colleges on placement record."
        }[kind]
      });
    }

    // ---- open follow-up task for live leads ----
    if (stage !== "enrolled" && stage !== "lost") {
      // spread due dates around today so the demo has overdue, due-today and upcoming
      const dueOffset = [-3, -1, 0, 0, 1, 2, 4][i % 7];
      await Store.put("tasks", {
        id: "TSK-" + String(++taskN).padStart(3, "0"),
        leadId: id,
        userId: owner.id,
        title: [
          "Call back — decision expected",
          "Send fee structure & scholarship form",
          "Confirm campus visit slot",
          "Collect pending documents",
          "Follow up on registration fee"
        ][i % 5],
        dueAt: now + dueOffset * DAY,
        done: false,
        createdAt: lastActivityAt
      });
    }

    // ---- payments ----
    if (stageIdx >= stageOrder.applied) {
      await Store.put("payments", {
        id: "PAY-" + String(++payN).padStart(3, "0"),
        leadId: id, type: "Application Fee", amount: 1500, mode: "UPI",
        status: "paid", at: ago(touchedAgo + 4), receiptNo: "RCP" + (4200 + payN)
      });
    }
    if (stage === "enrolled") {
      await Store.put("payments", {
        id: "PAY-" + String(++payN).padStart(3, "0"),
        leadId: id, type: "Registration Fee", amount: 25000, mode: ["UPI", "NEFT", "Card"][i % 3],
        status: "paid", at: ago(touchedAgo + 2), receiptNo: "RCP" + (4200 + payN)
      });
      await Store.put("payments", {
        id: "PAY-" + String(++payN).padStart(3, "0"),
        leadId: id, type: "Tuition — Instalment 1", amount: Math.round(course.fee / 2), mode: ["NEFT", "Loan", "UPI"][i % 3],
        status: "paid", at: ago(Math.max(0, touchedAgo - 1)), receiptNo: "RCP" + (4200 + payN)
      });
    }
    if (stage === "fee") {
      await Store.put("payments", {
        id: "PAY-" + String(++payN).padStart(3, "0"),
        leadId: id, type: "Registration Fee", amount: 25000, mode: "—",
        status: "pending", at: null, dueAt: now + 3 * DAY, receiptNo: null
      });
    }
  }

  // seat counts follow from enrolled leads — recomputed live by the app,
  // but stored so a fresh DB reads sensibly
  await Store.put("log", { id: "LOG-0001", ts: now, msg: "Demo admission season loaded — 46 enquiries across 6 programmes." });

  // prime sequence counters past the seeded ids
  await Store.setMeta("seq.LD", SEED_LEAD_SPECS.length);
  await Store.setMeta("seq.ACT", actN);
  await Store.setMeta("seq.TSK", taskN);
  await Store.setMeta("seq.PAY", payN);
  await Store.setMeta("seq.USR", SEED.users.length);
  await Store.setMeta("seq.CRS", SEED.courses.length);
  await Store.setMeta("seq.SRC", SEED.sources.length);
  await Store.setMeta("seq.TPL", SEED.templates.length);
  await Store.setMeta("seq.EVT", SEED.events.length);
  await Store.setMeta("seq.LOG", 1);
  await Store.setMeta("seq.RCP", 4200 + payN);   // receipt numbers continue past the seeded ones
  await Store.setMeta("seeded", true);
}

async function loadSeedIfEmpty() {
  const existing = await Store.list("leads");
  const seeded = await Store.getMeta("seeded");
  if (existing.length || seeded) return false;
  if (window.APP_CONFIG && window.APP_CONFIG.loadDemoSeed === false) return false;
  await writeSeed();
  return true;
}
