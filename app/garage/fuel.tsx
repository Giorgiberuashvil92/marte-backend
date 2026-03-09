import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../contexts/CarContext';
import { FuelEntry } from '../../services/garageApi';

const { width } = Dimensions.get('window');

const MONTHS = [
  { id: 'all', label: 'ყველა' },
  { id: '0', label: 'იანვარი' },
  { id: '1', label: 'თებერვალი' },
  { id: '2', label: 'მარტი' },
  { id: '3', label: 'აპრილი' },
  { id: '4', label: 'მაისი' },
  { id: '5', label: 'ივნისი' },
  { id: '6', label: 'ივლისი' },
  { id: '7', label: 'აგვისტო' },
  { id: '8', label: 'სექტემბერი' },
  { id: '9', label: 'ოქტომბერი' },
  { id: '10', label: 'ნოემბერი' },
  { id: '11', label: 'დეკემბერი' },
];

export default function FuelScreen() {
  const router = useRouter();
  const { selectedCar, fuelEntries } = useCars();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const carFuelEntries = selectedCar
    ? fuelEntries.filter(f => f.carId === selectedCar.id)
    : [];

  // Filter by month
  const filteredByMonth = useMemo(() => {
    if (selectedMonth === 'all') return carFuelEntries;
    const month = parseInt(selectedMonth);
    return carFuelEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month;
    });
  }, [carFuelEntries, selectedMonth]);

  // Filter by search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return filteredByMonth;
    const query = searchQuery.toLowerCase();
    return filteredByMonth.filter(entry => {
      const dateStr = new Date(entry.date).toLocaleDateString('ka-GE');
      const mileageStr = entry.mileage.toString();
      const litersStr = entry.liters.toString();
      const priceStr = entry.totalPrice.toString();
      return (
        dateStr.toLowerCase().includes(query) ||
        mileageStr.includes(query) ||
        litersStr.includes(query) ||
        priceStr.includes(query)
      );
    });
  }, [filteredByMonth, searchQuery]);

  // Get last 5 entries for carousel
  const recentEntries = carFuelEntries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Calculate stats
  const totalLiters = filteredEntries.reduce((sum, entry) => sum + entry.liters, 0);
  const totalCost = filteredEntries.reduce((sum, entry) => sum + entry.totalPrice, 0);
  const avgPrice = filteredEntries.length > 0
    ? (totalCost / totalLiters).toFixed(2)
    : '0.00';

  if (!selectedCar) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>მანქანა არ არის არჩეული</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(tabs)/garage')}
          >
            <Text style={styles.addButtonText}>გარაჟში დაბრუნება</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header with Search */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="ძიება..."
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
          style={styles.headerButton}
          onPress={() => {
            // TODO: Add fuel entry
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Horizontal Carousel - Recent Entries */}
        {recentEntries.length > 0 && (
          <View style={styles.carouselSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {recentEntries.map((entry, index) => (
                <View key={entry.id} style={styles.carouselCard}>
                  <View style={styles.carouselIcon}>
                    <Ionicons name="water-outline" size={32} color="#3B82F6" />
                  </View>
                  <Text style={styles.carouselTitle} numberOfLines={1}>
                    {new Date(entry.date).toLocaleDateString('ka-GE', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Filter Buttons */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {MONTHS.slice(0, 5).map((month) => (
              <TouchableOpacity
                key={month.id}
                style={[
                  styles.filterButton,
                  selectedMonth === month.id && styles.filterButtonActive,
                ]}
                onPress={() => setSelectedMonth(month.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedMonth === month.id && styles.filterTextActive,
                  ]}
                >
                  {month.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats Summary */}
        {filteredEntries.length > 0 && (
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalLiters.toFixed(1)}</Text>
              <Text style={styles.statLabel}>ლიტრი</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalCost.toFixed(2)}₾</Text>
              <Text style={styles.statLabel}>სულ</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{avgPrice}₾</Text>
              <Text style={styles.statLabel}>საშ.</Text>
            </View>
          </View>
        )}

        {/* Fuel Entries List */}
        {filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="water-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>საწვავის ჩანაწერები არ არის</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedMonth !== 'all'
                ? 'ფილტრის შეცვლა სცადე'
                : 'დაამატე საწვავის ჩანაწერი და დაიწყე ტრეკინგი'}
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            {filteredEntries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.listItem}
                activeOpacity={0.7}
              >
                <View style={styles.listItemIcon}>
                  <Ionicons name="water" size={24} color="#3B82F6" />
                </View>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>
                    {new Date(entry.date).toLocaleDateString('ka-GE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.listItemSubtitle}>
                    {entry.mileage.toLocaleString()} კმ • {entry.liters} ლ
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemPrice}>{entry.totalPrice.toFixed(2)}₾</Text>
                  <Text style={styles.listItemPricePerLiter}>
                    {entry.pricePerLiter.toFixed(2)}₾/ლ
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          // TODO: Add fuel entry
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  carouselSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  carouselCard: {
    width: width * 0.28,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  carouselIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  carouselTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  filterSection: {
    marginVertical: 16,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  listSection: {
    paddingHorizontal: 16,
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  listItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  listItemPricePerLiter: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
