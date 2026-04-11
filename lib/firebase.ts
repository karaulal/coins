import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCcYrUBc1FZZOGJscskNA00X2IAkmi5OpE",
  authDomain: "trendingcoins007.firebaseapp.com",
  projectId: "trendingcoins007",
  storageBucket: "trendingcoins007.firebasestorage.app",
  messagingSenderId: "411521822020",
  appId: "1:411521822020:web:f234496332f6267920fb11",
  measurementId: "G-9BPJ01ZTQR",
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analyticsInstance: Analytics | null = null;

export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (analyticsInstance) return analyticsInstance;

  const supported = await isSupported();
  if (!supported) return null;

  analyticsInstance = getAnalytics(app);
  return analyticsInstance;
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
