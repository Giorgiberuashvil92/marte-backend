import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import { BackHandler, Keyboard, Platform, AppState, AppStateStatus, Text as RNText, TextInput as RNTextInput } from 'react-native';
import {
  useFonts as useOutfitFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { CarProvider } from '../contexts/CarContext';
import { MarketplaceProvider } from '../contexts/MarketplaceContext';
import { UserProvider } from '../contexts/UserContext';

if (__DEV__) {
  import('../utils/reactotron');
}
import { ToastProvider } from '../contexts/ToastContext';
import { ModalProvider } from '../contexts/ModalContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { FinesProvider } from '../contexts/FinesContext';
import API_BASE_URL from '../config/api';
import  {requestPermission, getToken, AuthorizationStatus } from '@react-native-firebase/messaging';
import messaging from '@react-native-firebase/messaging';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { analyticsService } from '../services/analytics';
import ForceUpdateModal from '../components/ui/ForceUpdateModal';
import { getCurrentAppVersion, checkVersionUpdate, compareVersions } from '../services/versionCheck';
import SessionTracker from '../components/SessionTracker';
import CookiePolicyModal, { hasCookieConsent } from '../components/ui/CookiePolicyModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RouterScreenTracker from '../components/RouterScreenTracker';


export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...FontAwesome.font,

    'HelveticaMedium': require('../assets/fonts/helveticamediumrusbyme.otf'),
    'NotoSansGeorgian-Bold': require('../assets/fonts/firago-latin-700-normal.ttf'),
    'NotoSansGeorgian-SemiBold': require('../assets/fonts/firago-latin-600-normal.ttf'),
    'NotoSansGeorgian-Regular': require('../assets/fonts/firago-latin-400-normal.ttf'),
    'NotoSansGeorgian-Medium': require('../assets/fonts/firago-latin-500-normal.ttf'),
  });
  const [outfitLoaded] = useOutfitFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded && outfitLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, outfitLoaded]);


  if (!fontsLoaded || !outfitLoaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const [minVersion, setMinVersion] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');
  const [showCookieModal, setShowCookieModal] = useState(false);

  // Debug: log when showForceUpdate changes
  useEffect(() => {
    console.log('🔍 [VERSION CHECK] showForceUpdate state:', showForceUpdate);
    console.log('🔍 [VERSION CHECK] minVersion:', minVersion);
    console.log('🔍 [VERSION CHECK] currentVersion:', currentVersion);
  }, [showForceUpdate, minVersion, currentVersion]);


  const customTheme = {
    ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    const requestUserPermission = async () => {
      const authStatus = await messaging().requestPermission();
      const enabled = authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;
      if (enabled) {
        const token = await messaging().getToken();
      }
    };

    // Request App Tracking Transparency permission (iOS only)
    const requestTrackingPermission = async () => {
      if (Platform.OS === 'ios') {
        try {
          // Small delay to ensure app is fully initialized
          setTimeout(async () => {
            const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
            if (status === 'granted') {
              console.log('✅ User granted tracking permission');
            } else {
              console.log('❌ User denied or restricted tracking permission');
            }
          }, 500);
        } catch (error) {
          console.log('Error requesting tracking permission:', error);
        }
      }
    };

    requestUserPermission();
    requestTrackingPermission();
    
    // Initialize Firebase Analytics (fire-and-forget)
    analyticsService.initialize().catch(() => {
      // Silently fail - analytics should never block app startup
    });
    const onMessageReceived = (message: any) => {
      console.log('Message:', message);
    };
    messaging().onMessage(onMessageReceived);

    // Check for force update
    const checkForUpdate = async () => {
      try {
        console.log('🔍 [VERSION CHECK] Starting version check...');
        const currentAppVersion = getCurrentAppVersion();
        console.log('📱 [VERSION CHECK] Current app version:', currentAppVersion);
        
        const versionInfo = await checkVersionUpdate();
        console.log('🌐 [VERSION CHECK] Version info from backend:', versionInfo);
        
        if (!versionInfo) {
          console.warn('⚠️ [VERSION CHECK] No version info received from backend');
          return;
        }

        // შევამოწმოთ ვერსია - თუ მომხმარებელს აქვს დაბალი ვერსია, გამოვაჩინოთ modal
        const needsUpdate = compareVersions(currentAppVersion, versionInfo.minVersion);
        
        // თუ ვერსია დაბალია, გამოვაჩინოთ modal
        // forceUpdate flag-ი backend-ში აკონტროლებს force update-ს, მაგრამ თუ ვერსია დაბალია, მაინც გამოვაჩინოთ
        // ეს უზრუნველყოფს რომ ძველი build-ებიც იმუშაოს
        if (needsUpdate) {
          // თუ forceUpdate არის true, მაშინ force update-ია (modal არ იხურება)
          // თუ forceUpdate არის false ან undefined, მაინც გამოვაჩინოთ modal (თუმცა შეიძლება დახურულ იქნას)
          
          setMinVersion(versionInfo.minVersion);
          setCurrentVersion(currentAppVersion);
          setShowForceUpdate(true);
        } else {
          console.log('✅ [VERSION CHECK] App version is up to date');
        }
      } catch (error) {
        console.error('❌ [VERSION CHECK] Error checking for update:', error);
        // თუ შეცდომა მოხდა, არ ვაბლოკებთ აპლიკაციას
      }
    };

    // შევამოწმოთ ვერსია app-ის დაწყებისას
    checkForUpdate();

    // Check cookie consent
    const checkCookieConsent = async () => {
      try {
        const hasConsent = await hasCookieConsent();
        if (!hasConsent) {
          // Small delay to ensure app is fully loaded
          setTimeout(() => {
            setShowCookieModal(true);
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking cookie consent:', error);
      }
    };
    checkCookieConsent();


    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        Keyboard.dismiss();
      }
      appState.current = nextAppState;
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    const onBackPress = () => {
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      return false;
    };

    const backSub = Platform.OS === 'android' 
      ? BackHandler.addEventListener('hardwareBackPress', onBackPress)
      : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      appStateSub?.remove();
      backSub?.remove();
    };
  }, [keyboardVisible]);

  return (
    <UserProvider>
      <SubscriptionProvider>
        <CarProvider>
          <FinesProvider>
          <MarketplaceProvider>
            <ToastProvider>
              <ModalProvider>
            <SessionTracker />
            <RouterScreenTracker />
            <ThemeProvider value={customTheme}>
              {(() => {
                
                (RNText as any).defaultProps = (RNText as any).defaultProps || {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (RNText as any).defaultProps.style = [
                  (RNText as any).defaultProps.style,
                  { 
                    fontFamily: 'HelveticaMedium',
                    fontWeight: '500',
                    fontSize: 12,
                    lineHeight: 12,
                    letterSpacing: 0,
                  },
                ];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (RNTextInput as any).defaultProps = (RNTextInput as any).defaultProps || {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (RNTextInput as any).defaultProps.style = [
                  (RNTextInput as any).defaultProps.style,
                  { 
                    fontFamily: 'HelveticaMedium',
                    fontWeight: '500',
                    fontSize: 12,
                    lineHeight: 12,
                    letterSpacing: 0,
                  },
                ];
                return null;
              })()}
              {showForceUpdate && (
                <ForceUpdateModal
                  visible={showForceUpdate}
                  minVersion={minVersion}
                  currentVersion={currentVersion}
                  onClose={() => setShowForceUpdate(false)}
                />
              )}
              <CookiePolicyModal
                visible={showCookieModal}
                onAccept={(preferences) => {
                  setShowCookieModal(false);
                }}
                onReject={() => {
                  setShowCookieModal(false);
                }}
                
              />
              <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="signup" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="booking" options={{ headerShown: false }} />
              <Stack.Screen name="map" options={{ headerShown: false }} />
              <Stack.Screen name="bookings" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ headerShown: false }} />
              <Stack.Screen name="details" options={{ headerShown: false }} />
              <Stack.Screen name="ai-chat" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[offerId]" options={{ headerShown: false }} />
              <Stack.Screen name="offers" options={{ headerShown: false }} />
              <Stack.Screen name="all-requests" options={{ headerShown: false }} />
              <Stack.Screen name="partner-dashboard" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="partner-dashboard-store" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="special-offers-manage" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="special-offer-form" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="partner" options={{ headerShown: false }} />
              <Stack.Screen name="parts-order" options={{ headerShown: false }} />
              <Stack.Screen name="parts" options={{ headerShown: false }} />
              <Stack.Screen name="parts-new" options={{ headerShown: false }} />
              <Stack.Screen name="parts-details-new" options={{ headerShown: false }} />
              <Stack.Screen name="stores" options={{ headerShown: false }} />
              <Stack.Screen name="stores-new" options={{ headerShown: false }} />
              <Stack.Screen name="oils-new" options={{ headerShown: false }} />
              <Stack.Screen name="mechanics-new" options={{ headerShown: false }} />
              <Stack.Screen name="services-new" options={{ headerShown: false }} />
              <Stack.Screen name="detailing" options={{ headerShown: false }} />
              <Stack.Screen name="add-car" options={{ headerShown: false }} />
              <Stack.Screen name="garage" options={{ headerShown: false }} />
              <Stack.Screen name="garage/service" options={{ headerShown: false }} />
              <Stack.Screen name="garage/reminders" options={{ headerShown: false }} />
              <Stack.Screen name="garage/reminders/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="garage/add-reminder" options={{ headerShown: false }} />
              <Stack.Screen name="garage/add-service" options={{ headerShown: false }} />
              <Stack.Screen name="garage/service/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="garage/documents" options={{ headerShown: false }} />
              <Stack.Screen name="garage/fuel" options={{ headerShown: false }} />
              <Stack.Screen name="garage/statistics" options={{ headerShown: false }} />
              <Stack.Screen name="service-form" options={{ headerShown: false }} />
              <Stack.Screen name="fuel-stations" options={{ headerShown: false }} />
              <Stack.Screen name="fuel-price-details" options={{ headerShown: false }} />
              <Stack.Screen name="mechanics" options={{ headerShown: false }} />
              <Stack.Screen name="towing" options={{ headerShown: false }} />
              <Stack.Screen name="comments" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
              <Stack.Screen name="notifications/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="financing-request" options={{ headerShown: false }} />
              <Stack.Screen name="financing-info" options={{ headerShown: false }} />
              <Stack.Screen name="caru-service" options={{ headerShown: false }} />
              <Stack.Screen name="caru-orders" options={{ headerShown: false }} />
              <Stack.Screen name="caru-order" options={{ headerShown: false }} />
              <Stack.Screen name="carfax" options={{headerShown: false}} />
              <Stack.Screen name="payment-card" options={{headerShown: false}} />
              <Stack.Screen name="payment-success" options={{headerShown: false}} />
              <Stack.Screen name="carfax-simulation" options={{headerShown: false}} />
              <Stack.Screen name="carfax-view" options={{headerShown: false}} />
              <Stack.Screen name="all-services" options={{headerShown: false}} />
              <Stack.Screen name="all-community" options={{headerShown: false}} />
              <Stack.Screen name="category" options={{headerShown: false}} />
              <Stack.Screen name="register" options={{headerShown: false}} />
              <Stack.Screen name="chats" options={{headerShown: false}} />
              <Stack.Screen name="chat/[chatId]" options={{headerShown: false}} />
              <Stack.Screen name="partner-chats" options={{headerShown: false}} />
              <Stack.Screen name="partner-chat/[requestId]" options={{headerShown: false}} />
              <Stack.Screen name="news-feed" options={{headerShown: false}} />
              <Stack.Screen name="news-detail" options={{headerShown: false}} />
              <Stack.Screen name="offers/[requestId]" options={{headerShown: false}} />
              <Stack.Screen name="mechanic/[id]" options={{headerShown: false}} />
              <Stack.Screen name="mechanic-detail" options={{headerShown: false}} />
              <Stack.Screen name="booking-details" options={{headerShown: false}} />
              <Stack.Screen name="bookings/[carwashId]" options={{headerShown: false}} />
              <Stack.Screen name="settings/[carwashId]" options={{headerShown: false}} />
              <Stack.Screen name="analytics/[carwashId]" options={{headerShown: false}} />
              <Stack.Screen name="analytics-dashboard" options={{headerShown: false}} />
              <Stack.Screen name="partner-dashboard-old" options={{headerShown: false}} />
              <Stack.Screen name="partner-dashboard-simple" options={{headerShown: false}} />
              <Stack.Screen name="partner-stack" options={{headerShown: false}} />
              <Stack.Screen name="personal-info" options={{headerShown: false}} />
              <Stack.Screen name="payment" options={{headerShown: false}} />
              <Stack.Screen name="fuel" options={{headerShown: false}} />
              <Stack.Screen name="racing" options={{headerShown: false}} />
              <Stack.Screen name="stories" options={{headerShown: false}} />
              <Stack.Screen name="bog-test" options={{headerShown: false}} />
              <Stack.Screen name="car-rental/[id]" options={{headerShown: false}} />
              <Stack.Screen name="car-rental-list" options={{headerShown: false}} />
              <Stack.Screen name="car-rental-add" options={{headerShown: false}} />
              <Stack.Screen name="radars" options={{headerShown: false}} />
              <Stack.Screen name="review" options={{headerShown: false}} />
              <Stack.Screen name="help-assistant" options={{headerShown: false}} />
              <Stack.Screen name="edit-car" options={{headerShown: false}} />
              </Stack>
            </ThemeProvider>
              </ModalProvider>
            </ToastProvider>
          </MarketplaceProvider>
          </FinesProvider>
        </CarProvider>
      </SubscriptionProvider>
    </UserProvider>
  );
}


