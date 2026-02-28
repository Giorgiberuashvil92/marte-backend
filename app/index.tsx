import { Redirect, useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export default function Index() {
  const { isAuthenticated, loading, user } = useUser();
  const router = useRouter();
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Timeout fallback - თუ loading 10 წამზე მეტია, გავაგრძელოთ
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ [INDEX] Loading timeout reached, proceeding anyway');
        setTimeoutReached(true);
      }, 10000); // 10 წამი

      return () => clearTimeout(timeout);
    } else {
      setTimeoutReached(false);
    }
  }, [loading]);

  useEffect(() => {
    console.log('🔄 [INDEX] State changed:', { loading, isAuthenticated, hasUser: !!user, userRole: user?.role });
    
    if (!loading && !isAuthenticated) {
      console.log('🔄 [INDEX] Not authenticated, redirecting to login');
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router, user]);

  // Show loading indicator instead of null
  if (loading && !timeoutReached) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (user && user.role === 'customer') {
    console.log('🔄 [INDEX] User has customer role, redirecting to login');
    return <Redirect href="/login" />;
  }

  const redirectTo = isAuthenticated ? '/(tabs)' : '/login';
  console.log('🔄 [INDEX] Redirecting to:', redirectTo);
  return <Redirect href={redirectTo} />;
}
