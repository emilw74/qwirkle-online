import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBbfnkQiGvjpRJrgt_z6P-1h4GQAY11sOo",
  authDomain: "qwirkle-online-6ca1c.firebaseapp.com",
  databaseURL: "https://qwirkle-online-6ca1c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "qwirkle-online-6ca1c",
  storageBucket: "qwirkle-online-6ca1c.firebasestorage.app",
  messagingSenderId: "712381168296",
  appId: "1:712381168296:web:2421aa1b3619d0c0a4609d"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
