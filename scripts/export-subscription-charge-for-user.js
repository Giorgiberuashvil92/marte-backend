/**
 * MongoDB-დან ერთი userId-ის subscription → seed JSON (მხოლოდ თუ ჩანაწერი ჯერ კიდევ ბაზაშია).
 * თუ DB წაშლილია — იყენი ლოგებიდან UUID-ები (BOG callback / Order ID) და subscription-seed.json.
 *
 * გაშვება (marte-backend საქაღალდიდან):
 *   node scripts/export-subscription-charge-for-user.js usr_1772363110783
 */

const { MongoClient } = require('mongodb');
const { loadMarteEnv, resolveMongo } = require('./mongodb-uri');

function iso(d) {
  if (!d) return undefined;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? undefined : x.toISOString();
}

async function main() {
  loadMarteEnv();
  const userId = process.argv[2];
  if (!userId) {
    console.error(
      'გამოყენება: node scripts/export-subscription-charge-for-user.js <userId>',
    );
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

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const subs = await db
    .collection('subscriptions')
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(1)
    .toArray();

  const sub = subs[0];
  if (!sub) {
    console.error(`❌ subscriptions: userId ${userId} არ მოიძებნა (${dbName})`);
    await client.close();
    process.exit(1);
  }

  const payments = await db
    .collection('payments')
    .find({ userId, context: 'subscription' })
    .sort({ paymentDate: -1, updatedAt: -1 })
    .limit(5)
    .toArray();

  const bogCardToken = sub.bogCardToken;
  if (!bogCardToken) {
    console.error('❌ subscription-ში bogCardToken აკლია — seed ვერ შეიქმნება');
    await client.close();
    process.exit(1);
  }

  const lastPayment = payments[0];
  const lastChargeOrderId =
    lastPayment?.orderId || sub.orderId || sub.transactionId || bogCardToken;

  const charge = {
    userId: sub.userId,
    bogCardToken,
    planId: sub.planId,
    planName: sub.planName,
    planPrice: sub.planPrice,
    currency: sub.currency || 'GEL',
    period: sub.period || 'monthly',
    billingCycles: sub.billingCycles ?? 1,
    totalPaid: sub.totalPaid ?? sub.planPrice,
    lastChargeOrderId,
    nextBillingDate: iso(sub.nextBillingDate),
    _note: `export ${dbName} subscription _id=${String(sub._id)}; ბოლო subscription payment order: ${lastPayment?.orderId || '—'}; ლოგიდან მხოლოდ userId — დანარჩენი DB`,
  };

  console.log(JSON.stringify({ charges: [charge] }, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
