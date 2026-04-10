import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Alert,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import * as Progress from "react-native-progress";

const { width } = Dimensions.get("window");

// ─── ULTRA PREMIUM THEME ──────────────────────────────────────────────────────
const T = {
  bg:       "#F0F2F5",
  card:     "#FFFFFF",
  border:   "#F1F5F9",
  textPrim: "#0F172A",
  textSec:  "#64748B",
  textMute: "#94A3B8",
  accent:   "#6366F1",
  accentDark:"#4F46E5",
  purple:   "#8B5CF6",
  cal:      "#F43F5E",  calBg:  "#FFE4E6",
  prot:     "#3B82F6",  protBg: "#DBEAFE",
  water:    "#0EA5E9",  waterBg:"#E0F2FE",
  gold:     "#F59E0B",  goldBg: "#FEF3C7",
  danger:   "#EF4444",
};

const DARK_T = {
  bg:       "#020617",
  card:     "#020617",
  border:   "#1E293B",
  textPrim: "#E5E7EB",
  textSec:  "#9CA3AF",
  textMute: "#6B7280",
  accent:   "#6366F1",
  accentDark:"#4F46E5",
  purple:   "#8B5CF6",
  cal:      "#FB7185",  calBg:  "#4B1C28",
  prot:     "#60A5FA",  protBg: "#1E293B",
  water:    "#38BDF8",  waterBg:"#0B1120",
  gold:     "#FACC15",  goldBg: "#422006",
  danger:   "#F87171",
};

const CUPS = 8;
const clamp = (v) => Math.min(Math.max(v, 0), 1);
const todayStr = () => new Date().toISOString().split("T")[0];

const GRID_ITEMS = [
  { name: "Meal Log",   emoji: "🥗", color: "#FF6B6B", route: "MealLogScreen" },
  { name: "My Goals",  emoji: "🎯", color: "#4ECDC4", route: "GoalManagementScreen" },
  { name: "Tips",      emoji: "💡", color: "#F59E0B", route: "RecommendationModule" },
  { name: "Analytics", emoji: "📈", color: "#3B82F6", route: "AnalyticsModule" },
  { name: "Barcode",   emoji: "📱", color: "#A29BFE", route: "BarcodeScannerScreen" },
  { name: "Alerts",    emoji: "🔔", color: "#FD79A8", route: "NotificationSettingsScreen" },
  { name: "Our Team",  emoji: "👥", color: "#6C5CE7", route: "AboutTeamScreen" },
  { name: "Profile",   emoji: "⚙️", color: "#64748B", route: "ProfileScreen" },
];

const QUOTES = [
  { text: "Your health is an investment, not an expense.", author: "Unknown" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
];

// ─── SHADOW HELPER ────────────────────────────────────────────────────────────
const glow = (color = "#000", elev = 8) =>
  Platform.select({
    ios:     { shadowColor: color, shadowOffset: { width: 0, height: elev / 2 }, shadowOpacity: 0.18, shadowRadius: elev + 2 },
    android: { elevation: elev },
  });

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 60 }) => {
  const initials = (name ? name.trim().split(" ") : ["U"]).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const gradients = [
    ["#6366F1", "#8B5CF6"], ["#EC4899", "#F43F5E"],
    ["#10B981", "#059669"], ["#F59E0B", "#D97706"],
    ["#3B82F6", "#2563EB"], ["#8B5CF6", "#7C3AED"],
  ];
  const grad = gradients[(name?.length || 0) % gradients.length];
  return (
    <View style={[avS.ring, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
      <LinearGradient
        colors={grad}
        style={{ width: size, height: size, borderRadius: size / 2, justifyContent: "center", alignItems: "center" }}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Text style={{ color: "#fff", fontSize: size * 0.36, fontWeight: "800", letterSpacing: 1 }}>{initials}</Text>
      </LinearGradient>
    </View>
  );
};
const avS = StyleSheet.create({
  ring: { borderWidth: 3, borderColor: "#fff", justifyContent: "center", alignItems: "center", ...glow(T.accent, 8) },
});

// ─── SECTION LABEL ────────────────────────────────────────────────────────────
const SectionLabel = ({ title, sub, theme }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "900", color: theme.textPrim, letterSpacing: -0.4 }}>{title}</Text>
    {sub && (
      <Text style={{ fontSize: 12, color: theme.textMute, fontWeight: "600", marginTop: 3 }}>
        {sub}
      </Text>
    )}
  </View>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = React.memo(
  ({ emoji, color, colorBg, label, current, goal, unit, delay = 0, highlight = false, theme }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, delay, useNativeDriver: true }).start();
  }, []);
  const pct   = Math.round(clamp(current / goal) * 100);
  const isOver = current > goal;
  return (
    <Animated.View
      style={[
        styles.statCard,
        highlight && styles.statCardHighlight,
        { transform: [{ scale: scaleAnim }], ...glow(color, 10) },
      ]}
    >
      <View style={styles.statHeader}>
        <View style={[styles.statIconBg, { backgroundColor: colorBg }]}>
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        </View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <View style={styles.statValueRow}>
        <Text style={[styles.statBigNum, { color: isOver ? theme.danger : color }]}>
          {typeof current === "number" ? Math.round(current) : current}
        </Text>
        {!!unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      <Progress.Bar
        progress={clamp(current / goal)}
        width={null}
        height={6}
        color={isOver ? theme.danger : color}
        unfilledColor={theme.border}
        borderWidth={0}
        borderRadius={10}
        style={{ marginVertical: 10 }}
      />
      <View style={styles.statFooterRow}>
        <Text style={styles.statPctText}>
          {pct}% of goal
        </Text>
        {isOver && (
          <View style={styles.overChip}>
            <Text style={styles.overChipText}>Over!</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
  }
);

// ─── WATER TRACKER ────────────────────────────────────────────────────────────
const WaterTracker = ({ water, goal, onAdd, onRemove, theme }) => {
  const filled = Math.min(Math.round((water / goal) * CUPS), CUPS);
  const pulses  = useRef([...Array(CUPS)].map(() => new Animated.Value(1))).current;

  const tap = (i) => {
    Animated.sequence([
      Animated.spring(pulses[i], { toValue: 1.5, speed: 80, useNativeDriver: true }),
      Animated.spring(pulses[i], { toValue: 1,   speed: 40, useNativeDriver: true }),
    ]).start();
    if (i >= filled) onAdd(); else onRemove();
  };

  return (
    <View style={[styles.waterCard, { backgroundColor: theme.card }, glow(theme.water, 10)]}>
      <View style={styles.waterHeader}>
        <View>
          <Text style={[styles.waterTitle, { color: theme.textPrim }]}>💧 Hydration</Text>
          <Text style={[styles.waterSub, { color: theme.textMute }]}>Tap a cup to log water</Text>
        </View>
        <View style={[styles.waterBadge, { backgroundColor: theme.waterBg }]}>
          <Text style={[styles.waterBadgeText, { color: theme.water }]}>
            {(water / 1000).toFixed(1)}L / {(goal / 1000).toFixed(1)}L
          </Text>
        </View>
      </View>
      <View style={styles.cupsRow}>
        {[...Array(CUPS)].map((_, i) => (
          <Animated.View key={i} style={{ transform: [{ scale: pulses[i] }] }}>
            <TouchableOpacity onPress={() => tap(i)} activeOpacity={0.7} style={styles.cupBtn}>
              <Text style={styles.cupEmoji}>{i < filled ? "🥤" : "🫙"}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
      <Progress.Bar
        progress={clamp(water / goal)}
        width={width - 80}
        color={theme.water}
        height={8}
        borderRadius={10}
        unfilledColor={theme.waterBg}
        borderWidth={0}
        style={{ alignSelf: "center", marginTop: 14 }}
      />
      <Text style={[styles.waterHint, { color: theme.textMute }]}>
        {filled >= CUPS ? "🎉 Daily hydration goal achieved!" : `${CUPS - filled} cups remaining`}
      </Text>
    </View>
  );
};

// ─── STREAK CARD ─────────────────────────────────────────────────────────────
const StreakCard = ({ days, theme }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.2, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <LinearGradient
      colors={["#4C1D95", "#1D4ED8"]}
      style={[styles.streakCard, glow(theme.accent, 14)]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      {/* Decorative bubble */}
      <View style={styles.streakBubble} />
      <View style={styles.streakLeft}>
        <Animated.Text style={[{ fontSize: 44 }, { transform: [{ scale: pulse }] }]}>🔥</Animated.Text>
        <View style={{ marginLeft: 16 }}>
          <Text style={styles.streakTitle}>{days} Day Streak</Text>
          <Text style={styles.streakSub}>You're absolutely unstoppable 💪</Text>
        </View>
      </View>
      <View style={styles.streakBadge}>
        <Text style={styles.streakBadgeNum}>{days}</Text>
        <Text style={styles.streakBadgeLbl}>days</Text>
      </View>
    </LinearGradient>
  );
};

// ─── GRID ITEM ────────────────────────────────────────────────────────────────
const GridItem = React.memo(({ name, emoji, color, route, navigation, index, theme }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, delay: index * 50, useNativeDriver: true }).start();
  }, []);
  const onPressIn  = () => Animated.spring(pressAnim, { toValue: 0.88, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
  return (
    <Animated.View style={[styles.gridItemWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => navigation.navigate(route)}
        accessibilityRole="button"
        accessibilityLabel={name}
      >
        <Animated.View style={[styles.gridItem, { transform: [{ scale: pressAnim }] }]}>
          <View style={[styles.gridIconBg, { backgroundColor: color + "18" }]}>
            <Text style={styles.gridEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.gridLabel, { color: theme.textSec }]}>{name}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── QUICK ACTION ─────────────────────────────────────────────────────────────
const QuickAction = ({ emoji, label, color, colorBg, onPress }) => {
  const press = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ scale: press }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={() => Animated.spring(press, { toValue: 0.93, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start()}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={[styles.quickAction, { backgroundColor: colorBg + "60", borderColor: color + "40" }]}>
          <View style={[styles.quickIconWrap, { backgroundColor: color + "25" }]}>
            <Text style={styles.quickEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.quickLabel, { color }]}>{label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const navigation = useNavigation();

  const [userData, setUserData] = useState(null);
  const [menuVisible, setMenu]  = useState(false);
  const [totals, setTotals]     = useState({ calories: 0, protein: 0, water: 0 });
  const [goals,  setGoals]      = useState({ calorieGoal: 2000, proteinGoal: 100, waterGoal: 2000 });
  const [streak, setStreak]     = useState(7);
  const [quote]                 = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [refreshing, setRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-24)).current;

  const hour       = new Date().getHours();
  const greeting   = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greetEmoji = hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";
  const firstNameRaw = userData?.name?.split(" ")[0] || "Friend";
  const firstName =
    firstNameRaw.length > 12 ? `${firstNameRaw.slice(0, 11)}…` : firstNameRaw;

  const theme = isDarkMode ? DARK_T : T;

  // ─── LOAD DATA ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const user = auth().currentUser;
      const [savedGoals, savedFoods, savedWater, savedWaterDate, savedStreak, savedProfile] = await Promise.all([
        AsyncStorage.getItem("nutritionGoals"),
        AsyncStorage.getItem("selectedFoods"),
        AsyncStorage.getItem("waterIntake"),
        AsyncStorage.getItem("waterDate"),
        AsyncStorage.getItem("streak"),
        AsyncStorage.getItem("userProfile"),
      ]);
      const profile = savedProfile ? JSON.parse(savedProfile) : null;
      setUserData({ name: profile?.name || user?.displayName || "User", email: profile?.email || user?.email || "" });
      if (savedGoals)  setGoals(JSON.parse(savedGoals));
      if (savedStreak) setStreak(parseInt(savedStreak, 10));

      const today = todayStr();
      let water = 0;
      if (savedWaterDate === today) { water = Number(savedWater) || 0; }
      else {
        await AsyncStorage.setItem("waterIntake", "0");
        await AsyncStorage.setItem("waterDate", today);
      }

      const meals = savedFoods ? JSON.parse(savedFoods) : [];
      let calories = 0, protein = 0;
      meals.forEach((m) => {
        if (m.timestamp?.startsWith(today)) {
          calories += Number(m.calories) || 0;
          protein  += Number(m.protein)  || 0;
        }
      });
      setTotals({ calories, protein, water });
    } catch (e) { console.error("HomeScreen loadData:", e); }
  }, []);

  // ─── WATER ───────────────────────────────────────────────────────────────
  const handleWaterAdd = useCallback(async () => {
    const step = goals.waterGoal / CUPS;
    const next = Math.min(totals.water + step, goals.waterGoal);
    setTotals((p) => ({ ...p, water: next }));
    await AsyncStorage.setItem("waterIntake", String(next));
    await AsyncStorage.setItem("waterDate", todayStr());
  }, [totals.water, goals.waterGoal]);

  const handleWaterRemove = useCallback(async () => {
    const step = goals.waterGoal / CUPS;
    const next = Math.max(totals.water - step, 0);
    setTotals((p) => ({ ...p, water: next }));
    await AsyncStorage.setItem("waterIntake", String(next));
    await AsyncStorage.setItem("waterDate", todayStr());
  }, [totals.water, goals.waterGoal]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  // ─── INIT ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
    ]).start();
    const unsub = navigation.addListener("focus", loadData);
    return unsub;
  }, [navigation, loadData]);

  const handleLogout = () =>
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => auth().signOut() },
    ]);

  const overallPct = useMemo(() => {
    const avg = (
      clamp(totals.calories / goals.calorieGoal) +
      clamp(totals.protein  / goals.proteinGoal) +
      clamp(totals.water    / goals.waterGoal)
    ) / 3;
    return Math.round(avg * 100);
  }, [totals, goals]);

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            progressBackgroundColor={theme.card}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ════ HEADER ════ */}
          <Animated.View style={[styles.headerWrap, { transform: [{ translateY: slideAnim }] }]}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <View>
                <Text style={[styles.greetSmall, { color: theme.textMute }]}>
                  {greetEmoji}  {greeting}
                </Text>
                <Text style={[styles.greetName, { color: theme.textPrim }]}>
                  {firstName} 👋
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setIsDarkMode((prev) => !prev)}
                  activeOpacity={0.85}
                  style={styles.themeToggle}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle light or dark mode"
                >
                  <Text style={styles.themeToggleIcon}>{isDarkMode ? "🌙" : "☀️"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMenu(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile menu"
                >
                  <Avatar name={userData?.name || "User"} size={50} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Hero card */}
            <LinearGradient
              colors={
                isDarkMode
                  ? ["#020617", "#0B1120", "#020617"]
                  : ["#6366F1", "#8B5CF6", "#A78BFA"]
              }
              style={[styles.heroCard, glow(theme.accent, 18)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroBubble1} />
              <View style={styles.heroBubble2} />

              <View style={styles.heroContent}>
                {/* Ring */}
                <View style={styles.heroRingWrap}>
                  <Progress.Circle
                    size={110} progress={clamp(overallPct / 100)} thickness={11}
                    color="#fff" unfilledColor="rgba(255,255,255,0.2)"
                    borderWidth={0} showsText
                    formatText={() => `${overallPct}%`}
                    textStyle={styles.heroRingText}
                  />
                  <Text style={styles.heroRingLabel}>daily score</Text>
                </View>

                {/* Text */}
                <View style={styles.heroRight}>
                  <Text style={styles.heroTitle}>Today's{"\n"}Overview</Text>
                  <Text style={styles.heroStatus}>
                    {overallPct >= 80 ? "🔥 Incredible work!" : overallPct >= 50 ? "💪 Great progress!" : "🌱 Keep building!"}
                  </Text>
                  {/* Mini stats */}
                  <View style={styles.heroMiniStats}>
                    <View style={styles.heroMiniStat}>
                      <Text style={styles.heroMiniVal}>{Math.round(totals.calories)}</Text>
                      <Text style={styles.heroMiniLbl}>kcal</Text>
                    </View>
                    <View style={styles.heroMiniDivider} />
                    <View style={styles.heroMiniStat}>
                      <Text style={styles.heroMiniVal}>{Math.round(totals.protein)}</Text>
                      <Text style={styles.heroMiniLbl}>protein g</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Footer strip */}
              <View style={styles.heroFooter}>
                <Text style={styles.heroDateText}>
                  📅  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </Text>
                <View style={styles.heroGoalPill}>
                  <Text style={styles.heroGoalPillText}>🎯 {goals.calorieGoal} kcal goal</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ════ STAT CARDS ════ */}
          <View style={styles.section}>
            <SectionLabel
              title="Today's Stats"
              sub="Your nutritional progress"
              theme={theme}
            />
            <View style={styles.statsRow}>
              <StatCard
                emoji="🔥"
                color={theme.cal}
                colorBg={theme.calBg}
                label="Calories"
                current={totals.calories}
                goal={goals.calorieGoal}
                unit="kcal"
                delay={0}
                highlight
                theme={theme}
              />
              <StatCard
                emoji="💪"
                color={theme.prot}
                colorBg={theme.protBg}
                label="Protein"
                current={totals.protein}
                goal={goals.proteinGoal}
                unit="g"
                delay={100}
                theme={theme}
              />
              <StatCard
                emoji="💧"
                color={theme.water}
                colorBg={theme.waterBg}
                label="Water"
                current={parseFloat((totals.water / 1000).toFixed(1))}
                goal={parseFloat((goals.waterGoal / 1000).toFixed(1))}
                unit="L"
                delay={200}
                theme={theme}
              />
            </View>
          </View>

          {/* ════ QUICK ACTIONS ════ */}
          <View style={styles.section}>
            <SectionLabel title="Quick Actions" sub="Fast-access tools" theme={theme} />
            <View style={styles.quickRow}>
              <QuickAction
                emoji="🥗"
                label="Log Meal"
                color={theme.cal}
                colorBg={theme.calBg}
                onPress={() => navigation.navigate("MealLogScreen")}
              />
              <QuickAction
                emoji="💧"
                label="+Water"
                color={theme.water}
                colorBg={theme.waterBg}
                onPress={handleWaterAdd}
              />
              <QuickAction
                emoji="📈"
                label="Analytics"
                color={theme.prot}
                colorBg={theme.protBg}
                onPress={() => navigation.navigate("AnalyticsModule")}
              />
            </View>
          </View>

          {/* ════ WATER TRACKER ════ */}
          <View style={styles.section}>
            <WaterTracker
              water={totals.water}
              goal={goals.waterGoal}
              onAdd={handleWaterAdd}
              onRemove={handleWaterRemove}
              theme={theme}
            />
          </View>

          {/* ════ STREAK ════ */}
          <View style={styles.section}>
            <StreakCard days={streak} theme={theme} />
          </View>

          {/* ════ NUTRITION SNAPSHOT ════ */}
          <View style={styles.section}>
            <SectionLabel
              title="Nutrition Snapshot"
              sub="A detailed look at today"
              theme={theme}
            />
            <View
              style={[
                styles.snapshotCard,
                { backgroundColor: theme.card },
                glow("#000", 4),
              ]}
            >
              {[
                {
                  emoji: "🔥",
                  label: "Calories",
                  value: `${Math.round(totals.calories)} kcal`,
                  color: theme.cal,
                  colorBg: theme.calBg,
                  current: totals.calories,
                  goal: goals.calorieGoal,
                },
                {
                  emoji: "💪",
                  label: "Protein",
                  value: `${Math.round(totals.protein)}g`,
                  color: theme.prot,
                  colorBg: theme.protBg,
                  current: totals.protein,
                  goal: goals.proteinGoal,
                },
                {
                  emoji: "💧",
                  label: "Water",
                  value: `${(totals.water / 1000).toFixed(1)}L`,
                  color: theme.water,
                  colorBg: theme.waterBg,
                  current: totals.water,
                  goal: goals.waterGoal,
                },
              ].map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.snapshotRow,
                    i < 2 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                  ]}
                >
                  <View
                    style={[styles.snapshotIconWrap, { backgroundColor: item.colorBg }]}
                  >
                    <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.snapshotLabel, { color: theme.textSec }]}>
                      {item.label}
                    </Text>
                    <Progress.Bar
                      progress={clamp(item.current / item.goal)}
                      width={width - 220}
                      color={item.color}
                      height={6}
                      borderRadius={6}
                      unfilledColor={item.colorBg}
                      borderWidth={0}
                      style={{ marginTop: 6 }}
                    />
                  </View>
                  <Text style={[styles.snapshotValue, { color: item.color }]}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ════ FEATURE GRID ════ */}
          <View style={styles.section}>
            <SectionLabel title="All Features" sub="Everything in one place" theme={theme} />
            <View style={[styles.featureCard, { backgroundColor: theme.card }, glow("#000", 4)]}>
              <View style={styles.grid}>
                {GRID_ITEMS.map((item, i) => (
                  <GridItem
                    key={i}
                    {...item}
                    navigation={navigation}
                    index={i}
                    theme={theme}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* ════ QUOTE ════ */}
          <View
            style={[
              styles.section,
              styles.quoteCard,
              { borderLeftColor: theme.accent, backgroundColor: theme.card },
              glow(theme.accent, 6),
            ]}
          >
            <Text style={[styles.quoteOpenMark, { color: theme.accent }]}>"
            </Text>
            <Text style={[styles.quoteText, { color: theme.textPrim }]}>{quote.text}</Text>
            <View style={styles.quoteFooter}>
              <View style={[styles.quoteAccentBar, { backgroundColor: theme.accent }]} />
              <Text style={[styles.quoteAuthor, { color: theme.textMute }]}>
                {quote.author}
              </Text>
            </View>
          </View>

          {/* ════ FOOTER ════ */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textMute }]}>
              🥜 NUTS Nutrition · Stay Healthy · Stay Strong 💚
            </Text>
          </View>

          <View style={{ height: 48 }} />
        </Animated.View>
      </ScrollView>

      {/* ════ PROFILE SHEET ════ */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenu(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheet, { backgroundColor: theme.card }]}>
              <View style={styles.sheetHandle} />

              {/* Banner */}
              <LinearGradient
                colors={
                  isDarkMode
                    ? ["#020617", "#020617"]
                    : ["#6366F1", "#8B5CF6"]
                }
                style={styles.sheetBanner}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <View style={styles.sheetBannerBubble} />
                <Avatar name={userData?.name || "User"} size={60} />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text style={styles.sheetName}>{userData?.name || "User"}</Text>
                  <Text style={styles.sheetEmail}>{userData?.email || ""}</Text>
                </View>
                <View style={styles.sheetStreakBadge}>
                  <Text style={{ fontSize: 18 }}>🔥</Text>
                  <Text style={styles.sheetStreakText}>{streak}d</Text>
                </View>
              </LinearGradient>

              {/* Menu items */}
              <View style={styles.sheetMenu}>
                {[
                  { emoji: "👤", label: "Edit Profile",   sub: "Update your details",  color: theme.accent,    route: "ProfileScreen" },
                  { emoji: "🎯", label: "Manage Goals",   sub: "Set daily targets",    color: theme.cal,       route: "GoalManagementScreen" },
                  { emoji: "🔔", label: "Notifications",  sub: "Alert preferences",    color: "#EC4899",   route: "NotificationSettingsScreen" },
                  { emoji: "👥", label: "Meet the Team",  sub: "The NUTS team",         color: theme.water,     route: "AboutTeamScreen" },
                  { emoji: "📈", label: "Analytics",      sub: "View your data story",  color: theme.prot,      route: "AnalyticsModule" },
                ].map((item, i) => (
                  <TouchableOpacity key={i} style={styles.sheetItem} onPress={() => { setMenu(false); navigation.navigate(item.route); }}>
                    <View style={[styles.sheetItemIcon, { backgroundColor: item.color + "15" }]}>
                      <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetItemLabel, { color: theme.textPrim }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.sheetItemSub, { color: theme.textMute }]}>
                        {item.sub}
                      </Text>
                    </View>
                    <Text style={{ color: theme.textMute, fontSize: 20 }}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.sheetDivider} />

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.85}
              >
                <Text style={styles.logoutText}>🚪  Sign Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 20 },

  // ── header
  headerWrap: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 10 : 24, paddingBottom: 4 },
  topBar:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  greetSmall: { fontSize: 13, color: T.textMute, fontWeight: "700", marginBottom: 4 },
  greetName:  { fontSize: 28, fontWeight: "900", color: T.textPrim, letterSpacing: -0.5 },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.card,
  },
  themeToggleIcon: { fontSize: 18 },

  // ── hero card
  heroCard:        { borderRadius: 28, paddingHorizontal: 20, paddingVertical: 18, overflow: "hidden" },
  heroBubble1:     { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.07)", top: -60, right: -40 },
  heroBubble2:     { position: "absolute", width: 120, height: 120, borderRadius: 60,  backgroundColor: "rgba(255,255,255,0.05)", bottom: -30, left: 40 },
  heroContent:     { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 16 },
  heroRingWrap:    { alignItems: "center" },
  heroRingText:    { fontSize: 20, fontWeight: "900", color: "#fff" },
  heroRingLabel:   { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "700", marginTop: 8, letterSpacing: 1, textTransform: "uppercase" },
  heroRight:       { flex: 1 },
  heroTitle:       { fontSize: 24, fontWeight: "900", color: "#fff", lineHeight: 26, letterSpacing: -0.5, marginBottom: 6 },
  heroStatus:      { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginBottom: 14 },
  heroMiniStats:   { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  heroMiniStat:    { alignItems: "center" },
  heroMiniVal:     { fontSize: 18, fontWeight: "900", color: "#fff" },
  heroMiniLbl:     { fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: "700", marginTop: 2 },
  heroMiniDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.25)" },
  heroFooter:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 16 },
  heroDateText:    { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "700" },
  heroGoalPill:    { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  heroGoalPillText:{ fontSize: 11, color: "#fff", fontWeight: "800" },

  // ── sections
  section: { marginHorizontal: 20, marginTop: 28 },

  // ── stat cards
  statsRow:     { flexDirection: "row", gap: 10 },
  statCard:     { flex: 1, backgroundColor: T.card, borderRadius: 20, padding: 14 },
  statHeader:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  statIconBg:   { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  statLabel:    { fontSize: 11, fontWeight: "800", color: T.textMute, flex: 1 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginBottom: 2 },
  statBigNum:   { fontSize: 22, fontWeight: "900" },
  statUnit:     { fontSize: 11, color: T.textMute, fontWeight: "700" },
  statFooterRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  statPctText:  { fontSize: 10, color: T.textMute, fontWeight: "700" },
  overChip:     { backgroundColor: "#FEE2E2", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  overChipText: { fontSize: 9, fontWeight: "900", color: T.danger },

  // ── quick actions
  quickRow:     { flexDirection: "row", gap: 12 },
  quickAction:  { borderRadius: 18, alignItems: "center", justifyContent: "center", paddingVertical: 18, borderWidth: 1.5 },
  quickIconWrap:{ width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  quickEmoji:   { fontSize: 28 },
  quickLabel:   { fontSize: 13, fontWeight: "800" },

  // ── water card
  waterCard:    { backgroundColor: T.card, borderRadius: 24, padding: 22 },
  waterHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  waterTitle:   { fontSize: 20, fontWeight: "900", color: T.textPrim, letterSpacing: -0.3 },
  waterSub:     { fontSize: 12, color: T.textMute, fontWeight: "600", marginTop: 2 },
  waterBadge:   { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  waterBadgeText:{ fontSize: 13, fontWeight: "800" },
  cupsRow:      { flexDirection: "row", justifyContent: "space-between" },
  cupBtn:       { padding: 4 },
  cupEmoji:     { fontSize: 28 },
  waterHint:    { fontSize: 12, color: T.textMute, textAlign: "center", marginTop: 12, fontWeight: "600" },

  // ── streak
  streakCard:   { borderRadius: 24, padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", overflow: "hidden" },
  streakBubble: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30 },
  streakLeft:   { flexDirection: "row", alignItems: "center" },
  streakTitle:  { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: -0.3 },
  streakSub:    { fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "600", marginTop: 4 },
  streakBadge:  { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, width: 66, height: 66, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  streakBadgeNum:{ fontSize: 26, fontWeight: "900", color: "#fff" },
  streakBadgeLbl:{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: "700" },

  // ── snapshot
  snapshotCard:    { backgroundColor: T.card, borderRadius: 24, padding: 16 },
  snapshotRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 14 },
  snapshotIconWrap:{ width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  snapshotLabel:   { fontSize: 12, fontWeight: "700", color: T.textSec },
  snapshotValue:   { fontSize: 15, fontWeight: "900" },

  // ── feature grid
  featureCard: { backgroundColor: T.card, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 4 },
  grid:        { flexDirection: "row", flexWrap: "wrap" },
  gridItemWrap:{ width: (width - 64) / 3 },
  gridItem:    { alignItems: "center", paddingVertical: 18 },
  gridIconBg:  { width: 58, height: 58, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  gridEmoji:   { fontSize: 26 },
  gridLabel:   { fontSize: 10, fontWeight: "800", color: T.textSec, textAlign: "center" },

  // ── quote
  quoteCard:      { backgroundColor: T.card, borderRadius: 24, padding: 26, borderLeftWidth: 4, borderLeftColor: T.accent },
  quoteOpenMark:  { fontSize: 60, color: T.accent, lineHeight: 48, fontWeight: "900", opacity: 0.3, marginBottom: 8 },
  quoteText:      { fontSize: 16, color: T.textPrim, lineHeight: 26, fontStyle: "italic", fontWeight: "500", marginBottom: 20 },
  quoteFooter:    { flexDirection: "row", alignItems: "center", gap: 12 },
  quoteAccentBar: { height: 3, width: 32, backgroundColor: T.accent, borderRadius: 2 },
  quoteAuthor:    { fontSize: 13, color: T.textMute, fontWeight: "700" },

  // ── footer
  footer:    { marginHorizontal: 20, marginTop: 24, alignItems: "center" },
  footerText:{ fontSize: 12, color: T.textMute, fontWeight: "600", letterSpacing: 0.2 },

  // ── sheet / modal
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: T.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, ...glow("#000", 20) },
  sheetHandle: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: "center", marginTop: 14, marginBottom: 4 },

  sheetBanner:      { flexDirection: "row", alignItems: "center", padding: 22, marginBottom: 4, overflow: "hidden" },
  sheetBannerBubble:{ position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)", top: -50, right: -30 },
  sheetName:        { fontSize: 19, fontWeight: "900", color: "#fff" },
  sheetEmail:       { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "600", marginTop: 2 },
  sheetStreakBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  sheetStreakText:  { fontSize: 14, fontWeight: "900", color: "#fff", marginTop: 2 },

  sheetMenu:     { paddingHorizontal: 16, paddingTop: 8 },
  sheetItem:     { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, marginBottom: 4, backgroundColor: T.bg },
  sheetItemIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 14 },
  sheetItemLabel:{ fontSize: 15, fontWeight: "800", color: T.textPrim, marginBottom: 2 },
  sheetItemSub:  { fontSize: 11, color: T.textMute, fontWeight: "600" },
  sheetDivider:  { height: 1, backgroundColor: T.border, marginHorizontal: 24, marginVertical: 16 },

  logoutBtn:  { marginHorizontal: 24, backgroundColor: "#FEF2F2", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#FECACA" },
  logoutText: { fontSize: 16, fontWeight: "900", color: T.danger },
});