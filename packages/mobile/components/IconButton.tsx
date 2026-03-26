import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

type IconButtonVariant = "filled" | "outline" | "ghost";

interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  icon: ReactNode;
  size?: number;
  variant?: IconButtonVariant;
}

export function IconButton({ icon, size = 56, variant = "filled", ...props }: IconButtonProps) {
  styles.useVariants({ variant });

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.9, { duration: 120, easing: easeOut });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 200, easing: easeOut });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[styles.container, { width: size, height: size }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: "transparent",
    variants: {
      variant: {
        filled: {
          backgroundColor: theme.colors.elevated,
          borderColor: theme.colors.border,
        },
        outline: {
          backgroundColor: "rgba(10, 10, 12, 0.5)",
          borderColor: "rgba(237, 230, 219, 0.3)",
        },
        ghost: {
          backgroundColor: "transparent",
          borderColor: "transparent",
        },
      },
    },
  },
}));
