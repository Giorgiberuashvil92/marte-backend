import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../../contexts/UserContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { photoService } from '../../services/photoService';
import API_BASE_URL from '../../config/api';
import SubscriptionModal from '../../components/ui/SubscriptionModal';
import PremiumInfoModal from '../../components/ui/PremiumInfoModal';
import { getCurrentAppVersion } from '../../services/versionCheck';

// Mock user data for fallback
const MOCK_USER_DATA = {
  name: 'გიორგი მაისურაძე',
  email: 'giorgi@example.com',
  phone: '+995 599 123 456',
  avatar: null,
  avatarUri: null,
  totalBookings: 24,
  totalSpent: '320₾',
  memberSince: '2023 წლის მარტი',
  rating: 4.8,
  favoriteService: 'Premium Car Wash',
};

const PROFILE_MENU_ITEMS = [
  {
    id: '1',
    title: 'პირადი ინფორმაცია',
    subtitle: 'სახელი, ელ-ფოსტა, ტელეფონი',
    icon: 'person-outline',
    color: '#3B82F6',
  },
  // {
  //   id: 'loyalty',
  //   title: 'ლოიალობის პროგრამა',
  //   subtitle: 'ქულები, ჯილდოები და ფასდაკლებები',
  //   icon: 'star-outline',
  //   color: '#F59E0B',
  // },
  // {
  //   id: 'referral',
  //   title: 'რეფერალური კოდი',
  //   subtitle: 'მოიწვიე მეგობრები და მიიღე ქულები',
  //   icon: 'gift-outline',
  //   color: '#8B5CF6',
  // },
  {
    id: '2',
    title: 'ჩემი მანქანები',
    subtitle: 'დაამატეთ ან შეცვალეთ მანქანები',
    icon: 'car-outline',
    color: '#10B981',
  },
  // {
  //   id: 'analytics',
  //   title: 'ანალიტიკა',
  //   subtitle: 'მომხმარებლის ქცევა და სტატისტიკა',
  //   icon: 'analytics-outline',
  //   color: '#667eea',
  // },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useUser();
  const { subscription } = useSubscription();
  const [pressedButtons, setPressedButtons] = useState<{ [key: string]: boolean }>({});
  const [userAvatar, setUserAvatar] = useState(user?.avatar || MOCK_USER_DATA.avatarUri);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showPremiumInfoModal, setShowPremiumInfoModal] = useState(false);


  const displayName = user?.name || MOCK_USER_DATA.name;
  const displayPhone = user?.phone || MOCK_USER_DATA.phone;
  const displayEmail = user?.email || MOCK_USER_DATA.email;
  const memberSince = MOCK_USER_DATA.memberSince;

  // განვაახლოთ avatar როცა user იცვლება
  useEffect(() => {
    if (user?.avatar) {
      setUserAvatar(user.avatar);
    } else {
      setUserAvatar(null);
    }
  }, [user?.avatar]);

  const handlePhotoUpload = () => {
    if (!user?.id) {
      Alert.alert('შეცდომა', 'მომხმარებელი არ არის ავტორიზებული');
      return;
    }

    photoService.showPhotoPickerOptions(async (result) => {
      if (!result.success || !result.assets || result.assets.length === 0) {
        if (result.error) {
          Alert.alert('შეცდომა', result.error);
        }
        return;
      }

      const imageUri = result.assets[0].uri;
      
      // დროებითად ვაჩვენებთ არჩეულ ფოტოს
      setUserAvatar(imageUri);
      setIsUploadingAvatar(true);

      try {
        // ავტვირთავთ Cloudinary-ზე
        const uploadResult = await photoService.uploadPhoto(imageUri, 'user-avatars');
        
        if (uploadResult.success && uploadResult.url) {
          // განვაახლოთ backend-ზე
          const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profileImage: uploadResult.url,
            }),
          });

          if (!response.ok) {
            throw new Error('Backend-ზე განახლება ვერ მოხერხდა');
          }

          // განვაახლოთ UserContext-ში
          await updateProfile({ avatar: uploadResult.url });
          setUserAvatar(uploadResult.url);
          
          Alert.alert('წარმატება', 'პროფილის ფოტო წარმატებით განახლდა');
        } else {
          throw new Error(uploadResult.error || 'ფოტოს ატვირთვა ვერ მოხერხდა');
        }
      } catch (error) {
        console.error('Avatar upload error:', error);
        // დავაბრუნოთ წინა ფოტო
        setUserAvatar(user?.avatar || null);
        Alert.alert(
          'შეცდომა',
          error instanceof Error ? error.message : 'ფოტოს ატვირთვისას მოხდა შეცდომა'
        );
      } finally {
        setIsUploadingAvatar(false);
      }
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    modernHeader: {
      paddingBottom: 20,
      paddingHorizontal: 20,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#111827',
      flex: 1,
      textAlign: 'center',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    headerRight: {
      width: 40,
      height: 40,
    },
    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#F9FAFB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerProfileSection: {
      alignItems: 'center',
    },
    largeAvatarContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: 16,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      borderWidth: 3,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    largeAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 37,
    },
    largeAvatarText: {
      fontSize: 24,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#111827',
    },
    cameraIconLarge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#111827',
      borderRadius: 12,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    uploadingContainer: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F3F4F6',
      borderRadius: 37,
    },
    headerProfileInfo: {
      alignItems: 'center',
    },
    headerProfileName: {
      fontSize: 20,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#111827',
      marginBottom: 6,
      textAlign: 'center',
    },
    headerProfileEmail: {
      fontSize: 14,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '500',
      color: '#6B7280',
      marginBottom: 12,
      textAlign: 'center',
    },
    
    memberSinceText: {
      fontSize: 13,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '500',
      color: '#6B7280',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
   
   
    statValue: {
      fontSize: 20,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#111827',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '500',
      color: '#6B7280',
      textAlign: 'center',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    menuSection: {
      marginBottom: 20,
    },
    menuTitleContainer: {
      marginBottom: 16,
    },
    menuTitle: {
      fontSize: 18,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#111827',
      marginBottom: 8,
    },
    menuTitleUnderline: {
      width: 40,
      height: 2,
      backgroundColor: '#111827',
      borderRadius: 1,
    },
    menuItem: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    menuItemPressed: {
      backgroundColor: '#F9FAFB',
      transform: [{ scale: 0.98 }],
    },
    menuItemIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    menuItemContent: {
      flex: 1,
    },
    menuItemTitle: {
      fontSize: 15,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '600',
      color: '#111827',
      marginBottom: 4,
    },
    menuItemSubtitle: {
      fontSize: 12,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '500',
      color: '#6B7280',
    },
    menuItemArrow: {
      marginLeft: 8,
      opacity: 0.6,
    },
    logoutButton: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: '#EF4444',
    },
    subscriptionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 5,
      borderWidth: 1.5,
      position: 'relative',
      overflow: 'hidden',
      alignSelf: 'center',
    },
    premiumBadge: {
      backgroundColor: '#F59E0B',
      borderColor: '#D97706',
    },
    basicBadge: {
      backgroundColor: '#111827',
      borderColor: '#111827',
    },
    freeBadge: {
      backgroundColor: '#F3F4F6',
      borderColor: '#E5E7EB',
    },
    subscriptionText: {
      fontSize: 11,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '700',
      color: '#FFFFFF',
    },
    subscriptionTextDark: {
      color: '#111827',
    },
    versionContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      marginTop: 8,
    },
    versionText: {
      fontSize: 12,
      fontFamily: 'HelveticaMedium',
      textTransform: 'uppercase',
      fontWeight: '500',
      color: '#9CA3AF',
    },
  });

  const handleMenuItemPress = (item: any) => {
    console.log('Menu item pressed:', item.title);
    
    if (item.id === '1') {
      router.push('/personal-info');
      return;
    }
    if (item.id === '2') {
      router.push('/(tabs)/garage');
      return;
    }
    if (item.id === 'loyalty') {
      router.push('/loyalty');
    } else if (item.id === 'referral') {
      router.push('/referral');
    } else if (item.id === 'partner') {
      router.push('/partner');
    } else if (item.id === 'analytics') {
      router.push('/analytics-dashboard');
    } else if (item.id === '8') {
      handleContactOptions();
    } else if (item.id === '9') {
      handleSupportChat();
    } else {
      console.log('Navigating to:', item.title);
    }
  };

  const handleContactOptions = () => {
    console.log('Contact options opened');
  };

  const handleSupportChat = () => {
    console.log('Support chat opened');
  };

  const handleLogout = async () => {
    Alert.alert(
      'გასვლა',
      'დარწმუნებული ხართ რომ გსურთ გასვლა?',
      [
        {
          text: 'გაუქმება',
          style: 'cancel',
        },
        {
          text: 'გასვლა',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      {/* Modern White Header - Airbnb style */}
      <View style={styles.modernHeader}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>პროფილი</Text>
            <View style={styles.headerRight} />
          </View>

          <View style={styles.headerProfileSection}>
          <TouchableOpacity 
            style={styles.largeAvatarContainer} 
            onPress={handlePhotoUpload}
            disabled={isUploadingAvatar}
            activeOpacity={0.7}
          >
            {isUploadingAvatar ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#111827" />
              </View>
            ) : userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.largeAvatarImage} />
            ) : (
              <Text style={styles.largeAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
            {!isUploadingAvatar && (
              <View style={styles.cameraIconLarge}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.headerProfileInfo}>
            <Text style={styles.headerProfileName}>{displayName}</Text>
            <Text style={styles.headerProfileEmail}>{displayPhone}</Text>
            
            {/* Premium/Basic Subscription Badge */}
            {subscription && (subscription.plan === 'premium' || subscription.plan === 'basic') && (
              <TouchableOpacity
                onPress={() => {
                  const currentPlan = subscription?.plan;
                  if (currentPlan === 'premium') {
                    setShowPremiumInfoModal(true);
                  } else if (currentPlan === 'basic') {
                    setShowSubscriptionModal(true);
                  }
                }}
                activeOpacity={0.7}
                style={{ marginTop: 8 }}
              >
                <View style={[
                  styles.subscriptionBadge,
                  subscription.plan === 'premium' && styles.premiumBadge,
                  subscription.plan === 'basic' && styles.basicBadge,
                ]}>
                  <Ionicons 
                    name={subscription.plan === 'premium' ? 'star' : 'shield-checkmark'} 
                    size={13} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.subscriptionText}>
                    {subscription.plan === 'premium' ? 'პრემიუმ' : 'ძირითადი'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {(!subscription || subscription.plan === 'free') && (
              <TouchableOpacity
                onPress={() => setShowSubscriptionModal(true)}
                activeOpacity={0.7}
                style={{ marginTop: 8 }}
              >
                <View style={[
                  styles.subscriptionBadge,
                  styles.freeBadge,
                ]}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={13} 
                    color="#111827" 
                  />
                  <Text style={[styles.subscriptionText, styles.subscriptionTextDark]}>უფასო</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          </View>
        </SafeAreaView>

      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <View style={styles.menuSection}>
          
          {PROFILE_MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                pressedButtons[item.id] && styles.menuItemPressed
              ]}
              onPress={() => handleMenuItemPress(item)}
              onPressIn={() => setPressedButtons(prev => ({ ...prev, [item.id]: true }))}
              onPressOut={() => setPressedButtons(prev => ({ ...prev, [item.id]: false }))}
              activeOpacity={0.8}
            >
              <View style={styles.menuItemIcon}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
              <View style={styles.menuItemArrow}>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={[styles.menuItem, styles.logoutButton]}
            onPress={handleLogout}
          >
            <View style={[styles.menuItemIcon, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>გასვლა</Text>
              <Text style={styles.menuItemSubtitle}>გამოხვიდეთ ანგარიშიდან</Text>
            </View>
            <View style={styles.menuItemArrow}>
              <Ionicons name="chevron-forward" size={18} color="#EF4444" />
            </View>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            ვერსია {getCurrentAppVersion()}
          </Text>
        </View>

      </ScrollView>

      {/* Subscription Modals */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={() => {
          setShowSubscriptionModal(false);
        }}
      />
      <PremiumInfoModal
        visible={showPremiumInfoModal}
        onClose={() => setShowPremiumInfoModal(false)}
      />
    </View>
  );
}
