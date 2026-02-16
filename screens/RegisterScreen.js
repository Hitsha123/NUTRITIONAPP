import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Animated
} from 'react-native';
import { registerUser } from './AuthService';
import { db } from './firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// Validation utilities
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const validatePassword = (password) => {
  return {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
};

const getPasswordStrength = (password) => {
  const checks = validatePassword(password);
  const score = Object.values(checks).filter(Boolean).length;
  
  if (score <= 2) return { strength: 'Weak', color: '#EF4444' };
  if (score <= 3) return { strength: 'Fair', color: '#F59E0B' };
  if (score <= 4) return { strength: 'Good', color: '#10B981' };
  return { strength: 'Strong', color: '#059669' };
};

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Real-time validation
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
    const checks = validatePassword(text);
    
    if (text && !checks.minLength) {
      setPasswordError('Password must be at least 8 characters');
    } else if (text && (!checks.hasUpperCase || !checks.hasLowerCase || !checks.hasNumber)) {
      setPasswordError('Include uppercase, lowercase, and numbers');
    } else {
      setPasswordError('');
    }

    // Check confirm password match if it exists
    if (confirmPassword && text !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    if (text && text !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleNameChange = (text) => {
    setFullName(text);
    if (text && text.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
    } else {
      setNameError('');
    }
  };

  const validateForm = () => {
    let isValid = true;

    // Trim whitespace
    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setNameError('Full name is required');
      isValid = false;
    } else if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      isValid = false;
    }

    if (!trimmedEmail) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else {
      const checks = validatePassword(password);
      if (!checks.minLength) {
        setPasswordError('Password must be at least 8 characters');
        isValid = false;
      } else if (!checks.hasUpperCase || !checks.hasLowerCase || !checks.hasNumber) {
        setPasswordError('Password must include uppercase, lowercase, and numbers');
        isValid = false;
      }
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = fullName.trim();

      const { uid } = await registerUser(trimmedEmail, password);

      // Save user profile to Firestore
      await setDoc(doc(db, 'users', uid), {
        email: trimmedEmail,
        name: trimmedName,
        displayName: trimmedName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        profile: {
          isComplete: false,
          photoURL: null,
        },
        preferences: {
          notifications: true,
          theme: 'light',
        }
      });

      setIsLoading(false);

      Alert.alert(
        'Success! 🎉',
        `Welcome, ${trimmedName}! Your account has been created successfully.`,
        [
          {
            text: 'Get Started',
            onPress: () => navigation.replace('LoginScreen'),
          }
        ]
      );

      // Clear form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      
    } catch (error) {
      setIsLoading(false);
      
      // Handle specific Firebase errors
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please login instead.';
        setEmailError(errorMessage);
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
        setEmailError(errorMessage);
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
        setPasswordError(errorMessage);
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      Alert.alert('Registration Failed', errorMessage);
    }
  };

  const passwordStrength = password ? getPasswordStrength(password) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Join Us!</Text>
          <Text style={styles.subtitle}>
            Create your account to start tracking your nutrition journey.
          </Text>

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              placeholder="John Doe"
              placeholderTextColor="#999"
              style={[styles.input, nameError && styles.inputError]}
              value={fullName}
              onChangeText={handleNameChange}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              placeholder="your.email@example.com"
              placeholderTextColor="#999"
              style={[styles.input, emailError && styles.inputError]}
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              ref={passwordInputRef}
              onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
              blurOnSubmit={false}
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#999"
                style={[styles.passwordInput, passwordError && styles.inputError]}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                ref={confirmPasswordInputRef}
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}
            
            {/* Password Strength Indicator */}
            {password && !passwordError && passwordStrength ? (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${(Object.values(validatePassword(password)).filter(Boolean).length / 5) * 100}%`,
                        backgroundColor: passwordStrength.color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.strength}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#999"
                style={[styles.passwordInput, confirmPasswordError && styles.inputError]}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={!showConfirmPassword}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPasswordError ? (
              <Text style={styles.errorText}>{confirmPasswordError}</Text>
            ) : null}
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password must contain:</Text>
            <Text style={styles.requirementItem}>• At least 8 characters</Text>
            <Text style={styles.requirementItem}>• Uppercase and lowercase letters</Text>
            <Text style={styles.requirementItem}>• At least one number</Text>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text
                style={styles.loginLink}
                onPress={() => !isLoading && navigation.navigate('LoginScreen')}
              >
                Login here
              </Text>
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 25,
    width: width * 0.9,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontWeight: '700',
    color: '#333',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 15,
    paddingRight: 50,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    padding: 5,
  },
  eyeIcon: {
    fontSize: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 5,
    marginLeft: 5,
  },
  strengthContainer: {
    marginTop: 10,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  requirementsContainer: {
    backgroundColor: '#F0F9FF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 12,
    color: '#1E40AF',
    marginBottom: 4,
  },
  registerButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loginContainer: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  loginText: {
    textAlign: 'center',
    color: '#777',
    fontSize: 15,
  },
  loginLink: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});