import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Accelerometer } from "expo-sensors";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "./Button";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

const SCREEN_HEIGHT = Dimensions.get("window").height;
const CARD_WIDTH = 2.4;
const CARD_HEIGHT = 1.6;
const CARD_DEPTH = 0.02;
const TILT_MAX = 0.15;
const LERP_SPEED = 0.12;
const FLY_LERP_SPEED = 0.08;
const FLICK_VELOCITY_THRESHOLD = 800;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface Photo {
  path: string;
  width: number;
  height: number;
}

interface PostcardPreviewProps {
  frontPhoto: Photo;
  backPhoto: Photo;
  onRetake: () => void;
  onSend: () => Promise<boolean>;
}

// Plain mutable object — NOT a React ref, so Reanimated won't freeze it
interface SceneState {
  dragY: number;
  rotY: number;
  isDragging: boolean;
  isSending: boolean;
  flyOff: boolean;
  flyBack: boolean;
  tiltX: number;
  tiltY: number;
}

function createSceneState(): SceneState {
  return {
    dragY: 0,
    rotY: 0,
    isDragging: false,
    isSending: false,
    flyOff: false,
    flyBack: false,
    tiltX: 0,
    tiltY: 0,
  };
}

function useGlTexture(gl: THREE.WebGLRenderer, uri: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const glCtx = gl.getContext();
    const webglTex = glCtx.createTexture();
    glCtx.bindTexture(glCtx.TEXTURE_2D, webglTex);
    glCtx.texImage2D(glCtx.TEXTURE_2D, 0, glCtx.RGBA, glCtx.RGBA, glCtx.UNSIGNED_BYTE, {
      localUri: uri,
    } as any);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MIN_FILTER, glCtx.LINEAR);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MAG_FILTER, glCtx.LINEAR);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_S, glCtx.CLAMP_TO_EDGE);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_T, glCtx.CLAMP_TO_EDGE);
    glCtx.endFrameEXP();

    const tex = new THREE.Texture();
    tex.flipY = false;
    tex.needsUpdate = false;
    const props = gl.properties.get(tex);
    props.__webglTexture = webglTex;
    props.__webglInit = true;
    setTexture(tex);
  }, [uri, gl]);

  return texture;
}

function PostcardMesh({
  frontUri,
  backUri,
  scene,
}: {
  frontUri: string;
  backUri: string;
  scene: SceneState;
}) {
  const gl = useThree((s) => s.gl);
  const frontTexture = useGlTexture(gl, frontUri);
  const backTexture = useGlTexture(gl, backUri);
  const groupRef = useRef<THREE.Group>(null);

  const currentY = useRef(0);
  const currentRotY = useRef(0);
  const currentScale = useRef(1);
  const smoothTilt = useRef({ x: 0, y: 0 });

  const edgeMaterial = useRef(new THREE.MeshBasicMaterial({ color: "#f0ebe3" }));
  const frontMaterial = useRef(new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const backMaterial = useRef(new THREE.MeshBasicMaterial({ color: "#ffffff" }));

  useEffect(() => {
    if (frontTexture) frontMaterial.current.map = frontTexture;
    if (backTexture) backMaterial.current.map = backTexture;
  }, [frontTexture, backTexture]);

  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    elapsed.current += delta;
    const t = elapsed.current;

    const targetY = scene.flyOff ? 12 : scene.flyBack ? 0 : (-scene.dragY / SCREEN_HEIGHT) * 6;
    const targetScale = scene.flyOff ? 0.5 : 1;

    const speed =
      scene.flyOff || scene.flyBack ? FLY_LERP_SPEED : scene.isDragging ? 0.3 : LERP_SPEED;

    currentY.current = lerp(currentY.current, targetY, speed);
    currentRotY.current = lerp(currentRotY.current, scene.rotY, LERP_SPEED);
    currentScale.current = lerp(currentScale.current, targetScale, speed);

    smoothTilt.current.x = lerp(smoothTilt.current.x, scene.tiltX, LERP_SPEED);
    smoothTilt.current.y = lerp(smoothTilt.current.y, scene.tiltY, LERP_SPEED);

    const idleWeight = scene.isDragging || scene.isSending ? 0.2 : 1;
    const idleBob = Math.sin(t * 0.8) * 0.08 * idleWeight;

    groupRef.current.position.y = currentY.current + idleBob;
    groupRef.current.rotation.x = smoothTilt.current.x;
    groupRef.current.rotation.y = currentRotY.current + smoothTilt.current.y;
    groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.015 * idleWeight;
    groupRef.current.scale.setScalar(currentScale.current);
  });

  if (!frontTexture || !backTexture) return null;

  const edge = edgeMaterial.current;
  const materials = [edge, edge, edge, edge, frontMaterial.current, backMaterial.current];

  return (
    <group ref={groupRef}>
      <mesh material={materials}>
        <boxGeometry args={[CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH]} />
      </mesh>
    </group>
  );
}

export function PostcardPreview({ frontPhoto, backPhoto, onRetake, onSend }: PostcardPreviewProps) {
  const opacity = useSharedValue(0);
  const scene = useMemo(createSceneState, []);
  let baseRotY = 0;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  // Accelerometer — writes to plain scene object, not a ref
  useEffect(() => {
    Accelerometer.setUpdateInterval(60);
    const sub = Accelerometer.addListener(({ x, y }) => {
      scene.tiltX = y * TILT_MAX;
      scene.tiltY = x * TILT_MAX;
    });
    return () => sub.remove();
  }, [scene]);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400, easing: easeOut });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const triggerSend = () => {
    scene.isSending = true;
    scene.flyOff = true;

    setTimeout(async () => {
      const success = await onSend();
      if (!success) {
        scene.flyOff = false;
        scene.flyBack = true;
        scene.dragY = 0;
        setTimeout(() => {
          scene.flyBack = false;
          scene.isSending = false;
        }, 500);
      }
    }, 500);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      if (scene.isSending) return;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = null;
      scene.isDragging = true;
    })
    .onUpdate((e) => {
      if (scene.isSending) return;
      const isVertical = Math.abs(e.translationY) > Math.abs(e.translationX);
      if (isVertical) {
        scene.dragY = e.translationY;
        scene.rotY = 0;
        baseRotY = 0;
      } else {
        scene.dragY = 0;
        scene.rotY = baseRotY + (e.translationX / 100) * Math.PI;
      }
    })
    .onEnd((e) => {
      if (scene.isSending) return;
      scene.isDragging = false;
      baseRotY = scene.rotY;

      if (e.velocityY < -FLICK_VELOCITY_THRESHOLD && e.translationY < -50) {
        triggerSend();
      } else {
        scene.dragY = 0;
        resetTimer = setTimeout(() => {
          baseRotY = 0;
          scene.rotY = 0;
        }, 2000);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd(() => {
      baseRotY = 0;
      scene.rotY = 0;
    });

  const composed = Gesture.Simultaneous(pan, doubleTap);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your postcard</Text>
        <Text style={styles.subtitle}>Swipe up to send</Text>
      </View>

      <Animated.View style={[styles.canvas, animatedStyle]}>
        <GestureDetector gesture={composed}>
          <View style={styles.touchLayer}>
            <Canvas camera={{ position: [0, 0, 7.5], fov: 45 }}>
              <PostcardMesh frontUri={frontPhoto.path} backUri={backPhoto.path} scene={scene} />
            </Canvas>
          </View>
        </GestureDetector>
      </Animated.View>

      <View style={styles.controls} pointerEvents="box-none">
        <Button variant="secondary" onPress={onRetake}>
          Retake
        </Button>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    position: "absolute",
    inset: 0,
    backgroundColor: theme.colors.night,
  },
  header: {
    position: "absolute",
    top: rt.insets.top + theme.space(8),
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  title: {
    fontFamily: theme.fonts.serif,
    fontSize: 24,
    color: theme.colors.ink,
    textAlign: "center",
    marginBottom: theme.space(1),
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    color: theme.colors.inkFaded,
    textAlign: "center",
  },
  canvas: {
    flex: 1,
  },
  touchLayer: {
    flex: 1,
  },
  controls: {
    position: "absolute",
    bottom: rt.insets.bottom + theme.space(8),
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(8),
  },
}));
