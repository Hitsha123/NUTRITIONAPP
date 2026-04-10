import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

const APP_STATS = [
  { value: "500+", label: "🍎 Foods Listed" },
  { value: "4", label: "📊 Macro Trackers" },
  { value: "30", label: "📅 Days History" },
  { value: "100%", label: "💚 Free to Use" },
];

export default function AboutTeamScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A7A4A" />

      {/* Header */}
      <View style={styles.header}>
        {navigation && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>⬅️</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>👥 About Us</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <Animated.View
          style={[
            styles.heroBanner,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.appBadge}>
            <Text style={styles.appBadgeText}>🥜 NUTS</Text>
            <Text style={styles.appBadgeSubtext}>Nutrition App</Text>
          </View>
          <Text style={styles.heroTagline}>
            🌟 Built with passion for healthy living!
          </Text>
        </Animated.View>

        {/* Team Photo Placeholder */}
        <Animated.View
          style={[
            styles.photoSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Text style={styles.photoHeaderEmoji}>👥</Text>
              <Text style={styles.photoHeaderTitle}>🤝 Friends of NUTS</Text>
            </View>

                    <Image
source={require('./assets/team_photo.jpg')}
              style={styles.teamPhoto}
              resizeMode="cover"
            />

            <View style={styles.photoCaption}>
              <Text style={styles.photoCaptionEmoji}>🎓</Text>
              <Text style={styles.photoCaptionText}>
               Well Wishers & Testers NUTS Nutrition App 💪✨
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* App Stats */}
        <Animated.View style={[styles.statsSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>📊 App in Numbers</Text>
          <View style={styles.statsGrid}>
            {APP_STATS.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Mission Box */}
        <Animated.View style={[styles.missionBox, { opacity: fadeAnim }]}>
          <Text style={styles.missionEmoji}>🎯</Text>
          <Text style={styles.missionTitle}>Our Mission</Text>
          <Text style={styles.missionText}>
            🌱 To make nutrition tracking simple, fun, and accessible for
            everyone. We believe healthy eating starts with awareness — and
            NUTS is here to guide you every step of the way! 💪🥗
          </Text>
        </Animated.View>

        {/* Tech Stack */}
        <View style={styles.techSection}>
          <Text style={styles.sectionTitle}>🛠️ Built With</Text>
          <View style={styles.techGrid}>
            {[
              { emoji: "⚛️", name: "React Native" },
              { emoji: "📱", name: "Android" },
              { emoji: "💾", name: "AsyncStorage" },
              { emoji: "📊", name: "Chart Kit" },
              { emoji: "🎨", name: "Custom UI" },
              { emoji: "💚", name: "Open Source" },
            ].map((tech, i) => (
              <View key={i} style={styles.techBadge}>
                <Text style={styles.techEmoji}>{tech.emoji}</Text>
                <Text style={styles.techName}>{tech.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerEmoji}>🥜</Text>
          <Text style={styles.footerTitle}>NUTS Nutrition App</Text>
          <Text style={styles.footerVersion}>📦 Version 1.0.0</Text>
          <Text style={styles.footerCopyright}>
            ❤️ Made with love by the team • 2026
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#10B981",
    elevation: 4,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Hero Banner
  heroBanner: {
    backgroundColor: "#10B981",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
    elevation: 6,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  appBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  appBadgeText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    letterSpacing: 2,
  },
  appBadgeSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 1,
  },
  heroTagline: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
    textAlign: "center",
  },

  // Photo Section
  photoSection: {
    marginBottom: 24,
  },
  photoCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    backgroundColor: "#F0FDF4",
    borderBottomWidth: 1,
    borderBottomColor: "#D1FAE5",
  },
  photoHeaderEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  photoHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#065F46",
  },

  // Photo
  teamPhoto: {
    width: "100%",
    height: 260,
  },

  photoCaption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F0FDF4",
    borderTopWidth: 1,
    borderTopColor: "#D1FAE5",
  },
  photoCaptionEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  photoCaptionText: {
    flex: 1,
    fontSize: 14,
    color: "#065F46",
    fontWeight: "600",
  },

  // Stats Section
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 4,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
    elevation: 3,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  statValue: {
    fontSize: 30,
    fontWeight: "900",
    color: "#10B981",
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
  },

  // Mission Box
  missionBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#A7F3D0",
    elevation: 2,
  },
  missionEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#065F46",
    marginBottom: 12,
  },
  missionText: {
    fontSize: 15,
    color: "#047857",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },

  // Tech Stack
  techSection: {
    marginBottom: 24,
  },
  techGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  techBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  techEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  techName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  footerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#10B981",
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
    marginBottom: 8,
  },
  footerCopyright: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
});