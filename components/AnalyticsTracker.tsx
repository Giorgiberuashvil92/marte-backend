import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useUser } from '../contexts/UserContext';
import { analyticsService } from '../services/analytics';
import { analyticsApi } from '../services/analyticsApi';

interface AnalyticsTrackerProps {
  screenName: string;
  trackAllInteractions?: boolean;
}

/**
 * კომპონენტი რომელიც ავტომატურად დააკვირდება ყველა ინტერაქციას ეკრანზე
 */
export default function AnalyticsTracker({ 
  screenName, 
  trackAllInteractions = true 
}: AnalyticsTrackerProps) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const screenEnterTime = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastInteractionTime = useRef<number>(Date.now());

  // Track screen entry
  useEffect(() => {
    screenEnterTime.current = Date.now();
    
    // Track screen view
    analyticsService.logScreenViewWithBackend(screenName, screenName, user?.id);
    
    // Track screen entry event
    analyticsApi.trackEvent(
      'screen_entry',
      `${screenName} - შესვლა`,
      user?.id,
      screenName,
      {
        timestamp: screenEnterTime.current,
        pathname: pathname,
      }
    ).catch(() => {});

    return () => {
      // Track screen exit when component unmounts
      if (screenEnterTime.current) {
        const timeSpent = Date.now() - screenEnterTime.current;
        analyticsApi.trackEvent(
          'screen_exit',
          `${screenName} - გასვლა`,
          user?.id,
          screenName,
          {
            time_spent_seconds: Math.round(timeSpent / 1000),
            time_spent_minutes: Math.round((timeSpent / 60000) * 10) / 10,
            timestamp: Date.now(),
          }
        ).catch(() => {});
      }
    };
  }, [screenName, user?.id, pathname]);

  // Track app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // When app goes to background
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (screenEnterTime.current) {
          const timeSpent = Date.now() - screenEnterTime.current;
          analyticsApi.trackEvent(
            'screen_background',
            `${screenName} - ფონზე გადასვლა`,
            user?.id,
            screenName,
            {
              time_spent_seconds: Math.round(timeSpent / 1000),
            }
          ).catch(() => {});
        }
      }
      
      // When app comes to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        screenEnterTime.current = Date.now();
        analyticsApi.trackEvent(
          'screen_foreground',
          `${screenName} - ფონიდან დაბრუნება`,
          user?.id,
          screenName,
          {
            timestamp: screenEnterTime.current,
          }
        ).catch(() => {});
      }
      
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [screenName, user?.id]);

  // Track user activity (every 30 seconds if user is active)
  useEffect(() => {
    if (!trackAllInteractions) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastInteraction = now - lastInteractionTime.current;
      
      // If user was active in last 2 minutes, track activity
      if (timeSinceLastInteraction < 120000) {
        analyticsApi.trackEvent(
          'user_activity',
          `${screenName} - აქტივობა`,
          user?.id,
          screenName,
          {
            time_on_screen: screenEnterTime.current 
              ? Math.round((now - screenEnterTime.current) / 1000)
              : 0,
          }
        ).catch(() => {});
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [screenName, user?.id, trackAllInteractions]);

  return null;
}

/**
 * Hook რომელიც ავტომატურად დააკვირდება ღილაკების დაჭერებს
 */
export function useButtonTracking(buttonName: string, screen?: string) {
  const { user } = useUser();
  const currentScreen = screen || 'უცნობი';

  return () => {
    analyticsService.logButtonClick(buttonName, currentScreen, undefined, user?.id);
    analyticsApi.trackEvent(
      'button_click',
      buttonName,
      user?.id,
      currentScreen,
      {
        button_name: buttonName,
        screen: currentScreen,
        timestamp: Date.now(),
      }
    ).catch(() => {});
  };
}

/**
 * Hook რომელიც დააკვირდება კატეგორიაზე დაჭერას
 */
export function useCategoryTracking() {
  const { user } = useUser();

  return (categoryId: string, categoryName: string, sourceScreen: string) => {
    analyticsService.logCategoryClick(categoryId, categoryName, sourceScreen, user?.id);
    analyticsApi.trackEvent(
      'category_click',
      categoryName,
      user?.id,
      sourceScreen,
      {
        category_id: categoryId,
        category_name: categoryName,
        source_screen: sourceScreen,
        timestamp: Date.now(),
      }
    ).catch(() => {});
  };
}

/**
 * Hook რომელიც დააკვირდება რუკაში შესვლას/გასვლას
 */
export function useMapTracking() {
  const { user } = useUser();
  const mapEnterTime = useRef<number | null>(null);

  const trackMapEntry = () => {
    mapEnterTime.current = Date.now();
    analyticsService.logMapView(user?.id);
    analyticsApi.trackEvent(
      'map_entry',
      'რუკაში შესვლა',
      user?.id,
      'რუკა',
      {
        timestamp: mapEnterTime.current,
      }
    ).catch(() => {});
  };

  const trackMapExit = () => {
    if (mapEnterTime.current) {
      const timeSpent = Date.now() - mapEnterTime.current;
      analyticsApi.trackEvent(
        'map_exit',
        'რუკიდან გასვლა',
        user?.id,
        'რუკა',
        {
          time_spent_seconds: Math.round(timeSpent / 1000),
          time_spent_minutes: Math.round((timeSpent / 60000) * 10) / 10,
          timestamp: Date.now(),
        }
      ).catch(() => {});
      mapEnterTime.current = null;
    }
  };

  return { trackMapEntry, trackMapExit };
}
