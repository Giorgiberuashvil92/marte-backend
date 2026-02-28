import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { requestsApi, type Request, type Offer } from '@/services/requestsApi';

const { width } = Dimensions.get('window');

type PartnerType = 'store' | 'mechanic' | 'tow' | 'rental';

interface PartnerStats {
  totalRequests: number;
  myOffers: number;
  acceptedOffers: number;
  pendingOffers: number;
  earnings: number;
}

interface CreateOfferData {
  priceGEL: number;
  etaMin: number;
  description: string;
}

export default function PartnerDashboardScreen() {
  const { partnerType } = useLocalSearchParams<{ partnerType: PartnerType }>();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [stats, setStats] = useState<PartnerStats>({
    totalRequests: 0,
    myOffers: 0,
    acceptedOffers: 0,
    pendingOffers: 0,
    earnings: 0,
  });

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerData, setOfferData] = useState<CreateOfferData>({
    priceGEL: 0,
    etaMin: 0,
    description: '',
  });
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  const partnerId = 'demo-partner-123'; // In real app, this would come from auth

  useEffect(() => {
    fetchData();
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [partnerType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all requests (in real app, this would be filtered by location/service type)
      const allRequests = await requestsApi.getRequests();
      
      // Filter requests by partner type
      const relevantRequests = allRequests.filter(request => {
        switch (partnerType) {
          case 'store':
            return request.partName && request.vehicle;
          case 'mechanic':
            return request.description?.toLowerCase().includes('ძრავი') || 
                   request.description?.toLowerCase().includes('მანქანა');
          case 'tow':
            return request.description?.toLowerCase().includes('ევაკუატორი') ||
                   request.description?.toLowerCase().includes('გატეხა');
          case 'rental':
            return request.partName?.toLowerCase().includes('ქირაობა') ||
                   request.partName?.toLowerCase().includes('rental');
          default:
            return true;
        }
      });

      // Fetch my offers
      const offers = await requestsApi.getOffers(undefined, undefined, partnerId);
      
      setRequests(relevantRequests);
      setMyOffers(offers);
      
      // Calculate stats
      const acceptedOffers = offers.filter(o => o.status === 'accepted');
      const pendingOffers = offers.filter(o => o.status === 'pending');
      const earnings = acceptedOffers.reduce((sum, offer) => sum + offer.priceGEL, 0);
      
      setStats({
        totalRequests: relevantRequests.length,
        myOffers: offers.length,
        acceptedOffers: acceptedOffers.length,
        pendingOffers: pendingOffers.length,
        earnings: earnings,
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // თუ API ვერ მუშაობს, ცარიელ მონაცემებს ვაბრუნებთ
      setRequests([]);
      setMyOffers([]);
    } finally {
      setLoading(false);
    }
  };
  // Helper: fast lookup which requests already have my offer
  const offeredRequestIds = new Set(myOffers.filter(o => o.partnerId === partnerId).map(o => o.reqId));



  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getServiceIcon = (service: string) => {
    // Determine icon based on partName or service type
    const serviceLower = service.toLowerCase();
    
    if (serviceLower.includes('ბრეიკ') || serviceLower.includes('ლამპ') || 
        serviceLower.includes('ფარ') || serviceLower.includes('ძრავ') ||
        serviceLower.includes('ჰაერ') || serviceLower.includes('ფილტრ')) {
      return 'construct-outline';
    } else if (serviceLower.includes('შემოწმებ') || serviceLower.includes('რემონტ') || 
               serviceLower.includes('დიაგნოსტ')) {
      return 'build-outline';
    } else if (serviceLower.includes('ევაკუაცია') || serviceLower.includes('ევაკუატორ')) {
      return 'car-outline';
    } else if (serviceLower.includes('ქირაობა') || serviceLower.includes('rental')) {
      return 'car-sport-outline';
    }
    
    // Default based on service type
    switch (service) {
      case 'parts':
        return 'construct-outline';
      case 'mechanic':
        return 'build-outline';
      case 'tow':
        return 'car-outline';
      case 'rental':
        return 'car-sport-outline';
      default:
        return 'construct-outline';
    }
  };

  const getServiceColor = (service: string) => {
    // Determine color based on partName or service type
    const serviceLower = service.toLowerCase();
    
    if (serviceLower.includes('ბრეიკ') || serviceLower.includes('ლამპ') || 
        serviceLower.includes('ფარ') || serviceLower.includes('ძრავ') ||
        serviceLower.includes('ჰაერ') || serviceLower.includes('ფილტრ')) {
      return '#10B981'; // Green for parts
    } else if (serviceLower.includes('შემოწმებ') || serviceLower.includes('რემონტ') || 
               serviceLower.includes('დიაგნოსტ')) {
      return '#3B82F6'; // Blue for mechanic
    } else if (serviceLower.includes('ევაკუაცია') || serviceLower.includes('ევაკუატორ')) {
      return '#F59E0B'; // Orange for tow
    } else if (serviceLower.includes('ქირაობა') || serviceLower.includes('rental')) {
      return '#8B5CF6'; // Purple for rental
    }
    
    // Default based on service type
    switch (service) {
      case 'parts':
        return '#10B981';
      case 'mechanic':
        return '#3B82F6';
      case 'tow':
        return '#F59E0B';
      case 'rental':
        return '#8B5CF6';
      default:
        return '#6366F1';
    }
  };

  const getServiceGradient = (service: string) => {
    // Determine gradient based on partName or service type
    const serviceLower = service.toLowerCase();
    
    if (serviceLower.includes('ბრეიკ') || serviceLower.includes('ლამპ') || 
        serviceLower.includes('ფარ') || serviceLower.includes('ძრავ') ||
        serviceLower.includes('ჰაერ') || serviceLower.includes('ფილტრ')) {
      return ['#10B981', '#059669']; // Green gradient for parts
    } else if (serviceLower.includes('შემოწმებ') || serviceLower.includes('რემონტ') || 
               serviceLower.includes('დიაგნოსტ')) {
      return ['#3B82F6', '#1D4ED8']; // Blue gradient for mechanic
    } else if (serviceLower.includes('ევაკუაცია') || serviceLower.includes('ევაკუატორ')) {
      return ['#F59E0B', '#D97706']; // Orange gradient for tow
    } else if (serviceLower.includes('ქირაობა') || serviceLower.includes('rental')) {
      return ['#8B5CF6', '#7C3AED']; // Purple gradient for rental
    }
    
    // Default based on service type
    switch (service) {
      case 'parts':
        return ['#10B981', '#059669'];
      case 'mechanic':
        return ['#3B82F6', '#1D4ED8'];
      case 'tow':
        return ['#F59E0B', '#D97706'];
      case 'rental':
        return ['#8B5CF6', '#7C3AED'];
      default:
        return ['#6366F1', '#4F46E5'];
    }
  };

  // Modal functions
  const handleRequestPress = (request: Request) => {
    setSelectedRequest(request);
    setShowRequestModal(true);
  };

  const handleCreateOffer = (request?: Request) => {
    if (request) {
      setSelectedRequest(request);
    }
    setShowRequestModal(false);
    setShowOfferModal(true);
  };

  const handleSubmitOffer = async () => {
    if (!selectedRequest || !offerData.priceGEL || !offerData.etaMin || !offerData.description) {
      Alert.alert('შეცდომა', 'გთხოვთ შეავსოთ ყველა ველი');
      return;
    }

    try {
      const newOffer = {
        reqId: selectedRequest.id,
        providerName: getPartnerName(),
        priceGEL: offerData.priceGEL,
        etaMin: offerData.etaMin,
        partnerId: partnerId,
        userId: selectedRequest.userId,
      };

      await requestsApi.createOffer(newOffer);
      
      Alert.alert('წარმატება', 'შეთავაზება წარმატებით შეიქმნა');
      
      // Reset form and close modal
      setOfferData({ priceGEL: 0, etaMin: 0, description: '' });
      setShowOfferModal(false);
      setSelectedRequest(null);
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error creating offer:', error);
      Alert.alert('შეცდომა', 'შეთავაზების შექმნისას მოხდა შეცდომა');
    }
  };

  const getPartnerName = () => {
    switch (partnerType) {
      case 'store':
        return 'ნაწილების მაღაზია';
      case 'mechanic':
        return 'ხელოსანი';
      case 'tow':
        return 'ევაკუატორი';
      case 'rental':
        return 'მანქანების ქირაობა';
      default:
        return 'პარტნიორი';
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const diffInMinutes = Math.floor(diff / (1000 * 60));
    const diffInHours = Math.floor(diff / (1000 * 60 * 60));
    const diffInDays = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'ახლა';
    if (diffInMinutes < 60) return `${diffInMinutes} წთ წინ`;
    if (diffInHours < 24) return `${diffInHours} სთ წინ`;
    if (diffInDays < 7) return `${diffInDays} დღე წინ`;
    return `${Math.floor(diffInDays / 7)} კვირა წინ`;
  };


  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return '#6366F1';
    }
  };

  const getUrgency = (request: Request): string => {
    // Determine urgency based on time since request was created
    const now = Date.now();
    const diffInHours = (now - request.createdAt) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'high';
    if (diffInHours < 24) return 'medium';
    return 'low';
  };




  const getPartnerTitle = (): string => {
    switch (partnerType) {
      case 'store':
        return 'ნაწილების მაღაზია';
      case 'mechanic':
        return 'ხელოსანი';
      case 'tow':
        return 'ევაკუატორი';
      case 'rental':
        return 'ქირაობის სერვისი';
      default:
        return 'პარტნიორი';
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.heroGradient}
              >
                <View style={styles.heroContent}>
                  <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                  >
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                  </Pressable>
                  
                  <Text style={styles.heroTitle}>{getPartnerTitle()}</Text>
                  <Text style={styles.heroSubtitle}>
                    პარტნიორის დეშბორდი
                  </Text>
                  <View style={styles.heroIconContainer}>
                    <Ionicons name={getServiceIcon(partnerType || 'store') as any} size={24} color="#6366F1" />
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsSection}>
              <Text style={styles.sectionTitle}>სწრაფი მოქმედებები</Text>
              <View style={styles.quickActionsGrid}>
                <Pressable
                  style={styles.quickActionCard}
                  onPress={() => router.push(`/partner-chats?partnerType=${partnerType}` as any)}
                >
                  <LinearGradient
                    colors={['rgba(99, 102, 241, 0.2)', 'rgba(79, 70, 229, 0.2)']}
                    style={styles.quickActionGradient}
                  >
                    <View style={styles.quickActionContent}>
                      <View style={styles.quickActionIcon}>
                        <Ionicons name="chatbubbles" size={20} color="#6366F1" />
                      </View>
                      <Text style={styles.quickActionText}>ჩატები</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
                
                <Pressable
                  style={styles.quickActionCard}
                  onPress={() => router.push('/all-requests')}
                >
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)']}
                    style={styles.quickActionGradient}
                  >
                    <View style={styles.quickActionContent}>
                      <View style={styles.quickActionIcon}>
                        <Ionicons name="document-text" size={20} color="#10B981" />
                      </View>
                      <Text style={styles.quickActionText}>მოთხოვნები</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>

            {/* Stats Section */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>სტატისტიკა</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
                    style={styles.statGradient}
                  >
                    <Text style={styles.statNumber}>{stats.totalRequests}</Text>
                    <Text style={styles.statLabel}>მოთხოვნები</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.2)', 'rgba(29, 78, 216, 0.2)']}
                    style={styles.statGradient}
                  >
                    <Text style={styles.statNumber}>{stats.myOffers}</Text>
                    <Text style={styles.statLabel}>შეთავაზებები</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.2)', 'rgba(5, 150, 105, 0.2)']}
                    style={styles.statGradient}
                  >
                    <Text style={styles.statNumber}>{stats.acceptedOffers}</Text>
                    <Text style={styles.statLabel}>მიღებული</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={['rgba(245, 158, 11, 0.2)', 'rgba(217, 119, 6, 0.2)']}
                    style={styles.statGradient}
                  >
                    <Text style={styles.statNumber}>{stats.earnings}₾</Text>
                    <Text style={styles.statLabel}>შემოსავალი</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            {/* Requests Section */}
            <View style={styles.requestsSection}>
              <Text style={styles.sectionTitle}>ახალი მოთხოვნები</Text>
              <ScrollView 
                style={styles.requestsContainer}
                contentContainerStyle={styles.requestsContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#6366F1"
                    colors={['#6366F1']}
                  />
                }
              >
                {requests.map((request, index) => (
                  <Animated.View
                    key={request.id}
                    style={[
                      styles.requestWrapper,
                      {
                        transform: [
                          { 
                            translateY: slideAnim.interpolate({
                              inputRange: [0, 50],
                              outputRange: [0, 50 + (index * 20)],
                              extrapolate: 'clamp',
                            })
                          }
                        ]
                      }
                    ]}
                  >
                    <Pressable
                      style={styles.requestCard}
                      onPress={() => handleRequestPress(request)}
                    >
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                        style={styles.requestGradient}
                      >
                        <View style={styles.requestContent}>
                          {/* Service Icon */}
                          <View style={styles.serviceIconContainer}>
                            <LinearGradient
                              colors={getServiceGradient(request.partName) as [string, string]}
                              style={styles.serviceIcon}
                            >
                              <Ionicons 
                                name={getServiceIcon(request.partName) as any} 
                                size={24} 
                                color="#FFFFFF" 
                              />
                            </LinearGradient>
                          </View>

                          {/* Request Info */}
                          <View style={styles.requestInfo}>
                            <View style={styles.requestHeader}>
                              <Text style={styles.requestTitle}>{request.partName}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {offeredRequestIds.has(request.id) && (
                                  <View style={[styles.urgencyBadge, { backgroundColor: '#10B98120', borderColor: '#10B98155' }]}>
                                    <Text style={[styles.urgencyText, { color: '#10B981' }]}>გაგზავნილია</Text>
                                  </View>
                                )}
                                <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(getUrgency(request)) + '20' }]}>
                                  <Text style={[styles.urgencyText, { color: getUrgencyColor(getUrgency(request)) }]}>
                                    {getUrgency(request) === 'high' ? 'მაღალი' : 
                                     getUrgency(request) === 'medium' ? 'საშუალო' : 'დაბალი'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            
                            <Text style={styles.vehicleInfo}>
                              {request.vehicle.make} {request.vehicle.model} ({request.vehicle.year})
                            </Text>
                            
                            {request.description && (
                              <Text style={styles.requestDescription} numberOfLines={2}>
                                {request.description}
                              </Text>
                            )}
                            
                            <View style={styles.requestFooter}>
                              <View style={styles.timeContainer}>
                                <Ionicons name="time-outline" size={12} color="rgba(255, 255, 255, 0.6)" />
                                <Text style={styles.timeText}>{formatTimeAgo(request.createdAt)}</Text>
                              </View>
                            </View>
                          </View>

                          {/* Action Button */}
                          <Pressable
                            style={styles.offerButton}
                            onPress={() => offeredRequestIds.has(request.id) ? router.push(`/partner-chat/${request.id}?partnerType=${partnerType}` as any) : handleRequestPress(request)}
                          >
                            <LinearGradient
                              colors={offeredRequestIds.has(request.id) ? ['#6B7280', '#4B5563'] : [getServiceColor(request.partName), getServiceColor(request.partName) + 'CC']}
                              style={styles.offerButtonGradient}
                            >
                              <Ionicons name={offeredRequestIds.has(request.id) ? 'chatbubbles' : 'add'} size={16} color="#FFFFFF" />
                              <Text style={styles.offerButtonText}>{offeredRequestIds.has(request.id) ? 'ჩატში გადასვლა' : 'შეთავაზება'}</Text>
                            </LinearGradient>
                          </Pressable>

                          {/* Go To Chat Quick Action */}
                          <Pressable
                            style={[styles.offerButton, { marginLeft: 8 }]}
                            onPress={() => router.push(`/partner-chat/${request.id}?partnerType=${partnerType}` as any)}
                          >
                            <LinearGradient
                              colors={['#6366F1', '#4F46E5']}
                              style={styles.offerButtonGradient}
                            >
                              <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
                              <Text style={styles.offerButtonText}>ჩატი</Text>
                            </LinearGradient>
                          </Pressable>
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                ))}
                
                {requests.length === 0 && (
                  <Animated.View 
                    style={[
                      styles.emptyState,
                      {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }]
                      }
                    ]}
                  >
                    <View style={styles.emptyIconContainer}>
                      <Ionicons name="document-outline" size={48} color="#6366F1" />
                    </View>
                    <Text style={styles.emptyTitle}>მოთხოვნები ჯერ არ არის</Text>
                    <Text style={styles.emptySubtitle}>
                      ახალი მოთხოვნები აქ გამოჩნდება
                    </Text>
                  </Animated.View>
                )}
              </ScrollView>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Request Details Modal */}
        <Modal
          visible={showRequestModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowRequestModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>მოთხოვნის დეტალები</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowRequestModal(false)}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </Pressable>
              </View>

              {selectedRequest && (
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Request Info Card */}
                  <View style={styles.modalCard}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                      style={styles.modalCardGradient}
                    >
                      <View style={styles.modalCardHeader}>
                        <View style={styles.modalServiceIcon}>
                          <Ionicons 
                            name={getServiceIcon(selectedRequest.partName)} 
                            size={20} 
                            color={getServiceColor(selectedRequest.partName)} 
                          />
                        </View>
                        <Text style={styles.modalCardTitle}>{selectedRequest.partName}</Text>
                        <View style={[styles.modalUrgencyBadge, { backgroundColor: getUrgencyColor(getUrgency(selectedRequest)) }]}>
                          <Text style={styles.modalUrgencyText}>
                            {getUrgency(selectedRequest) === 'high' ? 'მაღალი' : 
                             getUrgency(selectedRequest) === 'medium' ? 'საშუალო' : 'დაბალი'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.modalCardBody}>
                        <View style={styles.modalInfoRow}>
                          <Ionicons name="car" size={16} color="rgba(255, 255, 255, 0.7)" />
                          <Text style={styles.modalInfoText}>
                            {selectedRequest.vehicle.make} {selectedRequest.vehicle.model} ({selectedRequest.vehicle.year})
                          </Text>
                        </View>

                        {selectedRequest.location && (
                          <View style={styles.modalInfoRow}>
                            <Ionicons name="location" size={16} color="rgba(255, 255, 255, 0.7)" />
                            <Text style={styles.modalInfoText}>{selectedRequest.location}</Text>
                          </View>
                        )}

                        <View style={styles.modalInfoRow}>
                          <Ionicons name="time" size={16} color="rgba(255, 255, 255, 0.7)" />
                          <Text style={styles.modalInfoText}>
                            {formatTimeAgo(selectedRequest.createdAt)}
                          </Text>
                        </View>

                        <View style={styles.modalDescriptionContainer}>
                          <Text style={styles.modalDescriptionLabel}>აღწერა:</Text>
                          <Text style={styles.modalDescriptionText}>
                            {selectedRequest.description || 'აღწერა არ არის მითითებული'}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Create Offer Button */}
                  <Pressable
                    style={styles.createOfferButton}
                    onPress={() => handleCreateOffer()}
                  >
                    <LinearGradient
                      colors={getServiceGradient(selectedRequest.partName) as [string, string]}
                      style={styles.createOfferGradient}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                      <Text style={styles.createOfferText}>შეთავაზების შექმნა</Text>
                    </LinearGradient>
                  </Pressable>

                  {/* Go To Chat Button */}
                  <Pressable
                    style={styles.createOfferButton}
                    onPress={() => router.push(`/partner-chat/${selectedRequest.id}?partnerType=${partnerType}` as any)}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#4F46E5']}
                      style={styles.createOfferGradient}
                    >
                      <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                      <Text style={styles.createOfferText}>გადასვლა ჩატში</Text>
                    </LinearGradient>
                  </Pressable>
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Create Offer Modal */}
        <Modal
          visible={showOfferModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowOfferModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>შეთავაზების შექმნა</Text>
                <Pressable
                  style={styles.closeButton}
                  onPress={() => setShowOfferModal(false)}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.offerForm}>
                  {/* Price Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>ფასი (₾)</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.textInput}
                        value={offerData.priceGEL.toString()}
                        onChangeText={(text) => setOfferData(prev => ({ ...prev, priceGEL: parseFloat(text) || 0 }))}
                        placeholder="0"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        keyboardType="numeric"
                      />
                      <Text style={styles.inputSuffix}>₾</Text>
                    </View>
                  </View>

                  {/* ETA Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>მიწოდების დრო (წუთი)</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.textInput}
                        value={offerData.etaMin.toString()}
                        onChangeText={(text) => setOfferData(prev => ({ ...prev, etaMin: parseInt(text) || 0 }))}
                        placeholder="0"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        keyboardType="numeric"
                      />
                      <Text style={styles.inputSuffix}>წუთი</Text>
                    </View>
                  </View>

                  {/* Description Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>აღწერა</Text>
                    <View style={styles.textAreaContainer}>
                      <TextInput
                        style={styles.textArea}
                        value={offerData.description}
                        onChangeText={(text) => setOfferData(prev => ({ ...prev, description: text }))}
                        placeholder="შეთავაზების დეტალები..."
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    </View>
                  </View>

                  <Pressable
                    style={styles.submitButton}
                    onPress={handleSubmitOffer}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.submitGradient}
                    >
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      <Text style={styles.submitText}>შეთავაზების გაგზავნა</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 20,
    gap: 32,
  },

  // Hero Section
  heroSection: {
    marginTop: 20,
  },
  heroGradient: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    position: 'relative',
  },
  heroContent: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    fontWeight: '800',
    marginTop: 40,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  heroIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  // Quick Actions Section
  quickActionsSection: {
    gap: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  quickActionGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionContent: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Stats Section
  statsSection: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statCard: {
    width: (width - 56) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Requests Section
  requestsSection: {
    gap: 20,
  },
  requestsContainer: {
    maxHeight: 400,
  },
  requestsContent: {
    gap: 16,
  },
  requestWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  requestCard: {
    flex: 1,
  },
  requestGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  requestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  serviceIconContainer: {
    position: 'relative',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  requestInfo: {
    flex: 1,
    gap: 6,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
  },
  urgencyBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  vehicleInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  requestDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
    lineHeight: 18,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  offerButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  offerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  offerButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalCard: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalCardGradient: {
    padding: 20,
  },
  modalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalServiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalCardTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    flex: 1,
  },
  modalUrgencyBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalUrgencyText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalCardBody: {
    gap: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInfoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  modalDescriptionContainer: {
    marginTop: 8,
  },
  modalDescriptionLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDescriptionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
    lineHeight: 20,
  },
  createOfferButton: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  createOfferGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  createOfferText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Offer Form Styles
  offerForm: {
    marginTop: 20,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  inputSuffix: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  textAreaContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textArea: {
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    minHeight: 100,
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
