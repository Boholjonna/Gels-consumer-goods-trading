import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';
import React from 'react';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ title, variant = 'primary', className, ...props }: ButtonProps) {
  const baseClasses = 'px-6 py-3 rounded-lg items-center justify-center';
  const variantClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    outline: 'border-2 border-blue-600 bg-transparent',
  };
  const textVariantClasses = {
    primary: 'text-white',
    secondary: 'text-white',
    outline: 'text-blue-600',
  };

  return (
    <TouchableOpacity
      className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
      activeOpacity={0.7}
      delayPressIn={0}
      delayPressOut={0}
      delayLongPress={500}
      {...props}
    >
      <Text className={`font-semibold text-base ${textVariantClasses[variant]}`}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}
