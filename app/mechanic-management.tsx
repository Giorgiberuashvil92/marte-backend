import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { useUser } from '../contexts/UserContext';
import { addItemApi } from '../services/addItemApi';

const { width } = Dimensions.get('window');

interface MechanicAnnouncement {
  _id: string;
  id?: string;
  name: string;
  specialty: string;
  location?: string;
  phone?: string;
  address?: string;
  avatar?: string;
  status: string;
  isFeatured?: boolean;
  createdAt?: string;
  expiryDate?: string;
  views?: number;
}

export default function MechanicManagementScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [mechanics, setMechanics] = useState<MechanicAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [upgradingId, setUpgradingId] = useState<string | null>(null);

  const loadMechanics = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const normalizedOwnerId = user.id.startsWith('usr_') ? user.id.replace('usr_', '') : user.id;
      
      const response1 = await addItemApi.getMechanics({ ownerId: user.id });
      const response2 = await addItemApi.getMechanics({ ownerId: normalizedOwnerId });
      
      const allMechanics = [
        ...(response1.success && response1.data ? response1.data : []),
        ...(response2.success && response2.data ? response2.data : []),
      ];
      
      const uniqueMechanics = allMechanics.filter((mechanic, index, self) =>
        index === self.findIndex((m) => (m.id || m._id) === (mechanic.id || mechanic._id))
      );
      
      setMechanics(uniqueMechanics);
    } catch (error) {
      console.error('Error loading mechanics:', error);
      Alert.alert('შეცდომა', 'განცხადებების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMechanics();
  }, [loadMechanics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMechanics();
  }, [loadMechanics]);

  const handleRenew = async (mechanic: MechanicAnnouncement) => {
    const mechanicId = mechanic._id || mechanic.id;
    if (!mechanicId) return;

    Alert.alert(
      'განცხადების განახლება',
      `გსურთ განაახლოთ "${mechanic.name}" განცხადება? განახლება ღირს 20₾.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'გადახდა',
          onPress: async () => {
            setRenewingId(mechanicId);
            try {
              router.push({
                pathname: '/payment-card',
                params: {
                  amount: '20',
                  description: `განცხადების განახლება - ${mechanic.name}`,
                  context: 'mechanic-renewal',
                  orderId: `mechanic_renewal_${mechanicId}_${Date.now()}`,
                  metadata: JSON.stringify({
                    mechanicId: mechanicId,
                    userId: user?.id,
                  }),
                }
              });
            } catch (error) {
              console.error('Error initiating renewal payment:', error);
              Alert.alert('შეცდომა', 'გადახდის ინიციალიზაცია ვერ მოხერხდა');
            } finally {
              setRenewingId(null);
            }
          }
        }
      ]
    );
  };

  const handleUpgradeToVip = async (mechanic: MechanicAnnouncement) => {
    const mechanicId = mechanic._id || mechanic.id;
    if (!mechanicId) return;

    Alert.alert(
      'VIP-ზე გადაყვანა',
      `გსურთ "${mechanic.name}" განცხადება VIP-ზე გადაიყვანოთ? VIP განცხადება ღირს 30₾/თვეში და მიიღებს პრიორიტეტულ განთავსებას.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'გადახდა',
          onPress: async () => {
            setUpgradingId(mechanicId);
            try {
              router.push({
                pathname: '/payment-card',
                params: {
                  amount: '30',
                  description: `VIP განცხადება - ${mechanic.name}`,
                  context: 'mechanic-upgrade',
                  orderId: `mechanic_upgrade_${mechanicId}_${Date.now()}`,
                  metadata: JSON.stringify({
                    mechanicId: mechanicId,
                    tier: 'vip',
                    userId: user?.id,
                  }),
                }
              });
            } catch (error) {
              console.error('Error initiating upgrade payment:', error);
              Alert.alert('შეცდომა', 'გადახდის ინიციალიზაცია ვერ მოხერხდა');
            } finally {
              setUpgradingId(null);
            }
          }
        }
      ]
    );
  };

  const handleDelete = async (mechanic: MechanicAnnouncement) => {
    const mechanicId = mechanic._id || mechanic.id;
    if (!mechanicId) return;

    Alert.alert(
      'განცხადების წაშლა',
      `ნამდვილად გსურთ "${mechanic.name}" განცხადების წაშლა?`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await addItemApi.deleteMechanic(mechanicId, user?.id);
              if (response.success) {
                Alert.alert('წარმატება', 'განცხადება წარმატებით წაიშალა');
                loadMechanics();
              } else {
                Alert.alert('შეცდომა', response.message || 'წაშლა ვერ მოხერხდა');
              }
            } catch (error) {
              console.error('Error deleting mechanic:', error);
              Alert.alert('შეცდომა', 'განცხადების წაშლა ვერ მოხერხდა');
            }
          }
        }
      ]
    );
  };

  const getExpiryDate = (mechanic: MechanicAnnouncement): Date | null => {
    if (mechanic.expiryDate) {
      return new Date(mechanic.expiryDate);
    }
    
    if (mechanic.createdAt) {
      const createdDate = new Date(mechanic.createdAt);
      const expiryDate = new Date(createdDate);
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      return expiryDate;
    }
    
    return null;
  };

  const getDaysUntilExpiry = (mechanic: MechanicAnnouncement): number | null => {
    const expiryDate = getExpiryDate(mechanic);
    if (!expiryDate) return null;
    
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (mechanic: MechanicAnnouncement): string => {
    const expiryDate = getExpiryDate(mechanic);
    if (!expiryDate) return 'უცნობი';
    
    return expiryDate.toLocaleDateString('ka-GE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderMechanicCard = (mechanic: MechanicAnnouncement) => {
    const mechanicId = mechanic._id || mechanic.id || '';
    const daysUntilExpiry = getDaysUntilExpiry(mechanic);
    const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
    const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 7;

    return (
      <View key={mechanicId} style={styles.announcementCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {mechanic.isFeatured && (
              <View style={styles.vipBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.vipBadgeText}>VIP</Text>
              </View>
            )}
            <View style={styles.statusBadge}>
              <View style={[
                styles.statusDot,
                styles.statusDotActive
              ]} />
              <Text style={styles.statusText}>
                აქტიური
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(mechanic)}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContent}>
          <Image
            source={{
              uri: mechanic.avatar || 'https://images.unsplash.com/photo-1581094271901-8022df4466b9?q=80&w=400&auto=format&fit=crop'
            }}
            style={styles.cardImage}
          />
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>
              {mechanic.name}
            </Text>
            <Text style={styles.cardSubtitle}>
              {mechanic.location || 'მდებარეობა არ არის მითითებული'} • {mechanic.specialty}
            </Text>
            
            <View style={styles.cardStats}>
              <View style={styles.statItem}>
                <Ionicons name="eye-outline" size={14} color="#6B7280" />
                <Text style={styles.statText}>{mechanic.views || 0} ნახვა</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.expirySection}>
          <View style={styles.expiryInfo}>
            <Ionicons 
              name={isExpired ? "alert-circle" : "time-outline"} 
              size={16} 
              color={isExpired ? "#EF4444" : isExpiringSoon ? "#F59E0B" : "#6B7280"} 
            />
            <View style={styles.expiryTextContainer}>
              <Text style={styles.expiryLabel}>
                {isExpired ? 'ვადა გაუვიდა' : 'განახლება უწევს'}
              </Text>
              <Text style={[
                styles.expiryDate,
                isExpired && styles.expiryDateExpired,
                isExpiringSoon && !isExpired && styles.expiryDateExpiring
              ]}>
                {formatDate(mechanic)}
                {daysUntilExpiry !== null && !isExpired && (
                  <Text style={styles.daysText}> ({daysUntilExpiry} დღე)</Text>
                )}
              </Text>
            </View>
          </View>
          
          <View style={styles.actionButtons}>
            {!mechanic.isFeatured && (
              <TouchableOpacity
                style={[
                  styles.upgradeButton,
                  (upgradingId === mechanicId) && styles.upgradeButtonDisabled
                ]}
                onPress={() => handleUpgradeToVip(mechanic)}
                disabled={upgradingId === mechanicId}
              >
                {upgradingId === mechanicId ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <>
                    <Ionicons name="star" size={16} color="#F59E0B" />
                    <Text style={styles.upgradeButtonText}>
                      VIP (30₾)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.renewButton,
                (renewingId === mechanicId) && styles.renewButtonDisabled,
                !mechanic.isFeatured && styles.renewButtonWithUpgrade
              ]}
              onPress={() => handleRenew(mechanic)}
              disabled={renewingId === mechanicId}
            >
              {renewingId === mechanicId ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="card" size={16} color="#FFFFFF" />
                  <Text style={styles.renewButtonText}>
                    განახლება (20₾)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'განცხადებების მართვა',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#111827',
          headerShadowVisible: false,
        }}
      />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>იტვირთება...</Text>
          </View>
        ) : mechanics.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <Ionicons name="construct-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>განცხადებები არ მოიძებნა</Text>
            <Text style={styles.emptySubtitle}>
              თქვენ არ გაქვთ ხელოსნის განცხადებები
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/mechanics-new' as any)}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>განცხადების დამატება</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.headerInfo}>
              <Text style={styles.headerInfoText}>
                სულ {mechanics.length} განცხადება
              </Text>
            </View>

            {mechanics.map(renderMechanicCard)}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  headerInfo: {
    marginBottom: 8,
  },
  headerInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  announcementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  vipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotPending: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  deleteButton: {
    padding: 4,
  },
  cardContent: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cardImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  cardInfo: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  expirySection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  expiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expiryTextContainer: {
    flex: 1,
  },
  expiryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  expiryDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  expiryDateExpired: {
    color: '#EF4444',
  },
  expiryDateExpiring: {
    color: '#F59E0B',
  },
  daysText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  renewButtonWithUpgrade: {
    flex: 1,
  },
  renewButtonDisabled: {
    opacity: 0.6,
  },
  renewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  upgradeButtonDisabled: {
    opacity: 0.6,
  },
  upgradeButtonText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
