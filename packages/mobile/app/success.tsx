import { View } from "react-native";
import { router } from "expo-router";
import { StyleSheet } from "react-native-unistyles";
import { usePostcard } from "../contexts/PostcardContext";
import { SuccessScreen } from "../components/SuccessScreen";

export default function SuccessScreenRoute() {
  const { reset } = usePostcard();

  return (
    <View style={styles.container}>
      <SuccessScreen
        onSendAnother={() => {
          reset();
          router.replace("/camera-front");
        }}
      />
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
