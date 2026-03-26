import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { fuelPricesApi, ProviderPrices, FuelType, LowestPrice } from '../services/fuelPricesApi';

/** აპის სტანდარტული ფონტი (იგივე რაც მთავარ ეკრანზე — _layout.tsx / HelveticaMedium) */
const FONT = 'HelveticaMedium' as const;

const PROVIDER_LOGOS: Record<string, string> = {
  'Gulf': 'https://gulf.ge/img/logo_main_ge.png',
  'Wissol': 'data:image/png;base64,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',
  'Socar': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAANCAMAAADL710yAAAAtFBMVEX///8AAABZWVldXV3z8/O/v79CQkJWVlZzc3Po6Ojw8PDe3t61tbXJyclPT0+EhIRISEgtLS0yMjJiYmJ5eXlra2ugoKDvM0A5lQDzdHv96+x7zuvuBSEAr+DA7v33fIHuHjCg2vDk/v+NjY3/zc1kyer0ZnDf9OOZwovV1dXvKDf/ztWfypcLCwv84OH3gort/vQhISH3qKxRnzFEmRr2naG61bHtAAB+t3BepELp8ebF275225y7AAABU0lEQVQokZ2S7XqCMAyFc1qRD0EQoYDTyYZzg41tTvd9//e1pOgugP4o7ZO86ckJRETVisasK6rWo8jN9bbens8zF5iGfAg8IJUDRVPAs7H53OdP7CrX9SKim81tUXQDNwHcpeQFwGIONEQhkCzQC2HvpJAmXCuizdWuvoAhFNMcXiIm8gGfJIWyPCBCmoJzNBwig4zuqCu6/f2DgA6QG07k9AnvGUyLxbkLB00jRSzYSOGqK9aPT6WNZpDVsmS5GTQO9BnUaFu5aPR9L1qe10X98lqWkyHehpofAYLLi4f/9v1AhGgozwp66+qKjscTWS/ZtxlSysXI2dAjexvngbFaYKxUJUrf6z1z5YeACVvoSpTr91PrYsRjObDyA8t2DNuruJK1bfe5+joNHNvKM5g7oizrkTh2fDyfmHxle9XKbzQ7ZLThJ+n4/TPmzyH6HcP9AUeMFWZAqmXaAAAAAElFTkSuQmCC',
  'Rompetrol': 'data:image/jpeg;base64,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',
  'Lukoil': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAAeFBMVEX////tGzTsABbsABnsABP85Ob96ev83+D729ztDi3xY27sACTtEi/sAA797O3uNUf2qq798vPvTVvrAAD++vr3r7LtKDz4vsLwXGf4ub32o6jsAB/xa3TsACjuLUHvQlH0lZr5yMr0jJLzfITzgor61NX1nKHydH3KJeXXAAAB7ElEQVRIidWWi3LiIBSGuUQDC6i5NMbQ1Earff833IQDVTEidHan03+c8XD5BA8/F4R+QPUiWbUB84okqloacEFworL/CMrZ4i0o6JviJiLmM4qrfS8uGG32St6B9Dzmt5xIzhBiUwfejtnrqOPIFqFVIz2Qv5p4/H29nYKtHudgsv4K08DifSox6oFiZ+KWY7KagkJhWZqqjZssrLoPwjjoz0MwG74H8ha4TiSCmamdqn1wFwTFGbkcJIGyAW4gdwYIg8pmZsY5QdAuMjqIRJAW0FHNmFwEQNHBgHuZCPbA7b5cGwnSo/muNU4E1QYGfAC+PAa7b4IUbFqQVFCohQncxowH+w8TDPNZDYBYwwGcPFXXeBapoFybaJWlgjg7mbDlz8G6cqfFBNrtMegQSJmJukrBMO/92Kxgf/QhUIDDvlROewIOVXToA6Dc33BLWD0OXbMAiOn2GrR+sadgeXd3XIFYLy+cuzpsisHpN+DmAkoxOO7glg6r3FTQEDi2lLtlXbAzv1xy1rAf/Tx4FNKIa1VVxBZAmTEsI/Ng0a4fqYEsrKUHdihOL2L2Yn2uOvOuclJHkp/8Fowe8kS9V4c+RpKN9N45Pe5O7LnyA797IAlNI+T9xxT9PjCvYlJyLfvQrVmeKBbrsn+qvyGdLlmDzHwgAAAAAElFTkSuQmCC',
  'Connect': 'https://connect.com.ge/wp-content/uploads/2025/07/Connect_Brand-Book-1-4-800x154.png',
  'Portal': 'data:image/jpeg;base64,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',
};

const PROVIDER_EMOJIS: Record<string, string> = {
  'Wissol': '🔵',
  'Socar': '🔴',
  'Rompetrol': '🟡',
  'Lukoil': '🟠',
  'Portal': '🟣',
  'Connect': '⚪',
};

const FUEL_TYPES = [
  { 
    id: 'regular', 
    name: 'რეგულარი', 
    typeAlt: 'regular', 
    color: '#0EA5E9', 
    icon: 'flash', 
  },
  { 
    id: 'regular_pm', 
    name: 'ევრო რეგულარი', 
    typeAlt: 'regular_pm', 
    color: '#0EA5E9', 
    icon: 'flash', 
  },
  { 
    id: 'super', 
    name: 'სუპერი', 
    /** petrol.com.ge API: სუპერი = super_pm (არა super) */
    typeAlt: 'super_pm', 
    color: '#8B5CF6', 
    icon: 'star', 
  },
  { 
    id: 'premium_pm', 
    name: 'პრემიუმი', 
    typeAlt: 'premium_pm', 
    color: '#3B82F6', 
    icon: 'diamond', 
  },
  { 
    id: 'diesel', 
    name: 'დიზელი', 
    typeAlt: 'diesel', 
    color: '#F59E0B', 
    icon: 'settings', 
  },
  { 
    id: 'diesel_pm', 
    name: 'ევრო დიზელი', 
    typeAlt: 'diesel_pm', 
    color: '#F59E0B', 
    icon: 'settings', 
  },
];

interface StationData {
  provider: string;
  price: number;
  fuelName: string;
  typeAlt: string;
}

/** Portal სადგურზე Marte აპით — ყველა საწვავის ტიპი ჩამონათვალიდან (ლარში) */
const PORTAL_DISCOUNT_GEL = 0.17;

const PORTAL_DISCOUNT_TYPE_ALTS = new Set([
  ...FUEL_TYPES.map((f) => f.typeAlt),
  'super', // თუ სადმე ჯერ კიდევ super მოდის
]);

function isPortalDiscountFuel(typeAlt: string): boolean {
  return PORTAL_DISCOUNT_TYPE_ALTS.has(typeAlt);
}

export default function FuelStationsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedFuelType, setSelectedFuelType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPrices, setCurrentPrices] = useState<ProviderPrices[]>([]);
  const [lowestPrices, setLowestPrices] = useState<LowestPrice[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // უნიკალური მომწოდებლები — პორტალი ყოველთვის პირველი
  const providers = (() => {
    const unique = [...new Set(currentPrices.map((p) => p.provider))];
    return [
      ...unique.filter((p) => p === 'Portal'),
      ...unique.filter((p) => p !== 'Portal'),
    ];
  })();

  // Get available fuel types for selected provider
  const getAvailableFuelTypes = () => {
    if (!selectedProvider) {
      // If no provider selected, show all fuel types
      return FUEL_TYPES;
    }
    
    // Get fuel types available for selected provider
    const providerData = currentPrices.find(p => p.provider === selectedProvider);
    if (!providerData) return FUEL_TYPES;
    
    const availableTypeAlts = providerData.fuel.map(f => f.type_alt);
    return FUEL_TYPES.filter(ft => availableTypeAlts.includes(ft.typeAlt));
  };

  const availableFuelTypes = getAvailableFuelTypes();
  
  // When provider is selected, don't show fuel type filter (show all types)
  // When no provider selected, show fuel type filter

  const loadData = useCallback(async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const [prices, lowest, types] = await Promise.all([
        fuelPricesApi.getCurrentPrices(),
        fuelPricesApi.getLowestPrices(),
        fuelPricesApi.getFuelTypes(),
      ]);
      setCurrentPrices(prices);
      setLowestPrices(lowest);
      setFuelTypes(types);
      
      // ნაგულისხმევად მონიშნული ყოველთვის პორტალი (თუ მონაცემებშია)
      setSelectedProvider((prev) => {
        if (prev === null && prices.length > 0) {
          const portal = prices.find((p) => p.provider === 'Portal');
          if (portal) return 'Portal';
          const gulf = prices.find((p) => p.provider === 'Gulf');
          if (gulf) return 'Gulf';
          return prices[0].provider;
        }
        return prev;
      });
    } catch (error) {
      console.error('Error loading fuel prices:', error);
      Alert.alert('შეცდომა', 'ფასების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && currentPrices.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [loading, currentPrices.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleFuelTypeChange = useCallback((typeAlt: string) => {
    setSelectedFuelType(typeAlt);
  }, []);

  const handleProviderSelect = useCallback((provider: string) => {
    const wasSelected = selectedProvider === provider;
    setSelectedProvider(wasSelected ? null : provider);
    
    // When provider is selected, show all fuel types (clear fuel type filter)
    if (!wasSelected) {
      setSelectedFuelType(null);
    }
  }, [selectedProvider]);

  const getSortedStations = (): StationData[] => {
    const stations: StationData[] = [];
    
    currentPrices.forEach((provider) => {
      // Filter by selected provider if any
      if (selectedProvider && provider.provider !== selectedProvider) {
        return;
      }
      
      // If provider is selected, show all its fuel types
      // If no provider selected, filter by selectedFuelType
      provider.fuel
        .filter((f) => {
          if (selectedProvider) {
            // Show all fuel types for selected provider
            return true;
          }
          // If no provider selected, filter by fuel type
          return !selectedFuelType || f.type_alt === selectedFuelType;
        })
        .forEach((fuel) => {
          stations.push({
            provider: provider.provider,
            price: fuel.price,
            fuelName: fuel.name,
            typeAlt: fuel.type_alt,
          });
        });
    });
    
    let filtered = stations;
    if (searchQuery) {
      filtered = stations.filter((station) =>
        station.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        station.fuelName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // პორტალი ყოველთვის ზედა ნაწილში, შემდეგ არსებული წესი (სახელი/ფასი)
    return filtered.sort((a, b) => {
      const aPortal = a.provider === 'Portal' ? 0 : 1;
      const bPortal = b.provider === 'Portal' ? 0 : 1;
      if (aPortal !== bPortal) return aPortal - bPortal;

      if (selectedProvider) {
        return a.fuelName.localeCompare(b.fuelName) || a.price - b.price;
      }
      return a.price - b.price;
    });
  };

  const getCheapestPrice = (typeAlt: string): number | null => {
    const lowest = lowestPrices.find((lp) => {
      const fuelType = fuelTypes.find((ft) => ft.type_alt === typeAlt);
      return lp.fuel_type === fuelType?.name;
    });
    return lowest?.price || null;
  };

  const handleLogoError = (provider: string) => {
    setLogoErrors(prev => ({ ...prev, [provider]: true }));
  };

  const renderFuelStation = (station: StationData, index: number) => {
    const cheapestPrice = getCheapestPrice(station.typeAlt);
    const isCheapest = cheapestPrice ? station.price === cheapestPrice : false;
    const logoUrl = PROVIDER_LOGOS[station.provider] || 'https://logo.clearbit.com/example.com';
    const emojiFallback = PROVIDER_EMOJIS[station.provider] || '⛽';
    const hasLogoError = logoErrors[station.provider];
    const priceDiff = cheapestPrice ? ((station.price - cheapestPrice) / cheapestPrice * 100) : 0;
    const showMartePortalDiscount =
      station.provider === 'Portal' && isPortalDiscountFuel(station.typeAlt);
    const martePortalPrice = showMartePortalDiscount
      ? Math.max(0, station.price - PORTAL_DISCOUNT_GEL)
      : null;

    return (
      <Animated.View 
        key={`${station.provider}-${station.fuelName}-${index}`}
        style={[styles.stationCard, { opacity: fadeAnim }]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            router.push(`/fuel-price-details?provider=${encodeURIComponent(station.provider)}&fuelType=${encodeURIComponent(station.typeAlt)}` as any);
          }}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardLeft}>
              <View style={styles.logoContainer}>
                {hasLogoError ? (
                  <Text style={styles.logoEmoji}>{emojiFallback}</Text>
                ) : (
                  <Image 
                    source={{ uri: logoUrl }} 
                    style={styles.logoImage}
                    resizeMode="contain"
                    onError={() => handleLogoError(station.provider)}
                  />
                )}
              </View>
              <View style={styles.infoContainer}>
                <View style={styles.providerRow}>
                  <Text style={styles.providerName}>{station.provider}</Text>
                  {isCheapest && (
                    <View style={styles.bestBadge}>
                      <Ionicons name="trophy" size={12} color="#FFFFFF" />
                      <Text style={styles.bestBadgeText}>ყველაზე იაფი</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.fuelName}>{station.fuelName}</Text>
                {showMartePortalDiscount && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() =>
                      router.push('/exclusive-fuel-offer' as any)
                    }
                    style={styles.portalChipTouchable}
                  >
                    <LinearGradient
                      colors={['#1D4ED8', '#3B82F6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.portalChip}
                    >
                      <Ionicons name="sparkles" size={12} color="#FDE047" />
                      <Text style={styles.portalChipText}>აიღე Marte-ს ბარათი</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <View style={styles.cardRight}>
              <Text style={styles.priceValue}>{station.price.toFixed(2)}</Text>
              <Text style={styles.priceCurrency}>₾/ლ</Text>
              {martePortalPrice !== null && (
                <View style={styles.portalPriceBlock}>
                  <Text style={styles.portalPriceLabel}>ბარათით</Text>
                  <Text style={styles.portalPriceValue}>
                    {martePortalPrice.toFixed(2)} ₾
                  </Text>
                </View>
              )}
              {priceDiff > 0 && !isCheapest && (
                <Text style={styles.priceDiff}>+{priceDiff.toFixed(1)}%</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>საწვავის ფასები</Text>
              <Text style={styles.headerSubtitle}>{getSortedStations().length} ხელმისაწვდომი</Text>
            </View>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="ძებნა..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.portalPromoCard}
          activeOpacity={0.88}
          onPress={() => router.push('/exclusive-fuel-offer' as any)}
        >
          <View style={styles.portalPromoStripe} />
          <View style={styles.portalPromoInner}>
            <View style={styles.portalPromoIconWrap}>
              <Ionicons name="card-outline" size={22} color="#2563EB" />
            </View>
            <View style={styles.portalPromoTextCol}>
              <Text style={styles.portalPromoTitle}>აიღე Marte-ს ბარათი</Text>
              <Text style={styles.portalPromoSub}>
                −17 თეთრი ყველა საწვავზე · ბენზინი და დიზელი
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Providers Carousel */}
      {!loading && providers.length > 0 && (
        <View style={styles.providersSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.providersContent}
          >
            {providers.map((provider) => {
              const isSelected = selectedProvider === provider;
              const logoUrl = PROVIDER_LOGOS[provider];
              const emojiFallback = PROVIDER_EMOJIS[provider] || '⛽';
              const hasLogoError = logoErrors[provider];
              
              return (
                <TouchableOpacity
                  key={provider}
                  style={[
                    styles.providerCard,
                    isSelected && styles.providerCardActive,
                  ]}
                  onPress={() => handleProviderSelect(provider)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.providerIconContainer,
                    isSelected && { backgroundColor: `${'#3B82F6'}15` }
                  ]}>
                    {hasLogoError ? (
                      <Text style={styles.providerEmoji}>{emojiFallback}</Text>
                    ) : (
                      <Image
                        source={{ uri: logoUrl }}
                        style={styles.providerLogo}
                        resizeMode="contain"
                        onError={() => handleLogoError(provider)}
                      />
                    )}
                  </View>
                  {isSelected && (
                    <View style={styles.providerIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Fuel Type Filter Buttons - Only show when no provider is selected */}
      {!selectedProvider && (
        <View style={styles.fuelTypesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fuelTypesContent}
          >
            {FUEL_TYPES.map((fuelType) => {
              const isActive = selectedFuelType === fuelType.typeAlt;
              return (
                <TouchableOpacity
                  key={fuelType.id}
                  style={[
                    styles.fuelTypeButton,
                    isActive && styles.fuelTypeButtonActive,
                    isActive && { borderColor: fuelType.color },
                  ]}
                  onPress={() => handleFuelTypeChange(fuelType.typeAlt)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.fuelTypeText,
                    isActive && { color: fuelType.color },
                  ]}>
                    {fuelType.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>იტვირთება...</Text>
          </View>
        ) : getSortedStations().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>მონაცემები ვერ მოიძებნა</Text>
            <Text style={styles.emptySubtitle}>სცადეთ სხვა საწვავის ტიპი</Text>
          </View>
        ) : (
          <View style={styles.stationsList}>
            {getSortedStations().map((station, index) => renderFuelStation(station, index))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONT,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: FONT,
    color: '#6B7280',
    marginTop: 6,
  },
  headerPortalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  headerPortalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerPortalBadgeText: {
    fontSize: 11,
    fontFamily: FONT,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.8,
  },
  headerPortalHint: {
    fontSize: 13,
    fontFamily: FONT,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  portalPromoCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EEE9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  portalPromoStripe: {
    width: 4,
    backgroundColor: '#3B82F6',
  },
  portalPromoInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  portalPromoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalPromoTextCol: {
    flex: 1,
  },
  portalPromoTitle: {
    fontSize: 15,
    fontFamily: FONT,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  portalPromoSub: {
    fontSize: 11,
    fontFamily: FONT,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 15,
  },
  portalChipTouchable: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  portalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: '100%',
  },
  portalChipText: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  portalPriceBlock: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  portalPriceLabel: {
    fontSize: 9,
    fontFamily: FONT,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  portalPriceValue: {
    fontSize: 14,
    fontFamily: FONT,
    fontWeight: '800',
    color: '#1D4ED8',
    marginTop: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT,
    color: '#111827',
  },
  providersSection: {
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  providersContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  providerCard: {
    alignItems: 'center',
    width: 80,
  },
  providerCardActive: {
    opacity: 1,
  },
  providerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  providerLogo: {
    width: 48,
    height: 48,
  },
  providerEmoji: {
    fontSize: 32,
  },
  providerIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
  },
  fuelTypesSection: {
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  fuelTypesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  fuelTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  fuelTypeButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  fuelTypeText: {
    fontSize: 13,
    fontFamily: FONT,
    fontWeight: '600',
    color: '#6B7280',
  },
  content: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    paddingTop: 16,
  },
  stationsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  stationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  logoEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  providerName: {
    fontSize: 16,
    fontFamily: FONT,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  bestBadgeText: {
    fontSize: 10,
    fontFamily: FONT,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fuelName: {
    fontSize: 13,
    fontFamily: FONT,
    color: '#6B7280',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priceValue: {
    fontSize: 22,
    fontFamily: FONT,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  priceCurrency: {
    fontSize: 12,
    fontFamily: FONT,
    fontWeight: '500',
    color: '#6B7280',
  },
  priceDiff: {
    fontSize: 11,
    fontFamily: FONT,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 15,
    fontFamily: FONT,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONT,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONT,
    color: '#6B7280',
    textAlign: 'center',
  },
});
