import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Animated,
  StatusBar,
} from 'react-native';
import { 
  loginUser, 
  resetPassword, 
  sendVerificationCode, 
  confirmVerificationCode,
  signInWithGoogle
} from './AuthService';

const { width, height } = Dimensions.get('window');

// ==================== VALIDATION UTILITIES ====================

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const validatePhoneNumber = (phone) => {
  // Validates international format: +[country code][number]
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.trim());
};

const formatPhoneNumber = (text) => {
  // Remove all non-digit characters except +
  let cleaned = text.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (cleaned && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};

// ==================== MAIN COMPONENT ====================

export default function LoginScreen({ navigation }) {
  // ========== STATE MANAGEMENT ==========
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loginMode, setLoginMode] = useState('email'); // 'email', 'phone', or 'codeSent'
  const [showPassword, setShowPassword] = useState(false);
  
  // Error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  
  // Countdown timer for resend code
  const [resendTimer, setResendTimer] = useState(0);
  
  // Refs
  const passwordInputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // ========== EFFECTS ==========

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Resend timer countdown
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // ========== INPUT HANDLERS ==========

  const handleEmailChange = (text) => {
    setEmail(text);
    if (text && !validateEmail(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    if (text && text.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  };

  const handlePhoneChange = (text) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
    
    if (formatted && !validatePhoneNumber(formatted)) {
      setPhoneError('Enter phone in format: +1234567890');
    } else {
      setPhoneError('');
    }
  };

  const handleCodeChange = (text) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    setVerificationCode(cleaned);
    
    if (cleaned && cleaned.length < 6) {
      setCodeError('Verification code must be 6 digits');
    } else {
      setCodeError('');
    }
  };

  // ========== VALIDATION ==========

  const validateEmailLogin = () => {
    let isValid = true;

    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  // ========== AUTH HANDLERS ==========

  const handleEmailLogin = async () => {
    Keyboard.dismiss();

    if (!validateEmailLogin()) {
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      await loginUser(trimmedEmail, password);
      
      // Clear form
      setEmail('');
      setPassword('');
      
      // Success animation
      Alert.alert('Welcome Back! 🎉', 'Login successful!', [
        { 
          text: 'Continue', 
          onPress: () => navigation.replace('HomeScreen')
        }
      ]);
    } catch (error) {
      setLoading(false);
      
      // Handle specific Firebase errors
      let errorMessage = error.message;
      let errorTitle = 'Login Failed';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please register first.';
        setEmailError(errorMessage);
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
        setPasswordError(errorMessage);
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
        setEmailError(errorMessage);
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
        errorTitle = 'Too Many Attempts';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
        errorTitle = 'Connection Error';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid credentials. Please check your email and password.';
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
  };

  const handleGoogleSignIn = async () => {
    Keyboard.dismiss();
    setGoogleLoading(true);
    
    try {
      // Call the Google Sign-In function
      const result = await signInWithGoogle();
      
      // Success
      Alert.alert(
        'Welcome! 🎉', 
        'Signed in successfully with Google',
        [
          { 
            text: 'Continue', 
            onPress: () => navigation.replace('HomeScreen')
          }
        ]
      );
    } catch (error) {
      setGoogleLoading(false);
      
      let errorMessage = error.message;
      let errorTitle = 'Google Sign-In Failed';
      
      // Handle specific error codes
      if (error.code === 'auth/popup-closed-by-user' || 
          error.code === 'auth/cancelled' ||
          error.code === 'auth/user-cancelled') {
        // User cancelled - don't show error
        return;
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
        errorTitle = 'Connection Error';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email using a different sign-in method. Please use that method to sign in.';
        errorTitle = 'Account Exists';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Sign-in popup was blocked. Please allow popups for this site.';
        errorTitle = 'Popup Blocked';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google sign-in is not enabled. Please contact support.';
        errorTitle = 'Not Enabled';
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
  };

  const handleSendCode = async () => {
    Keyboard.dismiss();

    if (!phoneNumber.trim()) {
      setPhoneError('Phone number is required');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError('Please enter a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    setLoading(true);
    try {
      const confirmation = await sendVerificationCode(phoneNumber.trim());
      setConfirmationResult(confirmation);
      setLoginMode('codeSent');
      setResendTimer(60); // 60 second cooldown
      setLoading(false);
      
      Alert.alert(
        'Code Sent! 📱',
        'A 6-digit verification code has been sent to your phone.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      setLoading(false);
      
      let errorMessage = error.message;
      let errorTitle = 'Error Sending Code';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format. Please use international format: +1234567890';
        setPhoneError(errorMessage);
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again in a few minutes.';
        errorTitle = 'Too Many Requests';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later or use email login.';
        errorTitle = 'Quota Exceeded';
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
  };

  const handleVerifyCode = async () => {
    Keyboard.dismiss();

    if (!verificationCode) {
      setCodeError('Verification code is required');
      return;
    }

    if (verificationCode.length !== 6) {
      setCodeError('Verification code must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      await confirmVerificationCode(confirmationResult, verificationCode);
      
      // Clear form
      setPhoneNumber('');
      setVerificationCode('');
      
      Alert.alert('Welcome! 🎉', 'Login successful!', [
        { 
          text: 'Continue', 
          onPress: () => navigation.replace('HomeScreen')
        }
      ]);
    } catch (error) {
      setLoading(false);
      
      let errorMessage = error.message;
      let errorTitle = 'Verification Failed';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code. Please check and try again.';
        setCodeError(errorMessage);
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Verification code has expired. Please request a new one.';
        setCodeError(errorMessage);
        errorTitle = 'Code Expired';
      }
      
      Alert.alert(errorTitle, errorMessage);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address first to reset your password.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send password reset link to:\n${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            setLoading(true);
            try {
              await resetPassword(email.trim().toLowerCase());
              Alert.alert(
                'Email Sent! 📧',
                'A password reset link has been sent to your email address. Please check your inbox and spam folder.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              let errorMessage = error.message;
              
              if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address.';
              } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address format.';
              } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please try again later.';
              }
              
              Alert.alert('Error', errorMessage);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // ========== MODE SWITCHING ==========

  const switchToMode = (mode) => {
    setLoginMode(mode);
    setConfirmationResult(null);
    setResendTimer(0);
    
    // Clear all errors
    setEmailError('');
    setPasswordError('');
    setPhoneError('');
    setCodeError('');
    
    Keyboard.dismiss();
  };

  const handleResendCode = () => {
    if (resendTimer > 0) return;
    handleSendCode();
  };

  // ========== RENDER ==========

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#E8F5E9" />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <Animated.View 
          style={[
            styles.contentWrapper, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🥗</Text>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>
              Sign in to continue your nutrition journey
            </Text>
          </View>
          
          {/* Google Sign-In Button */}
          {loginMode !== 'codeSent' && (
            <TouchableOpacity
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || loading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <ActivityIndicator color="#4285F4" size="small" />
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Divider */}
          {loginMode !== 'codeSent' && (
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
          )}
          
          {/* Toggle between Email and Phone */}
          {loginMode !== 'codeSent' && (
            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                style={[
                  styles.toggleButton, 
                  loginMode === 'email' && styles.activeToggleButton
                ]} 
                onPress={() => switchToMode('email')}
                disabled={loading || googleLoading}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.toggleButtonText, 
                  loginMode === 'email' && styles.activeToggleButtonText
                ]}>
                  📧 Email
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.toggleButton, 
                  loginMode === 'phone' && styles.activeToggleButton
                ]} 
                onPress={() => switchToMode('phone')}
                disabled={loading || googleLoading}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.toggleButtonText, 
                  loginMode === 'phone' && styles.activeToggleButtonText
                ]}>
                  📱 Phone
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Email/Password Form */}
          {loginMode === 'email' && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, emailError && styles.inputError]}
                  placeholder="your.email@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!loading && !googleLoading}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
                {emailError ? (
                  <Text style={styles.errorText}>❌ {emailError}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    ref={passwordInputRef}
                    style={[styles.passwordInput, passwordError && styles.inputError]}
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    editable={!loading && !googleLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleEmailLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading || googleLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <Text style={styles.errorText}>❌ {passwordError}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (loading || googleLoading) && styles.buttonDisabled]}
                onPress={handleEmailLogin}
                disabled={loading || googleLoading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotPasswordButton}
                disabled={loading || googleLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Phone Auth Form */}
          {loginMode === 'phone' && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[styles.input, phoneError && styles.inputError]}
                  placeholder="+1 (555) 123-4567"
                  placeholderTextColor="#9CA3AF"
                  value={phoneNumber}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  editable={!loading && !googleLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleSendCode}
                />
                {phoneError ? (
                  <Text style={styles.errorText}>❌ {phoneError}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    💡 Include country code (e.g., +1 for US)
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (loading || googleLoading) && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={loading || googleLoading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Verification Code</Text>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  📱 We'll send a 6-digit verification code to your phone via SMS
                </Text>
              </View>
            </View>
          )}

          {/* Code Verification Form */}
          {loginMode === 'codeSent' && (
            <View style={styles.formContainer}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeEmoji}>📱</Text>
                <Text style={styles.codeTitle}>Verify Your Phone</Text>
                <Text style={styles.codeSubtitle}>
                  We sent a code to
                </Text>
                <Text style={styles.phoneDisplay}>{phoneNumber}</Text>
                <TouchableOpacity
                  onPress={() => switchToMode('phone')}
                  style={styles.changeNumberButton}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeNumberText}>Change Number</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.codeInput, codeError && styles.inputError]}
                  placeholder="000000"
                  placeholderTextColor="#D1D5DB"
                  value={verificationCode}
                  onChangeText={handleCodeChange}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyCode}
                  autoFocus={true}
                />
                {codeError ? (
                  <Text style={styles.errorText}>❌ {codeError}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendCode}
                style={styles.resendButton}
                disabled={loading || resendTimer > 0}
                activeOpacity={0.7}
              >
                <Text 
                  style={[
                    styles.resendText,
                    (loading || resendTimer > 0) && styles.resendTextDisabled
                  ]}
                >
                  {resendTimer > 0 
                    ? `Resend code in ${resendTimer}s` 
                    : '🔄 Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => !loading && !googleLoading && navigation.navigate('RegisterScreen')}
              disabled={loading || googleLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLink}>Register here</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  contentWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 28,
    width: width * 0.92,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DADCE0',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: '#3C4043',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 28,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
    transition: 'all 0.3s ease',
  },
  activeToggleButton: {
    backgroundColor: '#4CAF50',
  },
  toggleButtonText: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 15,
  },
  activeToggleButtonText: {
    color: '#FFFFFF',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 22,
  },
  label: {
    marginBottom: 10,
    fontWeight: '700',
    color: '#374151',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    paddingRight: 55,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 8,
  },
  eyeIcon: {
    fontSize: 22,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 18,
    backgroundColor: '#F9FAFB',
    fontSize: 28,
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 12,
    fontWeight: '700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '600',
  },
  helperText: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    color: '#1E40AF',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  codeHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  codeEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  codeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  codeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  phoneDisplay: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '700',
    marginBottom: 12,
  },
  changeNumberButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changeNumberText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  forgotPasswordText: {
    color: '#2196F3',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resendText: {
    color: '#2196F3',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  resendTextDisabled: {
    color: '#9CA3AF',
    textDecorationLine: 'none',
  },
  registerContainer: {
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
  registerLink: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});