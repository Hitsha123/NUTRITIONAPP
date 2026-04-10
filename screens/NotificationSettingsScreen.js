import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  StatusBar,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearAllNotifications,
  scheduleDailyNotification,
  scheduleIntervalNotification,
} from "../utils/notificationService";
import LinearGradient from "react-native-linear-gradient";

const { width } = Dimensions.get("window");
const STORAGE_KEY = "reminderSettings";
const MIN_INTERVAL = 15;
const MAX_INTERVAL = 1440;

const DEFAULT_SETTINGS = {
  mealReminders: true,
  waterInterval: 120,
  activityInterval: 180,
  motivationalTips: true,
  breakfastTime: { hour: 9, minute: 0 },
  lunchTime: { hour: 13, minute: 0 },
  dinnerTime: { hour: 20, minute: 0 },
};

/* ─────────────────────────────────────────
   SMART SUGGESTION ENGINE
   Reads profile + nutrition data from
   AsyncStorage and returns rule-based
   personalised recommendations
───────────────────────────────────────── */
const generateSmartSuggestions = async () => {
  try {
    const [profileRaw, goalsRaw, foodsRaw, streakRaw] = await Promise.all([
      AsyncStorage.getItem("userProfile"),
      AsyncStorage.getItem("nutritionGoals"),
      AsyncStorage.getItem("selectedFoods"),
      AsyncStorage.getItem("streak"),
    ]);

    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const goals   = goalsRaw   ? JSON.parse(goalsRaw)   : null;
    const foods   = foodsRaw   ? JSON.parse(foodsRaw)   : [];
    const streak  = streakRaw  ? parseInt(streakRaw, 10) : 0;

    const suggestions = [];

    /* ── 1. Water interval from weight (WHO 35ml/kg/day) ── */
    if (profile?.weight) {
      const w = Number(profile.weight);
      const recommended = w >= 90 ? 60 : w >= 70 ? 90 : w >= 50 ? 105 : 120;
      suggestions.push({
        emoji: "💧",
        title: "Hydration Interval",
        reason: `For your weight (${w} kg), drinking water every ${recommended} min keeps you optimally hydrated per WHO guidelines.`,
        field: "waterInterval",
        value: recommended,
        color: "#2196F3",
        bgColor: "#E3F2FD",
      });
    }

    /* ── 2. Activity interval from fitness goal ── */
    if (profile?.fitnessGoal) {
      const goal = profile.fitnessGoal.toLowerCase();
      let interval = 180;
      let reason = "";
      if (goal.includes("weight loss")) {
        interval = 60;
        reason = "Frequent movement every 60 min maximises calorie burn for weight loss.";
      } else if (goal.includes("muscle gain")) {
        interval = 120;
        reason = "Moving every 120 min balances muscle recovery with staying active.";
      } else {
        interval = 150;
        reason = "A movement reminder every 150 min keeps you active without overdoing it.";
      }
      suggestions.push({
        emoji: "🏃",
        title: "Activity Break Interval",
        reason,
        field: "activityInterval",
        value: interval,
        color: "#FF9800",
        bgColor: "#FFF3E0",
      });
    }

    /* ── 3. Calorie gap analysis ── */
    if (foods.length > 0 && goals?.calorieGoal) {
      const today = new Date().toISOString().split("T")[0];
      let todayCals = 0;
      foods.forEach((f) => {
        const dk =
          f.dateKey ||
          (f.timestamp ? new Date(f.timestamp).toISOString().split("T")[0] : null);
        if (dk === today) todayCals += Number(f.calories) || 0;
      });
      const pct = (todayCals / goals.calorieGoal) * 100;
      if (pct < 40) {
        suggestions.push({
          emoji: "🍽️",
          title: "You're Under-eating Today",
          reason: `Only ${Math.round(pct)}% of your calorie goal logged. Turn on meal reminders so you don't miss a meal.`,
          field: "mealReminders",
          value: true,
          color: "#EF4444",
          bgColor: "#FEE2E2",
        });
      } else if (pct > 110) {
        suggestions.push({
          emoji: "⚠️",
          title: "Calorie Goal Exceeded",
          reason: `You've hit ${Math.round(pct)}% of your calorie goal today. Consider spacing out your remaining meals.`,
          field: null,
          value: null,
          color: "#F97316",
          bgColor: "#FFF7ED",
        });
      }
    }

    /* ── 4. Keto meal timing ── */
    if (profile?.dietaryPreferences?.toLowerCase().includes("keto")) {
      suggestions.push({
        emoji: "🥩",
        title: "Keto Meal Timing",
        reason: "Keto works best with 3 structured meals. Make sure meal reminders are enabled.",
        field: "mealReminders",
        value: true,
        color: "#8B5CF6",
        bgColor: "#EDE9FE",
      });
    }

    /* ── 5. Vegan protein timing ── */
    if (profile?.dietaryPreferences?.toLowerCase().includes("vegan")) {
      suggestions.push({
        emoji: "🌱",
        title: "Vegan Protein Reminder",
        reason: "Frequent meal reminders help vegans hit protein targets throughout the day.",
        field: "mealReminders",
        value: true,
        color: "#16A34A",
        bgColor: "#DCFCE7",
      });
    }

    /* ── 6. Streak motivation ── */
    if (streak >= 7) {
      suggestions.push({
        emoji: "🔥",
        title: `${streak}-Day Streak!`,
        reason: "You're on a roll! Keep motivational tips ON to sustain your momentum.",
        field: "motivationalTips",
        value: true,
        color: "#10B981",
        bgColor: "#D1FAE5",
      });
    } else if (streak === 0) {
      suggestions.push({
        emoji: "💡",
        title: "Start Your Streak",
        reason: "Daily nudges are proven to build healthy habits from scratch. Turn on motivational tips!",
        field: "motivationalTips",
        value: true,
        color: "#FFC107",
        bgColor: "#FFF9C4",
      });
    }

    return suggestions;
  } catch (err) {
    console.error("Smart suggestion error:", err);
    return [];
  }
};

/* ─────────────────────────────────────────
   SUGGESTION CARD
───────────────────────────────────────── */
const SuggestionCard = ({ suggestion, onApply }) => (
  <View style={[sStyles.card, { borderLeftColor: suggestion.color, backgroundColor: suggestion.bgColor }]}>
    <View style={sStyles.row}>
      <Text style={sStyles.emoji}>{suggestion.emoji}</Text>
      <View style={sStyles.textWrap}>
        <Text style={sStyles.title}>{suggestion.title}</Text>
        <Text style={sStyles.reason}>{suggestion.reason}</Text>
      </View>
    </View>
    {suggestion.field && suggestion.value !== null && (
      <TouchableOpacity
        style={[sStyles.applyBtn, { backgroundColor: suggestion.color }]}
        onPress={() => onApply(suggestion)}
        activeOpacity={0.8}
      >
        <Text style={sStyles.applyBtnEmoji}>✅</Text>
        <Text style={sStyles.applyText}>
          {typeof suggestion.value === "number"
            ? `Apply (${suggestion.value} min)`
            : "Apply Suggestion"}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

const sStyles = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 16, marginBottom: 14,
    borderLeftWidth: 5, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  emoji: { fontSize: 30, marginRight: 12, marginTop: 2 },
  textWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: "#1a1a1a", marginBottom: 5 },
  reason: { fontSize: 13, color: "#444", lineHeight: 20 },
  applyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: 14, paddingVertical: 10, borderRadius: 12, gap: 8,
  },
  applyBtnEmoji: { fontSize: 16 },
  applyText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

/* ─────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────── */
export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [waterInterval, setWaterInterval] = useState("120");
  const [activityInterval, setActivityInterval] = useState("180");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (saveSuccess) {
      const t = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(t);
    }
  }, [saveSuccess]);

  const loadSettings = async () => {
    try {
      setError(null);
      setLoading(true);
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(merged);
        setWaterInterval(String(parsed.waterInterval || 120));
        setActivityInterval(String(parsed.activityInterval || 180));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Failed to load settings. Using defaults.");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validateInterval = (value, name) => {
    const num = Number(value);
    if (isNaN(num) || num < MIN_INTERVAL) {
      Alert.alert("⚠️ Invalid Value", `${name} must be at least ${MIN_INTERVAL} minutes`);
      return false;
    }
    if (num > MAX_INTERVAL) {
      Alert.alert("⚠️ Invalid Value", `${name} cannot exceed ${MAX_INTERVAL} minutes`);
      return false;
    }
    return true;
  };

  const saveSettings = async () => {
    if (!validateInterval(waterInterval, "Water interval")) return;
    if (!validateInterval(activityInterval, "Activity interval")) return;

    setSaving(true);
    setError(null);
    try {
      const updated = {
        ...settings,
        waterInterval: Number(waterInterval),
        activityInterval: Number(activityInterval),
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await clearAllNotifications();

      if (updated.mealReminders) {
        const { breakfastTime, lunchTime, dinnerTime } = updated;
        await scheduleDailyNotification(1, "🍳 Breakfast Time", "Don't forget to log your breakfast!", breakfastTime.hour, breakfastTime.minute, "MealLogScreen");
        await scheduleDailyNotification(2, "🥗 Lunch Time", "Time to log your lunch!", lunchTime.hour, lunchTime.minute, "MealLogScreen");
        await scheduleDailyNotification(3, "🍲 Dinner Time", "Remember to log your dinner!", dinnerTime.hour, dinnerTime.minute, "MealLogScreen");
      }
      if (updated.waterInterval >= MIN_INTERVAL)
        await scheduleIntervalNotification(4, "💧 Drink Water", "Time to hydrate! Your body will thank you 💙", updated.waterInterval, "HomeScreen");
      if (updated.activityInterval >= MIN_INTERVAL)
        await scheduleIntervalNotification(5, "🏃 Activity Break", "Time to move your body and stretch!", updated.activityInterval, "HomeScreen");
      if (updated.motivationalTips)
        await scheduleDailyNotification(6, "💡 Daily Nutrition Tip", "Protein helps muscle recovery and keeps you full longer 💪", 8, 0, "HomeScreen");

      setSaveSuccess(true);
      Alert.alert("✅ Saved!", "Your notification settings have been saved and scheduled!", [{ text: "🎉 Awesome!" }]);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save settings");
      Alert.alert("❌ Error", `Failed to save: ${err.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      "🔄 Reset Settings",
      "Reset all notification settings to defaults?",
      [
        { text: "❌ Cancel", style: "cancel" },
        {
          text: "🔄 Reset",
          style: "destructive",
          onPress: () => {
            setSettings(DEFAULT_SETTINGS);
            setWaterInterval(String(DEFAULT_SETTINGS.waterInterval));
            setActivityInterval(String(DEFAULT_SETTINGS.activityInterval));
            setError(null);
          },
        },
      ]
    );
  };

  const handleOpenSuggestions = async () => {
    setPanelOpen(true);
    if (suggestions.length === 0) {
      setSuggestLoading(true);
      const results = await generateSmartSuggestions();
      setSuggestions(results);
      setSuggestLoading(false);
    }
  };

  const handleApply = (suggestion) => {
    if (!suggestion.field) return;
    if (typeof suggestion.value === "number") {
      if (suggestion.field === "waterInterval") setWaterInterval(String(suggestion.value));
      if (suggestion.field === "activityInterval") setActivityInterval(String(suggestion.value));
      updateSetting(suggestion.field, suggestion.value);
    } else if (typeof suggestion.value === "boolean") {
      updateSetting(suggestion.field, suggestion.value);
    }
    setSuggestions((prev) =>
      prev.map((s) => (s.title === suggestion.title ? { ...s, applied: true } : s))
    );
    Alert.alert("✅ Applied!", `"${suggestion.title}" applied. Don't forget to save!`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>⏳ Loading settings...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" />

      {/* ══ HEADER ══ */}
      <LinearGradient colors={["#4CAF50", "#45a049", "#388E3C"]} style={styles.headerGradient}>
        <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.headerIcon}>🔔</Text>
          <Text style={styles.headerTitle}>Notification Center</Text>
          <Text style={styles.headerSubtitle}>Customize your health reminders</Text>

          {/* ✨ Smart Suggestions button */}
          <TouchableOpacity style={styles.smartBtn} onPress={handleOpenSuggestions} activeOpacity={0.85}>
            <Text style={styles.smartBtnEmoji}>✨</Text>
            <Text style={styles.smartBtnText}>Smart Suggestions</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Success Banner ── */}
        {saveSuccess && (
          <Animated.View style={[styles.successBanner, { opacity: fadeAnim }]}>
            <Text style={styles.bannerEmoji}>✅</Text>
            <Text style={styles.successText}>Settings saved successfully!</Text>
          </Animated.View>
        )}

        {/* ── Error Banner ── */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.bannerEmoji}>❌</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadSettings} style={styles.retryButton}>
              <Text style={styles.retryText}>🔁 Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ MEAL REMINDERS ══ */}
        <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🍽️</Text>
            <Text style={styles.sectionTitle}>Meal Reminders</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: "#E8F5E9" }]}>
                <Text style={styles.circleEmoji}>⏰</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>🍳 Daily Meal Alerts</Text>
                <Text style={styles.cardDescription}>
                  Get timely reminders for breakfast, lunch & dinner
                </Text>
              </View>
              <Switch
                value={settings.mealReminders}
                onValueChange={(v) => updateSetting("mealReminders", v)}
                trackColor={{ false: "#E0E0E0", true: "#81C784" }}
                thumbColor={settings.mealReminders ? "#4CAF50" : "#BDBDBD"}
                ios_backgroundColor="#E0E0E0"
              />
            </View>
          </View>
        </Animated.View>

        {/* ══ HYDRATION ══ */}
        <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💧</Text>
            <Text style={styles.sectionTitle}>Hydration Tracker</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: "#E3F2FD" }]}>
                <Text style={styles.circleEmoji}>⏱️</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>💧 Water Break Interval</Text>
                <Text style={styles.cardDescription}>
                  Remind me every <Text style={styles.highlightText}>{waterInterval}</Text> minutes
                </Text>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={waterInterval}
                  onChangeText={setWaterInterval}
                  placeholder="120"
                  maxLength={4}
                  placeholderTextColor="#999"
                />
                <Text style={styles.inputLabel}>min</Text>
              </View>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${Math.min((Number(waterInterval) / MAX_INTERVAL) * 100, 100)}%`, backgroundColor: "#2196F3" }]} />
            </View>
          </View>
        </Animated.View>

        {/* ══ ACTIVITY ══ */}
        <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🏃</Text>
            <Text style={styles.sectionTitle}>Activity Breaks</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
                <Text style={styles.circleEmoji}>🚶</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>🏋️ Movement Reminders</Text>
                <Text style={styles.cardDescription}>
                  Get active every <Text style={styles.highlightText}>{activityInterval}</Text> minutes
                </Text>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={activityInterval}
                  onChangeText={setActivityInterval}
                  placeholder="180"
                  maxLength={4}
                  placeholderTextColor="#999"
                />
                <Text style={styles.inputLabel}>min</Text>
              </View>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${Math.min((Number(activityInterval) / MAX_INTERVAL) * 100, 100)}%`, backgroundColor: "#FF9800" }]} />
            </View>
          </View>
        </Animated.View>

        {/* ══ MOTIVATIONAL TIPS ══ */}
        <Animated.View style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💡</Text>
            <Text style={styles.sectionTitle}>Daily Motivation</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: "#FFF9C4" }]}>
                <Text style={styles.circleEmoji}>✨</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>💡 Nutrition Tips</Text>
                <Text style={styles.cardDescription}>
                  Daily tips to boost your health journey
                </Text>
              </View>
              <Switch
                value={settings.motivationalTips}
                onValueChange={(v) => updateSetting("motivationalTips", v)}
                trackColor={{ false: "#E0E0E0", true: "#FFD54F" }}
                thumbColor={settings.motivationalTips ? "#FFC107" : "#BDBDBD"}
                ios_backgroundColor="#E0E0E0"
              />
            </View>
          </View>
        </Animated.View>

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoEmoji}>ℹ️</Text>
          <Text style={styles.infoText}>
            Interval range: {MIN_INTERVAL} – {MAX_INTERVAL} minutes
          </Text>
        </View>

        {/* ══ SAVE BUTTON ══ */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={saveSettings}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient colors={["#4CAF50", "#388E3C"]} style={styles.buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {saving
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.buttonText}>  ⏳ Saving...</Text></>
              : <Text style={styles.buttonText}>💾 Save Settings</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* ══ RESET BUTTON ══ */}
        <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults} disabled={saving} activeOpacity={0.8}>
          <Text style={styles.resetButtonText}>🔄 Reset to Defaults</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════════════════════════════════
          SMART SUGGESTIONS BOTTOM SHEET MODAL
      ══════════════════════════════════════ */}
      <Modal visible={panelOpen} animationType="slide" transparent onRequestClose={() => setPanelOpen(false)}>
        <View style={mStyles.overlay}>
          <View style={mStyles.panel}>
            <View style={mStyles.handle} />

            {/* Modal Header */}
            <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={mStyles.panelHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={mStyles.panelHeaderRow}>
                <View>
                  <Text style={mStyles.panelTitle}>✨ Smart Suggestions</Text>
                  <Text style={mStyles.panelSubtitle}>Personalised from your profile & goals</Text>
                </View>
                <TouchableOpacity onPress={() => setPanelOpen(false)} style={mStyles.closeBtn}>
                  <Text style={mStyles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Modal Body */}
            <ScrollView style={mStyles.scrollArea} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {suggestLoading ? (
                <View style={mStyles.loadingWrap}>
                  <ActivityIndicator size="large" color="#0EA5E9" />
                  <Text style={mStyles.loadingText}>✨ Analysing your profile...</Text>
                </View>
              ) : suggestions.length === 0 ? (
                <View style={mStyles.emptyWrap}>
                  <Text style={mStyles.emptyEmoji}>🧘</Text>
                  <Text style={mStyles.emptyTitle}>All Good!</Text>
                  <Text style={mStyles.emptyText}>
                    Complete your profile (weight, fitness goal, dietary preferences) to unlock personalised smart suggestions.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={mStyles.count}>
                    🎯 {suggestions.length} recommendation{suggestions.length !== 1 ? "s" : ""} for you
                  </Text>
                  {suggestions.map((s, i) => (
                    <SuggestionCard key={i} suggestion={s} onApply={handleApply} />
                  ))}
                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ─────────────────────────────────────────
   MODAL STYLES
───────────────────────────────────────── */
const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  panel: { backgroundColor: "#F8F9FA", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", overflow: "hidden" },
  handle: { width: 48, height: 5, backgroundColor: "#ccc", borderRadius: 3, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  panelHeader: { padding: 20, paddingTop: 12 },
  panelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  panelSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  closeBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  closeBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  scrollArea: { flex: 1 },
  loadingWrap: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 16, fontSize: 15, color: "#6B7280", fontWeight: "500" },
  emptyWrap: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22 },
  count: { fontSize: 13, color: "#6B7280", fontWeight: "600", marginBottom: 16 },
});

/* ─────────────────────────────────────────
   MAIN STYLES
───────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16, color: "#666", fontWeight: "500" },

  headerGradient: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  headerContent: { alignItems: "center" },
  headerIcon: { fontSize: 46 },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#fff", marginTop: 10, letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 15, color: "rgba(255,255,255,0.9)", marginTop: 6 },

  smartBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 26, marginTop: 18, gap: 8,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)",
  },
  smartBtnEmoji: { fontSize: 18 },
  smartBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  successBanner: {
    backgroundColor: "#E8F5E9", padding: 16, borderRadius: 16,
    marginBottom: 20, flexDirection: "row", alignItems: "center",
    borderLeftWidth: 4, borderLeftColor: "#4CAF50", elevation: 2,
  },
  errorBanner: {
    backgroundColor: "#FFEBEE", padding: 16, borderRadius: 16,
    marginBottom: 20, flexDirection: "row", alignItems: "center",
    borderLeftWidth: 4, borderLeftColor: "#f44336",
  },
  bannerEmoji: { fontSize: 22, marginRight: 10 },
  successText: { color: "#2E7D32", fontSize: 15, fontWeight: "600", flex: 1 },
  errorText: { color: "#C62828", fontSize: 14, fontWeight: "500", flex: 1 },
  retryButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff", borderRadius: 8 },
  retryText: { color: "#2196F3", fontWeight: "700", fontSize: 14 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionEmoji: { fontSize: 24, marginRight: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a" },

  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 20,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  cardContent: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  circleEmoji: { fontSize: 26 },
  textContainer: { flex: 1, marginLeft: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  cardDescription: { fontSize: 13, color: "#757575", lineHeight: 20 },
  highlightText: { fontWeight: "700", color: "#4CAF50" },

  inputContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F5F5F5", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  input: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", textAlign: "center", minWidth: 50 },
  inputLabel: { fontSize: 13, color: "#757575", fontWeight: "600", marginLeft: 4 },

  progressBarContainer: { height: 6, backgroundColor: "#E0E0E0", borderRadius: 3, marginTop: 16, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 3 },

  infoCard: {
    backgroundColor: "#E3F2FD", padding: 16, borderRadius: 16,
    flexDirection: "row", alignItems: "center",
    marginBottom: 24, borderLeftWidth: 4, borderLeftColor: "#2196F3",
  },
  infoEmoji: { fontSize: 22, marginRight: 10 },
  infoText: { fontSize: 14, color: "#1565C0", fontWeight: "500" },

  saveButton: {
    marginBottom: 14, borderRadius: 18, overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#4CAF50", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  buttonGradient: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", padding: 18,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },

  resetButton: {
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    padding: 18, borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: "#E0E0E0",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  resetButtonText: { color: "#555", fontSize: 16, fontWeight: "700" },
});