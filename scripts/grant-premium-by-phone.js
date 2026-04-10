/**
 * ხელით პრემიუმი ტელეფონის მიხედვით (იგივე ველები რაც SubscriptionsService.grantPremiumByPhone).
 *
 *   node scripts/grant-premium-by-phone.js 555379295
 *   node scripts/grant-premium-by-phone.js 555379295 --dry-run
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

async function main() {
  loadMarteEnv();
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const dryRun = process.argv.includes('--dry-run');
  const phoneArg = args[0];
  if (!phoneArg) {
    console.error('გამოყენება: node scripts/grant-premium-by-phone.js <phone> [--dry-run]');
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

  const userId = user.id;
  console.log('✅ user:', userId, 'phone DB:', user.phone);

  const now = new Date();
  const nextBilling = nextBillingMonthly(now);

  const existing = await subs.findOne({ userId, status: 'active' });

  if (dryRun) {
    console.log('[dry-run] would', existing ? 'update' : 'insert', existing?._id || '');
    console.log(JSON.stringify({ userId, nextBillingDate: nextBilling.toISOString() }, null, 2));
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
