/**
 * NHTSA vPIC API-დან მოდელების შევსება `carbrands.models`-ში (merge, არაფერი იშლება).
 * წყარო: https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{Make}?format=json
 *
 * აშშ ბაზაზეა — ზოგი ბრენდი/მოდელი აკლია ან სხვა სახელითაა (მაგ. Skoda vPIC-ში ხშირად არაა).
 *
 * Dry-run: node scripts/import-nhtsa-car-models.js
 * ჩაწერა: node scripts/import-nhtsa-car-models.js --apply
 *
 * ოფციები:
 *   --delay-ms 300     — პაუზა მოთხოვნებს შორის (მილიწამი)
 *   --only Toyota,BMW  — მხოლოდ ამ სახელების ბრენდები (ზუსტი name ველდება DB-ში)
 *
 * ალტერნატიული Make სახელი NHTSA-სთვის: data/nhtsa-make-aliases.json
 * ფორმატი: { "ჩვენი სახელი": "NHTSA Make_Name" }
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const VPIC_BASE =
  'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake';

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadLocalEnv();

function trimEnv(s) {
  if (s == null) return '';
  let v = String(s).trim().replace(/;+\s*$/g, '');
  while (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function buildMongoUri() {
  const full = trimEnv(process.env.MONGODB_URI);
  if (full.startsWith('mongodb://') || full.startsWith('mongodb+srv://')) {
    return full;
  }
  const user = trimEnv(
    process.env.MONGODB_USERNAME ||
      process.env.MONGO_USERNAME ||
      process.env.DB_USERNAME,
  );
  const pass = trimEnv(
    process.env.MONGODB_PASSWORD ||
      process.env.MONGO_PASSWORD ||
      process.env.DB_PASSWORD,
  );
  const host =
    trimEnv(process.env.MONGODB_HOST) || 'carappx.lh8hx2q.mongodb.net';
  const dbName = trimEnv(process.env.MONGODB_DATABASE) || 'carapp-v2';
  const appName = trimEnv(process.env.MONGODB_APP_NAME) || 'CarappX';
  if (!user || !pass) {
    throw new Error('დააყენე MONGODB_URI ან MONGODB_USERNAME + MONGODB_PASSWORD');
  }
  const qs = new URLSearchParams({
    appName,
    retryWrites: 'true',
    w: 'majority',
    authSource: 'admin',
  });
  return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${encodeURIComponent(dbName)}?${qs.toString()}`;
}

function getDbNameFromUri(uri) {
  if (trimEnv(process.env.MONGODB_DATABASE)) {
    return trimEnv(process.env.MONGODB_DATABASE);
  }
  try {
    const noQuery = uri.split('?')[0];
    const parts = noQuery.split('/');
    const last = parts[parts.length - 1];
    if (last && !last.includes('@')) return last;
  } catch {
    /* ignore */
  }
  return 'carapp-v2';
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  let delayMs = 300;
  const di = argv.indexOf('--delay-ms');
  if (di >= 0 && argv[di + 1]) {
    const n = Number(argv[di + 1]);
    if (!Number.isNaN(n) && n >= 0) delayMs = n;
  }
  let onlySet = null;
  const oi = argv.indexOf('--only');
  if (oi >= 0 && argv[oi + 1]) {
    onlySet = new Set(
      String(argv[oi + 1])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return { apply, delayMs, onlySet };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadAliases() {
  const p = path.join(__dirname, '..', 'data', 'nhtsa-make-aliases.json');
  if (!fs.existsSync(p)) return {};
  try {
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

/** case-insensitive key lookup for alias map */
function aliasFor(brandName, aliases) {
  if (!brandName || !aliases) return null;
  if (aliases[brandName]) return aliases[brandName];
  const lower = brandName.toLowerCase();
  for (const k of Object.keys(aliases)) {
    if (k.toLowerCase() === lower) return aliases[k];
  }
  return null;
}

async function fetchModelsForMake(makeName) {
  const url = `${VPIC_BASE}/${encodeURIComponent(makeName)}?format=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${makeName}`);
  }
  const data = await res.json();
  const results = Array.isArray(data.Results) ? data.Results : [];
  const names = [];
  const seen = new Set();
  for (const row of results) {
    const m = row && row.Model_Name != null ? String(row.Model_Name).trim() : '';
    if (!m) continue;
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(m);
  }
  return { count: Number(data.Count) || names.length, names };
}

/**
 * არსებული + ახალი, უნიკალურობა case-insensitive; ჯერ რჩება არსებული ჩანაწერების წერილობა.
 */
function mergeModelLists(existing, incoming) {
  const out = [];
  const seen = new Set();
  const push = (s) => {
    const t = String(s).trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  for (const x of existing || []) push(x);
  for (const x of incoming || []) push(x);
  return out;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function main() {
  const { apply, delayMs, onlySet } = parseArgs(process.argv);
  const aliases = loadAliases();

  const uri = buildMongoUri();
  const dbName = getDbNameFromUri(uri);
  console.log(
    `DB: ${dbName}, collection: carbrands, NHTSA merge, --apply: ${apply}, delayMs: ${delayMs}`,
  );

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const col = client.db(dbName).collection('carbrands');
    const q = onlySet && onlySet.size ? { name: { $in: [...onlySet] } } : {};
    const brands = await col.find(q).project({ name: 1, models: 1 }).toArray();
    console.log(`ბრენდები სამუშაოდ: ${brands.length}`);

    const summary = {
      updated: 0,
      unchanged: 0,
      noDataFromApi: 0,
    };

    for (let i = 0; i < brands.length; i++) {
      const doc = brands[i];
      const name = String(doc.name || '').trim();
      if (!name) continue;

      const aliasTarget = aliasFor(name, aliases);
      const tryMakes = aliasTarget
        ? [aliasTarget, name]
        : [name];

      let fetchedNames = [];
      let usedMake = null;
      let lastErr = null;
      let anyFetchOk = false;

      for (const make of tryMakes) {
        try {
          const { names } = await fetchModelsForMake(make);
          anyFetchOk = true;
          if (names.length > 0) {
            fetchedNames = names;
            usedMake = make;
            break;
          }
        } catch (e) {
          lastErr = e;
        }
      }

      if (fetchedNames.length === 0) {
        summary.noDataFromApi++;
        if (!anyFetchOk && lastErr) {
          console.warn(`⚠ ${name}: API შეცდომა — ${lastErr.message}`);
        } else {
          console.warn(`⚠ ${name}: vPIC-ში მოდელები არ მოიძებნა (სცადა: ${tryMakes.join(', ')})`);
        }
        if (i < brands.length - 1 && delayMs > 0) await sleep(delayMs);
        continue;
      }

      const existing = Array.isArray(doc.models) ? doc.models : [];
      const merged = mergeModelLists(existing, fetchedNames);

      if (arraysEqual(merged, existing)) {
        summary.unchanged++;
        console.log(`  ${name}: უცვლელი (${existing.length} მოდელი, NHTSA: ${usedMake})`);
      } else {
        const added = merged.length - existing.length;
        console.log(
          `  ${name}: +${added} ახალი (სულ ${merged.length}, NHTSA make: ${usedMake})`,
        );
        if (apply) {
          await col.updateOne(
            { _id: doc._id },
            { $set: { models: merged, updatedAt: new Date() } },
          );
        }
        summary.updated++;
      }

      if (i < brands.length - 1 && delayMs > 0) await sleep(delayMs);
    }

    console.log('\nშეჯამება:', summary);
    if (!apply) {
      console.log('\nჩასაწერად დაამატე --apply');
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
