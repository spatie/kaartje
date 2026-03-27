import { router } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ApiClient } from "@kaartje/shared/api";
import { usePostcard } from "../contexts/PostcardContext";
import { PostcardPreview } from "../components/PostcardPreview";

const api = new ApiClient({ baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000" });

/** Upload a local file to a presigned PUT URL (React Native compatible) */
async function uploadFileRN(presignedUrl: string, filePath: string, contentType: string) {
  const uri = filePath.startsWith("file://") ? filePath : `file://${filePath}`;
  const xhr = new XMLHttpRequest();
  return new Promise<void>((resolve, reject) => {
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send({ uri, type: contentType, name: "photo.jpg" } as any);
  });
}

export default function PreviewScreen() {
  const { croppedPhoto, message, senderName, location, country, reset } = usePostcard();

  if (!croppedPhoto) {
    router.replace("/camera-front");
    return null;
  }

  const handleRetake = () => {
    reset();
    router.replace("/camera-front");
  };

  const handleSend = async (): Promise<boolean> => {
    try {
      const frontPresign = await api.presignUpload({
        filename: "front.jpg",
        contentType: "image/jpeg",
      });

      await uploadFileRN(frontPresign.url, croppedPhoto.path, "image/jpeg");

      await api.createPostcard({
        frontImageKey: frontPresign.key,
        message: message || undefined,
        senderName: senderName || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        country: country || undefined,
      });

      router.replace("/success");
      return true;
    } catch (e) {
      console.warn("Failed to send postcard:", e);
      return false;
    }
  };

  return (
    <View style={styles.container}>
      <PostcardPreview
        frontPhoto={croppedPhoto}
        message={message || undefined}
        senderName={senderName || undefined}
        country={country || undefined}
        onRetake={handleRetake}
        onSend={handleSend}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.night,
  },
}));
