import { useRef, useState } from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { X, Zap, ZapOff } from "lucide-react-native";
import { Camera, useCameraDevice, type PhotoFile } from "react-native-vision-camera";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { IconButton } from "./IconButton";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const VIEWFINDER_PADDING = 24;
const VIEWFINDER_WIDTH = SCREEN_WIDTH - VIEWFINDER_PADDING * 2;
const VIEWFINDER_HEIGHT = VIEWFINDER_WIDTH * (2 / 3);
const VIEWFINDER_TOP = (SCREEN_HEIGHT - VIEWFINDER_HEIGHT) / 2 - 40;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const OVERLAY_COLOR = "rgba(10, 10, 12, 0.6)";
const RADIUS = 16;

function buildCutoutPath() {
  const x = VIEWFINDER_PADDING;
  const y = VIEWFINDER_TOP;
  const w = VIEWFINDER_WIDTH;
  const h = VIEWFINDER_HEIGHT;
  const r = RADIUS;

  // Outer rect (full screen) + inner rounded rect (cutout via evenodd)
  return [
    `M0,0 H${SCREEN_WIDTH} V${SCREEN_HEIGHT} H0 Z`,
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

  const captureScale = useSharedValue(1);
  const captureAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: captureScale.value }],
  }));

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePhoto({ flash });

    // Determine rotation needed based on sensor orientation.
    // The sensor captures in landscape; we need portrait.
    let rotation = 0;
    if (photo.orientation === "landscape-right") rotation = 90;
    else if (photo.orientation === "landscape-left") rotation = -90;
    else if (photo.orientation === "portrait-upside-down") rotation = 180;

    // Display dimensions after rotation
    const rotated = rotation === 90 || rotation === -90;
    const displayW = rotated ? photo.height : photo.width;
    const displayH = rotated ? photo.width : photo.height;

    // Map viewfinder screen coords to rotated photo pixel coords.
    // Camera preview uses "cover" mode.
    const displayAspect = displayW / displayH;
    const screenAspect = SCREEN_WIDTH / SCREEN_HEIGHT;

    let visibleWidth: number;
    let visibleHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (displayAspect > screenAspect) {
      visibleHeight = displayH;
      visibleWidth = displayH * screenAspect;
      offsetX = (displayW - visibleWidth) / 2;
      offsetY = 0;
    } else {
      visibleWidth = displayW;
      visibleHeight = displayW / screenAspect;
      offsetX = 0;
      offsetY = (displayH - visibleHeight) / 2;
    }

    const scaleX = visibleWidth / SCREEN_WIDTH;
    const scaleY = visibleHeight / SCREEN_HEIGHT;

    const crop = {
      originX: Math.round(offsetX + VIEWFINDER_PADDING * scaleX),
      originY: Math.round(offsetY + VIEWFINDER_TOP * scaleY),
      width: Math.round(VIEWFINDER_WIDTH * scaleX),
      height: Math.round(VIEWFINDER_HEIGHT * scaleY),
    };

    // Rotate and crop in two steps to ensure crop coords apply to the rotated image
    let uri = `file://${photo.path}`;

    if (rotation !== 0) {
      const rotatedRef = await ImageManipulator.manipulate(uri).rotate(rotation).renderAsync();
      const rotated = await rotatedRef.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
      uri = rotated.uri;
    }

    const croppedRef = await ImageManipulator.manipulate(uri).crop(crop).renderAsync();
    const cropped = await croppedRef.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });

    onPhotoTaken({ ...photo, path: cropped.uri, width: crop.width, height: crop.height });
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
      <Camera ref={cameraRef} style={styles.camera} device={device} isActive={true} photo={true} />

      {/* Instruction text */}
      {title && (
        <View style={styles.titleContainer} pointerEvents="none">
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      {/* Dark overlay with rounded cutout */}
      <View style={styles.overlay} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
          <Path d={buildCutoutPath()} fill={OVERLAY_COLOR} fillRule="evenodd" />
        </Svg>

        {/* Viewfinder border + corner marks */}
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <IconButton
          icon={<X size={22} color="#ede6db" />}
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
              <ZapOff size={22} color="#9b9489" />
            ) : (
              <Zap size={22} color="#c49a3c" />
            )
          }
          variant="ghost"
          size={48}
          onPress={() => setFlash((f) => (f === "off" ? "on" : "off"))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    position: "absolute",
    inset: 0,
  },
  camera: {
    position: "absolute",
    inset: 0,
  },

  // Title
  titleContainer: {
    position: "absolute",
    top: VIEWFINDER_TOP - 48,
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
    top: VIEWFINDER_TOP,
    left: VIEWFINDER_PADDING,
    width: VIEWFINDER_WIDTH,
    height: VIEWFINDER_HEIGHT,
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
    borderColor: "#ede6db",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  captureInner: {
    flex: 1,
    alignSelf: "stretch",
    borderRadius: theme.radius.full,
    backgroundColor: "#ede6db",
  },
}));
