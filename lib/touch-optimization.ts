/**
 * Touch Optimization Configuration
 * 
 * These constants optimize touch responsiveness across the app.
 * Apply to TouchableOpacity, Pressable, and other touchable components.
 */

export const TOUCH_OPTIMIZATION = {
  // Immediate response on press (no delay)
  delayPressIn: 0,
  
  // Immediate response on release (no delay)
  delayPressOut: 0,
  
  // Standard long press duration (500ms)
  delayLongPress: 500,
  
  // Visual feedback opacity
  activeOpacity: 0.7,
  
  // Hit slop for easier tapping (especially useful for small buttons)
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

/**
 * Pressable optimization config
 * Use with <Pressable {...PRESSABLE_OPTIMIZATION}>
 */
export const PRESSABLE_OPTIMIZATION = {
  delayLongPress: 500,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
  android_disableSound: false,
  android_ripple: {
    color: 'rgba(91, 155, 213, 0.2)',
    borderless: false,
    radius: -1,
  },
} as const;

/**
 * Apply to any TouchableOpacity for instant response
 * 
 * Example:
 * <TouchableOpacity {...TOUCH_OPTIMIZATION} onPress={handlePress}>
 *   <Text>Fast Button</Text>
 * </TouchableOpacity>
 */
