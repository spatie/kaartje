import { useEffect } from "react";
import { Text, View } from "react-native";
import { Send } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "./Button";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

interface SuccessScreenProps {
  onSendAnother: () => void;
}

export function SuccessScreen({ onSendAnother }: SuccessScreenProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 400, easing: easeOut });
    opacity.value = withTiming(1, { duration: 400, easing: easeOut });
    buttonOpacity.value = withDelay(800, withTiming(1, { duration: 400, easing: easeOut }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.iconContainer}>
        <Send size={48} strokeWidth={1.5} color="#c45a3c" />
      </View>
      <Text style={styles.title}>Thank you!</Text>
      <Text style={styles.subtitle}>Your postcard is on its way to Spatie.</Text>
      <Animated.View style={[styles.buttonContainer, buttonStyle]}>
        <Button onPress={onSendAnother}>Send another postcard</Button>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space(8),
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
    marginBottom: theme.space(8),
  },
  buttonContainer: {
    alignSelf: "stretch",
  },
}));
