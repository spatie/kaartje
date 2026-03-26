import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Postcardware</Text>
      <Text style={styles.title}>Kaartje</Text>
      <Text style={styles.subtitle}>Postcards from around the world.</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: theme.colors.stamp,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: theme.space(2),
  },
  title: {
    fontSize: 48,
    color: theme.colors.ink,
    marginBottom: theme.space(2),
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.inkFaded,
  },
}));
