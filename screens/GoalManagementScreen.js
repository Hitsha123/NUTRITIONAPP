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

// Emoji helper component with fallback
const Emoji = ({ name, fallback = "" }) => {
  const emojiMap = {
    target: "\u{1F3AF}",
    fire: "\u{1F525}", 
    muscle: "\u{1F4AA}",
    bread: "\u{1F35E}",
    avocado: "\u{1F951}",
    droplet: "\u{1F4A7}",
    trophy: "\u{1F3C6}",
    chart: "\u{1F4C8}",
    sparkles: "\u{2728}",
    star: "\u{1F31F}",
    party: "\u{1F389}",
    save: "\u{1F4BE}",
    bulb: "\u{1F4A1}",
  };
  
  return <Text>{emojiMap[name] || fallback}</Text>;
};

/* =======================
   PROGRESS CARD COMPONENT
======================= */
const ProgressCard = ({ icon, iconColor, label, value, goal, unit, delay, emoji }) => {
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;
  const percentage = Math.round(progress * 100);
  const remaining = Math.max(goal - value, 0);
  const [animatedProgress] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: delay || 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(animatedProgress, {
        toValue: progress,
        delay: delay || 0,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();
  }, [progress, delay]);

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return "#10B981";
    if (percentage >= 70) return iconColor;
    if (percentage >= 40) return "#F59E0B";
    return "#EF4444";
  };

  const progressColor = getProgressColor(percentage);

  return (
    <Animated.View
      style={[
        styles.progressCard,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.progressHeader}>
        <LinearGradient
          colors={[iconColor + "20", iconColor + "10"]}
          style={styles.iconCircle}
        >
          <Icon name={icon} size={28} color={iconColor} />
        </LinearGradient>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>
            {emoji && <Emoji name={emoji} />} {label}
          </Text>
          <Text style={styles.progressValue}>
            <Text style={{ fontWeight: "800", color: iconColor }}>
              {Math.round(value)}
            </Text>
            <Text style={{ color: "#95a5a6" }}> / {goal} {unit}</Text>
          </Text>
        </View>
        <LinearGradient
          colors={[progressColor + "20", progressColor + "10"]}
          style={styles.percentageBadge}
        >
          <Text style={[styles.percentageText, { color: progressColor }]}>
            {percentage}%
          </Text>
        </LinearGradient>
      </View>

      <View style={styles.progressBarWrapper}>
        <Progress.Bar
          progress={progress}
          width={null}
          height={10}
          color={progressColor}
          unfilledColor="#F0F0F0"
          borderWidth={0}
          borderRadius={10}
          style={styles.progressBar}
        />
        {percentage >= 100 && (
          <Icon
            name="check-circle"
            size={20}
            color="#10B981"
            style={styles.checkIcon}
          />
        )}
      </View>

      {goal > 0 && (
        <View style={styles.remainingContainer}>
          {remaining > 0 ? (
            <>
              <Icon name="target" size={14} color="#95a5a6" />
              <Text style={styles.remainingText}>
                <Emoji name="target" /> {Math.round(remaining)} {unit} remaining
              </Text>
            </>
          ) : (
            <>
              <Icon name="trophy" size={14} color="#10B981" />
              <Text style={[styles.remainingText, { color: "#10B981" }]}>
                <Emoji name="trophy" /> Goal achieved! <Emoji name="party" />
              </Text>
            </>
          )}
        </View>
      )}
    </Animated.View>
  );
};

/* =======================
   GOAL INPUT COMPONENT
======================= */
const GoalInput = ({ icon, iconColor, label, value, unit, onChange, delay, emoji }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        delay: delay || 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        delay: delay || 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.inputContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.inputHeader}>
        <LinearGradient
          colors={[iconColor + "18", iconColor + "08"]}
          style={styles.inputIconCircle}
        >
          <Icon name={icon} size={22} color={iconColor} />
        </LinearGradient>
        <Text style={styles.inputLabel}>
          {emoji && <Emoji name={emoji} />} {label}
        </Text>
      </View>
      <View style={[styles.inputWrapper, value && styles.inputWrapperFilled]}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(value)}
          placeholder="0"
          placeholderTextColor="#bdc3c7"
          onChangeText={onChange}
        />
        <View style={[styles.unitBadge, { backgroundColor: iconColor + "15" }]}>
          <Text style={[styles.unitText, { color: iconColor }]}>{unit}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

/* =======================
   STATISTICS CARD
======================= */
const StatisticsCard = ({ totalGoals, achievedGoals, overallProgress }) => {
  const [scaleAnim] = useState(new Animated.Value(0.95));

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 40,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[styles.statsCard, { transform: [{ scale: scaleAnim }] }]}
    >
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        style={styles.statsGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="target" size={24} color="#fff" />
            <Text style={styles.statValue}>{totalGoals}</Text>
            <Text style={styles.statLabel}>
              <Emoji name="target" /> Total Goals
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Icon name="trophy" size={24} color="#fff" />
            <Text style={styles.statValue}>{achievedGoals}</Text>
            <Text style={styles.statLabel}>
              <Emoji name="trophy" /> Achieved
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Icon name="chart-line" size={24} color="#fff" />
            <Text style={styles.statValue}>{overallProgress}%</Text>
            <Text style={styles.statLabel}>
              <Emoji name="chart" /> Progress
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

/* =======================
   MAIN COMPONENT
======================= */
const GoalManagementScreen = ({ navigation }) => {
  const [goals, setGoals] = useState({
    calorieGoal: "",
    proteinGoal: "",
    carbsGoal: "",
    fatsGoal: "",
    waterGoal: "",
  });

  const [dailyData, setDailyData] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFats: 0,
    totalWater: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headerAnim] = useState(new Animated.Value(0));

  /* =======================
     LOAD DATA
  ======================= */
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

      let totals = {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
      };

      meals.forEach((meal) => {
        const mealDate = meal.timestamp?.split("T")[0];
        if (mealDate === today) {
          totals.totalCalories += parseFloat(meal.calories) || 0;
          totals.totalProtein += parseFloat(meal.protein) || 0;
          totals.totalCarbs += parseFloat(meal.carbs) || 0;
          totals.totalFats += parseFloat(meal.fats) || 0;
        }
      });

      setDailyData({
        ...totals,
        totalWater: parseInt(waterIntake) || 0,
      });

      // Animate header
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error("Error loading data:", err);
      Alert.alert("❌ Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation?.addListener?.("focus", loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  /* =======================
     SAVE GOALS
  ======================= */
  const handleSaveGoals = async () => {
    // Validation
    const hasGoal = Object.values(goals).some((val) => val && parseInt(val) > 0);
    if (!hasGoal) {
      Alert.alert(
        "⚠️ No Goals Set",
        "Please set at least one goal before saving.",
        [{ text: "OK" }]
      );
      return;
    }

    setSaving(true);
    try {
      const newGoals = {
        calorieGoal: parseInt(goals.calorieGoal) || 0,
        proteinGoal: parseInt(goals.proteinGoal) || 0,
        carbsGoal: parseInt(goals.carbsGoal) || 0,
        fatsGoal: parseInt(goals.fatsGoal) || 0,
        waterGoal: parseInt(goals.waterGoal) || 0,
      };

      await AsyncStorage.setItem("nutritionGoals", JSON.stringify(newGoals));
      setGoals(newGoals);

      Alert.alert(
        "🎉 Success!",
        "Your goals have been saved successfully! 🙌",
        [{ text: "Great! ✅" }]
      );
    } catch (err) {
      console.error("Error saving goals:", err);
      Alert.alert("❌ Error", "Could not save your goals. Please try again. 🔄");
    } finally {
      setSaving(false);
    }
  };

  /* =======================
     CALCULATE STATISTICS
  ======================= */
  const calculateStats = () => {
    const goalKeys = ["calorieGoal", "proteinGoal", "carbsGoal", "fatsGoal", "waterGoal"];
    const dataKeys = ["totalCalories", "totalProtein", "totalCarbs", "totalFats", "totalWater"];

    let totalGoals = 0;
    let achievedGoals = 0;
    let totalProgress = 0;

    goalKeys.forEach((goalKey, index) => {
      const goal = parseInt(goals[goalKey]) || 0;
      if (goal > 0) {
        totalGoals++;
        const current = dailyData[dataKeys[index]] || 0;
        const progress = Math.min((current / goal) * 100, 100);
        totalProgress += progress;
        if (current >= goal) achievedGoals++;
      }
    });

    const overallProgress = totalGoals > 0 ? Math.round(totalProgress / totalGoals) : 0;

    return { totalGoals, achievedGoals, overallProgress };
  };

  /* =======================
     LOADING STATE
  ======================= */
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loaderText}>⏳ Loading your goals...</Text>
      </View>
    );
  }

  /* =======================
     GOAL CONFIGURATIONS
  ======================= */
  const goalConfigs = [
    { key: "calorieGoal", label: "Calories", emoji: "fire", unit: "kcal", icon: "fire", color: "#FF6B6B" },
    { key: "proteinGoal", label: "Protein", emoji: "muscle", unit: "g", icon: "food-drumstick", color: "#4D96FF" },
    { key: "carbsGoal", label: "Carbs", emoji: "bread", unit: "g", icon: "bread-slice", color: "#FFB84D" },
    { key: "fatsGoal", label: "Fats", emoji: "avocado", unit: "g", icon: "oil", color: "#A78BFA" },
    { key: "waterGoal", label: "Water", emoji: "droplet", unit: "ml", icon: "cup-water", color: "#1ABC9C" },
  ];

  const progressConfigs = [
    { key: "totalCalories", goalKey: "calorieGoal", label: "Calories", emoji: "fire", unit: "kcal", icon: "fire", color: "#FF6B6B" },
    { key: "totalProtein", goalKey: "proteinGoal", label: "Protein", emoji: "muscle", unit: "g", icon: "food-drumstick", color: "#4D96FF" },
    { key: "totalCarbs", goalKey: "carbsGoal", label: "Carbs", emoji: "bread", unit: "g", icon: "bread-slice", color: "#FFB84D" },
    { key: "totalFats", goalKey: "fatsGoal", label: "Fats", emoji: "avocado", unit: "g", icon: "oil", color: "#A78BFA" },
    { key: "totalWater", goalKey: "waterGoal", label: "Water", emoji: "droplet", unit: "ml", icon: "cup-water", color: "#1ABC9C" },
  ];

  const stats = calculateStats();

  /* =======================
     RENDER
  ======================= */
  return (
    <>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View
              style={[
                styles.headerContent,
                {
                  opacity: headerAnim,
                  transform: [
                    {
                      translateY: headerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Icon name="arrow-left" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>
                  <Emoji name="target" /> Goal Management
                </Text>
                <Text style={styles.headerSubtitle}>
                  <Emoji name="chart" /> Track your daily nutrition targets
                </Text>
              </View>
              <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
                <Icon name="refresh" size={22} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </LinearGradient>

          {/* Statistics Overview */}
          {stats.totalGoals > 0 && (
            <View style={styles.section}>
              <StatisticsCard
                totalGoals={stats.totalGoals}
                achievedGoals={stats.achievedGoals}
                overallProgress={stats.overallProgress}
              />
            </View>
          )}

          {/* Set Goals Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={["#667eea20", "#667eea10"]}
                style={styles.sectionIconCircle}
              >
                <Icon name="target" size={24} color="#667eea" />
              </LinearGradient>
              <View>
                <Text style={styles.sectionTitle}>
                  <Emoji name="target" /> Daily Goals
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Set your nutrition targets <Emoji name="sparkles" />
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              {goalConfigs.map((config, index) => (
                <GoalInput
                  key={config.key}
                  icon={config.icon}
                  iconColor={config.color}
                  label={config.label}
                  emoji={config.emoji}
                  value={goals[config.key]}
                  unit={config.unit}
                  delay={index * 50}
                  onChange={(text) =>
                    setGoals({ ...goals, [config.key]: text.replace(/[^0-9]/g, "") })
                  }
                />
              ))}

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveGoals}
                disabled={saving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={saving ? ["#95a5a6", "#7f8c8d"] : ["#667eea", "#764ba2"]}
                  style={styles.saveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Icon name="content-save" size={22} color="#fff" />
                      <Text style={styles.saveButtonText}>
                        <Emoji name="save" /> Save Goals
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Today's Progress Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={["#10B98120", "#10B98110"]}
                style={styles.sectionIconCircle}
              >
                <Icon name="chart-line" size={24} color="#10B981" />
              </LinearGradient>
              <View>
                <Text style={styles.sectionTitle}>
                  <Emoji name="chart" /> Today's Progress
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Your daily achievements <Emoji name="star" />
                </Text>
              </View>
            </View>

            <View style={styles.progressSection}>
              {progressConfigs.map((config, index) => {
                const goal = parseInt(goals[config.goalKey]) || 0;
                if (goal === 0) return null;
                return (
                  <ProgressCard
                    key={config.key}
                    icon={config.icon}
                    iconColor={config.color}
                    label={config.label}
                    emoji={config.emoji}
                    value={dailyData[config.key]}
                    goal={goal}
                    unit={config.unit}
                    delay={index * 80}
                  />
                );
              })}
              {stats.totalGoals === 0 && (
                <View style={styles.emptyState}>
                  <Icon name="target-off" size={48} color="#bdc3c7" />
                  <Text style={styles.emptyStateText}>
                    <Emoji name="target" /> Set your goals above to see your progress here <Emoji name="sparkles" />
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <LinearGradient
              colors={["#667eea15", "#667eea08"]}
              style={styles.infoIconContainer}
            >
              <Icon name="lightbulb-on" size={20} color="#667eea" />
            </LinearGradient>
            <Text style={styles.infoText}>
              <Emoji name="bulb" /> Tip: Update your profile for personalized goal recommendations
              based on your age, weight, and activity level! <Emoji name="target" />
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

/* =======================
   STYLES
======================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loaderText: {
    marginTop: 16,
    fontSize: 16,
    color: "#667eea",
    fontWeight: "600",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#667eea",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  sectionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#7f8c8d",
    marginTop: 2,
  },
  statsCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#667eea",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  statsGradient: {
    padding: 24,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  inputIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  inputLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2c3e50",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e8e8e8",
    borderRadius: 16,
    backgroundColor: "#fafafa",
    paddingHorizontal: 16,
    overflow: "hidden",
    transition: "all 0.3s",
  },
  inputWrapperFilled: {
    borderColor: "#667eea30",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 18,
    color: "#2c3e50",
    fontWeight: "700",
  },
  unitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 8,
  },
  unitText: {
    fontSize: 14,
    fontWeight: "700",
  },
  saveButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#667eea",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: "row",
    padding: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  progressSection: {
    gap: 16,
    paddingHorizontal: 16,
  },
  progressCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  progressInfo: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  percentageBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: "800",
  },
  progressBarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  progressBar: {
    marginTop: 0,
  },
  checkIcon: {
    position: "absolute",
    right: 0,
    top: -5,
  },
  remainingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  remainingText: {
    fontSize: 13,
    color: "#95a5a6",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 15,
    color: "#95a5a6",
    marginTop: 16,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    gap: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#667eea",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#5a6c7d",
    lineHeight: 20,
  },
});

export default GoalManagementScreen;