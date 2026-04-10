/**
 * my.ge მწარმოებლების იმპორტი MongoDB `carbrands` კოლექციაში
 * (data/myauto-manufacturers.json — გენერირდება myauto-mans-data.cjs-იდან).
 *
 * Dry-run: node scripts/import-myauto-brands.js
 * ჩაწერა:   node scripts/import-myauto-brands.js --apply
 *
 * მოდელები ამ წყაროში არაა — მხოლოდ ბრენდები. მოდელებისთვის საჭიროა ცალკე API/ფაილი.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

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

async function main() {
  const apply = process.argv.includes('--apply');
  const jsonPath = path.join(__dirname, '..', 'data', 'myauto-manufacturers.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('არ მოიძებნა:', jsonPath);
    console.error('გენერაცია: npm run build:myauto-brands');
    process.exit(1);
  }
  const brands = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (!Array.isArray(brands)) {
    console.error('JSON უნდა იყოს მასივი');
    process.exit(1);
  }

  const uri = buildMongoUri();
  const dbName = getDbNameFromUri(uri);
  console.log(
    `ჩანაწერები: ${brands.length}, DB: ${dbName}, collection: carbrands, --apply: ${apply}`,
  );

  if (!apply) {
    console.log('ნიმუში:', JSON.stringify(brands.slice(0, 2), null, 2));
    console.log('\nჩასაწერად დაამატე --apply');
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const col = client.db(dbName).collection('carbrands');
    let ok = 0;
    for (const b of brands) {
      const name = String(b.name || '').trim();
      if (!name) continue;
      const myautoManId = b.myautoManId != null ? String(b.myautoManId) : undefined;
      const logo = b.logo ? String(b.logo) : undefined;
      await col.updateOne(
        { name },
        {
          $set: {
            name,
            ...(myautoManId ? { myautoManId } : {}),
            ...(logo ? { logo } : {}),
            isActive: true,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            models: [],
            order: 0,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      ok++;
    }
    console.log(`დასრულებული: ${ok} upsert`);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
