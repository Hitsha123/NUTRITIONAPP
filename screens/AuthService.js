import auth from '@react-native-firebase/auth';
import { 
  GoogleSignin, 
  statusCodes 
} from '@react-native-google-signin/google-signin';

// ==================== GOOGLE SIGN-IN CONFIGURATION ====================
GoogleSignin.configure({
  webClientId: '217520693624-s14nk9a0hb5m9c9kjr7m9818rmfaj91g.apps.googleusercontent.com',
  offlineAccess: true,
});

// ==================== EMAIL/PASSWORD AUTHENTICATION ====================

export const registerUser = async (email, password) => {
  const userCredential = await auth().createUserWithEmailAndPassword(email, password);
  const { user } = userCredential;
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName || '',
  };
};

export const loginUser = async (email, password) => {
  const userCredential = await auth().signInWithEmailAndPassword(email, password);
  const { user } = userCredential;
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName || '',
  };
};

export const resetPassword = async (email) => {
  return auth().sendPasswordResetEmail(email);
};

// ==================== PHONE AUTHENTICATION ====================

export const sendVerificationCode = async (phoneNumber) => {
  const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
  return confirmation;
};

export const confirmVerificationCode = async (confirmation, code) => {
  const userCredential = await confirmation.confirm(code);
  const { user } = userCredential;
  return {
    uid: user.uid,
    email: user.email || '',
    name: user.displayName || '',
  };
};

// ==================== GOOGLE SIGN-IN ====================

export const signInWithGoogle = async () => {
  try {
    // Sign out from both Google AND Firebase first to force account picker
    try {
      await GoogleSignin.signOut();
      await auth().signOut();
    } catch (signOutError) {
      console.log('Sign out before sign in:', signOutError.message);
    }
    
    // Check if device supports Google Play Services
    await GoogleSignin.hasPlayServices({ 
      showPlayServicesUpdateDialog: true 
    });
    
    // Get user's ID token (will always show account picker)
    const signInResult = await GoogleSignin.signIn();
    console.log('Google Sign-In Result:', signInResult); // Debug log
    
    const { idToken } = signInResult;
    
    // Create a Google credential with the token
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    
    // Sign in to Firebase with the Google credential
    const userCredential = await auth().signInWithCredential(googleCredential);
    const { user } = userCredential;
    
    console.log('Firebase User:', user); // Debug log
    
    return {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || '',
    };
  } catch (error) {
    console.error('Google sign-in error:', error);
    
    // Handle specific error codes
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw { 
        code: 'auth/user-cancelled', 
        message: 'Sign in was cancelled by user' 
      };
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw { 
        code: 'auth/in-progress', 
        message: 'Sign in is already in progress' 
      };
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw { 
        code: 'auth/play-services-not-available', 
        message: 'Google Play Services not available or outdated' 
      };
    } else {
      throw error;
    }
  }
};

// ==================== SIGN OUT ====================

export const signOutUser = async () => {
  try {
    // Check if user is signed in with Google
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (isSignedIn) {
      await GoogleSignin.signOut();
    }
    
    // Sign out from Firebase
    await auth().signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};