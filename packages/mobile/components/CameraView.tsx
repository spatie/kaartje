import { useRef, useState, useMemo } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { X, Zap, ZapOff } from "lucide-react-native";
import { Camera, useCameraDevice, type PhotoFile } from "react-native-vision-camera";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { theme } from "../unistyles";
import { IconButton } from "./IconButton";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

const VIEWFINDER_PADDING = 24;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const OVERLAY_COLOR = "rgba(10, 10, 12, 0.6)";
const RADIUS = 16;

function buildCutoutPath(
  screenW: number,
  screenH: number,
  vfTop: number,
  vfWidth: number,
  vfHeight: number,
) {
  const x = VIEWFINDER_PADDING;
  const y = vfTop;
  const w = vfWidth;
  const h = vfHeight;
  const r = RADIUS;

  // Outer rect (full screen) + inner rounded rect (cutout via evenodd)
  return [
    `M0,0 H${screenW} V${screenH} H0 Z`,
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h - r}`,
    `Q${x + w},${y + h} ${x + w - r},${y + h}`,
    `H${x + r}`,
    `Q${x},${y + h} ${x},${y + h - r}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `Z`,
  ].join(" ");
}

interface CameraViewProps {
  title?: string;
  onDismiss: () => void;
  onPhotoTaken: (photo: PhotoFile) => void;
}

export function CameraView({ title, onDismiss, onPhotoTaken }: CameraViewProps) {
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const vfWidth = screenWidth - VIEWFINDER_PADDING * 2;
  const vfHeight = vfWidth * (2 / 3);
  const vfTop = (screenHeight - vfHeight) / 2 - 40;

  const cutoutPath = useMemo(
    () => buildCutoutPath(screenWidth, screenHeight, vfTop, vfWidth, vfHeight),
    [screenWidth, screenHeight, vfTop, vfWidth, vfHeight],
  );

  const readyOpacity = useSharedValue(0);
  const readyStyle = useAnimatedStyle(() => ({
    opacity: readyOpacity.value,
  }));

  const handleCameraInitialized = () => {
    readyOpacity.value = withTiming(1, { duration: 1500, easing: easeOut });
  };

  const captureScale = useSharedValue(1);
  const captureAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: captureScale.value }],
  }));

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePhoto({ flash });

    // VisionCamera reports raw sensor dimensions (always landscape).
    // Swap to post-EXIF dimensions when the phone is held in portrait.
    const needsSwap =
      photo.orientation === "portrait" || photo.orientation === "portrait-upside-down";

    onPhotoTaken({
      ...photo,
      width: needsSwap ? photo.height : photo.width,
      height: needsSwap ? photo.width : photo.height,
    });
  };

  const handleCapturePressIn = () => {
    captureScale.value = withTiming(0.9, { duration: 120, easing: easeOut });
  };

  const handleCapturePressOut = () => {
    captureScale.value = withTiming(1, { duration: 200, easing: easeOut });
  };

  if (!device) return null;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
        onInitialized={handleCameraInitialized}
      />

      <Animated.View style={[styles.ui, readyStyle]}>
        {/* Instruction text */}
        {title && (
          <View style={[styles.titleContainer, { top: vfTop - 48 }]} pointerEvents="none">
            <Text style={styles.title}>{title}</Text>
          </View>
        )}

        {/* Dark overlay with rounded cutout */}
        <View style={styles.overlay} pointerEvents="none">
          <Svg width={screenWidth} height={screenHeight}>
            <Path d={cutoutPath} fill={OVERLAY_COLOR} fillRule="evenodd" />
          </Svg>

          {/* Viewfinder border + corner marks */}
          <View
            style={[
              styles.viewfinder,
              {
                top: vfTop,
                left: VIEWFINDER_PADDING,
                width: vfWidth,
                height: vfHeight,
              },
            ]}
          >
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <IconButton
            icon={<X size={22} color={theme.colors.ink} />}
            variant="outline"
            size={48}
            onPress={onDismiss}
          />

          <Animated.View style={captureAnimatedStyle}>
            <Pressable
              style={styles.captureButton}
              onPress={handleCapture}
              onPressIn={handleCapturePressIn}
              onPressOut={handleCapturePressOut}
            >
              <View style={styles.captureInner} />
            </Pressable>
          </Animated.View>

          <IconButton
            icon={
              flash === "off" ? (
                <ZapOff size={22} color={theme.colors.inkFaded} />
              ) : (
                <Zap size={22} color={theme.colors.warning} />
              )
            }
            variant="ghost"
            size={48}
            onPress={() => setFlash((f) => (f === "off" ? "on" : "off"))}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    position: "absolute",
    inset: 0,
    backgroundColor: theme.colors.night,
  },
  camera: {
    position: "absolute",
    inset: 0,
  },
  ui: {
    position: "absolute",
    inset: 0,
  },

  // Title
  titleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  title: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: 16,
    color: theme.colors.ink,
    textAlign: "center",
  },

  // Overlay
  overlay: {
    position: "absolute",
    inset: 0,
  },
  viewfinder: {
    position: "absolute",
    borderRadius: RADIUS,
  },

  // Corner marks
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: theme.colors.stamp,
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: theme.radius.xl,
  },
  cornerTopRight: {
    top: -1,
    right: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: theme.radius.xl,
  },
  cornerBottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: theme.radius.xl,
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: theme.radius.xl,
  },

  // Controls
  controls: {
    position: "absolute",
    bottom: rt.insets.bottom + theme.space(8),
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: theme.space(8),
  },

  // Capture button (iPhone-style)
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    borderWidth: 4,
    borderColor: theme.colors.ink,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  captureInner: {
    flex: 1,
    alignSelf: "stretch",
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.ink,
  },
}));
