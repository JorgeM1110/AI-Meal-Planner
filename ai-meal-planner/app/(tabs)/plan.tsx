import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { getWeeklyPlan } from "../../lib/api";

export default function PlanScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await getWeeklyPlan();
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1, justifyContent: "center" }} />;
  if (!data) return <Text>No data from server</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Weekly Plan</Text>
      <FlatList
        data={data.days}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{item.date}</Text>
            {item.meals.map((m, idx) => (
              <View key={idx} style={styles.mealRow}>
                <Text style={styles.mealTitle}>{m.time} — {m.recipe.label}</Text>
                <Text style={styles.mealMeta}>
                  {m.recipe.protein}g protein • {m.recipe.calories} kcal • ${m.recipe.cost}
                </Text>
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, marginBottom: 12 },
  date: { fontWeight: "700", marginBottom: 8 },
  mealRow: { marginBottom: 8 },
  mealTitle: { fontWeight: "600" },
  mealMeta: { color: "#555" },
});
