import { useEffect, useMemo, useRef } from 'react';
import { useSegments } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/services/analytics';

function looksLikeId(seg: string) {
  if (!seg) return false;
  if (/^\d+$/.test(seg)) return true;
  if (/^[0-9a-fA-F]{24}$/.test(seg)) return true; // mongo ObjectId
  if (/^[0-9a-fA-F-]{32,}$/.test(seg)) return true; // uuid-ish / long ids
  return false;
}

function canonicalizeSegments(segments: string[]) {
  return segments
    .filter((s) => s && !s.startsWith('(')) // ignore route groups like (tabs)
    .map((s) => (looksLikeId(s) ? ':id' : s));
}

function routeKeyFromSegments(segments: string[]) {
  const s = canonicalizeSegments(segments);
  const key = `/${s.join('/')}`;
  return key === '/' ? '/index' : key;
}

function screenNameFromRouteKey(routeKey: string) {
  // Keep mapping small & stable; add more when needed.
  switch (routeKey) {
    case '/index':
      return 'მთავარი';
    case '/marketplace':
    case '/(tabs)/marketplace':
      return 'გაყიდვები';
    case '/parts-new':
      return 'ავტონაწილები';
    case '/parts-details-new':
      return 'დეტალები';
    case '/stores-new':
      return 'მაღაზიები';
    case '/services-new':
      return 'სერვისები';
    case '/mechanics-new':
      return 'ხელოსნები';
    case '/news-feed':
      return 'სიახლეები';
    case '/news-detail':
      return 'სიახლეები (დეტალები)';
    case '/towing':
      return 'ევაკუატორი';
    case '/detailing':
      return 'დითეილინგი';
    case '/personal-info':
      return 'პირადი ინფორმაცია';
    case '/details':
      return 'დეტალები';
    default:
      return routeKey;
  }
}

function screenClassFromRouteKey(routeKey: string) {
  return `Route${routeKey.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}

/**
 * Expo Router global screen tracker.
 * Logs clean screen_view events (Firebase + backend) on every route change.
 */
export default function RouterScreenTracker() {
  const { user } = useUser();
  const segments = useSegments();

  const routeKey = useMemo(() => {
    const segs = Array.isArray(segments) ? (segments as string[]) : [];
    return routeKeyFromSegments(segs);
  }, [segments]);

  const screenName = useMemo(() => screenNameFromRouteKey(routeKey), [routeKey]);
  const screenClass = useMemo(() => screenClassFromRouteKey(routeKey), [routeKey]);

  const lastRouteKeyRef = useRef<string | null>(null);
  const lastScreenNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastRouteKeyRef.current === routeKey) return;

    if (lastScreenNameRef.current) {
      analyticsService.logNavigationWithBackend(lastScreenNameRef.current, screenName, user?.id);
    }
    analyticsService.logScreenViewWithBackend(screenName, screenClass, user?.id);

    lastRouteKeyRef.current = routeKey;
    lastScreenNameRef.current = screenName;
  }, [routeKey, screenName, screenClass, user?.id]);

  return null;
}

