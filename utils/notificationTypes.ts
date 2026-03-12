/**
 * საერთო ტიპები და ჰელპერები შეტყობინებებისთვის (NotificationsModal + app/notifications).
 */

export type NotificationType =
  | 'subscription_activated'
  | 'subscription_updated'
  | 'carfax'
  | 'review'
  | 'review_us'
  | 'garage_reminder'
  | 'new_offer'
  | 'new_request'
  | 'offer'
  | 'request'
  | 'chat_message'
  | 'carwash_booking'
  | 'carwash_booking_confirmed'
  | 'carwash_booking_reminder'
  | 'ai_recommendation'
  | 'offer_status'
  | 'fines'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export type AnyObject = { [key: string]: any };

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: number;
  isRead: boolean;
  data?: AnyObject;
}

const KNOWN_TYPES: NotificationType[] = [
  'subscription_activated', 'subscription_updated', 'carfax', 'review', 'review_us',
  'garage_reminder', 'new_offer', 'new_request', 'offer', 'request', 'chat_message',
  'carwash_booking', 'carwash_booking_confirmed', 'carwash_booking_reminder',
  'ai_recommendation', 'offer_status', 'fines', 'success', 'warning', 'error', 'info',
];

export function normalizeNotificationType(raw: AnyObject): NotificationType {
  const from = [
    raw.payload?.data?.type,
    raw.data?.type,
    raw.type,
    raw.category,
  ].find((t): t is string => typeof t === 'string' && t.length > 0);
  if (!from) return 'info';
  const lower = String(from).toLowerCase().trim();
  return (KNOWN_TYPES.includes(lower as NotificationType) ? lower : 'info') as NotificationType;
}

export function refineTypeFromInfo(
  resolvedType: NotificationType,
  title: string,
  screen: string | undefined,
): NotificationType {
  if (resolvedType !== 'info') return resolvedType;
  const t = (title || '').toLowerCase();
  const s = (screen || '').toLowerCase();
  if (s === 'fines' || t.includes('ლიმიტი') || t.includes('ჯარიმ')) return 'fines';
  if (t.includes('carfax')) return 'carfax';
  if (t.includes('შეფასება') || t.includes('review')) return 'review';
  return 'info';
}

export function mapNotificationFromApi(n: AnyObject): NotificationItem {
  const rawTs = n.createdAt || n.timestamp;
  const ts = typeof rawTs === 'number' ? rawTs : rawTs ? new Date(rawTs).getTime() : Date.now();
  const status = typeof n.status === 'string' ? n.status.toLowerCase() : (n.read ? 'read' : '');
  const payload = n.payload || {};
  const target = n.target || {};
  const payloadData = payload.data || n.data || {};
  const resolvedType = normalizeNotificationType({
    ...n,
    payload: { data: payloadData },
    data: payloadData,
  });
  const title = String(payload.title || n.title || 'შეტყობინება');
  const screen = payloadData.screen as string | undefined;
  const finalType = refineTypeFromInfo(resolvedType, title, screen);
  return {
    id: String(n._id || n.id),
    title,
    message: String(payload.body || n.body || n.message || ''),
    type: finalType,
    createdAt: ts,
    isRead: status === 'read',
    data: {
      ...payloadData,
      type: finalType,
      screen: payloadData.screen ?? screen,
      target,
      requestId: payloadData.requestId ?? payloadData.reqId ?? payloadData.request_id,
      offerId: payloadData.offerId ?? payloadData.offer_id,
      chatId: payloadData.chatId ?? payloadData.chat_id,
      carwashId: payloadData.carwashId ?? payloadData.carwash_id,
    },
  };
}

export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'chat_message': return 'chatbubble-ellipses';
    case 'offer_status':
    case 'new_offer':
    case 'offer': return 'pricetag';
    case 'new_request':
    case 'request': return 'document-text';
    case 'carwash_booking': return 'water';
    case 'carwash_booking_confirmed': return 'checkmark-circle';
    case 'carwash_booking_reminder': return 'alarm';
    case 'garage_reminder': return 'car';
    case 'subscription_activated':
    case 'subscription_updated': return 'star';
    case 'carfax': return 'document';
    case 'review':
    case 'review_us': return 'star';
    case 'ai_recommendation': return 'sparkles';
    case 'fines': return 'card';
    case 'success': return 'checkmark-circle';
    case 'warning': return 'warning';
    case 'error': return 'alert-circle';
    default: return 'notifications';
  }
}

export function getIconPalette(type: NotificationType): { bg: string; border: string; color: string } {
  switch (type) {
    case 'chat_message':
      return { bg: '#DBEAFE', border: '#93C5FD', color: '#1D4ED8' };
    case 'offer_status':
    case 'new_offer':
    case 'offer':
      return { bg: '#EDE9FE', border: '#C4B5FD', color: '#6D28D9' };
    case 'new_request':
    case 'request':
      return { bg: '#E0E7FF', border: '#A5B4FC', color: '#4F46E5' };
    case 'carwash_booking':
    case 'carwash_booking_confirmed':
      return { bg: '#DCFCE7', border: '#86EFAC', color: '#16A34A' };
    case 'carwash_booking_reminder':
      return { bg: '#FEF3C7', border: '#FCD34D', color: '#D97706' };
    case 'garage_reminder':
      return { bg: '#E0F2FE', border: '#7DD3FC', color: '#0284C7' };
    case 'subscription_activated':
    case 'subscription_updated':
      return { bg: '#FEF3C7', border: '#FCD34D', color: '#D97706' };
    case 'carfax':
      return { bg: '#F3E8FF', border: '#E9D5FF', color: '#7C3AED' };
    case 'review':
    case 'review_us':
      return { bg: '#FEF3C7', border: '#FCD34D', color: '#D97706' };
    case 'ai_recommendation':
      return { bg: '#ECFDF5', border: '#A7F3D0', color: '#059669' };
    case 'fines':
      return { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C' };
    case 'success':
      return { bg: '#DCFCE7', border: '#86EFAC', color: '#16A34A' };
    case 'warning':
      return { bg: '#FEF3C7', border: '#FCD34D', color: '#D97706' };
    case 'error':
      return { bg: '#FEE2E2', border: '#FCA5A5', color: '#DC2626' };
    default:
      return { bg: '#E5E7EB', border: '#D1D5DB', color: '#374151' };
  }
}
