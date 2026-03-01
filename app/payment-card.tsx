import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Dimensions,
  Animated,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUser } from '../contexts/UserContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import BOGPaymentModal from '../components/ui/BOGPaymentModal';
import { bogApi } from '../services/bogApi';
import { carwashApi } from '../services/carwashApi';
import { addItemApi, DismantlerData, StoreData } from '../services/addItemApi';
import photoService from '../services/photoService';
import { API_BASE_URL } from '../config/api';

const { width, height } = Dimensions.get('window');

interface PaymentData {
  amount: number;
  currency: string;
  description: string;
  context: string;
  orderId?: string;
  successUrl?: string;
  isSubscription?: boolean;
  planId?: string;
  planName?: string;
  planPrice?: string;
  planCurrency?: string;
  planDescription?: string;
  metadata?: Record<string, any>;
}

interface SavedCard {
  payerIdentifier?: string; // masked card number
  cardType?: string; // mc, visa
  cardExpiryDate?: string; // 07/29
  paymentToken?: string;
}

export default function PaymentCardScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { subscription, hasActiveSubscription, isPremiumUser, isBasicUser, refreshSubscription } = useSubscription();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    amount?: string;
    description?: string;
    context?: string;
    orderId?: string;
    successUrl?: string;
    isSubscription?: string;
    planId?: string;
    planName?: string;
    planPrice?: string;
    planCurrency?: string;
    planDescription?: string;
    metadata?: string;
  }>();

  // Payment Data-ს შექმნა params-იდან ან DB-დან
  const [paymentData, setPaymentData] = useState<PaymentData>({
    amount: parseFloat(params.amount || '0'),
    currency: params.planCurrency || '₾',
    description: params.description || 'CarApp სერვისი',
    context: params.context || 'general',
    orderId: params.orderId,
    successUrl: params.successUrl,
    isSubscription: params.isSubscription === 'true',
    planId: params.planId,
    planName: params.planName,
    planPrice: params.planPrice,
    planCurrency: params.planCurrency,
    planDescription: params.planDescription,
    metadata: (() => {
      try {
        return params.metadata ? JSON.parse(params.metadata) : {};
      } catch {
        return {};
      }
    })(),
  });

  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCard, setLoadingCard] = useState(true);
  const [loadingPayment, setLoadingPayment] = useState(true);
  const [showBOGPaymentModal, setShowBOGPaymentModal] = useState(false);
  const [bogPaymentUrl, setBogPaymentUrl] = useState('');
  const [bogOrderId, setBogOrderId] = useState<string | null>(null); // BOG order_id recurring payments-ისთვის
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bogOAuthStatus, setBogOAuthStatus] = useState<any>(null);
  const [isCheckingBOG, setIsCheckingBOG] = useState<boolean>(false);
  const [visible, setVisible] = useState(true);
  const [paymentFromDB, setPaymentFromDB] = useState<any | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!user?.id) {
        setLoadingPayment(false);
        setLoadingCard(false);
        return;
      }

      try {
        
        
        const response = await fetch(`${API_BASE_URL}/api/payments/user/${user.id}`);
        const result = await response.json();

        
        
        if (result.success && result.data && result.data.length > 0) {
         
          
          // ვიღებთ subscription-ის გადახდას
          const subscriptionPayment = result.data.find((p: any) => 
            p.context === 'subscription' && p.status === 'completed'
          );

          if (subscriptionPayment) {
           
            
            setPaymentFromDB(subscriptionPayment);
            
           
            if (!subscriptionPayment.metadata?.planId) {
              let subscriptionData = null;
              
              try {
                const subResponse = await fetch(`${API_BASE_URL}/api/payments/subscription/user/${user.id}/status`);
                const subResult = await subResponse.json();
                
                if (subResult.success && subResult.data) {
                  subscriptionData = subResult.data;
                  
                } else {
                }
              } catch (subError) {
                console.error('❌ Subscription API-დან წამოღების შეცდომა:', subError);
                console.log('📋 Trying to get subscription from Context...');
              }
              
              // თუ API-დან არ მოიძებნა, Context-დან ვიღებთ
              if (!subscriptionData && subscription) {
                console.log('✅ Subscription found from Context!');
                console.log('📦 Subscription from Context:', JSON.stringify(subscription, null, 2));
                console.log('📦 Plan:', subscription.plan);
                console.log('📦 Price:', subscription.price, subscription.currency);
                
                // Context-დან subscription-ის მონაცემების გამოყენება
                subscriptionData = {
                  planId: subscription.plan,
                  planName: subscription.plan === 'basic' ? 'ძირითადი' : subscription.plan === 'premium' ? 'პრემიუმ' : subscription.plan,
                  planPrice: subscription.price,
                  currency: subscription.currency === '₾' ? 'GEL' : subscription.currency,
                  period: subscription.plan === 'basic' ? 'უფასო' : 'თვეში',
                };
              }
              
              // Payment Data-ს განახლება subscription-ის მონაცემებით
              if (subscriptionData) {
                console.log('📦 Using subscription data:', subscriptionData);
                setPaymentData(prev => ({
                  ...prev,
                  amount: subscriptionData.planPrice || subscriptionPayment.amount || prev.amount,
                  currency: subscriptionData.currency === 'GEL' ? '₾' : subscriptionData.currency || prev.currency,
                  description: subscriptionPayment.description || prev.description,
                  context: subscriptionPayment.context || prev.context,
                  isSubscription: true,
                  planId: subscriptionData.planId || prev.planId,
                  planName: subscriptionData.planName || prev.planName,
                  planPrice: subscriptionData.planPrice?.toString() || prev.planPrice,
                  planCurrency: subscriptionData.currency === 'GEL' ? '₾' : subscriptionData.currency || prev.planCurrency,
                  planDescription: subscriptionData.planName 
                    ? `CarAppX ${subscriptionData.planName} პაკეტი - ${subscriptionData.period || 'თვეში'}`
                    : prev.planDescription,
                  metadata: {
                    ...prev.metadata,
                    ...subscriptionPayment.metadata,
                    planId: subscriptionData.planId,
                    planName: subscriptionData.planName,
                    planPrice: subscriptionData.planPrice?.toString(),
                    planCurrency: subscriptionData.currency === 'GEL' ? '₾' : subscriptionData.currency,
                    planPeriod: subscriptionData.period,
                  },
                }));
              } else {
                console.log('⚠️ No subscription found in API or Context');
              }
            } else {
              // Payment Data-ს განახლება DB-დან მიღებული მონაცემებით (თუ plan-ის მონაცემები არის)
              setPaymentData(prev => ({
                ...prev,
                amount: subscriptionPayment.amount || prev.amount,
                currency: subscriptionPayment.currency === 'GEL' ? '₾' : subscriptionPayment.currency || prev.currency,
                description: subscriptionPayment.description || prev.description,
                context: subscriptionPayment.context || prev.context,
                isSubscription: subscriptionPayment.context === 'subscription' || prev.isSubscription,
                planId: subscriptionPayment.metadata?.planId || prev.planId,
                planName: subscriptionPayment.metadata?.planName || prev.planName,
                planPrice: subscriptionPayment.metadata?.planPrice || subscriptionPayment.amount?.toString() || prev.planPrice,
                planCurrency: subscriptionPayment.metadata?.planCurrency || (subscriptionPayment.currency === 'GEL' ? '₾' : subscriptionPayment.currency) || prev.planCurrency,
                planDescription: subscriptionPayment.metadata?.planName 
                  ? `CarAppX ${subscriptionPayment.metadata.planName} პაკეტი - ${subscriptionPayment.metadata?.planPeriod || 'თვეში'}`
                  : prev.planDescription,
                metadata: {
                  ...prev.metadata,
                  ...subscriptionPayment.metadata,
                  planId: subscriptionPayment.metadata?.planId,
                  planName: subscriptionPayment.metadata?.planName,
                  planPrice: subscriptionPayment.metadata?.planPrice,
                  planCurrency: subscriptionPayment.metadata?.planCurrency,
                  planPeriod: subscriptionPayment.metadata?.planPeriod,
                },
              }));
            }
          } else {
            console.log('⚠️ No subscription payment found');
          }

          // ვიღებთ ბოლო წარმატებულ გადახდას ბარათის მონაცემებისთვის
          const lastPayment = result.data.find((p: any) => 
            p.status === 'completed' && 
            (p.payerIdentifier || p.cardType || p.cardExpiryDate)
          ) || result.data[0];

          if (lastPayment) {
            console.log('💳 Card data from payment:', {
              payerIdentifier: lastPayment.payerIdentifier,
              cardType: lastPayment.cardType,
              cardExpiryDate: lastPayment.cardExpiryDate,
            });
            
            setSavedCard({
              payerIdentifier: lastPayment.payerIdentifier,
              cardType: lastPayment.cardType,
              cardExpiryDate: lastPayment.cardExpiryDate,
              paymentToken: lastPayment.paymentToken,
            });
          }
        } else {
          console.log('⚠️ No payments found in database');
        }
        
        console.log('💳 ================================================');
      } catch (error) {
        console.error('❌ Payment მონაცემების წამოღების შეცდომა:', error);
      } finally {
        setLoadingPayment(false);
        setLoadingCard(false);
      }
    };

    fetchPaymentData();
  }, [user?.id]);

  // BOG OAuth Status Check
  useEffect(() => {
    const checkBOGStatus = async () => {
      setIsCheckingBOG(true);
      try {
        const status = await bogApi.getOAuthStatus();
        setBogOAuthStatus(status);
      } catch (error) {
        console.error('❌ BOG OAuth სტატუსის შემოწმების შეცდომა:', error);
        setBogOAuthStatus({ isTokenValid: false });
      } finally {
        setIsCheckingBOG(false);
      }
    };

    checkBOGStatus();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Subscription-ის სტატუსის ლოგირება
  useEffect(() => {
    console.log('📋 ========== SUBSCRIPTION STATUS ==========');
    console.log('👤 User ID:', user?.id);
    console.log('✅ Has Active Subscription:', hasActiveSubscription);
    console.log('💎 Is Premium User:', isPremiumUser);
    console.log('⭐ Is Basic User:', isBasicUser);
    console.log('📦 Subscription Data:', JSON.stringify(subscription, null, 2));
    if (subscription) {
      console.log('📦 Plan:', subscription.plan);
      console.log('📦 Status:', subscription.status);
      console.log('📦 Price:', subscription.price, subscription.currency);
      console.log('📦 Start Date:', subscription.startDate);
      console.log('📦 End Date:', subscription.endDate);
      console.log('📦 Auto Renew:', subscription.autoRenew);
    } else {
      console.log('⚠️ No subscription found');
    }
    console.log('📋 =========================================');
  }, [subscription, hasActiveSubscription, isPremiumUser, isBasicUser, user?.id]);

  const handleBOGPayment = async () => {
    if (!bogOAuthStatus?.isTokenValid) {
      Alert.alert('შეცდომა', 'BOG OAuth სერვისი არ არის ხელმისაწვდომი');
      return;
    }

    if (!user?.id) {
      Alert.alert('შეცდომა', 'მომხმარებელი არ არის ავტორიზებული');
      return;
    }

    if (paymentData.amount <= 0) {
      Alert.alert('შეცდომა', 'გადახდის თანხა არასწორია');
      return;
    }

    setLoading(true);

    try {
      // თუ subscription აქვს და bogCardToken აქვს, recurring payment გამოვიყენოთ
      if (subscription?.bogCardToken && paymentData.isSubscription) {
        console.log('💳 შენახული ბარათით recurring payment-ის განხორციელება...');
        console.log('📦 BOG Card Token:', subscription.bogCardToken);
        console.log('📦 Subscription Plan:', subscription.plan);
        
        const externalOrderId = paymentData.orderId || `recurring_${subscription.id}_${Date.now()}`;
        
        try {
          const result = await bogApi.processRecurringPayment(subscription.bogCardToken, externalOrderId);
          console.log('✅ Recurring payment წარმატებით განხორციელდა:', result);
          
          // Recurring payment-ის შემთხვევაში redirect_url არ არის საჭირო, გადახდა ავტომატურად ჩამოჭრება
          Alert.alert(
            'წარმატება',
            'გადახდა წარმატებით განხორციელდა შენახული ბარათით!',
            [
              {
                text: 'OK',
                onPress: () => {
                  router.back();
                },
              },
            ]
          );
          return;
        } catch (recurringError) {
          console.error('❌ Recurring payment-ის შეცდომა:', recurringError);
          // თუ recurring payment ვერ მოხერხდა, ახალი ბარათით გადახდაზე გადავიდეთ
          Alert.alert(
            'შეცდომა',
            'შენახული ბარათით გადახდა ვერ მოხერხდა. გააგრძელეთ ახალი ბარათით.',
            [{ text: 'OK' }]
          );
        }
      }

      // ახალი ბარათით გადახდა
      console.log('💳 ახალი ბარათით გადახდის ინიციალიზაცია...');
      
      // external_order_id-ის შექმნა userId-ს და plan metadata-ს ჩართვით
      let externalOrderId = paymentData.orderId;
      if (!externalOrderId) {
        if (paymentData.context === 'carfax-package') {
          // CarFAX პაკეტი: carfax_package_userId_timestamp
          externalOrderId = `carfax_package_${user.id}_${Date.now()}`;
        } else if (paymentData.isSubscription && paymentData.planId) {
          // Subscription payment: subscription_planId_timestamp_userId
          externalOrderId = `subscription_${paymentData.planId}_${Date.now()}_${user.id}`;
        } else {
          // Regular payment: carapp_timestamp_userId
          externalOrderId = `carapp_${Date.now()}_${user.id}`;
        }
      } else if (paymentData.context === 'carfax-package' && !externalOrderId.includes('carfax_package')) {
        // CarFAX პაკეტისთვის prefix-ის დამატება
        externalOrderId = `carfax_package_${user.id}_${Date.now()}`;
      } else if (paymentData.isSubscription && paymentData.planId && !externalOrderId.includes('subscription_')) {
        // თუ orderId არ შეიცავს subscription prefix-ს, დავამატოთ
        externalOrderId = `subscription_${paymentData.planId}_${Date.now()}_${user.id}`;
      }
      
      // Production URL-ები redirect-ისთვის (mobile app-ში localhost არ მუშაობს)
      const PRODUCTION_BASE_URL = 'https://marte-backend-production.up.railway.app';
      
      // თუ successUrl relative URL-ია (იწყება /-ით), გადავაქციოთ absolute URL-ად
      let successUrl = paymentData.successUrl || `${PRODUCTION_BASE_URL}/payment/success`;
      if (successUrl.startsWith('/')) {
        successUrl = `${PRODUCTION_BASE_URL}${successUrl}`;
      }
      
      const failUrl = `${PRODUCTION_BASE_URL}/payment/fail`;
      
      const orderData = {
        callback_url: `${API_BASE_URL}/bog/callback`,
        external_order_id: externalOrderId,
        total_amount: paymentData.amount,
        currency: paymentData.currency === '₾' ? 'GEL' : paymentData.currency,
        product_id: paymentData.context,
        description: paymentData.description,
        success_url: successUrl,
        fail_url: failUrl,
        save_card: paymentData.isSubscription || paymentData.context === 'dismantler', // Subscription-ისა და დაშლილებისთვის ბარათის დამახსოვრება
      };

      console.log('💳 BOG Order Data:', {
        ...orderData,
        save_card: orderData.save_card ? '✅ true (ბარათი დამახსოვრებული იქნება)' : '❌ false',
      });

      const result = await bogApi.createOrder(orderData);
      setBogPaymentUrl(result.redirect_url);
      setBogOrderId(result.id); // BOG order_id recurring payments-ისთვის
      setShowBOGPaymentModal(true);
    } catch (error) {
      console.error('❌ BOG გადახდის შეცდომა:', error);
      Alert.alert('შეცდომა', 'BOG გადახდის ინიციალიზაცია ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const savePaymentInfo = async () => {
    try {
      if (!user?.id || !paymentData.amount || !paymentData.orderId) return;

      const paymentInfo = {
        userId: user.id,
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        currency: paymentData.currency === '₾' ? 'GEL' : paymentData.currency,
        paymentMethod: 'BOG',
        status: 'completed',
        context: paymentData.context,
        description: paymentData.description,
        paymentDate: new Date().toISOString(),
        metadata: paymentData.metadata || {},
      };

      await fetch(`${API_BASE_URL}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentInfo),
      });
    } catch (error) {
      console.error('❌ Error saving payment info:', error);
    }
  };

  const getCardTypeName = (type?: string) => {
    if (!type) return 'ბარათი';
    if (type.toLowerCase() === 'mc') return 'MasterCard';
    if (type.toLowerCase() === 'visa') return 'Visa';
    return type.toUpperCase();
  };

  const formatCardNumber = (identifier?: string) => {
    if (!identifier) return '**** **** **** ****';
    // payerIdentifier ჩვეულებრივ არის ****1234 ფორმატში
    return identifier;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        setVisible(false);
        router.back();
      }}
    >
      <View style={styles.modalOverlay}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {
                paddingTop: insets.top,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setVisible(false);
                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#0B1220" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>გადახდა</Text>
            <View style={styles.headerSpacer} />
          </Animated.View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>2 of 3</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '66.66%' }]} />
            </View>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Payment Details Card */}
            <Animated.View
              style={[
                styles.paymentDetailsCard,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.paymentDetailsHeader}>
                <View style={styles.paymentIcon}>
                  <Ionicons name="receipt-outline" size={24} color="#6366F1" />
                </View>
                <Text style={styles.paymentDetailsTitle}>გადახდის დეტალები</Text>
              </View>

              <View style={styles.detailsDivider} />

              {/* Subscription Info */}
              {paymentData.isSubscription && paymentData.planName && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>პაკეტი:</Text>
                    <Text style={styles.detailValue}>{paymentData.planName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>პერიოდი:</Text>
                    <Text style={styles.detailValue}>
                      {paymentData.metadata?.planPeriod || 'თვეში'}
                    </Text>
                  </View>
                </>
              )}

              {/* Amount */}
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>თანხა:</Text>
                <Text style={styles.amountValue}>
                  {paymentData.amount} {paymentData.currency}
                </Text>
              </View>

              {/* Description */}
              {paymentData.description && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>აღწერა:</Text>
                  <Text style={styles.detailValue}>{paymentData.description}</Text>
                </View>
              )}

              {/* Context specific details */}
              {paymentData.metadata?.serviceName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>სერვისი:</Text>
                  <Text style={styles.detailValue}>{paymentData.metadata.serviceName}</Text>
                </View>
              )}

              {paymentData.metadata?.locationName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ადგილმდებარეობა:</Text>
                  <Text style={styles.detailValue}>{paymentData.metadata.locationName}</Text>
                </View>
              )}

              {paymentData.metadata?.selectedDate && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>თარიღი:</Text>
                  <Text style={styles.detailValue}>{paymentData.metadata.selectedDate}</Text>
                </View>
              )}

              {paymentData.metadata?.selectedTime && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>დრო:</Text>
                  <Text style={styles.detailValue}>{paymentData.metadata.selectedTime}</Text>
                </View>
              )}
            </Animated.View>

            {/* Saved Card */}
            {loadingCard ? (
              <View style={styles.cardLoadingContainer}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.cardLoadingText}>ბარათის მონაცემების ჩატვირთვა...</Text>
              </View>
            ) : savedCard?.payerIdentifier ? (
              <Animated.View
                style={[
                  styles.savedCardContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <Text style={styles.sectionTitle}>შენახული ბარათი</Text>
                <View style={styles.cardPreview}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTypeText}>
                      {getCardTypeName(savedCard.cardType)}
                    </Text>
                    {savedCard.cardType?.toLowerCase() === 'visa' ? (
                      <View style={styles.visaLogo}>
                        <Text style={styles.visaText}>VISA</Text>
                      </View>
                    ) : savedCard.cardType?.toLowerCase() === 'mc' ? (
                      <View style={styles.mastercardLogo}>
                        <View style={styles.mcCircle1} />
                        <View style={styles.mcCircle2} />
                      </View>
                    ) : (
                      <Ionicons name="card" size={24} color="#6366F1" />
                    )}
                  </View>
                  <View style={styles.cardNumberContainer}>
                    <Text style={styles.cardNumberText}>
                      {formatCardNumber(savedCard.payerIdentifier)}
                    </Text>
                  </View>
                  {savedCard.cardExpiryDate && (
                    <View style={styles.cardExpiryContainer}>
                      <Text style={styles.cardExpiryLabel}>ვადის გასვლის თარიღი</Text>
                      <Text style={styles.cardExpiryText}>{savedCard.cardExpiryDate}</Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            ) : null}

            {/* BOG Payment Button */}
            <Animated.View
              style={[
                styles.paymentButtonContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.paymentButton,
                  (!bogOAuthStatus?.isTokenValid || loading || isCheckingBOG) &&
                    styles.paymentButtonDisabled,
                ]}
                onPress={handleBOGPayment}
                disabled={!bogOAuthStatus?.isTokenValid || loading || isCheckingBOG}
                activeOpacity={0.9}
              >
                {loading || isCheckingBOG ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.paymentButtonText}>
                      {isCheckingBOG ? 'BOG შემოწმება...' : 'მუშაობს...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="card" size={20} color="#FFFFFF" />
                    <Text style={styles.paymentButtonText}>
                      {bogOAuthStatus?.isTokenValid
                        ? 'BOG გადახდა'
                        : 'BOG არ მზადაა'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {bogOAuthStatus?.isTokenValid && (
                <View style={styles.securityBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#22C55E" />
                  <Text style={styles.securityText}>უსაფრთხო გადახდა</Text>
                </View>
              )}
            </Animated.View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </SafeAreaView>

        <BOGPaymentModal
          visible={showBOGPaymentModal}
          paymentUrl={bogPaymentUrl}
          onClose={() => setShowBOGPaymentModal(false)}
          onSuccess={async () => {
            setShowBOGPaymentModal(false);
            setShowSuccessModal(true);
            await savePaymentInfo();

            if (paymentData.isSubscription) {
              try {
                await refreshSubscription();
              } catch (error) {
                console.error('❌ Error refreshing subscription:', error);
              }
            }

            if (paymentData.context === 'dismantler' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const formData = metadata.formData || {};
                
                let uploadedPhotos: string[] = [];
                if (formData.photos && formData.photos.length > 0) {
                  uploadedPhotos = await photoService.processPhotosForSaving(formData.photos, 'carappx');
                }
                
                let dismantlerNormalizedPhone = formData.phone;
                if (dismantlerNormalizedPhone && !dismantlerNormalizedPhone.startsWith('+995') && !dismantlerNormalizedPhone.startsWith('995')) {
                  dismantlerNormalizedPhone = '+995' + dismantlerNormalizedPhone;
                }
                
                const dismantlerData: DismantlerData = {
                  brand: formData.brand,
                  model: formData.model,
                  yearFrom: parseInt(formData.yearFrom),
                  yearTo: parseInt(formData.yearTo),
                  photos: uploadedPhotos,
                  description: formData.description,
                  location: formData.location,
                  phone: dismantlerNormalizedPhone,
                  name: formData.name,
                  latitude: formData.latitude,
                  longitude: formData.longitude,
                  address: formData.address,
                  isFeatured: metadata.tier === 'vip',
                  bogCardToken: bogOrderId || undefined, // BOG order_id recurring payments-ისთვის
                };
                
                await addItemApi.createDismantler(dismantlerData, metadata.userId || user?.id);
              } catch (error) {
                console.error('❌ დაშლილების განცხადების შენახვისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების შენახვისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // განცხადების განახლება (renewal)
            if (paymentData.context === 'dismantler-renewal' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const dismantlerId = metadata.dismantlerId;
                
                if (dismantlerId) {
                  await addItemApi.renewDismantler(dismantlerId, metadata.userId || user?.id);
                  console.log('✅ დაშლილების განცხადება წარმატებით განახლდა');
                }
              } catch (error) {
                console.error('❌ დაშლილების განცხადების განახლებისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების განახლებისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // VIP-ზე გადაყვანა (upgrade)
            if (paymentData.context === 'dismantler-upgrade' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const dismantlerId = metadata.dismantlerId;
                
                if (dismantlerId) {
                  await addItemApi.updateDismantler(
                    dismantlerId,
                    { isFeatured: true },
                    metadata.userId || user?.id
                  );
                  await addItemApi.renewDismantler(dismantlerId, metadata.userId || user?.id);
                  console.log('✅ დაშლილების განცხადება წარმატებით გადაიყვანა VIP-ზე');
                }
              } catch (error) {
                console.error('❌ დაშლილების განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // მაღაზიის შექმნა (initial creation)
            if (paymentData.context === 'store' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const formData = metadata.formData || {};
                
                let uploadedPhotos: string[] = [];
                if (formData.photos && formData.photos.length > 0) {
                  uploadedPhotos = await photoService.processPhotosForSaving(formData.photos, 'carappx');
                } else if (formData.images && formData.images.length > 0) {
                  uploadedPhotos = await photoService.processPhotosForSaving(formData.images, 'carappx');
                }
                
                let storeNormalizedPhone = formData.phone;
                if (storeNormalizedPhone && !storeNormalizedPhone.startsWith('+995') && !storeNormalizedPhone.startsWith('995')) {
                  storeNormalizedPhone = '+995' + storeNormalizedPhone;
                }
                
                const storeData: StoreData = {
                  title: formData.title,
                  description: formData.description,
                  type: formData.type,
                  images: uploadedPhotos,
                  location: formData.location,
                  address: formData.address,
                  phone: storeNormalizedPhone,
                  name: formData.name,
                  ownerId: metadata.userId || user?.id || 'demo-user',
                  workingHours: formData.workingHours,
                  latitude: formData.latitude,
                  longitude: formData.longitude,
                  isFeatured: metadata.tier === 'vip',
                };
                
                await addItemApi.createStore(storeData, metadata.userId || user?.id || undefined);
                console.log('✅ მაღაზიის განცხადება წარმატებით შეიქმნა გადახდის შემდეგ');
              } catch (error) {
                console.error('❌ მაღაზიის განცხადების შენახვისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების შენახვისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // მაღაზიის განახლება (renewal)
            if (paymentData.context === 'store-renewal' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const storeId = metadata.storeId;
                
                if (storeId) {
                  await addItemApi.renewStore(storeId, metadata.userId || user?.id);
                  console.log('✅ მაღაზიის განცხადება წარმატებით განახლდა');
                }
              } catch (error) {
                console.error('❌ მაღაზიის განცხადების განახლებისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების განახლებისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // VIP-ზე გადაყვანა (store upgrade)
            if (paymentData.context === 'store-upgrade' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const storeId = metadata.storeId;
                
                if (storeId) {
                  await addItemApi.updateStore(
                    storeId,
                    { isFeatured: true },
                    metadata.userId || user?.id
                  );
                  await addItemApi.renewStore(storeId, metadata.userId || user?.id);
                  console.log('✅ მაღაზიის განცხადება წარმატებით გადაიყვანა VIP-ზე');
                }
              } catch (error) {
                console.error('❌ მაღაზიის განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // ავტოსერვისის შექმნა (initial creation)
            if (paymentData.context === 'service' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const formData = metadata.formData;
                
                if (!formData) {
                  throw new Error('Form data is missing');
                }

                // Upload images
                let uploadedImages: string[] = [];
                if (formData.images && formData.images.length > 0) {
                  uploadedImages = await photoService.processPhotosForSaving(formData.images, 'carappx');
                }

                // Normalize phone number
                let normalizedPhone = formData.phone;
                if (normalizedPhone && !normalizedPhone.startsWith('+995') && !normalizedPhone.startsWith('995')) {
                  normalizedPhone = '+995' + normalizedPhone;
                }

                // Normalize ownerId - remove 'usr_' prefix if present
                const rawOwnerId = metadata.userId || user?.id || '';
                const normalizedOwnerId = rawOwnerId.startsWith('usr_') ? rawOwnerId.replace('usr_', '') : rawOwnerId;

                // Create service
                const serviceData = {
                  name: formData.name,
                  description: formData.description,
                  category: formData.category || 'ავტოსერვისი',
                  location: formData.location,
                  address: formData.address,
                  phone: normalizedPhone,
                  images: uploadedImages,
                  services: formData.services ? formData.services.split(',').map((s: string) => s.trim()) : [],
                  workingHours: formData.workingHours,
                  latitude: formData.latitude,
                  longitude: formData.longitude,
                  ownerId: normalizedOwnerId,
                  status: 'pending',
                };

                await addItemApi.createService(serviceData, metadata.userId || user?.id);
                console.log('✅ ავტოსერვისის განცხადება წარმატებით შეიქმნა');
              } catch (error) {
                console.error('❌ ავტოსერვისის განცხადების შექმნისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების შექმნისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // ავტოსერვისის განახლება (renewal)
            if (paymentData.context === 'service-renewal' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const serviceId = metadata.serviceId;
                
                if (serviceId) {
                  await addItemApi.renewService(serviceId, metadata.userId || user?.id);
                  console.log('✅ ავტოსერვისის განცხადება წარმატებით განახლდა');
                }
              } catch (error) {
                console.error('❌ ავტოსერვისის განცხადების განახლებისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების განახლებისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // VIP-ზე გადაყვანა (service upgrade)
            if (paymentData.context === 'service-upgrade' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const serviceId = metadata.serviceId;
                
                if (serviceId) {
                  await addItemApi.updateService(
                    serviceId,
                    { isFeatured: true },
                    metadata.userId || user?.id
                  );
                  await addItemApi.renewService(serviceId, metadata.userId || user?.id);
                  console.log('✅ ავტოსერვისის განცხადება წარმატებით გადაიყვანა VIP-ზე');
                }
              } catch (error) {
                console.error('❌ ავტოსერვისის განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // ხელოსნის განცხადების შექმნა
            if (paymentData.context === 'mechanic' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const formData = metadata.formData;
                
                if (!formData) {
                  throw new Error('Form data is missing');
                }

                // Normalize phone number
                let normalizedPhone = formData.phone;
                if (normalizedPhone && !normalizedPhone.startsWith('+995') && !normalizedPhone.startsWith('995')) {
                  normalizedPhone = '+995' + normalizedPhone;
                }

                // Normalize ownerId - remove 'usr_' prefix if present
                const rawOwnerId = metadata.userId || user?.id || '';
                const normalizedOwnerId = rawOwnerId.startsWith('usr_') ? rawOwnerId.replace('usr_', '') : rawOwnerId;

                // Split name into firstName and lastName for backend compatibility
                const nameParts = formData.name.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || 'მექანიკოსი';

                // Create mechanic
                const mechanicData = {
                  firstName: firstName,
                  lastName: lastName,
                  name: formData.name,
                  specialty: formData.specialty,
                  location: formData.location,
                  phone: normalizedPhone,
                  address: formData.address,
                  experience: formData.experience,
                  services: formData.services ? formData.services.split(',').map((s: string) => s.trim()) : [],
                  avatar: formData.images && formData.images.length > 0 ? formData.images[0] : '',
                  description: formData.description,
                  isAvailable: true,
                  latitude: formData.latitude,
                  longitude: formData.longitude,
                  ownerId: normalizedOwnerId,
                  status: 'pending',
                };

                // Upload avatar if exists
                if (formData.images && formData.images.length > 0) {
                  const uploadedImages = await photoService.processPhotosForSaving(formData.images, 'carappx');
                  if (uploadedImages.length > 0) {
                    mechanicData.avatar = uploadedImages[0];
                  }
                }

                const response = await fetch(`${API_BASE_URL}/mechanics`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': metadata.userId || user?.id || '',
                  },
                  body: JSON.stringify(mechanicData),
                });

                if (!response.ok) {
                  throw new Error('Failed to create mechanic');
                }

                console.log('✅ ხელოსნის განცხადება წარმატებით შეიქმნა');
              } catch (error) {
                console.error('❌ ხელოსნის განცხადების შექმნისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების შექმნისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // ხელოსნის განახლება (renewal)
            if (paymentData.context === 'mechanic-renewal' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const mechanicId = metadata.mechanicId;
                
                if (mechanicId) {
                  await addItemApi.renewMechanic(mechanicId, metadata.userId || user?.id);
                  console.log('✅ ხელოსნის განცხადება წარმატებით განახლდა');
                }
              } catch (error) {
                console.error('❌ ხელოსნის განცხადების განახლებისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების განახლებისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            // VIP-ზე გადაყვანა (mechanic upgrade)
            if (paymentData.context === 'mechanic-upgrade' && paymentData.metadata) {
              try {
                const metadata = paymentData.metadata;
                const mechanicId = metadata.mechanicId;
                
                if (mechanicId) {
                  await addItemApi.updateMechanic(
                    mechanicId,
                    { isFeatured: true },
                    metadata.userId || user?.id
                  );
                  await addItemApi.renewMechanic(mechanicId, metadata.userId || user?.id);
                  console.log('✅ ხელოსნის განცხადება წარმატებით გადაიყვანა VIP-ზე');
                }
              } catch (error) {
                console.error('❌ ხელოსნის განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა:', error);
                Alert.alert('შეცდომა', 'განცხადების VIP-ზე გადაყვანისას მოხდა შეცდომა. გთხოვთ დაუკავშირდეთ მხარდაჭერას.');
              }
            }

            if (paymentData.context === 'carwash' && paymentData.metadata) {
              // Carwash-ისთვის modal-ი რჩება ღილაკის დაჭერამდე
            } else if (paymentData.context === 'dismantler-renewal' || paymentData.context === 'dismantler-upgrade') {
              // განახლების ან VIP-ზე გადაყვანის შემდეგ დაბრუნება მართვის გვერდზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/dismantler-management' as any);
              }, 3000);
            } else if (paymentData.context === 'store') {
              // მაღაზიის შექმნის შემდეგ დაბრუნება stores გვერდზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/stores' as any);
              }, 3000);
            } else if (paymentData.context === 'store-renewal' || paymentData.context === 'store-upgrade') {
              // მაღაზიის განახლების ან VIP-ზე გადაყვანის შემდეგ დაბრუნება მართვის გვერდზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/store-management' as any);
              }, 3000);
            } else if (paymentData.context === 'service-renewal' || paymentData.context === 'service-upgrade') {
              // ავტოსერვისის განახლების ან VIP-ზე გადაყვანის შემდეგ დაბრუნება მართვის გვერდზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/service-management' as any);
              }, 3000);
            } else if (paymentData.context === 'mechanic-renewal' || paymentData.context === 'mechanic-upgrade') {
              // ხელოსნის განახლების ან VIP-ზე გადაყვანის შემდეგ დაბრუნება მართვის გვერდზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/mechanic-management' as any);
              }, 3000);
            } else if (paymentData.context === 'service') {
              // ავტოსერვისის შექმნის შემდეგ დაბრუნება services გვერდზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/(tabs)/services' as any);
              }, 3000);
            } else if (paymentData.context === 'mechanic') {
              // ხელოსნის შექმნის შემდეგ დაბრუნება mechanics გვერდზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/mechanics' as any);
              }, 3000);
            } else if (paymentData.context === 'dismantler') {
              // დაშლილებისთვის 3 წამის შემდეგ გადავიდეთ /parts-ზე
              setTimeout(() => {
                setShowSuccessModal(false);
                router.replace('/parts' as any);
              }, 3000);
            } else {
              setTimeout(() => {
                setShowSuccessModal(false);
                if (paymentData.isSubscription) {
                  // Subscription-ის შემთხვევაში refresh-ის შემდეგ მთავარ გვერდზე გადავიდეთ
                  router.replace('/(tabs)');
                } else {
                  router.back();
                }
              }, 3000);
            }
          }}
          onError={(error) => {
            console.error('❌ BOG გადახდის შეცდომა:', error);
            // Modal-ი უკვე დაიხურა BOGPaymentModal-ში
            // setTimeout-ით დავამატოთ, რომ Alert-ი გამოჩნდეს modal-ის დახურვის შემდეგ
            setTimeout(() => {
              Alert.alert('შეცდომა', 'გადახდა ვერ განხორციელდა. გთხოვთ სცადოთ ხელახლა.', [
                {
                  text: 'კარგი',
                  onPress: () => {
                    // დაბრუნება წინა გვერდზე
                    if (paymentData.context === 'dismantler') {
                      // დაშლილების განცხადების შემთხვევაში დავბრუნდეთ AddModal-ზე
                      router.back();
                    } else {
                      router.back();
                    }
                  }
                }
              ]);
            }, 500);
          }}
        />

        {/* Success Modal */}
        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.successModalOverlay}>
            <View style={styles.successModal}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
              </View>
              <Text style={styles.successTitle}>გადახდა წარმატებულია!</Text>
              <Text style={styles.successMessage}>
                თქვენი გადახდა {paymentData.amount} {paymentData.currency} წარმატებით
                განხორციელდა.
              </Text>
              {paymentData.context === 'carwash' && paymentData.metadata ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={async () => {
                    try {
                      const bookingData = {
                        userId: user?.id || '',
                        locationId: paymentData.metadata?.locationId || '',
                        locationName: paymentData.metadata?.locationName || '',
                        locationAddress: paymentData.metadata?.locationName || '',
                        serviceId: paymentData.metadata?.serviceId || '',
                        serviceName: paymentData.metadata?.serviceName || '',
                        servicePrice: paymentData.amount,
                        bookingDate: new Date(
                          paymentData.metadata?.selectedDate || Date.now()
                        ).getTime(),
                        bookingTime: paymentData.metadata?.selectedTime || '',
                        carInfo: {
                          make: 'Toyota',
                          model: 'Camry',
                          year: '2020',
                          licensePlate: 'TB-123-AB',
                          color: 'შავი',
                        },
                        customerInfo: {
                          name: user?.name || 'მომხმარებელი',
                          phone: user?.phone || '',
                          email: user?.email || '',
                        },
                      };
                      await carwashApi.createBooking(bookingData);
                      setShowSuccessModal(false);
                      router.back();
                    } catch (error) {
                      Alert.alert('შეცდომა', 'ჯავშნის შექმნისას მოხდა შეცდომა');
                    }
                  }}
                >
                  <Text style={styles.successButtonText}>დადასტურება</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'dismantler-renewal' || paymentData.context === 'dismantler-upgrade' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/dismantler-management' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'store' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/stores' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'store-renewal' || paymentData.context === 'store-upgrade' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/store-management' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'service-renewal' || paymentData.context === 'service-upgrade' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/service-management' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'service' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/(tabs)/services' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'mechanic-renewal' || paymentData.context === 'mechanic-upgrade' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/mechanic-management' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'mechanic' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/mechanics' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : paymentData.context === 'dismantler' ? (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.replace('/parts' as any);
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => {
                    setShowSuccessModal(false);
                    // Subscription payment-ის შემთხვევაში მთავარ გვერდზე გადავიდეთ
                    if (paymentData.isSubscription) {
                      router.replace('/(tabs)');
                    } else {
                      router.back();
                    }
                  }}
                >
                  <Text style={styles.successButtonText}>კარგი</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0B1220',
    fontFamily: 'System',
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  progressText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
    fontFamily: 'System',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  paymentDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 16,
  },
  paymentDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0B1220',
    fontFamily: 'System',
  },
  detailsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'System',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    color: '#0B1220',
    fontWeight: '600',
    fontFamily: 'System',
    flex: 1,
    textAlign: 'right',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  amountLabel: {
    fontSize: 15,
    color: '#0B1220',
    fontWeight: '600',
    fontFamily: 'System',
  },
  amountValue: {
    fontSize: 20,
    color: '#6366F1',
    fontWeight: '700',
    fontFamily: 'System',
  },
  cardLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  cardLoadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontFamily: 'System',
  },
  savedCardContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0B1220',
    marginBottom: 12,
    fontFamily: 'System',
  },
  cardPreview: {
    backgroundColor: '#F5F5DC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0B1220',
    fontFamily: 'System',
  },
  visaLogo: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1A1F71',
    borderRadius: 4,
  },
  visaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'System',
  },
  mastercardLogo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle1: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EB001B',
  },
  mcCircle2: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F79E1B',
    marginLeft: -12,
  },
  cardNumberContainer: {
    marginBottom: 12,
  },
  cardNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1220',
    letterSpacing: 2,
    fontFamily: 'System',
  },
  cardExpiryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardExpiryLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'System',
  },
  cardExpiryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1220',
    fontFamily: 'System',
  },
  paymentButtonContainer: {
    marginTop: 8,
  },
  paymentButton: {
    backgroundColor: '#0B1220',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paymentButtonDisabled: {
    opacity: 0.5,
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  securityText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
    fontFamily: 'System',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0B1220',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
  successMessage: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    fontFamily: 'System',
  },
  successButton: {
    backgroundColor: '#0B1220',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
});
