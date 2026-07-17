// Onboarding Academy — deployment configuration.
// The ONLY file you touch to connect a real database/backend.
//   adapter: "local"  → browser localStorage (default)
//   adapter: "rest"   → any backend implementing the contract in store.js (see README)
// Example:
//   window.APP_CONFIG = { adapter: "rest", apiUrl: "https://api.youragency.com/academy", apiToken: "..." };

window.APP_CONFIG = {
  adapter: "local",
  apiUrl: null,
  apiToken: null,
  namespace: "academy_v2",
  loadDemoSeed: true   // seeds the demo "Editor Onboarding" course when the DB is empty
};
