import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkpktlNSl56vfks1lyZT6peI5uGyPTY2U",
  authDomain: "mun-market-306c0.firebaseapp.com",
  projectId: "mun-market-306c0",
  storageBucket: "mun-market-306c0.firebasestorage.app",
  messagingSenderId: "22092531076",
  appId: "1:22092531076:web:0a121809f87efb30fec9d1",
  measurementId: "G-721R86S9F1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
