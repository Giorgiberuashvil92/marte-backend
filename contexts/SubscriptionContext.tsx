import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';
import { useUser } from './UserContext';

export interface Subscription {
  id: string;
  plan: 'free' | 'basic' | 'premium';
  status: 'active' | 'inactive' | 'expired' | 'cancelled';
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  price: number;
  currency: string;
  bogCardToken?: string; // BOG payment token recurring payment-ებისთვის
  planId?: string; // Backend planId
  planName?: string; // Backend planName
  planPeriod?: string; // monthly, yearly, etc.
  userId?: string; // User ID რომელსაც ეკუთვნის ეს საბსქრიფშენი
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  isLoading: boolean;
  hasActiveSubscription: boolean;
  isPremiumUser: boolean;
  isBasicUser: boolean;
  updateSubscription: (subscription: Subscription) => void;
  clearSubscription: () => void;
  checkSubscriptionStatus: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const appState = useRef(AppState.currentState);

  // Default basic subscription (ყველა იუზერი თავიდან basic-ით იწყებს)
  const defaultSubscription: Subscription = {
    id: 'basic_default',
    plan: 'basic',
    status: 'active',
    startDate: new Date().toISOString(),
    autoRenew: false,
    price: 0,
    currency: 'GEL',
  };

  const { user } = useUser();

  const loadSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      
      console.log('📋 Loading subscription for user:', user?.id || 'no user');
      
      // თუ user არ არის, default subscription დავაყენოთ
      if (!user?.id) {
        console.log('⚠️ No user found, setting default subscription');
        setSubscription(defaultSubscription);
        setIsLoading(false);
        return;
      }
      
      // Backend-იდან იღებს საბსქრიფშენს (ერთადერთი წყარო)
      try {
        console.log('📋 Fetching subscription from backend...');
        const response = await fetch(`${API_BASE_URL}/api/payments/subscription/user/${user.id}/status`);
        const result = await response.json();
        
        console.log('📋 Backend subscription response:', result);
        
        if (result.success && result.data) {
          // Backend-ში არის საბსქრიფშენი
          const subscriptionData = result.data;
          const backendSubscription = {
            id: subscriptionData._id || 'backend_subscription',
            plan: subscriptionData.planId || 'free',
            status: subscriptionData.status || 'active',
            startDate: subscriptionData.startDate || new Date().toISOString(),
            endDate: subscriptionData.nextBillingDate,
            autoRenew: true,
            price: subscriptionData.planPrice || 0,
            currency: subscriptionData.currency || 'GEL',
            bogCardToken: subscriptionData.bogCardToken, // BOG payment token recurring payment-ებისთვის
            planId: subscriptionData.planId,
            planName: subscriptionData.planName,
            planPeriod: subscriptionData.period,
            userId: user.id,
          };
          
          setSubscription(backendSubscription);
          // localStorage-ში ინახება მხოლოდ cache-ისთვის
          await AsyncStorage.setItem('user_subscription', JSON.stringify(backendSubscription));
          console.log('✅ Subscription loaded from backend:', backendSubscription);
          console.log('💳 BOG Card Token:', backendSubscription.bogCardToken ? '✅ Available' : '❌ Not available');
          console.log('📦 Plan:', backendSubscription.plan);
          console.log('📦 Plan ID:', backendSubscription.planId);
          console.log('📦 Plan Name:', backendSubscription.planName);
          console.log('📦 Plan Period:', backendSubscription.planPeriod);
          console.log('📦 Status:', backendSubscription.status);
          console.log('📦 Price:', backendSubscription.price, backendSubscription.currency);
          console.log('📦 Start Date:', backendSubscription.startDate);
          console.log('📦 End Date:', backendSubscription.endDate);
          console.log('📦 Auto Renew:', backendSubscription.autoRenew);
          console.log('═══════════════════════════════════════════════════════');
          console.log('✅ Subscription მონაცემები წარმატებით ჩაიტვირთა!');
          console.log('═══════════════════════════════════════════════════════');
        } else {
          // Backend-ში არ არის საბსქრიფშენი - დავაყენოთ default subscription
          console.log('⚠️ No subscription found in backend, setting default basic subscription');
          const defaultSubWithUserId = { ...defaultSubscription, userId: user.id };
          setSubscription(defaultSubWithUserId);
          // localStorage-ში ინახება cache-ისთვის
          await AsyncStorage.setItem('user_subscription', JSON.stringify(defaultSubWithUserId));
          console.log('📦 Default basic subscription set');
        }
      } catch (backendError) {
        // Backend-ის request fail-დება - დავაყენოთ default subscription
        console.error('❌ Backend subscription check failed:', backendError);
        console.log('⚠️ Setting default basic subscription due to backend error');
        const defaultSubWithUserId = { ...defaultSubscription, userId: user.id };
        setSubscription(defaultSubWithUserId);
        // localStorage-ში ინახება cache-ისთვის
        await AsyncStorage.setItem('user_subscription', JSON.stringify(defaultSubWithUserId));
        console.log('📦 Default basic subscription set');
      }
    } catch (error) {
      console.error('❌ Error loading subscription:', error);
      setSubscription(defaultSubscription);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]); // Reload when user changes

  useEffect(() => {
    console.log('🔄 Subscription useEffect triggered, user:', user?.id || 'no user');
    loadSubscription();
  }, [loadSubscription]); // Reload subscription when user changes

  // AppState listener - refresh subscription when app comes to foreground
  useEffect(() => {
    if (!user?.id) return;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // When app comes to foreground, refresh subscription
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 App came to foreground, refreshing subscription...');
        loadSubscription();
      }
      
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [user?.id, loadSubscription]);

  // Periodic refresh - every 5 minutes
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      console.log('🔄 Periodic subscription refresh (5 minutes)...');
      loadSubscription();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(interval);
    };
  }, [user?.id, loadSubscription]);

  const updateSubscription = async (newSubscription: Subscription) => {
    try {
      setSubscription(newSubscription);
      // localStorage-ში ინახება მხოლოდ cache-ისთვის (backend არის წყარო)
      await AsyncStorage.setItem('user_subscription', JSON.stringify({ ...newSubscription, userId: user?.id }));
      console.log('✅ Subscription updated:', newSubscription);
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
    }
  };

  const clearSubscription = async () => {
    try {
      setSubscription(null);
      await AsyncStorage.removeItem('user_subscription');
      console.log('🗑️ Subscription cleared');
    } catch (error) {
      console.error('❌ Error clearing subscription:', error);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      if (!subscription) return;

      const now = new Date();
      const endDate = subscription.endDate ? new Date(subscription.endDate) : null;

      // Check if subscription is expired
      if (endDate && now > endDate && subscription.status === 'active') {
        const expiredSubscription = {
          ...subscription,
          status: 'expired' as const,
        };
        await updateSubscription(expiredSubscription);
        console.log('⏰ Subscription expired');
      }
    } catch (error) {
      console.error('❌ Error checking subscription status:', error);
    }
  };

  const refreshSubscription = useCallback(async () => {
    console.log('🔄 Force refreshing subscription...');
    await loadSubscription();
  }, [loadSubscription]);

  const hasActiveSubscription = subscription?.status === 'active';
  const isPremiumUser = hasActiveSubscription && subscription?.plan === 'premium';
  const isBasicUser = hasActiveSubscription && subscription?.plan === 'basic';

  const value: SubscriptionContextType = {
    subscription,
    isLoading,
    hasActiveSubscription,
    isPremiumUser,
    isBasicUser,
    updateSubscription,
    clearSubscription,
    checkSubscriptionStatus,
    refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Helper functions
export const getSubscriptionFeatures = (plan: string) => {
  switch (plan) {
    case 'free':
      return {
        aiRecommendations: 5, // per day
        carfaxReports: 0,
        prioritySupport: false,
        exclusiveFeatures: false,
        earlyAccess: false,
      };
    case 'basic':
      return {
        aiRecommendations: -1, // unlimited
        carfaxReports: 0, // basic-ს არ აქვს კარფაქსის უფლება
        prioritySupport: false,
        exclusiveFeatures: false,
        earlyAccess: false,
      };
    case 'premium':
      return {
        aiRecommendations: -1, // unlimited
        carfaxReports: -1, // unlimited
        prioritySupport: true,
        exclusiveFeatures: true,
        earlyAccess: true,
      };
    default:
      return {
        aiRecommendations: 0,
        carfaxReports: 0,
        prioritySupport: false,
        exclusiveFeatures: false,
        earlyAccess: false,
      };
  }
};

export const canUseFeature = (subscription: Subscription | null, feature: keyof ReturnType<typeof getSubscriptionFeatures>): boolean => {
  if (!subscription || subscription.status !== 'active') {
    return false;
  }

  const features = getSubscriptionFeatures(subscription.plan);
  const featureValue = features[feature];
  return featureValue === true || featureValue === -1 || (typeof featureValue === 'number' && featureValue > 0);
};
