import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.65;
const IMAGE_HEIGHT = 120;

export type SpecialOfferCardOffer = {
  id?: string;
  _id?: string;
  storeId?: string;
  discount?: string;
  oldPrice?: string;
  newPrice?: string;
  price?: string;
  title?: string;
  name?: string;
  description?: string;
  image?: string;
  images?: string[];
  photos?: string[];
  location?: string;
  address?: string;
  [key: string]: any;
};

type SpecialOfferCardProps = {
  offer: SpecialOfferCardOffer;
  onPress: () => void;
  offersCount?: number;
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1517672651691-24622a91b550?q=80&w=800&auto=format&fit=crop';

export default function SpecialOfferCard({ offer, onPress, offersCount }: SpecialOfferCardProps) {
  const imageUri = offer.image || offer.images?.[0] || offer.photos?.[0] || DEFAULT_IMAGE;
  const title = offer.title || offer.name || 'სპეციალური შეთავაზება';
  const location = offer.location || offer.address;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {offer.discount ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{offer.discount}%</Text>
          </View>
        ) : null}
        {offersCount != null && offersCount > 1 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>+{offersCount - 1}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          {offer.oldPrice ? (
            <Text style={styles.oldPrice}>{offer.oldPrice} ₾</Text>
          ) : null}
          <Text style={styles.newPrice}>
            {offer.newPrice || offer.price ? `${offer.newPrice || offer.price} ₾` : '—'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.viewBtnText}>ნახვა</Text>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  discountBadgeText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  body: {
    padding: 14,
    backgroundColor: '#F9FAFB',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'HelveticaMedium',
    color: '#6B7280',
    flex: 1,
    textTransform: 'uppercase',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  oldPrice: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    textTransform: 'uppercase',
  },
  newPrice: {
    fontSize: 15,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  viewBtnText: {
    fontSize: 13,
    fontFamily: 'HelveticaMedium',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});
