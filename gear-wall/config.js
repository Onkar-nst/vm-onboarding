// Gear Wall — deployment configuration.
// This is the ONLY file you touch to connect a real database/backend.
//
//   adapter: "local"  → browser localStorage (default; demo & single-machine use)
//   adapter: "rest"   → any backend implementing the 6-endpoint contract in store.js
//                       (see README "Connecting a real database")
//
// Example for a hosted backend:
//   window.APP_CONFIG = { adapter: "rest", apiUrl: "https://api.youragency.com/gearwall", apiToken: "..." };

window.APP_CONFIG = {
  adapter: "local",
  apiUrl: null,
  apiToken: null,
  namespace: "gearwall_v2",  // localStorage namespace (change to run two orgs on one machine)
  loadDemoSeed: true         // seed demo inventory on first run (Settings → Reset also uses this)
};
