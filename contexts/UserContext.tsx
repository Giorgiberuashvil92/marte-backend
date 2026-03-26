import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import API_BASE_URL from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
// Notifee for foreground local notifications
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import notifee, { AndroidImportance, AndroidColor } from '@notifee/react-native';
import {
  normalizePushNavData,
  shouldNavigateToPartsRequests,
  shouldNavigateToExclusiveFuelOffer,
} from '@/utils/pushNavigation';
import { router } from 'expo-router';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { analyticsService } from '../services/analytics';
import { triggerSubscriptionRefresh } from '../services/subscriptionRefresh';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'customer' | 'owner' | 'manager' | 'employee' | 'user';
  ownedCarwashes: string[];
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  shouldOpenPremiumModal: boolean;
  clearPremiumModalFlag: () => void;
  setShouldOpenPremiumModal: (value: boolean) => void;
  login: (userData: any) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  clearStorage: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updateUserRole: (role: User['role']) => Promise<void>;
  addToOwnedCarwashes: (carwashId: string) => Promise<void>;
  removeFromOwnedCarwashes: (carwashId: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [shouldOpenPremiumModal, setShouldOpenPremiumModal] = useState(false);

  // Track login history
  const trackLoginHistory = async (user: User) => {
    try {
      const deviceInfo = {
        platform: Platform.OS,
        deviceName: Device.deviceName || null,
        modelName: Device.modelName || null,
        osVersion: Device.osVersion || null,
        appVersion: Constants.expoConfig?.version || null,
      };

      await fetch(`${API_BASE_URL}/login-history/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          firstName: user.name,
          deviceInfo,
        }),
      });
    } catch (error) {
      console.error('Error tracking login history:', error);
    }
  };

  // Device token registration function
  const registerDeviceToken = async (userId: string) => {
    try {
      
      const token = await messaging().getToken();
      
      if (token) {
       
        // Collect device information
        const deviceInfo = {
          deviceName: Device.deviceName || null,
          modelName: Device.modelName || null,
          brand: Device.brand || null,
          manufacturer: Device.manufacturer || null,
          osName: Device.osName || null,
          osVersion: Device.osVersion || null,
          deviceType: Device.deviceType || null,
          totalMemory: Device.totalMemory || null,
          appVersion: Constants.expoConfig?.version || null,
          appBuildNumber: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || null,
          platform: Platform.OS,
          platformVersion: Platform.Version?.toString() || null,
        };
        
        
        const requestBody = {
          userId,
          token,
          platform: Platform.OS,
          deviceInfo,
        };
       
        
        const response = await fetch(`${API_BASE_URL}/notifications/register-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        

        
        const result = await response.json();
        
        if (response.ok && result.success) {
         
        } else {
          console.warn('⚠️ [USERCONTEXT] Device token registration returned:', result);
          console.warn('⚠️ [USERCONTEXT] Request was not successful');
        }
      } else {
        console.warn('⚠️ [USERCONTEXT] No Firebase token available to register');
      }
    } catch (error) {
      console.error('❌ [USERCONTEXT] Failed to register device token:', error);
      console.error('❌ [USERCONTEXT] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        userId: userId,
      });
      if (error instanceof Error) {
        console.error('❌ [USERCONTEXT] Error message:', error.message);
        console.error('❌ [USERCONTEXT] Error stack:', error.stack);
      }
    }
  };

  // მონაცემების ჩატვირთვა AsyncStorage-დან
  useEffect(() => {
    loadUserFromStorage();
  }, []);

  useEffect(() => {
    let unsubscribeOnMessage: (() => void) | undefined;
    let unsubscribeOnNotificationOpened: (() => void) | undefined;
    const processedMessageIds = new Set<string>();
    const handleNavigateFromData = (raw?: Record<string, any>) => {
      console.log('📱 [PUSH NOTIFICATION] ============================================');
      console.log('📱 [PUSH NOTIFICATION] Received notification data:', JSON.stringify(raw, null, 2));
      console.log('📱 [PUSH NOTIFICATION] Data keys:', raw ? Object.keys(raw) : 'no data');
      
      if (!raw) {
        console.log('📱 [PUSH NOTIFICATION] ❌ No data provided, returning');
        return;
      }

      const data = normalizePushNavData(raw);
      
      // Prefer explicit screen param
      const screen = data.screen as string | undefined;
      const type = data.type as string | undefined;
      // Title შეიძლება იყოს data-ში სხვადასხვა key-ებით
      const title = data.title || data.notificationTitle || data.payload?.title || (data as any).notification?.title;
      
      console.log('📱 [PUSH NOTIFICATION] Screen:', screen);
      console.log('📱 [PUSH NOTIFICATION] Type:', type);
      console.log('📱 [PUSH NOTIFICATION] Title:', title);
      console.log('📱 [PUSH NOTIFICATION] RequestId:', data.requestId);
      console.log('📱 [PUSH NOTIFICATION] OfferId:', data.offerId);
      console.log('📱 [PUSH NOTIFICATION] ChatId:', data.chatId);
      console.log('📱 [PUSH NOTIFICATION] CarwashId:', data.carwashId);
      
      // Type-based navigation (პირველ რიგში type-ის მიხედვით)
      console.log('📱 [PUSH NOTIFICATION] 🔍 Checking type-based navigation...');
      
      // 0. Carfax notifications (title-ის ან type-ის მიხედვით)
      if (type === 'carfax' || type === 'Carfax' || title?.toLowerCase().includes('carfax') || screen === 'Carfax') {
        console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /carfax (carfax notification)');
        router.push('/carfax' as any);
        return;
      }
      
      // 1. Subscription/Premium notifications
      if (type === 'subscription_activated' || type === 'subscription' || screen === 'Premium' || screen === 'Subscription') {
        console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to / (subscription_activated)');
        router.push('/');
        setShouldOpenPremiumModal(true);
        return;
      }

      // 1.1 საბსქრიფშენი განახლებულია – მხოლოდ რეფრეში, ნავიგაცია არა
      if (type === 'subscription_updated') {
        console.log('📱 [PUSH NOTIFICATION] ✅ subscription_updated – refreshing subscription');
        triggerSubscriptionRefresh();
        return;
      }
      
      // 1.5. Review notifications
      if (type === 'review' || type === 'review_us' || screen === 'Review' || screen === 'ReviewUs' || title?.toLowerCase().includes('review') || title?.toLowerCase().includes('შეფასება')) {
        console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /review (review notification)');
        router.push('/review' as any);
        return;
      }
      
      // 2. Garage — ჯარიმების შეხსენება
      if (
        type === 'garage_fines_reminder' ||
        data.type === 'garage_fines_reminder' ||
        screen === 'GarageFines'
      ) {
        console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /garage/fines (garage_fines_reminder)');
        router.push('/garage/fines' as any);
        return;
      }

      // 2.1 Garage reminders
      if (type === 'garage_reminder' || screen === 'Garage' || data.type === 'garage_reminder') {
        console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /(tabs)/garage (garage_reminder)');
        router.push('/(tabs)/garage' as any);
        return;
      }
      
      // 3. Chat messages — ჩატი ცალცალკეა requestId+partnerId-ზე; პუშში partnerId არ გვაქვს, therefore ჩატების სიაზე
      if (type === 'chat_message' || type === 'message') {
        const reqId = data.requestId;
        const partId = data.partnerId;
        if (reqId && partId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /chat/${reqId}/${partId} (chat_message)`);
          router.push(`/chat/${reqId}/${partId}` as any);
        } else {
          console.log('📱 [PUSH NOTIFICATION] Navigating to /chats (chat_message, no requestId+partnerId)');
          router.push('/chats' as any);
        }
        return;
      }
      
      // 4. Carwash bookings
      if (type === 'carwash_booking' || type === 'carwash_booking_confirmed' || type === 'carwash_booking_reminder') {
        const cwId = data.carwashId;
        if (cwId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /bookings/${cwId} (carwash_booking)`);
          router.push(`/bookings/${cwId}` as any);
        } else {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /bookings (carwash_booking, no ID)');
          router.push('/bookings' as any);
        }
        return;
      }

      // 4.4. საწვავის ფასდაკლება / exclusive-fuel-offer
      if (shouldNavigateToExclusiveFuelOffer(type, screen)) {
        console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /exclusive-fuel-offer (fuel_discount)');
        router.push('/exclusive-fuel-offer' as any);
        return;
      }

      // 4.5. ნაწილის მოთხოვნა / parts-requests (ადრე new_request-ამდე — უსაფრთხო თანმიმდევრობა)
      if (shouldNavigateToPartsRequests(type, screen)) {
        console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /parts-requests (parts_request / PartsRequests)');
        router.push('/parts-requests' as any);
        return;
      }
      
      // 5. New requests
      if (type === 'new_request' || type === 'request') {
        if (data.requestId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /offers/${data.requestId} (new_request)`);
          router.push(`/offers/${data.requestId}` as any);
        } else {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /all-requests (new_request, no ID)');
          router.push('/all-requests' as any);
        }
        return;
      }
      
      // 6. New offers / Offer status
      if (type === 'new_offer' || type === 'offer' || type === 'offer_status') {
        if (data.requestId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /offers/${data.requestId} (new_offer)`);
          router.push(`/offers/${data.requestId}` as any);
        } else {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /all-requests (new_offer, no ID)');
          router.push('/all-requests' as any);
        }
        return;
      }
      
      // 7. AI recommendations
      if (type?.startsWith('ai_') || screen === 'AIRecommendations') {
        if (data.requestId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /offers/${data.requestId} (ai_recommendation)`);
          router.push(`/offers/${data.requestId}` as any);
        } else {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /all-requests (ai_*)');
          router.push('/all-requests' as any);
        }
        return;
      }

      // 8. Screen-based navigation (fallback)
      if (screen) {
        console.log('📱 [PUSH NOTIFICATION] 🔍 Checking screen-based navigation...');
        if (screen === 'RequestDetails' && data.requestId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /offers/${data.requestId} (RequestDetails)`);
          router.push(`/offers/${data.requestId}` as any);
          return;
        }
        if (screen === 'OfferDetails' && data.requestId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /offers/${data.requestId} (OfferDetails)`);
          router.push(`/offers/${data.requestId}` as any);
          return;
        }
        if (screen === 'PartDetails' || screen === 'AIRecommendations') {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /all-requests (PartDetails/AIRecommendations)');
          router.push('/all-requests' as any);
          return;
        }
        if (shouldNavigateToExclusiveFuelOffer(undefined, screen)) {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /exclusive-fuel-offer (screen fallback)');
          router.push('/exclusive-fuel-offer' as any);
          return;
        }
        if (shouldNavigateToPartsRequests(undefined, screen)) {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /parts-requests (screen fallback)');
          router.push('/parts-requests' as any);
          return;
        }
        if (screen === 'Bookings' && data.carwashId) {
          console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /bookings/${data.carwashId} (Bookings)`);
          router.push(`/bookings/${data.carwashId}` as any);
          return;
        }
        if (screen === 'Chat') {
          if (data.requestId && data.partnerId) {
            console.log(`📱 [PUSH NOTIFICATION] ✅ Navigating to /chat/${data.requestId}/${data.partnerId} (Chat)`);
            router.push(`/chat/${data.requestId}/${data.partnerId}` as any);
          } else {
            console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /chats (Chat, no requestId+partnerId)');
            router.push('/chats' as any);
          }
          return;
        }
      }
      
      // 9. System/General notifications - check title for specific types
      if (type === 'system' || type === 'general' || !type) {
        // Check if title contains specific keywords
        const titleLower = title?.toLowerCase() || '';
        if (titleLower.includes('carfax')) {
          console.log('📱 [PUSH NOTIFICATION] ✅ Navigating to /carfax (system notification with Carfax title)');
          router.push('/carfax' as any);
          return;
        }
        console.log('📱 [PUSH NOTIFICATION] ⚠️ System/General notification, navigating to /notifications');
        router.push('/notifications' as any);
        return;
      }
      
      // 10. Fallback - default to notifications page
      console.log('📱 [PUSH NOTIFICATION] ⚠️ No specific route matched, navigating to /notifications');
      router.push('/notifications' as any);
      console.log('📱 [PUSH NOTIFICATION] ============================================');
    };
    (async () => {
      try {
        // iOS permissions
        if (Platform.OS === 'ios') {
          await notifee.requestPermission();
        }

        // Android channel
        let channelId: string | undefined;
        if (Platform.OS === 'android') {
          channelId = await notifee.createChannel({
            id: 'default',
            name: 'Default',
            lights: true,
            vibration: true,
            importance: AndroidImportance.HIGH,
            badge: true,
            sound: 'default',
            lightColor: AndroidColor.RED,
          });
        }

        // Foreground messages → show local notification via Notifee
        unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
          try {
            console.log('📱 [PUSH NOTIFICATION] ============================================');
            console.log('📱 [PUSH NOTIFICATION] 🔔 FOREGROUND MESSAGE RECEIVED');
            console.log('📱 [PUSH NOTIFICATION] MessageId:', remoteMessage.messageId);
            console.log('📱 [PUSH NOTIFICATION] Title:', remoteMessage.notification?.title);
            console.log('📱 [PUSH NOTIFICATION] Body:', remoteMessage.notification?.body);
            console.log('📱 [PUSH NOTIFICATION] Data:', JSON.stringify(remoteMessage.data, null, 2));
            console.log('📱 [PUSH NOTIFICATION] Full message:', JSON.stringify(remoteMessage, null, 2));
            
            // Deduplication: შევამოწმოთ messageId
            const messageId = remoteMessage.messageId;
            if (messageId && processedMessageIds.has(messageId)) {
              console.log('📱 [PUSH NOTIFICATION] ⚠️ Duplicate message, skipping:', messageId);
              return;
            }
            
            if (messageId) {
              processedMessageIds.add(messageId);
              // Cleanup old messageIds (keep last 100)
              if (processedMessageIds.size > 100) {
                const firstId = processedMessageIds.values().next().value;
                if (firstId) {
                  processedMessageIds.delete(firstId);
                }
              }
            }
            
            const title = remoteMessage.notification?.title || 'შეტყობინება';
            const body = remoteMessage.notification?.body || '';
            console.log('📱 [PUSH NOTIFICATION] 📲 Displaying notification:', { title, body });
            const notificationData = {
              ...(remoteMessage.data || {}),
              title: title,
            };
            await notifee.displayNotification({
              title,
              body,
              data: notificationData,
              android: {
                channelId: channelId || 'default',
                smallIcon: 'ic_notification',
                pressAction: { id: 'default' },
              },
              ios: {
                sound: 'default',
                foregroundPresentationOptions: {
                  banner: true,
                  sound: true,
                  badge: true,
                },
              },
            });
            console.log('📱 [PUSH NOTIFICATION] ✅ Notification displayed');
            console.log('📱 [PUSH NOTIFICATION] ============================================');
          } catch (e) {
            console.error('📱 [PUSH NOTIFICATION] ❌ Error handling foreground message:', e);
          }
        });

        // Handle tap when app is in background (system notification)
        unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp(
          remoteMessage => {
            try {
              console.log('📱 [PUSH NOTIFICATION] ============================================');
              console.log('📱 [PUSH NOTIFICATION] 🔔 BACKGROUND NOTIFICATION TAPPED');
              console.log('📱 [PUSH NOTIFICATION] MessageId:', remoteMessage?.messageId);
              console.log('📱 [PUSH NOTIFICATION] Title:', remoteMessage?.notification?.title);
              console.log('📱 [PUSH NOTIFICATION] Body:', remoteMessage?.notification?.body);
              console.log('📱 [PUSH NOTIFICATION] Data:', JSON.stringify(remoteMessage?.data, null, 2));
              // Pass title along with data
              const notificationData = {
                ...(remoteMessage?.data || {}),
                title: remoteMessage?.notification?.title || remoteMessage?.data?.title,
              };
              handleNavigateFromData(notificationData as any);
            } catch (e) {
              console.error('📱 [PUSH NOTIFICATION] ❌ Error handling background notification:', e);
            }
          },
        );

        // Handle cold start (user tapped notification to open the app)
        const initial = await messaging().getInitialNotification();
        if (initial?.data && Object.keys(initial.data).length > 0) {
          console.log('📱 [PUSH NOTIFICATION] ============================================');
          console.log('📱 [PUSH NOTIFICATION] 🔔 COLD START - FCM notification opened app');
          console.log('📱 [PUSH NOTIFICATION] MessageId:', initial?.messageId);
          console.log('📱 [PUSH NOTIFICATION] Title:', initial?.notification?.title);
          console.log('📱 [PUSH NOTIFICATION] Body:', initial?.notification?.body);
          console.log('📱 [PUSH NOTIFICATION] Data:', JSON.stringify(initial?.data, null, 2));
          const notificationData = {
            ...(initial.data || {}),
            title: initial?.notification?.title || initial?.data?.title,
          };
          handleNavigateFromData(notificationData as any);
        } else {
          // Notifee-ით ნაჩვენები ლოკალური შეტყობინება (cold start)
          const notifeeInitial = await notifee.getInitialNotification();
          if (notifeeInitial?.notification?.data) {
            console.log('📱 [PUSH NOTIFICATION] 🔔 COLD START - Notifee notification opened app');
            const n = notifeeInitial.notification;
            const notificationData = {
              ...(n.data || {}),
              title: n.title || (n.data as any)?.title,
            };
            handleNavigateFromData(notificationData as any);
          }
        }

        // Handle Notifee foreground press events
        notifee.onForegroundEvent(({ type, detail }) => {
          if (type === 1 /* EventType.PRESS */) {
            console.log('📱 [PUSH NOTIFICATION] ============================================');
            console.log('📱 [PUSH NOTIFICATION] 🔔 FOREGROUND NOTIFICATION TAPPED (Notifee)');
            console.log('📱 [PUSH NOTIFICATION] Notification ID:', detail.notification?.id);
            console.log('📱 [PUSH NOTIFICATION] Title:', detail.notification?.title);
            console.log('📱 [PUSH NOTIFICATION] Body:', detail.notification?.body);
            console.log('📱 [PUSH NOTIFICATION] Data:', JSON.stringify(detail.notification?.data, null, 2));
            // Pass title along with data
            const notificationData = {
              ...(detail.notification?.data || {}),
              title: detail.notification?.title || detail.notification?.data?.title,
            };
            handleNavigateFromData(notificationData as any);
          }
        });
      } catch (e) {
      }
    })();

    return () => {
      try {
        if (unsubscribeOnMessage) unsubscribeOnMessage();
        if (unsubscribeOnNotificationOpened) unsubscribeOnNotificationOpened();
      } catch (e) {}
    };
  }, []);

  // Auto-register device token and track login when user is loaded
  useEffect(() => {
    if (user?.id) {

      
      // Check if user role is 'customer' - should logout
      if (user.role === 'customer') {
        console.warn('⚠️ [USERCONTEXT] User has customer role, logging out...');
        logout();
        return;
      }
      
      // Verify user exists in backend
      const verifyUser = async () => {
        try {
          const verifyUrl = `${API_BASE_URL}/auth/verify-user/${user.id}`;
          console.log('🔄 [USERCONTEXT] Verifying user (on user change)...');
          console.log('🌐 [USERCONTEXT] API Base URL:', API_BASE_URL);
          console.log('🔗 [USERCONTEXT] Full URL:', verifyUrl);
          console.log('👤 [USERCONTEXT] User ID:', user.id);
          
          const verifyResponse = await fetch(verifyUrl);
          console.log('✅ [USERCONTEXT] Response received, status:', verifyResponse.status);
          const verifyData = await verifyResponse.json();
          console.log('📦 [USERCONTEXT] Response data:', JSON.stringify(verifyData, null, 2));
          
          if (!verifyData.exists || !verifyData.valid) {
            console.warn('⚠️ [USERCONTEXT] User not found in backend or invalid, logging out...');
            console.warn('⚠️ [USERCONTEXT] Reason:', verifyData.reason || 'user_not_found');
            await logout();
            return;
          }
          
          // User is valid, proceed with registration
          registerDeviceToken(user.id);
          // Track app open/login history (async, don't wait for it)
          trackLoginHistory(user).catch((err) => {
            console.error('Error tracking login history on app open:', err);
          });
        } catch (verifyError) {
          console.error('❌ [USERCONTEXT] Error verifying user:', verifyError);
          // If verification fails, still proceed but log warning
          console.warn('⚠️ [USERCONTEXT] Could not verify user, but proceeding');
          registerDeviceToken(user.id);
          trackLoginHistory(user).catch((err) => {
            console.error('Error tracking login history on app open:', err);
          });
        }
      };
      
      verifyUser();
    } else {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadUserFromStorage = async () => {
    try {
      console.log('🔄 [USERCONTEXT] Loading user from storage...');
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        // Ensure ownedCarwashes is always an array
        if (!parsedUser.ownedCarwashes) {
          parsedUser.ownedCarwashes = [];
        }
       
        try {
          const verifyUrl = `${API_BASE_URL}/auth/verify-user/${parsedUser.id}`;
          console.log('🔄 [USERCONTEXT] Verifying user with backend...');
          console.log('🌐 [USERCONTEXT] API Base URL:', API_BASE_URL);
          console.log('🔗 [USERCONTEXT] Full URL:', verifyUrl);
          console.log('👤 [USERCONTEXT] User ID:', parsedUser.id);
          
          // Timeout implementation with Promise.race
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 წამი
          });
          
          const fetchPromise = fetch(verifyUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          console.log('📡 [USERCONTEXT] Sending GET request to:', verifyUrl);
          const verifyResponse = await Promise.race([fetchPromise, timeoutPromise]);
          console.log('✅ [USERCONTEXT] Response received, status:', verifyResponse.status);
          const verifyData = await verifyResponse.json();
          console.log('📦 [USERCONTEXT] Response data:', JSON.stringify(verifyData, null, 2));
          
          if (!verifyData.exists || !verifyData.valid) {
            console.warn('⚠️ [USERCONTEXT] User not found in backend or invalid role, logging out...');
            console.warn('⚠️ [USERCONTEXT] Reason:', verifyData.reason || 'user_not_found');
            await logout();
            setUser(null);
            setLoading(false);
            return;
          }
          
          // User is valid, set it
          console.log('✅ [USERCONTEXT] User verified, setting user');
          setUser(parsedUser);
        } catch (verifyError: any) {
          console.error('❌ [USERCONTEXT] Error verifying user:', verifyError);
          // If verification fails, still set user but log warning
          // Timeout ან network error-ის შემთხვევაში, მაინც დავუშვათ მომხმარებელმა შევიდეს
          const errorMessage = verifyError?.message || String(verifyError);
          if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            console.warn('⚠️ [USERCONTEXT] Verification timeout, showing alert to user');
            
            // iOS-ზე გამოვაჩინოთ Alert timeout-ის შემთხვევაში
            if (Platform.OS === 'ios') {
              // პირველ რიგში დავუყენოთ user, რომ app არ დარჩეს loading-ში
              setUser(parsedUser);
              
              // შემდეგ გამოვაჩინოთ Alert
              setTimeout(() => {
                Alert.alert(
                  'დაკავშირების პრობლემა',
                  'სერვერთან დაკავშირება ვერ მოხერხდა. გსურთ გააგრძელოთ ან გამოხვიდეთ?',
                  [
                    {
                      text: 'გამოსვლა',
                      style: 'destructive',
                      onPress: async () => {
                        console.log('🚪 [USERCONTEXT] User chose to logout after timeout');
                        await logout();
                        setUser(null);
                      },
                    },
                    {
                      text: 'გაგრძელება',
                      style: 'default',
                      onPress: () => {
                        console.log('✅ [USERCONTEXT] User chose to continue after timeout');
                        // User უკვე დაყენებულია, არაფერი გავაკეთოთ
                      },
                    },
                  ],
                  { cancelable: false }
                );
              }, 500); // მცირე დაყოვნება რომ UI განახლდეს
            } else {
              // Android-ზე უბრალოდ გავაგრძელოთ
              setUser(parsedUser);
            }
          } else {
            console.warn('⚠️ [USERCONTEXT] Could not verify user, but keeping logged in');
            setUser(parsedUser);
          }
        }
      } else {
        // No user found, wait for login
        console.log('ℹ️ [USERCONTEXT] No user found in storage');
        setUser(null);
      }
    } catch (error) {
      console.error('❌ [USERCONTEXT] Error loading user from storage:', error);
      // Even on error, set loading to false so app can continue
      setUser(null);
    } finally {
      console.log('✅ [USERCONTEXT] Loading complete, setting loading to false');
      setLoading(false);
    }
  };

  const saveUserToStorage = async (userData: User) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  };

  const login = async (userData: any) => {
    try {
      setLoading(true);
      
      // Convert backend user data to frontend User format
      const frontendUser: User = {
        id: userData.id,
        name: userData.firstName || 'მომხმარებელი',
        email: userData.email || '',
        phone: userData.phone,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        role: userData.role || 'customer',
        ownedCarwashes: userData.ownedCarwashes || [],
      };
      


      setUser(frontendUser);
      await saveUserToStorage(frontendUser);
      
      // Register device token after login
      await registerDeviceToken(frontendUser.id);
      
      // Track login history (async, don't wait for it)
      trackLoginHistory(frontendUser).catch((err) => {
        console.error('Error tracking login history:', err);
      });
      
      // Track login in Firebase Analytics (fire-and-forget)
      analyticsService.logUserLogin(frontendUser.id, 'phone');
      
      // Set user properties (fire-and-forget)
      analyticsService.setUserProperties({
        user_role: frontendUser.role,
        user_id: frontendUser.id,
      });
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: any) => {
    try {
      setLoading(true);
      
      // Convert backend user data to frontend User format
      const frontendUser: User = {
        id: userData.id,
        name: userData.firstName || 'მომხმარებელი',
        email: userData.email || '',
        phone: userData.phone,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        role: userData.role || 'customer',
        ownedCarwashes: userData.ownedCarwashes || [],
      };
      

      setUser(frontendUser);
      await saveUserToStorage(frontendUser);
      
      await registerDeviceToken(frontendUser.id);
      
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      // ასევე წავშალოთ საბსქრიფშენი, რადგან ის ეკუთვნის ამ იუზერს
      await AsyncStorage.removeItem('user_subscription');
      setUser(null);
      // Navigate to login page
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearStorage = async () => {
    try {
      await AsyncStorage.clear();
      setUser(null);
    } catch (error) {
      console.error('Clear storage error:', error);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      await saveUserToStorage(updatedUser);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const updateUserRole = async (role: User['role']) => {
    if (!user) return;
    
    try {
      
      const response = await fetch(`${API_BASE_URL}/auth/update-role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          role: role
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      
      // Update local state
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      await saveUserToStorage(updatedUser);
    } catch (error) {
      console.error('❌ [UPDATE_ROLE] Error updating user role:', error);
      throw error;
    }
  };

  const addToOwnedCarwashes = async (carwashId: string) => {
    if (!user) return;
    
    try {

      // Update ownedCarwashes in backend
      const response = await fetch(`${API_BASE_URL}/auth/update-owned-carwashes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          carwashId: carwashId,
          action: 'add'
        }),
      });
      

      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update local state
      const currentOwnedCarwashes = user.ownedCarwashes || [];
      const updatedOwnedCarwashes = [...currentOwnedCarwashes, carwashId];
      const updatedUser = { ...user, ownedCarwashes: updatedOwnedCarwashes };
      setUser(updatedUser);
      await saveUserToStorage(updatedUser);

    } catch (error) {
      console.error('❌ [ADD_CARWASH] Add to owned carwashes error:', error);
      throw error;
    }
  };

  const removeFromOwnedCarwashes = async (carwashId: string) => {
    if (!user) return;
    
    try {
      const currentOwnedCarwashes = user.ownedCarwashes || [];
      const updatedOwnedCarwashes = currentOwnedCarwashes.filter(id => id !== carwashId);
      const updatedUser = { ...user, ownedCarwashes: updatedOwnedCarwashes };
      setUser(updatedUser);
      await saveUserToStorage(updatedUser);
    } catch (error) {
      console.error('Remove from owned carwashes error:', error);
      throw error;
    }
  };

  const clearPremiumModalFlag = () => {
    setShouldOpenPremiumModal(false);
  };

  return (
    <UserContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      shouldOpenPremiumModal,
      clearPremiumModalFlag,
      setShouldOpenPremiumModal,
      login,
      register,
      logout,
      clearStorage,
      updateProfile,
      updateUserRole,
      addToOwnedCarwashes,
      removeFromOwnedCarwashes,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}