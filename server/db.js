/* Katta — server-side storage.
 *
 * Implements the same document model the browser's LocalAdapter uses, so the
 * REST layer in server/index.js can satisfy the 6-endpoint contract documented
 * in each app's store.js without any app code changing.
 *
 * Two backends, picked automatically:
 *   1. node:sqlite  (built into Node 22.5+)  — the real one, a single .db file
 *   2. a JSON file  (any older Node)         — same behaviour, no dependencies
 *
 * Either way: zero npm packages to install.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// node:sqlite is stable enough to rely on but still prints an ExperimentalWarning.
// Silence just that one line so `npm run dev` doesn't look broken to a newcomer.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const text = String(warning);
  if (text.includes("SQLite") && text.includes("experimental")) return;
  return emitWarning.call(process, warning, ...rest);
};

const DATA_DIR = path.join(__dirname, "..", "data");

/* ------------------------------------------------------------------ *
 * Backend 1 — node:sqlite
 * ------------------------------------------------------------------ */

function sqliteStore() {
  let sqlite;
  try {
    sqlite = require("node:sqlite");
  } catch {
    return null;
  }
  if (!sqlite || !sqlite.DatabaseSync) return null;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "katta.db");
  const db = new sqlite.DatabaseSync(file);

  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      app        TEXT NOT NULL,
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      json       TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (app, collection, id)
    );
    CREATE TABLE IF NOT EXISTS meta (
      app  TEXT NOT NULL,
      key  TEXT NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (app, key)
    );
  `);

  // ON CONFLICT DO UPDATE (not INSERT OR REPLACE) so an update keeps the row's
  // original rowid — that's what preserves insertion order on list().
  const stmts = {
    list: db.prepare("SELECT json FROM docs WHERE app = ? AND collection = ? ORDER BY rowid"),
    put: db.prepare(
      `INSERT INTO docs (app, collection, id, json, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (app, collection, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
    ),
    remove: db.prepare("DELETE FROM docs WHERE app = ? AND collection = ? AND id = ?"),
    getMeta: db.prepare("SELECT json FROM meta WHERE app = ? AND key = ?"),
    setMeta: db.prepare(
      `INSERT INTO meta (app, key, json) VALUES (?, ?, ?)
       ON CONFLICT (app, key) DO UPDATE SET json = excluded.json`
    ),
    clearDocs: db.prepare("DELETE FROM docs WHERE app = ?"),
    clearMeta: db.prepare("DELETE FROM meta WHERE app = ?"),
    countDocs: db.prepare("SELECT collection, COUNT(*) AS n FROM docs WHERE app = ? GROUP BY collection")
  };

  return {
    kind: "sqlite",
    location: file,
    list(app, collection) {
      return stmts.list.all(app, collection).map(r => JSON.parse(r.json));
    },
    put(app, collection, doc) {
      stmts.put.run(app, collection, String(doc.id), JSON.stringify(doc), Date.now());
      return doc;
    },
    remove(app, collection, id) {
      stmts.remove.run(app, collection, String(id));
    },
    getMeta(app, key) {
      const row = stmts.getMeta.get(app, key);
      return row === undefined ? null : JSON.parse(row.json);
    },
    setMeta(app, key, value) {
      stmts.setMeta.run(app, key, JSON.stringify(value === undefined ? null : value));
    },
    clear(app) {
      stmts.clearDocs.run(app);
      stmts.clearMeta.run(app);
    },
    stats(app) {
      const out = {};
      for (const row of stmts.countDocs.all(app)) out[row.collection] = Number(row.n);
      return out;
    }
  };
}

/* ------------------------------------------------------------------ *
 * Backend 2 — JSON file (fallback for Node < 22.5)
 * ------------------------------------------------------------------ */

function jsonStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "katta.json");

  let state = { apps: {} };
  try {
    if (fs.existsSync(file)) state = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // A corrupt file shouldn't take the server down — keep the bad copy and start clean.
    try { fs.renameSync(file, file + ".corrupt-" + Date.now()); } catch {}
  }
  if (!state.apps) state.apps = {};

  let pending = null;
  function persist() {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      const tmp = file + ".tmp";
      try {
        fs.writeFileSync(tmp, JSON.stringify(state));
        fs.renameSync(tmp, file);            // atomic — never a half-written file
      } catch (err) {
        console.error("[katta] could not save data:", err.message);
      }
    }, 40);
    if (pending.unref) pending.unref();
  }
  function flush() {
    if (pending) { clearTimeout(pending); pending = null; }
    try {
      fs.writeFileSync(file + ".tmp", JSON.stringify(state));
      fs.renameSync(file + ".tmp", file);
    } catch {}
  }
  process.on("exit", flush);
  process.on("SIGINT", () => { flush(); process.exit(0); });

  const bucket = (app) => (state.apps[app] ||= { collections: {}, meta: {} });

  return {
    kind: "json",
    location: file,
    list(app, collection) {
      return (bucket(app).collections[collection] || []).map(d => JSON.parse(JSON.stringify(d)));
    },
    put(app, collection, doc) {
      const arr = (bucket(app).collections[collection] ||= []);
      const i = arr.findIndex(d => String(d.id) === String(doc.id));
      if (i >= 0) arr[i] = doc; else arr.push(doc);
      persist();
      return doc;
    },
    remove(app, collection, id) {
      const b = bucket(app);
      if (!b.collections[collection]) return;
      b.collections[collection] = b.collections[collection].filter(d => String(d.id) !== String(id));
      persist();
    },
    getMeta(app, key) {
      const v = bucket(app).meta[key];
      return v === undefined ? null : v;
    },
    setMeta(app, key, value) {
      bucket(app).meta[key] = value === undefined ? null : value;
      persist();
    },
    clear(app) {
      state.apps[app] = { collections: {}, meta: {} };
      persist();
    },
    stats(app) {
      const out = {};
      for (const [c, arr] of Object.entries(bucket(app).collections)) out[c] = arr.length;
      return out;
    }
  };
}

module.exports = { open: () => sqliteStore() || jsonStore() };
