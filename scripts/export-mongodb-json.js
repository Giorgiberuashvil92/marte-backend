/**
 * MongoDB-ის ექსპორტი JSONL ფორმატში (კოლექცია → ერთი ფაილი, თითო ხაზი = ერთი დოკუმენტი BSON EJSON).
 *
 * გაშვება (marte-backend საქაღალდიდან):
 *   MONGODB_URI="mongodb+srv://..." npm run export:mongodb
 *   MONGODB_URI="..." node scripts/export-mongodb-json.js --out ./exports/my-run
 *   node scripts/export-mongodb-json.js --only users
 *
 * ოფციონალური: MONGODB_DB_NAME (თუ URI-ში DB სახელი არ ჩანს)
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

function normalizeUri(uri) {
  let u = String(uri).trim();
  if (
    (u.startsWith('"') && u.endsWith('"')) ||
    (u.startsWith("'") && u.endsWith("'"))
  ) {
    u = u.slice(1, -1);
  }
  return u.replace(/;+$/, '');
}

function getDbName(uri) {
  if (process.env.MONGODB_DB_NAME) return process.env.MONGODB_DB_NAME;
  try {
    const noQuery = uri.split('?')[0];
    const parts = noQuery.split('/');
    const last = parts[parts.length - 1];
    if (last && last.length > 0 && !last.includes('@')) return last;
  } catch {
    /* ignore */
  }
  return 'carapp-v2';
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let out = null;
  let only = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      out = argv[++i];
    } else if (a.startsWith('--out=')) {
      out = a.slice('--out='.length);
    } else if (a === '--only' && argv[i + 1]) {
      only = argv[++i];
    } else if (a.startsWith('--only=')) {
      only = a.slice('--only='.length);
    }
  }
  return { out, only };
}

async function exportCollection(coll, filePath) {
  const ws = fs.createWriteStream(filePath, { flags: 'w' });
  const cursor = coll.find({});
  let n = 0;
  const logEvery = 5000;
  for await (const doc of cursor) {
    const line = EJSON.stringify(doc, { relaxed: true }) + '\n';
    if (!ws.write(line)) {
      await new Promise((r) => ws.once('drain', r));
    }
    n++;
    if (n % logEvery === 0) {
      process.stdout.write(`  … ${n} დოკუმენტი\n`);
    }
  }
  await new Promise((resolve, reject) => {
    ws.end((err) => (err ? reject(err) : resolve()));
  });
  return n;
}

async function main() {
  const raw = process.env.MONGODB_URI;
  if (!raw) {
    console.error('დააყენე MONGODB_URI (მაგ. ტერმინალში ან .env-ის ხელით ჩატვირთვით).');
    process.exit(1);
  }
  const uri = normalizeUri(raw);
  const { out: outArg, only } = parseArgs();
  const dbName = getDbName(uri);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseDir = path.resolve(
    process.cwd(),
    outArg || path.join('exports', `mongodb-${stamp}`),
  );

  console.log(`DB: ${dbName}`);
  console.log(`საქაღალდე: ${baseDir}`);
  if (only) console.log(`მხოლოდ კოლექცია: ${only}`);

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const cols = await db.listCollections().toArray();
    const names = cols
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'))
      .sort();
    const selected = only ? names.filter((n) => n === only) : names;
    if (only && selected.length === 0) {
      console.error(`კოლექცია "${only}" ვერ მოიძებნა.`);
      process.exit(1);
    }

    fs.mkdirSync(baseDir, { recursive: true });
    const manifest = {
      exportedAt: new Date().toISOString(),
      database: dbName,
      collections: [],
    };

    for (const name of selected) {
      const filePath = path.join(baseDir, `${name}.jsonl`);
      process.stdout.write(`${name} … `);
      const count = await exportCollection(db.collection(name), filePath);
      manifest.collections.push({ name, documents: count, file: `${name}.jsonl` });
      console.log(`${count} დოკუმენტი → ${path.basename(filePath)}`);
    }

    fs.writeFileSync(
      path.join(baseDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );
    console.log('მზადაა manifest.json');
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
