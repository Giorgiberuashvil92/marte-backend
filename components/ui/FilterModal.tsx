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
/** ნაწილების კატეგორიები (UI / API ფილტრი — იგივე სტრიქონი იგზავნება backend-ზე) */
const PART_CATEGORIES = [
  'ძრავი და მისი ნაწილები',
  'აალების და დაქოქვის სისტემა',
  'გაგრილების სისტემა',
  'გამშვები სისტემა',
  'კონდიციონერი და გამათბობელი',
  'საწვავის მიწოდების სისტემა',
  'ტურბო და კომპონენტები',
  'ღვედი, დამჭიმი, შკივი',
  'შემშვები სისტემა',
  'ჩობალი, შუასადები (სალნიკი, პრაკლადკა)',
  'ძრავის ელექტროობა',
  'ძრავის ზეთის ხუფი',
  'სხვა',
];

export type DismantlerFilters = {
  brand: string;
  model: string;
  yearFrom: string;
  yearTo: string;
  location: string;
};

export type PartsFilters = {
  brand: string;
  model: string;
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
  const [dismantlerModels, setDismantlerModels] = useState<string[]>([]);
  const [partsModels, setPartsModels] = useState<string[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [partsCategories, setPartsCategories] = useState<string[]>([]);
  const [localDismantlerFilters, setLocalDismantlerFilters] = useState<DismantlerFilters>(dismantlerFilters);
  const [localPartsFilters, setLocalPartsFilters] = useState<PartsFilters>(partsFilters);
  /** აკორდეონი: ნაგულისხმევად ყველაფერი ჩაკეცილი */
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
      setExpandedSection(null);
      setOpenDropdown(null);
      setBrandSearchQuery('');
    }
  }, [visible, dismantlerFilters, partsFilters]);

  // მოდელები — დაშლილები
  useEffect(() => {
    const loadModels = async () => {
      if (localDismantlerFilters.brand) {
        try {
          const models = await carBrandsApi.getModelsByBrand(localDismantlerFilters.brand);
          setDismantlerModels(models || []);
        } catch (error) {
          console.error('Error loading dismantler models:', error);
          setDismantlerModels([]);
        }
      } else {
        setDismantlerModels([]);
      }
    };
    loadModels();
  }, [localDismantlerFilters.brand]);

  // მოდელები — ნაწილები
  useEffect(() => {
    const loadModels = async () => {
      if (localPartsFilters.brand) {
        try {
          const models = await carBrandsApi.getModelsByBrand(localPartsFilters.brand);
          setPartsModels(models || []);
        } catch (error) {
          console.error('Error loading parts models:', error);
          setPartsModels([]);
        }
      } else {
        setPartsModels([]);
      }
    };
    loadModels();
  }, [localPartsFilters.brand]);

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
      model: '',
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

  const toggleSection = (id: string) => {
    setOpenDropdown(null);
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const Collapsible = ({
    sectionId,
    title,
    summary,
    children,
  }: {
    sectionId: string;
    title: string;
    summary: string;
    children: React.ReactNode;
  }) => {
    const open = expandedSection === sectionId;
    return (
      <View style={styles.accordionBlock}>
        <TouchableOpacity
          style={[styles.accordionHeader, open && styles.accordionHeaderOpen]}
          onPress={() => toggleSection(sectionId)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionHeaderText}>
            <Text style={styles.accordionTitle}>{title}</Text>
            <Text style={styles.accordionSummary} numberOfLines={1}>
              {summary}
            </Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
        </TouchableOpacity>
        {open ? <View style={styles.accordionBody}>{children}</View> : null}
      </View>
    );
  };

  const dismantlerCarSummary = (() => {
    const b = localDismantlerFilters.brand;
    const m = localDismantlerFilters.model;
    if (!b && !m) return 'არ არის არჩეული';
    return [b, m].filter(Boolean).join(' · ') || '—';
  })();

  const dismantlerYearSummary = (() => {
    const a = localDismantlerFilters.yearFrom;
    const b = localDismantlerFilters.yearTo;
    if (!a && !b) return 'არ არის არჩეული';
    if (a && b) return `${a} — ${b}`;
    return a || b || '—';
  })();

  const dismantlerLocSummary = localDismantlerFilters.location || 'ყველა ქალაქი';

  const partsCatBrandSummary = (() => {
    const c = localPartsFilters.category;
    const b = localPartsFilters.brand;
    const m = localPartsFilters.model;
    if (!c && !b && !m) return 'არ არის არჩეული';
    return [c, b, m].filter(Boolean).join(' · ') || '—';
  })();

  const partsPriceSummary = (() => {
    const a = localPartsFilters.priceMin;
    const b = localPartsFilters.priceMax;
    if (!a && !b) return 'შეზღუდვა არაა';
    if (a && b) return `${a}₾ — ${b}₾`;
    return a ? `დან ${a}₾` : `მდე ${b}₾`;
  })();

  const partsLocSummary = localPartsFilters.location || 'ყველა ქალაქი';

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

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Text style={styles.hintText}>
              დააჭირე ბლოკს რომ გაშალო — ნაგულისხმევად ფილტრები ჩაკეცილია.
            </Text>

            {/* Dismantler Filters — ჩაკეცილი ჯგუფები */}
            {activeTab === 'დაშლილები' && (
              <>
                <Collapsible
                  sectionId="dism-car"
                  title="მანქანა"
                  summary={dismantlerCarSummary}
                >
                  <Text style={styles.inlineLabel}>ბრენდი</Text>
                  {renderBrandDropdown(
                    'dismantler-brand',
                    localDismantlerFilters.brand,
                    'აირჩიეთ ბრენდი',
                    (value) => setLocalDismantlerFilters(prev => ({ ...prev, brand: value, model: '' }))
                  )}
                  <Text style={[styles.inlineLabel, styles.inlineLabelSpaced]}>მოდელი</Text>
                  <View style={[styles.dropdownContainer, !localDismantlerFilters.brand && styles.dropdownDisabled]}>
                    {renderDropdown(
                      'dismantler-model',
                      localDismantlerFilters.model,
                      localDismantlerFilters.brand ? 'აირჩიეთ მოდელი' : 'ჯერ აირჩიეთ ბრენდი',
                      dismantlerModels,
                      (value) => setLocalDismantlerFilters(prev => ({ ...prev, model: value }))
                    )}
                  </View>
                </Collapsible>

                <Collapsible sectionId="dism-year" title="წელი" summary={dismantlerYearSummary}>
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
                </Collapsible>

                <Collapsible sectionId="dism-loc" title="მდებარეობა" summary={dismantlerLocSummary}>
                  {renderDropdown(
                    'dismantler-location',
                    localDismantlerFilters.location,
                    'აირჩიეთ ქალაქი',
                    LOCATIONS,
                    (value) => setLocalDismantlerFilters(prev => ({ ...prev, location: value }))
                  )}
                </Collapsible>
              </>
            )}

            {/* Parts Filters — ჩაკეცილი ჯგუფები */}
            {activeTab === 'ნაწილები' && (
              <>
                <Collapsible sectionId="parts-cat" title="კატეგორია, ბრენდი და მოდელი" summary={partsCatBrandSummary}>
                  <Text style={styles.inlineLabel}>კატეგორია</Text>
                  {renderDropdown(
                    'parts-category',
                    localPartsFilters.category,
                    'აირჩიეთ კატეგორია',
                    partsCategories,
                    (value) => setLocalPartsFilters(prev => ({ ...prev, category: value }))
                  )}
                  <Text style={[styles.inlineLabel, styles.inlineLabelSpaced]}>ბრენდი</Text>
                  {renderBrandDropdown(
                    'parts-brand',
                    localPartsFilters.brand,
                    'აირჩიეთ ბრენდი',
                    (value) => setLocalPartsFilters(prev => ({ ...prev, brand: value, model: '' }))
                  )}
                  <Text style={[styles.inlineLabel, styles.inlineLabelSpaced]}>მოდელი</Text>
                  <View style={[styles.dropdownContainer, !localPartsFilters.brand && styles.dropdownDisabled]}>
                    {renderDropdown(
                      'parts-model',
                      localPartsFilters.model,
                      localPartsFilters.brand ? 'აირჩიეთ მოდელი' : 'ჯერ აირჩიეთ ბრენდი',
                      partsModels,
                      (value) => setLocalPartsFilters(prev => ({ ...prev, model: value }))
                    )}
                  </View>
                </Collapsible>

                <Collapsible sectionId="parts-price" title="ფასი (₾)" summary={partsPriceSummary}>
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
                </Collapsible>

                <Collapsible sectionId="parts-loc" title="მდებარეობა" summary={partsLocSummary}>
                  {renderDropdown(
                    'parts-location',
                    localPartsFilters.location,
                    'აირჩიეთ ქალაქი',
                    LOCATIONS,
                    (value) => setLocalPartsFilters(prev => ({ ...prev, location: value }))
                  )}
                </Collapsible>
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
  hintText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 17,
  },
  /** overflow არ ვჭრით — absolute dropdown-ები აკორდეონში იჭრებოდა; ინლაინ სია მაინც ფიტავს */
  accordionBlock: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'visible',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  accordionHeaderOpen: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  accordionHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  accordionTitle: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  accordionSummary: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  inlineLabel: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  inlineLabelSpaced: {
    marginTop: 14,
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
  /** ინლაინ: სრული სიმაღლე ჩანს, ScrollView-ით ირგვება — არ იჭრება აკორდეონის overflow-ით */
  dropdownOptions: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 260,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownScroll: {
    maxHeight: 220,
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
