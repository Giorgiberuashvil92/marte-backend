import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions, Animated, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import API_BASE_URL from '../config/api';

const { width } = Dimensions.get('window');

export default function AllServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'carwash' | 'mechanic' | 'store'>('all');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAllServices();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [filter]);

  const fetchAllServices = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      // Fetch only popular services (same as slider)
      const response = await fetch(`${API_BASE_URL}/services/popular?limit=50`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Backend returns array directly
        const formattedServices = (Array.isArray(data) ? data : []).map((service: any) => ({
          id: service.id || service._id,
          name: service.title || service.name,
          location: service.location || 'თბილისი',
          rating: service.rating || 4.5,
          price: typeof service.price === 'string' ? service.price : `${service.price || 25}₾`,
          image: service.images?.[0] || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=400',
          category: service.category || service.type,
          address: service.location || 'თბილისი',
          phone: service.phone || 'N/A',
          isOpen: service.isOpen !== undefined ? service.isOpen : true,
          reviews: service.reviews || 0,
          type: service.type,
          description: service.description || '',
          distance: `${(Math.random() * 5 + 0.5).toFixed(1)} კმ`,
          waitTime: `${Math.floor(Math.random() * 30) + 5} წთ`,
        }));
        
        setServices(formattedServices);
      } else {
        console.error('Failed to fetch services');
        setServices([]);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };


  const onRefresh = () => {
    setRefreshing(true);
    fetchAllServices(true);
  };

  const handleServicePress = (service: any) => {
    router.push({
      pathname: '/details',
      params: {
        id: service.id,
        title: service.name,
        type: service.type,
        image: service.image,
        rating: service.rating,
        reviews: service.reviews,
        distance: service.distance,
        price: service.price,
        address: service.address,
        phone: service.phone,
        category: service.category,
        isOpen: service.isOpen.toString(),
        waitTime: service.waitTime,
        description: service.description,
      },
    } as any);
  };

  const filteredServices = filter === 'all' ? services : services.filter(s => s.type === filter);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>იტვირთება...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <LinearGradient colors={['#F8FAFC', '#FFFFFF']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <View style={styles.backButtonView}>
                <Ionicons name="arrow-back" size={22} color="#111827" />
              </View>
            </TouchableOpacity>
            
            <Text style={styles.headerText}>პოპულარული სერვისები</Text>
            
            <TouchableOpacity style={styles.headerButton}>
              <View style={styles.backButtonView}>
                <Ionicons name="search" size={20} color="#111827" />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {[
            { key: 'all', label: 'ყველა', icon: 'apps' },
            { key: 'carwash', label: 'სამრეცხაო', icon: 'water' },
            { key: 'mechanic', label: 'სერვისი', icon: 'construct' },
            { key: 'store', label: 'მაღაზია', icon: 'storefront' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
              onPress={() => setFilter(item.key as any)}
            >
              <View style={styles.filterView}>
                <Ionicons name={item.icon as any} size={16} color={filter === item.key ? '#3B82F6' : '#6B7280'} />
                <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Services List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.servicesList, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {filteredServices.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={60} color="#9CA3AF" />
              <Text style={styles.emptyText}>სერვისები არ მოიძებნა</Text>
              <Text style={styles.emptySubtext}>სცადეთ სხვა ფილტრი</Text>
            </View>
          ) : (
            filteredServices.map((service, index) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() => handleServicePress(service)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FFFFFF', '#F8FAFC']}
                style={styles.serviceCardGradient}
              >
                {/* Image Section */}
                <View style={styles.serviceImageContainer}>
                  <Image
                    source={{ uri: service.image }}
                    style={styles.serviceImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.serviceImageOverlay}
                  />
                  
                  {/* Badges */}
                  <View style={styles.serviceBadges}>
                    {service.isOpen && (
                      <View style={styles.openBadge}>
                        <View style={styles.openDot} />
                        <Text style={styles.openText}>ღიაა</Text>
                      </View>
                    )}
                    <View style={styles.typeBadge}>
                      <Ionicons 
                        name={service.type === 'carwash' ? 'water' : service.type === 'mechanic' ? 'construct' : 'storefront'} 
                        size={12} 
                        color="#FFFFFF" 
                      />
                    </View>
                  </View>

                  {/* Rating Badge */}
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingBadgeText}>{service.rating}</Text>
                  </View>
                </View>

                {/* Content Section */}
                <View style={styles.serviceCardContent}>
                  <View style={styles.serviceCardHeader}>
                    <Text style={styles.serviceName} numberOfLines={2}>{service.name}</Text>
                    <Text style={styles.priceText}>{service.price}</Text>
                  </View>
                  
                  <View style={styles.serviceCardMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="location" size={14} color="#6366F1" />
                      <Text style={styles.metaText} numberOfLines={1}>{service.location}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time" size={14} color="#6366F1" />
                      <Text style={styles.metaText}>{service.waitTime}</Text>
                    </View>
                  </View>

                  <View style={styles.serviceCardFooter}>
                    <View style={styles.reviewsBox}>
                      <Text style={styles.reviewsText}>{service.reviews} მიმოხილვა</Text>
                    </View>
                    <View style={styles.distanceBox}>
                      <Ionicons name="navigate" size={12} color="#8B5CF6" />
                      <Text style={styles.distanceText}>{service.distance}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280', fontFamily: 'NotoSansGeorgian-Regular' },
  
  // Header
  header: { 
    paddingBottom: 20, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22 },
  backButtonView: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    borderRadius: 22,
  },
  headerText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', fontFamily: 'NotoSansGeorgian-Bold' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerSubtext: { fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'NotoSansGeorgian-Regular', marginTop: 2 },
  headerButton: { width: 44, height: 44, borderRadius: 22 },
  
  // Filters
  filtersContainer: { paddingVertical: 16, backgroundColor: '#F8FAFC' },
  filters: { paddingHorizontal: 20, gap: 10 },
  filterButton: { 
    borderRadius: 16, 
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  filterButtonActive: { 
    backgroundColor: '#EEF2FF', 
    borderWidth: 2, 
    borderColor: '#3B82F6',
    shadowOpacity: 0.15,
  },
  filterView: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 16, 
    paddingVertical: 10,
  },
  filterText: { fontSize: 14, color: '#6B7280', fontFamily: 'NotoSansGeorgian-Medium' },
  filterTextActive: { color: '#3B82F6', fontFamily: 'NotoSansGeorgian-Bold' },
  
  // Services
  scrollView: { flex: 1, backgroundColor: '#F1F5F9' },
  servicesList: { padding: 16, gap: 16 },
  serviceCard: { 
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  serviceCardGradient: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  serviceImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  serviceBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  openBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: 'rgba(16, 185, 129, 0.95)', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 20, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  openText: { fontSize: 11, color: '#FFFFFF', fontFamily: 'NotoSansGeorgian-Bold', fontWeight: '700' },
  typeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'NotoSansGeorgian-Bold',
  },
  serviceCardContent: {
    padding: 16,
    gap: 12,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  serviceName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#111827', 
    fontFamily: 'NotoSansGeorgian-Bold', 
    flex: 1,
    lineHeight: 24,
  },
  priceText: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#6366F1', 
    fontFamily: 'NotoSansGeorgian-Bold' 
  },
  serviceCardMeta: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  metaItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    flex: 1,
    minWidth: '45%',
  },
  metaText: { 
    fontSize: 13, 
    color: '#475569', 
    fontFamily: 'NotoSansGeorgian-Medium',
    flex: 1,
  },
  serviceCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  reviewsBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewsText: { 
    fontSize: 12, 
    color: '#64748B', 
    fontFamily: 'NotoSansGeorgian-Regular' 
  },
  distanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontFamily: 'NotoSansGeorgian-Medium',
    fontWeight: '600',
  },
  
  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#111827', fontFamily: 'NotoSansGeorgian-Bold' },
  emptySubtext: { fontSize: 14, color: '#6B7280', fontFamily: 'NotoSansGeorgian-Regular' },
});
