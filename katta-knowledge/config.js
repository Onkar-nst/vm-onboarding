// Katta Knowledge — deployment configuration.
// The ONLY file you touch to connect a real database/backend.
//   adapter: "local" → browser localStorage (default)
//   adapter: "rest"  → any backend implementing the contract in store.js (see README)

window.APP_CONFIG = {
  adapter: "local",
  apiUrl: null,
  apiToken: null,
  namespace: "katta_v2",
  loadDemoSeed: true   // seeds the demo episode library when the DB is empty
};
