/* Katta — development & production server.
 *
 *   npm run dev     →  http://localhost:4173
 *
 * Does two jobs:
 *   1. serves every app as static files (same as the old python http.server)
 *   2. exposes the REST API each app's RestAdapter already knows how to talk to:
 *
 *        GET    /api/{app}/{collection}        → [docs]
 *        PUT    /api/{app}/{collection}/{id}   → upsert (JSON body)
 *        DELETE /api/{app}/{collection}/{id}
 *        GET    /api/{app}/meta/{key}          → value
 *        PUT    /api/{app}/meta/{key}          → { value }
 *        POST   /api/{app}/admin/clear
 *
 * {app} namespaces the data, so gear-wall and the CRM share one database file
 * without ever seeing each other's rows.
 *
 * Zero npm dependencies — this is plain node:http.
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { open } = require("./db");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;
const TOKEN = process.env.KATTA_TOKEN || null;   // unset = open (fine on localhost)
const LOG_API = process.env.KATTA_LOG === "1";

const store = open();

/* ------------------------------- helpers ------------------------------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".py": "text/plain; charset=utf-8"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload === undefined ? null : payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) { reject(httpError(413, "body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); }
      catch { reject(httpError(400, "invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

/* --------------------------------- API --------------------------------- */

async function handleApi(req, res, app, rest) {
  const method = req.method;

  if (TOKEN) {
    const auth = req.headers.authorization || "";
    if (auth !== "Bearer " + TOKEN) return sendJson(res, 401, { error: "unauthorized" });
  }

  // POST /api/{app}/admin/clear
  if (rest === "/admin/clear") {
    if (method !== "POST") return sendJson(res, 405, { error: "use POST" });
    store.clear(app);
    if (LOG_API) console.log(`[api] cleared ${app}`);
    return sendJson(res, 200, { ok: true });
  }

  // /api/{app}/meta/{key}
  if (rest.startsWith("/meta/")) {
    const key = decodeURIComponent(rest.slice("/meta/".length));
    if (!key) return sendJson(res, 400, { error: "missing key" });
    if (method === "GET") return sendJson(res, 200, store.getMeta(app, key));
    if (method === "PUT") {
      const body = await readBody(req);
      store.setMeta(app, key, body && "value" in body ? body.value : null);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { error: "method not allowed" });
  }

  // /api/{app}/{collection}[/{id}]
  const parts = rest.split("/").filter(Boolean).map(decodeURIComponent);
  const [collection, id] = parts;
  if (!collection) return sendJson(res, 400, { error: "missing collection" });

  if (method === "GET" && !id) return sendJson(res, 200, store.list(app, collection));

  if (method === "PUT" && id) {
    const doc = await readBody(req);
    if (!doc || typeof doc !== "object") return sendJson(res, 400, { error: "expected a JSON document" });
    if (doc.id === undefined || doc.id === null) doc.id = id;
    if (String(doc.id) !== id) return sendJson(res, 400, { error: "id in URL and body must match" });
    store.put(app, collection, doc);
    if (LOG_API) console.log(`[api] PUT ${app}/${collection}/${id}`);
    return sendJson(res, 200, doc);
  }

  if (method === "DELETE" && id) {
    store.remove(app, collection, id);
    if (LOG_API) console.log(`[api] DEL ${app}/${collection}/${id}`);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: "method not allowed" });
}

/* ------------------------------- static -------------------------------- */

// Never serve these over HTTP: the database itself, git history (which contains
// remote URLs and every past version of the code), secrets, and dependencies.
const BLOCKED = new Set(["data", ".git", ".env", "node_modules", ".ds_store", "package-lock.json"]);

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); }
  catch { return sendText(res, 400, "400 Bad Request"); }

  const segments = rel.split("/").filter(Boolean);
  if (segments.some(s => BLOCKED.has(s.toLowerCase()) || s.toLowerCase().startsWith(".env"))) {
    return sendText(res, 403, "403 Forbidden");
  }

  const target = path.resolve(ROOT, "." + rel);
  // never let a crafted path escape the project folder
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return sendText(res, 403, "403 Forbidden");

  let file = target;
  let stat = null;
  try { stat = fs.statSync(file); } catch {}

  if (stat && stat.isDirectory()) {
    if (!pathname.endsWith("/")) {
      res.writeHead(301, { Location: pathname + "/" });
      return res.end();
    }
    file = path.join(file, "index.html");
    try { stat = fs.statSync(file); } catch { stat = null; }
  }

  if (!stat || !stat.isFile()) return sendText(res, 404, "404 Not Found — " + pathname);

  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    // app code changes constantly in dev; never let the browser cache it
    "Cache-Control": "no-cache"
  });
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------- server -------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  // let an app hosted elsewhere still talk to this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    // Marker file. It exists only when this server is running, so each app's
    // config.js can tell "served by Node → use the database" from "opened as a
    // static site → use localStorage" without any manual switching.
    if (pathname === "/__katta/server.js") {
      const body = "window.KATTA_SERVER = true;";
      res.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store"
      });
      return res.end(body);
    }

    if (pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        storage: store.kind,
        file: path.relative(ROOT, store.location),
        apps: { "gear-wall": store.stats("gearwall"), crm: store.stats("crm") }
      });
    }

    const api = pathname.match(/^\/api\/([A-Za-z0-9_-]{1,40})(\/.*)?$/);
    if (api) return await handleApi(req, res, api[1], api[2] || "/");

    if (req.method !== "GET" && req.method !== "HEAD") return sendText(res, 405, "405 Method Not Allowed");
    return serveStatic(req, res, pathname);
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) console.error("[katta] " + req.method + " " + pathname + " →", err.message);
    if (!res.headersSent) sendJson(res, status, { error: err.message });
    else res.end();
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  Port ${PORT} is already in use.\n`);
    console.error(`  Something else is serving there — stop it with:`);
    console.error(`    lsof -ti:${PORT} | xargs kill\n`);
    console.error(`  ...or run this server on another port:`);
    console.error(`    PORT=5000 npm run dev\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  const base = "http://localhost:" + PORT;
  console.log(`
  Katta is running — open  ${base}

    Gear Wall        ${base}/gear-wall/          (database)
    Admissions CRM   ${base}/CRM/                (database)
      public form    ${base}/CRM/enquiry.html
    Onboarding       ${base}/vm-onboarding/      (browser storage)
    Knowledge        ${base}/katta-knowledge/    (browser storage)
    Portfolio        ${base}/portfolio/

  Storage   ${store.kind === "sqlite" ? "SQLite" : "JSON file"} — ${path.relative(ROOT, store.location)}
  API       ${base}/api/crm/leads · ${base}/api/health
  PIN       1234        Add ?db=local to any URL to force browser storage.

  Stop with Ctrl+C
`);
});
