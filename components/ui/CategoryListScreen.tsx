import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DetailItem } from './DetailModal';
import FilterModal, { DismantlerFilters, PartsFilters } from './FilterModal';
import AddModal, { AddModalType } from './AddModal';

const { width } = Dimensions.get('window');

// Skeleton Components
const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonContent}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%' }]} />
    </View>
  </View>
);

const SkeletonListItem = () => (
  <View style={styles.skeletonListItem}>
    <View style={styles.skeletonThumbnail} />
    <View style={styles.skeletonTextContainer}>
      <View style={styles.skeletonTextLine} />
      <View style={[styles.skeletonTextLine, { width: '80%' }]} />
      <View style={[styles.skeletonTextLine, { width: '70%' }]} />
      <View style={[styles.skeletonTextLine, { width: '50%' }]} />
    </View>
    <View style={styles.skeletonIndicator} />
  </View>
);

export type CategoryListScreenProps = {
  title: string;
  // Data
  vipData: any[];
  regularData: any[];
  loading: boolean;
  // Tabs (optional)
  tabs?: { label: string; value: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  // Render functions
  renderVIPCard: (item: any) => React.ReactElement;
  renderListItem: (item: any, index: number) => React.ReactElement;
  // Actions
  onAddPress?: () => void;
  onFilterPress?: () => void;
  showAddButton?: boolean;
  showFilterButton?: boolean;
  // Filters (optional)
  showFilterModal?: boolean;
  onFilterClose?: () => void;
  dismantlerFilters?: DismantlerFilters;
  partsFilters?: PartsFilters;
  onApplyFilters?: (dismantlerFilters: DismantlerFilters, partsFilters: PartsFilters) => void;
  onResetFilters?: () => void;
  // Pagination (optional)
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  // Empty state
  emptyText?: string;
  // Section titles
  vipSectionTitle?: string;
  regularSectionTitle?: string;
  // Custom sections (optional)
  customSections?: React.ReactNode[];
  // List layout
  listLayout?: 'vertical' | 'grid';
  numColumns?: number;
  // Special offers (optional)
  specialOffersData?: any[];
  renderSpecialOfferCard?: (item: any, index: number) => React.ReactElement;
  specialOffersTitle?: string;
  /** მოდალის ფორმის ნაგულისხმევი მონაცემები (მაგ. type: 'ზეთები' ზეთების გვერდიდან) */
  addModalDefaultFormData?: Record<string, any>;
  /** მოდალის ნაგულისხმევი ტიპი (store, part, ...) */
  addModalDefaultType?: 'store' | 'part' | 'dismantler' | 'carwash' | 'mechanic' | 'service';
};

export default function CategoryListScreen({
  title,
  vipData,
  regularData,
  loading,
  tabs,
  activeTab,
  onTabChange,
  renderVIPCard,
  renderListItem,
  onAddPress,
  onFilterPress,
  showAddButton = true,
  showFilterButton = true,
  showFilterModal = false,
  onFilterClose,
  dismantlerFilters,
  partsFilters,
  onApplyFilters,
  onResetFilters,
  hasMore,
  onLoadMore,
  isLoadingMore,
  emptyText = 'მონაცემები არ მოიძებნა',
  vipSectionTitle,
  regularSectionTitle,
  specialOffersData,
  renderSpecialOfferCard,
  specialOffersTitle,
  addModalDefaultFormData,
  addModalDefaultType,
  customSections,
  listLayout = 'vertical',
  numColumns = 2,
}: CategoryListScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [allData, setAllData] = useState<any[]>([]);
  const [displayedData, setDisplayedData] = useState<any[]>([]);
  const [displayedCount, setDisplayedCount] = useState(10);

  const useServerPagination = hasMore !== undefined && !!onLoadMore;

  // Initialize data (client-side slice only when not using server pagination)
  useEffect(() => {
    setAllData(regularData);
    if (!useServerPagination) {
      setDisplayedData(regularData.slice(0, 10));
      setDisplayedCount(10);
    }
  }, [regularData, useServerPagination]);

  const listData = useServerPagination ? regularData : displayedData;

  const loadMore = useCallback(() => {
    if (useServerPagination && onLoadMore) {
      onLoadMore();
      return;
    }
    if (displayedCount < allData.length && onLoadMore) {
      onLoadMore();
    } else if (displayedCount < allData.length) {
      const nextCount = Math.min(displayedCount + 10, allData.length);
      setDisplayedData(allData.slice(0, nextCount));
      setDisplayedCount(nextCount);
    }
  }, [useServerPagination, displayedCount, allData.length, onLoadMore]);

  const handleAddItem = (type: AddModalType, data: any) => {
    if (onAddPress) {
      onAddPress();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent />
      
      {/* Top White Header */}
      <View style={styles.topBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topBarContent}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={() => {
                if (params.fromCategory || params.categoryId) {
                  router.push({
                    pathname: '/category',
                    params: {
                      type: params.categoryType || 'part',
                      categoryId: params.categoryId,
                      name: params.categoryName,
                    }
                  });
                } else if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push('/(tabs)' as any);
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            
            <Text style={styles.topBarTitle}>{title}</Text>
            
            <View style={styles.topBarRight}>
              {showFilterButton && (
                <TouchableOpacity
                  style={styles.topBarButton}
                  onPress={onFilterPress}
                >
                  <Ionicons name="options" size={24} color="#111827" />
                </TouchableOpacity>
              )}
              {showAddButton && (
                <TouchableOpacity
                  style={styles.topBarButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Ionicons name="add" size={24} color="#111827" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Navigation/Filter Section - Tabs */}
      {tabs && tabs.length > 0 && (
        <View style={styles.navSection}>
          <View style={styles.segmentControl}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.value}
                style={[styles.segmentItem, activeTab === tab.value && styles.segmentItemActive]}
                onPress={() => onTabChange?.(tab.value)}
              >
                <Text style={[styles.segmentText, activeTab === tab.value && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <FlatList
        style={styles.content}
        data={loading && !useServerPagination ? [] : listData}
        keyExtractor={(item: any, index: number) => {
          const id = item.id || item._id;
          return id ? `item-${id}` : `item-${index}`;
        }}
        renderItem={({ item, index }: { item: any; index: number }) =>
          renderListItem(item, index)
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          listLayout === 'grid' ? styles.gridList : styles.verticalList
        }
        numColumns={listLayout === 'grid' ? numColumns : 1}
        columnWrapperStyle={
          listLayout === 'grid' && numColumns > 1 ? styles.gridRow : undefined
        }
        ListHeaderComponent={
          <>
            {/* VIP Section */}
            {vipData.length > 0 && (
              <>
                {/* Section Title */}
                {loading && listData.length === 0 ? (
                  <View style={styles.sectionTitleSkeleton} />
                ) : (
                  <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>
                      {vipSectionTitle || 'VIP'}
                    </Text>
                  </View>
                )}

                {/* Horizontal Scroll - VIP Cards */}
                {loading && vipData.length === 0 ? (
                  <View style={styles.horizontalScroll}>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </View>
                ) : (
                  <FlatList
                    horizontal
                    data={vipData}
                    renderItem={({ item }) => renderVIPCard(item)}
                    keyExtractor={(item, index) =>
                      item.id || item._id || `vip-${index}`
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScroll}
                    removeClippedSubviews
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={2}
                    getItemLayout={(data, index) => ({
                      length: width * 0.65 + 16,
                      offset: (width * 0.65 + 16) * index,
                      index,
                    })}
                  />
                )}
              </>
            )}

            {/* Special Offers Section */}
            {specialOffersData &&
              specialOffersData.length > 0 &&
              renderSpecialOfferCard && (
                <>
                  <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>
                      {specialOffersTitle || 'სპეციალური შეთავაზებები'}
                    </Text>
                  </View>
                  <FlatList
                    horizontal
                    data={specialOffersData}
                    renderItem={({ item, index }) =>
                      renderSpecialOfferCard(item, index)
                    }
                    keyExtractor={(item, index) =>
                      item.id || item._id || `offer-${index}`
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScroll}
                    removeClippedSubviews
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={2}
                  />
                </>
              )}

            {/* Custom Sections */}
            {customSections &&
              customSections.map((section, index) => (
                <View key={`custom-section-${index}`}>{section}</View>
              ))}

            {/* Regular Section Title */}
            {loading && listData.length === 0 ? (
              <View style={styles.sectionTitleSkeleton} />
            ) : (
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>
                  {regularSectionTitle || 'სია'}
                </Text>
              </View>
            )}

            {/* Vertical skeleton while loading */}
            {loading && listData.length === 0 && (
              <View style={styles.verticalList}>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loading && listData.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {(useServerPagination ? isLoadingMore : (hasMore || displayedCount < allData.length) && !loading) && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#111827" />
                <Text style={styles.loadingMoreText}>იტვირთება...</Text>
              </View>
            )}
            <View style={{ height: 100 }} />
          </>
        }
        onEndReached={useServerPagination ? onLoadMore : (!loading ? loadMore : undefined)}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        initialNumToRender={listLayout === 'grid' ? 6 : 5}
        maxToRenderPerBatch={listLayout === 'grid' ? 4 : 3}
        windowSize={3}
        updateCellsBatchingPeriod={100}
        getItemLayout={
          listLayout === 'vertical'
            ? (data, index) => ({
                length: 120,
                offset: 120 * index,
                index,
              })
            : undefined
        }
      />

      {/* Floating Action Button */}
      {showAddButton && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Filter Modal */}
      {showFilterModal && dismantlerFilters && partsFilters && onApplyFilters && onResetFilters && (
        <FilterModal
          visible={showFilterModal}
          activeTab={activeTab as any || 'დაშლილები'}
          dismantlerFilters={dismantlerFilters}
          partsFilters={partsFilters}
          onClose={onFilterClose || (() => {})}
          onApply={onApplyFilters}
          onReset={onResetFilters}
        />
      )}

      {/* Add Modal */}
      {showAddButton && (
        <AddModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddItem}
          defaultType={addModalDefaultType ?? 'store'}
          defaultFormData={addModalDefaultFormData}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Top White Header
  topBar: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 12,
  },
  // Navigation Section
  navSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#111827',
  },
  segmentText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  // Content
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Section Title
  sectionTitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitleSkeleton: {
    height: 18,
    width: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  // Horizontal Scroll - VIP Cards
  horizontalScroll: {
    paddingLeft: 20,
    paddingRight: 4,
    gap: 12,
  },
  // Vertical List
  verticalList: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 20,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // Loading More
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontWeight: '500',
  },
  // Skeletons
  skeletonCard: {
    width: width * 0.65,
    height: 160,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: '70%',
    backgroundColor: '#D1D5DB',
  },
  skeletonContent: {
    padding: 12,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#D1D5DB',
    borderRadius: 6,
    width: '100%',
  },
  skeletonListItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  skeletonThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  skeletonTextContainer: {
    flex: 1,
    gap: 6,
  },
  skeletonTextLine: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    width: '100%',
  },
  skeletonIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  // Grid Layout
  gridList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
});
