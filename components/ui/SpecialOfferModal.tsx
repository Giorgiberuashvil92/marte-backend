import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export interface SpecialOfferModalData {
  id?: string;
  storeId?: string;
  discount?: string;
  oldPrice?: string;
  newPrice?: string;
  price?: string;
  title?: string;
  description?: string;
  image?: string;
  name?: string;
  location?: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  images?: string[];
  [key: string]: any;
}

type SpecialOfferModalProps = {
  visible: boolean;
  offer: SpecialOfferModalData | null;
  onClose: () => void;
  onContact?: () => void;
};

export default function SpecialOfferModal({
  visible,
  offer,
  onClose,
  onContact,
}: SpecialOfferModalProps) {
  if (!offer) return null;

  const handleCall = () => {
    if (offer.phone) {
      const cleanPhone = offer.phone.replace(/[\s\-\(\)]/g, '');
      const phoneNumber = cleanPhone.startsWith('+995')
        ? cleanPhone
        : cleanPhone.startsWith('995')
          ? `+${cleanPhone}`
          : `+995${cleanPhone}`;
      Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
        console.error('Error opening phone:', err);
      });
    }
    if (onContact) onContact();
  };

  const handleMapPress = () => {
    const storeName = offer.name || offer.title || 'მაღაზია';
    if (offer.latitude && offer.longitude) {
      const url =
        Platform.OS === 'ios'
          ? `maps://?ll=${offer.latitude},${offer.longitude}&q=${encodeURIComponent(storeName)}`
          : `geo:${offer.latitude},${offer.longitude}?q=${offer.latitude},${offer.longitude}(${encodeURIComponent(storeName)})`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${offer.latitude},${offer.longitude}`);
      });
    } else if (offer.address || offer.location) {
      const fullAddress = offer.address
        ? `${offer.address}, თბილისი, საქართველო`
        : `${offer.location}, თბილისი, საქართველო`;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`).catch(() => {});
    }
  };

  const imageUri = offer.image || offer.images?.[0] || offer.photos?.[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>შეთავაზება</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Top: image + discount */}
            {imageUri ? (
              <View style={styles.imageWrap}>
                <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                {offer.discount ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>-{offer.discount}%</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Title */}
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={2}>
                {offer.title || offer.name || 'სპეციალური შეთავაზება'}
              </Text>
            </View>

            {/* Strip: ფასი */}
            <View style={styles.strip}>
              <Text style={styles.stripLabel}>ფასი</Text>
              <View style={styles.priceRow}>
                {offer.oldPrice ? (
                  <Text style={styles.oldPrice}>{offer.oldPrice} ₾</Text>
                ) : null}
                <Text style={styles.newPrice}>
                  {offer.newPrice || offer.price ? `${offer.newPrice || offer.price} ₾` : 'მოთხოვნის შემთხვევაში'}
                </Text>
              </View>
            </View>

            {/* Strip: მაღაზია/სახელი */}
            {offer.name ? (
              <View style={styles.strip}>
                <Text style={styles.stripLabel}>მაღაზია</Text>
                <Text style={styles.stripValue} numberOfLines={1}>{offer.name}</Text>
              </View>
            ) : null}

            {/* Strip: მისამართი */}
            {(offer.address || offer.location) ? (
              <View style={styles.strip}>
                <Text style={styles.stripLabel}>მისამართი</Text>
                <Text style={styles.stripValue} numberOfLines={2}>{offer.address || offer.location}</Text>
              </View>
            ) : null}

            {/* აღწერა */}
            {offer.description ? (
              <View style={styles.descWrap}>
                <Text style={styles.descLabel}>აღწერა</Text>
                <Text style={styles.descText}>{offer.description}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {(offer.address || offer.location || (offer.latitude != null && offer.longitude != null)) && (
              <TouchableOpacity
                style={styles.footerBtnSecondary}
                onPress={handleMapPress}
                activeOpacity={0.8}
              >
                <Ionicons name="map-outline" size={20} color="#111827" />
                <Text style={styles.footerBtnSecondaryText}>რუკა</Text>
              </TouchableOpacity>
            )}
            {offer.phone ? (
              <TouchableOpacity
                style={styles.footerBtnPrimary}
                onPress={handleCall}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={20} color="#FFFFFF" />
                <Text style={styles.footerBtnPrimaryText}>დარეკვა</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    height: height * 0.9,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  imageWrap: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  discountBadgeText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  titleWrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 8,
  },
  stripLabel: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stripValue: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oldPrice: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    textTransform: 'uppercase',
  },
  newPrice: {
    fontSize: 16,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
  },
  descWrap: {
    marginTop: 8,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  descLabel: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  descText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    color: '#374151',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  footerBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  footerBtnSecondaryText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
  },
  footerBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  footerBtnPrimaryText: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});
