import React from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  TextProps,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import { cssInterop } from 'nativewind';
import { useFontSize } from '@/lib/font-size';

function ScaledTextInner(props: TextProps) {
  const { scale } = useFontSize();

  if (scale === 1) {
    return <RNText {...props} />;
  }

  const flat = StyleSheet.flatten(props.style) || {};
  const baseFontSize = (flat as Record<string, unknown>).fontSize as number | undefined;
  const size = baseFontSize ?? 14;

  return (
    <RNText
      {...props}
      style={[props.style, { fontSize: Math.round(size * scale) }]}
    />
  );
}

const ScaledTextInputInner = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const { scale } = useFontSize();

  if (scale === 1) {
    return <RNTextInput ref={ref} {...props} />;
  }

  const flat = StyleSheet.flatten(props.style) || {};
  const baseFontSize = (flat as Record<string, unknown>).fontSize as number | undefined;
  const size = baseFontSize ?? 14;

  return (
    <RNTextInput
      ref={ref}
      {...props}
      style={[props.style, { fontSize: Math.round(size * scale) }]}
    />
  );
});

cssInterop(ScaledTextInner, { className: 'style' });
cssInterop(ScaledTextInputInner, { className: 'style' });

export { ScaledTextInner as Text, ScaledTextInputInner as TextInput };
