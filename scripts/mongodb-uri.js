/**
 * Mongo connection — იგივე წესები რაც src/app.module.ts → mongooseMongoConfig().
 * სკრიპტებიდან: loadMarteEnv(); const { uri, dbName } = resolveMongo();
 */

const fs = require('fs');
const path = require('path');

function trimMongoEnv(s) {
  let v = (s ?? '')
    .trim()
    .replace(/;+\s*$/g, '')
    .trim();
  while (
    (v.startsWith("'") && v.endsWith("'")) ||
    (v.startsWith('"') && v.endsWith('"'))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** სრული URI-დან default database (path /dbname), თუ არა — null */
function defaultDbNameFromUri(uri) {
  const noQuery = uri.split('?')[0];
  const afterScheme = noQuery.replace(/^mongodb(\+srv)?:\/\//, '');
  const at = afterScheme.lastIndexOf('@');
  const hostAndPath = at >= 0 ? afterScheme.slice(at + 1) : afterScheme;
  const slash = hostAndPath.indexOf('/');
  if (slash === -1) return null;
  const db = hostAndPath.slice(slash + 1).trim();
  return db ? decodeURIComponent(db) : null;
}

/**
 * @returns {{ uri: string, dbName: string }}
 */
function resolveMongo() {
  const full = trimMongoEnv(process.env.MONGODB_URI);
  if (full.startsWith('mongodb://') || full.startsWith('mongodb+srv://')) {
    const dbName =
      defaultDbNameFromUri(full) ||
      trimMongoEnv(process.env.MONGODB_DATABASE) ||
      'carapp-v2';
    return { uri: full, dbName };
  }

  const user = trimMongoEnv(
    process.env.MONGODB_USERNAME ??
      process.env.MONGO_USERNAME ??
      process.env.DB_USERNAME,
  );
  const pass = trimMongoEnv(
    process.env.MONGODB_PASSWORD ??
      process.env.MONGO_PASSWORD ??
      process.env.DB_PASSWORD,
  );
  const host =
    trimMongoEnv(process.env.MONGODB_HOST) || 'carappx.lh8hx2q.mongodb.net';
  const dbName = trimMongoEnv(process.env.MONGODB_DATABASE) || 'carapp-v2';
  const appName = trimMongoEnv(process.env.MONGODB_APP_NAME) || 'CarappX';

  if (!user || !pass) {
    throw new Error(
      'MongoDB: დააყენე .env-ში MONGODB_URI (სრული connection string) ან MONGODB_USERNAME + MONGODB_PASSWORD — როგორც app.module.ts.',
    );
  }

  const qs = new URLSearchParams({
    appName,
    retryWrites: 'true',
    w: 'majority',
    authSource: 'admin',
  });
  const uri = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${encodeURIComponent(dbName)}?${qs.toString()}`;
  return { uri, dbName };
}

function loadMarteEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim().replace(/;+\s*$/g, '').trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

module.exports = {
  trimMongoEnv,
  resolveMongo,
  loadMarteEnv,
  defaultDbNameFromUri,
};
