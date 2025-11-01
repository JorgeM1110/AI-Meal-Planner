import { View, Text, Button, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Meal Planner</Text>
      <Text style={styles.sub}>Tap the button to generate a mock plan.</Text>
      <Button title="Plan My Week" onPress={() => router.push("/plan")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8, color: "black" },
  sub: { fontSize: 14, marginBottom: 16, textAlign: "center", color: "black" },
});
