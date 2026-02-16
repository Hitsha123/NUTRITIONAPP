import React, { useEffect, useState, useCallback, useMemo } from "react";
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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import auth from "@react-native-firebase/auth";
import * as Progress from "react-native-progress";

const { width } = Dimensions.get("window");

/* ========== UTILITIES ========== */
const clamp = (value) => Math.min(Math.max(value, 0), 1);

const COLORS = {
  primary: "#667eea",
  primaryDark: "#764ba2",
  secondary: "#4facfe",
  background: "#f8f9fa",
  card: "#ffffff",
  text: "#2c3e50",
  textLight: "#7f8c8d",
  success: "#1ABC9C",
  warning: "#F39C12",
  danger: "#E74C3C",
  calories: "#FF6B6B",
  protein: "#4D96FF",
  water: "#1ABC9C",
  overlay: "rgba(0,0,0,0.5)",
};

const GRID_ITEMS = [
  { name: "Meal Log", icon: "food-apple", emoji: "🍽️", color: "#FF9800", route: "MealLogScreen" },
  { name: "Goals", icon: "target", emoji: "🎯", color: "#F44336", route: "GoalManagementScreen" },
  { name: "Tips", icon: "lightbulb-on", emoji: "💡", color: "#FFD700", route: "RecommendationModule" },
  { name: "Analytics", icon: "chart-line", emoji: "📊", color: "#42A5F5", route: "AnalyticsModule" },
  { name: "Barcode", icon: "barcode-scan", emoji: "📱", color: "#8E24AA", route: "BarcodeScannerScreen" },
  { name: "Notifications", icon: "bell-ring", emoji: "🔔", color: "#FF5722", route: "NotificationSettingsScreen" },
];

/* ========== COMPONENTS ========== */

/* Generate Avatar with Initials */
const GeneratedAvatar = ({ name, size = 64 }) => {
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getColorFromName = (name) => {
    const colors = [
      ["#FF6B6B", "#EE5A6F"],
      ["#4ECDC4", "#44A08D"],
      ["#45B7D1", "#4CA1AF"],
      ["#96CEB4", "#FFEAA7"],
      ["#DDA15E", "#BC6C25"],
      ["#9D84B7", "#A8DADC"],
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const initials = getInitials(name);
  const gradientColors = getColorFromName(name);

  return (
    <LinearGradient
      colors={gradientColors}
      style={[styles.generatedAvatar, { width: size, height: size, borderRadius: size / 2 }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>
    </LinearGradient>
  );
};

/* Enhanced Stat Card with Animation */
const StatCard = React.memo(({ icon, emoji, color, label, value, progress, delay = 0 }) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      delay: delay + 200,
      useNativeDriver: false,
    }).start();
  }, [delay, progress, scaleAnim, progressAnim]);

  const percentage = Math.round(clamp(progress) * 100);
  const isOverGoal = progress > 1;

  return (
    <Animated.View
      style={[
        styles.statCard,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
        <Text style={styles.emojiIcon}>{emoji}</Text>
      </View>
      
      <Text style={styles.statValue}>{value}</Text>
      
      <View style={styles.progressContainer}>
        <Progress.Bar
          progress={clamp(progress)}
          width={null}
          color={isOverGoal ? COLORS.danger : color}
          height={8}
          borderRadius={10}
          unfilledColor="#F0F0F0"
          borderWidth={0}
          style={styles.progressBar}
          animated
        />
        <View style={styles.percentageBadge}>
          <Text style={[styles.percentageText, isOverGoal && styles.percentageOverGoal]}>
            {percentage}%
          </Text>
        </View>
      </View>
      
      <Text style={styles.statLabel}>{label}</Text>
      
      {isOverGoal && (
        <View style={styles.overGoalBadge}>
          <Text style={styles.overGoalEmoji}>⚠️</Text>
          <Text style={styles.overGoalText}>Over goal</Text>
        </View>
      )}
    </Animated.View>
  );
});

/* Enhanced Grid Item with Press Animation */
const GridItem = React.memo(({ name, icon, emoji, color, route, navigation, index }) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [index, scaleAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.gridItemWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => navigation.navigate(route)}
      >
        <LinearGradient
          colors={[color + '20', color + '05']}
          style={styles.gridIconWrapper}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.gridEmoji}>{emoji}</Text>
        </LinearGradient>
        <Text style={styles.gridText}>{name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* Enhanced Quick Action Button */
const QuickActionButton = ({ icon, emoji, label, onPress, color }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.quickActionBtn}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <LinearGradient
          colors={[color + '20', color + '10']}
          style={styles.quickActionGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.quickActionIconCircle, { backgroundColor: color + '30' }]}>
            <Text style={styles.quickActionEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.quickActionText, { color }]}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* Streak Card with Animation */
const StreakCard = ({ days }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <LinearGradient
      colors={['#FFE5E5', '#FFF5F5']}
      style={styles.streakCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.streakContent}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text style={styles.streakFire}>🔥</Text>
        </Animated.View>
        <View style={styles.streakTextContainer}>
          <Text style={styles.streakDays}>{days} Day Streak</Text>
          <Text style={styles.streakSubtext}>Keep it up! 🎉</Text>
        </View>
      </View>
      <View style={styles.streakBadge}>
        <Text style={styles.streakBadgeEmoji}>📈</Text>
      </View>
    </LinearGradient>
  );
};

/* ========== MAIN COMPONENT ========== */
export default function HomeScreen() {
  const navigation = useNavigation();

  const [userData, setUserData] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    water: 0,
  });
  const [goals, setGoals] = useState({
    calorieGoal: 2000,
    proteinGoal: 100,
    waterGoal: 2500,
  });
  const [streak, setStreak] = useState(7);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  /* Get Time-Based Greeting */
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const getGreetingEmoji = () => {
    const h = new Date().getHours();
    if (h < 12) return "☀️";
    if (h < 18) return "🌤️";
    return "🌙";
  };

  /* Load Data - UPDATED TO USE FIREBASE AUTH */
  const loadData = useCallback(async () => {
    try {
      // Get current Firebase user instead of AsyncStorage
      const currentUser = auth().currentUser;
      
      // Set user data from Firebase Auth
      if (currentUser) {
        setUserData({
          name: currentUser.displayName || 'User',
          email: currentUser.email || '',
          uid: currentUser.uid,
          photoURL: currentUser.photoURL || null,
        });
      }

      const [savedGoals, savedFoods, waterIntake, savedStreak] =
        await Promise.all([
          AsyncStorage.getItem("nutritionGoals"),
          AsyncStorage.getItem("selectedFoods"),
          AsyncStorage.getItem("waterIntake"),
          AsyncStorage.getItem("streak"),
        ]);

      if (savedGoals) setGoals(JSON.parse(savedGoals));
      if (savedStreak) setStreak(parseInt(savedStreak, 10));

      const meals = savedFoods ? JSON.parse(savedFoods) : [];
      const today = new Date().toISOString().split("T")[0];

      let calories = 0;
      let protein = 0;

      meals.forEach((meal) => {
        if (meal.timestamp?.startsWith(today)) {
          calories += Number(meal.calories) || 0;
          protein += Number(meal.protein) || 0;
        }
      });

      setTotals({
        calories,
        protein,
        water: Number(waterIntake) || 0,
      });
    } catch (err) {
      console.error("Home load error:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const unsub = navigation.addListener("focus", loadData);
    return unsub;
  }, [navigation, loadData, fadeAnim]);

  /* Logout */
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await auth().signOut();
            } catch (e) {
              Alert.alert("Logout failed", e.message);
            }
          },
        },
      ]
    );
  };

  /* Calculate Daily Progress */
  const dailyProgress = useMemo(() => {
    const calProgress = totals.calories / goals.calorieGoal;
    const proProgress = totals.protein / goals.proteinGoal;
    const watProgress = totals.water / goals.waterGoal;
    const avg = (calProgress + proProgress + watProgress) / 3;
    return Math.round(avg * 100);
  }, [totals, goals]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ========== HEADER ========== */}
          <LinearGradient 
            colors={[COLORS.primary, COLORS.primaryDark]} 
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerRow}>
              <View style={styles.greetingContainer}>
                <Text style={styles.welcomeText}>
                  {getGreeting()} {getGreetingEmoji()}
                </Text>
                <Text style={styles.userName} numberOfLines={1}>
                  {userData?.name || "User"}
                </Text>
                <Text style={styles.subText}>
                  {dailyProgress}% of daily goals completed
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => setMenuVisible(true)} 
                style={styles.avatarContainer}
                activeOpacity={0.8}
              >
                <GeneratedAvatar name={userData?.name || "User"} size={64} />
                <View style={styles.avatarBadge}>
                  <Icon name="chevron-down" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Daily Progress Ring */}
            <View style={styles.headerProgress}>
              <Progress.Circle
                size={80}
                progress={clamp(dailyProgress / 100)}
                thickness={8}
                color="#fff"
                unfilledColor="rgba(255,255,255,0.2)"
                borderWidth={0}
                showsText
                formatText={() => `${dailyProgress}%`}
                textStyle={styles.progressText}
              />
              <View style={styles.progressLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.calories }]} />
                  <Text style={styles.legendText}>🔥 Calories</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.protein }]} />
                  <Text style={styles.legendText}>💪 Protein</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.water }]} />
                  <Text style={styles.legendText}>💧 Water</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* ========== STATS CARDS ========== */}
          <View style={styles.statsContainer}>
            <StatCard
              icon="fire"
              emoji="🔥"
              color={COLORS.calories}
              label="Calories"
              value={`${Math.round(totals.calories)} / ${goals.calorieGoal}`}
              progress={totals.calories / goals.calorieGoal}
              delay={0}
            />
            <StatCard
              icon="dumbbell"
              emoji="💪"
              color={COLORS.protein}
              label="Protein (g)"
              value={`${Math.round(totals.protein)} / ${goals.proteinGoal}`}
              progress={totals.protein / goals.proteinGoal}
              delay={100}
            />
            <StatCard
              icon="cup-water"
              emoji="💧"
              color={COLORS.water}
              label="Water (L)"
              value={`${(totals.water / 1000).toFixed(1)} / ${(goals.waterGoal / 1000).toFixed(1)}`}
              progress={totals.water / goals.waterGoal}
              delay={200}
            />
          </View>

          {/* ========== STREAK CARD ========== */}
          <View style={styles.section}>
            <StreakCard days={streak} />
          </View>

          {/* ========== QUICK ACTIONS ========== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <QuickActionButton
                icon="food-apple"
                emoji="🍽️"
                label="Log Meal"
                color={COLORS.warning}
                onPress={() => navigation.navigate("MealLogScreen")}
              />
              <QuickActionButton
                icon="water"
                emoji="💧"
                label="Add Water"
                color={COLORS.water}
                onPress={() => navigation.navigate("MealLogScreen")}
              />
              <QuickActionButton
                icon="chart-line"
                emoji="📊"
                label="Analytics"
                color={COLORS.secondary}
                onPress={() => navigation.navigate("AnalyticsModule")}
              />
            </View>
          </View>

          {/* ========== NAVIGATION GRID ========== */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>✨ Features</Text>
              <Text style={styles.sectionSubtitle}>Explore all tools</Text>
            </View>
            <View style={styles.grid}>
              {GRID_ITEMS.map((item, i) => (
                <GridItem key={i} {...item} navigation={navigation} index={i} />
              ))}
            </View>
          </View>

          {/* ========== MOTIVATIONAL QUOTE ========== */}
          <LinearGradient
            colors={['#F0F4FF', '#FFFFFF']}
            style={styles.quoteCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.quoteIcon}>💬</Text>
            <Text style={styles.quoteText}>
              "Success is the sum of small efforts repeated day in and day out."
            </Text>
            <Text style={styles.quoteAuthor}>— Robert Collier</Text>
          </LinearGradient>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* ========== PROFILE MODAL ========== */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuBox}>
              <View style={styles.menuHandle} />
              
              {/* Profile Info */}
              <LinearGradient
                colors={['#F0F4FF', '#FFFFFF']}
                style={styles.menuProfile}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <GeneratedAvatar name={userData?.name || "User"} size={60} />
                <View style={styles.menuProfileInfo}>
                  <Text style={styles.menuProfileName}>{userData?.name || "User"}</Text>
                  <Text style={styles.menuProfileEmail}>{userData?.email || "user@example.com"}</Text>
                </View>
              </LinearGradient>

              <View style={styles.menuDivider} />

              {/* Menu Items */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate("ProfileScreen");
                }}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: '#f0f0ff' }]}>
                  <Text style={styles.menuItemEmoji}>👤</Text>
                </View>
                <Text style={styles.menuText}>Edit Profile</Text>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate("GoalManagementScreen");
                }}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: '#fff4e6' }]}>
                  <Text style={styles.menuItemEmoji}>🎯</Text>
                </View>
                <Text style={styles.menuText}>Manage Goals</Text>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate("NotificationSettingsScreen");
                }}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: '#e8f5e9' }]}>
                  <Text style={styles.menuItemEmoji}>🔔</Text>
                </View>
                <Text style={styles.menuText}>Notifications</Text>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <View style={[styles.menuIconCircle, { backgroundColor: '#fee' }]}>
                  <Text style={styles.menuItemEmoji}>🚪</Text>
                </View>
                <Text style={[styles.menuText, { color: COLORS.danger }]}>Logout</Text>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ========== STYLES ========== */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  scrollContainer: { 
    paddingBottom: 40 
  },

  /* GENERATED AVATAR */
  generatedAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* HEADER */
  header: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  headerRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-start",
    marginBottom: 24,
  },
  greetingContainer: { 
    flex: 1,
    paddingRight: 16,
  },
  welcomeText: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: "#fff", 
    opacity: 0.9, 
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  userName: { 
    fontSize: 32, 
    fontWeight: "900", 
    color: "#fff", 
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subText: { 
    fontSize: 14, 
    color: "#fff", 
    opacity: 0.9, 
    fontWeight: "600" 
  },

  avatarContainer: { 
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },

  headerProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  progressLegend: {
    flex: 1,
    marginLeft: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },

  /* STATS */
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emojiIcon: {
    fontSize: 32,
  },
  statValue: { 
    fontSize: 13, 
    fontWeight: "800", 
    color: COLORS.text,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginVertical: 12,
    position: 'relative',
  },
  progressBar: {
    width: '100%',
  },
  percentageBadge: {
    position: 'absolute',
    top: -8,
    right: 0,
    backgroundColor: COLORS.card,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  percentageText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.text,
  },
  percentageOverGoal: {
    color: COLORS.danger,
  },
  statLabel: { 
    fontSize: 12, 
    color: COLORS.textLight, 
    fontWeight: "600",
    textAlign: 'center',
  },
  overGoalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    gap: 4,
  },
  overGoalEmoji: {
    fontSize: 10,
  },
  overGoalText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.danger,
  },

  /* STREAK */
  streakCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  streakFire: {
    fontSize: 40,
  },
  streakTextContainer: {
    gap: 4,
  },
  streakDays: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  streakSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  streakBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,107,107,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakBadgeEmoji: {
    fontSize: 20,
  },

  /* SECTIONS */
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  /* QUICK ACTIONS */
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  quickActionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* GRID */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  gridItemWrapper: {
    width: (width - 48) / 2,
  },
  gridItem: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  gridIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  gridEmoji: {
    fontSize: 36,
  },
  gridText: { 
    fontSize: 15, 
    fontWeight: "700", 
    color: COLORS.text, 
    textAlign: 'center' 
  },

  /* QUOTE CARD */
  quoteCard: {
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  quoteIcon: {
    fontSize: 24,
    opacity: 0.3,
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 12,
    fontWeight: '500',
  },
  quoteAuthor: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '700',
    textAlign: 'right',
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  menuBox: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  menuHandle: {
    width: 50,
    height: 5,
    backgroundColor: "#ddd",
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },

  /* Menu Profile Section */
  menuProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  menuProfileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  menuProfileName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  menuProfileEmail: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  menuDivider: {
    height: 1,
    backgroundColor: COLORS.background,
    marginVertical: 16,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: COLORS.background,
  },
  menuIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemEmoji: {
    fontSize: 22,
  },
  menuText: { 
    flex: 1, 
    fontSize: 17, 
    fontWeight: "700", 
    color: COLORS.text 
  },
});