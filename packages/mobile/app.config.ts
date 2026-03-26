import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: "kaartje",
    slug: "kaartje",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "be.spatie.kaartje",
      appleTeamId: "97KRXCRMAY",
    },
    android: {
      package: "be.spatie.kaartje",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    scheme: "be.spatie.kaartje",
    plugins: [
      "react-native-edge-to-edge",
      "react-native-vision-camera",
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/DMSans-Regular.ttf",
            "./assets/fonts/DMSans-Medium.ttf",
            "./assets/fonts/DMSans-SemiBold.ttf",
            "./assets/fonts/DMSans-Bold.ttf",
            "./assets/fonts/DMSans-Italic.ttf",
            "./assets/fonts/DMSerifDisplay-Regular.ttf",
          ],
        },
      ],
    ],
  };
};
