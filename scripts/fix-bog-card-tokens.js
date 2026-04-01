/**
 * bogCardToken-ის მასობრივი გასწორება: external / shop id → BOG parent order (UUID).
 *
 * ლოგიკა (subscriptions-ისთვის თითქმის იგივე რაც subscriptions.service updateSubscriptionTokenFromPayment):
 *  1) payments: externalOrderId === მიმდინარე bogCardToken
 *  2) userId/ownerId + paymentToken/parentOrderId არსებობა
 *  3) externalOrderId შეიცავს userId-ს (regex)
 *
 * BOG id ამოღება payment-იდან: parentOrderId > paymentToken > orderId (თუ UUID და ≠ bogCardToken)
 *
 * გაშვება:
 *   MONGODB_URI="mongodb+srv://..." node scripts/fix-bog-card-tokens.js           # dry-run
 *   MONGODB_URI="..." node scripts/fix-bog-card-tokens.js --apply                # რეალური update
 *   MONGODB_URI="..." node scripts/fix-bog-card-tokens.js --only subscriptions
 *
 * ოფციონალური: MONGODB_DB_NAME=carapp-v2 (თუ URI-ში DB სახელი არ ჩანს)
 */

const { MongoClient } = require('mongodb');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBogOrderId(token) {
  return typeof token === 'string' && UUID_RE.test(token.trim());
}

const PAYMENT_OK_STATUS = ['completed', 'success'];

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
  return {
    apply: argv.includes('--apply'),
    only:
      (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null,
  };
}

/**
 * @returns {string|null}
 */
function bogOrderIdFromPayment(payment, currentToken) {
  if (!payment) return null;
  const cur = (currentToken || '').trim();
  let bogOrderId = payment.parentOrderId?.trim() || null;

  if (
    !bogOrderId &&
    payment.paymentToken?.trim() &&
    payment.paymentToken.trim() !== cur
  ) {
    bogOrderId = payment.paymentToken.trim();
  }

  if (
    !bogOrderId &&
    payment.orderId?.trim() &&
    isValidBogOrderId(payment.orderId) &&
    payment.orderId.trim() !== cur
  ) {
    bogOrderId = payment.orderId.trim();
  }

  if (
    !bogOrderId &&
    payment.orderId === cur &&
    !payment.paymentToken &&
    !payment.parentOrderId
  ) {
    return null;
  }

  if (bogOrderId && isValidBogOrderId(bogOrderId)) return bogOrderId;
  return null;
}

/**
 * @param {import('mongodb').Collection} payments
 */
async function findPaymentForToken(payments, token, userId) {
  const t = (token || '').trim();
  if (!t) return null;

  let p = await payments.findOne(
    { externalOrderId: t, status: { $in: PAYMENT_OK_STATUS } },
    { sort: { paymentDate: -1 } },
  );
  if (p) return p;

  if (userId) {
    p = await payments.findOne(
      {
        userId,
        $or: [
          { paymentToken: { $exists: true, $nin: [null, ''] } },
          { parentOrderId: { $exists: true, $nin: [null, ''] } },
        ],
        status: { $in: PAYMENT_OK_STATUS },
      },
      { sort: { paymentDate: -1 } },
    );
    if (p) return p;

    p = await payments.findOne(
      {
        externalOrderId: { $regex: userId },
        status: { $in: PAYMENT_OK_STATUS },
      },
      { sort: { paymentDate: -1 } },
    );
    if (p) return p;
  }

  return null;
}

/**
 * Subscription-ისთვის: თუ პირველი payment არ იძლევა bogOrderId-ს, სცადე სხვა payment იმავე user-ზე
 * (იგივე რბილი ლოგიკა რაც subscriptions.service-ში)
 */
async function tryAlternateUserPayment(payments, userId, excludeId) {
  if (!userId) return null;
  return payments.findOne(
    {
      userId,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      $or: [
        { paymentToken: { $exists: true, $nin: [null, ''] } },
        { parentOrderId: { $exists: true, $nin: [null, ''] } },
      ],
      status: { $in: PAYMENT_OK_STATUS },
    },
    { sort: { paymentDate: -1 } },
  );
}

const COLLECTIONS = [
  { name: 'subscriptions', userField: 'userId', label: 'Subscription' },
  { name: 'dismantlers', userField: 'ownerId', label: 'Dismantler' },
  { name: 'services', userField: 'ownerId', label: 'Service' },
  { name: 'stores', userField: 'ownerId', label: 'Store' },
  { name: 'mechanics', userField: 'ownerId', label: 'Mechanic' },
  {
    name: 'parts',
    userField: 'seller',
    label: 'Part',
    userIdOnlyIf: (uid) => typeof uid === 'string' && /^usr_/i.test(uid.trim()),
  },
  {
    name: 'carfinesubscriptions',
    userField: 'userId',
    label: 'CarFinesSubscription',
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('დააყენე MONGODB_URI (ან .env-იდან ჩატვირთე ხელით).');
    process.exit(1);
  }

  const { apply, only } = parseArgs();
  const dbName = getDbName(uri);

  console.log(`DB: ${dbName}`);
  console.log(apply ? 'რეჟიმი: APPLY (ჩანაწერები განახლდება)' : 'რეჟიმი: DRY-RUN');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const payments = db.collection('payments');

  let totalWouldFix = 0;
  let totalApplied = 0;
  let totalSkip = 0;

  for (const cfg of COLLECTIONS) {
    if (only && cfg.name !== only) continue;

    const coll = db.collection(cfg.name);
    const label = cfg.label;

    const cursor = coll.find({
      bogCardToken: { $exists: true, $nin: [null, ''] },
    });

    const docs = await cursor.toArray();

    for (const doc of docs) {
      const token = doc.bogCardToken;
      if (isValidBogOrderId(token)) {
        continue;
      }

      let userId = doc[cfg.userField];
      if (cfg.userIdOnlyIf && !cfg.userIdOnlyIf(userId)) {
        userId = undefined;
      }

      let payment = await findPaymentForToken(payments, token, userId);
      let bogId = bogOrderIdFromPayment(payment, token);

      if (
        !bogId &&
        payment &&
        userId &&
        cfg.name === 'subscriptions'
      ) {
        const other = await tryAlternateUserPayment(
          payments,
          userId,
          payment._id,
        );
        if (other) {
          const alt = other.paymentToken || other.parentOrderId;
          if (alt && isValidBogOrderId(alt)) bogId = alt.trim();
        }
      }

      if (!bogId) {
        console.log(
          `[SKIP] ${label} ${doc._id} bogCardToken="${token}" — payment/BOG UUID ვერ მოიძებნა${userId ? ` (user: ${userId})` : ''}`,
        );
        totalSkip++;
        continue;
      }

      totalWouldFix++;
      console.log(
        `[FIX] ${label} ${doc._id}: "${token}" → "${bogId}" (payment ${payment?._id})`,
      );

      if (apply) {
        await coll.updateOne(
          { _id: doc._id },
          { $set: { bogCardToken: bogId, updatedAt: new Date() } },
        );
        totalApplied++;
      }
    }
  }

  console.log('---');
  console.log(
    `დასრულებული: გასასწორებელი ჩანაწერი ${totalWouldFix}, skip ${totalSkip}, apply-ში განახლებული ${apply ? totalApplied : 0}`,
  );

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
