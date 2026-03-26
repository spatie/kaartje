import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

interface IntroTextProps {
  onComplete?: () => void;
}

export function IntroText({ onComplete }: IntroTextProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 400, easing: easeOut });
    opacity.value = withSequence(
      withTiming(1, { duration: 400, easing: easeOut }),
      withDelay(
        1500,
        withTiming(0, { duration: 350, easing: easeOut }, (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        }),
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.content, animatedStyle]}>
      <Text style={styles.label}>Postcardware</Text>
      <Text style={styles.title}>Kaartje</Text>
      <Text style={styles.subtitle}>Postcards from around the world.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    alignItems: "center",
  },

  label: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 12,
    color: theme.colors.stamp,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: theme.space(2),
    textAlign: "center",
  },
  title: {
    fontFamily: theme.fonts.serif,
    fontSize: 48,
    color: theme.colors.ink,
    marginBottom: theme.space(2),
    textAlign: "center",
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    color: theme.colors.inkFaded,
    textAlign: "center",
  },
}));
