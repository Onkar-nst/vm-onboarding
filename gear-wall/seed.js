// Gear Wall — demo seed. Loaded ONLY when the database is empty (first run or
// after Settings → Reset demo data). Real deployments start clean by setting
// loadDemoSeed:false in config.js.

const SEED = {
  settings: {
    id: "settings",
    orgName: "Aperture Studios",
    adminPin: "1234",
    currency: "₹",
    pickupGraceDays: 1 // gear can be picked up this many days before the booking starts
  },

  members: [
    { id: "MB-001", name: "Vikram (Owner)", role: "manager", active: true },
    { id: "MB-002", name: "Meera", role: "manager", active: true },
    { id: "MB-003", name: "Adi", role: "crew", active: true },
    { id: "MB-004", name: "Rohan", role: "crew", active: true },
    { id: "MB-005", name: "Sana", role: "crew", active: true }
  ],

  projects: [
    { id: "PRJ-001", name: "Wedding — Sharma x Kapoor", client: "Private", active: true },
    { id: "PRJ-002", name: "Product catalogue Q3", client: "Nimbus Tea Co.", active: true },
    { id: "PRJ-003", name: "Brand film", client: "Volulta", active: true },
    { id: "PRJ-004", name: "Fashion editorial", client: "Marigold Magazine", active: true },
    { id: "PRJ-005", name: "Corporate AV", client: "Zephyr Motors", active: true },
    { id: "PRJ-006", name: "Internal — social content", client: "In-house", active: true }
  ],

  gear: [
    { id: "GW-CAM-001", name: "Sony FX3",                category: "Camera",  serial: "FX3-88121", dayRate: 6000, home: "Studio 1 · Shelf A", condition: "ok", notes: "", archived: false },
    { id: "GW-CAM-002", name: "Panasonic Lumix S5 II",   category: "Camera",  serial: "S5M2-4407", dayRate: 3500, home: "Studio 1 · Shelf A", condition: "ok", notes: "", archived: false },
    { id: "GW-CAM-003", name: "Blackmagic URSA 12K",     category: "Camera",  serial: "UR12-0092", dayRate: 15000, home: "Studio 2 · Cupboard", condition: "ok", notes: "Heavy — take the cart", archived: false },
    { id: "GW-CAM-004", name: "Canon R5C",               category: "Camera",  serial: "R5C-77410", dayRate: 5500, home: "Studio 1 · Shelf B", condition: "ok", notes: "", archived: false },
    { id: "GW-CAM-005", name: "DJI Pocket 3",            category: "Camera",  serial: "DJP3-1288", dayRate: 1200, home: "Front desk drawer",  condition: "ok", notes: "BTS / vlog use", archived: false },
    { id: "GW-LEN-001", name: "Sigma 24-70 f/2.8",       category: "Lens",    serial: "SG247-551", dayRate: 1500, home: "Studio 1 · Lens case", condition: "ok", notes: "", archived: false },
    { id: "GW-LEN-002", name: "Sony 85mm f/1.4 GM",      category: "Lens",    serial: "S85G-1203", dayRate: 1800, home: "Studio 1 · Lens case", condition: "ok", notes: "", archived: false },
    { id: "GW-LIT-001", name: "Aputure 600d",            category: "Light",   serial: "AP6D-3321", dayRate: 2500, home: "Studio 2 · Light rack", condition: "ok", notes: "", archived: false },
    { id: "GW-LIT-002", name: "Aputure MC 4-Kit",        category: "Light",   serial: "APMC-0871", dayRate: 900,  home: "Studio 1 · Shelf C", condition: "ok", notes: "", archived: false },
    { id: "GW-LIT-003", name: "Godox SL60W",             category: "Light",   serial: "GSL6-2210", dayRate: 500,  home: "Studio 2 · Light rack", condition: "damaged", notes: "Flickers above 80% — repair quote pending", archived: false },
    { id: "GW-AUD-001", name: "Sennheiser MKH 416",      category: "Audio",   serial: "MKH4-9954", dayRate: 1200, home: "Audio locker", condition: "ok", notes: "", archived: false },
    { id: "GW-AUD-002", name: "Rode Wireless PRO kit",   category: "Audio",   serial: "RWP-33019", dayRate: 800,  home: "Audio locker", condition: "ok", notes: "Charge case before shoot", archived: false },
    { id: "GW-AUD-003", name: "Zoom H6 recorder",        category: "Audio",   serial: "ZH6-51420", dayRate: 600,  home: "Audio locker", condition: "ok", notes: "", archived: false },
    { id: "GW-GRP-001", name: "DJI RS3 Pro gimbal",      category: "Grip",    serial: "RS3P-6634", dayRate: 1500, home: "Studio 2 · Cupboard", condition: "ok", notes: "", archived: false },
    { id: "GW-GRP-002", name: "Manfrotto 504X tripod",   category: "Grip",    serial: "MF504-118", dayRate: 700,  home: "Studio 1 · Corner", condition: "ok", notes: "", archived: false },
    { id: "GW-MON-001", name: "Atomos Ninja V",          category: "Monitor", serial: "ATNV-8802", dayRate: 900,  home: "Studio 1 · Shelf B", condition: "ok", notes: "", archived: false }
  ],

  // offsets are days relative to "today" at seed time
  bookings: [
    {
      id: "BK-001", name: "Catalogue day 1 — tabletop", projectId: "PRJ-002",
      location: "Studio 1", startOffset: 0, endOffset: 0,
      gearIds: ["GW-CAM-001", "GW-LEN-001", "GW-LIT-002", "GW-AUD-002"],
      requesterId: "MB-003", status: "approved", pickups: {}, notes: ""
    },
    {
      id: "BK-002", name: "Wedding — sangeet coverage", projectId: "PRJ-001",
      location: "Outdoor — Taj West End", startOffset: 1, endOffset: 2,
      gearIds: ["GW-CAM-002", "GW-GRP-001", "GW-LEN-002"],
      requesterId: "MB-004", status: "pending", pickups: {}, notes: "Two-day event, night function on day 2"
    },
    {
      id: "BK-003", name: "Brand film — studio block", projectId: "PRJ-003",
      location: "Studio 2", startOffset: 3, endOffset: 5,
      gearIds: ["GW-CAM-003", "GW-LIT-001", "GW-AUD-001", "GW-MON-001"],
      requesterId: "MB-002", status: "approved", pickups: {}, notes: ""
    },
    {
      id: "BK-004", name: "Social content batch", projectId: "PRJ-006",
      location: "Studio 1", startOffset: -3, endOffset: -3,
      gearIds: ["GW-CAM-005"],
      requesterId: "MB-005", status: "done",
      pickups: { "GW-CAM-005": { pickedAtOffset: -3, returnedAtOffset: -3, outCond: "ok", inCond: "ok" } },
      notes: ""
    }
  ]
};

async function loadSeedIfEmpty() {
  const existing = await Store.list("gear");
  const seeded = await Store.getMeta("seeded");
  if (existing.length || seeded) return false;
  await writeSeed();
  return true;
}

async function writeSeed() {
  const day = 86400000;
  const now = Date.now();
  const dstr = (offset) => {
    const d = new Date(now + offset * day);
    return d.toISOString().slice(0, 10);
  };
  await Store.put("settings", SEED.settings);
  for (const m of SEED.members) await Store.put("members", m);
  for (const p of SEED.projects) await Store.put("projects", p);
  for (const g of SEED.gear) await Store.put("gear", g);
  for (const b of SEED.bookings) {
    const doc = { ...b, start: dstr(b.startOffset), end: dstr(b.endOffset), createdAt: now };
    delete doc.startOffset; delete doc.endOffset;
    doc.pickups = {};
    for (const [gid, p] of Object.entries(b.pickups)) {
      doc.pickups[gid] = {
        pickedAt: now + p.pickedAtOffset * day,
        returnedAt: p.returnedAtOffset !== undefined ? now + p.returnedAtOffset * day : null,
        outCond: p.outCond || "ok", inCond: p.inCond || null
      };
    }
    await Store.put("bookings", doc);
  }
  await Store.setMeta("seq.BK", 10);
  await Store.setMeta("seq.PRJ", 10);
  await Store.setMeta("seq.MB", 10);
  await Store.put("log", { id: "LOG-1", ts: now, msg: "Workspace initialized with demo dataset." });
  await Store.setMeta("seq.LOG", 1);
  await Store.setMeta("seeded", true);
}
