// Admission CRM — deployment configuration.
// This is the ONLY file you touch to connect a real database/backend.
//
//   adapter: "local"  → browser localStorage (demo, offline, static hosting)
//   adapter: "rest"   → the 6-endpoint API in store.js (real shared database)
//
// It picks for you:
//   served by `npm run dev`  → "rest"   (data is shared by everyone on the server)
//   opened as a static site  → "local"  (each visitor gets a private demo copy)
//
// The switch works because the Node server serves /__katta/server.js, which sets
// window.KATTA_SERVER. On a static host that file 404s, so the flag stays unset.
//
// Force either mode by hand with a query string:
//   ?db=local   browser storage even while the server is running (safe sandbox)
//   ?db=rest    the API even from a static page (set apiUrl below first)

(function () {
  var forced = new URLSearchParams(location.search).get("db");
  var onServer = window.KATTA_SERVER === true;
  var adapter = forced === "local" ? "local"
              : forced === "rest" ? "rest"
              : (onServer ? "rest" : "local");

  window.APP_CONFIG = {
    adapter: adapter,

    // Relative URL, so it follows whatever host serves the page. Point this at a
    // full URL (https://api.yourcompany.com/crm) to run the front-end and the
    // API on different machines.
    apiUrl: "/api/crm",
    apiToken: null,        // must match KATTA_TOKEN on the server, if you set one

    namespace: "crm_v2",   // localStorage namespace (only used by the local adapter)
    loadDemoSeed: true     // seed a demo admission season when the database is empty
  };
})();
