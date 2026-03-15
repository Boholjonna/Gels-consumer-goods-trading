import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function CollectorLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (user?.role !== 'collector') {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#3b82f6' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="products" options={{ headerShown: false }} />
      <Stack.Screen name="cart" options={{ title: 'Stores Order Summary' }} />
      <Stack.Screen name="confirmation" options={{ headerShown: false }} />
      <Stack.Screen name="orders" options={{ title: 'Order History' }} />
      <Stack.Screen name="settings" options={{ title: 'Profile' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}
