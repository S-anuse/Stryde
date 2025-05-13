import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAJWHLcuux-6AGZqNOOPRLW7wYSEPOxL7A",
  authDomain: "stryde-24fb4.firebaseapp.com",
  projectId: "stryde-24fb4",
  storageBucket: "stryde-24fb4.firebasestorage.app",
  messagingSenderId: "322300406862",
  appId: "1:322300406862:web:5ef62bedbda206528e271f",
  measurementId: "G-E4EMP4T1WM"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);