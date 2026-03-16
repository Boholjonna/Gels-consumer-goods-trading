import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';

export default function ScanScreen() {
  const { activate, isAuthenticated } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Camera.getCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  // Navigate to home once authenticated (after activation completes)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(collector)/products');
    }
  }, [isAuthenticated]);

  async function handleRequestPermission() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  }

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned || loading) return;
      setScanned(true);
      handleActivate(data);
    },
    [scanned, loading]
  );

  async function handleActivate(activationCode: string) {
    const trimmed = activationCode.toUpperCase().trim();
    if (trimmed.length !== 6) {
      setError('Invalid QR code. Please scan the code from your administrator.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await activate(trimmed);
      // Keep loading=true — the useEffect above will navigate once isAuthenticated flips
    } catch (err: any) {
      setError(err.message || 'Activation failed. Please try again.');
      setScanned(false);
      setLoading(false);
    }
  }

  if (hasPermission === null) {
    return (
      <View className="flex-1 bg-[#0D1F33] items-center justify-center">
        <ActivityIndicator size="large" color="#5B9BD5" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View className="flex-1 bg-[#0D1F33] items-center justify-center p-8">
        <Ionicons name="camera-outline" size={48} color="#8FAABE" />
        <Text className="text-[#8FAABE] text-center mt-4 mb-4">
          Camera permission is required to scan QR codes
        </Text>
        <TouchableOpacity
          className="bg-[#5B9BD5] rounded-lg px-6 py-3 mb-4"
          onPress={handleRequestPermission}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-[#5B9BD5] font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0D1F33]">
      {/* Header */}
      <View className="flex-row items-center px-4 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="#E8EDF2" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-[#E8EDF2] ml-2">
          Scan QR Code
        </Text>
      </View>

      {/* Error */}
      {error ? (
        <View className="bg-[#E06C75]/10 border border-[#E06C75]/30 rounded-lg p-3 mx-4 mb-4">
          <Text className="text-[#E06C75] text-sm text-center">{error}</Text>
        </View>
      ) : null}

      {/* Loading overlay */}
      {loading ? (
        <View className="bg-[#5B9BD5]/10 border border-[#5B9BD5]/30 rounded-lg p-3 mx-4 mb-4 flex-row items-center justify-center">
          <ActivityIndicator size="small" color="#5B9BD5" />
          <Text className="text-[#5B9BD5] text-sm ml-2">Activating...</Text>
        </View>
      ) : null}

      {/* Camera */}
      <View className="flex-1 justify-center">
        <View
          className="overflow-hidden rounded-xl mx-4"
          style={{ height: isTablet ? 350 : 300 }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          />
          <View
            className="absolute inset-0 items-center justify-center"
            pointerEvents="none"
          >
            <View
              className="border-2 border-white rounded-lg"
              style={{ width: 200, height: 200, opacity: 0.7 }}
            />
          </View>
        </View>

        <Text className="text-[#8FAABE] text-sm text-center mt-4 px-4">
          Point your camera at the QR code provided by your administrator
        </Text>

        {scanned && !loading && (
          <TouchableOpacity
            className="mx-4 mt-4 items-center py-3 bg-[#1A3755] rounded-lg"
            onPress={() => {
              setScanned(false);
              setError('');
            }}
          >
            <Text className="text-[#5B9BD5] font-medium">Tap to scan again</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom action */}
      <View className="px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          className="items-center py-3"
          onPress={() => router.back()}
        >
          <Text className="text-[#8FAABE] font-medium">Enter code manually instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
