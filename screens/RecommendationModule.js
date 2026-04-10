import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Share,
  RefreshControl,
  Dimensions,
  Platform,
  AppState,
  StatusBar,
  PermissionsAndroid,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart, PieChart, LineChart } from "react-native-chart-kit";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import RNFS from 'react-native-fs';

const SCREEN_WIDTH = Dimensions.get("window").width - 40;
const LAST_REFRESH_KEY = "last_analytics_refresh";
const VEG_MODE_KEY = "veg_mode_preference";

// WHO / CDC guidelines
const GUIDELINES = {
  calories: { min: 1800, max: 2400, optimal: 2000 },
  protein: { min: 50, max: 70, optimal: 60 },
  carbs: { min: 225, max: 325, optimal: 275 },
  fats: { min: 44, max: 78, optimal: 60 },
};

// Enhanced Food database with better categorization and isVeg flag
const FOOD_DATABASE = {
  calories: [
    { name: "🥜 Peanut Butter", calories: 588, protein: 25, carbs: 20, fats: 50, serving: "100g", category: "nuts", isVeg: true },
    { name: "🌰 Almonds", calories: 579, protein: 21, carbs: 22, fats: 50, serving: "100g", category: "nuts", isVeg: true },
    { name: "🍫 Dark Chocolate", calories: 546, protein: 5, carbs: 61, fats: 31, serving: "100g", category: "sweets", isVeg: true },
    { name: "🥣 Granola", calories: 471, protein: 13, carbs: 64, fats: 20, serving: "100g", category: "grains", isVeg: true },
    { name: "🥜 Cashews", calories: 553, protein: 18, carbs: 30, fats: 44, serving: "100g", category: "nuts", isVeg: true },
    { name: "🌰 Walnuts", calories: 654, protein: 15, carbs: 14, fats: 65, serving: "100g", category: "nuts", isVeg: true },
    { name: "🥜 Pecans", calories: 691, protein: 9, carbs: 14, fats: 72, serving: "100g", category: "nuts", isVeg: true },
    { name: "🌰 Macadamia Nuts", calories: 718, protein: 8, carbs: 14, fats: 76, serving: "100g", category: "nuts", isVeg: true },
    { name: "🍯 Dried Dates", calories: 282, protein: 2, carbs: 75, fats: 0.4, serving: "100g", category: "fruits", isVeg: true },
    { name: "🍇 Raisins", calories: 299, protein: 3, carbs: 79, fats: 0.5, serving: "100g", category: "fruits", isVeg: true },
  ],
  protein: [
    { name: "🍗 Chicken Breast", calories: 165, protein: 31, carbs: 0, fats: 3.6, serving: "100g", category: "meat", isVeg: false },
    { name: "🥛 Greek Yogurt", calories: 97, protein: 10, carbs: 3.6, fats: 5, serving: "100g", category: "dairy", isVeg: true },
    { name: "🥚 Eggs", calories: 155, protein: 13, carbs: 1.1, fats: 11, serving: "2 large", category: "eggs", isVeg: true },
    { name: "🐟 Salmon", calories: 208, protein: 20, carbs: 0, fats: 13, serving: "100g", category: "fish", isVeg: false },
    { name: "🐟 Tuna", calories: 132, protein: 28, carbs: 0, fats: 1.3, serving: "100g", category: "fish", isVeg: false },
    { name: "🧀 Cottage Cheese", calories: 98, protein: 11, carbs: 3.4, fats: 4.3, serving: "100g", category: "dairy", isVeg: true },
    { name: "🥩 Lean Beef", calories: 250, protein: 26, carbs: 0, fats: 15, serving: "100g", category: "meat", isVeg: false },
    { name: "🦃 Turkey Breast", calories: 135, protein: 30, carbs: 0, fats: 0.7, serving: "100g", category: "meat", isVeg: false },
    { name: "🧈 Tofu", calories: 76, protein: 8, carbs: 1.9, fats: 4.8, serving: "100g", category: "plant", isVeg: true },
    { name: "🫘 Lentils", calories: 116, protein: 9, carbs: 20, fats: 0.4, serving: "100g cooked", category: "legumes", isVeg: true },
    { name: "🫘 Chickpeas", calories: 164, protein: 9, carbs: 27, fats: 2.6, serving: "100g cooked", category: "legumes", isVeg: true },
    { name: "🫘 Black Beans", calories: 132, protein: 9, carbs: 24, fats: 0.5, serving: "100g cooked", category: "legumes", isVeg: true },
    { name: "🥛 Paneer", calories: 265, protein: 18, carbs: 3.6, fats: 20, serving: "100g", category: "dairy", isVeg: true },
    { name: "🌱 Tempeh", calories: 193, protein: 19, carbs: 9, fats: 11, serving: "100g", category: "plant", isVeg: true },
    { name: "🥜 Peanuts", calories: 567, protein: 26, carbs: 16, fats: 49, serving: "100g", category: "nuts", isVeg: true },
  ],
  carbs: [
    { name: "🍚 Brown Rice", calories: 111, protein: 2.6, carbs: 23, fats: 0.9, serving: "100g cooked", category: "grains", isVeg: true },
    { name: "🥣 Oatmeal", calories: 71, protein: 2.5, carbs: 12, fats: 1.4, serving: "100g cooked", category: "grains", isVeg: true },
    { name: "🍠 Sweet Potato", calories: 86, protein: 1.6, carbs: 20, fats: 0.1, serving: "100g", category: "vegetables", isVeg: true },
    { name: "🍞 Whole Wheat Bread", calories: 247, protein: 13, carbs: 41, fats: 3.4, serving: "100g", category: "grains", isVeg: true },
    { name: "🍌 Banana", calories: 89, protein: 1.1, carbs: 23, fats: 0.3, serving: "1 medium", category: "fruits", isVeg: true },
    { name: "🍎 Apple", calories: 52, protein: 0.3, carbs: 14, fats: 0.2, serving: "1 medium", category: "fruits", isVeg: true },
    { name: "🌾 Quinoa", calories: 120, protein: 4.4, carbs: 21, fats: 1.9, serving: "100g cooked", category: "grains", isVeg: true },
    { name: "🍝 Pasta", calories: 131, protein: 5, carbs: 25, fats: 1.1, serving: "100g cooked", category: "grains", isVeg: true },
    { name: "🍚 White Rice", calories: 130, protein: 2.7, carbs: 28, fats: 0.3, serving: "100g cooked", category: "grains", isVeg: true },
    { name: "🥔 Potato", calories: 77, protein: 2, carbs: 17, fats: 0.1, serving: "100g", category: "vegetables", isVeg: true },
  ],
  fats: [
    { name: "🥑 Avocado", calories: 160, protein: 2, carbs: 9, fats: 15, serving: "100g", category: "fruits", isVeg: true },
    { name: "🫒 Olive Oil", calories: 884, protein: 0, carbs: 0, fats: 100, serving: "100ml", category: "oils", isVeg: true },
    { name: "🐟 Salmon", calories: 208, protein: 20, carbs: 0, fats: 13, serving: "100g", category: "fish", isVeg: false },
    { name: "🌰 Almonds", calories: 579, protein: 21, carbs: 22, fats: 50, serving: "100g", category: "nuts", isVeg: true },
    { name: "🌰 Walnuts", calories: 654, protein: 15, carbs: 14, fats: 65, serving: "100g", category: "nuts", isVeg: true },
    { name: "🧀 Cheese", calories: 402, protein: 25, carbs: 1.3, fats: 33, serving: "100g", category: "dairy", isVeg: true },
    { name: "🍫 Dark Chocolate", calories: 546, protein: 5, carbs: 61, fats: 31, serving: "100g", category: "sweets", isVeg: true },
    { name: "🥥 Coconut Oil", calories: 862, protein: 0, carbs: 0, fats: 100, serving: "100ml", category: "oils", isVeg: true },
    { name: "🥜 Peanut Butter", calories: 588, protein: 25, carbs: 20, fats: 50, serving: "100g", category: "nuts", isVeg: true },
    { name: "🌱 Chia Seeds", calories: 486, protein: 17, carbs: 42, fats: 31, serving: "100g", category: "seeds", isVeg: true },
    { name: "🌻 Sunflower Seeds", calories: 584, protein: 21, carbs: 20, fats: 51, serving: "100g", category: "seeds", isVeg: true },
    { name: "🥥 Coconut", calories: 354, protein: 3.3, carbs: 15, fats: 33, serving: "100g", category: "fruits", isVeg: true },
  ],
};

const NUTRIENT_CONFIG = {
  protein: {
    title: "💪 High Protein Foods",
    emoji: "💪",
    color: "#8B5CF6",
    gradient: ["#EDE9FE", "#DDD6FE"],
    icon: "food-drumstick",
    bgColor: "#F5F3FF",
  },
  carbs: {
    title: "🍞 High Carb Foods",
    emoji: "🍞",
    color: "#3B82F6",
    gradient: ["#DBEAFE", "#BFDBFE"],
    icon: "bread-slice",
    bgColor: "#EFF6FF",
  },
  fats: {
    title: "🥑 Healthy Fats",
    emoji: "🥑",
    color: "#F59E0B",
    gradient: ["#FEF3C7", "#FDE68A"],
    icon: "oil",
    bgColor: "#FFFBEB",
  },
  calories: {
    title: "🔥 High Calorie Foods",
    emoji: "🔥",
    color: "#EF4444",
    gradient: ["#FEE2E2", "#FECACA"],
    icon: "fire",
    bgColor: "#FEF2F2",
  },
};

const chartConfig = {
  backgroundGradientFrom: "#fff",
  backgroundGradientTo: "#fff",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 16 },
  propsForLabels: { 
    fontSize: 11,
    fill: "#000000",
    fontWeight: "500"
  },
  propsForBackgroundLines: {
    stroke: "#e3e3e3",
    strokeWidth: 1,
    strokeDasharray: "5,5"
  },
};

const gradientChartConfig = {
  ...chartConfig,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  strokeWidth: 3,
  fillShadowGradientFrom: "#818CF8",
  fillShadowGradientTo: "#FFFFFF",
  fillShadowGradientFromOpacity: 0.5,
  fillShadowGradientToOpacity: 0.1,
};

export default function AnalyticsModule() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState("weekly");
  const [vegMode, setVegMode] = useState(false);
  const [todayTotals, setTodayTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
  const [weeklyMeals, setWeeklyMeals] = useState([]);
  const [reportData, setReportData] = useState({
    weekly: { labels: [], datasets: [{ data: [] }] },
    monthly: { labels: [], datasets: [{ data: [] }] },
  });
  const [macroDistribution, setMacroDistribution] = useState([]);
  const [weeklyAverage, setWeeklyAverage] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });
  
  const [selectedNutrient, setSelectedNutrient] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  
  const appState = useRef(AppState.currentState);
  const checkIntervalRef = useRef(null);

  useEffect(() => {
    loadVegModePreference();
  }, []);

  const loadVegModePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem(VEG_MODE_KEY);
      if (saved !== null) {
        setVegMode(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading veg mode preference:", error);
    }
  };

  const toggleVegMode = async () => {
    try {
      const newValue = !vegMode;
      setVegMode(newValue);
      await AsyncStorage.setItem(VEG_MODE_KEY, JSON.stringify(newValue));
      
      Alert.alert(
        newValue ? "🌱 Veg Mode Enabled! 🎉" : "🍖 All Foods Mode Activated!",
        newValue 
          ? "✅ Now showing only vegetarian foods 🥦🥕🌽" 
          : "🍗 Now showing all foods including non-vegetarian 🥩🐟",
        [{ text: "👍 Got it!" }]
      );
    } catch (error) {
      console.error("Error saving veg mode preference:", error);
    }
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          return true;
        }
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: '📁 Storage Permission Required',
            message: '📱 This app needs storage access to save your nutrition reports',
            buttonNeutral: '⏰ Ask Me Later',
            buttonNegative: '❌ Cancel',
            buttonPositive: '✅ Grant Access',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const checkAndRefreshIfNewDay = async () => {
    try {
      const lastRefresh = await AsyncStorage.getItem(LAST_REFRESH_KEY);
      const today = new Date().toISOString().split("T")[0];
      
      if (lastRefresh !== today) {
        console.log("🌅 New day detected, refreshing analytics...");
        await AsyncStorage.setItem(LAST_REFRESH_KEY, today);
        await fetchAnalyticsData();
      }
    } catch (error) {
      console.error("❌ Error checking for new day:", error);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        checkAndRefreshIfNewDay();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    checkIntervalRef.current = setInterval(() => {
      if (AppState.currentState === "active") {
        checkAndRefreshIfNewDay();
      }
    }, 60 * 60 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const stored = await AsyncStorage.getItem("selectedFoods");
      const meals = stored ? JSON.parse(stored) : [];

      const today = new Date();
      const todayKey = today.toISOString().split("T")[0];

      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        last30Days.push(d.toISOString().split("T")[0]);
      }

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        last7Days.push(d.toISOString().split("T")[0]);
      }

      const dailyTotals = {};
      const dailyMeals = {};
      
      let todaySum = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      let weeklySum = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      let weeklyDays = 0;

      meals.forEach((meal) => {
        const dateKey =
          meal.dateKey ||
          (meal.timestamp
            ? new Date(meal.timestamp).toISOString().split("T")[0]
            : null);

        if (!dateKey) return;

        if (last30Days.includes(dateKey)) {
          if (!dailyTotals[dateKey]) {
            dailyTotals[dateKey] = { calories: 0, protein: 0, carbs: 0, fats: 0 };
          }

          dailyTotals[dateKey].calories += Number(meal.calories) || 0;
          dailyTotals[dateKey].protein += Number(meal.protein) || 0;
          dailyTotals[dateKey].carbs += Number(meal.carbs) || 0;
          dailyTotals[dateKey].fats += Number(meal.fats) || 0;

          if (dateKey === todayKey) {
            todaySum.calories += Number(meal.calories) || 0;
            todaySum.protein += Number(meal.protein) || 0;
            todaySum.carbs += Number(meal.carbs) || 0;
            todaySum.fats += Number(meal.fats) || 0;
          }

          if (last7Days.includes(dateKey)) {
            weeklySum.calories += Number(meal.calories) || 0;
            weeklySum.protein += Number(meal.protein) || 0;
            weeklySum.carbs += Number(meal.carbs) || 0;
            weeklySum.fats += Number(meal.fats) || 0;
          }
        }

        if (last7Days.includes(dateKey)) {
          if (!dailyMeals[dateKey]) {
            dailyMeals[dateKey] = [];
          }
          dailyMeals[dateKey].push(meal);
        }
      });

      last7Days.forEach(day => {
        if (dailyMeals[day] && dailyMeals[day].length > 0) {
          weeklyDays++;
        }
      });

      const avgDivisor = weeklyDays > 0 ? weeklyDays : 1;
      setWeeklyAverage({
        calories: Math.round(weeklySum.calories / avgDivisor),
        protein: Math.round(weeklySum.protein / avgDivisor),
        carbs: Math.round(weeklySum.carbs / avgDivisor),
        fats: Math.round(weeklySum.fats / avgDivisor),
      });

      setTodayTotals(todaySum);
      setWeeklyMeals(dailyMeals);

      const totalMacros = todaySum.protein + todaySum.carbs + todaySum.fats;
      if (totalMacros > 0) {
        setMacroDistribution([
          {
            name: "💪 Protein",
            amount: todaySum.protein,
            color: "#8B5CF6",
            legendFontColor: "#333",
            legendFontSize: 13,
          },
          {
            name: "🍞 Carbs",
            amount: todaySum.carbs,
            color: "#3B82F6",
            legendFontColor: "#333",
            legendFontSize: 13,
          },
          {
            name: "🥑 Fats",
            amount: todaySum.fats,
            color: "#F59E0B",
            legendFontColor: "#333",
            legendFontSize: 13,
          },
        ]);
      } else {
        setMacroDistribution([]);
      }

      const weeklyLabels = [];
      const weeklyCalories = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split("T")[0];
        weeklyLabels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
        weeklyCalories.push(dailyTotals[key]?.calories || 0);
      }

      const monthlyLabels = [];
      const monthlyCalories = [];
      last30Days.forEach((key, idx) => {
        monthlyLabels.push(idx % 5 === 0 ? key.split("-")[2] : "");
        monthlyCalories.push(dailyTotals[key]?.calories || 0);
      });

      setReportData({
        weekly: { labels: weeklyLabels, datasets: [{ data: weeklyCalories.length > 0 ? weeklyCalories : [0] }] },
        monthly: {
          labels: monthlyLabels,
          datasets: [{ data: monthlyCalories.length > 0 ? monthlyCalories : [0] }],
        },
      });

      await AsyncStorage.setItem(LAST_REFRESH_KEY, today.toISOString().split("T")[0]);
    } catch (e) {
      console.error(e);
      Alert.alert("❌ Error", "⚠️ Failed to load analytics data. Please try again!");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalyticsData();
  }, []);

  const getHealthStatus = (nutrient, value) => {
    const guide = GUIDELINES[nutrient];
    if (value < guide.min) return { status: "Low", color: "#F97316", icon: "alert-circle", emoji: "⚠️" };
    if (value > guide.max) return { status: "High", color: "#EF4444", icon: "alert", emoji: "🔴" };
    return { status: "Perfect", color: "#10B981", icon: "check-circle", emoji: "✅" };
  };

  const getTips = () => {
    const tips = [];
    if (todayTotals.calories < GUIDELINES.calories.min)
      tips.push({ icon: "alert", text: "⚡ Boost your calorie intake for more energy!", color: "#F97316" });
    else if (todayTotals.calories > GUIDELINES.calories.max)
      tips.push({ icon: "alert", text: "🍽️ Consider reducing portion sizes today", color: "#EF4444" });
    
    if (todayTotals.protein < GUIDELINES.protein.min)
      tips.push({ icon: "food-drumstick", text: "💪 Add lean protein to support muscle growth", color: "#F97316" });
    
    if (todayTotals.carbs < GUIDELINES.carbs.min)
      tips.push({ icon: "bread-slice", text: "🌾 Include whole grains for sustained energy", color: "#F97316" });
    
    if (todayTotals.fats < GUIDELINES.fats.min)
      tips.push({ icon: "oil", text: "🥑 Add healthy fats like nuts and avocado", color: "#F97316" });
    
    if (tips.length === 0)
      tips.push({ icon: "check-circle", text: "🎉 Excellent! Your nutrition is perfectly balanced!", color: "#10B981" });
    
    return tips;
  };

  const generateHTMLContent = () => {
    const today = new Date();
    const dateRange = `${new Date(today.setDate(today.getDate() - 6)).toLocaleDateString()} - ${new Date().toLocaleDateString()}`;

    let mealsHTML = "";
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(new Date().getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayMeals = weeklyMeals[key] || [];
      const dayName = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

      let dayTotal = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      let mealRows = "";

      if (dayMeals.length === 0) {
        mealRows = '<tr><td colspan="6" style="text-align: center; color: #999; padding: 20px; font-style: italic;">📭 No meals logged this day</td></tr>';
      } else {
        dayMeals.forEach((meal, idx) => {
          dayTotal.calories += Number(meal.calories) || 0;
          dayTotal.protein += Number(meal.protein) || 0;
          dayTotal.carbs += Number(meal.carbs) || 0;
          dayTotal.fats += Number(meal.fats) || 0;

          mealRows += `
            <tr>
              <td style="text-align: center; font-weight: 600; color: #6366F1;">${idx + 1}</td>
              <td style="font-weight: 500; color: #1F2937;">${meal.name || "🍽️ Unnamed Meal"}</td>
              <td style="text-align: center; color: #EF4444; font-weight: 600;">${Math.round(meal.calories || 0)}</td>
              <td style="text-align: center; color: #8B5CF6; font-weight: 600;">${Math.round(meal.protein || 0)}g</td>
              <td style="text-align: center; color: #3B82F6; font-weight: 500;">${Math.round(meal.carbs || 0)}g</td>
              <td style="text-align: center; color: #F59E0B; font-weight: 500;">${Math.round(meal.fats || 0)}g</td>
            </tr>
          `;
        });

        mealRows += `
          <tr style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); font-weight: bold; border-top: 3px solid #10B981;">
            <td colspan="2" style="text-align: right; padding-right: 20px; color: #065F46; font-size: 14px;">📊 Daily Total:</td>
            <td style="text-align: center; color: #DC2626; font-size: 15px;">${Math.round(dayTotal.calories)}</td>
            <td style="text-align: center; color: #7C3AED; font-size: 15px;">${Math.round(dayTotal.protein)}g</td>
            <td style="text-align: center; color: #2563EB; font-size: 15px;">${Math.round(dayTotal.carbs)}g</td>
            <td style="text-align: center; color: #D97706; font-size: 15px;">${Math.round(dayTotal.fats)}g</td>
          </tr>
        `;
      }

      mealsHTML += `
        <div class="day-section">
          <h3 style="color: #10B981; margin: 25px 0 15px 0; border-bottom: 3px solid #10B981; padding-bottom: 10px; display: flex; align-items: center; font-size: 18px;">
            <span style="margin-right: 10px;">📅</span> ${dayName}
          </h3>
          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">#️⃣</th>
                <th>🍽️ Food Item</th>
                <th style="width: 90px; text-align: center;">🔥 Calories</th>
                <th style="width: 90px; text-align: center;">💪 Protein</th>
                <th style="width: 90px; text-align: center;">🍞 Carbs</th>
                <th style="width: 90px; text-align: center;">🥑 Fats</th>
              </tr>
            </thead>
            <tbody>
              ${mealRows}
            </tbody>
          </table>
        </div>
      `;
    }

    const caloriesStatus = getHealthStatus("calories", todayTotals.calories);
    const proteinStatus = getHealthStatus("protein", todayTotals.protein);
    const carbsStatus = getHealthStatus("carbs", todayTotals.carbs);
    const fatsStatus = getHealthStatus("fats", todayTotals.fats);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            color: #1F2937;
            line-height: 1.6;
            background: linear-gradient(135deg, #F0FDF4 0%, #DBEAFE 100%);
          }
          .header {
            text-align: center;
            margin-bottom: 35px;
            background: linear-gradient(135deg, #10B981 0%, #3B82F6 100%);
            color: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
          }
          .header h1 {
            font-size: 36px;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 35px;
          }
          .summary-card {
            background: white;
            padding: 25px;
            border-radius: 16px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border-left: 5px solid #10B981;
          }
          .summary-card h3 {
            font-size: 13px;
            color: #6B7280;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
          }
          .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 8px;
          }
          .summary-card .status {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .status-perfect { background: #D1FAE5; color: #065F46; border: 2px solid #10B981; }
          .status-low { background: #FED7AA; color: #92400E; border: 2px solid #F97316; }
          .status-high { background: #FECACA; color: #991B1B; border: 2px solid #EF4444; }
          .weekly-avg {
            background: linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%);
            padding: 25px;
            border-radius: 16px;
            margin-bottom: 35px;
            border: 3px solid #8B5CF6;
          }
          .avg-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
          }
          .avg-item {
            text-align: center;
            padding: 12px;
            background: white;
            border-radius: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 12px;
            overflow: hidden;
          }
          thead {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white;
          }
          th {
            padding: 15px 12px;
            text-align: left;
            font-weight: 700;
          }
          td {
            padding: 14px 12px;
            border-bottom: 1px solid #E5E7EB;
          }
          .tips {
            background: #FEF3C7;
            padding: 25px;
            border-radius: 16px;
            margin-bottom: 35px;
            border-left: 5px solid #F59E0B;
          }
          @media print { body { background: white; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍎 Weekly Nutrition Report</h1>
          <p style="font-size: 18px; margin-top: 8px;">📊 ${dateRange}</p>
        </div>
        <div class="summary">
          <div class="summary-card">
            <h3>🔥 Today's Calories</h3>
            <div class="value">${Math.round(todayTotals.calories)}</div>
            <span class="status status-${caloriesStatus.status.toLowerCase()}">${caloriesStatus.emoji} ${caloriesStatus.status}</span>
          </div>
          <div class="summary-card">
            <h3>💪 Today's Protein</h3>
            <div class="value">${Math.round(todayTotals.protein)}g</div>
            <span class="status status-${proteinStatus.status.toLowerCase()}">${proteinStatus.emoji} ${proteinStatus.status}</span>
          </div>
          <div class="summary-card">
            <h3>🍞 Today's Carbs</h3>
            <div class="value">${Math.round(todayTotals.carbs)}g</div>
            <span class="status status-${carbsStatus.status.toLowerCase()}">${carbsStatus.emoji} ${carbsStatus.status}</span>
          </div>
          <div class="summary-card">
            <h3>🥑 Today's Fats</h3>
            <div class="value">${Math.round(todayTotals.fats)}g</div>
            <span class="status status-${fatsStatus.status.toLowerCase()}">${fatsStatus.emoji} ${fatsStatus.status}</span>
          </div>
        </div>
        <div class="weekly-avg">
          <h3>📊 Weekly Average</h3>
          <div class="avg-grid">
            <div class="avg-item">
              <div>🔥 Calories</div>
              <div style="font-size: 20px; font-weight: bold;">${weeklyAverage.calories}</div>
            </div>
            <div class="avg-item">
              <div>💪 Protein</div>
              <div style="font-size: 20px; font-weight: bold;">${weeklyAverage.protein}g</div>
            </div>
            <div class="avg-item">
              <div>🍞 Carbs</div>
              <div style="font-size: 20px; font-weight: bold;">${weeklyAverage.carbs}g</div>
            </div>
            <div class="avg-item">
              <div>🥑 Fats</div>
              <div style="font-size: 20px; font-weight: bold;">${weeklyAverage.fats}g</div>
            </div>
          </div>
        </div>
        <div class="tips">
          <h3>💡 Recommendations</h3>
          <ul>${getTips().map(tip => `<li>${tip.text}</li>`).join("")}</ul>
        </div>
        ${mealsHTML}
      </body>
      </html>
    `;
  };

  const exportAsPDF = async () => {
    try {
      setExporting(true);

      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert("❌ Permission Denied", "📁 Storage permission is required to export your report");
        setExporting(false);
        return;
      }

      const htmlContent = generateHTMLContent();
      const fileName = `Nutrition_Report_${new Date().toISOString().split("T")[0]}.html`;
      
      let filePath;
      if (Platform.OS === 'android') {
        filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      } else {
        filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      }

      await RNFS.writeFile(filePath, htmlContent, 'utf8');

      Alert.alert(
        "✅ 🎉 Export Successful!",
        `📄 Your nutrition report has been saved!\n\n📁 Location: ${Platform.OS === 'android' ? '📂 Downloads' : '📂 Documents'} folder\n📝 File: ${fileName}`,
        [
          { text: "👍 Great!" },
          {
            text: "📤 Share Now 🚀",
            onPress: async () => {
              try {
                await Share.share({
                  url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
                  title: '📊 My Nutrition Report',
                  message: '🍎 Check out my weekly nutrition summary!',
                });
              } catch (shareError) {
                console.error('❌ Share error:', shareError);
              }
            },
          },
        ]
      );

    } catch (error) {
      console.error('❌ Export error:', error);
      Alert.alert(
        "❌ Export Failed", 
        `⚠️ Unable to save your report.\n\n🔧 Error: ${error.message}\n\n💡 Please check storage permissions in Settings.`
      );
    } finally {
      setExporting(false);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        message:
          `📊 My Nutrition Summary - ${new Date().toLocaleDateString()}\n\n` +
          `🔥 Calories: ${Math.round(todayTotals.calories)} kcal\n` +
          `💪 Protein: ${Math.round(todayTotals.protein)}g\n` +
          `🍞 Carbs: ${Math.round(todayTotals.carbs)}g\n` +
          `🥑 Fats: ${Math.round(todayTotals.fats)}g\n\n` +
          `📈 Status: ${getTips()[0].text}\n\n` +
          `📊 7-Day Average:\n` +
          `🔥 ${weeklyAverage.calories} kcal | 💪 ${weeklyAverage.protein}g | 🍞 ${weeklyAverage.carbs}g | 🥑 ${weeklyAverage.fats}g\n\n` +
          `✨ Keep up the great work! 💪🎉`,
      });
    } catch (e) {
      Alert.alert("❌ Share Error", e.message);
    }
  };

  const handleNutrientSelect = (nutrient) => {
    setSelectedNutrient(nutrient);
    setSearchQuery("");
    setSelectedFood(null);
    setCurrentView("nutrientBrowser");
  };

  const handleBack = () => {
    if (selectedFood) {
      setSelectedFood(null);
      setCurrentView("nutrientBrowser");
    } else if (selectedNutrient) {
      setSelectedNutrient(null);
      setCurrentView("dashboard");
    } else if (currentView === "analytics") {
      setCurrentView("dashboard");
    }
  };

  const handleAddFood = async (food) => {
    try {
      const newMeal = {
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        timestamp: new Date().toISOString(),
        dateKey: new Date().toISOString().split("T")[0],
      };

      const stored = await AsyncStorage.getItem("selectedFoods");
      const meals = stored ? JSON.parse(stored) : [];
      meals.push(newMeal);
      await AsyncStorage.setItem("selectedFoods", JSON.stringify(meals));

      Alert.alert(
        "✅ 🎉 Added Successfully!",
        `🍽️ ${food.name} added to your meals!\n\n📊 Your nutrition totals have been updated. 🚀`,
        [
          { text: "🔍 Keep Browsing", style: "cancel" },
          { 
            text: "📊 View Dashboard 🏠", 
            onPress: () => {
              setSelectedFood(null);
              setSelectedNutrient(null);
              setCurrentView("dashboard");
              fetchAnalyticsData();
            }
          },
        ]
      );
    } catch (error) {
      Alert.alert("❌ Error", "⚠️ Unable to add food item. Please try again.");
      console.error(error);
    }
  };

  const getFilteredFoods = () => {
    if (!selectedNutrient) return [];
    
    let foods = FOOD_DATABASE[selectedNutrient] || [];
    
    if (vegMode) {
      foods = foods.filter(food => food.isVeg === true);
    }
    
    if (searchQuery) {
      foods = foods.filter(food =>
        food.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return foods;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>⏳ Loading your nutrition data... 📊</Text>
          <Text style={styles.loadingSubtext}>🥗 Crunching those macros! 💪</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Food Detail Screen
  if (selectedFood) {
    const config = NUTRIENT_CONFIG[selectedNutrient];
    
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#1F2937" />
            <Text style={styles.backButtonText}>⬅️</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🔍 Food Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={[styles.detailCard, { borderTopColor: config.color, backgroundColor: config.bgColor }]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailEmoji}>{selectedFood.name.split(' ')[0]}</Text>
              <View style={styles.detailHeaderText}>
                <Text style={styles.detailName}>{selectedFood.name}</Text>
                <Text style={styles.detailServing}>📏 Serving size: {selectedFood.serving}</Text>
                {selectedFood.isVeg && (
                  <View style={styles.vegBadge}>
                    <Text style={styles.vegBadgeText}>🌱 Vegetarian Friendly</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Nutrition Facts Box */}
            <View style={styles.nutritionFactsBox}>
              <Text style={styles.nutritionFactsTitle}>📋 Nutrition Facts</Text>
              <View style={styles.macroDetailGrid}>
                <View style={[styles.macroDetailCard, { backgroundColor: "#FEE2E2", borderColor: "#EF4444" }]}>
                  <Text style={styles.macroDetailEmoji}>🔥</Text>
                  <Text style={styles.macroDetailLabel}>Calories</Text>
                  <Text style={[styles.macroDetailValue, { color: "#EF4444" }]}>
                    {selectedFood.calories}
                  </Text>
                  <Text style={styles.macroDetailUnit}>kcal</Text>
                </View>

                <View style={[styles.macroDetailCard, { backgroundColor: "#EDE9FE", borderColor: "#8B5CF6" }]}>
                  <Text style={styles.macroDetailEmoji}>💪</Text>
                  <Text style={styles.macroDetailLabel}>Protein</Text>
                  <Text style={[styles.macroDetailValue, { color: "#8B5CF6" }]}>
                    {selectedFood.protein}
                  </Text>
                  <Text style={styles.macroDetailUnit}>grams</Text>
                </View>

                <View style={[styles.macroDetailCard, { backgroundColor: "#DBEAFE", borderColor: "#3B82F6" }]}>
                  <Text style={styles.macroDetailEmoji}>🍞</Text>
                  <Text style={styles.macroDetailLabel}>Carbs</Text>
                  <Text style={[styles.macroDetailValue, { color: "#3B82F6" }]}>
                    {selectedFood.carbs}
                  </Text>
                  <Text style={styles.macroDetailUnit}>grams</Text>
                </View>

                <View style={[styles.macroDetailCard, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
                  <Text style={styles.macroDetailEmoji}>🥑</Text>
                  <Text style={styles.macroDetailLabel}>Fats</Text>
                  <Text style={[styles.macroDetailValue, { color: "#F59E0B" }]}>
                    {selectedFood.fats}
                  </Text>
                  <Text style={styles.macroDetailUnit}>grams</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: config.color }]}
              onPress={() => handleAddFood(selectedFood)}
            >
              <Icon name="plus-circle" size={24} color="#fff" />
              <Text style={styles.addButtonText}>✨ Add to My Meals 🍽️</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Food List Screen
  if (currentView === "nutrientBrowser" && selectedNutrient) {
    const config = NUTRIENT_CONFIG[selectedNutrient];
    const filteredFoods = getFilteredFoods();

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{config.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Veg Mode Toggle */}
        <TouchableOpacity 
          style={styles.vegModeContainer}
          onPress={toggleVegMode}
          activeOpacity={0.7}
        >
          <View style={styles.vegModeLeft}>
            <Text style={styles.vegModeEmoji}>🌱</Text>
            <View>
              <Text style={styles.vegModeTitle}>🥬 Vegetarian Mode</Text>
              <Text style={styles.vegModeSubtitle}>
                {vegMode ? "✅ Only showing 🌿 veg foods" : "🍖 Showing all foods"}
              </Text>
            </View>
          </View>
          <View style={[styles.emojiToggle, { backgroundColor: vegMode ? "#D1FAE5" : "#FEE2E2" }]}>
            <Text style={styles.emojiToggleIcon}>{vegMode ? "🌱" : "🍖"}</Text>
          </View>
        </TouchableOpacity>

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchPrefixEmoji}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for foods... 🥗"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchEmoji}>❌</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={[styles.infoBar, { backgroundColor: config.bgColor }]}>
            <Text style={[styles.infoText, { color: config.color }]}>
              🍽️ Found {filteredFoods.length} food{filteredFoods.length !== 1 ? 's' : ''}
              {vegMode ? " 🌱 (Veg only)" : " 🍴 (All types)"}
            </Text>
          </View>

          {filteredFoods.map((food, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.foodCard, { borderLeftColor: config.color }]}
              onPress={() => setSelectedFood(food)}
              activeOpacity={0.7}
            >
              <View style={styles.foodCardHeader}>
                <View style={styles.foodCardLeft}>
                  <Text style={styles.foodEmoji}>{food.name.split(' ')[0]}</Text>
                  <View>
                    <View style={styles.foodNameRow}>
                      <Text style={styles.foodName}>{food.name}</Text>
                      {food.isVeg && (
                        <View style={styles.vegIndicator}>
                          <Text style={styles.vegIndicatorText}>🌱</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.foodServing}>📏 {food.serving}</Text>
                  </View>
                </View>
                <View style={[styles.primaryNutrientBadge, { backgroundColor: config.color }]}>
                  <Text style={styles.primaryNutrientValue}>
                    {food[selectedNutrient]}{selectedNutrient === "calories" ? " 🔥" : "g"}
                  </Text>
                </View>
              </View>

              <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>🔥</Text>
                  <Text style={styles.macroValue}>{food.calories}</Text>
                  <Text style={styles.macroUnit}>kcal</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>💪</Text>
                  <Text style={styles.macroValue}>{food.protein}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>🍞</Text>
                  <Text style={styles.macroValue}>{food.carbs}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroLabel}>🥑</Text>
                  <Text style={styles.macroValue}>{food.fats}g</Text>
                </View>
              </View>

              <View style={styles.foodCardActions}>
                <TouchableOpacity
                  style={[styles.quickAddButton, { backgroundColor: config.bgColor, borderColor: config.color }]}
                  onPress={() => handleAddFood(food)}
                >
                  <Text style={styles.quickAddEmoji}>➕</Text>
                  <Text style={[styles.quickAddText, { color: config.color }]}>⚡ Quick Add to Meals</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailsButton, { backgroundColor: config.color }]}
                  onPress={() => setSelectedFood(food)}
                >
                  <Text style={styles.detailsButtonText}>🔍</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          {filteredFoods.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{vegMode ? "🥬" : "🔍"}</Text>
              <Text style={styles.emptyText}>
                {vegMode ? "🌱 No vegetarian foods found" : "😕 No foods found"}
              </Text>
              <Text style={styles.emptySubtext}>
                {vegMode 
                  ? "🔄 Try turning off veg mode or searching differently" 
                  : "🔤 Try a different search term"}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Dashboard Screen
  if (currentView === "dashboard") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={["#10B981"]}
              tintColor="#10B981"
            />
          }
        >
          {/* Header */}
          <View style={styles.dashboardHeader}>
            <View>
              <Text style={styles.dashboardTitle}>🍎 Nutrition Dashboard</Text>
              <Text style={styles.dashboardSubtitle}>📊 Track your daily macro intake 💪</Text>
            </View>
            <TouchableOpacity 
              onPress={onRefresh}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshEmoji}>🔄</Text>
            </TouchableOpacity>
          </View>

          {/* Veg Mode Toggle on Dashboard */}
          <TouchableOpacity 
            style={styles.vegModeContainer}
            onPress={toggleVegMode}
            activeOpacity={0.7}
          >
            <View style={styles.vegModeLeft}>
              <Text style={styles.vegModeEmoji}>🌱</Text>
              <View>
                <Text style={styles.vegModeTitle}>🥗 Vegetarian Mode</Text>
                <Text style={styles.vegModeSubtitle}>
                  {vegMode ? "✅ Only showing 🌿 veg foods" : "🍖 Showing all foods"}
                </Text>
              </View>
            </View>
            <View style={[styles.emojiToggle, { backgroundColor: vegMode ? "#D1FAE5" : "#FEE2E2" }]}>
              <Text style={styles.emojiToggleIcon}>{vegMode ? "🌱" : "🍖"}</Text>
            </View>
          </TouchableOpacity>

          {/* Total Macros Display */}
          <View style={styles.totalMacrosContainer}>
            <View style={styles.totalMacrosCard}>
              <View style={styles.totalMacrosHeader}>
                <Text style={styles.totalMacrosEmoji}>📊</Text>
                <Text style={styles.totalMacrosTitle}>📈 Today's Total Intake</Text>
              </View>

              <View style={styles.macrosSummaryGrid}>
                <View style={[styles.macroSummaryItem, { borderColor: "#EF4444" }]}>
                  <Text style={styles.macroSummaryEmoji}>🔥</Text>
                  <Text style={styles.macroSummaryLabel}>Calories</Text>
                  <Text style={[styles.macroSummaryValue, { color: "#EF4444" }]}>
                    {Math.round(todayTotals.calories)}
                  </Text>
                  <Text style={styles.macroSummaryTarget}>
                    🎯 Goal: {GUIDELINES.calories.optimal}
                  </Text>
                </View>

                <View style={[styles.macroSummaryItem, { borderColor: "#8B5CF6" }]}>
                  <Text style={styles.macroSummaryEmoji}>💪</Text>
                  <Text style={styles.macroSummaryLabel}>Protein</Text>
                  <Text style={[styles.macroSummaryValue, { color: "#8B5CF6" }]}>
                    {Math.round(todayTotals.protein)}g
                  </Text>
                  <Text style={styles.macroSummaryTarget}>
                    🎯 Goal: {GUIDELINES.protein.optimal}g
                  </Text>
                </View>

                <View style={[styles.macroSummaryItem, { borderColor: "#3B82F6" }]}>
                  <Text style={styles.macroSummaryEmoji}>🍞</Text>
                  <Text style={styles.macroSummaryLabel}>Carbs</Text>
                  <Text style={[styles.macroSummaryValue, { color: "#3B82F6" }]}>
                    {Math.round(todayTotals.carbs)}g
                  </Text>
                  <Text style={styles.macroSummaryTarget}>
                    🎯 Goal: {GUIDELINES.carbs.optimal}g
                  </Text>
                </View>

                <View style={[styles.macroSummaryItem, { borderColor: "#F59E0B" }]}>
                  <Text style={styles.macroSummaryEmoji}>🥑</Text>
                  <Text style={styles.macroSummaryLabel}>Fats</Text>
                  <Text style={[styles.macroSummaryValue, { color: "#F59E0B" }]}>
                    {Math.round(todayTotals.fats)}g
                  </Text>
                  <Text style={styles.macroSummaryTarget}>
                    🎯 Goal: {GUIDELINES.fats.optimal}g
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Browse Foods Section */}
          <View style={styles.browseFoodsSection}>
            <Text style={styles.browseSectionTitle}>🍽️ Browse Foods by Nutrient</Text>
            <Text style={styles.browseSectionSubtitle}>
              🌟 Discover foods rich in specific macros {vegMode ? "🌱 (Veg Mode ON)" : "🍴 (All Foods)"}
            </Text>

            <View style={styles.nutrientButtonsGrid}>
              {Object.keys(NUTRIENT_CONFIG).map((nutrient) => {
                const config = NUTRIENT_CONFIG[nutrient];
                return (
                  <TouchableOpacity
                    key={nutrient}
                    style={[
                      styles.nutrientBrowseButton,
                      { 
                        backgroundColor: config.gradient[0],
                        borderColor: config.color 
                      }
                    ]}
                    onPress={() => handleNutrientSelect(nutrient)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.nutrientBrowseIconContainer, { backgroundColor: config.color }]}>
                      <Text style={styles.nutrientBrowseEmoji}>{config.emoji}</Text>
                    </View>
                    <Text style={[styles.nutrientBrowseName, { color: config.color }]}>
                      {config.title}
                    </Text>
                    <Text style={styles.nutrientBrowseArrow}>▶️</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* View Analytics Button */}
          <TouchableOpacity
            style={styles.viewAnalyticsButton}
            onPress={() => setCurrentView("analytics")}
          >
            <Text style={styles.viewAnalyticsEmoji}>📊</Text>
            <Text style={styles.viewAnalyticsText}>📈 View Detailed Analytics</Text>
            <Text style={styles.viewAnalyticsArrow}>➡️</Text>
          </TouchableOpacity>

          {/* Quick Tips */}
          <View style={styles.quickTipsCard}>
            <View style={styles.quickTipsHeader}>
              <Text style={styles.quickTipsHeaderEmoji}>💡</Text>
              <Text style={styles.quickTipsTitle}>✨ Personalized Tips</Text>
            </View>
            {getTips().slice(0, 2).map((tip, i) => (
              <View key={i} style={styles.quickTipItem}>
                <View style={[styles.quickTipIcon, { backgroundColor: tip.color + '20' }]}>
                  <Icon name={tip.icon} size={20} color={tip.color} />
                </View>
                <Text style={[styles.quickTipText, { color: tip.color }]}>{tip.text}</Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.dashboardFooter}>
            <Text style={styles.footerText}>
              💡 Pull down to refresh 🔄 • 🌙 Auto-updates at midnight ✨
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Analytics Screen
  const chartData = selectedPeriod === "weekly" ? reportData.weekly : reportData.monthly;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 Detailed Analytics</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={["#10B981"]}
            tintColor="#10B981"
          />
        }
      >
        {/* TODAY'S NUTRITION SUMMARY */}
        <Text style={styles.sectionTitle}>📊 Today's Nutrition Status</Text>
        <View style={styles.summaryGrid}>
          {[
            { key: "calories", label: "🔥 Calories", unit: "", icon: "fire", gradient: ["#EF4444", "#DC2626"] },
            { key: "protein", label: "💪 Protein", unit: "g", icon: "food-drumstick", gradient: ["#8B5CF6", "#7C3AED"] },
            { key: "carbs", label: "🍞 Carbs", unit: "g", icon: "bread-slice", gradient: ["#3B82F6", "#2563EB"] },
            { key: "fats", label: "🥑 Fats", unit: "g", icon: "oil", gradient: ["#F59E0B", "#D97706"] },
          ].map((item) => {
            const status = getHealthStatus(item.key, todayTotals[item.key]);
            return (
              <View key={item.key} style={[styles.summaryCard, { borderLeftColor: item.gradient[0] }]}>
                <Text style={styles.cardEmoji}>{item.label.split(' ')[0]}</Text>
                <Text style={styles.summaryLabel}>{item.label.split(' ')[1]}</Text>
                <Text style={[styles.summaryValue, { color: item.gradient[0] }]}>
                  {Math.round(todayTotals[item.key])}
                  <Text style={styles.unit}>{item.unit}</Text>
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                  <Text style={styles.statusEmoji}>{status.emoji}</Text>
                  <Text style={styles.statusText}>{status.status}</Text>
                </View>
                <Text style={styles.targetText}>
                  🎯 Target: {GUIDELINES[item.key].optimal}{item.unit}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Weekly Average Card */}
        <View style={styles.weeklyAvgCard}>
          <View style={styles.weeklyAvgHeader}>
            <Text style={styles.weeklyAvgEmoji}>📈</Text>
            <Text style={styles.weeklyAvgTitle}>📊 7-Day Average</Text>
          </View>
          <View style={styles.avgGrid}>
            <View style={styles.avgItem}>
              <Text style={styles.avgEmoji}>🔥</Text>
              <Text style={styles.avgLabel}>Calories</Text>
              <Text style={styles.avgValue}>{weeklyAverage.calories}</Text>
            </View>
            <View style={styles.avgItem}>
              <Text style={styles.avgEmoji}>💪</Text>
              <Text style={styles.avgLabel}>Protein</Text>
              <Text style={styles.avgValue}>{weeklyAverage.protein}g</Text>
            </View>
            <View style={styles.avgItem}>
              <Text style={styles.avgEmoji}>🍞</Text>
              <Text style={styles.avgLabel}>Carbs</Text>
              <Text style={styles.avgValue}>{weeklyAverage.carbs}g</Text>
            </View>
            <View style={styles.avgItem}>
              <Text style={styles.avgEmoji}>🥑</Text>
              <Text style={styles.avgLabel}>Fats</Text>
              <Text style={styles.avgValue}>{weeklyAverage.fats}g</Text>
            </View>
          </View>
        </View>

        {/* Period Toggle */}
        <View style={styles.switchRow}>
          {[
            { key: "weekly", label: "📅 7 Days", emoji: "📅" },
            { key: "monthly", label: "📆 30 Days", emoji: "📆" }
          ].map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.switchBtn,
                selectedPeriod === period.key && styles.switchActive,
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text style={styles.switchEmoji}>{period.emoji}</Text>
              <Text
                style={
                  selectedPeriod === period.key
                    ? styles.switchTextActive
                    : styles.switchText
                }
              >
                {period.label.split(' ')[1]} {period.label.split(' ')[2]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calorie Chart */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartEmoji}>📊</Text>
            <Text style={styles.chartTitle}>📈 Calorie Intake Trends</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            persistentScrollbar={true}
            style={styles.chartScrollView}
          >
            <LineChart
              data={chartData}
              width={Math.max(SCREEN_WIDTH, chartData.labels.length * 70)}
              height={250}
              fromZero
              chartConfig={gradientChartConfig}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLines={false}
              withHorizontalLines={true}
              withDots={true}
              withShadow={true}
              withVerticalLabels={true}
              withHorizontalLabels={true}
            />
          </ScrollView>
          <Text style={styles.chartHint}>
            👆 Swipe left/right to explore {selectedPeriod === "weekly" ? "7 📅" : "30 📆"} days
          </Text>
        </View>

        {/* Macro Distribution */}
        {macroDistribution.length > 0 && (
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartEmoji}>🥧</Text>
              <Text style={styles.chartTitle}>🍰 Macro Distribution Today</Text>
            </View>
            <PieChart
              data={macroDistribution}
              width={SCREEN_WIDTH}
              height={220}
              chartConfig={chartConfig}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
              style={styles.chart}
              hasLegend={true}
            />
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipBox}>
          <View style={styles.tipHeader}>
            <Text style={styles.tipHeaderEmoji}>💡</Text>
            <Text style={styles.tipTitle}>✨ Smart Recommendations</Text>
          </View>
          {getTips().map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <View style={[styles.tipIconContainer, { backgroundColor: tip.color + '20' }]}>
                <Icon name={tip.icon} size={20} color={tip.color} />
              </View>
              <Text style={[styles.tip, { color: tip.color }]}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.pdfBtn]}
            onPress={exportAsPDF}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.btnText}>⏳ Exporting...</Text>
              </>
            ) : (
              <>
                <Text style={styles.btnEmoji}>📄</Text>
                <Text style={styles.btnText}>📥 Export Report</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn]}
            onPress={onShare}
          >
            <Text style={styles.btnEmoji}>📤</Text>
            <Text style={styles.btnText}>🚀 Share Summary</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Pull down to refresh 🔄 • 🌙 Auto-updates daily ✨
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F9FAFB" 
  },
  centered: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingSubtext: {
    marginTop: 8,
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  
  // Veg Mode Toggle styles
  vegModeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  vegModeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  vegModeEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  vegModeTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F2937",
  },
  vegModeSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  emojiToggle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: "#fff",
  },
  emojiToggleIcon: {
    fontSize: 32,
  },
  
  // Veg indicator on food cards
  vegIndicator: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  vegIndicatorText: {
    fontSize: 12,
  },
  foodNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  
  // Veg badge on detail screen
  vegBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: "#10B981",
  },
  vegBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
  },
  
  // Dashboard styles
  dashboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  dashboardTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  dashboardSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 6,
    fontWeight: "500",
  },
  refreshButton: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#D1FAE5",
    elevation: 2,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshEmoji: {
    fontSize: 28,
  },
  totalMacrosContainer: {
    marginBottom: 24,
  },
  totalMacrosCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  totalMacrosHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  totalMacrosEmoji: {
    fontSize: 30,
    marginRight: 12,
  },
  totalMacrosTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
  },
  macrosSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  macroSummaryItem: {
    width: "48%",
    backgroundColor: "#F9FAFB",
    padding: 20,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 2.5,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  macroSummaryEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  macroSummaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  macroSummaryValue: {
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 6,
  },
  macroSummaryTarget: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  browseFoodsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  browseSectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 8,
  },
  browseSectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    fontWeight: "500",
  },
  nutrientButtonsGrid: {
    gap: 14,
  },
  nutrientBrowseButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 18,
    borderWidth: 2.5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  nutrientBrowseIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  nutrientBrowseEmoji: {
    fontSize: 26,
  },
  nutrientBrowseName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
  },
  nutrientBrowseArrow: {
    fontSize: 22,
  },
  viewAnalyticsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
    elevation: 5,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  viewAnalyticsEmoji: {
    fontSize: 26,
    marginRight: 8,
  },
  viewAnalyticsText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    marginRight: 8,
  },
  viewAnalyticsArrow: {
    fontSize: 22,
  },
  quickTipsCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: "#F59E0B",
    elevation: 3,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  quickTipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  quickTipsHeaderEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  quickTipsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#92400E",
  },
  quickTipItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  quickTipIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  quickTipText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  dashboardFooter: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  
  // Food Browser Screens
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  backButtonText: {
    fontSize: 18,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1F2937",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  searchPrefixEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchEmoji: {
    fontSize: 18,
  },
  infoBar: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  foodCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
    borderLeftWidth: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  foodCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  foodCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  foodEmoji: {
    fontSize: 40,
    marginRight: 14,
  },
  foodName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
  },
  foodServing: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    fontWeight: "600",
  },
  primaryNutrientBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  primaryNutrientValue: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 14,
  },
  macroItem: {
    alignItems: "center",
  },
  macroLabel: {
    fontSize: 20,
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563",
  },
  macroUnit: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  foodCardActions: {
    flexDirection: "row",
    gap: 10,
  },
  quickAddButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1.5,
  },
  quickAddEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  quickAddText: {
    fontWeight: "800",
    fontSize: 14,
  },
  detailsButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  detailsButtonText: {
    fontSize: 22,
  },

  // Food Detail styles
  nutritionFactsBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nutritionFactsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 14,
    textAlign: "center",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 26,
    borderTopWidth: 6,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
  },
  detailEmoji: {
    fontSize: 64,
    marginRight: 18,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailName: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1F2937",
  },
  detailServing: {
    fontSize: 15,
    color: "#9CA3AF",
    marginTop: 6,
    fontWeight: "600",
  },
  macroDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  macroDetailCard: {
    width: "48%",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 2,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  macroDetailEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  macroDetailLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  macroDetailValue: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 4,
  },
  macroDetailUnit: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 18,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginLeft: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4B5563",
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "600",
    textAlign: "center",
  },
  
  // Analytics page styles
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    borderLeftWidth: 5,
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 10,
  },
  unit: {
    fontSize: 20,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 10,
  },
  statusEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  targetText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  weeklyAvgCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: "#F59E0B",
    elevation: 3,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  weeklyAvgHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  weeklyAvgEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  weeklyAvgTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#92400E",
  },
  avgGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  avgItem: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginHorizontal: 5,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avgEmoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  avgLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  avgValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#92400E",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    padding: 5,
  },
  switchBtn: {
    flex: 1,
    flexDirection: "row",
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  switchActive: {
    backgroundColor: "#10B981",
    elevation: 4,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  switchText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 8,
  },
  switchEmoji: {
    fontSize: 20,
  },
  switchTextActive: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    marginLeft: 8,
  },
  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  chartEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
  },
  chartScrollView: {
    marginBottom: 14,
  },
  chart: {
    borderRadius: 16,
  },
  chartHint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 10,
    fontWeight: "600",
  },
  tipBox: {
    backgroundColor: "#ECFDF5",
    padding: 22,
    borderRadius: 20,
    marginBottom: 24,
    borderLeftWidth: 5,
    borderLeftColor: "#10B981",
    elevation: 3,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  tipHeaderEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#065F46",
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  tip: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  pdfBtn: {
    backgroundColor: "#EF4444",
  },
  shareBtn: {
    backgroundColor: "#3B82F6",
  },
  btnEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  btnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  footer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "500",
  },
});