import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Open up app/index.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.colors.typography,
  },
}));
