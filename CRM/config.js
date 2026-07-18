// Admission CRM — deployment configuration.
// This is the ONLY file you touch to connect a real database/backend.
//
//   adapter: "local"  → browser localStorage (default; demo & single-machine use)
//   adapter: "rest"   → any backend implementing the 6-endpoint contract in store.js
//                       (see README "Connecting a real database")
//
// Example for a hosted backend:
//   window.APP_CONFIG = { adapter: "rest", apiUrl: "https://api.youragency.com/crm", apiToken: "..." };

window.APP_CONFIG = {
  adapter: "local",
  apiUrl: null,
  apiToken: null,
  namespace: "crm_v2",   // localStorage namespace (change to run two institutions on one machine)
  loadDemoSeed: true     // seed a demo admission season on first run (Settings → Reset also uses this)
};
