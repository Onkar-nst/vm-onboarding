/* Katta Knowledge — data access layer (same contract as the other Katta-suite apps).
 *
 * Adapter contract (all methods async):
 *   list(collection)       -> [doc]            GET    {api}/{collection}
 *   put(collection, doc)   -> doc (upsert .id) PUT    {api}/{collection}/{id}
 *   remove(collection, id) -> void             DELETE {api}/{collection}/{id}
 *   getMeta(key)           -> value|null       GET    {api}/meta/{key}
 *   setMeta(key, value)    -> void             PUT    {api}/meta/{key}
 *   clearAll()             -> void             POST   {api}/admin/clear
 */

class LocalAdapter {
  constructor(namespace) { this.ns = namespace; }
  _k(c) { return this.ns + ":" + c; }
  async list(c) {
    try { return JSON.parse(localStorage.getItem(this._k(c)) || "[]"); }
    catch (e) { return []; }
  }
  async _saveAll(c, docs) { localStorage.setItem(this._k(c), JSON.stringify(docs)); }
  async put(c, doc) {
    const all = await this.list(c);
    const i = all.findIndex(d => d.id === doc.id);
    if (i >= 0) all[i] = doc; else all.push(doc);
    await this._saveAll(c, all);
    return doc;
  }
  async remove(c, id) {
    const all = await this.list(c);
    await this._saveAll(c, all.filter(d => d.id !== id));
  }
  async getMeta(key) {
    const raw = localStorage.getItem(this._k("meta." + key));
    return raw === null ? null : JSON.parse(raw);
  }
  async setMeta(key, value) { localStorage.setItem(this._k("meta." + key), JSON.stringify(value)); }
  async clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.ns + ":"))
      .forEach(k => localStorage.removeItem(k));
  }
}

class RestAdapter {
  constructor(baseUrl, token) { this.base = baseUrl.replace(/\/$/, ""); this.token = token; }
  async _req(method, path, body) {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { "Authorization": "Bearer " + this.token } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!res.ok) throw new Error("API " + method + " " + path + " → " + res.status);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  async list(c) { return (await this._req("GET", "/" + c)) || []; }
  async put(c, doc) { return this._req("PUT", "/" + c + "/" + encodeURIComponent(doc.id), doc); }
  async remove(c, id) { return this._req("DELETE", "/" + c + "/" + encodeURIComponent(id)); }
  async getMeta(key) { return this._req("GET", "/meta/" + encodeURIComponent(key)); }
  async setMeta(key, value) { return this._req("PUT", "/meta/" + encodeURIComponent(key), { value }); }
  async clearAll() { return this._req("POST", "/admin/clear"); }
}

const Store = (() => {
  const cfg = window.APP_CONFIG || { adapter: "local", namespace: "katta_v2" };
  const adapter = cfg.adapter === "rest"
    ? new RestAdapter(cfg.apiUrl, cfg.apiToken)
    : new LocalAdapter(cfg.namespace || "katta_v2");
  return {
    adapter,
    list: (c) => adapter.list(c),
    put: (c, d) => adapter.put(c, d),
    remove: (c, id) => adapter.remove(c, id),
    getMeta: (k) => adapter.getMeta(k),
    setMeta: (k, v) => adapter.setMeta(k, v),
    clearAll: () => adapter.clearAll(),
    async nextId(prefix) {
      const key = "seq." + prefix;
      const n = ((await adapter.getMeta(key)) || 0) + 1;
      await adapter.setMeta(key, n);
      return prefix + "-" + String(n).padStart(3, "0");
    },
    async exportAll(collections) {
      const dump = { exportedAt: new Date().toISOString(), collections: {} };
      for (const c of collections) dump.collections[c] = await adapter.list(c);
      return dump;
    },
    async importAll(dump) {
      for (const [c, docs] of Object.entries(dump.collections || {}))
        for (const d of docs) await adapter.put(c, d);
    }
  };
})();
