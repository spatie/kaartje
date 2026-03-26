import { useEffect } from "react";
import { Text, View } from "react-native";
import { Send } from "lucide-react-native";
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

interface SuccessScreenProps {
  onComplete: () => void;
}

export function SuccessScreen({ onComplete }: SuccessScreenProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 400, easing: easeOut });
    opacity.value = withSequence(
      withTiming(1, { duration: 400, easing: easeOut }),
      withDelay(
        1600,
        withTiming(0, { duration: 350, easing: easeOut }, (finished) => {
          if (finished) runOnJS(onComplete)();
        }),
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.iconContainer}>
        <Send size={48} strokeWidth={1.5} color="#c45a3c" />
      </View>
      <Text style={styles.title}>Postcard sent!</Text>
      <Text style={styles.subtitle}>Your postcard is on its way</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: theme.space(6),
  },
  title: {
    fontFamily: theme.fonts.serif,
    fontSize: 32,
    color: theme.colors.ink,
    textAlign: "center",
    marginBottom: theme.space(2),
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    color: theme.colors.inkFaded,
    textAlign: "center",
  },
}));
