/**
 * Supabase-იდან ექსპორტირებული სერვისების მასივის იმპორტი MongoDB `mechanics` კოლექციაში
 * (CarappX Mechanic სქემის მიხედვით — თითო სერვისი = ერთი განცხადება).
 *
 * მომზადება:
 *   JSON დაინახშირე ფაილში, მაგ. marte-backend/data/supabase-services.json
 *
 * ხმოვანი გაშვება (რას ჩაიწერება ნახავ):
 *   cd marte-backend && node scripts/import-supabase-mechanic-services.js ./data/supabase-services.json
 *
 * რეალური ჩაწერა:
 *   node scripts/import-supabase-mechanic-services.js ./data/supabase-services.json --apply
 *
 * საჭიროა MONGODB_URI (ან MONGODB_USERNAME + MONGODB_PASSWORD + MONGODB_DATABASE როგორც app-ში).
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

/** marte-backend/.env — Node სკრიპტს ავტომატურად არ ტვირთავს */
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

function buildDescription(row) {
  const lines = [];
  if (row.description && String(row.description).trim()) {
    lines.push(String(row.description).trim());
  }
  const meta = [];
  if (row.price_from != null || row.price_to != null) {
    meta.push(
      `ფასი: ${row.price_from ?? '—'} – ${row.price_to ?? '—'} ₾`.trim(),
    );
  }
  if (row.estimated_hours != null) {
    meta.push(`სავარაუდო დრო: ~${row.estimated_hours} სთ`);
  }
  if (row.on_site_service) meta.push('ადგილზე მისვლა');
  const pay = [];
  if (row.accepts_card_payment) pay.push('ბარათი');
  if (row.accepts_cash_payment) pay.push('ნაღდი ფული');
  if (pay.length) meta.push(`გადახდა: ${pay.join(', ')}`);
  if (meta.length) lines.push(meta.join(' · '));
  const text = lines.join('\n\n').trim();
  return text || row.name || 'იმპორტი Supabase-იდან';
}

function mapRow(row) {
  const importSourceKey = `supabase:service:${row.id}`;
  const location =
    [row.city, row.district].filter(Boolean).join(', ') ||
    row.city ||
    'საქართველო';

  let latitude =
    row.latitude != null && row.latitude !== ''
      ? Number(row.latitude)
      : undefined;
  let longitude =
    row.longitude != null && row.longitude !== ''
      ? Number(row.longitude)
      : undefined;
  if (latitude !== undefined && (Number.isNaN(latitude) || latitude === 0)) {
    latitude = undefined;
  }
  if (longitude !== undefined && (Number.isNaN(longitude) || longitude === 0)) {
    longitude = undefined;
  }

  const isFeatured =
    !!row.is_vip_active ||
    row.vip_status === 'vip' ||
    row.vip_status === 'super_vip';

  let expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  if (row.vip_until) {
    const d = new Date(row.vip_until);
    if (!Number.isNaN(d.getTime())) expiryDate = d;
  }

  const specialty =
    row.service_categories && row.service_categories.name
      ? row.service_categories.name
      : 'დიაგნოსტიკა';

  const experience =
    row.estimated_hours != null && row.estimated_hours !== ''
      ? `~${row.estimated_hours} სთ`
      : undefined;

  const services = Array.isArray(row.car_brands)
    ? row.car_brands.map((b) => String(b)).filter(Boolean)
    : [];

  const avatar =
    Array.isArray(row.photos) && row.photos.length > 0
      ? row.photos[0]
      : undefined;

  return {
    importSourceKey,
    name: String(row.name || 'სერვისი').trim().slice(0, 500),
    specialty: String(specialty).slice(0, 200),
    experience,
    location: String(location).slice(0, 300),
    latitude,
    longitude,
    avatar,
    rating: typeof row.rating === 'number' ? row.rating : 0,
    reviews: typeof row.review_count === 'number' ? row.review_count : 0,
    isAvailable: true,
    services,
    description: buildDescription(row).slice(0, 8000),
    address: row.address ? String(row.address).slice(0, 500) : undefined,
    ownerId: `migrated:supabase:${row.mechanic_id}`,
    isFeatured,
    expiryDate,
    status: 'active',
  };
}

/**
 * ფაილის ძებნა: cwd შეიძლება იყოს carappX ან marte-backend (npm --prefix).
 */
function resolveJsonPath(fileArg, backendRoot) {
  const repoRoot = path.join(backendRoot, '..');
  const candidates = [];
  const add = (p) => {
    const n = path.normalize(path.resolve(p));
    if (!candidates.includes(n)) candidates.push(n);
  };

  if (path.isAbsolute(fileArg)) {
    add(fileArg);
    return { abs: candidates.find((p) => fs.existsSync(p)) ?? null, candidates };
  }

  add(path.join(process.cwd(), fileArg));
  add(path.join(backendRoot, fileArg));
  add(path.join(repoRoot, fileArg));

  const bn = path.basename(fileArg);
  add(path.join(backendRoot, 'data', bn));
  add(path.join(repoRoot, 'marte-backend', 'data', bn));

  const m = fileArg.match(/marte-backend[/\\](.+)$/);
  if (m) {
    add(path.join(repoRoot, 'marte-backend', m[1]));
    add(path.join(backendRoot, m[1]));
  }

  return { abs: candidates.find((p) => fs.existsSync(p)) ?? null, candidates };
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  let fileArg = argv.find((a) => !a.startsWith('--'));
  if (!fileArg) {
    fileArg = 'data/supabase-services.json';
    console.log('ფაილი არ მიუთითებია → ნაგულისხმევი:', fileArg);
  }

  const backendRoot = path.join(__dirname, '..');
  const { abs, candidates } = resolveJsonPath(fileArg, backendRoot);

  if (!abs) {
    console.error('ფაილი არ მოიძებნა:', fileArg);
    console.error('სცადა:\n  ' + candidates.join('\n  '));
    console.error(
      '\nშენ:\n  1) ჩასვი JSON მასივი → marte-backend/data/supabase-services.json\n  2) ან: cp data/supabase-services.example.json data/supabase-services.json და შეცვალე შიგთავსი\n  3) ფესვიდან: npm run import:supabase-mechanics -- ./marte-backend/data/supabase-services.json --apply',
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(abs, 'utf8');
  let rows = JSON.parse(raw);
  if (Array.isArray(rows) && rows.length && Array.isArray(rows[0])) {
    rows = rows.flat();
  }
  if (!Array.isArray(rows)) {
    console.error('JSON უნდა იყოს მასივი');
    process.exit(1);
  }

  const uri = buildMongoUri();
  const dbName = getDbNameFromUri(uri);

  console.log(`ჩანაწერები: ${rows.length}, DB: ${dbName}, --apply: ${apply}`);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const col = client.db(dbName).collection('mechanics');

    let ok = 0;
    let err = 0;
    for (const row of rows) {
      try {
        if (row.id == null) {
          console.warn('გამოტოვება: id არ აქვს', row.name);
          err++;
          continue;
        }
        const doc = mapRow(row);
        const createdAt = row.created_at
          ? new Date(row.created_at)
          : new Date();
        if (apply) {
          await col.updateOne(
            { importSourceKey: doc.importSourceKey },
            {
              $set: { ...doc, updatedAt: new Date() },
              $setOnInsert: { createdAt },
            },
            { upsert: true },
          );
        }
        ok++;
        if (!apply && ok <= 3) {
          console.log('ნიმუში:', JSON.stringify(doc, null, 2).slice(0, 800));
        }
      } catch (e) {
        err++;
        console.error('შეცდომა id=', row.id, e.message);
      }
    }

    console.log(
      apply
        ? `დასრულებული: ${ok} დამუშავებული, ${err} შეცდომა`
        : `Dry-run: ${ok} ვალიდური, ${err} პრობლემა (ჩასაწერად დაამატე --apply)`,
    );
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
