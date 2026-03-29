import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image as RNImage, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from './Button';
import type { Photo } from '../contexts/PostcardContext';

const easeOut = Easing.bezier(0.2, 0.9, 0.1, 1);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = 2.4;
const CARD_HEIGHT = 1.6;
const CARD_DEPTH = 0.02;
const LERP_SPEED = 0.12;
const FLY_LERP_SPEED = 0.08;
const FLICK_VELOCITY_THRESHOLD = 800;
const FLY_OFF_SPEED = 18;
const CAMERA_Z = 7.5;
const CAMERA_FOV = 45;

// Pixel dimensions of the card on screen

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

interface PostcardPreviewProps {
    frontPhoto: Photo;
    message?: string;
    senderName?: string;
    country?: string;
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
    };
}

function useTextureFromFile(uri: string) {
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;

        // Load image dimensions via RN Image, then create a texture in the
        // expo-gl format (localUri) — avoids THREE.TextureLoader which
        // depends on DOM APIs (document/Image) unavailable in React Native.
        RNImage.getSize(
            fileUri,
            (width, height) => {
                if (cancelled) return;
                const tex = new THREE.Texture();
                (tex as any).image = { data: { localUri: fileUri }, width, height };
                tex.flipY = true;
                tex.needsUpdate = true;
                (tex as any).isDataTexture = true;
                setTexture(tex);
            },
            (err) => console.warn('Failed to load texture:', fileUri, err),
        );

        return () => {
            cancelled = true;
        };
    }, [uri]);

    return texture;
}

// ---------------------------------------------------------------------------
// Generate the postcard back as a DataTexture (no Canvas/DOM needed)
// ---------------------------------------------------------------------------
const BACK_W = 600;
const BACK_H = 400;
const BG = [0xf5, 0xf0, 0xe8] as const; // cream paper
const LINE_C = [0x9b, 0x94, 0x89] as const; // ink faded
const TEXT_C = [0x3a, 0x36, 0x30] as const; // dark text
const STAMP_C = [0xc4, 0x5a, 0x3c] as const; // stamp red

function setRect(
    d: Uint8Array,
    w: number,
    x0: number,
    y0: number,
    rw: number,
    rh: number,
    c: readonly [number, number, number],
) {
    for (let y = y0; y < y0 + rh && y < BACK_H; y++) {
        for (let x = x0; x < x0 + rw && x < w; x++) {
            const i = (y * w + x) * 4;
            d[i] = c[0];
            d[i + 1] = c[1];
            d[i + 2] = c[2];
            d[i + 3] = 255;
        }
    }
}

/** Simple 5×7 bitmap font for uppercase + digits + basic punctuation */
const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPHS: Record<string, number[]> = {
    A: [0x04, 0x0a, 0x11, 0x1f, 0x11, 0x11, 0x11],
    B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
    E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
    K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
    T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    V: [0x11, 0x11, 0x11, 0x11, 0x0a, 0x0a, 0x04],
    W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    ' ': [0, 0, 0, 0, 0, 0, 0],
    '.': [0, 0, 0, 0, 0, 0, 0x04],
    ',': [0, 0, 0, 0, 0, 0x04, 0x08],
    '-': [0, 0, 0, 0x0e, 0, 0, 0],
    '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
    "'": [0x04, 0x04, 0, 0, 0, 0, 0],
    '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
    '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
    '3': [0x0e, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0e],
    '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
};

function drawText(
    d: Uint8Array,
    w: number,
    text: string,
    x0: number,
    y0: number,
    c: readonly [number, number, number],
    scale = 2,
) {
    let cx = x0;
    for (const ch of text.toUpperCase()) {
        const glyph = GLYPHS[ch];
        if (!glyph) {
            cx += (GLYPH_W + 1) * scale;
            continue;
        }
        for (let row = 0; row < GLYPH_H; row++) {
            for (let col = 0; col < GLYPH_W; col++) {
                if (glyph[row] & (1 << (GLYPH_W - 1 - col))) {
                    setRect(d, w, cx + col * scale, y0 + row * scale, scale, scale, c);
                }
            }
        }
        cx += (GLYPH_W + 1) * scale;
    }
}

function createBackDataTexture(opts?: { senderName?: string; message?: string; country?: string }): THREE.DataTexture {
    const data = new Uint8Array(BACK_W * BACK_H * 4);

    // Fill background
    for (let i = 0; i < BACK_W * BACK_H; i++) {
        data[i * 4] = BG[0];
        data[i * 4 + 1] = BG[1];
        data[i * 4 + 2] = BG[2];
        data[i * 4 + 3] = 255;
    }

    // Paper grain (subtle noise)
    for (let i = 0; i < BACK_W * BACK_H; i++) {
        const noise = (Math.random() - 0.5) * 6;
        data[i * 4] = Math.max(0, Math.min(255, data[i * 4] + noise));
        data[i * 4 + 1] = Math.max(0, Math.min(255, data[i * 4 + 1] + noise));
        data[i * 4 + 2] = Math.max(0, Math.min(255, data[i * 4 + 2] + noise));
    }

    const pad = 20;
    const half = BACK_W / 2;

    // Center divider
    setRect(data, BACK_W, half - 1, pad + 10, 2, BACK_H - pad * 2 - 10, LINE_C);

    // Stamp rectangle (top-right)
    const stampSize = 100;
    const sx = BACK_W - pad - stampSize;
    const sy = pad;
    setRect(data, BACK_W, sx, sy, stampSize, stampSize, STAMP_C);
    // Inner stamp cutout
    setRect(data, BACK_W, sx + 6, sy + 6, stampSize - 12, stampSize - 12, BG);
    // Stamp border dots
    for (let i = sx; i < sx + stampSize; i += 8) {
        setRect(data, BACK_W, i, sy, 4, 3, STAMP_C);
        setRect(data, BACK_W, i, sy + stampSize - 3, 4, 3, STAMP_C);
    }
    for (let i = sy; i < sy + stampSize; i += 8) {
        setRect(data, BACK_W, sx, i, 3, 4, STAMP_C);
        setRect(data, BACK_W, sx + stampSize - 3, i, 3, 4, STAMP_C);
    }

    // "POSTCARDWARE" label
    drawText(data, BACK_W, 'POSTCARDWARE', half + pad, pad + 20, LINE_C, 1);

    // Address lines (right side)
    const rightX = half + pad;
    const rightW = half - pad * 2;
    for (let i = 0; i < 4; i++) {
        const ly = BACK_H - pad - 130 + i * 32;
        setRect(data, BACK_W, rightX, ly, rightW, 1, LINE_C);
    }

    // Spatie address on the lines
    const addrY = BACK_H - pad - 127;
    drawText(data, BACK_W, 'SPATIE', rightX + 4, addrY, TEXT_C, 2);
    drawText(data, BACK_W, 'KRUIKSTRAAT 22', rightX + 4, addrY + 32, TEXT_C, 2);
    drawText(data, BACK_W, '2018 ANTWERP', rightX + 4, addrY + 64, TEXT_C, 2);
    drawText(data, BACK_W, 'BELGIUM', rightX + 4, addrY + 96, TEXT_C, 2);

    // Left side: user's message
    if (opts?.message) {
        const words = opts.message.toUpperCase().split(' ');
        let line = '';
        let ly = pad + 30;
        const maxW = half - pad * 2;
        const charW = (GLYPH_W + 1) * 2;
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (test.length * charW > maxW && line) {
                drawText(data, BACK_W, line, pad, ly, TEXT_C, 2);
                line = word;
                ly += 22;
                if (ly > BACK_H - 80) break;
            } else {
                line = test;
            }
        }
        if (line) drawText(data, BACK_W, line, pad, ly, TEXT_C, 2);
    }

    // Sender name (bottom-left)
    if (opts?.senderName) {
        drawText(data, BACK_W, '- ' + opts.senderName, pad, BACK_H - pad - 20, LINE_C, 2);
    }

    // Country (above sender)
    if (opts?.country) {
        drawText(data, BACK_W, opts.country, pad, BACK_H - pad - 44, LINE_C, 1);
    }

    // DataTexture: origin is bottom-left, so flip Y
    const flipped = new Uint8Array(data.length);
    for (let y = 0; y < BACK_H; y++) {
        const srcRow = y * BACK_W * 4;
        const dstRow = (BACK_H - 1 - y) * BACK_W * 4;
        flipped.set(data.subarray(srcRow, srcRow + BACK_W * 4), dstRow);
    }

    const tex = new THREE.DataTexture(flipped, BACK_W, BACK_H);
    tex.needsUpdate = true;
    return tex;
}

function PostcardMesh({
    frontUri,
    message,
    senderName,
    country,
    scene,
    onFlipChange,
}: {
    frontUri: string;
    message?: string;
    senderName?: string;
    country?: string;
    scene: SceneState;
    onFlipChange: (isBack: boolean) => void;
}) {
    const frontTexture = useTextureFromFile(frontUri);
    const groupRef = useRef<THREE.Group>(null);

    const currentY = useRef(0);
    const currentRotY = useRef(0);
    const currentScale = useRef(1);
    const wasBackRef = useRef(false);

    const backTexture = useMemo(
        () => createBackDataTexture({ senderName, message, country }),
        [senderName, message, country],
    );

    const edgeMaterial = useRef(new THREE.MeshBasicMaterial({ color: '#f0ebe3' }));
    const frontMaterial = useRef(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    const backMaterial = useRef(new THREE.MeshBasicMaterial({ map: backTexture }));

    useEffect(() => {
        if (frontTexture) {
            frontMaterial.current.map = frontTexture;
            frontMaterial.current.needsUpdate = true;
        }
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
            currentY.current = g.position.y;
            g.rotation.set(0, 0, 0);
            return;
        }

        // ---- Normal / drag / flyBack ----
        const targetY = scene.flyBack ? 0 : (-scene.dragY / SCREEN_HEIGHT) * 6;
        const speed = scene.flyBack ? FLY_LERP_SPEED : scene.isDragging ? 0.3 : LERP_SPEED;

        currentY.current = lerp(currentY.current, targetY, speed);
        currentRotY.current = lerp(currentRotY.current, scene.rotY, LERP_SPEED);
        currentScale.current = lerp(currentScale.current, 1, speed);

        const idleWeight = scene.isDragging || scene.isSending ? 0.2 : 1;
        const idleBob = Math.sin(t * 0.8) * 0.08 * idleWeight;

        g.position.set(0, currentY.current + idleBob, 0);
        g.rotation.x = 0;
        g.rotation.y = currentRotY.current;
        g.rotation.z = Math.sin(t * 0.5) * 0.015 * idleWeight;
        g.scale.setScalar(currentScale.current);

        // Notify parent when front/back face switches
        const isBack = Math.cos(currentRotY.current) < -0.1;
        if (isBack !== wasBackRef.current) {
            wasBackRef.current = isBack;
            onFlipChange(isBack);
        }
    });

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

export function PostcardPreview({ frontPhoto, message, senderName, country, onRetake, onSend }: PostcardPreviewProps) {
    const opacity = useSharedValue(0);
    const controlsOpacity = useSharedValue(1);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(false);
    const errorOpacity = useSharedValue(0);
    const errorStyle = useAnimatedStyle(() => ({ opacity: errorOpacity.value }));
    const scene = useMemo(createSceneState, []);
    let baseRotY = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    let sendingTimer: ReturnType<typeof setTimeout> | null = null;

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
        setError(false);
        errorOpacity.value = withTiming(0, { duration: 150, easing: easeOut });
        controlsOpacity.value = withTiming(0, { duration: 200, easing: easeOut });

        // Show loading state after card flies off screen (~300ms)
        sendingTimer = setTimeout(() => setSending(true), 300);

        onSend().then((success) => {
            if (!success) {
                if (sendingTimer) clearTimeout(sendingTimer);
                scene.sending = false;
                scene.sendTime = 0;
                scene.flyBack = true;
                scene.dragY = 0;
                setSending(false);
                setError(true);
                controlsOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: easeOut }));
                errorOpacity.value = withDelay(500, withTiming(1, { duration: 400, easing: easeOut }));
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
                    <ActivityIndicator size='large' color='#9b9489' />
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
                        <Canvas flat camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}>
                            <PostcardMesh
                                frontUri={`file://${frontPhoto.path}`}
                                message={message}
                                senderName={senderName}
                                country={country}
                                scene={scene}
                                onFlipChange={() => {}}
                            />
                        </Canvas>

                        {/* Full-screen gesture overlay so the entire screen is draggable */}
                        <GestureDetector gesture={composed}>
                            <View style={styles.gestureOverlay} />
                        </GestureDetector>
                    </Animated.View>

                    {error && (
                        <Animated.View style={[styles.errorContainer, errorStyle]}>
                            <Text style={styles.errorText}>Failed to send postcard</Text>
                            <Button size='sm' variant='primary' onPress={triggerSend}>
                                Try again
                            </Button>
                        </Animated.View>
                    )}

                    <Animated.View style={[styles.controls, controlsStyle]} pointerEvents='box-none'>
                        <Button variant='secondary' onPress={onRetake}>
                            Retake
                        </Button>
                        <Button variant='primary' onPress={triggerSend}>
                            Send
                        </Button>
                    </Animated.View>
                </>
            )}
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        position: 'absolute',
        inset: 0,
        backgroundColor: theme.colors.night,
    },
    header: {
        position: 'absolute',
        top: rt.insets.top + theme.space(8),
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1,
    },
    title: {
        fontFamily: theme.fonts.serif,
        fontSize: 24,
        color: theme.colors.ink,
        textAlign: 'center',
        marginBottom: theme.space(1),
    },
    subtitle: {
        fontFamily: theme.fonts.sans,
        fontSize: 14,
        color: theme.colors.inkFaded,
        textAlign: 'center',
    },
    canvas: {
        flex: 1,
    },
    gestureOverlay: {
        position: 'absolute',
        inset: 0,
    },
    controls: {
        position: 'absolute',
        bottom: rt.insets.bottom + theme.space(8),
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.space(3),
        paddingHorizontal: theme.space(8),
    },
    errorContainer: {
        position: 'absolute',
        bottom: rt.insets.bottom + theme.space(24),
        left: theme.space(6),
        right: theme.space(6),
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.error,
        borderRadius: theme.radius.lg,
        padding: theme.space(4),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
        zIndex: 2,
    },
    errorText: {
        fontFamily: theme.fonts.sansMedium,
        fontSize: 14,
        color: theme.colors.ink,
        flex: 1,
    },
    sendingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.space(3),
    },
    sendingTitle: {
        fontFamily: theme.fonts.serif,
        fontSize: 24,
        color: theme.colors.ink,
        textAlign: 'center',
    },
    sendingSubtitle: {
        fontFamily: theme.fonts.sans,
        fontSize: 14,
        color: theme.colors.inkFaded,
        textAlign: 'center',
    },
}));
