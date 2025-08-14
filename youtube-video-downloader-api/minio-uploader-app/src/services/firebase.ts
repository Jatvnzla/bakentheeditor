import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Your web app's Firebase configuration (provided by user)
const firebaseConfig = {
  apiKey: 'AIzaSyB3EcBbe4lxf8jpRnc_1DId34LzQuWF4J0',
  authDomain: 'app-de-entregas-vgyvms.firebaseapp.com',
  projectId: 'app-de-entregas-vgyvms',
  storageBucket: 'app-de-entregas-vgyvms.appspot.com',
  messagingSenderId: '640321093712',
  appId: '1:640321093712:web:b3c735ea6b37753e191155',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Keep session persisted across refreshes
setPersistence(auth, browserLocalPersistence).catch(() => {
  // non-fatal; fallback to default persistence
});
export default app;
