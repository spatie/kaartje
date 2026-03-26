import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Canvas } from "@react-three/fiber";
import { DottedGlobe } from "@kaartje/shared";
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

interface NetworkSphereViewProps {
  onComplete?: () => void;
}

export function NetworkSphereView({ onComplete }: NetworkSphereViewProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Globe should appear the same physical size as on a 580x800 reference screen.
  // Three.js fov is vertical, so camera Z controls vertical size.
  // For horizontal: on narrow screens the globe overflows because the aspect
  // ratio is smaller. We compute the required Z for both axes and take the larger.
  const cameraZ = useMemo(() => {
    const baseZ = 13;
    const refWidth = 580;
    const refHeight = 900;

    // Z needed to match the reference vertical size
    const zForHeight = baseZ * (refHeight / Math.max(screenHeight, 1));

    // Z needed to match the reference horizontal size
    // horizontal visible width ∝ aspect * tan(fov/2) * Z
    // so Z_w / Z_ref = (refAspect / aspect) when aspect < refAspect
    const refAspect = refWidth / refHeight;
    const aspect = screenWidth / Math.max(screenHeight, 1);
    const zForWidth = aspect < refAspect ? baseZ * (refAspect / aspect) : baseZ;

    return Math.max(zForHeight, zForWidth);
  }, [screenWidth, screenHeight]);
  // Intro text
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0);
  const textTranslateY = useSharedValue(0);

  // Globe
  const globeOpacity = useSharedValue(0);
  const globeTranslateY = useSharedValue(400);

  // Bottom fade + button
  const fadeOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(40);

  const canvasReady = useRef(false);
  const textDone = useRef(false);

  // Pause rendering when app is backgrounded
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setFrameloop(state === "active" ? "always" : "never");
    });
    return () => sub.remove();
  }, []);

  const revealGlobe = useCallback(() => {
    const duration = 4000;

    // Text slides up
    textTranslateY.value = withTiming(-180, { duration, easing: easeOut });

    // Globe fades in from below
    globeOpacity.value = withTiming(1, { duration, easing: easeOut });
    globeTranslateY.value = withTiming(240, { duration, easing: easeOut });

    // Gradient fades in with the globe
    fadeOpacity.value = withDelay(
      duration * 0.4,
      withTiming(1, { duration: 3000, easing: easeOut }),
    );

    // Button fades in + slides up
    buttonOpacity.value = withDelay(
      duration * 0.5,
      withTiming(1, { duration: 3000, easing: easeOut }),
    );
    buttonTranslateY.value = withDelay(
      duration * 0.5,
      withTiming(0, { duration: 3000, easing: easeOut }),
    );
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

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.globe, globeStyle]}>
        <Canvas
          camera={{ position: [0, 0, cameraZ], fov: 45 }}
          frameloop={frameloop}
          onCreated={handleCanvasCreated}
        >
          <DottedGlobe />
        </Canvas>
      </Animated.View>

      <Animated.View style={[styles.textOverlay, textStyle]}>
        <Text style={styles.label}>Postcardware</Text>
        <Text style={styles.title}>Kaartje</Text>
        <Text style={styles.subtitle}>Postcards from around the world.</Text>
      </Animated.View>

      <Animated.View style={[styles.fadeOverlay, fadeStyle]} pointerEvents="none">
        <LinearGradient colors={["transparent", "#0a0a0c"]} style={styles.fade} />
        <View style={styles.fadeSolid} />
      </Animated.View>

      <Animated.View style={[styles.buttonOverlay, buttonStyle]}>
        <Button onPress={onComplete}>Send a postcard</Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
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
  fadeOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  fade: {
    height: 80,
  },
  fadeSolid: {
    height: rt.insets.bottom + theme.space(16),
    backgroundColor: theme.colors.night,
  },
  buttonOverlay: {
    position: "absolute",
    bottom: rt.insets.bottom + theme.space(10),
    left: 0,
    right: 0,
    alignItems: "center",
  },
}));
