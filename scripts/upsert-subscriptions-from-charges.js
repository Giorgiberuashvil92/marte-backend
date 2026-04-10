/**
 * წარმატებული BOG ჩამოჭრების სიიდან subscriptions კოლექციაში ჩანაწერების შექმნა/განახლება.
 *
 * Mongo: იგივე წესები რაც Nest `app.module.ts` (MONGODB_URI ან USER+PASS+HOST+DATABASE).
 *
 * გაშვება (marte-backend საქაღალდიდან):
 *   node scripts/upsert-subscriptions-from-charges.js scripts/subscription-seed.json
 *
 * ოფციები:
 *   --dry-run   — მხოლოდ ბეჭდავს, ბაზაში არ წერს
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { loadMarteEnv, resolveMongo } = require('./mongodb-uri');

function nextBillingFromPeriod(period, from = new Date()) {
  const d = new Date(from);
  switch (String(period || 'monthly')) {
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case '6months':
      d.setMonth(d.getMonth() + 6);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const files = argv.filter((a) => !a.startsWith('--'));
  return { dryRun, file: files[0] };
}

async function main() {
  loadMarteEnv();

  let uri;
  let dbName;
  try {
    ({ uri, dbName } = resolveMongo());
  } catch (e) {
    console.error('❌', e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const { dryRun, file } = parseArgs(process.argv.slice(2));

  if (!file) {
    console.error(
      'გამოყენება: node scripts/upsert-subscriptions-from-charges.js <ფაილი.json> [--dry-run]',
    );
    process.exit(1);
  }

  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error('❌ ფაილი არ მოიძებნა:', abs);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const charges = data.charges || data;
  if (!Array.isArray(charges) || charges.length === 0) {
    console.error('❌ JSON-ში უნდა იყოს მასივი "charges" ან თავად მასივი');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(dbName).collection('subscriptions');

  console.log(`📦 DB: ${dbName}, ჩანაწერები: ${charges.length}, dry-run: ${dryRun}\n`);

  for (let idx = 0; idx < charges.length; idx++) {
    const c = charges[idx];
    if (c._skip === true || c.skip === true) {
      console.log(
        `⏭️ [#${idx + 1}] _skip — გამოტოვებულია (${c.userId || 'userId არ არის'})`,
      );
      continue;
    }

    const {
      userId,
      bogCardToken,
      planId,
      planName,
      planPrice,
      currency = 'GEL',
      period = 'monthly',
      billingCycles = 1,
      totalPaid,
      nextBillingDate: nextIso,
      lastChargeOrderId,
    } = c;

    if (!userId || !bogCardToken || !planId || !planName || planPrice == null) {
      console.error(`❌ [#${idx + 1}] აკლია სავალდებულო ველი (userId, bogCardToken, planId, planName, planPrice)`);
      continue;
    }

    const nextBillingDate = nextIso
      ? new Date(nextIso)
      : nextBillingFromPeriod(period, new Date());

    const now = new Date();

    // იგივე ველები რაც SubscriptionsService.createSubscriptionFromPayment (mongoose defaults raw insert-ზე არ ივსება)
    const doc = {
      userId,
      planId,
      planName,
      planPrice: Number(planPrice),
      currency,
      period,
      status: 'active',
      startDate: now,
      nextBillingDate,
      paymentMethod: 'BOG',
      bogCardToken,
      totalPaid:
        totalPaid != null ? Number(totalPaid) : Number(planPrice) * Number(billingCycles || 1),
      billingCycles: Number(billingCycles) || 1,
      carfaxRequestsUsed: 0,
      maxFinesCars: 1,
      updatedAt: now,
    };

    if (lastChargeOrderId) {
      doc.orderId = lastChargeOrderId;
      doc.transactionId = lastChargeOrderId;
    }

    const existing = await col.findOne({ bogCardToken });

    if (dryRun) {
      console.log(`[dry-run] #${idx + 1} userId=${userId} token=${bogCardToken}`);
      console.log(JSON.stringify(doc, null, 2));
      continue;
    }

    if (existing) {
      if (existing.userId !== userId) {
        console.warn(
          `⚠️ [#${idx + 1}] bogCardToken უკვე სხვა userId-ზეა (${existing.userId} → ${userId}). მაინც ვაახლებთ userId-ს.`,
        );
      }
      const { startDate: _drop, createdAt: _c, ...rest } = doc;
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            ...rest,
            // არსებული ჩანაწერის startDate / createdAt არ ვცვლით (ნორმალური ნაკადის მსგავსად)
            startDate: existing.startDate || doc.startDate,
            createdAt: existing.createdAt || doc.startDate,
          },
        },
      );
      console.log(`✅ განახლებულია subscription ${existing._id} (bogCardToken)`);
    } else {
      doc.createdAt = now;
      const ins = await col.insertOne(doc);
      console.log(`✅ შექმნილია subscription ${ins.insertedId}`);
    }
  }

  await client.close();
  console.log('\n✅ დასრულებულია');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
