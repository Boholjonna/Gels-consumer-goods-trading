import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function ActivationScreen() {
  const { activate, isAuthenticated } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const inputRef = useRef<TextInput>(null);

  // Navigate to home once authenticated (after activation completes)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(collector)/products');
    }
  }, [isAuthenticated]);

  const VALID_CHARS = '23456789ACDEFGHJKMNPQRSTUVWXYZ';

  function filterCode(text: string): string {
    return text
      .toUpperCase()
      .split('')
      .filter((c) => VALID_CHARS.includes(c))
      .join('')
      .slice(0, 6);
  }

  async function handleActivate() {
    const trimmed = code.toUpperCase().trim();
    if (trimmed.length !== 6) {
      setError('Activation code must be 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await activate(trimmed);
      // Keep loading=true — the useEffect above will navigate once isAuthenticated flips
    } catch (err: any) {
      setError(err.message || 'Activation failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#0D1F33]"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center items-center px-4">
        <View
          style={
            isTablet
              ? { maxWidth: 420, width: '100%' }
              : { width: '100%', paddingHorizontal: 0 }
          }
        >
          {/* Header */}
          <View className="items-center mb-2">
            <Image
              source={require('../assets/logo.png')}
              style={{ width: 72, height: 72, marginBottom: 12 }}
              resizeMode="contain"
            />
            <Text className="text-3xl font-bold text-[#5B9BD5] text-center">
              GELS
            </Text>
          </View>
          <Text className="text-base text-[#8FAABE] text-center mb-8">
            Activate your collector account
          </Text>

          {/* Error */}
          {error ? (
            <View className="bg-[#E06C75]/10 border border-[#E06C75]/30 rounded-lg p-3 mb-4 mx-4">
              <Text className="text-[#E06C75] text-sm text-center">{error}</Text>
            </View>
          ) : null}

          {/* Loading overlay */}
          {loading ? (
            <View className="bg-[#5B9BD5]/10 border border-[#5B9BD5]/30 rounded-lg p-3 mb-4 mx-4 flex-row items-center justify-center">
              <ActivityIndicator size="small" color="#5B9BD5" />
              <Text className="text-[#5B9BD5] text-sm ml-2">Activating...</Text>
            </View>
          ) : null}

          {/* Scan QR Button */}
          <TouchableOpacity
            className="mx-4 mb-6 bg-[#5B9BD5] rounded-xl py-4 flex-row items-center justify-center"
            onPress={() => router.push('/scan')}
            disabled={loading}
          >
            <Ionicons name="qr-code-outline" size={22} color="#ffffff" />
            <Text className="text-white font-semibold text-base ml-2">
              Scan QR Code
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mx-4 mb-6">
            <View className="flex-1 h-px bg-[#1E3F5E]/60" />
            <Text className="text-[#8FAABE]/50 text-sm mx-3">or enter code manually</Text>
            <View className="flex-1 h-px bg-[#1E3F5E]/60" />
          </View>

          {/* Manual Code Entry */}
          <View className="px-4">
            <Text className="text-sm font-medium text-[#8FAABE] mb-2">
              Activation Code
            </Text>
            <TextInput
              ref={inputRef}
              className="border border-[#1E3F5E]/60 bg-[#162F4D] rounded-lg px-4 py-4 text-center text-2xl font-mono tracking-widest text-[#E8EDF2]"
              value={code}
              onChangeText={(text) => setCode(filterCode(text))}
              placeholder="ABC123"
              placeholderTextColor="#8FAABE44"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardAppearance="dark"
            />
            <Text className="text-[#8FAABE]/40 text-xs text-center mt-2">
              Enter the 6-character code from your administrator
            </Text>

            <TouchableOpacity
              className={`rounded-lg py-4 items-center mt-6 ${
                loading || code.length !== 6 ? 'bg-[#5B9BD5]/40' : 'bg-[#5B9BD5]'
              }`}
              onPress={handleActivate}
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Activate
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
