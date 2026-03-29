import { router } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ApiClient } from "@kaartje/shared/api";
import { usePostcard } from "../contexts/PostcardContext";
import { PostcardPreview } from "../components/PostcardPreview";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? "";
const api = new ApiClient({ baseUrl: API_BASE, apiKey: API_KEY || undefined });

/** Upload image via the API — server converts to AVIF and stores in S3 */
async function uploadImageRN(filePath: string): Promise<string> {
  const uri = filePath.startsWith("file://") ? filePath : `file://${filePath}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { key } = JSON.parse(xhr.responseText);
        resolve(key);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.open("POST", `${API_BASE}/uploads`);

    const formData = new FormData();
    formData.append("file", { uri, type: "image/jpeg", name: "photo.jpg" } as any);
    xhr.send(formData);
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
      const frontImageKey = await uploadImageRN(croppedPhoto.path);

      await api.createPostcard({
        frontImageKey,
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
