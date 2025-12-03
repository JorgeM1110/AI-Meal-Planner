import React, { useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const API_BASE = Platform.select({
  web: 'http://127.0.0.1:8000',
  ios: 'http://127.0.0.1:8000',
  android: 'http://10.0.2.2:8000',
  default: 'http://127.0.0.1:8000',
});

type Nutrient = { name: string; amount: number | null; unit: string | null; };
type Coach = {
  title: string; why_better: string; servings: number;
  macros_per_serving: { kcal: number|null; protein_g: number|null; carbs_g: number|null; fat_g: number|null; fiber_g: number|null; sodium_mg: number|null; sugar_g: number|null; };
  ingredients: string[]; steps: string[]; prep_time_min: number|null; cook_time_min: number|null; dietary_swaps: string[];
};
type ApiResponse = {
  detected_label: string; fdc_id: number|null; description: string|null;
  brand_owner: string|null; brand_name: string|null; category: string|null;
  class: string|null; serving_size: number|null; serving_unit: string|null; ingredients: string|null;
  nutrients: Nutrient[]; coach?: Coach; [k:string]: any;
};

function normalizeCoachKey(data: any): ApiResponse {
  if (data && !data.coach && data['Coach Recommendation']) {
    return { ...data, coach: data['Coach Recommendation'] } as ApiResponse;
  }
  return data as ApiResponse;
}

async function uploadToApi(uri: string): Promise<ApiResponse> {
  const name = uri.split('/').pop() || 'upload.jpg';
  const ext = name.split('.').pop()?.toLowerCase();
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();

  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    form.append('file', blob, name);
  } else {
    // React Native (Android/iOS) supports { uri, name, type }
    form.append('file', { uri, name, type });
  }

  const res = await fetch(`${API_BASE}/image-nutrition`, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  return normalizeCoachKey(await res.json());
}

const Pill = ({ label }: { label: string }) => (
  <View style={styles.pill}><Text style={styles.pillText}>{label}</Text></View>
);

function NutrientList({ nutrients }: { nutrients: Nutrient[] }) {
  const preferred = useMemo(() => {
    const seen = new Set<string>(); const out: Nutrient[] = [];
    const priority = ['Energy','Protein','Total lipid (fat)','Carbohydrate, by difference','Fiber, total dietary','Sodium, Na'];
    for (const p of priority) { const hit = nutrients.find(n => n.name === p); if (hit) { out.push(hit); seen.add(p); } }
    for (const n of nutrients) {
      if (seen.has(n.name)) continue;
      if (n.name === 'Energy' && (n.unit || '').toLowerCase() === 'kj') continue; // hide kJ
      if (out.length >= 10) break;
      out.push(n); seen.add(n.name);
    }
    return out;
  }, [nutrients]);
  return (
    <View style={{ gap: 10 }}>
      {preferred.map((n, i) => (
        <View key={i} style={styles.nutrientRow}>
          <Text style={styles.nutrientName}>{n.name}</Text>
          <Text style={styles.nutrientVal}>{n.amount ?? '—'} {n.unit ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

function MacroRow({ coach }: { coach?: Coach }) {
  if (!coach) return null;
  const m = coach.macros_per_serving || ({} as Coach['macros_per_serving']);
  const items: [string, number | null | undefined][] = [
    ['kcal', m.kcal], ['Protein (g)', m.protein_g], ['Carbs (g)', m.carbs_g],
    ['Fat (g)', m.fat_g], ['Fiber (g)', m.fiber_g], ['Sodium (mg)', m.sodium_mg], ['Sugar (g)', m.sugar_g],
  ];
  return (
    <View style={styles.macroRow}>
      {items.map(([k, v]) => (
        <View key={k} style={styles.macroPill}>
          <Text style={styles.macroKey}>{k}</Text>
          <Text style={styles.macroVal}>{v ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

export default function MealCoachScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission required', 'Please allow photo access.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!result.canceled) { setImageUri(result.assets[0].uri); setData(null); }
  };

  const upload = async () => {
    if (!imageUri) return;
    try { setLoading(true); setData(await uploadToApi(imageUri)); }
    catch (e: any) { Alert.alert('Upload failed', e?.message || String(e)); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>Image Nutrition Analyzer and Meal Recommender</Text>
        <Text style={styles.sub}>Upload a food item and get detailed nutritional information and a healthy meal!</Text>

        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={pickImage}><Text style={styles.btnText}>Upload Image</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, !imageUri && styles.btnDisabled]} onPress={upload} disabled={!imageUri || loading}>
            {loading ? <ActivityIndicator/> : <Text style={styles.btnText}>Analyze</Text>}
          </TouchableOpacity>
        </View>

        {imageUri && <View style={styles.previewBox}><Image source={{ uri: imageUri }} style={styles.preview} /></View>}

        {data && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{data.detected_label || 'Detected food'}</Text>
              <View style={styles.pills}>
                {data.brand_name && <Pill label={data.brand_name} />}
                {data.category && <Pill label={data.category} />}
              </View>
            </View>

            {data.description && <Text style={styles.desc}>{data.description}</Text>}

            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Nutrients</Text></View>
            <NutrientList nutrients={data.nutrients || []} />

            {data.coach && (
              <>
                <View style={styles.divider} />
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Coach Recommendation</Text>
                  <Pill label={`${data.coach.prep_time_min ?? '—'} + ${data.coach.cook_time_min ?? '—'} min`} />
                </View>

                <Text style={styles.recipeTitle}>{data.coach.title}</Text>
                <Text style={styles.why}>{data.coach.why_better}</Text>
                <MacroRow coach={data.coach} />

                <View style={styles.splitRow}>
                  <View style={styles.splitCol}>
                    <Text style={styles.h3}>Ingredients</Text>
                    {data.coach.ingredients.map((it, idx)=> (<Text key={idx} style={styles.li}>• {it}</Text>))}
                  </View>
                  <View style={styles.splitCol}>
                    <Text style={styles.h3}>Steps</Text>
                    {data.coach.steps.map((it, idx)=> (<Text key={idx} style={styles.li}>{idx+1}. {it}</Text>))}
                  </View>
                </View>

                {data.coach.dietary_swaps?.length ? <Text style={styles.h3}>Dietary swaps</Text> : null}
                {data.coach.dietary_swaps?.map((s,i)=>(<Text key={i} style={styles.li}>• {s}</Text>))}
              </>
            )}
          </View>
        )}

        {!data && <Text style={styles.muted}>Pick an image and tap Analyze to see results here.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0e11' },
  container: { padding: 16 },
  h1: { color: 'white', fontSize: 28, fontWeight: '700' },
  sub: { color: '#b9c1c9', marginTop: 6 },
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { backgroundColor: '#4f46e5', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'white', fontWeight: '600' },
  previewBox: { marginTop: 16, borderRadius: 16, overflow: 'hidden', borderColor: '#1f2937', borderWidth: 1 },
  preview: { width: '100%', height: 220, resizeMode: 'cover' },

  card: { backgroundColor: '#0f1318', marginTop: 16, borderRadius: 16, borderColor: '#1f2937', borderWidth: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: 'white', fontSize: 20, fontWeight: '700', flex: 1, paddingRight: 8 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { backgroundColor: '#111827', borderColor: '#374151', borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  pillText: { color: '#cbd5e1', fontSize: 12 },

  desc: { color: '#cbd5e1', marginTop: 8 },
  sectionHeader: { marginTop: 16, marginBottom: 8 },
  sectionHeaderRow: { marginTop: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
  recipeTitle: { color: 'white', fontWeight: '700', fontSize: 18, marginBottom: 6 },
  why: { color: '#9ca3af', marginBottom: 12 },

  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  macroPill: { borderColor: '#1f2937', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  macroKey: { color: '#9ca3af', fontSize: 12 },
  macroVal: { color: 'white', fontWeight: '700', fontSize: 14, marginTop: 2 },

  splitRow: { flexDirection: 'row', gap: 16 },
  splitCol: { flex: 1 },
  h3: { color: 'white', fontWeight: '700', fontSize: 16, marginTop: 8, marginBottom: 8 },
  li: { color: '#e5e7eb', marginBottom: 6 },

  nutrientRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: '#111827', borderBottomWidth: 1 },
  nutrientName: { color: '#cbd5e1' },
  nutrientVal: { color: 'white', fontWeight: '600' },

  divider: { borderBottomColor: '#1f2937', borderBottomWidth: 1, marginVertical: 12 },
  muted: { color: '#6b7280', marginTop: 24 },
});
