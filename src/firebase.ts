import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCrzml0ykrtU-w2faX8mBXnJjWAax4TH9A",
  authDomain: "orbit-app-e70dd.firebaseapp.com",
  projectId: "orbit-app-e70dd",
  storageBucket: "orbit-app-e70dd.firebasestorage.app",
  messagingSenderId: "881273368584",
  appId: "1:881273368584:web:adae05834cb87710b861bd",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
