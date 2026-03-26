import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/Colors';
import { fuelPricesApi, PriceHistory, ProviderPrices } from '../services/fuelPricesApi';

const { width } = Dimensions.get('window');

export default function FuelPriceDetailsScreen() {
  const router = useRouter();
  const { provider, fuelType } = useLocalSearchParams<{ provider: string; fuelType?: string }>();
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null);
  const [currentPrices, setCurrentPrices] = useState<ProviderPrices | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<string | null>(fuelType || null);

  useEffect(() => {
    if (provider) {
      loadData();
    }
  }, [provider]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [history, prices] = await Promise.all([
        fuelPricesApi.getPriceHistory(provider!),
        fuelPricesApi.getProviderPrices(provider!),
      ]);
      setPriceHistory(history);
      setCurrentPrices(prices);
      if (!selectedFuel && prices && prices.fuel && prices.fuel.length > 0) {
        setSelectedFuel(prices.fuel[0].type_alt);
      }
    } catch (error) {
      console.error('Error loading price details:', error);
      Alert.alert('შეცდომა', 'მონაცემების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const getFuelData = () => {
    if (!priceHistory || !selectedFuel) return null;
    return priceHistory.fuel.find((f: any) => f.type_alt === selectedFuel);
  };

  const getCurrentPrice = () => {
    if (!currentPrices || !selectedFuel) return null;
    return currentPrices.fuel.find((f) => f.type_alt === selectedFuel);
  };

  const renderPriceChart = () => {
    const fuelData = getFuelData();
    if (!fuelData || !fuelData.data.length || !priceHistory) return null;

    const prices = fuelData.data.map((p) => parseFloat(p));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{fuelData.name}</Text>
          <Text style={styles.chartSubtitle}>
            {priceHistory.data_labels.length} დღის ისტორია
          </Text>
        </View>
        <View style={styles.chart}>
          {prices.map((price, index) => {
            const height = ((price - minPrice) / range) * 100;
            return (
              <View key={index} style={styles.barContainer}>
                <View style={[styles.bar, { height: `${Math.max(height, 5)}%` }]} />
                <Text style={styles.barLabel}>
                  {priceHistory.data_labels[index]?.split('-')[0] || ''}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.chartStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>მინიმუმი</Text>
            <Text style={styles.statValue}>{minPrice.toFixed(2)}₾</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>მაქსიმუმი</Text>
            <Text style={styles.statValue}>{maxPrice.toFixed(2)}₾</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>საშუალო</Text>
            <Text style={styles.statValue}>
              {(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}₾
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>იტვირთება...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!priceHistory || !currentPrices) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.light.secondary} />
          <Text style={styles.emptyText}>მონაცემები ვერ მოიძებნა</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>უკან დაბრუნება</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentPrice = getCurrentPrice();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{provider}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Price Card */}
        {currentPrice && (
          <View style={styles.currentPriceCard}>
            <LinearGradient
              colors={[Colors.light.primary, '#0EA5E9']}
              style={styles.currentPriceGradient}
            >
              <Text style={styles.currentPriceLabel}>მიმდინარე ფასი</Text>
              <Text style={styles.currentPriceValue}>{currentPrice.price.toFixed(2)}₾</Text>
              <Text style={styles.currentPriceName}>{currentPrice.name}</Text>
              <Text style={styles.currentPriceDate}>
                განახლებულია: {currentPrices.last_updated}
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Fuel Type Selector */}
        <View style={styles.fuelSelectorSection}>
          <Text style={styles.sectionTitle}>საწვავის ტიპი</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.fuelSelectorContainer}>
              {currentPrices.fuel.map((fuel) => (
                <TouchableOpacity
                  key={fuel.type_alt}
                  style={[
                    styles.fuelSelectorButton,
                    selectedFuel === fuel.type_alt && styles.fuelSelectorButtonActive,
                  ]}
                  onPress={() => setSelectedFuel(fuel.type_alt)}
                >
                  <Text
                    style={[
                      styles.fuelSelectorText,
                      selectedFuel === fuel.type_alt && styles.fuelSelectorTextActive,
                    ]}
                  >
                    {fuel.name}
                  </Text>
                  <Text
                    style={[
                      styles.fuelSelectorPrice,
                      selectedFuel === fuel.type_alt && styles.fuelSelectorPriceActive,
                    ]}
                  >
                    {fuel.price.toFixed(2)}₾
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Price History Chart */}
        {renderPriceChart()}

        {/* All Prices List */}
        <View style={styles.allPricesSection}>
          <Text style={styles.sectionTitle}>ყველა ფასი</Text>
          {currentPrices.fuel
            .sort((a, b) => {
              // Sort by type order: regular, super, premium, diesel
              const order: Record<string, number> = {
                'regular': 1,
                'regular_pm': 2,
                'super': 3,
                'super_pm': 3,
                'premium_pm': 4,
                'diesel': 5,
                'diesel_pm': 6,
              };
              return (order[a.type_alt] || 99) - (order[b.type_alt] || 99);
            })
            .map((fuel) => (
              <View key={fuel.type_alt} style={styles.priceItem}>
                <View style={styles.priceItemLeft}>
                  <Text style={styles.priceItemName}>{fuel.name}</Text>
                  <Text style={styles.priceItemType}>{fuel.type_alt}</Text>
                </View>
                <View style={styles.priceItemRight}>
                  <Text style={styles.priceItemValue}>{fuel.price.toFixed(2)}₾</Text>
                  {fuel.change_rate !== 0 && (
                    <View
                      style={[
                        styles.changeBadge,
                        fuel.change_rate > 0 ? styles.changeBadgeUp : styles.changeBadgeDown,
                      ]}
                    >
                      <Ionicons
                        name={fuel.change_rate > 0 ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color="#FFFFFF"
                      />
                      <Text style={styles.changeBadgeText}>
                        {Math.abs(fuel.change_rate).toFixed(2)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.secondary,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontSize: 14,
  },
  currentPriceCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  currentPriceGradient: {
    padding: 24,
    alignItems: 'center',
  },
  currentPriceLabel: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  currentPriceValue: {
    fontSize: 48,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  currentPriceName: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  currentPriceDate: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  fuelSelectorSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
    marginBottom: 12,
  },
  fuelSelectorContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  fuelSelectorButton: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 12,
    minWidth: 120,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  fuelSelectorButtonActive: {
    borderColor: Colors.light.primary,
    backgroundColor: '#E0F2FE',
  },
  fuelSelectorText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
    marginBottom: 4,
  },
  fuelSelectorTextActive: {
    color: Colors.light.primary,
  },
  fuelSelectorPrice: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
  },
  fuelSelectorPriceActive: {
    color: Colors.light.primary,
  },
  chartContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chartHeader: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.secondary,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    marginBottom: 20,
    gap: 4,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',   
    color: Colors.light.secondary,
    marginTop: 4,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.secondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
  },
  allPricesSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  priceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  priceItemLeft: {
    flex: 1,
  },
  priceItemName: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
    marginBottom: 4,
  },
  priceItemType: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.secondary,
  },
  priceItemRight: {
    alignItems: 'flex-end',
  },
  priceItemValue: {
    fontSize: 20,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: Colors.light.text,
    marginBottom: 4,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  changeBadgeUp: {
    backgroundColor: Colors.light.error,
  },
  changeBadgeDown: {
    backgroundColor: Colors.light.success,
  },
  changeBadgeText: {
    fontSize: 10,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
});

