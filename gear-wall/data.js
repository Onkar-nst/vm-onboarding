// Gear Wall — seed data (loaded on first run, then localStorage takes over)

const SEED_GEAR = [
  { id: "GW-CAM-001", name: "Sony FX3",              category: "Camera",  home: "Studio 1 · Shelf A", status: "available", notes: "" },
  { id: "GW-CAM-002", name: "Panasonic Cam 2 (S5 II)",category: "Camera",  home: "Studio 1 · Shelf A", status: "available", notes: "" },
  { id: "GW-CAM-003", name: "Blackmagic URSA 12K",   category: "Camera",  home: "Studio 2 · Cupboard", status: "available", notes: "Heavy — take the cart" },
  { id: "GW-CAM-004", name: "Canon R5C",             category: "Camera",  home: "Studio 1 · Shelf B", status: "available", notes: "" },
  { id: "GW-CAM-005", name: "DJI Pocket 3",          category: "Camera",  home: "Front desk drawer",  status: "available", notes: "BTS / vlog use" },
  { id: "GW-LEN-001", name: "Sigma 24-70 f/2.8",     category: "Lens",    home: "Studio 1 · Lens case", status: "available", notes: "" },
  { id: "GW-LEN-002", name: "Sony 85mm f/1.4 GM",    category: "Lens",    home: "Studio 1 · Lens case", status: "available", notes: "" },
  { id: "GW-LIT-001", name: "Aputure 600d",          category: "Light",   home: "Studio 2 · Light rack", status: "available", notes: "" },
  { id: "GW-LIT-002", name: "Aputure MC 4-Kit",      category: "Light",   home: "Studio 1 · Shelf C", status: "available", notes: "" },
  { id: "GW-LIT-003", name: "Godox SL60W",           category: "Light",   home: "Studio 2 · Light rack", status: "damaged", notes: "Flickers above 80% — sent for repair quote" },
  { id: "GW-AUD-001", name: "Sennheiser MKH 416",    category: "Audio",   home: "Audio locker", status: "available", notes: "" },
  { id: "GW-AUD-002", name: "Rode Wireless PRO kit", category: "Audio",   home: "Audio locker", status: "available", notes: "Charge case before shoot" },
  { id: "GW-AUD-003", name: "Zoom H6 recorder",      category: "Audio",   home: "Audio locker", status: "available", notes: "" },
  { id: "GW-GRP-001", name: "DJI RS3 Pro gimbal",    category: "Grip",    home: "Studio 2 · Cupboard", status: "available", notes: "" },
  { id: "GW-GRP-002", name: "Manfrotto 504X tripod", category: "Grip",    home: "Studio 1 · Corner", status: "available", notes: "" },
  { id: "GW-MON-001", name: "Atomos Ninja V",        category: "Monitor", home: "Studio 1 · Shelf B", status: "available", notes: "" }
];

const PROJECTS = [
  "Internal — VM Channel",
  "Internal — Shorts Factory",
  "Internal — Gaming Channel",
  "Brand film — Volulta",
  "Brand film — Nimbus Tea Co.",
  "Client — Zephyr Motors launch",
  "Podcast — The Katta Sessions",
  "Game — Unleash the Avatar (capture)"
];

const LOCATIONS = ["Studio 1", "Studio 2", "Outdoor"];

// Demo shoots so the calendar isn't empty on first run.
// Dates are relative to "today" (offsets in days).
const SEED_SHOOTS = [
  {
    offset: 0, name: "Shorts batch — Tuesday drop", location: "Studio 1",
    project: "Internal — Shorts Factory", requester: "Adi",
    gearIds: ["GW-CAM-001", "GW-AUD-002", "GW-LIT-002"], status: "approved"
  },
  {
    offset: 1, name: "VM shoot one", location: "Outdoor — Indiranagar",
    project: "Brand film — Volulta", requester: "VM",
    gearIds: ["GW-CAM-002", "GW-GRP-001"], status: "pending"
  },
  {
    offset: 3, name: "Katta Sessions ep. 41", location: "Studio 2",
    project: "Podcast — The Katta Sessions", requester: "Meera",
    gearIds: ["GW-CAM-004", "GW-AUD-001", "GW-AUD-003", "GW-LIT-001"], status: "approved"
  },
  {
    offset: -2, name: "Gaming channel B-roll", location: "Studio 2",
    project: "Internal — Gaming Channel", requester: "Rohan",
    gearIds: ["GW-CAM-005"], status: "done"
  }
];
