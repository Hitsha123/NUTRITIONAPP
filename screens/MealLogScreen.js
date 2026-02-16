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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { debounce } from "lodash";

// ===== CONSTANTS =====
const { width } = Dimensions.get("window");

const NUTRIENT_IDS = {
  CALORIES: 1008,
  PROTEIN: 1003,
  CARBS: 1005,
  FATS: 1004,
  FIBER: 1079,
  SODIUM: 1093,
};

const API_CONFIG = {
  KEY: "J7tDs0cUGkWOtNmOKtNLYIewxQOnOmYDhvf8R3hy",
  SEARCH_URL: "https://api.nal.usda.gov/fdc/v1/foods/search",
  DETAILS_URL: "https://api.nal.usda.gov/fdc/v1/food",
  TIMEOUT: 10000,
};

const STORAGE_KEYS = {
  FOODS: "selectedFoods",
  WATER: "waterIntake",
  SUPPLEMENTS: "supplements",
  RECIPES: "savedRecipes",
  NUTRITION_GOALS: "nutritionGoals",
  HISTORY: "mealHistory",
};

const DEFAULT_GOALS = {
  calorieGoal: 2000,
  proteinGoal: 150,
  waterGoal: 2500,
  carbsGoal: 250,
  fatsGoal: 65,
};

const COLORS = {
  primary: "#3B82F6",
  secondary: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  purple: "#8B5CF6",
  dark: "#0F172A",
  gray: "#64748B",
  lightGray: "#94A3B8",
  background: "#F8FAFC",
  white: "#FFFFFF",
  border: "#E2E8F0",
};

// ===== UTILITY FUNCTIONS =====
const formatNumber = (num) => (isNaN(num) ? "0" : parseFloat(num).toFixed(1));
const getCurrentDate = () => new Date().toISOString().split("T")[0];

const fetchWithTimeout = async (url, options = {}, timeout = API_CONFIG.TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// ===== STORAGE SERVICE =====
const StorageService = {
  async saveData(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      return false;
    }
  },

  async getData(key, defaultValue = null) {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      return defaultValue;
    }
  },

  async saveHistory(foods, date) {
    try {
      const history = await this.getData(STORAGE_KEYS.HISTORY, {});
      history[date] = foods;
      await this.saveData(STORAGE_KEYS.HISTORY, history);
      return true;
    } catch (error) {
      console.error("Error saving history:", error);
      return false;
    }
  },

  async getHistory(date) {
    try {
      const history = await this.getData(STORAGE_KEYS.HISTORY, {});
      return history[date] || [];
    } catch (error) {
      console.error("Error loading history:", error);
      return [];
    }
  },
};

// ===== API SERVICE =====
const FoodAPIService = {
  async searchFoods(query, pageSize = 20) {
    if (!query || query.length < 2) {
      return { success: false, data: [], error: "Query too short" };
    }

    try {
      const url = `${API_CONFIG.SEARCH_URL}?query=${encodeURIComponent(query)}&api_key=${API_CONFIG.KEY}&pageSize=${pageSize}`;
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return { success: true, data: data.foods || [], error: null };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: error.name === "AbortError" ? "Request timeout" : "Network error" 
      };
    }
  },

  async getFoodDetails(fdcId) {
    try {
      const url = `${API_CONFIG.DETAILS_URL}/${fdcId}?api_key=${API_CONFIG.KEY}`;
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return { success: true, data, error: null };
    } catch (error) {
      return { 
        success: false, 
        data: null, 
        error: error.name === "AbortError" ? "Request timeout" : "Failed to load details" 
      };
    }
  },

  extractNutrients(foodDetails) {
    const getNutrient = (id) => {
      const nutrient = foodDetails.foodNutrients?.find((n) => n.nutrient?.id === id);
      return nutrient?.amount || 0;
    };

    return {
      calories: getNutrient(NUTRIENT_IDS.CALORIES),
      protein: getNutrient(NUTRIENT_IDS.PROTEIN),
      carbs: getNutrient(NUTRIENT_IDS.CARBS),
      fats: getNutrient(NUTRIENT_IDS.FATS),
      fiber: getNutrient(NUTRIENT_IDS.FIBER),
      sodium: getNutrient(NUTRIENT_IDS.SODIUM),
    };
  },
};

// ===== COMPONENTS =====

// Animated Progress Ring
const ProgressRing = ({ current, goal, size = 80, strokeWidth = 8, color = COLORS.primary }) => {
  const percentage = Math.min((current / goal) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPercentage}>{Math.round(percentage)}%</Text>
      </View>
    </View>
  );
};

// Enhanced Progress Bar
const ProgressBar = ({ current, goal, label, color = COLORS.primary, icon }) => {
  const percentage = Math.min((current / goal) * 100, 100);
  const isOverGoal = current > goal;
  const remaining = Math.max(0, goal - current);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <View style={styles.progressLabelRow}>
          {icon && <Text style={styles.progressIcon}>{icon}</Text>}
          <Text style={styles.progressLabel}>{label}</Text>
        </View>
        <View style={styles.progressValues}>
          <Text style={[styles.progressCurrent, isOverGoal && styles.overGoal]}>
            {formatNumber(current)}
          </Text>
          <Text style={styles.progressGoal}> / {formatNumber(goal)}</Text>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <Animated.View 
          style={[
            styles.progressBarFill, 
            { 
              width: `${percentage}%`, 
              backgroundColor: isOverGoal ? COLORS.danger : color 
            }
          ]} 
        />
      </View>
      {!isOverGoal && remaining > 0 && (
        <Text style={styles.remainingText}>{formatNumber(remaining)} remaining</Text>
      )}
    </View>
  );
};

// Food List Item with Image Support
const FoodListItem = React.memo(({ item, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.resultItem} activeOpacity={0.7}>
    <View style={styles.resultItemContent}>
      <Text style={styles.resultText} numberOfLines={2}>
        {item.description}
      </Text>
      {item.brandName && (
        <Text style={styles.brandText} numberOfLines={1}>
          📦 {item.brandName}
        </Text>
      )}
    </View>
    <View style={styles.resultArrow}>
      <Text style={styles.arrowText}>›</Text>
    </View>
  </TouchableOpacity>
));

// Enhanced Logged Food Item
const LoggedFoodItem = React.memo(({ item, onRemove, onEdit }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.logItem}>
      <TouchableOpacity 
        style={styles.logItemContent} 
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.logItemHeader}>
          <Text style={styles.logItemName} numberOfLines={expanded ? undefined : 2}>
            {item.name}
          </Text>
          <Text style={styles.logItemCalories}>{formatNumber(item.calories)} kcal</Text>
        </View>
        
        <View style={styles.macroRow}>
          {item.protein > 0 && (
            <View style={styles.macroChip}>
              <Text style={styles.macroChipText}>P: {formatNumber(item.protein)}g</Text>
            </View>
          )}
          {item.carbs > 0 && (
            <View style={[styles.macroChip, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.macroChipText, { color: '#92400E' }]}>C: {formatNumber(item.carbs)}g</Text>
            </View>
          )}
          {item.fats > 0 && (
            <View style={[styles.macroChip, { backgroundColor: '#E0E7FF' }]}>
              <Text style={[styles.macroChipText, { color: '#3730A3' }]}>F: {formatNumber(item.fats)}g</Text>
            </View>
          )}
        </View>

        {expanded && (
          <View style={styles.expandedInfo}>
            {item.quantity !== "custom" && (
              <Text style={styles.quantityText}>Quantity: {formatNumber(item.quantity)}g</Text>
            )}
            {item.fiber > 0 && (
              <Text style={styles.detailText}>Fiber: {formatNumber(item.fiber)}g</Text>
            )}
            {item.sodium > 0 && (
              <Text style={styles.detailText}>Sodium: {formatNumber(item.sodium)}mg</Text>
            )}
          </View>
        )}

        <Text style={styles.timestamp}>
          🕐 {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={onRemove} 
        style={styles.removeButtonContainer}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.removeButton}>
          <Text style={styles.removeButtonText}>✕</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
});

// Quick Action Button
const QuickActionButton = ({ icon, label, onPress, color = COLORS.primary, disabled }) => (
  <TouchableOpacity 
    style={[styles.quickActionButton, { backgroundColor: color }, disabled && styles.disabledButton]} 
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <Text style={styles.quickActionIcon}>{icon}</Text>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

// Stats Card
const StatsCard = ({ icon, label, value, unit, color }) => (
  <View style={[styles.statsCard, { borderLeftColor: color }]}>
    <Text style={styles.statsIcon}>{icon}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
    <Text style={styles.statsValue}>
      {value}
      <Text style={styles.statsUnit}> {unit}</Text>
    </Text>
  </View>
);

// ===== MAIN COMPONENT =====
export default function MealLogScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [selectedFoods, setSelectedFoods] = useState([]);
  const [waterIntake, setWaterIntake] = useState(0);
  const [supplements, setSupplements] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [dailyGoals, setDailyGoals] = useState(DEFAULT_GOALS);

  const [modalVisible, setModalVisible] = useState(false);
  const [foodDetails, setFoodDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [calculated, setCalculated] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    sodium: 0,
  });

  const [customModal, setCustomModal] = useState(false);
  const [customFood, setCustomFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });

  const [waterModal, setWaterModal] = useState(false);
  const [waterAmount, setWaterAmount] = useState("");
  const [recipeModal, setRecipeModal] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [loadRecipeModal, setLoadRecipeModal] = useState(false);
  const [goalsModal, setGoalsModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastDateRef = useRef(getCurrentDate());

  useEffect(() => {
    loadAllData();
    fadeIn();
  }, []);

  useEffect(() => {
    const checkMidnight = setInterval(() => {
      const currentDate = getCurrentDate();
      if (currentDate !== lastDateRef.current) {
        handleMidnightReset(lastDateRef.current);
        lastDateRef.current = currentDate;
      }
    }, 60000);

    return () => clearInterval(checkMidnight);
  }, [selectedFoods]);

  const handleMidnightReset = async (previousDate) => {
    if (selectedFoods.length > 0) {
      await StorageService.saveHistory(selectedFoods, previousDate);
    }

    setSelectedFoods([]);
    setWaterIntake(0);
    setSupplements([]);
    
    await Promise.all([
      StorageService.saveData(STORAGE_KEYS.FOODS, []),
      StorageService.saveData(STORAGE_KEYS.WATER, 0),
      StorageService.saveData(STORAGE_KEYS.SUPPLEMENTS, []),
    ]);

    Alert.alert("New Day! 🌅", "Your log has been reset. Yesterday's data is saved.", [{ text: "OK" }]);
  };

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const loadAllData = async () => {
    try {
      const currentDate = getCurrentDate();
      
      const [foods, water, supps, savedRecipes, goals] = await Promise.all([
        StorageService.getData(STORAGE_KEYS.FOODS, []),
        StorageService.getData(STORAGE_KEYS.WATER, 0),
        StorageService.getData(STORAGE_KEYS.SUPPLEMENTS, []),
        StorageService.getData(STORAGE_KEYS.RECIPES, []),
        StorageService.getData(STORAGE_KEYS.NUTRITION_GOALS, DEFAULT_GOALS),
      ]);

      const lastFoodDate = foods.length > 0 
        ? new Date(foods[0].timestamp).toISOString().split("T")[0]
        : currentDate;

      if (lastFoodDate !== currentDate) {
        if (foods.length > 0) {
          await StorageService.saveHistory(foods, lastFoodDate);
        }
        setSelectedFoods([]);
        setWaterIntake(0);
        setSupplements([]);
      } else {
        setSelectedFoods(foods);
        setWaterIntake(water);
        setSupplements(supps);
      }

      setRecipes(savedRecipes);
      setDailyGoals(goals);
      lastDateRef.current = currentDate;
    } catch (error) {
      Alert.alert("Error", "Failed to load saved data");
    }
  };

  useEffect(() => {
    const saveData = async () => {
      await Promise.all([
        StorageService.saveData(STORAGE_KEYS.FOODS, selectedFoods),
        StorageService.saveData(STORAGE_KEYS.WATER, waterIntake),
        StorageService.saveData(STORAGE_KEYS.SUPPLEMENTS, supplements),
        StorageService.saveData(STORAGE_KEYS.RECIPES, recipes),
      ]);

      if (selectedFoods.length > 0) {
        StorageService.saveHistory(selectedFoods, getCurrentDate());
      }
    };
    saveData();
  }, [selectedFoods, waterIntake, supplements, recipes]);

  const debouncedSearch = useCallback(
    debounce(async (text) => {
      if (!text || text.length < 2) {
        setResults([]);
        setSearchError(null);
        return;
      }

      setLoading(true);
      setSearchError(null);

      const result = await FoodAPIService.searchFoods(text);

      if (result.success) {
        setResults(result.data);
      } else {
        setSearchError(result.error);
        setResults([]);
      }

      setLoading(false);
    }, 600),
    []
  );

  const handleSearch = (text) => {
    setQuery(text);
    debouncedSearch(text);
  };

  const handleSelectFood = async (food) => {
    setQuantity("100");
    setCalculated({ calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 });
    setModalVisible(true);
    setLoadingDetails(true);
    setFoodDetails(null);

    const result = await FoodAPIService.getFoodDetails(food.fdcId);

    if (result.success) {
      setFoodDetails(result.data);
      calculateMacros("100", result.data);
    } else {
      Alert.alert("Error", result.error);
      setModalVisible(false);
    }

    setLoadingDetails(false);
  };

  const calculateMacros = (q, details = foodDetails) => {
    setQuantity(q);
    if (!details) return;

    const grams = parseFloat(q);
    if (isNaN(grams) || grams <= 0) {
      setCalculated({ calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 });
      return;
    }

    const nutrients = FoodAPIService.extractNutrients(details);
    const multiplier = grams / 100;

    setCalculated({
      calories: formatNumber(nutrients.calories * multiplier),
      protein: formatNumber(nutrients.protein * multiplier),
      carbs: formatNumber(nutrients.carbs * multiplier),
      fats: formatNumber(nutrients.fats * multiplier),
      fiber: formatNumber(nutrients.fiber * multiplier),
      sodium: formatNumber(nutrients.sodium * multiplier),
    });
  };

  const handleAddFood = () => {
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid amount in grams.");
      return;
    }

    const newFood = {
      id: `${Date.now()}-${Math.random()}`,
      name: foodDetails.description,
      quantity: qty,
      ...calculated,
      timestamp: new Date().toISOString(),
    };

    setSelectedFoods((prev) => [...prev, newFood]);
    setModalVisible(false);
    setQuery("");
    setResults([]);
    setSearchError(null);
  };

  const handleAddCustomFood = () => {
    const { name, calories, protein, carbs, fats } = customFood;

    if (!name.trim() || !calories || isNaN(parseFloat(calories))) {
      Alert.alert("Invalid Input", "Please enter at least a name and calorie count.");
      return;
    }

    const newFood = {
      id: `${Date.now()}-${Math.random()}`,
      name: name.trim(),
      calories: formatNumber(parseFloat(calories)),
      protein: formatNumber(parseFloat(protein || 0)),
      carbs: formatNumber(parseFloat(carbs || 0)),
      fats: formatNumber(parseFloat(fats || 0)),
      quantity: "custom",
      timestamp: new Date().toISOString(),
    };

    setSelectedFoods((prev) => [...prev, newFood]);
    setCustomModal(false);
    setCustomFood({ name: "", calories: "", protein: "", carbs: "", fats: "" });
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim()) {
      Alert.alert("Error", "Please provide a recipe name.");
      return;
    }

    if (selectedFoods.length === 0) {
      Alert.alert("Error", "Please log some food first.");
      return;
    }

    const recipe = {
      id: `${Date.now()}-${Math.random()}`,
      name: recipeName.trim(),
      foods: selectedFoods,
      createdAt: new Date().toISOString(),
    };

    setRecipes((prev) => [...prev, recipe]);
    setRecipeModal(false);
    setRecipeName("");
    Alert.alert("Success", `Recipe "${recipe.name}" saved!`);
  };

  const handleLoadRecipe = (recipe) => {
    const loadedFoods = recipe.foods.map((food) => ({
      ...food,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
    }));

    setSelectedFoods((prev) => [...prev, ...loadedFoods]);
    setLoadRecipeModal(false);
    Alert.alert("Recipe Loaded", `Added ${recipe.name} to your log.`);
  };

  const handleDeleteRecipe = (recipeId) => {
    Alert.alert("Delete Recipe", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => setRecipes((prev) => prev.filter((r) => r.id !== recipeId)),
      },
    ]);
  };

  const handleAddSupplement = (name) => {
    if (!name.trim()) return;
    
    setSupplements((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: name.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleAddWater = () => {
    const amount = parseInt(waterAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid water amount.");
      return;
    }
    setWaterIntake((prev) => prev + amount);
    setWaterModal(false);
    setWaterAmount("");
  };

  const handleSaveGoals = () => {
    StorageService.saveData(STORAGE_KEYS.NUTRITION_GOALS, dailyGoals);
    setGoalsModal(false);
    Alert.alert("Success", "Daily goals updated!");
  };

  const handleClearLog = () => {
    Alert.alert("Clear Today's Log", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setSelectedFoods([]);
          setWaterIntake(0);
          setSupplements([]);
        },
      },
    ]);
  };

  const totals = useMemo(() => {
    return selectedFoods.reduce(
      (acc, food) => ({
        calories: acc.calories + parseFloat(food.calories || 0),
        protein: acc.protein + parseFloat(food.protein || 0),
        carbs: acc.carbs + parseFloat(food.carbs || 0),
        fats: acc.fats + parseFloat(food.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [selectedFoods]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Hero Header */}
          <View style={styles.heroHeader}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.heading}>Nutrition Tracker</Text>
                <Text style={styles.dateText}>
                  {new Date().toLocaleDateString("en-US", { 
                    weekday: "long", 
                    month: "long", 
                    day: "numeric" 
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setGoalsModal(true)} style={styles.settingsButton}>
                <Text style={styles.settingsIcon}>⚙️</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStatsRow}>
              <StatsCard 
                icon="🔥" 
                label="Calories" 
                value={formatNumber(totals.calories)} 
                unit={`/${dailyGoals.calorieGoal}`}
                color={COLORS.danger}
              />
              <StatsCard 
                icon="💪" 
                label="Protein" 
                value={formatNumber(totals.protein)} 
                unit="g"
                color={COLORS.secondary}
              />
              <StatsCard 
                icon="💧" 
                label="Water" 
                value={formatNumber(waterIntake)} 
                unit="ml"
                color={COLORS.primary}
              />
            </View>
          </View>

          {/* Progress Bars */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Daily Progress</Text>
            <ProgressBar
              current={totals.calories}
              goal={dailyGoals.calorieGoal}
              label="Calories"
              color="#EF4444"
              icon="🔥"
            />
            <ProgressBar
              current={totals.protein}
              goal={dailyGoals.proteinGoal}
              label="Protein"
              color="#10B981"
              icon="💪"
            />
            <ProgressBar
              current={totals.carbs}
              goal={dailyGoals.carbsGoal}
              label="Carbs"
              color="#F59E0B"
              icon="🍞"
            />
            <ProgressBar
              current={totals.fats}
              goal={dailyGoals.fatsGoal}
              label="Fats"
              color="#8B5CF6"
              icon="🥑"
            />
            <ProgressBar
              current={waterIntake}
              goal={dailyGoals.waterGoal}
              label="Water"
              color="#3B82F6"
              icon="💧"
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <QuickActionButton 
                icon="🔍" 
                label="Search" 
                onPress={() => {}} 
                color={COLORS.primary}
              />
              <QuickActionButton 
                icon="✍️" 
                label="Custom" 
                onPress={() => setCustomModal(true)} 
                color={COLORS.purple}
              />
              <QuickActionButton 
                icon="🍲" 
                label="Recipes" 
                onPress={() => setLoadRecipeModal(true)} 
                color={COLORS.secondary}
              />
              <QuickActionButton 
                icon="💧" 
                label="+250ml" 
                onPress={() => setWaterIntake((p) => p + 250)} 
                color="#60A5FA"
              />
              <QuickActionButton 
                icon="💧" 
                label="+500ml" 
                onPress={() => setWaterIntake((p) => p + 500)} 
                color="#3B82F6"
              />
              <QuickActionButton 
                icon="💊" 
                label="Supplement" 
                onPress={() => handleAddSupplement("Multivitamin")} 
                color="#F59E0B"
              />
            </View>
          </View>

          {/* Search Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Search Foods</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Search foods (e.g., chicken breast)..."
              placeholderTextColor={COLORS.lightGray}
              value={query}
              onChangeText={handleSearch}
              returnKeyType="search"
            />

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            )}
            
            {searchError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{searchError}</Text>
              </View>
            )}

            {results.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsHeader}>Found {results.length} results</Text>
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.fdcId.toString()}
                  renderItem={({ item }) => (
                    <FoodListItem item={item} onPress={() => handleSelectFood(item)} />
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>

          {/* Today's Log */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Today's Log ({selectedFoods.length})</Text>
              {selectedFoods.length > 0 && (
                <TouchableOpacity onPress={handleClearLog} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {selectedFoods.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>No food logged yet</Text>
                <Text style={styles.emptyText}>Start by searching for foods above</Text>
              </View>
            ) : (
              <FlatList
                data={selectedFoods}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <LoggedFoodItem
                    item={item}
                    onRemove={() => setSelectedFoods((prev) => prev.filter((x) => x.id !== item.id))}
                  />
                )}
                scrollEnabled={false}
              />
            )}

            {selectedFoods.length > 0 && (
              <TouchableOpacity 
                style={styles.saveRecipeButton} 
                onPress={() => setRecipeModal(true)}
              >
                <Text style={styles.saveRecipeIcon}>💾</Text>
                <Text style={styles.saveRecipeText}>Save as Recipe</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Recipes */}
          {recipes.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>My Recipes ({recipes.length})</Text>
              <FlatList
                data={recipes}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.recipeCard}>
                    <TouchableOpacity 
                      style={styles.recipeCardContent} 
                      onPress={() => handleLoadRecipe(item)}
                    >
                      <View style={styles.recipeHeader}>
                        <Text style={styles.recipeIcon}>🍲</Text>
                        <View style={styles.recipeInfo}>
                          <Text style={styles.recipeName}>{item.name}</Text>
                          <Text style={styles.recipeDetails}>
                            {item.foods.length} items · {formatNumber(
                              item.foods.reduce((sum, f) => sum + parseFloat(f.calories || 0), 0)
                            )} kcal
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDeleteRecipe(item.id)}
                      style={styles.deleteRecipeButton}
                    >
                      <Text style={styles.deleteRecipeIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Supplements */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Supplements</Text>
            <View style={styles.supplementGrid}>
              <TouchableOpacity 
                style={styles.supplementButton} 
                onPress={() => handleAddSupplement("Multivitamin")}
              >
                <Text style={styles.supplementButtonIcon}>💊</Text>
                <Text style={styles.supplementButtonText}>Multi</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.supplementButton} 
                onPress={() => handleAddSupplement("Vitamin D")}
              >
                <Text style={styles.supplementButtonIcon}>☀️</Text>
                <Text style={styles.supplementButtonText}>Vit D</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.supplementButton} 
                onPress={() => handleAddSupplement("Omega-3")}
              >
                <Text style={styles.supplementButtonIcon}>🐟</Text>
                <Text style={styles.supplementButtonText}>Omega-3</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.supplementButton} 
                onPress={() => handleAddSupplement("Protein")}
              >
                <Text style={styles.supplementButtonIcon}>🥤</Text>
                <Text style={styles.supplementButtonText}>Protein</Text>
              </TouchableOpacity>
            </View>

            {supplements.length > 0 && (
              <View style={styles.supplementsList}>
                {supplements.map((s) => (
                  <View key={s.id} style={styles.supplementItem}>
                    <View style={styles.supplementItemContent}>
                      <Text style={styles.supplementItemIcon}>💊</Text>
                      <View>
                        <Text style={styles.supplementItemName}>{s.name}</Text>
                        <Text style={styles.supplementItemTime}>{s.time}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      onPress={() => setSupplements((prev) => prev.filter((x) => x.id !== s.id))}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <View style={styles.supplementRemoveButton}>
                        <Text style={styles.supplementRemoveText}>✕</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* Food Details Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {loadingDetails ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.modalLoadingText}>Loading details...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Food</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.foodName} numberOfLines={2}>
                  {foodDetails?.description}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quantity (grams)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    placeholder="100"
                    value={quantity}
                    onChangeText={calculateMacros}
                  />
                </View>

                <View style={styles.macrosGrid}>
                  <View style={[styles.macroCard, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={styles.macroCardIcon}>🔥</Text>
                    <Text style={styles.macroCardValue}>{calculated.calories}</Text>
                    <Text style={styles.macroCardLabel}>Calories</Text>
                  </View>
                  <View style={[styles.macroCard, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={styles.macroCardIcon}>💪</Text>
                    <Text style={styles.macroCardValue}>{calculated.protein}g</Text>
                    <Text style={styles.macroCardLabel}>Protein</Text>
                  </View>
                  <View style={[styles.macroCard, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={styles.macroCardIcon}>🍞</Text>
                    <Text style={styles.macroCardValue}>{calculated.carbs}g</Text>
                    <Text style={styles.macroCardLabel}>Carbs</Text>
                  </View>
                  <View style={[styles.macroCard, { backgroundColor: '#E0E7FF' }]}>
                    <Text style={styles.macroCardIcon}>🥑</Text>
                    <Text style={styles.macroCardValue}>{calculated.fats}g</Text>
                    <Text style={styles.macroCardLabel}>Fats</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleAddFood}>
                  <Text style={styles.primaryButtonText}>Add to Log</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Food Modal */}
      <Modal visible={customModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Custom Food</Text>
                <TouchableOpacity onPress={() => setCustomModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Food Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., Homemade Pasta"
                  value={customFood.name}
                  onChangeText={(t) => setCustomFood({ ...customFood, name: t })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Calories (kcal) *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="500"
                  keyboardType="numeric"
                  value={customFood.calories}
                  onChangeText={(t) => setCustomFood({ ...customFood, calories: t })}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="25"
                    keyboardType="numeric"
                    value={customFood.protein}
                    onChangeText={(t) => setCustomFood({ ...customFood, protein: t })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Carbs (g)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="60"
                    keyboardType="numeric"
                    value={customFood.carbs}
                    onChangeText={(t) => setCustomFood({ ...customFood, carbs: t })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fats (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="15"
                  keyboardType="numeric"
                  value={customFood.fats}
                  onChangeText={(t) => setCustomFood({ ...customFood, fats: t })}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleAddCustomFood}>
                <Text style={styles.primaryButtonText}>Save Food</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Save Recipe Modal */}
      <Modal visible={recipeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save Recipe</Text>
              <TouchableOpacity onPress={() => setRecipeModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Recipe Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Post-Workout Meal"
                value={recipeName}
                onChangeText={setRecipeName}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveRecipe}>
              <Text style={styles.primaryButtonText}>Save Recipe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Load Recipe Modal */}
      <Modal visible={loadRecipeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Load Recipe</Text>
              <TouchableOpacity onPress={() => setLoadRecipeModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {recipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🍲</Text>
                <Text style={styles.emptyTitle}>No recipes saved</Text>
                <Text style={styles.emptyText}>Save your first recipe to see it here</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {recipes.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalRecipeItem}
                    onPress={() => handleLoadRecipe(item)}
                  >
                    <Text style={styles.modalRecipeIcon}>🍲</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRecipeName}>{item.name}</Text>
                      <Text style={styles.modalRecipeInfo}>
                        {item.foods.length} items · {formatNumber(
                          item.foods.reduce((sum, f) => sum + parseFloat(f.calories || 0), 0)
                        )} kcal
                      </Text>
                    </View>
                    <Text style={styles.modalRecipeArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Goals Modal */}
      <Modal visible={goalsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Daily Goals</Text>
                <TouchableOpacity onPress={() => setGoalsModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🔥 Calories (kcal)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={dailyGoals.calorieGoal.toString()}
                  onChangeText={(t) => setDailyGoals({ ...dailyGoals, calorieGoal: parseInt(t) || 0 })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>💪 Protein (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={dailyGoals.proteinGoal.toString()}
                  onChangeText={(t) => setDailyGoals({ ...dailyGoals, proteinGoal: parseInt(t) || 0 })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🍞 Carbs (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={(dailyGoals.carbsGoal || 250).toString()}
                  onChangeText={(t) => setDailyGoals({ ...dailyGoals, carbsGoal: parseInt(t) || 0 })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🥑 Fats (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={(dailyGoals.fatsGoal || 65).toString()}
                  onChangeText={(t) => setDailyGoals({ ...dailyGoals, fatsGoal: parseInt(t) || 0 })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>💧 Water (ml)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={dailyGoals.waterGoal.toString()}
                  onChangeText={(t) => setDailyGoals({ ...dailyGoals, waterGoal: parseInt(t) || 0 })}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveGoals}>
                <Text style={styles.primaryButtonText}>Save Goals</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Water Modal */}
      <Modal visible={waterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Water</Text>
              <TouchableOpacity onPress={() => setWaterModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (ml)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="250"
                value={waterAmount}
                onChangeText={setWaterAmount}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAddWater}>
              <Text style={styles.primaryButtonText}>Add Water</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ===== STYLES =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroHeader: {
    backgroundColor: COLORS.white,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  heading: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.dark,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 15,
    color: COLORS.gray,
    fontWeight: "600",
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: {
    fontSize: 20,
  },
  quickStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statsCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    alignItems: "center",
  },
  statsIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  statsLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: "600",
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.dark,
  },
  statsUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.lightGray,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.dark,
    marginBottom: 16,
  },
  clearButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  clearButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressIcon: {
    fontSize: 16,
  },
  progressLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.gray,
  },
  progressValues: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  progressCurrent: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.dark,
  },
  progressGoal: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.lightGray,
  },
  overGoal: {
    color: COLORS.danger,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  remainingText: {
    fontSize: 12,
    color: COLORS.lightGray,
    marginTop: 4,
    fontWeight: "600",
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickActionButton: {
    width: (width - 72) / 3,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  quickActionLabel: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    fontSize: 16,
    color: COLORS.dark,
    fontWeight: "500",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.gray,
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  resultsContainer: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: "hidden",
    backgroundColor: COLORS.background,
  },
  resultsHeader: {
    padding: 12,
    backgroundColor: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.gray,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.white,
  },
  resultItemContent: {
    flex: 1,
  },
  resultText: {
    fontSize: 16,
    color: COLORS.dark,
    fontWeight: "600",
    marginBottom: 4,
  },
  brandText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  resultArrow: {
    marginLeft: 12,
  },
  arrowText: {
    fontSize: 24,
    color: COLORS.lightGray,
    fontWeight: "300",
  },
  separator: {
    height: 2,
    backgroundColor: COLORS.border,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.dark,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.lightGray,
    fontWeight: "500",
  },
  logItem: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  logItemContent: {
    flex: 1,
  },
  logItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logItemName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.dark,
    flex: 1,
    marginRight: 12,
  },
  logItemCalories: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary,
  },
  macroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  macroChip: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  macroChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
  },
  expandedInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  quantityText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.lightGray,
    fontWeight: "600",
    marginTop: 6,
  },
  removeButtonContainer: {
    marginLeft: 12,
    justifyContent: "center",
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: "700",
  },
  saveRecipeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveRecipeIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  saveRecipeText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  recipeCardContent: {
    flex: 1,
  },
  recipeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recipeIcon: {
    fontSize: 28,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.dark,
    marginBottom: 4,
  },
  recipeDetails: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  deleteRecipeButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteRecipeIcon: {
    fontSize: 22,
  },
  supplementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  supplementButton: {
    width: (width - 72) / 4,
    paddingVertical: 14,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  supplementButtonIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  supplementButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.dark,
  },
  supplementsList: {
    marginTop: 16,
  },
  supplementItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  supplementItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  supplementItemIcon: {
    fontSize: 24,
  },
  supplementItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.dark,
    marginBottom: 2,
  },
  supplementItemTime: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  supplementRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  supplementRemoveText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.dark,
  },
  modalClose: {
    fontSize: 28,
    color: COLORS.lightGray,
    fontWeight: "300",
  },
  modalLoading: {
    alignItems: "center",
    paddingVertical: 60,
  },
  modalLoadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.gray,
    fontWeight: "600",
  },
  foodName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.dark,
    marginBottom: 24,
    lineHeight: 26,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.gray,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    fontSize: 16,
    color: COLORS.dark,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
  },
  macrosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  macroCard: {
    width: (width - 88) / 2,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  macroCardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  macroCardValue: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.dark,
    marginBottom: 4,
  },
  macroCardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.gray,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "800",
  },
  modalRecipeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    marginBottom: 10,
    gap: 14,
  },
  modalRecipeIcon: {
    fontSize: 32,
  },
  modalRecipeName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.dark,
    marginBottom: 4,
  },
  modalRecipeInfo: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  modalRecipeArrow: {
    fontSize: 24,
    color: COLORS.lightGray,
    fontWeight: "300",
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercentage: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.dark,
  },
});