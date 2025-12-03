import { View, Text, Button, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Meal Planner</Text>
      <Text style={styles.sub}>Tap the button to generate nutrient information and to develop a meal plan</Text>
      <Button title="Image Nutrition Analysis and Meal Coach" onPress={() => router.push("/coach")} />
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
