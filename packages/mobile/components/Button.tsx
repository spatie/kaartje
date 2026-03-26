import type { ReactNode } from "react";
import { Pressable, Text, type PressableProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "sm";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: string;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  icon,
  ...props
}: ButtonProps) {
  styles.useVariants({ variant, size });

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 120, easing: easeOut });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 200, easing: easeOut });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {icon && <>{icon}</>}
        <Text style={styles.label}>{children}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space(2),
    borderWidth: 1,
    borderColor: "transparent",
    variants: {
      variant: {
        primary: {
          backgroundColor: theme.colors.stamp,
          borderColor: theme.colors.stamp,
        },
        secondary: {
          backgroundColor: "transparent",
          borderColor: theme.colors.border,
        },
        ghost: {
          backgroundColor: "transparent",
          borderColor: "transparent",
        },
      },
      size: {
        md: {
          paddingVertical: theme.space(3),
          paddingHorizontal: theme.space(6),
          borderRadius: theme.radius.lg,
        },
        sm: {
          paddingVertical: theme.space(2),
          paddingHorizontal: theme.space(4),
          borderRadius: theme.radius.md,
        },
      },
    },
  },
  pressed: {
    variants: {
      variant: {
        primary: {
          backgroundColor: theme.colors.stampHover,
          borderColor: theme.colors.stampHover,
        },
        secondary: {
          backgroundColor: theme.colors.surface,
        },
        ghost: {
          opacity: 0.7,
        },
      },
    },
  },
  label: {
    variants: {
      variant: {
        primary: {
          color: theme.colors.ink,
        },
        secondary: {
          color: theme.colors.ink,
        },
        ghost: {
          color: theme.colors.inkFaded,
        },
      },
      size: {
        md: {
          fontSize: 16,
          fontFamily: theme.fonts.sansSemiBold,
        },
        sm: {
          fontSize: 14,
          fontFamily: theme.fonts.sansSemiBold,
        },
      },
    },
  },
}));
