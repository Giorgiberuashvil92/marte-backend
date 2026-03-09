import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { carBrandsApi } from '../../services/carBrandsApi';

const LOCATIONS = ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi', 'Gori', 'Zugdidi', 'Poti', 'Other'];
const YEARS = Array.from({ length: 30 }, (_, i) => (2024 - i).toString());
const PART_CATEGORIES = ['Engine', 'Transmission', 'Body', 'Interior', 'Exterior', 'Electrical', 'Suspension', 'Brakes', 'Wheels', 'Other'];

export type DismantlerFilters = {
  brand: string;
  model: string;
  yearFrom: string;
  yearTo: string;
  location: string;
};

export type PartsFilters = {
  brand: string;
  category: string;
  priceMin: string;
  priceMax: string;
  location: string;
};

type FilterModalProps = {
  visible: boolean;
  activeTab: 'დაშლილები' | 'ნაწილები';
  dismantlerFilters: DismantlerFilters;
  partsFilters: PartsFilters;
  onClose: () => void;
  onApply: (dismantlerFilters: DismantlerFilters, partsFilters: PartsFilters) => void;
  onReset: () => void;
};

export default function FilterModal({
  visible,
  activeTab,
  dismantlerFilters,
  partsFilters,
  onClose,
  onApply,
  onReset,
}: FilterModalProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [carBrands, setCarBrands] = useState<string[]>([]);
  const [carModels, setCarModels] = useState<string[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [partsCategories, setPartsCategories] = useState<string[]>([]);
  const [localDismantlerFilters, setLocalDismantlerFilters] = useState<DismantlerFilters>(dismantlerFilters);
  const [localPartsFilters, setLocalPartsFilters] = useState<PartsFilters>(partsFilters);

  // Load car brands and categories
  useEffect(() => {
    const loadCarData = async () => {
      try {
        const brandsList = await carBrandsApi.getBrandsList();
        setCarBrands(brandsList.map(b => b.name) || []);
        setPartsCategories(PART_CATEGORIES);
      } catch (error) {
        console.error('Error loading car data:', error);
        setCarBrands([]);
        setPartsCategories(PART_CATEGORIES);
      }
    };
    if (visible) {
      loadCarData();
      setLocalDismantlerFilters(dismantlerFilters);
      setLocalPartsFilters(partsFilters);
    }
  }, [visible, dismantlerFilters, partsFilters]);

  // Get models for selected brand
  useEffect(() => {
    const loadModels = async () => {
      if (localDismantlerFilters.brand) {
        try {
          const models = await carBrandsApi.getModelsByBrand(localDismantlerFilters.brand);
          setCarModels(models || []);
        } catch (error) {
          console.error('Error loading models:', error);
          setCarModels([]);
        }
      } else {
        setCarModels([]);
      }
    };
    loadModels();
  }, [localDismantlerFilters.brand]);

  // Get filtered brands based on search
  const filteredBrands = carBrands.filter(brand =>
    brand.toLowerCase().includes(brandSearchQuery.toLowerCase())
  );

  // Render dropdown
  const renderDropdown = (
    id: string,
    value: string,
    placeholder: string,
    options: string[],
    onSelect: (value: string) => void
  ) => {
    const isOpen = openDropdown === id;
    return (
      <View>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setOpenDropdown(isOpen ? null : id)}
        >
          <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
            {value || placeholder}
          </Text>
          <Ionicons
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color="#6B7280"
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dropdownOptions}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect('');
                  setOpenDropdown(null);
                }}
              >
                <Text style={[styles.dropdownItemText, !value && styles.dropdownItemTextSelected]}>
                  ყველა
                </Text>
                {!value && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
              </TouchableOpacity>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dropdownItem}
                  onPress={() => {
                    onSelect(option);
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={[styles.dropdownItemText, value === option && styles.dropdownItemTextSelected]}>
                    {option}
                  </Text>
                  {value === option && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  // Render brand dropdown with search
  const renderBrandDropdown = (
    id: string,
    value: string,
    placeholder: string,
    onSelect: (value: string) => void
  ) => {
    const isOpen = openDropdown === id;
    return (
      <View>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setOpenDropdown(isOpen ? null : id)}
        >
          <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
            {value || placeholder}
          </Text>
          <Ionicons
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color="#6B7280"
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dropdownOptions}>
            <View style={styles.searchSection}>
              <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="ძებნა ბრენდებში..."
                value={brandSearchQuery}
                onChangeText={setBrandSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect('');
                  setOpenDropdown(null);
                  setBrandSearchQuery('');
                }}
              >
                <Text style={[styles.dropdownItemText, !value && styles.dropdownItemTextSelected]}>
                  ყველა
                </Text>
                {!value && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
              </TouchableOpacity>
              {filteredBrands.map((brand, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dropdownItem}
                  onPress={() => {
                    onSelect(brand);
                    setOpenDropdown(null);
                    setBrandSearchQuery('');
                  }}
                >
                  <Text style={[styles.dropdownItemText, value === brand && styles.dropdownItemTextSelected]}>
                    {brand}
                  </Text>
                  {value === brand && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const handleApply = () => {
    onApply(localDismantlerFilters, localPartsFilters);
    onClose();
  };

  const handleReset = () => {
    onReset();
    setLocalDismantlerFilters({
      brand: '',
      model: '',
      yearFrom: '',
      yearTo: '',
      location: '',
    });
    setLocalPartsFilters({
      brand: '',
      category: '',
      priceMin: '',
      priceMax: '',
      location: '',
    });
  };

  const getActiveFiltersCount = () => {
    if (activeTab === 'დაშლილები') {
      return Object.values(localDismantlerFilters).filter(v => v).length;
    } else {
      return Object.values(localPartsFilters).filter(v => v).length;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.content} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.title}>ფილტრები</Text>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetText}>გასუფთავება</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Dismantler Filters */}
            {activeTab === 'დაშლილები' && (
              <>
                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>ბრენდი</Text>
                  {renderBrandDropdown(
                    'dismantler-brand',
                    localDismantlerFilters.brand,
                    'აირჩიეთ ბრენდი',
                    (value) => setLocalDismantlerFilters(prev => ({ ...prev, brand: value, model: '' }))
                  )}
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>მოდელი</Text>
                  <View style={[styles.dropdownContainer, !localDismantlerFilters.brand && styles.dropdownDisabled]}>
                    {renderDropdown(
                      'dismantler-model',
                      localDismantlerFilters.model,
                      localDismantlerFilters.brand ? 'აირჩიეთ მოდელი' : 'ჯერ აირჩიეთ ბრენდი',
                      carModels,
                      (value) => setLocalDismantlerFilters(prev => ({ ...prev, model: value }))
                    )}
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>წელი</Text>
                  <View style={styles.yearRangeContainer}>
                    <View style={styles.yearInputWrapper}>
                      <Text style={styles.yearLabel}>წლიდან</Text>
                      {renderDropdown(
                        'dismantler-year-from',
                        localDismantlerFilters.yearFrom,
                        'წელი',
                        YEARS,
                        (value) => setLocalDismantlerFilters(prev => ({ ...prev, yearFrom: value }))
                      )}
                    </View>
                    <View style={styles.yearInputWrapper}>
                      <Text style={styles.yearLabel}>წლამდე</Text>
                      {renderDropdown(
                        'dismantler-year-to',
                        localDismantlerFilters.yearTo,
                        'წელი',
                        YEARS,
                        (value) => setLocalDismantlerFilters(prev => ({ ...prev, yearTo: value }))
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>მდებარეობა</Text>
                  {renderDropdown(
                    'dismantler-location',
                    localDismantlerFilters.location,
                    'აირჩიეთ ქალაქი',
                    LOCATIONS,
                    (value) => setLocalDismantlerFilters(prev => ({ ...prev, location: value }))
                  )}
                </View>
              </>
            )}

            {/* Parts Filters */}
            {activeTab === 'ნაწილები' && (
              <>
                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>კატეგორია</Text>
                  {renderDropdown(
                    'parts-category',
                    localPartsFilters.category,
                    'აირჩიეთ კატეგორია',
                    partsCategories,
                    (value) => setLocalPartsFilters(prev => ({ ...prev, category: value }))
                  )}
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>ბრენდი</Text>
                  {renderBrandDropdown(
                    'parts-brand',
                    localPartsFilters.brand,
                    'აირჩიეთ ბრენდი',
                    (value) => setLocalPartsFilters(prev => ({ ...prev, brand: value }))
                  )}
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>ფასი (₾)</Text>
                  <View style={styles.priceInputsContainer}>
                    <View style={styles.priceInputWrapper}>
                      <Text style={styles.priceInputLabel}>დან</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={localPartsFilters.priceMin}
                        onChangeText={(text) => setLocalPartsFilters(prev => ({ ...prev, priceMin: text }))}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    <View style={styles.priceSeparator} />
                    <View style={styles.priceInputWrapper}>
                      <Text style={styles.priceInputLabel}>მდე</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={localPartsFilters.priceMax}
                        onChangeText={(text) => setLocalPartsFilters(prev => ({ ...prev, priceMax: text }))}
                        placeholder="9999"
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>მდებარეობა</Text>
                  {renderDropdown(
                    'parts-location',
                    localPartsFilters.location,
                    'აირჩიეთ ქალაქი',
                    LOCATIONS,
                    (value) => setLocalPartsFilters(prev => ({ ...prev, location: value }))
                  )}
                </View>
              </>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Apply Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.8}>
              <Text style={styles.applyButtonText}>
                {getActiveFiltersCount() > 0
                  ? `გამოყენება (${getActiveFiltersCount()})`
                  : 'გამოყენება'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Scroll
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Filter Section
  filterSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  // Dropdown
  dropdownContainer: {
    position: 'relative',
  },
  dropdownDisabled: {
    opacity: 0.5,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
    maxHeight: 300,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  // Search
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    margin: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 12,
  },
  // Year Range
  yearRangeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  yearInputWrapper: {
    flex: 1,
  },
  yearLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  // Price Inputs
  priceInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  priceInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '500',
    color: '#111827',
  },
  priceSeparator: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginTop: 24,
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  applyButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
