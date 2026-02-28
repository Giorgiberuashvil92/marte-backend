import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Clipboard,
  Dimensions,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { referralsApi } from '../services/referralsApi';
import { useSubscription } from '../contexts/SubscriptionContext';
import SubscriptionModal from '../components/ui/SubscriptionModal';

const { width } = Dimensions.get('window');

export default function ReferralScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { success, error } = useToast();
  const { isPremiumUser, hasActiveSubscription, subscription, isLoading: subscriptionLoading } = useSubscription();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalReferrals: number;
    totalPointsEarned: number;
    referralCode: string;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    Array<{
      userId: string;
      name: string;
      points: number;
      rank: number;
      referrals: number;
      isCurrentUser: boolean;
      createdAt: number;
    }>
  >([]);
  const [leaderboardOffset, setLeaderboardOffset] = useState(0);
  const [hasMoreLeaderboard, setHasMoreLeaderboard] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showInfoCard, setShowInfoCard] = useState(true);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [applyingPromoCode, setApplyingPromoCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'leaderboard'>('info');
  const [referralHistory, setReferralHistory] = useState<{
    inviterId: string;
    inviterName: string;
    referralCode: string;
    totalReferrals: number;
    history: Array<{
      referralId: string;
      inviteeId: string;
      inviteeName: string;
      appliedAt: number;
      appliedAtFormatted: string;
      subscriptionEnabled: boolean;
      rewardsGranted: boolean;
      firstBookingAt?: number;
      firstBookingAtFormatted?: string;
      createdAt: Date;
      updatedAt: Date;
      daysSinceApplied: number;
    }>;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
    
      loadReferralData(true);
    } else {
      console.log('⚠️ [FRONTEND] useEffect: No user ID available');
    }
  }, [user?.id]);

  // განვაახლოთ referralCode stats-ის referralCode-ით, თუ referralCode ცარიელია
  useEffect(() => {
    if (!referralCode && stats?.referralCode) {
      setReferralCode(stats.referralCode);
    }
  }, [stats?.referralCode, referralCode]);

  // Log stats changes
  useEffect(() => {
    if (stats) {
      console.log('📊 [STATS UPDATE] Stats state changed:', {
        totalReferrals: stats.totalReferrals,
        totalPointsEarned: stats.totalPointsEarned,
        referralCode: stats.referralCode,
        timestamp: new Date().toISOString(),
      });
    }
  }, [stats]);

  // Log leaderboard changes
  useEffect(() => {
    if (leaderboard.length > 0) {
      console.log('🏆 [LEADERBOARD UPDATE] Leaderboard state changed:', {
        length: leaderboard.length,
        top3: leaderboard.slice(0, 3).map(u => ({
          userId: u.userId,
          name: u.name,
          rank: u.rank,
          points: u.points,
          referrals: u.referrals,
        })),
        timestamp: new Date().toISOString(),
      });
    }
  }, [leaderboard]);

  // დალოგვა როცა leaderboard state იცვლება

  const loadReferralData = async (reset: boolean = false) => {
    if (!user?.id) return;
    
    try {
      if (reset) {
        setLoading(true);
        setLeaderboardOffset(0);
        setHasMoreLeaderboard(true);
      }
      
      const offset = reset ? 0 : leaderboardOffset;
      
     
       
      const [code, referralStats, leaderboardResponse, history] = await Promise.all([
        referralsApi.getReferralCode(user.id),
        referralsApi.getReferralStats(user.id),
        referralsApi.getReferralLeaderboard(user.id, 20, offset),
        referralsApi.getUserReferralHistory(user.id).catch(() => null), 
      ]);
    
      // გამოვიყენოთ referralCode stats-დან თუ code ცარიელია
      const finalReferralCode = code || referralStats?.referralCode || '';
      setReferralCode(finalReferralCode);
      
     
      setStats(referralStats);
      
      // თუ referralCode ჯერ კიდევ ცარიელია stats-ის შემდეგ, განვაახლოთ stats-ის referralCode-ით
      if (!finalReferralCode && referralStats?.referralCode) {
        setReferralCode(referralStats.referralCode);
      }
      
      if (history) {
        setReferralHistory(history);

      }
      
      if (reset) {
        setLeaderboard(leaderboardResponse.leaderboard);
      } else {
        setLeaderboard((prev) => {
          const updated = [...prev, ...leaderboardResponse.leaderboard];
          return updated;
        });
      }
      
      // Debug: log leaderboard to see what we're getting
      if (reset) {
       
        
        // Check if any user has points
        const usersWithPoints = leaderboardResponse.leaderboard.filter(u => u.points > 0);
        
      }
      
      setHasMoreLeaderboard(leaderboardResponse.hasMore);
      setLeaderboardOffset(offset + leaderboardResponse.leaderboard.length);
      
     
    } catch (err: any) {
      console.error('Error loading referral data:', err);
      error('შეცდომა', err.message || 'რეფერალური კოდის ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreLeaderboard = async () => {
    if (!hasMoreLeaderboard || loadingMore || !user?.id) return;
    
    try {
      setLoadingMore(true);
      await loadReferralData(false);
    } catch (err: any) {
      console.error('Error loading more leaderboard:', err);
      error('შეცდომა', 'მეტი მონაცემის ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCopyCode = () => {
    if (referralCode) {
      Clipboard.setString(referralCode);
      success('კოპირებულია!', 'რეფერალური კოდი დაკოპირდა');
    }
  };

  const handleShare = async () => {
    if (!referralCode) return;

    try {
      const message = `🎁 გამოიყენე ჩემი რეფერალური კოდი და მიიღე ქულები!\n\nკოდი: ${referralCode}\n\nჩამოტვირთე აპლიკაცია და გამოიყენე ეს კოდი რეგისტრაციის დროს!`;
      
      const result = await Share.share({
        message,
        title: 'რეფერალური კოდი',
      });

      if (result.action === Share.sharedAction) {
        success('გაზიარებულია!', 'რეფერალური კოდი გაზიარდა');
      }
    } catch (err: any) {
      error('შეცდომა', 'გაზიარება ვერ მოხერხდა');
    }
  };

  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim() || !user?.id) {
      error('შეცდომა', 'გთხოვთ შეიყვანოთ პრომო კოდი');
      return;
    }

    try {
      setApplyingPromoCode(true);
      
      console.log('🔍 [PROMO CODE] Starting application:', {
        userId: user.id,
        promoCode: promoCodeInput.trim(),
        timestamp: new Date().toISOString(),
      });

      // Log stats before applying
      console.log('📊 [PROMO CODE] Stats BEFORE applying:', {
        currentStats: stats,
        currentPoints: stats?.totalPointsEarned || 0,
        currentReferrals: stats?.totalReferrals || 0,
      });

      const result = await referralsApi.applyReferralCode(user.id, promoCodeInput.trim());
      
      console.log('✅ [PROMO CODE] API Response:', {
        success: result.success,
        inviterId: result.inviterId,
        pointsAwarded: result.pointsAwarded,
        fullResult: result,
      });
      
      if (result.success) {
        console.log('🎉 [PROMO CODE] Code applied successfully!', {
          inviterId: result.inviterId,
          pointsAwardedToInviter: result.pointsAwarded,
          message: `თქვენი მეგობარი (ID: ${result.inviterId}) მიიღებს ${result.pointsAwarded || 100} ქულას`,
        });

        success(
          'წარმატება!', 
          `პრომო კოდი წარმატებით გამოიყენება! ${result.pointsAwarded ? `თქვენი მეგობარი მიიღებს ${result.pointsAwarded} ქულას!` : 'თქვენი მეგობარი მიიღებს ქულებს!'}`
        );
        setPromoCodeInput('');
        
        // განახლება მონაცემების
        console.log('🔄 [PROMO CODE] Reloading referral data to check leaderboard...');
        await loadReferralData(true);
        
        // Log stats after reloading
        setTimeout(() => {
          console.log('📊 [PROMO CODE] Stats AFTER reloading:', {
            newStats: stats,
            newPoints: stats?.totalPointsEarned || 0,
            newReferrals: stats?.totalReferrals || 0,
            leaderboardLength: leaderboard.length,
            inviterInLeaderboard: leaderboard.find(u => u.userId === result.inviterId),
          });
        }, 500);
      } else {
        console.error('❌ [PROMO CODE] Code application failed:', result);
        error('შეცდომა', 'პრომო კოდის გამოყენება ვერ მოხერხდა');
      }
    } catch (err: any) {
      console.error('❌ [PROMO CODE] Error applying promo code:', {
        error: err,
        message: err.message,
        stack: err.stack,
      });
      error('შეცდომა', err.message || 'პრომო კოდის გამოყენება ვერ მოხერხდა');
    } finally {
      setApplyingPromoCode(false);
    }
  };

  useEffect(() => {
    const generateCodeIfNeeded = async () => {
      if (!user?.id) return;
      
      if (!referralCode && (!stats?.referralCode || !stats.referralCode.trim())) {
        try {
          const generatedCode = await referralsApi.generateReferralCode(user.id);
          if (generatedCode) {
            setReferralCode(generatedCode);
          }
        } catch (err) {
          console.error('Error generating referral code:', err);
        }
      }
    };

    if (stats !== null) {
      generateCodeIfNeeded();
    }
  }, [user?.id, referralCode, stats]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>იტვირთება...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Gradient Header Background */}
          <LinearGradient
            colors={['#8B5CF6', '#6366F1', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerGradientOverlay} />
          </LinearGradient>

          {/* Header */}
          <View style={styles.leaderboardSection}>
            <View style={styles.pageHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButtonHeader}>
                  <View style={styles.backButtonInner}>
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
                <View style={styles.pageTitleContainer}>
                  <Text style={styles.pageTitle}>ლიდერბორდი</Text>
                  {leaderboard.length > 0 && leaderboard[0] && (
                    <Text style={styles.pageSubtitle}>
                      {leaderboard[0]?.name || 'მომხმარებელი'} #1 ადგილზე
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={handleShare} style={styles.headerShareButton}>
                  <View style={styles.shareButtonInner}>
                    <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Tab Navigation */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'info' && styles.tabActive]}
                  onPress={() => setActiveTab('info')}
                >
                  <Ionicons 
                    name="information-circle" 
                    size={20} 
                    color={activeTab === 'info' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)'} 
                  />
                  <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
                    ინფო
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
                  onPress={() => setActiveTab('leaderboard')}
                >
                  <Ionicons 
                    name="trophy" 
                    size={20} 
                    color={activeTab === 'leaderboard' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)'} 
                  />
                  <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
                    ლიდერბორდი
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content */}
              {activeTab === 'info' ? (
              <View style={styles.tabContent}>
              {/* Combined Info & Promo Code Card */}
              {showInfoCard && (
                <View style={styles.combinedCard}>
                  <View style={styles.combinedCardHeader}>
                    <View style={styles.combinedCardHeaderLeft}>
                      <View style={styles.combinedCardIconContainer}>
                        <Ionicons name="heart" size={20} color="#8B5CF6" />
                      </View>
                      <Text style={styles.combinedCardTitle}>როგორ მუშაობს?</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => setShowInfoCard(false)} 
                      style={styles.combinedCardCloseButton}
                    >
                      <Ionicons name="close" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.combinedCardContent}>
                    {/* Info Items */}
                    <View style={styles.combinedInfoItems}>
                      <View style={styles.infoItem}>
                        <Ionicons name="gift" size={16} color="#8B5CF6" />
                        <Text style={styles.infoText}>
                          გაუზიარე კოდი მეგობრებს
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="star" size={16} color="#F59E0B" />
                        <Text style={styles.infoText}>
                          როცა მეგობარი გამოიყენებს თქვენს კოდს, თქვენ მიიღებთ <Text style={styles.infoHighlight}>100 ქულას</Text>
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="trophy" size={16} color="#10B981" />
                        <Text style={styles.infoText}>
                          მოიგე <Text style={styles.infoHighlight}>200 ლიტრი ბენზინი</Text> ლიდერბორდში #1-ისთვის
                        </Text>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.combinedCardDivider} />

                    {/* Promo Code Section */}
                    <View style={styles.combinedPromoSection}>
                      <View style={styles.combinedPromoHeader}>
                        <Ionicons name="person-add" size={18} color="#6366F1" />
                        <Text style={styles.combinedPromoTitle}>დაეხმარე მეგობარს</Text>
                      </View>
                      <Text style={styles.combinedPromoDescription}>
                        შეიყვანე მეგობრის პრომოკოდი და დაეხმარე მას - როცა კოდს გამოიყენებ, მეგობარს ენიჭება 100 ქულა. თუ თქვენც გსურთ გათამაშებაში ჩართვა, გაიაქტიურეთ პრემიუმ პაკეტი და გაუზიარეთ თქვენი პრომოკოდი მეგობრებს.
                      </Text>
                      <View style={styles.promoCodeInputContainer}>
                        <TextInput
                          style={styles.promoCodeInput}
                          placeholder="შეიყვანე პრომო კოდი"
                          placeholderTextColor="#9CA3AF"
                          value={promoCodeInput}
                          onChangeText={setPromoCodeInput}
                          autoCapitalize="characters"
                          editable={!applyingPromoCode}
                        />
                        <TouchableOpacity
                          style={[
                            styles.applyPromoButton,
                            (!promoCodeInput.trim() || applyingPromoCode) && styles.applyPromoButtonDisabled
                          ]}
                          onPress={handleApplyPromoCode}
                          disabled={!promoCodeInput.trim() || applyingPromoCode}
                        >
                          {applyingPromoCode ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                              <Text style={styles.applyPromoButtonText}>გამოყენება</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Quick Code & Share */}
              <View style={styles.quickActionsSection}>
                {(() => {
                  // Debug: log subscription status
                  
                  return !subscriptionLoading && isPremiumUser;
                })() ? (
                  <LinearGradient
                    colors={['#8B5CF6', '#6366F1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.quickCodeCard}
                  >
                    <View style={styles.quickCodeHeader}>
                      <Ionicons name="gift" size={20} color="#FFFFFF" />
                      <Text style={styles.quickCodeLabel}>თქვენი პრომო კოდი</Text>
                    </View>
                    <View style={styles.quickCodeRow}>
                      <Text style={styles.quickCodeText}>{referralCode || 'იტვირთება...'}</Text>
                      <TouchableOpacity onPress={handleCopyCode} style={styles.quickCopyButton}>
                        <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                ) : (
                  <LinearGradient
                    colors={['#8B5CF6', '#6366F1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.quickCodeCard}
                  >
                    <View style={styles.subscriptionPromptContent}>
                      <View style={styles.subscriptionPromptIconWrapper}>
                        <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                      </View>
                      <View style={styles.subscriptionPromptTextContainer}>
                        <Text style={styles.subscriptionPromptMainText}>
                          პრომო კოდის სანახავად
                        </Text>
                        <Text style={styles.subscriptionPromptSubText}>
                          გაიაქტიურეთ პრემიუმ პაკეტი
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.subscriptionPromptButton}
                      onPress={() => setShowSubscriptionModal(true)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#FFFFFF', '#F3F4F6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.subscriptionPromptButtonGradient}
                      >
                        <Ionicons name="star" size={18} color="#8B5CF6" />
                        <Text style={styles.subscriptionPromptButtonText}>
                          პრემიუმის გააქტიურება
                        </Text>
                        <Ionicons name="arrow-forward" size={18} color="#8B5CF6" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                )}
              </View>
            ) 
              
            </View>
            ) : (
              <View style={styles.tabContent}>
                {leaderboard.length > 0 ? (
                  <>
                    {/* User Position Section */}
                    <View style={styles.topUserSection}>
                      <LinearGradient
                        colors={['#FEF3C7', '#FDE68A', '#FCD34D']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.topUserWinnerLabel}
                      >
                        <Ionicons name="trophy" size={22} color="#92400E" />
                        <Text style={styles.topUserWinnerText}>თქვენი პოზიცია</Text>
                      </LinearGradient>
                      <View style={styles.topUserContainer}>
                        <View style={styles.topUserAvatarContainer}>
                          <LinearGradient
                            colors={['#8B5CF6', '#6366F1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.topUserAvatar}
                          >
                            <Text style={styles.topUserAvatarText}>
                              {(user?.name || 'მ')?.charAt(0)?.toUpperCase() || 'მ'}
                            </Text>
                          </LinearGradient>
                          {(() => {
                            const currentUserRank = leaderboard.findIndex(u => u.isCurrentUser) + 1;
                            return currentUserRank > 0 ? (
                              <LinearGradient
                                colors={['#F59E0B', '#D97706']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.topUserRankBadge}
                              >
                                <Text style={styles.topUserRankText}>#{currentUserRank}</Text>
                              </LinearGradient>
                            ) : null;
                          })()}
                        </View>
                        <LinearGradient
                          colors={['#D1FAE5', '#A7F3D0']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.topUserNameContainer}
                        >
                          <Text 
                            style={styles.topUserName}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {user?.name || 'მომხმარებელი'}
                          </Text>
                          <View style={styles.topUserPointsContainer}>
                            <Ionicons name="star" size={16} color="#F59E0B" />
                            <Text style={styles.topUserPoints}>
                              {stats?.totalPointsEarned || 0} ქულა
                            </Text>
                          </View>
                        </LinearGradient>
                      </View>
                    </View>

                    {/* Stats Card */}
                    {stats && (
                      <View style={styles.quickStatsCard}>
                        <LinearGradient
                          colors={['#F0F9FF', '#E0F2FE']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.quickStatsGradient}
                        >
                          <View style={styles.quickStatItem}>
                            <View style={styles.quickStatIconContainer}>
                              <Ionicons name="people" size={20} color="#8B5CF6" />
                            </View>
                            <Text style={styles.quickStatLabel}>მოწვეული</Text>
                            <Text style={styles.quickStatValue}>{stats.totalReferrals}</Text>
                          </View>
                          <View style={styles.quickStatDivider} />
                          <View style={styles.quickStatItem}>
                            <View style={styles.quickStatIconContainer}>
                              <Ionicons name="star" size={20} color="#F59E0B" />
                            </View>
                            <Text style={styles.quickStatLabel}>ქულა</Text>
                            <Text style={styles.quickStatValue}>{stats.totalPointsEarned}</Text>
                          </View>
                        </LinearGradient>
                      </View>
                    )}

                    {/* Leaderboard List */}
                    <View style={styles.leaderboardListContainer}>
                      {(() => {
                        console.log('🎨 [FRONTEND] Rendering Leaderboard:', {
                          leaderboardLength: leaderboard.length,
                          entriesToRender: leaderboard.map((e) => ({
                            rank: e.rank,
                            name: e.name,
                            points: e.points,
                            referrals: e.referrals,
                            isCurrentUser: e.isCurrentUser,
                          })),
                        });
                        return null;
                      })()}
                      <View style={styles.leaderboardList}>
                        {leaderboard.map((entry, index) => {
                          if (index < 3) {
                            console.log(`🎯 [FRONTEND] Rendering entry ${index + 1}:`, {
                              rank: entry.rank,
                              name: entry.name,
                              points: entry.points,
                              referrals: entry.referrals,
                              isCurrentUser: entry.isCurrentUser,
                            });
                          }
                          return (
                    <View
                      key={entry.userId}
                      style={[
                        styles.leaderboardItem,
                        entry.isCurrentUser && styles.leaderboardItemCurrent,
                      ]}
                    >
                      {entry.rank === 1 ? (
                        <LinearGradient
                          colors={['#F59E0B', '#D97706']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.trophyContainer}
                        >
                          <Ionicons name="trophy" size={20} color="#FFFFFF" />
                        </LinearGradient>
                      ) : entry.rank === 2 ? (
                        <LinearGradient
                          colors={['#94A3B8', '#64748B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.rankCircle}
                        >
                          <Text style={styles.rankCircleText}>{entry.rank}</Text>
                        </LinearGradient>
                      ) : entry.rank === 3 ? (
                        <LinearGradient
                          colors={['#CD7F32', '#A0522D']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.rankCircle}
                        >
                          <Text style={styles.rankCircleText}>{entry.rank}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.rankCircle}>
                          <Text style={styles.rankCircleText}>{entry.rank}</Text>
                        </View>
                      )}
                      <LinearGradient
                        colors={entry.isCurrentUser ? ['#8B5CF6', '#6366F1'] : ['#E5E7EB', '#D1D5DB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.userAvatar}
                      >
                        <Text style={styles.userAvatarText}>
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      </LinearGradient>
                      <View style={styles.userInfo}>
                        <Text
                          style={[
                            styles.userName,
                            entry.isCurrentUser && styles.userNameCurrent,
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {entry.name}
                        </Text>
                      </View>
                      <View style={styles.userPointsContainer}>
                        <Ionicons name="star" size={14} color="#F59E0B" />
                        <Text style={styles.userPoints}>
                          {entry.points} <Text style={styles.pointsLabel}>ქულა</Text>
                        </Text>
                      </View>
                    </View>
                          );
                        })}
                      </View>
                      
                      {/* Load More Button */}
                      {hasMoreLeaderboard && (
                        <View style={styles.loadMoreContainer}>
                          {loadingMore ? (
                            <ActivityIndicator size="small" color="#8B5CF6" />
                          ) : (
                            <TouchableOpacity
                              onPress={loadMoreLeaderboard}
                              style={styles.loadMoreButton}
                            >
                              <Text style={styles.loadMoreText}>მეტის ჩატვირთვა</Text>
                              <Ionicons name="chevron-down" size={18} color="#8B5CF6" />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="trophy-outline" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyStateText}>ლიდერბორდი ცარიელია</Text>
                  </View>
                )}
              </View>
            )}
            </View>
        </ScrollView> 

      </SafeAreaView>

      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={() => {
          setShowSubscriptionModal(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
  },
  headerGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'NotoSans_400Regular',
  },
  leaderboardSection: {
    paddingTop: 8,
    marginBottom: 24,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    zIndex: 1,
  },
  backButtonHeader: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pageTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#6B7280',
    marginTop: 16,
  },
  headerShareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
  },
  rulesSection: {
    gap: 20,
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: 8,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  ruleCard: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  warningCard: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  ruleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ruleContent: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 17,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    lineHeight: 22,
  },
  pointsList: {
    gap: 12,
    marginTop: 4,
  },
  pointItem: {
    flexDirection: 'row',
    gap: 12,
  },
  pointBullet: {
    marginTop: 2,
  },
  pointContent: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  pointText: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  pointHighlight: {
    fontFamily: 'NotoSans_700Bold',
    color: '#8B5CF6',
  },
  prizeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  prizeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#92400E',
    lineHeight: 20,
  },
  prizeHighlight: {
    fontFamily: 'NotoSans_700Bold',
    fontSize: 15,
  },
  tipsList: {
    gap: 10,
    marginTop: 4,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  tipText: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    flex: 1,
  },
  warningList: {
    gap: 12,
    marginTop: 4,
  },
  warningItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  warningHighlight: {
    fontFamily: 'NotoSans_700Bold',
    color: '#DC2626',
  },
  topUserSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
    alignItems: 'center',
  },
  topUserWinnerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  topUserWinnerText: {
    fontSize: 14,
    fontFamily: 'NotoSans_700Bold',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  topUserContainer: {
    alignItems: 'center',
  },
  topUserAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  topUserAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  topUserAvatarText: {
    fontSize: 48,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  topUserRankBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  topUserRankText: {
    fontSize: 14,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
  },
  topUserNameContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 200,
    maxWidth: '90%',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  topUserPointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  topUserName: {
    fontSize: 20,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
    marginBottom: 4,
    fontStyle: 'italic',
    maxWidth: '100%',
    textAlign: 'center',
  },
  topUserPoints: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#6B7280',
  },
  combinedCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  combinedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  combinedCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  combinedCardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  combinedCardTitle: {
    fontSize: 18,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  combinedCardCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  combinedCardContent: {
    gap: 16,
  },
  combinedInfoItems: {
    gap: 12,
  },
  combinedCardDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  combinedPromoSection: {
    gap: 12,
  },
  combinedPromoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  combinedPromoTitle: {
    fontSize: 16,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  combinedPromoDescription: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  infoCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoCardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  infoCardCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardContent: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    lineHeight: 18,
  },
  infoHighlight: {
    fontFamily: 'NotoSans_700Bold',
    color: '#6366F1',
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
    gap: 12,
  },
  quickCodeCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  quickCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quickCodeLabel: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  quickCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickCodeText: {
    fontSize: 22,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
    flex: 1,
  },
  quickCopyButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickStatsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickStatsGradient: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickStatIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickStatLabel: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#6B7280',
  },
  quickStatValue: {
    fontSize: 22,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  quickStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  leaderboardListContainer: {
    paddingHorizontal: 20,
  },
  leaderboardList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'visible', // Changed from 'hidden' to 'visible' to allow scrolling
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  leaderboardItemCurrent: {
    backgroundColor: '#F9FAFB',
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  rankCircleText: {
    fontSize: 13,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
  },
  trophyContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userAvatarText: {
    fontSize: 18,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#111827',
    width: '100%',
  },
  userNameCurrent: {
    color: '#8B5CF6',
  },
  userPointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  userPoints: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#111827',
    textAlign: 'right',
    minWidth: 60,
  },
  pointsLabel: {
    fontSize: 12,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadMoreText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#8B5CF6',
  },
  helpFriendSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  helpFriendCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  helpFriendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  helpFriendTitle: {
    fontSize: 18,
    fontFamily: 'NotoSans_700Bold',
    color: '#111827',
  },
  helpFriendDescription: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  promoCodeInputContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  promoCodeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  applyPromoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 120,
    justifyContent: 'center',
  },
  applyPromoButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.6,
  },
  applyPromoButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
  subscriptionPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  subscriptionPromptIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  subscriptionPromptTextContainer: {
    flex: 1,
    gap: 4,
  },
  subscriptionPromptMainText: {
    fontSize: 16,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  subscriptionPromptSubText: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  subscriptionPromptButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  subscriptionPromptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  subscriptionPromptButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_700Bold',
    color: '#8B5CF6',
  },
});
