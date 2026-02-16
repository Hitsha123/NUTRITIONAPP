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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearAllNotifications,
  scheduleDailyNotification,
  scheduleIntervalNotification,
  sendTestNotification,
} from "../utils/notificationService";
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';

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

  useEffect(() => {
    loadSettings();
    animateIn();
  }, []);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadSettings = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!AsyncStorage) {
        throw new Error("AsyncStorage is not available");
      }

      const saved = await AsyncStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);
        const mergedSettings = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(mergedSettings);
        setWaterInterval(String(parsed.waterInterval || 120));
        setActivityInterval(String(parsed.activityInterval || 180));
      } else {
        setSettings(DEFAULT_SETTINGS);
        setWaterInterval("120");
        setActivityInterval("180");
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      setError("Failed to load settings. Using defaults.");
      setSettings(DEFAULT_SETTINGS);
      setWaterInterval("120");
      setActivityInterval("180");
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
      Alert.alert(
        "Invalid Value",
        `${name} must be at least ${MIN_INTERVAL} minutes`,
        [{ text: "OK", style: "default" }]
      );
      return false;
    }
    if (num > MAX_INTERVAL) {
      Alert.alert(
        "Invalid Value",
        `${name} cannot exceed ${MAX_INTERVAL} minutes (24 hours)`,
        [{ text: "OK", style: "default" }]
      );
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
      const updatedSettings = {
        ...settings,
        waterInterval: Number(waterInterval),
        activityInterval: Number(activityInterval),
      };

      if (AsyncStorage) {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(updatedSettings)
        );
      }

      if (clearAllNotifications) {
        await clearAllNotifications();
      }

      if (updatedSettings.mealReminders && scheduleDailyNotification) {
        const { breakfastTime, lunchTime, dinnerTime } = updatedSettings;

        await scheduleDailyNotification(
          1,
          "🍳 Breakfast Time",
          "Don't forget to log your breakfast!",
          breakfastTime.hour,
          breakfastTime.minute,
          "MealLogScreen"
        );
        await scheduleDailyNotification(
          2,
          "🥗 Lunch Time",
          "Time to log your lunch!",
          lunchTime.hour,
          lunchTime.minute,
          "MealLogScreen"
        );
        await scheduleDailyNotification(
          3,
          "🍲 Dinner Time",
          "Remember to log your dinner!",
          dinnerTime.hour,
          dinnerTime.minute,
          "MealLogScreen"
        );
      }

      if (
        updatedSettings.waterInterval >= MIN_INTERVAL &&
        scheduleIntervalNotification
      ) {
        await scheduleIntervalNotification(
          4,
          "💧 Drink Water",
          "Time to hydrate! Your body will thank you 💙",
          updatedSettings.waterInterval,
          "HomeScreen"
        );
      }

      if (
        updatedSettings.activityInterval >= MIN_INTERVAL &&
        scheduleIntervalNotification
      ) {
        await scheduleIntervalNotification(
          5,
          "🏃 Activity Break",
          "Time to move your body and stretch!",
          updatedSettings.activityInterval,
          "HomeScreen"
        );
      }

      if (updatedSettings.motivationalTips && scheduleDailyNotification) {
        await scheduleDailyNotification(
          6,
          "💡 Daily Nutrition Tip",
          "Protein helps muscle recovery and keeps you full longer 💪",
          8,
          0,
          "HomeScreen"
        );
      }

      setSaveSuccess(true);
      Alert.alert(
        "✅ Success",
        "Your notification settings have been saved and scheduled!",
        [{ text: "Awesome!", style: "default" }]
      );
    } catch (error) {
      console.error("Failed to save settings:", error);
      setError("Failed to save settings");
      Alert.alert(
        "Error",
        `Failed to save settings: ${error.message || "Unknown error"}`,
        [{ text: "OK", style: "cancel" }]
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      if (sendTestNotification) {
        await sendTestNotification();
        Alert.alert("📬 Test Sent", "Check your notifications!", [
          { text: "OK", style: "default" },
        ]);
      } else {
        Alert.alert("Error", "Test notification function not available");
      }
    } catch (error) {
      console.error("Test notification error:", error);
      Alert.alert(
        "Error",
        `Failed to send test notification: ${error.message}`
      );
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all notification settings to defaults?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#4CAF50", "#45a049", "#388E3C"]}
        style={styles.headerGradient}
      >
        <Animated.View
          style={[
            styles.headerContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Icon name="notifications" size={40} color="#fff" />
          <Text style={styles.headerTitle}>Notification Center</Text>
          <Text style={styles.headerSubtitle}>
            Customize your health reminders
          </Text>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Success Banner */}
        {saveSuccess && (
          <Animated.View
            style={[
              styles.successBanner,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <Icon name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.successText}>Settings saved successfully!</Text>
          </Animated.View>
        )}

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle" size={24} color="#f44336" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadSettings} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Meal Reminders Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Icon name="restaurant" size={24} color="#FF6B6B" />
            <Text style={styles.sectionTitle}>Meal Reminders</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.iconCircle}>
                <Icon name="alarm" size={24} color="#4CAF50" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>Daily Meal Alerts</Text>
                <Text style={styles.cardDescription}>
                  Get timely reminders for breakfast, lunch & dinner
                </Text>
              </View>
              <Switch
                value={settings.mealReminders}
                onValueChange={(value) => updateSetting("mealReminders", value)}
                trackColor={{ false: "#E0E0E0", true: "#81C784" }}
                thumbColor={settings.mealReminders ? "#4CAF50" : "#BDBDBD"}
                ios_backgroundColor="#E0E0E0"
              />
            </View>
          </View>
        </Animated.View>

        {/* Hydration Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Icon name="water" size={24} color="#2196F3" />
            <Text style={styles.sectionTitle}>Hydration Tracker</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: "#E3F2FD" }]}>
                <Icon name="timer" size={24} color="#2196F3" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>Water Break Interval</Text>
                <Text style={styles.cardDescription}>
                  Remind me every{" "}
                  <Text style={styles.highlightText}>{waterInterval}</Text> minutes
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
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(
                      (Number(waterInterval) / MAX_INTERVAL) * 100,
                      100
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Activity Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Icon name="fitness" size={24} color="#FF9800" />
            <Text style={styles.sectionTitle}>Activity Breaks</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
                <Icon name="walk" size={24} color="#FF9800" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>Movement Reminders</Text>
                <Text style={styles.cardDescription}>
                  Get active every{" "}
                  <Text style={styles.highlightText}>{activityInterval}</Text>{" "}
                  minutes
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
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(
                      (Number(activityInterval) / MAX_INTERVAL) * 100,
                      100
                    )}%`,
                    backgroundColor: "#FF9800",
                  },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Motivational Tips Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Icon name="bulb" size={24} color="#FFC107" />
            <Text style={styles.sectionTitle}>Daily Motivation</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <View style={[styles.iconCircle, { backgroundColor: "#FFF9C4" }]}>
                <Icon name="sparkles" size={24} color="#FFC107" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>Nutrition Tips</Text>
                <Text style={styles.cardDescription}>
                  Daily tips to boost your health journey
                </Text>
              </View>
              <Switch
                value={settings.motivationalTips}
                onValueChange={(value) =>
                  updateSetting("motivationalTips", value)
                }
                trackColor={{ false: "#E0E0E0", true: "#FFD54F" }}
                thumbColor={settings.motivationalTips ? "#FFC107" : "#BDBDBD"}
                ios_backgroundColor="#E0E0E0"
              />
            </View>
          </View>
        </Animated.View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="information-circle" size={20} color="#2196F3" />
          <Text style={styles.infoText}>
            Interval range: {MIN_INTERVAL} - {MAX_INTERVAL} minutes
          </Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            saving && styles.buttonDisabled,
          ]}
          onPress={saveSettings}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#4CAF50", "#45a049"]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="save" size={20} color="#fff" />
                <Text style={styles.buttonText}>Save Settings</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleTestNotification}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Icon name="send" size={20} color="#2196F3" />
          <Text style={styles.secondaryButtonText}>Send Test Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tertiaryButton}
          onPress={resetToDefaults}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Icon name="refresh" size={20} color="#666" />
          <Text style={styles.tertiaryButtonText}>Reset to Defaults</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  headerGradient: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 12,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  successBanner: {
    backgroundColor: "#E8F5E9",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
    ...Platform.select({
      ios: {
        shadowColor: "#4CAF50",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  successText: {
    color: "#2E7D32",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
  },
  errorBanner: {
    backgroundColor: "#FFEBEE",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#f44336",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginLeft: 12,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  retryText: {
    color: "#2196F3",
    fontWeight: "600",
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginLeft: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
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
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#757575",
    lineHeight: 20,
  },
  highlightText: {
    fontWeight: "700",
    color: "#4CAF50",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    minWidth: 50,
  },
  inputLabel: {
    fontSize: 14,
    color: "#757575",
    fontWeight: "600",
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    marginTop: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 3,
  },
  infoCard: {
    backgroundColor: "#E3F2FD",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  infoText: {
    fontSize: 14,
    color: "#1565C0",
    marginLeft: 12,
    fontWeight: "500",
  },
  primaryButton: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#4CAF50",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 2,
    borderColor: "#2196F3",
  },
  secondaryButtonText: {
    color: "#2196F3",
    fontSize: 17,
    fontWeight: "700",
  },
  tertiaryButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  tertiaryButtonText: {
    color: "#666",
    fontSize: 17,
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 40,
  },
});