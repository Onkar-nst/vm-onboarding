// Katta Knowledge — demo seed. Writes the demo episode library (knowledge.js)
// into the database on first run. Real deployments set loadDemoSeed:false and
// index their own sessions via the Library → “+ Add episode” editor or a
// JSON import in the admin panel.

async function loadSeedIfEmpty() {
  const seeded = await Store.getMeta("seeded");
  const eps = await Store.list("episodes");
  if (seeded || eps.length) return false;
  await writeSeed();
  return true;
}

async function writeSeed() {
  await Store.put("settings", { id: "settings", orgName: "The Katta", adminPin: "1234" });
  for (const ep of SEED_EPISODES) await Store.put("episodes", ep);
  await Store.setMeta("seeded", true);
}
