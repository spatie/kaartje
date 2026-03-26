import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Camera as CameraIcon } from "lucide-react-native";
import { Camera, useCameraPermission } from "react-native-vision-camera";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "./Button";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

type PermissionState = "not-determined" | "denied" | "restricted";

interface CameraPermissionProps {
  onPermissionGranted: () => void;
}

export function CameraPermission({ onPermissionGranted }: CameraPermissionProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [permissionState, setPermissionState] = useState<PermissionState>("not-determined");

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    const status = Camera.getCameraPermissionStatus();
    if (status === "denied") setPermissionState("denied");
    else if (status === "restricted") setPermissionState("restricted");

    opacity.value = withTiming(1, { duration: 400, easing: easeOut });
    translateY.value = withTiming(0, { duration: 400, easing: easeOut });
  }, []);

  useEffect(() => {
    if (hasPermission) {
      onPermissionGranted();
    }
  }, [hasPermission]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handlePress = async () => {
    if (permissionState === "denied") {
      await Linking.openSettings();
    } else {
      const result = await requestPermission();
      if (!result) {
        setPermissionState("denied");
      }
    }
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.iconContainer}>
        <CameraIcon size={48} strokeWidth={1.5} color="#c45a3c" />
      </View>

      <Text style={styles.title}>Scan Postcards</Text>

      <Text style={styles.description}>
        {permissionState === "restricted"
          ? "Camera access is restricted on this device."
          : permissionState === "denied"
            ? "Camera access was denied. You can enable it in your device settings."
            : "Kaartje uses your camera to scan postcards from around the world."}
      </Text>

      {permissionState !== "restricted" && (
        <Button onPress={handlePress}>
          {permissionState === "denied" ? "Open Settings" : "Allow Camera Access"}
        </Button>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: "center",
    paddingHorizontal: theme.space(8),
  },
  iconContainer: {
    marginBottom: theme.space(6),
  },
  title: {
    fontFamily: theme.fonts.serif,
    fontSize: 32,
    color: theme.colors.ink,
    marginBottom: theme.space(3),
    textAlign: "center",
  },
  description: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.inkFaded,
    textAlign: "center",
    marginBottom: theme.space(8),
    maxWidth: 300,
  },
}));
