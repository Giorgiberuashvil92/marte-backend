import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useUser } from '@/contexts/UserContext';
import { aiApi } from '@/services/aiApi';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const styles = createStyles(theme);
  const router = useRouter();
  const { user } = useUser();
  const [sellerStatus, setSellerStatus] = useState<any>(null);

  // Load seller status when component mounts
  useEffect(() => {
    if (user?.id) {
      loadSellerStatus();
    }
  }, [user?.id]);

  const loadSellerStatus = async () => {
    if (!user?.id) return;
    try {
      const res = await aiApi.getSellerStatus({
        userId: user.id,
        phone: user.phone,
      });
      setSellerStatus(res.data);
    } catch (e) {
      console.log('[CustomTabBar] Failed to load seller status:', e);
    }
  };

  const hasStore =
    !!(sellerStatus?.counts?.stores && sellerStatus.counts.stores > 0) ||
    !!(sellerStatus?.ownedStores && sellerStatus.ownedStores.length > 0);
  const hasDismantlers =
    !!(sellerStatus?.counts?.dismantlers && sellerStatus.counts.dismantlers > 0) ||
    !!(sellerStatus?.ownedDismantlers && sellerStatus.ownedDismantlers.length > 0);
  const hasSellerAssets =
    hasStore ||
    hasDismantlers ||
    !!(sellerStatus?.ownedParts && sellerStatus.ownedParts.length > 0);

  const handleNewsFeedPress = () => {
    router.push('/news-feed' as any);
  };

  // Hide tab bar on profile screen (two) and map screen
  const currentRoute = state.routes[state.index];
  if (currentRoute.name === 'two' || currentRoute.name === 'map') {
    return null;
  }

  const goTo = (routeName: string, index: number) => {
    const isFocused = state.index === index;
    if (!isFocused) {
      navigation.navigate(routeName);
    }
  };

  // Only show specific routes in tab bar
  const allowedRoutes = ['index', 'garage', 'marketplace', 'ecommerce'];
  const visibleRoutes = state.routes.filter((route) => {
    return allowedRoutes.includes(route.name);
  });
  

  const tabItems = visibleRoutes.map((route, index) => {
    const { options } = descriptors[route.key];
    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name;
    const originalIndex = state.routes.findIndex(r => r.key === route.key);
    const isFocused = state.index === originalIndex;
    const iconName = (options.tabBarIcon as any)?.({ color: '#000' })?.props?.name as React.ComponentProps<typeof FontAwesome>['name'] | undefined;

    // Center slot is reserved for the floating action button
    return (
      <TouchableOpacity key={route.key} accessibilityRole="button" activeOpacity={0.9} style={styles.tabItem} onPress={() => goTo(route.name, originalIndex)}>
        {iconName && <FontAwesome name={iconName} size={18} color={isFocused ? theme.text : theme.secondary} />}
        <Text style={[styles.tabText, { color: isFocused ? theme.text : theme.secondary }]} numberOfLines={1}>
          {String(label)}
        </Text>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <View style={styles.side}>{tabItems.slice(0, 2)}</View>
        <View style={styles.fabHole} />
        <View style={styles.side}>{tabItems.slice(2)}</View>
      </View>
      <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={handleNewsFeedPress}>
        <Ionicons name="newspaper" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: typeof Colors.light) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: Platform.select({ ios: 12, android: 12 })!,
      alignItems: 'center',
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      height: 70,
      width: '92%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 6,
    },
    side: { flexDirection: 'row', gap: 24, alignItems: 'center' },
    fabHole: { width: 64 },
    tabItem: { alignItems: 'center', justifyContent: 'center' },
    tabText: { fontFamily: 'HelveticaMedium', textTransform: 'uppercase', fontSize: 11, marginTop: 4 },
    fab: {
      position: 'absolute',
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#111827',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  });
}


