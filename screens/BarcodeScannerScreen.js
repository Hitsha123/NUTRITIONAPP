import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
  Platform,
  StatusBar,
  Dimensions
} from "react-native";
import { 
  Camera, 
  useCameraDevice, 
  useCameraPermission, 
  useCodeScanner 
} from "react-native-vision-camera";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import products from "./products.json";

const { width, height } = Dimensions.get("window");
const SCANNER_SIZE = Math.min(width * 0.75, 300);

export default function BarcodeScannerScreen({ navigation }) {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [foundProduct, setFoundProduct] = useState(null);
  
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cornerAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const lastScannedCode = useRef(null);
  const scanCooldown = useRef(false);

  // Request permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Animated scanning line and corners
  useEffect(() => {
    if (!scanned && hasPermission) {
      // Scanning line animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Corner pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(cornerAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(cornerAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Instruction pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
    }

    return () => {
      scanLineAnim.setValue(0);
      cornerAnim.setValue(0);
      pulseAnim.setValue(1);
    };
  }, [scanned, hasPermission]);

  // Success animation
  const playSuccessAnimation = () => {
    Animated.parallel([
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  // Handle barcode scan with debouncing and cooldown
  const handleCodeScanned = useCallback((codes) => {
    if (scanned || isProcessing || scanCooldown.current) return;

    const scannedCode = codes[0]?.value;
    if (!scannedCode) return;

    // Prevent duplicate scans of same code
    if (scannedCode === lastScannedCode.current) return;

    setIsProcessing(true);
    setScanned(true);
    scanCooldown.current = true;

    // Haptic feedback
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate(100);
    }

    lastScannedCode.current = scannedCode;

    // Simulate processing delay for better UX
    setTimeout(() => {
      const product = products.find(p => p.code === scannedCode);

      if (!product) {
        setIsProcessing(false);
        Alert.alert(
          "❌ Product Not Found", 
          `No product information available for barcode:\n${scannedCode}`,
          [
            { 
              text: "Scan Again", 
              onPress: () => {
                setScanned(false);
                lastScannedCode.current = null;
                successAnim.setValue(0);
                setTimeout(() => {
                  scanCooldown.current = false;
                }, 500);
              },
              style: "default"
            },
            {
              text: "Cancel",
              onPress: () => {
                setScanned(false);
                lastScannedCode.current = null;
                successAnim.setValue(0);
                navigation.goBack();
              },
              style: "cancel"
            }
          ]
        );
      } else {
        setFoundProduct(product);
        playSuccessAnimation();
        
        setTimeout(() => {
          setIsProcessing(false);
          navigation.navigate("ProductDetailsScreen", { product });
          
          // Reset state when returning to scanner
          setTimeout(() => {
            setScanned(false);
            setFoundProduct(null);
            lastScannedCode.current = null;
            scanCooldown.current = false;
            successAnim.setValue(0);
            scaleAnim.setValue(1);
          }, 300);
        }, 1000);
      }
    }, 300);
  }, [scanned, isProcessing, navigation, successAnim, scaleAnim]);

  const codeScanner = useCodeScanner({
    codeTypes: ["ean-13", "ean-8", "upc-a", "upc-e", "qr", "code-128", "code-39"],
    onCodeScanned: handleCodeScanned,
  });

  // Manual reset function
  const handleReset = useCallback(() => {
    setScanned(false);
    setIsProcessing(false);
    setFoundProduct(null);
    lastScannedCode.current = null;
    scanCooldown.current = false;
    successAnim.setValue(0);
    scaleAnim.setValue(1);
  }, [successAnim, scaleAnim]);

  // Request permission handler
  const handleRequestPermission = async () => {
    setPermissionLoading(true);
    try {
      const result = await requestPermission();
      if (!result) {
        Alert.alert(
          "Permission Denied",
          "Camera access is required to scan barcodes. Please enable it in your device settings.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Permission request error:", error);
      Alert.alert("Error", "Failed to request camera permission");
    } finally {
      setPermissionLoading(false);
    }
  };

  // Permission denied state
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <LinearGradient
          colors={["#667eea15", "#764ba215"]}
          style={styles.errorIconContainer}
        >
          <Icon name="camera-off" size={64} color="#667eea" />
        </LinearGradient>
        <Text style={styles.errorTitle}>Camera Access Required</Text>
        <Text style={styles.errorMessage}>
          To scan product barcodes, we need access to your camera. This allows you to quickly add products to your meal log.
        </Text>
        <TouchableOpacity 
          style={[styles.primaryButton, permissionLoading && styles.buttonDisabled]}
          onPress={handleRequestPermission}
          disabled={permissionLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={permissionLoading ? ["#95a5a6", "#7f8c8d"] : ["#667eea", "#764ba2"]}
            style={styles.buttonGradient}
          >
            {permissionLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="check-circle" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Grant Permission</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.textButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No camera device
  if (!device) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <LinearGradient
          colors={["#EF444415", "#DC262615"]}
          style={styles.errorIconContainer}
        >
          <Icon name="camera-off-outline" size={64} color="#EF4444" />
        </LinearGradient>
        <Text style={styles.errorTitle}>Camera Not Available</Text>
        <Text style={styles.errorMessage}>
          Unable to access the back camera on this device. Please check your device settings.
        </Text>
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Icon name="arrow-left" size={20} color="#667eea" />
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 4],
  });

  const cornerOpacity = cornerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned && !isProcessing}
        codeScanner={codeScanner}
      />

      {/* Dark overlay */}
      <View style={styles.overlay} pointerEvents="none">
        {/* Top section */}
        <View style={styles.overlaySection} />
        
        {/* Scanner window */}
        <View style={styles.scannerRow}>
          <View style={styles.overlaySection} />
          <Animated.View 
            style={[
              styles.scannerWindow,
              {
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            {/* Corner brackets */}
            <Animated.View 
              style={[
                styles.corner, 
                styles.topLeft,
                { opacity: cornerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.corner, 
                styles.topRight,
                { opacity: cornerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.corner, 
                styles.bottomLeft,
                { opacity: cornerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.corner, 
                styles.bottomRight,
                { opacity: cornerOpacity }
              ]} 
            />
            
            {/* Animated scan line */}
            {!scanned && !isProcessing && (
              <Animated.View 
                style={[
                  styles.scanLine,
                  {
                    transform: [{ translateY: scanLineTranslateY }],
                    opacity: fadeAnim,
                  }
                ]} 
              />
            )}

            {/* Success checkmark */}
            {foundProduct && (
              <Animated.View
                style={[
                  styles.successOverlay,
                  {
                    opacity: successAnim,
                    transform: [
                      {
                        scale: successAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={["#10B98190", "#059669"]}
                  style={styles.successCircle}
                >
                  <Icon name="check-bold" size={64} color="#fff" />
                </LinearGradient>
              </Animated.View>
            )}
          </Animated.View>
          <View style={styles.overlaySection} />
        </View>
        
        {/* Bottom section */}
        <View style={styles.overlaySection} />
      </View>

      {/* Top bar with navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.6)", "rgba(0, 0, 0, 0.4)"]}
            style={styles.iconButton}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0.5)"]}
            style={styles.titleContainer}
          >
            <Icon name="barcode-scan" size={20} color="#fff" />
            <Text style={styles.topBarTitle}>Barcode Scanner</Text>
          </LinearGradient>
        </View>

        <View style={{ width: 50 }} />
      </View>

      {/* Instructions */}
      <Animated.View 
        style={[
          styles.instructionsContainer, 
          { 
            opacity: fadeAnim,
            transform: [{ scale: pulseAnim }]
          }
        ]}
        pointerEvents="none"
      >
        {!scanned && !isProcessing && (
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.85)", "rgba(0, 0, 0, 0.70)"]}
            style={styles.instructionBox}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="barcode" size={32} color="#00FF88" />
            <Text style={styles.instructionTitle}>Position Barcode</Text>
            <Text style={styles.instructionText}>
              Align the barcode within the green frame
            </Text>
          </LinearGradient>
        )}
        
        {isProcessing && !foundProduct && (
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.9)", "rgba(0, 0, 0, 0.75)"]}
            style={styles.processingBox}
          >
            <ActivityIndicator color="#00FF88" size="small" />
            <Text style={styles.processingText}>Scanning...</Text>
          </LinearGradient>
        )}

        {foundProduct && (
          <Animated.View
            style={{
              opacity: successAnim,
            }}
          >
            <LinearGradient
              colors={["rgba(16, 185, 129, 0.95)", "rgba(5, 150, 105, 0.85)"]}
              style={styles.successBox}
            >
              <Icon name="check-circle" size={24} color="#fff" />
              <Text style={styles.successText}>Product Found!</Text>
              <Text style={styles.successSubtext}>{foundProduct.name}</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </Animated.View>

      {/* Bottom info panel */}
      <View style={styles.bottomPanel}>
        <LinearGradient
          colors={["rgba(0, 0, 0, 0.85)", "rgba(0, 0, 0, 0.70)"]}
          style={styles.bottomPanelGradient}
        >
          <View style={styles.infoRow}>
            <Icon name="information-outline" size={18} color="#00FF88" />
            <Text style={styles.infoText}>
              Supports all standard barcode formats
            </Text>
          </View>
          
          {scanned && !isProcessing && !foundProduct && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Icon name="reload" size={18} color="#fff" />
              <Text style={styles.resetButtonText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 32,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    minWidth: 220,
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  buttonGradient: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#667eea',
    gap: 10,
  },
  secondaryButtonText: {
    color: '#667eea',
    fontSize: 17,
    fontWeight: '700',
  },
  textButton: {
    marginTop: 20,
    paddingVertical: 12,
  },
  textButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlaySection: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  scannerRow: {
    flexDirection: 'row',
    height: SCANNER_SIZE,
  },
  scannerWindow: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderColor: '#00FF88',
    borderWidth: 5,
    borderRadius: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00FF88',
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backButton: {
    width: 50,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  instructionsContainer: {
    position: 'absolute',
    top: height * 0.5 + SCANNER_SIZE * 0.5 + 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionBox: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  instructionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  processingBox: {
    paddingHorizontal: 36,
    paddingVertical: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  processingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  successBox: {
    paddingHorizontal: 36,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  successText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  successSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomPanelGradient: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});