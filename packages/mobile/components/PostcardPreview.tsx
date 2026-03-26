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
  withDelay,
  Easing,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "./Button";
import { ActivityIndicator } from "react-native";

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

const SCREEN_HEIGHT = Dimensions.get("window").height;
const CARD_WIDTH = 2.4;
const CARD_HEIGHT = 1.6;
const CARD_DEPTH = 0.02;
const TILT_MAX = 0.15;
const LERP_SPEED = 0.12;
const FLY_LERP_SPEED = 0.08;
const FLICK_VELOCITY_THRESHOLD = 800;
const FLY_OFF_SPEED = 18;

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
  onRetake: () => void;
  onSend: () => Promise<boolean>;
}

// Plain mutable object — NOT a React ref, so Reanimated won't freeze it
interface SceneState {
  dragY: number;
  rotY: number;
  isDragging: boolean;
  isSending: boolean;
  sending: boolean;
  sendTime: number;
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
    sending: false,
    sendTime: 0,
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
    glCtx.pixelStorei(glCtx.UNPACK_FLIP_Y_WEBGL, true);
    glCtx.texImage2D(glCtx.TEXTURE_2D, 0, glCtx.RGBA, glCtx.RGBA, glCtx.UNSIGNED_BYTE, {
      localUri: uri,
    } as any);
    glCtx.pixelStorei(glCtx.UNPACK_FLIP_Y_WEBGL, false);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MIN_FILTER, glCtx.LINEAR);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MAG_FILTER, glCtx.LINEAR);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_S, glCtx.CLAMP_TO_EDGE);
    glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_T, glCtx.CLAMP_TO_EDGE);
    (glCtx as any).endFrameEXP?.();

    const tex = new THREE.Texture();
    tex.flipY = false;
    tex.needsUpdate = false;
    const props = gl.properties.get(tex) as Record<string, unknown>;
    props.__webglTexture = webglTex;
    props.__webglInit = true;
    setTexture(tex);
  }, [uri, gl]);

  return texture;
}

function PostcardMesh({
  frontUri,
  scene,
}: {
  frontUri: string;
  scene: SceneState;
}) {
  const gl = useThree((s) => s.gl);
  const frontTexture = useGlTexture(gl, frontUri);
  const groupRef = useRef<THREE.Group>(null);

  const currentY = useRef(0);
  const currentRotY = useRef(0);
  const currentScale = useRef(1);
  const smoothTilt = useRef({ x: 0, y: 0 });

  const edgeMaterial = useRef(new THREE.MeshBasicMaterial({ color: "#f0ebe3" }));
  const frontMaterial = useRef(new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const backMaterial = useRef(new THREE.MeshBasicMaterial({ color: "#f0ebe3" }));

  useEffect(() => {
    if (frontTexture) frontMaterial.current.map = frontTexture;
  }, [frontTexture]);

  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    elapsed.current += delta;
    const t = elapsed.current;
    const g = groupRef.current;

    // ---- Send: card flies straight up and off screen ----
    if (scene.sending) {
      scene.sendTime += delta;
      g.position.y += FLY_OFF_SPEED * delta;
      g.rotation.set(0, 0, 0);
      return;
    }

    // ---- Normal / drag / flyBack ----
    const targetY = scene.flyBack ? 0 : (-scene.dragY / SCREEN_HEIGHT) * 6;
    const speed = scene.flyBack ? FLY_LERP_SPEED : scene.isDragging ? 0.3 : LERP_SPEED;

    currentY.current = lerp(currentY.current, targetY, speed);
    currentRotY.current = lerp(currentRotY.current, scene.rotY, LERP_SPEED);
    currentScale.current = lerp(currentScale.current, 1, speed);

    smoothTilt.current.x = lerp(smoothTilt.current.x, scene.tiltX, LERP_SPEED);
    smoothTilt.current.y = lerp(smoothTilt.current.y, scene.tiltY, LERP_SPEED);

    const idleWeight = scene.isDragging || scene.isSending ? 0.2 : 1;
    const idleBob = Math.sin(t * 0.8) * 0.08 * idleWeight;

    g.position.set(0, currentY.current + idleBob, 0);
    g.rotation.x = smoothTilt.current.x;
    g.rotation.y = currentRotY.current + smoothTilt.current.y;
    g.rotation.z = Math.sin(t * 0.5) * 0.015 * idleWeight;
    g.scale.setScalar(currentScale.current);
  });

  if (!frontTexture) return null;

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

export function PostcardPreview({ frontPhoto, onRetake, onSend }: PostcardPreviewProps) {
  const opacity = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const [sending, setSending] = useState(false);
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

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const triggerSend = () => {
    scene.isSending = true;
    scene.sending = true;
    scene.sendTime = 0;
    controlsOpacity.value = withTiming(0, { duration: 200, easing: easeOut });

    // Show loading state after card flies off screen (~300ms)
    setTimeout(() => setSending(true), 300);

    onSend().then((success) => {
      if (!success) {
        scene.sending = false;
        scene.sendTime = 0;
        scene.flyBack = true;
        scene.dragY = 0;
        setSending(false);
        controlsOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: easeOut }));
        setTimeout(() => {
          scene.flyBack = false;
          scene.isSending = false;
        }, 500);
      }
    });
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
      {sending ? (
        <View style={styles.sendingContainer}>
          <ActivityIndicator size="large" color="#9b9489" />
          <Text style={styles.sendingTitle}>Sending card...</Text>
          <Text style={styles.sendingSubtitle}>Your postcard is on its way</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Your postcard</Text>
            <Text style={styles.subtitle}>Swipe up to send</Text>
          </View>

          <Animated.View style={[styles.canvas, animatedStyle]}>
            <GestureDetector gesture={composed}>
              <View style={styles.touchLayer}>
                <Canvas flat camera={{ position: [0, 0, 7.5], fov: 45 }}>
                  <PostcardMesh frontUri={`file://${frontPhoto.path}`} scene={scene} />
                </Canvas>
              </View>
            </GestureDetector>
          </Animated.View>

          <Animated.View
            style={[styles.controls, controlsStyle]}
            pointerEvents="box-none"
          >
            <Button variant="secondary" onPress={onRetake}>
              Retake
            </Button>
          </Animated.View>
        </>
      )}
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
  sendingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.space(3),
  },
  sendingTitle: {
    fontFamily: theme.fonts.serif,
    fontSize: 24,
    color: theme.colors.ink,
    textAlign: "center",
  },
  sendingSubtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    color: theme.colors.inkFaded,
    textAlign: "center",
  },
}));
