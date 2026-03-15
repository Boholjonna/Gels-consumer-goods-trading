import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-4">
      <Ionicons name="notifications-outline" size={48} color="#d1d5db" />
      <Text className="text-gray-500 text-lg font-medium mt-4">No notifications yet</Text>
      <Text className="text-gray-400 text-sm mt-1">You're all caught up!</Text>
    </View>
  );
}
