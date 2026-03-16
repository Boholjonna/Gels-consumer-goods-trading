import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import type { Store } from '@/types';

interface StoreSelectorProps {
  stores: Store[];
  selectedId: string | null;
  onSelect: (store: Store) => void;
}

export function StoreSelector({ stores, selectedId, onSelect }: StoreSelectorProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  if (isTablet) {
    // Grid layout for tablets
    const rows: Store[][] = [];
    for (let i = 0; i < stores.length; i += 2) {
      rows.push(stores.slice(i, i + 2));
    }

    return (
      <ScrollView className="max-h-80">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-3 mb-3">
            {row.map((store) => (
              <TouchableOpacity
                key={store.id}
                className={`flex-1 p-4 border rounded-lg ${
                  selectedId === store.id ? 'border-[#5B9BD5] bg-[#5B9BD5]/10' : 'border-[#1E3F5E]/60 bg-[#162F4D]'
                }`}
                onPress={() => onSelect(store)}
              >
                <Text
                  className={`text-base font-semibold ${
                    selectedId === store.id ? 'text-[#5B9BD5]' : 'text-[#E8EDF2]'
                  }`}
                >
                  {store.name}
                </Text>
                {store.address && (
                  <Text className="text-sm text-[#8FAABE]/70 mt-1">{store.address}</Text>
                )}
              </TouchableOpacity>
            ))}
            {row.length === 1 && <View className="flex-1" />}
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView className="max-h-64">
      {stores.map((store) => (
        <TouchableOpacity
          key={store.id}
          className={`p-4 border rounded-lg mb-2 ${
            selectedId === store.id ? 'border-[#5B9BD5] bg-[#5B9BD5]/10' : 'border-[#1E3F5E]/60 bg-[#162F4D]'
          }`}
          onPress={() => onSelect(store)}
        >
          <Text
            className={`text-base font-semibold ${
              selectedId === store.id ? 'text-[#5B9BD5]' : 'text-[#E8EDF2]'
            }`}
          >
            {store.name}
          </Text>
          {store.address && (
            <Text className="text-sm text-[#8FAABE]/70 mt-1">{store.address}</Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
