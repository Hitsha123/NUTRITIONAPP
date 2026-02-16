import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Animated,
  Vibration,
  Platform,
  StatusBar,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get('window');

export default function ProductDetailsScreen({ route, navigation }) {
  const { product } = route.params;

  const [grams, setGrams] = useState("100");
  const [isSaving, setIsSaving] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Nutrition calculation
  const nutrition = useMemo(() => {
    const g = Number(grams);
    if (!g || g <= 0) {
      return { calories: 0, protein: 0, carbs: 0, fats: 0 };
    }

    const factor = g / 100;

    return {
      calories: +(product.calories * factor).toFixed(1),
      protein: +(product.protein * factor).toFixed(1),
      carbs: +(product.carbs * factor).toFixed(1),
      fats: +(product.fats * factor).toFixed(1),
    };
  }, [grams, product]);

  // Quick set portions
  const quickSetGrams = (value) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate(50);
    }
    setGrams(value.toString());
  };

  // Increment/Decrement with haptics
  const adjustGrams = (delta) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate(30);
    }
    setGrams((prev) => {
      const current = Number(prev || 0);
      const newValue = Math.max(0, current + delta);
      return newValue.toString();
    });
  };

  // Add to Meal Log
  const addToMealLog = async () => {
    const g = Number(grams);

    if (!g || g <= 0) {
      Alert.alert("Invalid Amount", "Please enter a quantity greater than 0g", [
        { text: "OK", style: "default" }
      ]);
      return;
    }

    setIsSaving(true);

    const entry = {
      name: product.name,
      grams: g,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fats: nutrition.fats,
      timestamp: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(await AsyncStorage.getItem("selectedFoods")) || [];
      existing.push(entry);
      await AsyncStorage.setItem("selectedFoods", JSON.stringify(existing));

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Vibration.vibrate(100);
      }

      Alert.alert(
        "Success! 🎉", 
        `${product.name} (${g}g) added to your meal log`,
        [
          {
            text: "Add More",
            onPress: () => {
              setIsSaving(false);
              setGrams("100");
            },
            style: "default"
          },
          {
            text: "View Meal Log",
            onPress: () => navigation.navigate("MealLogScreen"),
            style: "default"
          }
        ]
      );
    } catch (err) {
      console.error("Save error:", err);
      Alert.alert("Error", "Could not save to meal log. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        <Animated.View 
          style={[
            styles.imageContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          {product.image ? (
            <Image 
              source={{ uri: product.image }} 
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>🍽️</Text>
            </View>
          )}
        </Animated.View>

        {/* Product Name */}
        <Animated.Text 
          style={[
            styles.name,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {product.name}
        </Animated.Text>

        {/* Quick Portions */}
        <Animated.View 
          style={[
            styles.quickPortionsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Quick Select</Text>
          <View style={styles.quickPortions}>
            {[50, 100, 150, 200].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.quickPortionBtn,
                  grams === value.toString() && styles.quickPortionBtnActive
                ]}
                onPress={() => quickSetGrams(value)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.quickPortionText,
                  grams === value.toString() && styles.quickPortionTextActive
                ]}>
                  {value}g
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Custom Amount Input */}
        <Animated.View 
          style={[
            styles.gramsBox,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Custom Amount</Text>
          
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.decrementBtn}
              onPress={() => adjustGrams(-10)}
              activeOpacity={0.7}
            >
              <Text style={styles.adjustBtnText}>−</Text>
            </TouchableOpacity>

            <View style={styles.inputContainer}>
              <TextInput
                value={grams}
                onChangeText={setGrams}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor="#999"
                style={styles.gramsInput}
                maxLength={5}
              />
              <Text style={styles.unitLabel}>grams</Text>
            </View>

            <TouchableOpacity
              style={styles.incrementBtn}
              onPress={() => adjustGrams(10)}
              activeOpacity={0.7}
            >
              <Text style={styles.adjustBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Fine adjustment buttons */}
          <View style={styles.fineAdjust}>
            <TouchableOpacity
              style={styles.fineAdjustBtn}
              onPress={() => adjustGrams(-1)}
              activeOpacity={0.7}
            >
              <Text style={styles.fineAdjustText}>-1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fineAdjustBtn}
              onPress={() => adjustGrams(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.fineAdjustText}>+1</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Nutrition Info */}
        <Animated.View 
          style={[
            styles.nutritionBox,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Nutritional Information</Text>
          
          <View style={styles.nutritionGrid}>
            {/* Calories - Featured */}
            <View style={styles.calorieCard}>
              <Text style={styles.calorieValue}>{nutrition.calories}</Text>
              <Text style={styles.calorieLabel}>Calories</Text>
            </View>

            {/* Macros Grid */}
            <View style={styles.macrosGrid}>
              <View style={styles.macroCard}>
                <View style={[styles.macroIcon, { backgroundColor: '#FF6B6B20' }]}>
                  <Text style={styles.macroEmoji}>🥩</Text>
                </View>
                <Text style={styles.macroValue}>{nutrition.protein}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>

              <View style={styles.macroCard}>
                <View style={[styles.macroIcon, { backgroundColor: '#4ECDC420' }]}>
                  <Text style={styles.macroEmoji}>🌾</Text>
                </View>
                <Text style={styles.macroValue}>{nutrition.carbs}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>

              <View style={styles.macroCard}>
                <View style={[styles.macroIcon, { backgroundColor: '#FFE66D20' }]}>
                  <Text style={styles.macroEmoji}>🥑</Text>
                </View>
                <Text style={styles.macroValue}>{nutrition.fats}g</Text>
                <Text style={styles.macroLabel}>Fats</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Base nutrition reference */}
        <Animated.View 
          style={[
            styles.referenceBox,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          <Text style={styles.referenceText}>
            Per 100g: {product.calories} cal • {product.protein}g protein • {product.carbs}g carbs • {product.fats}g fats
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Fixed Add Button */}
      <Animated.View 
        style={[
          styles.bottomContainer,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <TouchableOpacity 
          style={[styles.addBtn, isSaving && styles.addBtnDisabled]} 
          onPress={addToMealLog}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <Text style={styles.addText}>Adding...</Text>
          ) : (
            <>
              <Text style={styles.addText}>Add to Meal Log</Text>
              <Text style={styles.addSubtext}>
                {nutrition.calories} cal • {grams}g
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  image: {
    width: width - 112,
    height: 200,
  },
  imagePlaceholder: {
    width: width - 112,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  placeholderText: {
    fontSize: 64,
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginTop: 20,
    marginHorizontal: 24,
    lineHeight: 34,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  quickPortionsContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  quickPortions: {
    flexDirection: "row",
    gap: 10,
  },
  quickPortionBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  quickPortionBtnActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  quickPortionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#666",
  },
  quickPortionTextActive: {
    color: "#fff",
  },
  gramsBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  decrementBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  incrementBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  adjustBtnText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 2,
    borderColor: "#E8E8E8",
  },
  gramsInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    padding: 0,
  },
  unitLabel: {
    fontSize: 16,
    color: "#999",
    fontWeight: "600",
    marginLeft: 4,
  },
  fineAdjust: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    justifyContent: "center",
  },
  fineAdjustBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
  },
  fineAdjustText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  nutritionBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  nutritionGrid: {
    gap: 16,
  },
  calorieCard: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  calorieValue: {
    fontSize: 48,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 52,
  },
  calorieLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    opacity: 0.9,
    marginTop: 4,
  },
  macrosGrid: {
    flexDirection: "row",
    gap: 12,
  },
  macroCard: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  macroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  macroEmoji: {
    fontSize: 24,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  referenceBox: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: "#FFF9E6",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FFB800",
  },
  referenceText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    fontWeight: "500",
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  addBtn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  addSubtext: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
    opacity: 0.9,
  },
});