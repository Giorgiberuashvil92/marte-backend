/**
 * MyParts.ge products importer.
 *
 * Dry-run:
 *   node scripts/import-myparts-products.js --makeId 25 --limit 100
 *   node scripts/import-myparts-products.js --make bmw --limit 100
 *
 * Write to Mongo `parts` collection:
 *   node scripts/import-myparts-products.js --makeId 25 --limit 100 --apply
 *   node scripts/import-myparts-products.js --make bmw --limit 100 --apply
 */

const { MongoClient } = require('mongodb');
const { loadMarteEnv, resolveMongo } = require('./mongodb-uri');

const SOURCE = 'myparts.ge';
const API_URL = 'https://api.myparts.ge/api/ka/products/get';
const KNOWN_MAKES = {
  bmw: { makeId: 3, brand: 'BMW' },
  mercedes: { makeId: 25, brand: 'Mercedes' },
  'mercedes-benz': { makeId: 25, brand: 'Mercedes' },
};

function argValue(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

function numberArg(name, fallback, min, max) {
  const n = Number(argValue(name, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function makeConfigFromArgs() {
  const make = String(argValue('make', '') || '').trim().toLowerCase();
  const configured = make ? KNOWN_MAKES[make] : undefined;
  const makeId = numberArg('makeId', configured?.makeId || 25, 1, 100000);
  const brand =
    argValue('brand', configured?.brand || '') ||
    Object.values(KNOWN_MAKES).find((item) => item.makeId === makeId)?.brand ||
    `Make ${makeId}`;

  return { makeId, brand };
}

function normalizePhone(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 9 && /^[235]\d{8}$/.test(digits)) {
    return digits.startsWith('5') ? `+995${digits}` : digits;
  }
  if (digits.length === 12 && digits.startsWith('995')) {
    return `+${digits}`;
  }
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return '';
}

function extractPublicPhone(product) {
  const candidates = [
    product.phone,
    product.mobile,
    product.tel,
    product.phone_number,
    product.shop?.phone,
    product.shop?.mobile,
    product.details?.phone,
  ];

  for (const candidate of candidates) {
    const phone = normalizePhone(candidate);
    if (phone) return phone;
  }
  return '';
}

function normalizeProduct(product, { brand }) {
  const photos = (product.photos || [])
    .filter((photo) => photo.large || photo.thumbs)
    .map((photo) => ({
      large: photo.large || photo.thumbs || '',
      thumbnail: photo.thumbs || photo.large || '',
    }));
  const compatibility = (product.product_models || []).map((model) => ({
    makeId: Number(model.man_id || 0),
    modelId: Number(model.model_id || 0),
    yearFrom: model.year_from || undefined,
    yearTo: model.year_to || undefined,
  }));
  const firstPhoto = photos[0];

  const yearFrom = compatibility[0]?.yearFrom;
  const yearTo = compatibility[0]?.yearTo;
  const modelLabel = [yearFrom, yearTo].filter(Boolean).join('-');
  const phone = extractPublicPhone(product);

  return {
    title: product.title || 'უსახელო ნაწილი',
    description: product.descr || '',
    category: 'ავტონაწილები',
    condition: Number(product.cond_type_id || 0) === 1 ? 'ახალი' : 'კარგი',
    price: product.price || '0.00',
    images: photos.map((photo) => photo.large || photo.thumbnail).filter(Boolean),
    seller: product.product_user || product.shop?.title || SOURCE,
    location: product.shop?.title || product.product_user || SOURCE,
    phone: phone || 'N/A',
    name: product.product_user || product.shop?.title || SOURCE,
    brand,
    model: modelLabel || brand,
    year: Number(yearFrom || new Date().getFullYear()),
    isNegotiable: false,
    partNumber: `${SOURCE}:${product.product_id}`,
    warranty: '',
    status: 'active',
    source: SOURCE,
    sourceProductId: String(product.product_id),
    sourceUrl: `https://myparts.ge/ka/pr/${product.product_id}`,
    externalMeta: {
      currencyId: Number(product.currency_id || 3),
      categoryId: Number(product.cat_id || 0),
      conditionTypeId: Number(product.cond_type_id || 0),
      locationId: Number(product.loc_id || 0),
      makeId: Number(compatibility[0]?.makeId || 0),
      rawPhoneAvailable: Boolean(product.phone),
      publicPhoneFound: Boolean(phone),
      modelIds: [...new Set(compatibility.map((model) => model.modelId).filter(Boolean))],
      modelCompatibility: compatibility,
      thumbnail: firstPhoto?.thumbnail,
      photos,
      fetchedAt: new Date(),
    },
    updatedAt: new Date(),
  };
}

async function fetchProducts({ makeId, brand, partName, page, limit }) {
  const payload = {
    pr_type_id: 1,
    man_id: makeId,
    page,
    limit,
  };
  if (partName) payload.keyword = partName;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: 'https://myparts.ge',
      Referer: 'https://myparts.ge/ka/search/',
      'User-Agent': 'MartePartsCacheImporter/1.0',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`MyParts HTTP ${res.status}`);
  const json = await res.json();
  if (json.statusCode !== 1) {
    throw new Error(json.statusMessage || 'MyParts API failed');
  }
  return {
    request: payload,
    totalCount: json.data?.totalCount || 0,
    pagination: json.data?.pagination || {},
    products: (json.data?.products || []).map((product) =>
      normalizeProduct(product, { brand }),
    ),
  };
}

async function main() {
  loadMarteEnv();

  const apply = process.argv.includes('--apply');
  const { makeId, brand } = makeConfigFromArgs();
  const page = numberArg('page', 1, 1, 10000);
  const limit = numberArg('limit', 100, 1, 100);
  const partName = argValue('partName', '');

  const result = await fetchProducts({ makeId, brand, partName, page, limit });
  console.log(
    JSON.stringify(
      {
        apply,
        brand,
        request: result.request,
        fetched: result.products.length,
        totalCount: result.totalCount,
        pagination: result.pagination,
        sample: result.products.slice(0, 3).map((p) => ({
          partNumber: p.partNumber,
          title: p.title,
          price: p.price,
          phone: p.phone,
          photos: p.images.length,
          image: p.images[0],
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('\nჩასაწერად გაუშვი იგივე command --apply-ით.');
    return;
  }

  const { uri, dbName } = resolveMongo();
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const col = client.db(dbName).collection('parts');
    await col.createIndex({ partNumber: 1 }, { sparse: true });
    await col.createIndex({ brand: 1, status: 1 });

    let upserted = 0;
    let modified = 0;
    for (const product of result.products) {
      const write = await col.updateOne(
        { partNumber: product.partNumber },
        {
          $set: product,
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
      upserted += write.upsertedCount || 0;
      modified += write.modifiedCount || 0;
    }

    console.log(
      JSON.stringify(
        {
          dbName,
          collection: 'parts',
          matchedOrModified: modified,
          upserted,
          processed: result.products.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
