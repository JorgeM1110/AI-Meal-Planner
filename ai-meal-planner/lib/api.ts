export const API_BASE = "http://127.0.0.1:8000"; // 👈 replace with your laptop's IP

export async function getWeeklyPlan() {
  const res = await fetch(`${API_BASE}/plan-week`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      diet: "vegetarian",
      proteinPerMeal: 30,
      weeklyBudget: 30,
      dailyCalories: 2000,
    }),
  });
  if (!res.ok) throw new Error("Server error");
  return res.json();
}
