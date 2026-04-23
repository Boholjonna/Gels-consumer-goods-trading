import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { FontSizeProvider } from '@/lib/font-size';
import { OfflineSyncProvider } from '@/lib/offline-sync';
import { NetworkGuard } from '@/components/NetworkGuard';
import { isSupabaseConfigured } from '@/lib/supabase';
import '../global.css';

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.",
]);

export default function RootLayout() {
  if (!isSupabaseConfigured) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 items-center justify-center bg-[#0D1F33] px-6">
          <Text className="text-center text-lg font-semibold text-white">App configuration is missing</Text>
          <Text className="mt-3 text-center text-sm text-[#8FAABE]">
            The APK was built without the Supabase environment variables. Rebuild it with
            EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY set.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <OfflineSyncProvider>
            <FontSizeProvider>
              <NetworkGuard>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#0D1F33' },
                  }}
                />
              </NetworkGuard>
            </FontSizeProvider>
          </OfflineSyncProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
