import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import CustomTabBar from '@/components/ui/CustomTabBar';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={20} style={{ marginBottom: 0 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...(props as any)} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6B7280',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'მთავარი',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'მანქანა',
          tabBarIcon: ({ color }) => <TabBarIcon name="car" color={color} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'კატეგორიები',
          tabBarIcon: ({ color }) => <TabBarIcon name="shopping-bag" color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="ecommerce"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) => <TabBarIcon name="shopping-cart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="carwash"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="management"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="partner"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
