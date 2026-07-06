import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

interface QuantitySelectorProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
}

export function QuantitySelector({ value, max, onChange }: QuantitySelectorProps) {
  const [inputValue, setInputValue] = useState(String(value));

  const handleInputChange = (text: string) => {
    // Allow empty input for easier typing
    if (text === '') {
      setInputValue('');
      return;
    }

    // Remove leading zeros except for the number 0 itself
    const cleanedText = text.replace(/^0+/, '') || '0';
    setInputValue(cleanedText);

    const num = parseInt(cleanedText, 10);
    if (!isNaN(num) && num >= 0 && num <= max) {
      onChange(num);
    }
  };

  const handleInputBlur = () => {
    // If input is empty on blur, reset to current value
    if (inputValue === '') {
      setInputValue(String(value));
    }
  };

  // Update local input value when prop value changes externally
  React.useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  return (
    <View className="flex-row items-center">
      <TouchableOpacity
        className="w-10 h-10 bg-gray-700 rounded-lg items-center justify-center active:bg-gray-600"
        onPress={() => {
          const newVal = Math.max(0, value - 1);
          onChange(newVal);
          setInputValue(String(newVal));
        }}
        disabled={value <= 0}
      >
        <Text className="text-xl font-bold text-white">−</Text>
      </TouchableOpacity>
      
      <TextInput
        style={styles.input}
        className="w-20 h-10 text-center text-lg font-bold text-white mx-2"
        value={inputValue}
        keyboardType="number-pad"
        selectTextOnFocus
        onChangeText={handleInputChange}
        onBlur={handleInputBlur}
        maxLength={6}
        placeholder="0"
        placeholderTextColor="#8FAABE"
      />
      
      <TouchableOpacity
        className="w-10 h-10 bg-blue-500 rounded-lg items-center justify-center active:bg-blue-600"
        onPress={() => {
          const newVal = Math.min(max, value + 1);
          onChange(newVal);
          setInputValue(String(newVal));
        }}
        disabled={value >= max}
      >
        <Text className="text-xl font-bold text-white">+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#1e3a5f',
    borderWidth: 2,
    borderColor: '#2e4a6f',
    borderRadius: 8,
    // Hide number input spinners on web
    ...(typeof document !== 'undefined' && {
      // @ts-ignore - Web-specific styles
      appearance: 'textfield',
      MozAppearance: 'textfield',
      WebkitAppearance: 'none',
    }),
  },
});
