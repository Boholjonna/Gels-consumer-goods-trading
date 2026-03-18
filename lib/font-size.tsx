import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSizeOption = 'small' | 'medium' | 'large';

const FONT_SIZE_KEY = 'app_font_size';

// Scale multipliers relative to the app's current (small) font sizes
const SCALE_MAP: Record<FontSizeOption, number> = {
  small: 1,
  medium: 1.2,
  large: 1.4,
};

interface FontSizeContextType {
  fontSize: FontSizeOption;
  scale: number;
  setFontSize: (size: FontSizeOption) => void;
  scaled: (baseSize: number) => number;
}

const FontSizeContext = createContext<FontSizeContextType>({
  fontSize: 'small',
  scale: 1,
  setFontSize: () => {},
  scaled: (s) => s,
});

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSizeOption>('small');

  useEffect(() => {
    AsyncStorage.getItem(FONT_SIZE_KEY).then((stored) => {
      if (stored === 'small' || stored === 'medium' || stored === 'large') {
        setFontSizeState(stored);
      }
    });
  }, []);

  const setFontSize = useCallback((size: FontSizeOption) => {
    setFontSizeState(size);
    AsyncStorage.setItem(FONT_SIZE_KEY, size);
  }, []);

  const scale = SCALE_MAP[fontSize];

  const scaled = useCallback(
    (baseSize: number) => Math.round(baseSize * SCALE_MAP[fontSize]),
    [fontSize]
  );

  return (
    <FontSizeContext.Provider value={{ fontSize, scale, setFontSize, scaled }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  return useContext(FontSizeContext);
}
