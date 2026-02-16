import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { launchImageLibrary } from "react-native-image-picker";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import LinearGradient from "react-native-linear-gradient";

/* =======================
   GOAL CALCULATION LOGIC
======================= */
const calculateGoals = ({ age, weight, height, gender, fitnessGoal }) => {
  if (!age || !weight || !height || !gender) {
    return {
      calorieGoal: 2000,
      proteinGoal: 100,
      waterGoal: 2500,
    };
  }

  const bmr =
    gender.toLowerCase() === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  let calories = Math.round(bmr * 1.4);

  if (fitnessGoal === "weight loss") calories -= 300;
  if (fitnessGoal === "muscle gain") calories += 300;

  return {
    calorieGoal: calories,
    proteinGoal: Math.round(weight * 1.6),
    waterGoal: Math.round(weight * 35),
  };
};

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState({
    name: "",
    age: "",
    height: "",
    weight: "",
    gender: "",
    fitnessGoal: "",
    dietaryPreferences: "",
    email: "",
    photoURL: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  /* =======================
     LOAD PROFILE FROM ASYNC STORAGE
  ======================= */
  useEffect(() => {
    loadProfile();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem("userProfile");
      
      if (stored) {
        const parsedProfile = JSON.parse(stored);
        setProfile(parsedProfile);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      Alert.alert("❌ Error", "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     PICK PROFILE IMAGE
  ======================= */
  const pickImage = async () => {
    try {
      const result = await launchImageLibrary({ 
        mediaType: "photo", 
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
      });
      
      if (!result.didCancel && result.assets?.length) {
        const localUri = result.assets[0].uri;
        setProfile({ ...profile, photoURL: localUri });
      }
    } catch (error) {
      Alert.alert("❌ Error", "Failed to select image");
      console.error(error);
    }
  };

  /* =======================
     SAVE PROFILE TO ASYNC STORAGE
  ======================= */
  const handleSaveProfile = async () => {
    // Validation
    if (!profile.name.trim()) {
      Alert.alert("⚠️ Validation Error", "Please enter your name");
      return;
    }

    if (profile.age && (isNaN(profile.age) || profile.age < 1 || profile.age > 120)) {
      Alert.alert("⚠️ Validation Error", "Please enter a valid age (1-120)");
      return;
    }

    if (profile.height && (isNaN(profile.height) || profile.height < 50 || profile.height > 300)) {
      Alert.alert("⚠️ Validation Error", "Please enter a valid height (50-300 cm)");
      return;
    }

    if (profile.weight && (isNaN(profile.weight) || profile.weight < 20 || profile.weight > 500)) {
      Alert.alert("⚠️ Validation Error", "Please enter a valid weight (20-500 kg)");
      return;
    }

    try {
      setSaving(true);

      const cleanedProfile = {
        ...profile,
        age: profile.age ? Number(profile.age) : null,
        height: profile.height ? Number(profile.height) : null,
        weight: profile.weight ? Number(profile.weight) : null,
        updatedAt: new Date().toISOString(),
      };

      const goals = calculateGoals(cleanedProfile);

      /* ---------- SAVE TO ASYNC STORAGE ---------- */
      await AsyncStorage.setItem("userProfile", JSON.stringify(cleanedProfile));
      await AsyncStorage.setItem("nutritionGoals", JSON.stringify(goals));

      setSaving(false);
      Alert.alert(
        "✅ Success", 
        "Profile & goals saved successfully!\n\n" +
        `📊 Your Daily Goals:\n` +
        `🔥 Calories: ${goals.calorieGoal} kcal\n` +
        `💪 Protein: ${goals.proteinGoal}g\n` +
        `💧 Water: ${goals.waterGoal}ml`,
        [
          { text: "🎉 Great!", onPress: () => navigation.goBack() }
        ]
      );
    } catch (err) {
      console.error(err);
      setSaving(false);
      Alert.alert("❌ Error", "Failed to save profile. Please try again.");
    }
  };

  /* =======================
     GENDER SELECTION
  ======================= */
  const renderGenderSelector = () => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>⚧️ Gender</Text>
      <View style={styles.genderContainer}>
        <TouchableOpacity
          style={[
            styles.genderButton,
            profile.gender === "male" && styles.genderButtonActive,
          ]}
          onPress={() => setProfile({ ...profile, gender: "male" })}
        >
          <Text style={styles.genderEmoji}>👨</Text>
          <Text style={[
            styles.genderText,
            profile.gender === "male" && styles.genderTextActive
          ]}>
            Male
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.genderButton,
            profile.gender === "female" && styles.genderButtonActive,
          ]}
          onPress={() => setProfile({ ...profile, gender: "female" })}
        >
          <Text style={styles.genderEmoji}>👩</Text>
          <Text style={[
            styles.genderText,
            profile.gender === "female" && styles.genderTextActive
          ]}>
            Female
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* =======================
     FITNESS GOAL SELECTION
  ======================= */
  const renderFitnessGoalSelector = () => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>🎯 Fitness Goal</Text>
      <View style={styles.goalContainer}>
        {[
          { value: "weight loss", emoji: "🔥", label: "Weight Loss", icon: "trending-down" },
          { value: "muscle gain", emoji: "💪", label: "Muscle Gain", icon: "trending-up" },
          { value: "maintain", emoji: "⚖️", label: "Maintain", icon: "minus" },
        ].map((goal) => (
          <TouchableOpacity
            key={goal.value}
            style={[
              styles.goalButton,
              profile.fitnessGoal === goal.value && styles.goalButtonActive,
            ]}
            onPress={() => setProfile({ ...profile, fitnessGoal: goal.value })}
          >
            <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            <Text style={[
              styles.goalText,
              profile.fitnessGoal === goal.value && styles.goalTextActive
            ]}>
              {goal.label}
            </Text>
            <Icon 
              name={goal.icon} 
              size={20} 
              color={profile.fitnessGoal === goal.value ? "#fff" : "#667eea"} 
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  /* =======================
     DIETARY PREFERENCES SELECTION
  ======================= */
  const renderDietaryPreferences = () => {
    const preferences = ["🥗 Vegetarian", "🌱 Vegan", "🥩 Keto", "🍖 Paleo", "🌾 Gluten-Free", "🥛 Lactose-Free"];
    const selectedPrefs = profile.dietaryPreferences ? profile.dietaryPreferences.split(", ") : [];

    const togglePreference = (pref) => {
      const prefWithoutEmoji = pref.substring(pref.indexOf(" ") + 1);
      let updated;
      
      if (selectedPrefs.some(p => p.includes(prefWithoutEmoji))) {
        updated = selectedPrefs.filter(p => !p.includes(prefWithoutEmoji));
      } else {
        updated = [...selectedPrefs, pref];
      }
      
      setProfile({ ...profile, dietaryPreferences: updated.join(", ") });
    };

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>🍎 Dietary Preferences</Text>
        <View style={styles.preferencesContainer}>
          {preferences.map((pref) => {
            const prefWithoutEmoji = pref.substring(pref.indexOf(" ") + 1);
            const isSelected = selectedPrefs.some(p => p.includes(prefWithoutEmoji));
            
            return (
              <TouchableOpacity
                key={pref}
                style={[
                  styles.preferenceChip,
                  isSelected && styles.preferenceChipActive,
                ]}
                onPress={() => togglePreference(pref)}
              >
                <Text style={[
                  styles.preferenceText,
                  isSelected && styles.preferenceTextActive
                ]}>
                  {pref}
                </Text>
                {isSelected && (
                  <Text style={styles.checkEmoji}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  /* =======================
     RENDER INPUT FIELD
  ======================= */
  const renderInputField = (field) => (
    <View key={field.key} style={styles.fieldContainer}>
      <Text style={styles.label}>
        {field.label}
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          value={String(profile[field.key] || "")}
          onChangeText={(t) => setProfile({ ...profile, [field.key]: t })}
          style={styles.input}
          keyboardType={field.keyboard || "default"}
          placeholder={field.placeholder}
          placeholderTextColor="#999"
          autoCapitalize={field.autoCapitalize || "sentences"}
        />
        {field.unit && (
          <Text style={styles.unitText}>{field.unit}</Text>
        )}
      </View>
    </View>
  );

  /* =======================
     LOADING STATE
  ======================= */
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>⏳ Loading profile...</Text>
        </LinearGradient>
      </View>
    );
  }

  /* =======================
     UI
  ======================= */
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backEmoji}>◀️</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.heading}>👤 Your Profile</Text>
            <Text style={styles.subheading}>Personalize your experience</Text>
          </View>
          <View style={styles.backButton} />
        </LinearGradient>

        <Animated.View 
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              onPress={pickImage} 
              style={styles.avatarContainer}
              activeOpacity={0.8}
            >
              {profile.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
              ) : (
                <LinearGradient 
                  colors={["#667eea", "#764ba2"]} 
                  style={styles.avatarPlaceholder}
                >
                  <Text style={styles.avatarPlaceholderEmoji}>👤</Text>
                </LinearGradient>
              )}
              
              <LinearGradient 
                colors={["#667eea", "#764ba2"]} 
                style={styles.cameraButton}
              >
                <Text style={styles.cameraEmoji}>📷</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.changePhoto}>📸 Tap to change photo</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Personal Info Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>📋</Text>
                <Text style={styles.sectionTitle}>Personal Information</Text>
              </View>
              
              {[
                { 
                  label: "👤 Full Name", 
                  key: "name", 
                  icon: "account",
                  placeholder: "Enter your full name"
                },
                { 
                  label: "📧 Email", 
                  key: "email", 
                  icon: "email",
                  placeholder: "your@email.com",
                  keyboard: "email-address",
                  autoCapitalize: "none"
                },
                { 
                  label: "🎂 Age", 
                  key: "age", 
                  keyboard: "numeric",
                  icon: "cake-variant",
                  placeholder: "25",
                  unit: "years"
                },
              ].map(renderInputField)}
            </View>

            {/* Body Metrics Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>📏</Text>
                <Text style={styles.sectionTitle}>Body Metrics</Text>
              </View>
              
              {[
                { 
                  label: "📏 Height", 
                  key: "height", 
                  keyboard: "numeric",
                  icon: "human-male-height",
                  placeholder: "175",
                  unit: "cm"
                },
                { 
                  label: "⚖️ Weight", 
                  key: "weight", 
                  keyboard: "numeric",
                  icon: "weight-kilogram",
                  placeholder: "70",
                  unit: "kg"
                },
              ].map(renderInputField)}

              {renderGenderSelector()}
            </View>

            {/* Goals & Preferences Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEmoji}>🎯</Text>
                <Text style={styles.sectionTitle}>Goals & Preferences</Text>
              </View>
              
              {renderFitnessGoalSelector()}
              {renderDietaryPreferences()}
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity 
            style={[styles.button, saving && styles.buttonDisabled]} 
            onPress={handleSaveProfile}
            disabled={saving}
            activeOpacity={0.8}
          >
            <LinearGradient 
              colors={saving ? ["#999", "#777"] : ["#667eea", "#764ba2"]} 
              style={styles.buttonGradient}
            >
              {saving ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.buttonText}>⏳ Saving...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.saveEmoji}>💾</Text>
                  <Text style={styles.buttonText}>Save Profile</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Info Cards */}
          <View style={styles.infoCardsContainer}>
            <LinearGradient 
              colors={["#f0f0ff", "#fff"]} 
              style={styles.infoCard}
            >
              <Text style={styles.infoEmoji}>🔒</Text>
              <Text style={styles.infoText}>
                Your profile data is securely stored on your device and never shared.
              </Text>
            </LinearGradient>

            <LinearGradient 
              colors={["#fff7ed", "#fff"]} 
              style={styles.infoCard}
            >
              <Text style={styles.infoEmoji}>💡</Text>
              <Text style={styles.infoText}>
                Complete your profile to get personalized nutrition goals and recommendations.
              </Text>
            </LinearGradient>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* =======================
   STYLES
======================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backEmoji: {
    fontSize: 24,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  heading: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  subheading: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
    marginTop: 4,
  },
  contentContainer: {
    marginTop: -15,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 5,
    borderColor: "#fff",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 5,
    borderColor: "#fff",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarPlaceholderEmoji: {
    fontSize: 70,
  },
  cameraButton: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  cameraEmoji: {
    fontSize: 20,
  },
  changePhoto: {
    marginTop: 12,
    color: "#667eea",
    fontWeight: "700",
    fontSize: 15,
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f0f0",
  },
  sectionEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 10,
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#fafafa",
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
  },
  unitText: {
    position: "absolute",
    right: 16,
    fontSize: 14,
    color: "#999",
    fontWeight: "600",
  },
  genderContainer: {
    flexDirection: "row",
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    gap: 8,
  },
  genderEmoji: {
    fontSize: 24,
  },
  genderButtonActive: {
    borderColor: "#667eea",
    backgroundColor: "#f0f0ff",
  },
  genderText: {
    fontSize: 15,
    color: "#999",
    fontWeight: "600",
  },
  genderTextActive: {
    color: "#667eea",
    fontWeight: "700",
  },
  goalContainer: {
    gap: 10,
  },
  goalButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    gap: 12,
  },
  goalEmoji: {
    fontSize: 24,
  },
  goalButtonActive: {
    borderColor: "#667eea",
    backgroundColor: "#667eea",
  },
  goalText: {
    fontSize: 15,
    color: "#667eea",
    fontWeight: "600",
    flex: 1,
  },
  goalTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  preferencesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  preferenceChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    gap: 6,
  },
  preferenceChipActive: {
    borderColor: "#667eea",
    backgroundColor: "#667eea",
  },
  preferenceText: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "600",
  },
  preferenceTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  checkEmoji: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
  },
  button: {
    marginHorizontal: 20,
    marginTop: 30,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    flexDirection: "row",
    padding: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  buttonText: {
    color: "#FFF",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 17,
  },
  saveEmoji: {
    fontSize: 22,
  },
  infoCardsContainer: {
    paddingHorizontal: 20,
    marginTop: 25,
    gap: 15,
  },
  infoCard: {
    flexDirection: "row",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoEmoji: {
    fontSize: 28,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#5a5a5a",
    lineHeight: 20,
    fontWeight: "500",
  },
});