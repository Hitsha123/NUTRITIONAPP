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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart, PieChart, LineChart } from "react-native-chart-kit";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import RNFS from 'react-native-fs';

const SCREEN_WIDTH = Dimensions.get("window").width - 40;
const LAST_REFRESH_KEY = "last_analytics_refresh";

// WHO / CDC guidelines
const GUIDELINES = {
  calories: { min: 1800, max: 2400, optimal: 2000 },
  protein: { min: 50, max: 70, optimal: 60 },
  carbs: { min: 225, max: 325, optimal: 275 },
  fats: { min: 44, max: 78, optimal: 60 },
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
  const [selectedPeriod, setSelectedPeriod] = useState("weekly");
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
  
  const appState = useRef(AppState.currentState);
  const checkIntervalRef = useRef(null);

  // Request storage permission for Android
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          return true;
        }
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to storage to save PDF reports',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
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

  // Check if it's a new day and refresh if needed
  const checkAndRefreshIfNewDay = async () => {
    try {
      const lastRefresh = await AsyncStorage.getItem(LAST_REFRESH_KEY);
      const today = new Date().toISOString().split("T")[0];
      
      if (lastRefresh !== today) {
        console.log("New day detected, refreshing analytics...");
        await AsyncStorage.setItem(LAST_REFRESH_KEY, today);
        await fetchAnalyticsData();
      }
    } catch (error) {
      console.error("Error checking for new day:", error);
    }
  };

  // Handle app state changes
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

  // Set up interval to check for new day
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

      // Generate last 30 days keys
      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        last30Days.push(d.toISOString().split("T")[0]);
      }

      // Generate last 7 days keys
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

      // Count days with meals
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

      // Macro distribution
      const totalMacros = todaySum.protein + todaySum.carbs + todaySum.fats;
      if (totalMacros > 0) {
        setMacroDistribution([
          {
            name: "Protein",
            amount: todaySum.protein,
            color: "#8B5CF6",
            legendFontColor: "#333",
            legendFontSize: 13,
          },
          {
            name: "Carbs",
            amount: todaySum.carbs,
            color: "#3B82F6",
            legendFontColor: "#333",
            legendFontSize: 13,
          },
          {
            name: "Fats",
            amount: todaySum.fats,
            color: "#F59E0B",
            legendFontColor: "#333",
            legendFontSize: 13,
          },
        ]);
      } else {
        setMacroDistribution([]);
      }

      // Weekly chart data
      const weeklyLabels = [];
      const weeklyCalories = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split("T")[0];
        weeklyLabels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
        weeklyCalories.push(dailyTotals[key]?.calories || 0);
      }

      // Monthly chart data
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
      Alert.alert("❌ Error", "Failed to load analytics");
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
    return { status: "Good", color: "#10B981", icon: "check-circle", emoji: "✅" };
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
        mealRows = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px; font-style: italic;">No meals logged this day</td></tr>';
      } else {
        dayMeals.forEach((meal, idx) => {
          dayTotal.calories += Number(meal.calories) || 0;
          dayTotal.protein += Number(meal.protein) || 0;
          dayTotal.carbs += Number(meal.carbs) || 0;
          dayTotal.fats += Number(meal.fats) || 0;

          mealRows += `
            <tr>
              <td style="text-align: center; font-weight: 600; color: #6366F1;">${idx + 1}</td>
              <td style="font-weight: 500; color: #1F2937;">${meal.name || "Unnamed Meal"}</td>
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
                <th style="width: 50px; text-align: center;">#</th>
                <th>Food Item</th>
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
          * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
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
          
          .header p {
            font-size: 16px;
            opacity: 0.95;
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
            transition: transform 0.3s ease;
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
            letter-spacing: 0.5px;
          }
          
          .status-good { 
            background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); 
            color: #065F46; 
            border: 2px solid #10B981;
          }
          
          .status-low { 
            background: linear-gradient(135deg, #FED7AA 0%, #FDE68A 100%); 
            color: #92400E; 
            border: 2px solid #F97316;
          }
          
          .status-high { 
            background: linear-gradient(135deg, #FECACA 0%, #FCA5A5 100%); 
            color: #991B1B; 
            border: 2px solid #EF4444;
          }
          
          .target-info {
            font-size: 12px;
            color: #6B7280;
            margin-top: 8px;
            font-weight: 500;
          }
          
          .weekly-avg {
            background: linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%);
            padding: 25px;
            border-radius: 16px;
            margin-bottom: 35px;
            border: 3px solid #8B5CF6;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.2);
          }
          
          .weekly-avg h3 {
            color: #5B21B6;
            margin-bottom: 15px;
            font-size: 18px;
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
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.15);
          }
          
          .avg-item .label {
            font-size: 11px;
            color: #6B7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          
          .avg-item .value {
            font-size: 20px;
            font-weight: bold;
            color: #5B21B6;
          }
          
          .day-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
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
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          td {
            padding: 14px 12px;
            border-bottom: 1px solid #E5E7EB;
          }
          
          tbody tr:hover {
            background-color: #F9FAFB;
          }
          
          tbody tr:last-child td {
            border-bottom: none;
          }
          
          .footer {
            margin-top: 50px;
            padding-top: 25px;
            border-top: 3px solid #E5E7EB;
            text-align: center;
            color: #6B7280;
            font-size: 12px;
          }
          
          .footer p {
            margin: 5px 0;
          }
          
          @media print {
            body {
              background: white;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍎 Weekly Nutrition Report</h1>
          <p style="font-size: 18px; margin-top: 8px;">${dateRange}</p>
          <p style="font-size: 14px; margin-top: 8px; opacity: 0.9;">
            Generated on ${new Date().toLocaleDateString("en-US", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>🔥 Today's Calories</h3>
            <div class="value">${Math.round(todayTotals.calories)}</div>
            <span class="status status-${caloriesStatus.status.toLowerCase()}">${caloriesStatus.status}</span>
            <div class="target-info">Target: ${GUIDELINES.calories.optimal} kcal</div>
          </div>
          <div class="summary-card">
            <h3>💪 Today's Protein</h3>
            <div class="value">${Math.round(todayTotals.protein)}g</div>
            <span class="status status-${proteinStatus.status.toLowerCase()}">${proteinStatus.status}</span>
            <div class="target-info">Target: ${GUIDELINES.protein.optimal}g</div>
          </div>
          <div class="summary-card">
            <h3>🍞 Today's Carbohydrates</h3>
            <div class="value">${Math.round(todayTotals.carbs)}g</div>
            <span class="status status-${carbsStatus.status.toLowerCase()}">${carbsStatus.status}</span>
            <div class="target-info">Target: ${GUIDELINES.carbs.optimal}g</div>
          </div>
          <div class="summary-card">
            <h3>🥑 Today's Fats</h3>
            <div class="value">${Math.round(todayTotals.fats)}g</div>
            <span class="status status-${fatsStatus.status.toLowerCase()}">${fatsStatus.status}</span>
            <div class="target-info">Target: ${GUIDELINES.fats.optimal}g</div>
          </div>
        </div>

        <div class="weekly-avg">
          <h3>📊 Weekly Average (Last 7 Days)</h3>
          <div class="avg-grid">
            <div class="avg-item">
              <div class="label">🔥 Calories</div>
              <div class="value">${weeklyAverage.calories}</div>
            </div>
            <div class="avg-item">
              <div class="label">💪 Protein</div>
              <div class="value">${weeklyAverage.protein}g</div>
            </div>
            <div class="avg-item">
              <div class="label">🍞 Carbs</div>
              <div class="value">${weeklyAverage.carbs}g</div>
            </div>
            <div class="avg-item">
              <div class="label">🥑 Fats</div>
              <div class="value">${weeklyAverage.fats}g</div>
            </div>
          </div>
        </div>

        <h2 style="color: #10B981; margin-bottom: 25px; font-size: 26px; text-align: center;">
          📋 Detailed Daily Food Log
        </h2>
        
        ${mealsHTML}

        <div class="footer">
          <p style="font-weight: 600; margin-bottom: 8px;">🏥 Medical Disclaimer</p>
          <p>This report is generated from your nutrition tracking data for informational purposes only.</p>
          <p>Always consult with a qualified healthcare professional or registered dietitian for personalized dietary advice.</p>
          <p style="margin-top: 15px; font-style: italic;">Stay healthy and keep tracking! 💚</p>
        </div>
      </body>
      </html>
    `;
  };

  const exportAsPDF = async () => {
    try {
      setExporting(true);

      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert("❌ Permission Denied", "Storage permission is required to export PDF");
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
        "✅ Export Successful",
        `Report saved as:\n${fileName}\n\n${Platform.OS === 'android' ? 'Location: Downloads folder' : 'Location: Documents folder'}`,
        [
          { text: "OK" },
          {
            text: "📤 Share",
            onPress: async () => {
              try {
                await Share.share({
                  url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
                  title: '📊 Nutrition Report',
                  message: '🍎 My weekly nutrition report',
                });
              } catch (shareError) {
                console.error('Share error:', shareError);
              }
            },
          },
        ]
      );

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        "❌ Export Failed", 
        `Could not export report.\n\nError: ${error.message}\n\nTip: Make sure you have granted storage permissions in your device settings.`
      );
    } finally {
      setExporting(false);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        message:
          `📊 Today's Nutrition Summary\n\n` +
          `🔥 Calories: ${Math.round(todayTotals.calories)} kcal\n` +
          `💪 Protein: ${Math.round(todayTotals.protein)}g\n` +
          `🍞 Carbs: ${Math.round(todayTotals.carbs)}g\n` +
          `🥑 Fats: ${Math.round(todayTotals.fats)}g\n\n` +
          `📈 Weekly Average:\n` +
          `${weeklyAverage.calories} kcal | ${weeklyAverage.protein}g protein | ${weeklyAverage.carbs}g carbs | ${weeklyAverage.fats}g fats`,
      });
    } catch (e) {
      Alert.alert("❌ Error", e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>⏳ Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main analytics screen
  const chartData =
    selectedPeriod === "weekly" ? reportData.weekly : reportData.monthly;

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
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>📊 Health Analytics</Text>
              <Text style={styles.subtitle}>Track your nutrition journey</Text>
            </View>
            <TouchableOpacity 
              onPress={onRefresh}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshButtonText}>🔄</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TODAY'S NUTRITION SUMMARY */}
        <Text style={styles.sectionTitle}>📊 Today's Intake</Text>
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
                <Text style={styles.summaryLabel}>{item.label}</Text>
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
            <Text style={styles.weeklyAvgTitle}>Weekly Average</Text>
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
            { key: "weekly", label: "7 Days", emoji: "📅" },
            { key: "monthly", label: "30 Days", emoji: "📆" }
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
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calorie Chart */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartEmoji}>📊</Text>
            <Text style={styles.chartTitle}>Calorie Intake Trends</Text>
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
            👆 Swipe to explore {selectedPeriod === "weekly" ? "7" : "30"} days of data
          </Text>
        </View>

        {/* Macro Distribution */}
        {macroDistribution.length > 0 && (
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartEmoji}>🥧</Text>
              <Text style={styles.chartTitle}>Today's Macro Distribution</Text>
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
                <Text style={styles.btnText}>⏳ Generating...</Text>
              </>
            ) : (
              <>
                <Text style={styles.btnEmoji}>📄</Text>
                <Text style={styles.btnText}>Export Report</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn]}
            onPress={onShare}
          >
            <Text style={styles.btnEmoji}>📤</Text>
            <Text style={styles.btnText}>Share Summary</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Tip: Pull down to refresh your analytics
          </Text>
          <Text style={styles.footerSubtext}>
            🌙 Data updates automatically at midnight
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
    backgroundColor: "#F9FAFB"
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "500",
  },
  headerContainer: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  refreshButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#D1FAE5",
  },
  refreshButtonText: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    borderLeftWidth: 4,
  },
  cardEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  unit: {
    fontSize: 18,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginBottom: 8,
  },
  statusEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    marginLeft: 5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  targetText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  weeklyAvgCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#F59E0B",
    elevation: 2,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  weeklyAvgHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  weeklyAvgEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  weeklyAvgTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#92400E",
  },
  avgGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  avgItem: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: "center",
  },
  avgEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  avgLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 6,
    fontWeight: "600",
  },
  avgValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#92400E",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
    backgroundColor: "#E5E7EB",
    borderRadius: 15,
    padding: 4,
  },
  switchBtn: {
    flex: 1,
    flexDirection: "row",
    padding: 14,
    marginHorizontal: 3,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  switchActive: {
    backgroundColor: "#10B981",
    elevation: 3,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  switchText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
  switchEmoji: {
    fontSize: 18,
    marginRight: 4,
  },
  switchTextActive: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 6,
  },
  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  chartEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1F2937",
  },
  chartScrollView: {
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
  },
  chartHint: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    padding: 18,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  pdfBtn: {
    backgroundColor: "#EF4444",
  },
  shareBtn: {
    backgroundColor: "#3B82F6",
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 10,
    fontSize: 15,
  },
  btnEmoji: {
    fontSize: 22,
  },
  footer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  footerSubtext: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
});