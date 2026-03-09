import React, { useEffect, useMemo, useState } from 'react';
import { Linking, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import DetailView, { DetailViewProps } from '@/components/DetailView';
import API_BASE_URL from '@/config/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyticsService } from '@/services/analytics';
import { useUser } from '@/contexts/UserContext';
import { engagementApi } from '@/services/engagementApi';

export default function DetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useUser();

  const serviceType = (params.type as string) || 'carwash';
  const title = (params.title as string) || 'სერვისი';
  const cover = (params.image as string) || undefined;
  const addressParam = (params.address as string) || '';
  const distance = (params.distance as string) || '';
  const eta = (params.waitTime as string) || '';
  const phoneParam = (params.phone as string) || '';
  const requestId = (params.requestId as string) || (params.id as string) || '';
  const itemId = (params.id as string) || requestId;

  const [loading, setLoading] = useState<boolean>(false);
  const [detail, setDetail] = useState<any | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      analyticsService.logScreenViewWithBackend('დეტალები', 'DetailsScreen', user?.id);
      if (itemId) {
        analyticsService.logSalesItemView(itemId, title, serviceType, 'დეტალები', user?.id);
      }
    }, [itemId, serviceType, title, user?.id])
  );

  useEffect(() => {
    const load = async () => {
      const id = (params.id as string) || requestId;
      if (!id) { 
        // თუ id არ არის, გამოვიყენოთ params პირდაპირ
        setLoading(false);
        return;
      }
      
      // Track dismantler view
      if (serviceType === 'dismantler' && user?.id && id) {
        console.log('👁️ [DETAILS] Tracking view for dismantler:', id, 'user:', user.id);
        engagementApi.trackDismantlerView(id, user.id).catch((err) => {
          console.error('❌ [DETAILS] Error tracking dismantler view:', err);
        });
      }
      
      // სცადოთ API-დან ჩატვირთვა მხოლოდ carwash-ისთვის
      if (serviceType === 'carwash') {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/carwash/locations/${encodeURIComponent(id)}?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          const json = await res.json();
          setDetail(json?.data || json);
        } catch (e) {
          setDetail(null);
        } finally {
          setLoading(false);
        }
      } else {
        // სხვა ტიპებისთვის params-ს ვიყენებთ პირდაპირ
        setLoading(false);
      }
    };
    load();
  }, [params.id, requestId, serviceType, user?.id]);

  const mapped: DetailViewProps | null = useMemo(() => {
    const d = detail || {};
    const phone = (d?.phone || phoneParam || '').trim();
    const addr = d?.address || addressParam || '';
    const basePrice = typeof d?.price === 'number' 
      ? `₾${d.price}` 
      : (params.price as string) || undefined;
    
    // სერვისები API-დან ან params-დან
    const servicesFromApi = d?.detailedServices || [];
    const services = servicesFromApi.length > 0
      ? servicesFromApi.map((s: any) => ({
          name: s.name || s.title || '',
          price: s.price ? `₾${s.price}` : undefined,
          duration: s.duration ? `${s.duration} წთ` : undefined,
        }))
      : [];
    
    // packages synthesis from top services if packages are not provided
    const packages = services.length > 0
      ? services.slice(0, 2).map((s: any, i: number) => ({
          name: i === 0 ? 'Basic' : 'Premium',
          price: s.price || '₾0',
          includes: [s.name],
          highlight: i === 1,
        }))
      : [];

    const coverImage = d?.images?.[0] || cover;

    // Features დინამიურად სერვისის ტიპის მიხედვით
    const getFeatures = () => {
      const baseFeatures = [
        { icon: 'card', label: 'ბარათით გადახდა' },
      ];
      
      if (serviceType === 'carwash') {
        return [
          { icon: 'wifi', label: 'WiFi' },
          { icon: 'car', label: 'პარკინგი' },
          ...baseFeatures,
        ];
      } else if (serviceType === 'store') {
        return [
          { icon: 'storefront', label: 'მაღაზია' },
          ...baseFeatures,
        ];
      } else if (serviceType === 'dismantler') {
        return [
          { icon: 'build', label: 'დაშლილი მანქანები' },
          ...baseFeatures,
        ];
      }
      
      return baseFeatures;
    };

    const props: DetailViewProps = {
      id: d?.id || requestId,
      title: d?.name || d?.title || title,
      coverImage,
      serviceType: serviceType,
      rating: { 
        value: Number(d?.rating || params.rating || 4.9), 
        count: Number(d?.reviews || params.reviews || 0) 
      },
      distance: distance || undefined,
      eta: eta || undefined,
      price: basePrice ? { from: basePrice } : undefined,
      vendor: { phone, location: { address: addr } },
      sections: {
        description: d?.description || (params.description as string) || '',
        services: services.length > 0 ? services : undefined,
        packages: packages.length > 0 ? packages : undefined,
        features: getFeatures(),
      },
      actions: {
        onBook: () => {
          const currentId = d?.id || requestId || itemId;
          analyticsService.logButtonClick('დაჯავშნა', 'დეტალები', {
            item_id: currentId,
            item_type: serviceType,
          }, user?.id);

          // მხოლოდ carwash-ისთვის გადავიდეთ booking-ზე
          if (serviceType === 'carwash') {
            const loc = {
              id: d?.id || requestId,
              name: d?.name || d?.title || title,
              address: d?.address || addr,
              image: coverImage,
              category: d?.category || 'Carwash',
              isOpen: Boolean(d?.isOpen ?? params.isOpen === 'true'),
              rating: Number(d?.rating || params.rating || 0),
              reviews: Number(d?.reviews || params.reviews || 0),
              distance: distance || '',
            };
            const ds = d?.detailedServices || [];
            const tsc = d?.timeSlotsConfig || null;

            router.push({
              pathname: '/booking',
              params: {
                location: JSON.stringify(loc),
                locationDetailedServices: JSON.stringify(ds),
                locationTimeSlotsConfig: JSON.stringify(tsc),
              },
            });
          } else {
            // სხვა ტიპებისთვის უბრალოდ დარეკვა
            if (phone) {
              analyticsService.logButtonClick('დარეკვა', 'დეტალები', {
                item_id: currentId,
                item_type: serviceType,
                source_action: 'onBook_fallback',
              }, user?.id);
              analyticsService.logCallInitiated(phone, serviceType);
              Linking.openURL(`tel:${phone}`);
            }
          }
        },
        onCall: () => { 
          const currentId = d?.id || requestId || itemId;
          if (phone) {
            analyticsService.logButtonClick('დარეკვა', 'დეტალები', {
              item_id: currentId,
              item_type: serviceType,
            }, user?.id);
            analyticsService.logCallInitiated(phone, serviceType);
            // Track dismantler call
            if (serviceType === 'dismantler' && user?.id && (d?.id || requestId)) {
              const dismantlerId = d?.id || requestId;
              console.log('📞 [DETAILS] Tracking call for dismantler:', dismantlerId, 'user:', user.id);
              engagementApi.trackDismantlerCall(dismantlerId, user.id).catch((err) => {
                console.error('❌ [DETAILS] Error tracking dismantler call:', err);
              });
            }
            Linking.openURL(`tel:${phone}`);
          }
        },
        onFinance: (amount) => {
          const currentId = d?.id || requestId || itemId;
          const fallback = basePrice ? parseInt(String(basePrice).replace(/[^0-9]/g, '')) : 0;
          const a = amount || fallback || 0;
          analyticsService.logButtonClick('ფინანსირება', 'დეტალები', {
            item_id: currentId,
            item_type: serviceType,
            amount: a,
          }, user?.id);
          router.push(`/financing-request?requestId=${encodeURIComponent(d?.id || requestId)}&amount=${encodeURIComponent(String(a))}`);
        },
        onShare: () => {},
      },
      flags: { 
        stickyCTA: true, 
        showFinance: serviceType === 'carwash' || serviceType === 'store' 
      },
    };
    return props;
  }, [detail, cover, title, addressParam, distance, eta, phoneParam, requestId, params.description, params.rating, params.price]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>იტვირთება...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!mapped) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>სერვისის დეტალები ვერ მოიძებნა</Text>
            <Text style={styles.errorSubtext}>გთხოვთ სცადოთ მოგვიანებით</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DetailView {...mapped} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});


