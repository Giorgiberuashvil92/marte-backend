const { MongoClient } = require('mongodb');
const { loadMarteEnv, resolveMongo } = require('./mongodb-uri');

const EXCLUDED_USER_IDS = [
  'usr_1780003476863', 'usr_1776244678379', 'usr_1775288085046',
  'usr_1779899555555', 'usr_1775492595176', 'usr_1776281617005',
  'usr_1775062080683', 'usr_1776404247890', 'usr_1775540190758',
  'usr_1780926555221', 'usr_1787596822023', 'usr_1779043367348',
  'usr_1775511423976',
];

async function main() {
  loadMarteEnv();
  const { uri, dbName } = resolveMongo();
  const client = new MongoClient(uri);
  const filter = {
    status: 'active',
    bogCardToken: { $exists: true, $nin: [null, ''] },
    userId: { $nin: EXCLUDED_USER_IDS },
  };
  const targetDate = new Date('2026-09-12T00:00:00+04:00');

  try {
    await client.connect();
    const result = await client.db(dbName).collection('subscriptions').updateMany(filter, {
      $set: { nextBillingDate: targetDate, updatedAt: new Date() },
    });
    console.log(JSON.stringify({ modified: result.modifiedCount, matched: result.matchedCount, excluded: EXCLUDED_USER_IDS.length, targetDate: targetDate.toISOString() }));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
