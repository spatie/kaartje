import { router } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ApiClient } from "@kaartje/shared/api";
import { usePostcard } from "../contexts/PostcardContext";
import { PostcardPreview } from "../components/PostcardPreview";

const api = new ApiClient({ baseUrl: "http://192.168.1.143:3000" });

export default function PreviewScreen() {
  const { croppedPhoto, message, senderName, reset } = usePostcard();

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

      await api.uploadFile(frontPresign.url, croppedPhoto.path, "image/jpeg");

      await api.createPostcard({
        frontImageKey: frontPresign.key,
        message: message || undefined,
        senderName: senderName || undefined,
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
