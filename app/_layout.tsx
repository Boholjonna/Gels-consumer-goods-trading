import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { NetworkGuard } from '@/components/NetworkGuard';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <NetworkGuard>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0D1F33' },
              }}
            />
          </NetworkGuard>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
