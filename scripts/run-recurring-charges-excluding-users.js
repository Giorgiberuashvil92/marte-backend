const { MongoClient } = require('mongodb');
const { loadMarteEnv, resolveMongo } = require('./mongodb-uri');

const API_BASE_URL = process.env.API_BASE_URL || 'https://marte-backend-production.up.railway.app';
const EXCLUDED_USER_IDS = [
  'usr_1780003476863',
  'usr_1776244678379',
  'usr_1775288085046',
  'usr_1779899555555',
  'usr_1775492595176',
  'usr_1776281617005',
  'usr_1775062080683',
  'usr_1776404247890',
  'usr_1775540190758',
  'usr_1780926555221',
  'usr_1787596822023',
  'usr_1779043367348',
  'usr_1775511423976',
  'usr_1776244678379',
];

async function main() {
  loadMarteEnv();
  const { uri, dbName } = resolveMongo();
  const client = new MongoClient(uri);
  const targetDate = new Date('2026-09-12T00:00:00+04:00');
  const filter = {
    status: 'active',
    bogCardToken: { $exists: true, $nin: [null, ''] },
    userId: { $nin: [...new Set(EXCLUDED_USER_IDS)] },
  };

  try {
    await client.connect();
    const collection = client.db(dbName).collection('subscriptions');
    const subscriptions = await collection.find(filter, {
      projection: { _id: 1, userId: 1, bogCardToken: 1 },
    }).toArray();

    console.log(`Eligible subscriptions: ${subscriptions.length}`);
    if (!subscriptions.length) return;

    await collection.updateMany(filter, {
      $set: { nextBillingDate: targetDate, updatedAt: new Date() },
    });

    let success = 0;
    let failed = 0;
    for (const subscription of subscriptions) {
      const response = await fetch(
        `${API_BASE_URL}/api/recurring-payments/process-by-order/${encodeURIComponent(subscription.bogCardToken)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      );
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.success) {
        success += 1;
        console.log(`Charged: ${subscription.userId}`);
      } else {
        failed += 1;
        console.error(`Failed: ${subscription.userId} (${result.message || `HTTP ${response.status}`})`);
      }
    }
    console.log(JSON.stringify({ eligible: subscriptions.length, success, failed, excluded: [...new Set(EXCLUDED_USER_IDS)].length }));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
