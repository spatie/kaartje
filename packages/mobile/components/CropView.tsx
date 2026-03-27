import { Image, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ArrowLeft, Check } from "lucide-react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { IconButton } from "./IconButton";
import type { Photo } from "../contexts/PostcardContext";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

const VIEWFINDER_PADDING = 24;
const RADIUS = 16;
const OVERLAY_COLOR = "rgba(10, 10, 12, 0.6)";
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const MAX_ZOOM = 5;

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

interface CropViewProps {
  photo: Photo;
  onDismiss: () => void;
  onCropped: (photo: Photo) => void;
}

export function CropView({ photo, onDismiss, onCropped }: CropViewProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Frame geometry (matches CameraView viewfinder)
  const vfWidth = screenWidth - VIEWFINDER_PADDING * 2;
  const vfHeight = vfWidth * (2 / 3);
  const vfTop = (screenHeight - vfHeight) / 2 - 40;
  const frameCenterY = vfTop + vfHeight / 2;

  // Photo display size (fit to screen width at zoom 1)
  const displayH = screenWidth * (photo.height / photo.width);

  // Camera preview aspect-fills the screen, centered on screen center
  const cameraFillZoom = Math.max(1, screenHeight / displayH);

  // Minimum zoom: at least camera-fill zoom, and always cover the viewfinder
  const minZoom = Math.max(cameraFillZoom, vfWidth / screenWidth, vfHeight / displayH);

  // Position photo centered on screen (matching camera preview centering)
  const photoTop = screenHeight / 2 - displayH / 2;

  const cutoutPath = buildCutoutPath(screenWidth, screenHeight, vfTop, vfWidth, vfHeight);

  // Gesture state — photo starts centered on screen like camera preview
  const scale = useSharedValue(minZoom);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(minZoom);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Fade in
  const opacity = useSharedValue(0);
  opacity.value = withTiming(1, { duration: 300, easing: easeOut });
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const pinch = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      "worklet";
      const s = Math.max(minZoom, Math.min(savedScale.value * e.scale, MAX_ZOOM));
      scale.value = s;
      // Re-clamp translation for new scale
      const maxTx = Math.max(0, (screenWidth * s - vfWidth) / 2);
      const maxTy = Math.max(0, (displayH * s - vfHeight) / 2);
      translateX.value = Math.max(-maxTx, Math.min(translateX.value, maxTx));
      translateY.value = Math.max(-maxTy, Math.min(translateY.value, maxTy));
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      "worklet";
      savedTx.value = translateX.value;
      savedTy.value = translateY.value;
    })
    .onUpdate((e) => {
      "worklet";
      const s = scale.value;
      const maxTx = Math.max(0, (screenWidth * s - vfWidth) / 2);
      const maxTy = Math.max(0, (displayH * s - vfHeight) / 2);
      translateX.value = Math.max(-maxTx, Math.min(savedTx.value + e.translationX, maxTx));
      translateY.value = Math.max(-maxTy, Math.min(savedTy.value + e.translationY, maxTy));
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = async () => {
    const s = scale.value;
    const tx = translateX.value;
    const ty = translateY.value;

    // Frame position relative to photo's visual top-left
    // Photo is centered on screen; viewfinder is at vfTop (offset from screen center)
    const relX = VIEWFINDER_PADDING - tx + (screenWidth * (s - 1)) / 2;
    const photoVisualTop = (screenHeight / 2) - (displayH * s) / 2 - ty;
    const relY = vfTop - photoVisualTop;

    const uri = `file://${photo.path}`;

    // Get actual bitmap dimensions (may differ from photo.width/height due to EXIF rotation)
    const bitmapSize = await new Promise<{ w: number; h: number }>((resolve) => {
      Image.getSize(uri, (w, h) => resolve({ w, h }));
    });

    const bmpW = bitmapSize.w;
    const bmpH = bitmapSize.h;

    // Recalculate ppp using actual bitmap width
    const actualPpp = bmpW / (screenWidth * s);

    const cropX = Math.floor(relX * actualPpp);
    const cropY = Math.floor(relY * actualPpp);
    const cropW = Math.floor(vfWidth * actualPpp);
    const cropH = Math.floor(vfHeight * actualPpp);

    // Strict clamp — guarantee originX + width <= bitmap dimensions
    const originX = Math.max(0, Math.min(cropX, bmpW - 1));
    const originY = Math.max(0, Math.min(cropY, bmpH - 1));
    const width = Math.max(1, Math.min(cropW, bmpW - originX));
    const height = Math.max(1, Math.min(cropH, bmpH - originY));
    const crop = { originX, originY, width, height };

    const ref = await ImageManipulator.manipulate(uri).crop(crop).renderAsync();
    const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    const croppedPath = result.uri.replace(/^file:\/\//, "");

    onCropped({ path: croppedPath, width: crop.width, height: crop.height });
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Photo layer */}
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: photoTop,
              width: screenWidth,
              height: displayH,
            },
            imageStyle,
          ]}
        >
          <Image
            source={{ uri: `file://${photo.path}` }}
            style={{ width: screenWidth, height: displayH }}
          />
        </Animated.View>
      </GestureDetector>

      {/* Overlay with cutout */}
      <Animated.View style={[styles.overlay, fadeStyle]} pointerEvents="none">
        <Svg width={screenWidth} height={screenHeight}>
          <Path d={cutoutPath} fill={OVERLAY_COLOR} fillRule="evenodd" />
        </Svg>
        <View
          style={[
            styles.viewfinder,
            { top: vfTop, left: VIEWFINDER_PADDING, width: vfWidth, height: vfHeight },
          ]}
        >
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View
        style={[styles.titleContainer, { top: vfTop - 48 }, fadeStyle]}
        pointerEvents="none"
      >
        <Text style={styles.title}>Adjust your photo</Text>
      </Animated.View>

      {/* Controls */}
      <Animated.View style={[styles.controls, fadeStyle]}>
        <IconButton
          icon={<ArrowLeft size={22} color="#ede6db" />}
          variant="outline"
          size={48}
          onPress={onDismiss}
        />
        <IconButton
          icon={<Check size={22} color="#ede6db" />}
          variant="outline"
          size={48}
          onPress={handleConfirm}
        />
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#000",
  },
  overlay: {
    position: "absolute",
    inset: 0,
  },
  viewfinder: {
    position: "absolute",
    borderRadius: RADIUS,
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: theme.colors.stamp,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: theme.radius.xl,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: theme.radius.xl,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: theme.radius.xl,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: theme.radius.xl,
  },
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
}));
