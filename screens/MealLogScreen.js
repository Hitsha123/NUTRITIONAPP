import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LinearGradient from "react-native-linear-gradient";
import * as Progress from "react-native-progress";
import { debounce } from "lodash";

const { width } = Dimensions.get("window");

// ─── LIGHT THEME ──────────────────────────────────────────────────────────────
const T = {
  bg:       "#F4F6FB",
  card:     "#FFFFFF",
  border:   "#E8ECF4",
  textPrim: "#1A2340",
  textSec:  "#6B7A99",
  textMute: "#A0AABD",

  accent:   "#667EEA",
  accentSoft: "#667EEA15",

  cal:   "#FF6B6B",  calBg:   "#FF6B6B12",
  prot:  "#4FACFE",  protBg:  "#4FACFE12",
  carbs: "#F5A623",  carbsBg: "#F5A62312",
  fat:   "#A78BFA",  fatBg:   "#A78BFA12",
  water: "#10B981",  waterBg: "#10B98112",

  danger:  "#EF4444",
  success: "#10B981",
  warn:    "#F59E0B",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const NUTRIENT_IDS = { CALORIES: 1008, PROTEIN: 1003, CARBS: 1005, FATS: 1004, FIBER: 1079, SODIUM: 1093 };
const API_CONFIG = {
  KEY: "J7tDs0cUGkWOtNmOKtNLYIewxQOnOmYDhvf8R3hy",
  SEARCH_URL: "https://api.nal.usda.gov/fdc/v1/foods/search",
  DETAILS_URL: "https://api.nal.usda.gov/fdc/v1/food",
  TIMEOUT: 10000,
};
const STORAGE_KEYS = { FOODS: "selectedFoods", WATER: "waterIntake", SUPPLEMENTS: "supplements", RECIPES: "savedRecipes", GOALS: "nutritionGoals", HISTORY: "mealHistory" };
const DEFAULT_GOALS = { calorieGoal: 2000, proteinGoal: 150, waterGoal: 2500, carbsGoal: 250, fatsGoal: 65 };
const formatNumber = (n) => (isNaN(n) ? "0" : parseFloat(n).toFixed(1));
const today = () => new Date().toISOString().split("T")[0];

// ─── SERVICES ─────────────────────────────────────────────────────────────────
const Storage = {
  async save(key, val) { try { await AsyncStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } },
  async load(key, def = null) { try { const d = await AsyncStorage.getItem(key); return d ? JSON.parse(d) : def; } catch { return def; } },
};

const API = {
  async search(query, pageSize = 20) {
    if (!query || query.length < 2) return { success: false, data: [] };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), API_CONFIG.TIMEOUT);
      const res = await fetch(`${API_CONFIG.SEARCH_URL}?query=${encodeURIComponent(query)}&api_key=${API_CONFIG.KEY}&pageSize=${pageSize}`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error();
      const data = await res.json();
      return { success: true, data: data.foods || [] };
    } catch (e) { return { success: false, data: [], error: e.name === "AbortError" ? "Timeout" : "Network error" }; }
  },
  async details(fdcId) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), API_CONFIG.TIMEOUT);
      const res = await fetch(`${API_CONFIG.DETAILS_URL}/${fdcId}?api_key=${API_CONFIG.KEY}`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error();
      const data = await res.json();
      return { success: true, data };
    } catch (e) { return { success: false, data: null }; }
  },
  nutrients(fd) {
    const get = (id) => fd.foodNutrients?.find((n) => n.nutrient?.id === id)?.amount || 0;
    return { calories: get(NUTRIENT_IDS.CALORIES), protein: get(NUTRIENT_IDS.PROTEIN), carbs: get(NUTRIENT_IDS.CARBS), fats: get(NUTRIENT_IDS.FATS), fiber: get(NUTRIENT_IDS.FIBER), sodium: get(NUTRIENT_IDS.SODIUM) };
  },
};

// ─── PROGRESS BAR ────────────────────────────────────────────────────────────
const NutrientBar = ({ label, emoji, current, goal, color, colorBg }) => {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  const over = current > goal && goal > 0;
  const remaining = Math.max(goal - current, 0);
  const pctDisplay = Math.round(pct * 100);

  return (
    <View style={styles.nutrientBar}>
      <View style={styles.nutrientBarTop}>
        <View style={styles.nutrientBarLeft}>
          <View style={[styles.nutrientDot, { backgroundColor: color }]} />
          <Text style={styles.nutrientBarLabel}>{emoji} {label}</Text>
        </View>
        <View style={styles.nutrientBarRight}>
          <Text style={[styles.nutrientCurrent, { color }]}>{formatNumber(current)}</Text>
          <Text style={styles.nutrientGoalText}>/{goal}</Text>
          <View style={[styles.pctBadge, { backgroundColor: colorBg }]}>
            <Text style={[styles.pctBadgeText, { color }]}>{pctDisplay}%</Text>
          </View>
        </View>
      </View>
      <Progress.Bar
        progress={pct}
        width={null}
        height={8}
        color={over ? T.danger : color}
        unfilledColor={T.border}
        borderWidth={0}
        borderRadius={8}
        style={{ marginTop: 8 }}
      />
      {!over && remaining > 0 && (
        <Text style={styles.nutrientRemaining}>{formatNumber(remaining)} left</Text>
      )}
    </View>
  );
};

// ─── STAT CHIP ────────────────────────────────────────────────────────────────
const StatChip = ({ emoji, label, value, unit, color, colorBg }) => (
  <View style={[styles.statChip, { borderTopColor: color, borderTopWidth: 3 }]}>
    <Text style={styles.statChipEmoji}>{emoji}</Text>
    <Text style={[styles.statChipValue, { color }]}>{value}</Text>
    <Text style={styles.statChipUnit}>{unit}</Text>
    <Text style={styles.statChipLabel}>{label}</Text>
  </View>
);

// ─── FOOD RESULT ITEM ────────────────────────────────────────────────────────
const FoodResultItem = React.memo(({ item, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.resultItem} activeOpacity={0.7}>
    <View style={styles.resultLeft}>
      <View style={styles.resultIconWrap}>
        <Text style={styles.resultIcon}>🍽️</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={2}>{item.description}</Text>
        {item.brandName && <Text style={styles.resultBrand}>📦 {item.brandName}</Text>}
      </View>
    </View>
    <Text style={styles.resultChevron}>›</Text>
  </TouchableOpacity>
));

// ─── LOGGED FOOD ITEM ────────────────────────────────────────────────────────
const LoggedItem = React.memo(({ item, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.logItem}>
      <TouchableOpacity style={{ flex: 1 }} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.logItemHeader}>
          <Text style={styles.logItemName} numberOfLines={expanded ? undefined : 1}>{item.name}</Text>
          <Text style={[styles.logItemCal, { color: T.cal }]}>{formatNumber(item.calories)} kcal</Text>
        </View>
        <View style={styles.macroRow}>
          <View style={[styles.macroChip, { backgroundColor: T.protBg }]}>
            <Text style={[styles.macroChipText, { color: T.prot }]}>P {formatNumber(item.protein)}g</Text>
          </View>
          <View style={[styles.macroChip, { backgroundColor: T.carbsBg }]}>
            <Text style={[styles.macroChipText, { color: T.carbs }]}>C {formatNumber(item.carbs)}g</Text>
          </View>
          <View style={[styles.macroChip, { backgroundColor: T.fatBg }]}>
            <Text style={[styles.macroChipText, { color: T.fat }]}>F {formatNumber(item.fats)}g</Text>
          </View>
        </View>
        {expanded && (
          <View style={styles.logItemExpanded}>
            {item.quantity !== "custom" && <Text style={styles.logItemDetail}>Quantity: {formatNumber(item.quantity)}g</Text>}
            {item.fiber > 0 && <Text style={styles.logItemDetail}>Fiber: {formatNumber(item.fiber)}g</Text>}
            {item.sodium > 0 && <Text style={styles.logItemDetail}>Sodium: {formatNumber(item.sodium)}mg</Text>}
          </View>
        )}
        <Text style={styles.logItemTime}>
          🕐 {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
});

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────
const Sheet = ({ visible, onClose, title, children }) => (
  <Modal visible={visible} transparent animationType="slide">
    <View style={styles.sheetOverlay}>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <Text style={styles.sheetCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </View>
  </Modal>
);

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function MealLogScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [foods, setFoods] = useState([]);
  const [water, setWater] = useState(0);
  const [supplements, setSupplements] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);

  const [detailModal, setDetailModal] = useState(false);
  const [foodDetails, setFoodDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [quantity, setQuantity] = useState("100");
  const [calc, setCalc] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 });

  const [customModal, setCustomModal] = useState(false);
  const [customFood, setCustomFood] = useState({ name: "", calories: "", protein: "", carbs: "", fats: "" });

  const [waterModal, setWaterModal] = useState(false);
  const [waterAmt, setWaterAmt] = useState("");

  const [recipeModal, setRecipeModal] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [loadRecipeModal, setLoadRecipeModal] = useState(false);

  const [goalsModal, setGoalsModal] = useState(false);
  const [editGoals, setEditGoals] = useState(DEFAULT_GOALS);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastDate = useRef(today());

  useEffect(() => { loadAll(); Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(); }, []);

  useEffect(() => {
    const check = setInterval(() => {
      const cur = today();
      if (cur !== lastDate.current) { handleMidnightReset(lastDate.current); lastDate.current = cur; }
    }, 60000);
    return () => clearInterval(check);
  }, [foods]);

  const handleMidnightReset = async (prev) => {
    if (foods.length > 0) { const h = await Storage.load(STORAGE_KEYS.HISTORY, {}); h[prev] = foods; await Storage.save(STORAGE_KEYS.HISTORY, h); }
    setFoods([]); setWater(0); setSupplements([]);
    Alert.alert("New Day! 🌅", "Yesterday's data saved. Fresh start today!");
  };

  const loadAll = async () => {
    const [savedFoods, savedWater, savedSupps, savedRecipes, savedGoals] = await Promise.all([
      Storage.load(STORAGE_KEYS.FOODS, []),
      Storage.load(STORAGE_KEYS.WATER, 0),
      Storage.load(STORAGE_KEYS.SUPPLEMENTS, []),
      Storage.load(STORAGE_KEYS.RECIPES, []),
      Storage.load(STORAGE_KEYS.GOALS, DEFAULT_GOALS),
    ]);
    const t = today();
    const lastFoodDate = savedFoods.length > 0 ? new Date(savedFoods[0].timestamp).toISOString().split("T")[0] : t;
    if (lastFoodDate !== t) {
      if (savedFoods.length > 0) { const h = await Storage.load(STORAGE_KEYS.HISTORY, {}); h[lastFoodDate] = savedFoods; await Storage.save(STORAGE_KEYS.HISTORY, h); }
    } else {
      setFoods(savedFoods); setWater(savedWater); setSupplements(savedSupps);
    }
    setRecipes(savedRecipes); setGoals(savedGoals); setEditGoals(savedGoals);
  };

  useEffect(() => {
    Storage.save(STORAGE_KEYS.FOODS, foods);
    Storage.save(STORAGE_KEYS.WATER, water);
    Storage.save(STORAGE_KEYS.SUPPLEMENTS, supplements);
    Storage.save(STORAGE_KEYS.RECIPES, recipes);
  }, [foods, water, supplements, recipes]);

  const debouncedSearch = useCallback(
    debounce(async (text) => {
      if (!text || text.length < 2) { setResults([]); setSearchError(null); return; }
      setSearching(true); setSearchError(null);
      const result = await API.search(text);
      if (result.success) setResults(result.data);
      else { setSearchError(result.error || "Search failed"); setResults([]); }
      setSearching(false);
    }, 600),
    []
  );

  const handleSearch = (text) => { setQuery(text); debouncedSearch(text); };

  const handleSelectFood = async (food) => {
    setQuantity("100"); setCalc({ calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 });
    setDetailModal(true); setLoadingDetails(true); setFoodDetails(null);
    const result = await API.details(food.fdcId);
    if (result.success) { setFoodDetails(result.data); recalc("100", result.data); }
    else { Alert.alert("Error", "Could not load food details."); setDetailModal(false); }
    setLoadingDetails(false);
  };

  const recalc = (q, details = foodDetails) => {
    setQuantity(q);
    if (!details) return;
    const g = parseFloat(q);
    if (isNaN(g) || g <= 0) { setCalc({ calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 }); return; }
    const n = API.nutrients(details);
    const m = g / 100;
    setCalc({ calories: formatNumber(n.calories * m), protein: formatNumber(n.protein * m), carbs: formatNumber(n.carbs * m), fats: formatNumber(n.fats * m), fiber: formatNumber(n.fiber * m), sodium: formatNumber(n.sodium * m) });
  };

  const handleAddFood = () => {
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) { Alert.alert("Invalid Quantity", "Please enter a valid gram amount."); return; }
    setFoods((p) => [...p, { id: `${Date.now()}-${Math.random()}`, name: foodDetails.description, quantity: qty, ...calc, timestamp: new Date().toISOString() }]);
    setDetailModal(false); setQuery(""); setResults([]); setSearchError(null);
  };

  const handleAddCustom = () => {
    const { name, calories, protein, carbs, fats } = customFood;
    if (!name.trim() || !calories || isNaN(parseFloat(calories))) { Alert.alert("Invalid Input", "Enter at least a name and calories."); return; }
    setFoods((p) => [...p, { id: `${Date.now()}-${Math.random()}`, name: name.trim(), calories: formatNumber(parseFloat(calories)), protein: formatNumber(parseFloat(protein || 0)), carbs: formatNumber(parseFloat(carbs || 0)), fats: formatNumber(parseFloat(fats || 0)), quantity: "custom", timestamp: new Date().toISOString() }]);
    setCustomModal(false); setCustomFood({ name: "", calories: "", protein: "", carbs: "", fats: "" });
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim()) { Alert.alert("Error", "Enter a recipe name."); return; }
    if (foods.length === 0) { Alert.alert("Error", "Log some food first."); return; }
    setRecipes((p) => [...p, { id: `${Date.now()}-${Math.random()}`, name: recipeName.trim(), foods, createdAt: new Date().toISOString() }]);
    setRecipeModal(false); setRecipeName("");
    Alert.alert("Saved!", `Recipe "${recipeName}" saved.`);
  };

  const handleLoadRecipe = (recipe) => {
    setFoods((p) => [...p, ...recipe.foods.map((f) => ({ ...f, id: `${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString() }))]);
    setLoadRecipeModal(false);
    Alert.alert("Loaded!", `${recipe.name} added to your log.`);
  };

  const handleSaveGoals = () => {
    setGoals(editGoals); Storage.save(STORAGE_KEYS.GOALS, editGoals); setGoalsModal(false);
    Alert.alert("Saved!", "Daily goals updated.");
  };

  const totals = useMemo(() =>
    foods.reduce((a, f) => ({ calories: a.calories + parseFloat(f.calories || 0), protein: a.protein + parseFloat(f.protein || 0), carbs: a.carbs + parseFloat(f.carbs || 0), fats: a.fats + parseFloat(f.fats || 0) }), { calories: 0, protein: 0, carbs: 0, fats: 0 }),
    [foods]
  );

  const overallPct = goals.calorieGoal > 0 ? Math.min(Math.round((totals.calories / goals.calorieGoal) * 100), 100) : 0;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#667EEA" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ── HEADER ── */}
            <LinearGradient colors={["#667EEA", "#764BA2"]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.headerTitle}>Nutrition Tracker</Text>
                  <Text style={styles.headerDate}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Text>
                </View>
                <TouchableOpacity style={styles.settingsBtn} onPress={() => { setEditGoals(goals); setGoalsModal(true); }}>
                  <Text style={{ fontSize: 20 }}>⚙️</Text>
                </TouchableOpacity>
              </View>

              {/* Overall score */}
              <View style={styles.overallRow}>
                <View style={styles.overallLeft}>
                  <Text style={styles.overallPct}>{overallPct}%</Text>
                  <Text style={styles.overallLabel}>of calorie goal</Text>
                </View>
                <View style={styles.statsRow}>
                  <StatChip emoji="🔥" label="Calories" value={Math.round(totals.calories)} unit={`/${goals.calorieGoal}`} color={T.cal} colorBg={T.calBg} />
                  <StatChip emoji="💪" label="Protein" value={formatNumber(totals.protein)} unit="g" color={T.prot} colorBg={T.protBg} />
                  <StatChip emoji="💧" label="Water" value={water} unit="ml" color={T.water} colorBg={T.waterBg} />
                </View>
              </View>
            </LinearGradient>

            {/* ── PROGRESS ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Progress</Text>
              <NutrientBar label="Calories" emoji="🔥" current={totals.calories} goal={goals.calorieGoal} color={T.cal} colorBg={T.calBg} />
              <NutrientBar label="Protein" emoji="💪" current={totals.protein} goal={goals.proteinGoal} color={T.prot} colorBg={T.protBg} />
              <NutrientBar label="Carbs" emoji="🍞" current={totals.carbs} goal={goals.carbsGoal} color={T.carbs} colorBg={T.carbsBg} />
              <NutrientBar label="Fats" emoji="🥑" current={totals.fats} goal={goals.fatsGoal} color={T.fat} colorBg={T.fatBg} />
              <NutrientBar label="Water" emoji="💧" current={water} goal={goals.waterGoal} color={T.water} colorBg={T.waterBg} />
            </View>

            {/* ── QUICK ACTIONS ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                {[
                  { emoji: "✍️", label: "Custom Food",  color: T.fat,   onPress: () => setCustomModal(true) },
                  { emoji: "🍲", label: "Load Recipe",  color: T.water,  onPress: () => setLoadRecipeModal(true) },
                  { emoji: "💧", label: "+250ml",       color: T.prot,   onPress: () => setWater((p) => p + 250) },
                  { emoji: "💧", label: "+500ml",       color: T.accent, onPress: () => setWater((p) => p + 500) },
                  { emoji: "💊", label: "Multivitamin", color: T.carbs,  onPress: () => setSupplements((p) => [...p, { id: `${Date.now()}`, name: "Multivitamin", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), timestamp: new Date().toISOString() }]) },
                  { emoji: "🥤", label: "Protein",      color: T.cal,    onPress: () => setSupplements((p) => [...p, { id: `${Date.now()}`, name: "Protein Shake", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), timestamp: new Date().toISOString() }]) },
                ].map((a) => (
                  <TouchableOpacity key={a.label} style={[styles.actionBtn, { backgroundColor: a.color + "18", borderColor: a.color + "30" }]} onPress={a.onPress} activeOpacity={0.75}>
                    <Text style={styles.actionEmoji}>{a.emoji}</Text>
                    <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── SEARCH ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Search Foods</Text>
              <View style={styles.searchWrap}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search foods (e.g., chicken breast)..."
                  placeholderTextColor={T.textMute}
                  value={query}
                  onChangeText={handleSearch}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setSearchError(null); }}>
                    <Text style={styles.searchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {searching && (
                <View style={styles.searchState}>
                  <ActivityIndicator color={T.accent} />
                  <Text style={styles.searchStateText}>Searching...</Text>
                </View>
              )}
              {searchError && (
                <View style={[styles.searchState, { backgroundColor: "#FEE2E2" }]}>
                  <Text>⚠️</Text>
                  <Text style={[styles.searchStateText, { color: T.danger }]}>{searchError}</Text>
                </View>
              )}
              {results.length > 0 && (
                <View style={styles.resultsList}>
                  <Text style={styles.resultsCount}>{results.length} results found</Text>
                  <FlatList
                    data={results}
                    keyExtractor={(item) => item.fdcId.toString()}
                    renderItem={({ item }) => <FoodResultItem item={item} onPress={() => handleSelectFood(item)} />}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: T.border }} />}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </View>

            {/* ── TODAY'S LOG ── */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Today's Log ({foods.length})</Text>
                {foods.length > 0 && (
                  <TouchableOpacity onPress={() => Alert.alert("Clear Log?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => { setFoods([]); setWater(0); setSupplements([]); } }])}>
                    <Text style={styles.clearBtn}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {foods.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🍽️</Text>
                  <Text style={styles.emptyTitle}>Nothing logged yet</Text>
                  <Text style={styles.emptySub}>Search for foods above to get started</Text>
                </View>
              ) : (
                <FlatList
                  data={foods}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => <LoggedItem item={item} onRemove={() => setFoods((p) => p.filter((x) => x.id !== item.id))} />}
                  scrollEnabled={false}
                />
              )}

              {foods.length > 0 && (
                <TouchableOpacity style={styles.saveRecipeBtn} onPress={() => setRecipeModal(true)} activeOpacity={0.8}>
                  <LinearGradient colors={[T.water, "#0D9F6F"]} style={styles.saveRecipeBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.saveRecipeBtnText}>💾 Save as Recipe</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* ── SUPPLEMENTS ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Supplements</Text>
              <View style={styles.suppGrid}>
                {[
                  { name: "Multivitamin", emoji: "💊" },
                  { name: "Vitamin D",    emoji: "☀️" },
                  { name: "Omega-3",      emoji: "🐟" },
                  { name: "Protein",      emoji: "🥤" },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.name}
                    style={styles.suppBtn}
                    onPress={() => setSupplements((p) => [...p, { id: `${Date.now()}-${Math.random()}`, name: s.name, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), timestamp: new Date().toISOString() }])}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suppBtnEmoji}>{s.emoji}</Text>
                    <Text style={styles.suppBtnName}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {supplements.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  {supplements.map((s) => (
                    <View key={s.id} style={styles.suppItem}>
                      <Text style={styles.suppItemEmoji}>💊</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suppItemName}>{s.name}</Text>
                        <Text style={styles.suppItemTime}>{s.time}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSupplements((p) => p.filter((x) => x.id !== s.id))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <View style={styles.suppRemoveBtn}><Text style={styles.suppRemoveText}>✕</Text></View>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={{ height: 48 }} />
          </Animated.View>
        </ScrollView>

        {/* ── FOOD DETAIL SHEET ── */}
        <Sheet visible={detailModal} onClose={() => setDetailModal(false)} title="Add Food">
          {loadingDetails ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator size="large" color={T.accent} />
              <Text style={styles.sheetLoadingText}>Loading details...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetFoodName} numberOfLines={3}>{foodDetails?.description}</Text>

              <Text style={styles.sheetInputLabel}>Quantity (grams)</Text>
              <TextInput style={styles.sheetInput} keyboardType="numeric" placeholder="100" value={quantity} onChangeText={recalc} placeholderTextColor={T.textMute} />

              <View style={styles.macroGrid}>
                {[
                  { emoji: "🔥", label: "Calories", value: calc.calories, color: T.cal, bg: T.calBg },
                  { emoji: "💪", label: "Protein",  value: `${calc.protein}g`, color: T.prot, bg: T.protBg },
                  { emoji: "🍞", label: "Carbs",    value: `${calc.carbs}g`, color: T.carbs, bg: T.carbsBg },
                  { emoji: "🥑", label: "Fats",     value: `${calc.fats}g`, color: T.fat, bg: T.fatBg },
                ].map((m) => (
                  <View key={m.label} style={[styles.macroCard, { backgroundColor: m.bg }]}>
                    <Text style={styles.macroCardEmoji}>{m.emoji}</Text>
                    <Text style={[styles.macroCardValue, { color: m.color }]}>{m.value}</Text>
                    <Text style={styles.macroCardLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleAddFood} activeOpacity={0.85}>
                <LinearGradient colors={[T.accent, "#764BA2"]} style={styles.sheetPrimaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.sheetPrimaryBtnText}>Add to Log</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Sheet>

        {/* ── CUSTOM FOOD SHEET ── */}
        <Sheet visible={customModal} onClose={() => setCustomModal(false)} title="Custom Food">
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: "Food Name *", key: "name", kb: "default", placeholder: "e.g., Homemade Pasta" },
              { label: "Calories (kcal) *", key: "calories", kb: "numeric", placeholder: "500" },
              { label: "Protein (g)", key: "protein", kb: "numeric", placeholder: "25" },
              { label: "Carbs (g)", key: "carbs", kb: "numeric", placeholder: "60" },
              { label: "Fats (g)", key: "fats", kb: "numeric", placeholder: "15" },
            ].map((f) => (
              <View key={f.key} style={{ marginBottom: 16 }}>
                <Text style={styles.sheetInputLabel}>{f.label}</Text>
                <TextInput style={styles.sheetInput} keyboardType={f.kb} placeholder={f.placeholder} placeholderTextColor={T.textMute} value={customFood[f.key]} onChangeText={(t) => setCustomFood({ ...customFood, [f.key]: t })} />
              </View>
            ))}
            <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleAddCustom} activeOpacity={0.85}>
              <LinearGradient colors={[T.accent, "#764BA2"]} style={styles.sheetPrimaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.sheetPrimaryBtnText}>Save Food</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Sheet>

        {/* ── SAVE RECIPE SHEET ── */}
        <Sheet visible={recipeModal} onClose={() => setRecipeModal(false)} title="Save Recipe">
          <Text style={styles.sheetInputLabel}>Recipe Name</Text>
          <TextInput style={styles.sheetInput} placeholder="e.g., Post-Workout Meal" placeholderTextColor={T.textMute} value={recipeName} onChangeText={setRecipeName} />
          <TouchableOpacity style={[styles.sheetPrimaryBtn, { marginTop: 16 }]} onPress={handleSaveRecipe} activeOpacity={0.85}>
            <LinearGradient colors={[T.accent, "#764BA2"]} style={styles.sheetPrimaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.sheetPrimaryBtnText}>Save Recipe</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Sheet>

        {/* ── LOAD RECIPE SHEET ── */}
        <Sheet visible={loadRecipeModal} onClose={() => setLoadRecipeModal(false)} title="My Recipes">
          {recipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🍲</Text>
              <Text style={styles.emptyTitle}>No recipes yet</Text>
              <Text style={styles.emptySub}>Save your first recipe from the food log</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              {recipes.map((r) => (
                <TouchableOpacity key={r.id} style={styles.recipeItem} onPress={() => handleLoadRecipe(r)} activeOpacity={0.7}>
                  <Text style={styles.recipeItemEmoji}>🍲</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeItemName}>{r.name}</Text>
                    <Text style={styles.recipeItemInfo}>{r.foods.length} items · {formatNumber(r.foods.reduce((s, f) => s + parseFloat(f.calories || 0), 0))} kcal</Text>
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert("Delete?", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => setRecipes((p) => p.filter((x) => x.id !== r.id)) }])} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Sheet>

        {/* ── GOALS SHEET ── */}
        <Sheet visible={goalsModal} onClose={() => setGoalsModal(false)} title="Daily Goals">
          <ScrollView showsVerticalScrollIndicator={false}>
            {[
              { label: "🔥 Calories (kcal)", key: "calorieGoal" },
              { label: "💪 Protein (g)",     key: "proteinGoal" },
              { label: "🍞 Carbs (g)",       key: "carbsGoal" },
              { label: "🥑 Fats (g)",        key: "fatsGoal" },
              { label: "💧 Water (ml)",      key: "waterGoal" },
            ].map((g) => (
              <View key={g.key} style={{ marginBottom: 16 }}>
                <Text style={styles.sheetInputLabel}>{g.label}</Text>
                <TextInput style={styles.sheetInput} keyboardType="numeric" value={editGoals[g.key]?.toString()} placeholderTextColor={T.textMute} onChangeText={(t) => setEditGoals({ ...editGoals, [g.key]: parseInt(t) || 0 })} />
              </View>
            ))}
            <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleSaveGoals} activeOpacity={0.85}>
              <LinearGradient colors={[T.accent, "#764BA2"]} style={styles.sheetPrimaryBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.sheetPrimaryBtnText}>Save Goals</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Sheet>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  // header
  header: {
    paddingTop: Platform.OS === "ios" ? 58 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...Platform.select({ ios: { shadowColor: "#667EEA", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 16 }, android: { elevation: 10 } }),
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  headerTitle: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  headerDate: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4, fontWeight: "600" },
  settingsBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },

  overallRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  overallLeft: { alignItems: "center" },
  overallPct: { fontSize: 38, fontWeight: "900", color: "#fff", lineHeight: 42 },
  overallLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600", marginTop: 2 },
  statsRow: { flex: 1, flexDirection: "row", gap: 8 },
  statChip: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: "center",
  },
  statChipEmoji: { fontSize: 18, marginBottom: 4 },
  statChipValue: { fontSize: 16, fontWeight: "900", color: "#fff" },
  statChipUnit: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  statChipLabel: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2, fontWeight: "600" },

  // card
  card: {
    backgroundColor: T.card,
    borderRadius: 22,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 }, android: { elevation: 3 } }),
  },
  cardTitle: { fontSize: 20, fontWeight: "800", color: T.textPrim, marginBottom: 18 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  clearBtn: { fontSize: 13, fontWeight: "700", color: T.danger, backgroundColor: "#FEE2E2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },

  // nutrient bar
  nutrientBar: { marginBottom: 18 },
  nutrientBarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nutrientBarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  nutrientDot: { width: 8, height: 8, borderRadius: 4 },
  nutrientBarLabel: { fontSize: 14, fontWeight: "700", color: T.textSec },
  nutrientBarRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  nutrientCurrent: { fontSize: 15, fontWeight: "800" },
  nutrientGoalText: { fontSize: 13, color: T.textMute, fontWeight: "600" },
  pctBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pctBadgeText: { fontSize: 12, fontWeight: "800" },
  nutrientRemaining: { fontSize: 11, color: T.textMute, fontWeight: "600", marginTop: 5 },

  // actions
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: {
    width: (width - 72) / 3, paddingVertical: 14,
    borderRadius: 16, alignItems: "center", borderWidth: 1.5,
  },
  actionEmoji: { fontSize: 22, marginBottom: 5 },
  actionLabel: { fontSize: 12, fontWeight: "700" },

  // search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.bg, borderRadius: 14,
    borderWidth: 1.5, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 2,
    gap: 8,
  },
  searchIcon: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 15, color: T.textPrim, paddingVertical: 14, fontWeight: "500" },
  searchClear: { fontSize: 16, color: T.textMute, paddingHorizontal: 4 },
  searchState: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: T.bg },
  searchStateText: { fontSize: 14, fontWeight: "600", color: T.textSec },
  resultsList: { marginTop: 14, borderRadius: 14, borderWidth: 1.5, borderColor: T.border, overflow: "hidden" },
  resultsCount: { padding: 12, fontSize: 12, fontWeight: "700", color: T.textMute, backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border },
  resultItem: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: T.card },
  resultLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  resultIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.accentSoft, alignItems: "center", justifyContent: "center" },
  resultIcon: { fontSize: 20 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: "700", color: T.textPrim, marginBottom: 3 },
  resultBrand: { fontSize: 12, color: T.textSec, fontWeight: "500" },
  resultChevron: { fontSize: 24, color: T.textMute, fontWeight: "300" },

  // log items
  logItem: { flexDirection: "row", backgroundColor: T.bg, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: T.border },
  logItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  logItemName: { fontSize: 15, fontWeight: "700", color: T.textPrim, flex: 1, marginRight: 10 },
  logItemCal: { fontSize: 15, fontWeight: "800" },
  macroRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 6 },
  macroChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  macroChipText: { fontSize: 12, fontWeight: "700" },
  logItemExpanded: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.border },
  logItemDetail: { fontSize: 13, color: T.textSec, fontWeight: "500", marginBottom: 2 },
  logItemTime: { fontSize: 11, color: T.textMute, fontWeight: "600", marginTop: 4 },
  removeBtn: { marginLeft: 10, alignSelf: "center", width: 30, height: 30, borderRadius: 15, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  removeBtnText: { color: T.danger, fontSize: 14, fontWeight: "800" },

  saveRecipeBtn: { borderRadius: 14, overflow: "hidden", marginTop: 14, ...Platform.select({ ios: { shadowColor: T.water, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  saveRecipeBtnGrad: { paddingVertical: 16, alignItems: "center" },
  saveRecipeBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // empty
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: T.textPrim, marginBottom: 6 },
  emptySub: { fontSize: 14, color: T.textMute, fontWeight: "500" },

  // supplements
  suppGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  suppBtn: { width: (width - 72) / 4, paddingVertical: 14, backgroundColor: T.bg, borderRadius: 14, alignItems: "center", borderWidth: 1.5, borderColor: T.border },
  suppBtnEmoji: { fontSize: 22, marginBottom: 4 },
  suppBtnName: { fontSize: 11, fontWeight: "700", color: T.textPrim },
  suppItem: { flexDirection: "row", alignItems: "center", backgroundColor: T.bg, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: T.border },
  suppItemEmoji: { fontSize: 22, marginRight: 10 },
  suppItemName: { fontSize: 14, fontWeight: "700", color: T.textPrim },
  suppItemTime: { fontSize: 12, color: T.textSec, fontWeight: "500" },
  suppRemoveBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  suppRemoveText: { color: T.danger, fontSize: 13, fontWeight: "800" },

  // sheet (modal)
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "92%", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20 }, android: { elevation: 20 } }) },
  sheetHandle: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  sheetTitle: { fontSize: 24, fontWeight: "900", color: T.textPrim },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" },
  sheetCloseText: { fontSize: 18, color: T.textMute, fontWeight: "600" },
  sheetLoading: { alignItems: "center", paddingVertical: 60 },
  sheetLoadingText: { marginTop: 16, fontSize: 15, color: T.textSec, fontWeight: "600" },
  sheetFoodName: { fontSize: 17, fontWeight: "700", color: T.textPrim, marginBottom: 20, lineHeight: 24 },
  sheetInputLabel: { fontSize: 13, fontWeight: "700", color: T.textSec, marginBottom: 8 },
  sheetInput: { borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: T.textPrim, fontWeight: "600" },
  sheetPrimaryBtn: { borderRadius: 14, overflow: "hidden", marginTop: 8, ...Platform.select({ ios: { shadowColor: T.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 6 } }) },
  sheetPrimaryBtnGrad: { paddingVertical: 18, alignItems: "center" },
  sheetPrimaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },

  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginVertical: 20 },
  macroCard: { width: (width - 88) / 2, padding: 16, borderRadius: 16, alignItems: "center" },
  macroCardEmoji: { fontSize: 28, marginBottom: 6 },
  macroCardValue: { fontSize: 22, fontWeight: "900", marginBottom: 4 },
  macroCardLabel: { fontSize: 12, fontWeight: "700", color: T.textSec },

  recipeItem: { flexDirection: "row", alignItems: "center", backgroundColor: T.bg, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1.5, borderColor: T.border },
  recipeItemEmoji: { fontSize: 28 },
  recipeItemName: { fontSize: 15, fontWeight: "700", color: T.textPrim, marginBottom: 3 },
  recipeItemInfo: { fontSize: 12, color: T.textSec, fontWeight: "600" },
});