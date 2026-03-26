import { useCallback, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { Canvas } from "@react-three/fiber";
import { DottedGlobe } from "@kaartje/shared";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

interface NetworkSphereViewProps {
  onComplete?: () => void;
}

export function NetworkSphereView({ onComplete: _ }: NetworkSphereViewProps) {
  // Intro text
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0);
  const textTranslateY = useSharedValue(0);

  // Globe
  const globeOpacity = useSharedValue(0);
  const globeTranslateY = useSharedValue(400);

  const canvasReady = useRef(false);
  const textDone = useRef(false);

  const revealGlobe = useCallback(() => {
    const duration = 4000;

    // Text slides up
    textTranslateY.value = withTiming(-180, { duration, easing: easeOut });

    // Globe fades in from below
    globeOpacity.value = withTiming(1, { duration, easing: easeOut });
    globeTranslateY.value = withTiming(240, { duration, easing: easeOut });
  }, []);

  const tryReveal = useCallback(() => {
    if (canvasReady.current && textDone.current) {
      revealGlobe();
    }
  }, [revealGlobe]);

  // Phase 1: fade in intro text
  useEffect(() => {
    textScale.value = withTiming(1, { duration: 400, easing: easeOut });
    textOpacity.value = withTiming(1, { duration: 400, easing: easeOut });

    // Text intro is "done" after a short pause
    const timer = setTimeout(() => {
      textDone.current = true;
      tryReveal();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleCanvasCreated = useCallback(() => {
    canvasReady.current = true;
    tryReveal();
  }, [tryReveal]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }, { translateY: textTranslateY.value }],
  }));

  const globeStyle = useAnimatedStyle(() => ({
    opacity: globeOpacity.value,
    transform: [{ translateY: globeTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.globe, globeStyle]}>
        <Canvas camera={{ position: [0, 0, 9], fov: 45 }} onCreated={handleCanvasCreated}>
          <DottedGlobe />
        </Canvas>
      </Animated.View>

      <Animated.View style={[styles.textOverlay, textStyle]}>
        <Text style={styles.label}>Postcardware</Text>
        <Text style={styles.title}>Kaartje</Text>
        <Text style={styles.subtitle}>Postcards from around the world.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create((theme, _rt) => ({
  container: {
    flex: 1,
    alignSelf: "stretch",
    backgroundColor: theme.colors.night,
  },
  globe: {
    ...StyleSheet.absoluteFillObject,
  },
  textOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
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
