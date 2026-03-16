import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function ConfirmationScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // If no order number, redirect immediately
    if (!orderNumber) {
      router.replace('/(collector)/products');
      return;
    }

    // Animate checkmark scale-in
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Auto-redirect after 2 seconds
    const timer = setTimeout(() => {
      router.replace('/(collector)/products');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!orderNumber) return null;

  return (
    <View className="flex-1 bg-[#0D1F33] items-center justify-center px-4">
      <View style={isTablet ? { maxWidth: 400, width: '100%' } : { width: '100%', paddingHorizontal: 16 }}>
        <View className="items-center mb-6">
          <Animated.View
            className="bg-[#98C379]/10 w-24 h-24 rounded-full items-center justify-center mb-6"
            style={{ transform: [{ scale: scaleAnim }] }}
          >
            <Text className="text-5xl text-[#98C379]">✓</Text>
          </Animated.View>

          <Text className="text-2xl font-bold text-[#E8EDF2] mb-2">Order Submitted!</Text>
          <Text className="text-[#8FAABE] text-center">
            Your order has been sent for processing.
          </Text>
        </View>

        <View className="bg-[#1A3755] rounded-xl p-4 w-full mb-6">
          <Text className="text-sm text-[#8FAABE]/50 text-center">Order Number</Text>
          <Text className="text-xl font-bold text-[#5B9BD5] text-center mt-1">
            {orderNumber}
          </Text>
        </View>

        <Text className="text-xs text-[#8FAABE]/40 text-center">
          Redirecting to products...
        </Text>
      </View>
    </View>
  );
}
