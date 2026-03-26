/**
 * FCM / Notifee payload-ის ნორმალიზაცა და ნაწილის მოთხოვნის ეკრანზე გადასვლის ამოცნობა.
 * ყველა data value ხშირად string-ია; ზოგჯერ ობიექტი იძუნძულება `data` JSON სტრიქონად.
 */

export type PushNavData = Record<string, any>;

function tryParseJsonObject(s: string): Record<string, any> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** აერთიანებს root + ჩაბმულ JSON-ს (მაგ. data: '{"type":"parts_request"}') */
export function normalizePushNavData(raw: PushNavData | undefined | null): PushNavData {
  if (!raw || typeof raw !== 'object') return {};
  let out: PushNavData = { ...raw };

  const inner = out.data;
  if (typeof inner === 'string') {
    const parsed = tryParseJsonObject(inner);
    if (parsed) {
      out = { ...out, ...parsed };
    }
  } else if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    out = { ...out, ...inner };
  }

  return out;
}

function normType(t: unknown): string {
  return String(t ?? '')
    .toLowerCase()
    .trim();
}

/** ეკრანის სახელი: სივრცეების გარეშე, lower — PartsRequests → partsrequests */
function normScreen(s: unknown): string {
  return String(s ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

/** უნდა გაიხსნას /parts-requests (ნაწილის მოთხოვნა) */
export function shouldNavigateToPartsRequests(type: unknown, screen: unknown): boolean {
  const tk = normType(type);
  const sk = normScreen(screen);
  return (
    tk === 'parts_search' ||
    tk === 'parts_request' ||
    sk === 'partsrequests' ||
    sk === 'partssearch' ||
    sk === 'partsrequest' // typo-tolerant
  );
}

/** საწვავის ფასდაკლება / Marte exclusive offer → /exclusive-fuel-offer */
export function shouldNavigateToExclusiveFuelOffer(type: unknown, screen: unknown): boolean {
  const tk = normType(type);
  const sk = normScreen(screen).replace(/-/g, '');
  return (
    tk === 'fuel_discount' ||
    tk === 'fuel_discount_17t' ||
    tk === 'exclusive_fuel_offer' ||
    tk === 'fuel_promo' ||
    sk === 'exclusivefueloffer'
  );
}
