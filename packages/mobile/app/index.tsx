import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { View } from "react-native";
import { Camera } from "react-native-vision-camera";

import { StyleSheet } from "react-native-unistyles";
import { CameraPermission } from "../components/CameraPermission";
import { CameraView } from "../components/CameraView";
import { PostcardPreview } from "../components/PostcardPreview";
import { SuccessScreen } from "../components/SuccessScreen";
import { NetworkSphereView } from "../components/NetworkSphereView";

type ScreenPhase = "intro" | "permission" | "camera-front" | "camera-back" | "preview" | "success";

interface Photo {
  path: string;
  width: number;
  height: number;
}

export default function HomeScreen() {
  const [phase, setPhase] = useState<ScreenPhase>("intro");
  const [frontPhoto, setFrontPhoto] = useState<Photo | null>(null);
  const [backPhoto, setBackPhoto] = useState<Photo | null>(null);

  const handleIntroComplete = () => {
    const status = Camera.getCameraPermissionStatus();
    setPhase(status === "granted" ? "camera-front" : "permission");
  };

  const handleFrontPhotoTaken = (photo: Photo) => {
    setFrontPhoto(photo);
    setPhase("camera-back");
  };

  const handleBackPhotoTaken = (photo: Photo) => {
    setBackPhoto(photo);
    setPhase("preview");
  };

  const handleRetake = () => {
    setFrontPhoto(null);
    setBackPhoto(null);
    setPhase("camera-front");
  };

  const handleSend = async (): Promise<boolean> => {
    // TODO: send to API via WebSocket
    // Simulate network request
    await new Promise((r) => setTimeout(r, 500));
    setPhase("success");
    return true;
  };

  const handleSuccessComplete = () => {
    setFrontPhoto(null);
    setBackPhoto(null);
    setPhase("camera-front");
  };

  return (
    <View style={styles.container}>
      {phase === "intro" && <NetworkSphereView onComplete={handleIntroComplete} />}
      {phase === "permission" && (
        <CameraPermission onPermissionGranted={() => setPhase("camera-front")} />
      )}
      {phase === "camera-front" && (
        <CameraView
          title="Scan the front of the postcard"
          onDismiss={() => setPhase("intro")}
          onPhotoTaken={handleFrontPhotoTaken}
        />
      )}
      {phase === "camera-back" && (
        <CameraView
          title="Now scan the back"
          onDismiss={() => setPhase("camera-front")}
          onPhotoTaken={handleBackPhotoTaken}
        />
      )}
      {phase === "preview" && frontPhoto && backPhoto && (
        <PostcardPreview
          frontPhoto={frontPhoto}
          backPhoto={backPhoto}
          onRetake={handleRetake}
          onSend={handleSend}
        />
      )}
      {phase === "success" && <SuccessScreen onComplete={handleSuccessComplete} />}

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.night,
    alignItems: "center",
    justifyContent: "center",
  },
}));
