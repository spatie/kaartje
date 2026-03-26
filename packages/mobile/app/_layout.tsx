import "../unistyles";
import { LogBox } from "react-native";
import { Stack } from "expo-router";

// @react-three/fiber v9.5.0 still uses THREE.Clock, deprecated in three 0.183
LogBox.ignoreLogs(["THREE.THREE.Clock"]);

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
