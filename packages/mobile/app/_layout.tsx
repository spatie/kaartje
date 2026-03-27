import "../unistyles";
import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { PostcardProvider } from "../contexts/PostcardContext";

// @react-three/fiber v9.5.0 still uses THREE.Clock, deprecated in three 0.183
LogBox.ignoreLogs(["THREE.THREE.Clock"]);

export default function RootLayout() {
  return (
    <PostcardProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 350,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="permission" options={{ animation: "fade" }} />
        <Stack.Screen name="camera-front" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="crop" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="details" options={{ animation: "slide_from_right" }} />
        <Stack.Screen
          name="preview"
          options={{ animation: "fade_from_bottom", animationDuration: 500 }}
        />
        <Stack.Screen name="success" options={{ animation: "fade", gestureEnabled: false }} />
      </Stack>
    </PostcardProvider>
  );
}
