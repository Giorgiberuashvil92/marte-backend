/**
 * ხელით პრემიუმი ტელეფონის მიხედვით (იგივე ველები რაც SubscriptionsService.grantPremiumByPhone).
 * საჭიროა `.env` Mongo credentials — იხილე `scripts/mongodb-uri.js`.
 *
 *   cd marte-backend
 *   node scripts/grant-premium-by-phone.js 598251546
 *   node scripts/grant-premium-by-phone.js +995598251546
 *   node scripts/grant-premium-by-phone.js 598251546 --dry-run
 *   node scripts/grant-premium-by-phone.js --help
 */

const { MongoClient } = require('mongodb');
const { loadMarteEnv, resolveMongo } = require('./mongodb-uri');

function phoneVariants(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const set = new Set();
  set.add(String(raw || '').trim());
  if (d.length >= 9) {
    const last9 = d.slice(-9);
    set.add(last9);
    set.add(`+995${last9}`);
    set.add(`995${last9}`);
  }
  return [...set].filter(Boolean);
}

function nextBillingMonthly(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function resolveUserId(user) {
  if (!user) return null;
  if (user.id != null && String(user.id).length > 0) return String(user.id);
  if (user._id != null) return String(user._id);
  return null;
}

function printHelp() {
  console.log(`
grant-premium-by-phone — MongoDB-ში users-ის მოძებნა ტელეფონით და
subscriptions-ზე active premium (manual) ჩაწერა/განახლება.

გამოყენება:
  node scripts/grant-premium-by-phone.js <phone> [--dry-run]

  phone     — 598251546, 555123456, +995598251546 (ნომრის ფორმატები აირება)
  --dry-run — მხოლოდ user + რა მოხდება, ჩაწერა არა

გარემო:  marte-backend/.env  →  MONGODB_URI  ან  MONGODB_USERNAME + MONGODB_PASSWORD
`);
}

async function main() {
  loadMarteEnv();
  const dryRun = process.argv.includes('--dry-run');
  const help =
    process.argv.includes('--help') || process.argv.includes('-h');
  if (help) {
    printHelp();
    process.exit(0);
  }

  const args = process.argv.slice(2).filter(
    (a) => a !== '--dry-run' && a !== '--help' && a !== '-h',
  );
  const phoneArg = args[0];
  if (!phoneArg) {
    console.error('გამოყენება: node scripts/grant-premium-by-phone.js <phone> [--dry-run]');
    console.error('         node scripts/grant-premium-by-phone.js --help');
    process.exit(1);
  }

  let uri;
  let dbName;
  try {
    ({ uri, dbName } = resolveMongo());
  } catch (e) {
    console.error('❌', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const variants = phoneVariants(phoneArg);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  const subs = db.collection('subscriptions');

  const user = await users.findOne({ phone: { $in: variants } });
  if (!user) {
    console.error('❌ users: ტელეფონი არ მოიძებნა', variants);
    await client.close();
    process.exit(1);
  }

  const userId = resolveUserId(user);
  if (!userId) {
    console.error('❌ user დოკუმენტს არ აქვს id ან _id', user);
    await client.close();
    process.exit(1);
  }
  console.log('✅ userId:', userId, '| phone (DB):', user.phone);

  const now = new Date();
  const nextBilling = nextBillingMonthly(now);

  const existing = await subs.findOne({ userId, status: 'active' });

  if (dryRun) {
    const payload = {
      userId,
      planId: 'premium',
      planName: 'პრემიუმ პაკეტი',
      planPrice: 0,
      currency: 'GEL',
      period: 'monthly',
      status: 'active',
      startDate: now,
      nextBillingDate: nextBilling,
      paymentMethod: 'manual',
      totalPaid: 0,
      billingCycles: 0,
      carfaxRequestsUsed: 0,
      maxFinesCars: 1,
    };
    console.log(
      '[dry-run]',
      existing ? 'განახლდება' : 'ჩაიწერება',
      existing?._id ? `subscription _id: ${String(existing._id)}` : '(ახალი დოკი)',
    );
    console.log(JSON.stringify({ ...payload, _note: 'dates არაა Mongo Date ობიექტი — მხოლოდ preview' }, null, 2));
    await client.close();
    return;
  }

  if (existing) {
    await subs.updateOne(
      { _id: existing._id },
      {
        $set: {
          planId: 'premium',
          planName: 'პრემიუმ პაკეტი',
          planPrice: 0,
          currency: 'GEL',
          period: 'monthly',
          status: 'active',
          startDate: now,
          nextBillingDate: nextBilling,
          paymentMethod: 'manual',
          totalPaid: 0,
          billingCycles: 0,
          carfaxRequestsUsed: 0,
          maxFinesCars: 1,
          updatedAt: now,
        },
        $unset: { bogCardToken: '', orderId: '', transactionId: '' },
      },
    );
    console.log('✅ განახლებულია premium (manual):', String(existing._id));
  } else {
    const doc = {
      userId,
      planId: 'premium',
      planName: 'პრემიუმ პაკეტი',
      planPrice: 0,
      currency: 'GEL',
      period: 'monthly',
      status: 'active',
      startDate: now,
      nextBillingDate: nextBilling,
      paymentMethod: 'manual',
      totalPaid: 0,
      billingCycles: 0,
      carfaxRequestsUsed: 0,
      maxFinesCars: 1,
      createdAt: now,
      updatedAt: now,
    };
    const ins = await subs.insertOne(doc);
    console.log('✅ შექმნილია premium (manual):', String(ins.insertedId));
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
