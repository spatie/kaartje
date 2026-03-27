import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { router } from "expo-router";
import { StyleSheet } from "react-native-unistyles";
import { CameraPermission } from "../components/CameraPermission";

export default function PermissionScreen() {
  return (
    <View style={styles.container}>
      <CameraPermission onPermissionGranted={() => router.replace("/camera-front")} />
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
