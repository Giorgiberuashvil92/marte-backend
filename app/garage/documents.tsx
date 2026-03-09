import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCars } from '../../contexts/CarContext';

export default function DocumentsScreen() {
  const router = useRouter();
  const { selectedCar } = useCars();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>დოკუმენტები</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            // TODO: Add document modal
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
        {selectedCar ? (
          <>
            <View style={styles.carInfo}>
              <Text style={styles.carName}>
                {selectedCar.make} {selectedCar.model}
              </Text>
              <Text style={styles.carPlate}>{selectedCar.plateNumber}</Text>
            </View>

            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>დოკუმენტები არ არის</Text>
              <Text style={styles.emptySubtitle}>
                დაამატე ტექპასპორტი, დაზღვევა და სხვა დოკუმენტები
              </Text>
              <TouchableOpacity style={styles.addButton}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>დოკუმენტის დამატება</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
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
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  carInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  carName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  carPlate: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
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
    marginBottom: 32,
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
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
