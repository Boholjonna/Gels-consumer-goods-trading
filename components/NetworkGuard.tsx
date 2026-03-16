import React from 'react';
import { View, Text } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const isConnected = useNetworkStatus();

  if (!isConnected) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0D1F33] px-6">
        <Text className="text-6xl mb-4 text-[#E5C07B]">!</Text>
        <Text className="text-xl font-bold text-[#E8EDF2] mb-2">No Internet Connection</Text>
        <Text className="text-[#8FAABE] text-center mb-6">
          Please check your network connection and try again.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}
