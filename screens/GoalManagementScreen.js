import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as Progress from "react-native-progress";

const { width } = Dimensions.get("window");

// ─── LIGHT THEME ──────────────────────────────────────────────────────────────
const T = {
  bg:        "#F4F6FB",
  surface:   "#FFFFFF",
  card:      "#FFFFFF",
  border:    "#E8ECF4",
  textPrim:  "#1A2340",
  textSec:   "#6B7A99",
  textMute:  "#A0AABD",
  accent:    "#667EEA",
  accentSoft:"#667EEA18",

  cal:   "#FF6B6B",
  prot:  "#4FACFE",
  carbs: "#F5A623",
  fat:   "#A78BFA",
  water: "#10B981",

  calBg:   "#FF6B6B12",
  protBg:  "#4FACFE12",
  carbsBg: "#F5A62312",
  fatBg:   "#A78BFA12",
  waterBg: "#10B98112",
};

// ─── NUTRIENT CONFIG ──────────────────────────────────────────────────────────
const NUTRIENTS = [
  { key:"calorieGoal", dataKey:"totalCalories", label:"Calories",  emoji:"🔥", unit:"kcal", icon:"fire",          color:T.cal,   bg:T.calBg,   tip:"Your daily energy budget" },
  { key:"proteinGoal", dataKey:"totalProtein",  label:"Protein",   emoji:"💪", unit:"g",    icon:"food-drumstick", color:T.prot,  bg:T.protBg,  tip:"Builds & repairs muscle" },
  { key:"carbsGoal",   dataKey:"totalCarbs",    label:"Carbs",     emoji:"🍞", unit:"g",    icon:"bread-slice",    color:T.carbs, bg:T.carbsBg, tip:"Your primary fuel source" },
  { key:"fatsGoal",    dataKey:"totalFats",     label:"Fats",      emoji:"🥑", unit:"g",    icon:"oil",            color:T.fat,   bg:T.fatBg,   tip:"Essential for hormones" },
  { key:"waterGoal",   dataKey:"totalWater",    label:"Water",     emoji:"💧", unit:"ml",   icon:"cup-water",      color:T.water, bg:T.waterBg, tip:"Stay hydrated all day" },
];

// ─── RING PROGRESS ────────────────────────────────────────────────────────────
const RingProgress = ({ value, goal, color, size = 56 }) => {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <Progress.Circle
      size={size}
      progress={pct}
      color={color}
      unfilledColor={T.border}
      borderWidth={0}
      thickness={5}
      showsText={false}
    />
  );
};

// ─── PROGRESS CARD ────────────────────────────────────────────────────────────
const ProgressCard = ({ nutrient, value, goal, index }) => {
  const scaleAnim = useState(new Animated.Value(0.88))[0];
  const opacAnim  = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1, delay: index * 70,
        tension: 55, friction: 8, useNativeDriver: true,
      }),
      Animated.timing(opacAnim, {
        toValue: 1, delay: index * 70,
        duration: 350, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const pct = goal > 0 ? Math.min(Math.round((value / goal) * 100), 100) : 0;
  const remaining = Math.max(goal - value, 0);
  const done = value >= goal && goal > 0;

  const statusColor = pct >= 100 ? T.water : pct >= 70 ? nutrient.color : pct >= 35 ? T.carbs : T.cal;
  const statusEmoji = pct >= 100 ? "🏆" : pct >= 70 ? "🎯" : pct >= 35 ? "📈" : "💡";

  return (
    <Animated.View style={{ opacity: opacAnim, transform: [{ scale: scaleAnim }] }}>
      <View style={styles.progCard}>
        {/* Left ring */}
        <View style={styles.progRingWrap}>
          <RingProgress value={value} goal={goal} color={nutrient.color} size={60} />
          <Text style={[styles.progRingPct, { color: T.textPrim }]}>{pct}%</Text>
        </View>

        {/* Middle info */}
        <View style={styles.progMid}>
          <View style={styles.progTitleRow}>
            <Text style={styles.progEmoji}>{nutrient.emoji}</Text>
            <Text style={styles.progLabel}>{nutrient.label}</Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
          <Progress.Bar
            progress={pct / 100}
            width={null}
            height={6}
            color={nutrient.color}
            unfilledColor={T.border}
            borderWidth={0}
            borderRadius={6}
            style={{ marginTop: 8, marginBottom: 6 }}
          />
          <Text style={styles.progNumbers}>
            <Text style={[styles.progCurrent, { color: nutrient.color }]}>{Math.round(value)}</Text>
            <Text style={styles.progGoalText}> / {goal} {nutrient.unit}</Text>
          </Text>
        </View>

        {/* Right status */}
        <View style={styles.progRight}>
          <Text style={styles.statusEmojiText}>{statusEmoji}</Text>
          {done ? (
            <Text style={[styles.progRemain, { color: T.water }]}>Done! 🎉</Text>
          ) : (
            <Text style={styles.progRemain}>{Math.round(remaining)}{"\n"}{nutrient.unit} left</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

// ─── GOAL INPUT ───────────────────────────────────────────────────────────────
const GoalInput = ({ nutrient, value, onChange, index }) => {
  const [focused, setFocused] = useState(false);
  const slideAnim = useState(new Animated.Value(24))[0];
  const opacAnim  = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0, delay: index * 60,
        tension: 60, friction: 9, useNativeDriver: true,
      }),
      Animated.timing(opacAnim, {
        toValue: 1, delay: index * 60,
        duration: 320, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: opacAnim, transform: [{ translateY: slideAnim }], marginBottom: 16 }}>
      <View style={[
        styles.inputCard,
        focused && { borderColor: nutrient.color + "50", backgroundColor: nutrient.bg },
      ]}>
        {/* Icon column */}
        <View style={[styles.inputIconWrap, { backgroundColor: nutrient.bg }]}>
          <Text style={styles.inputEmoji}>{nutrient.emoji}</Text>
        </View>

        {/* Label + input */}
        <View style={styles.inputBody}>
          <Text style={styles.inputLabel}>{nutrient.label}</Text>
          <Text style={styles.inputTip}>{nutrient.tip}</Text>
          <TextInput
            style={[styles.inputField, focused && { color: nutrient.color }]}
            keyboardType="numeric"
            value={String(value)}
            placeholder="0"
            placeholderTextColor={T.textMute}
            onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>

        {/* Unit badge */}
        <View style={[styles.unitPill, { backgroundColor: nutrient.bg }]}>
          <Text style={[styles.unitText, { color: nutrient.color }]}>{nutrient.unit}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ─── OVERVIEW RING STRIP ──────────────────────────────────────────────────────
const OverviewStrip = ({ goals, dailyData, stats }) => {
  return (
    <LinearGradient
      colors={["#667EEA", "#764BA2"]}
      style={styles.overviewStrip}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Big score */}
      <View style={styles.overviewLeft}>
        <Text style={styles.overviewScore}>{stats.overallProgress}%</Text>
        <Text style={styles.overviewScoreLabel}>Overall Today</Text>
        <View style={styles.overviewBadgeRow}>
          <View style={styles.overviewBadge}>
            <Text style={styles.overviewBadgeText}>🎯 {stats.achievedGoals}/{stats.totalGoals} goals</Text>
          </View>
        </View>
      </View>

      {/* Mini rings */}
      <View style={styles.overviewRings}>
        {NUTRIENTS.map((n) => {
          const goal = parseInt(goals[n.key]) || 0;
          const val  = dailyData[n.dataKey] || 0;
          if (!goal) return null;
          return (
            <View key={n.key} style={styles.miniRingItem}>
              <Progress.Circle
                size={38}
                progress={goal > 0 ? Math.min(val / goal, 1) : 0}
                color="#fff"
                unfilledColor="rgba(255,255,255,0.25)"
                borderWidth={0}
                thickness={4}
                showsText={false}
              />
              <Text style={styles.miniRingEmoji}>{n.emoji}</Text>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
const GoalManagementScreen = ({ navigation }) => {
  const [goals, setGoals] = useState({
    calorieGoal: "", proteinGoal: "", carbsGoal: "", fatsGoal: "", waterGoal: "",
  });
  const [dailyData, setDailyData] = useState({
    totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0, totalWater: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [tab, setTab]         = useState("goals");
  const headerAnim            = useState(new Animated.Value(0))[0];

  // ── load ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [savedGoals, savedFoods, waterIntake] = await Promise.all([
        AsyncStorage.getItem("nutritionGoals"),
        AsyncStorage.getItem("selectedFoods"),
        AsyncStorage.getItem("waterIntake"),
      ]);

      if (savedGoals) setGoals(JSON.parse(savedGoals));

      const meals = savedFoods ? JSON.parse(savedFoods) : [];
      const today = new Date().toISOString().split("T")[0];
      let totals = { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0 };

      meals.forEach((m) => {
        if (m.timestamp?.split("T")[0] === today) {
          totals.totalCalories += parseFloat(m.calories) || 0;
          totals.totalProtein  += parseFloat(m.protein)  || 0;
          totals.totalCarbs    += parseFloat(m.carbs)    || 0;
          totals.totalFats     += parseFloat(m.fats)     || 0;
        }
      });

      setDailyData({ ...totals, totalWater: parseInt(waterIntake) || 0 });

      Animated.spring(headerAnim, {
        toValue: 1, tension: 45, friction: 8, useNativeDriver: true,
      }).start();
    } catch (e) {
      Alert.alert("❌ Oops", "Couldn't load your data. Try again!");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = navigation?.addListener?.("focus", loadData);
    return unsub;
  }, [navigation, loadData]);

  // ── save ──
  const handleSave = async () => {
    const hasAny = Object.values(goals).some((v) => v && parseInt(v) > 0);
    if (!hasAny) {
      Alert.alert("⚠️ Hold On", "Set at least one goal first!");
      return;
    }
    setSaving(true);
    try {
      const newGoals = {
        calorieGoal: parseInt(goals.calorieGoal) || 0,
        proteinGoal: parseInt(goals.proteinGoal) || 0,
        carbsGoal:   parseInt(goals.carbsGoal)   || 0,
        fatsGoal:    parseInt(goals.fatsGoal)     || 0,
        waterGoal:   parseInt(goals.waterGoal)    || 0,
      };
      await AsyncStorage.setItem("nutritionGoals", JSON.stringify(newGoals));
      setGoals(newGoals);
      Alert.alert("🎉 Saved!", "Goals locked in. Let's crush it! 💪", [{ text: "Let's go! 🚀" }]);
    } catch {
      Alert.alert("❌ Error", "Save failed. Try again 🔄");
    } finally {
      setSaving(false);
    }
  };

  // ── stats ──
  const calcStats = () => {
    let total = 0, achieved = 0, progressSum = 0;
    NUTRIENTS.forEach((n) => {
      const g = parseInt(goals[n.key]) || 0;
      if (g > 0) {
        total++;
        const pct = Math.min((dailyData[n.dataKey] / g) * 100, 100);
        progressSum += pct;
        if (dailyData[n.dataKey] >= g) achieved++;
      }
    });
    return { totalGoals: total, achievedGoals: achieved, overallProgress: total > 0 ? Math.round(progressSum / total) : 0 };
  };

  // ── loading ──
  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
        <Text style={{ fontSize: 48 }}>🥗</Text>
        <ActivityIndicator size="large" color={T.accent} style={{ marginTop: 20 }} />
        <Text style={styles.loaderText}>Loading your goals...</Text>
      </View>
    );
  }

  const stats = calcStats();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#667EEA" />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={["#667EEA", "#764BA2"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View style={[styles.headerInner, {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack?.()}>
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerMid}>
            <Text style={styles.headerEmoji}>🎯</Text>
            <View>
              <Text style={styles.headerTitle}>Goal Management</Text>
              <Text style={styles.headerSub}>
                {stats.totalGoals > 0
                  ? `${stats.achievedGoals} of ${stats.totalGoals} goals hit today ✨`
                  : "Set your nutrition targets 🚀"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.backBtn} onPress={loadData}>
            <Icon name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── TAB BAR ── */}
        <View style={styles.tabBar}>
          {[
            { id: "goals",    label: "Set Goals",   emoji: "✏️" },
            { id: "progress", label: "My Progress", emoji: "📊" },
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
              onPress={() => setTab(t.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabEmoji}>{t.emoji}</Text>
              <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {tab === t.id && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── BODY ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── OVERVIEW STRIP ── */}
          {stats.totalGoals > 0 && (
            <OverviewStrip goals={goals} dailyData={dailyData} stats={stats} />
          )}

          {/* ════════ GOALS TAB ════════ */}
          {tab === "goals" && (
            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionHeadEmoji}>🎯</Text>
                <View>
                  <Text style={styles.sectionTitle}>Daily Targets</Text>
                  <Text style={styles.sectionSub}>Tap a field to set your goal ✍️</Text>
                </View>
              </View>

              {NUTRIENTS.map((n, i) => (
                <GoalInput
                  key={n.key}
                  nutrient={n}
                  value={goals[n.key]}
                  index={i}
                  onChange={(t) => setGoals({ ...goals, [n.key]: t })}
                />
              ))}

              {/* Presets row */}
              <View style={styles.presetsRow}>
                <Text style={styles.presetsLabel}>⚡ Quick presets:</Text>
                {[
                  { label: "🏃 Active",  vals: { calorieGoal:"2400", proteinGoal:"160", carbsGoal:"280", fatsGoal:"70",  waterGoal:"3000" } },
                  { label: "🧘 Balance", vals: { calorieGoal:"2000", proteinGoal:"120", carbsGoal:"240", fatsGoal:"65",  waterGoal:"2500" } },
                  { label: "💪 Bulk",    vals: { calorieGoal:"3000", proteinGoal:"200", carbsGoal:"360", fatsGoal:"90",  waterGoal:"3500" } },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={styles.presetBtn}
                    onPress={() => setGoals({ ...goals, ...p.vals })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={saving ? ["#C5CAD8", "#C5CAD8"] : ["#667EEA", "#764BA2"]}
                  style={styles.saveBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Text style={styles.saveBtnEmoji}>💾</Text>
                        <Text style={styles.saveBtnText}>Save My Goals</Text>
                        <Text style={styles.saveBtnEmoji}>🚀</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ════════ PROGRESS TAB ════════ */}
          {tab === "progress" && (
            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionHeadEmoji}>📊</Text>
                <View>
                  <Text style={styles.sectionTitle}>Today's Progress</Text>
                  <Text style={styles.sectionSub}>
                    {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"short" })} 🗓️
                  </Text>
                </View>
              </View>

              {stats.totalGoals === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 64 }}>🎯</Text>
                  <Text style={styles.emptyTitle}>No Goals Yet</Text>
                  <Text style={styles.emptySub}>Set your targets in the Goals tab to track progress here ✨</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setTab("goals")}>
                    <Text style={styles.emptyBtnText}>Set Goals ➜</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                NUTRIENTS.map((n, i) => {
                  const goal = parseInt(goals[n.key]) || 0;
                  if (!goal) return null;
                  return (
                    <ProgressCard
                      key={n.key}
                      nutrient={n}
                      value={dailyData[n.dataKey]}
                      goal={goal}
                      index={i}
                    />
                  );
                })
              )}

              {/* Motivation strip */}
              {stats.totalGoals > 0 && (
                <View style={styles.motivCard}>
                  <Text style={styles.motivEmoji}>
                    {stats.overallProgress >= 100 ? "🏆" : stats.overallProgress >= 70 ? "🔥" : stats.overallProgress >= 40 ? "💪" : "⚡"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.motivTitle}>
                      {stats.overallProgress >= 100 ? "All goals smashed! You're incredible! 🎉"
                        : stats.overallProgress >= 70 ? "Almost there — keep pushing! 💥"
                        : stats.overallProgress >= 40 ? "Good progress, stay consistent! 📈"
                        : "Every meal counts. You've got this! 🌟"}
                    </Text>
                    <Text style={styles.motivSub}>{stats.overallProgress}% of today's targets reached</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Tip card */}
          <View style={styles.tipCard}>
            <Text style={styles.tipEmoji}>💡</Text>
            <Text style={styles.tipText}>
              Update your profile for personalised recommendations based on your age, weight & activity level! 🏃
            </Text>
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  loader: {
    flex: 1, backgroundColor: T.bg,
    alignItems: "center", justifyContent: "center",
  },
  loaderText: { color: T.textSec, fontSize: 16, marginTop: 12, fontWeight: "600" },

  // header
  header: {
    paddingTop: Platform.OS === "ios" ? 58 : 36,
    paddingBottom: 0,
  },
  headerInner: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  headerMid:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerEmoji: { fontSize: 28 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  // tabs
  tabBar: { flexDirection: "row", paddingHorizontal: 16 },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, gap: 6, position: "relative",
  },
  tabBtnActive: {},
  tabEmoji:       { fontSize: 16 },
  tabLabel:       { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  tabLabelActive: { color: "#fff" },
  tabIndicator: {
    position: "absolute", bottom: 0, left: "15%", right: "15%",
    height: 2, borderRadius: 2, backgroundColor: "#fff",
  },

  // body
  body: { paddingHorizontal: 16, paddingTop: 20 },

  // overview strip
  overviewStrip: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 20, padding: 20, marginBottom: 22,
    gap: 16,
    ...Platform.select({
      ios:     { shadowColor: "#667EEA", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  overviewLeft:        { flex: 1 },
  overviewScore:       { fontSize: 40, fontWeight: "900", color: "#fff", lineHeight: 44 },
  overviewScoreLabel:  { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  overviewBadgeRow:    { flexDirection: "row", marginTop: 8 },
  overviewBadge: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  overviewBadgeText:   { fontSize: 12, color: "#fff", fontWeight: "700" },
  overviewRings:       { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" },
  miniRingItem:        { alignItems: "center", width: 44 },
  miniRingEmoji:       { fontSize: 12, marginTop: 2 },

  // section head
  sectionHead: {
    flexDirection: "row", alignItems: "center",
    gap: 12, marginBottom: 18,
  },
  sectionHeadEmoji: { fontSize: 32 },
  sectionTitle:     { fontSize: 20, fontWeight: "800", color: T.textPrim },
  sectionSub:       { fontSize: 12, color: T.textSec, marginTop: 2 },

  // goal input card
  inputCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1.5, borderColor: T.border,
    padding: 14, gap: 12,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  inputIconWrap: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  inputEmoji: { fontSize: 24 },
  inputBody:  { flex: 1 },
  inputLabel: { fontSize: 15, fontWeight: "700", color: T.textPrim },
  inputTip:   { fontSize: 11, color: T.textMute, marginTop: 1, marginBottom: 4 },
  inputField: {
    fontSize: 22, fontWeight: "800", color: T.textPrim,
    padding: 0, margin: 0,
  },
  unitPill: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
  },
  unitText: { fontSize: 13, fontWeight: "800" },

  // presets
  presetsRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20, alignItems: "center" },
  presetsLabel: { fontSize: 13, color: T.textSec, fontWeight: "600", width: "100%", marginBottom: 2 },
  presetBtn: {
    backgroundColor: T.card, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9,
    borderWidth: 1.5, borderColor: T.border,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  presetText: { fontSize: 13, color: T.textSec, fontWeight: "600" },

  // save button
  saveBtn: {
    borderRadius: 18, overflow: "hidden", marginBottom: 8,
    ...Platform.select({
      ios:     { shadowColor: "#667EEA", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14 },
      android: { elevation: 10 },
    }),
  },
  saveBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 18, gap: 10,
  },
  saveBtnEmoji: { fontSize: 20 },
  saveBtnText:  { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.4 },

  // progress card
  progCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.card, borderRadius: 18,
    borderWidth: 1.5, borderColor: T.border,
    padding: 16, marginBottom: 12, gap: 14,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },
  progRingWrap:    { position: "relative", alignItems: "center", justifyContent: "center" },
  progRingPct:     { position: "absolute", fontSize: 11, fontWeight: "800" },
  progMid:         { flex: 1 },
  progTitleRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  progEmoji:       { fontSize: 16 },
  progLabel:       { fontSize: 15, fontWeight: "700", color: T.textPrim, flex: 1 },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },
  progNumbers:     {},
  progCurrent:     { fontSize: 16, fontWeight: "800" },
  progGoalText:    { fontSize: 13, color: T.textSec, fontWeight: "500" },
  progRight:       { alignItems: "center", minWidth: 52 },
  statusEmojiText: { fontSize: 22, marginBottom: 4 },
  progRemain:      { fontSize: 11, color: T.textMute, textAlign: "center", fontWeight: "600", lineHeight: 15 },

  // empty state
  emptyState: {
    alignItems: "center", paddingVertical: 50,
    backgroundColor: T.card, borderRadius: 24,
    borderWidth: 1.5, borderColor: T.border, marginBottom: 20,
  },
  emptyTitle:   { fontSize: 20, fontWeight: "800", color: T.textPrim, marginTop: 16 },
  emptySub:     { fontSize: 14, color: T.textSec, textAlign: "center", marginTop: 8, paddingHorizontal: 30, lineHeight: 20 },
  emptyBtn: {
    marginTop: 20, backgroundColor: T.accentSoft,
    borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12,
    borderWidth: 1, borderColor: T.accent + "40",
  },
  emptyBtnText: { color: T.accent, fontWeight: "800", fontSize: 15 },

  // motivation card
  motivCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#667EEA12", borderRadius: 18,
    borderWidth: 1.5, borderColor: "#667EEA25",
    padding: 16, gap: 14, marginTop: 8, marginBottom: 16,
  },
  motivEmoji: { fontSize: 32 },
  motivTitle: { fontSize: 14, fontWeight: "700", color: T.textPrim, lineHeight: 20 },
  motivSub:   { fontSize: 12, color: T.textSec, marginTop: 4 },

  // tip card
  tipCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1.5, borderColor: T.border,
    borderLeftWidth: 4, borderLeftColor: T.accent,
    padding: 16, gap: 12, marginTop: 8,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  tipEmoji: { fontSize: 22 },
  tipText:  { flex: 1, fontSize: 13, color: T.textSec, lineHeight: 19 },
});

export default GoalManagementScreen;