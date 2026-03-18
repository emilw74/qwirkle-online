import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBbfnkQiGvjpRJrgt_z6P-1h4GQ",
  authDomain: "qwirkle-online-6ca1c.firebaseapp.com",
  databaseURL: "https://qwirkle-online-6ca1c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "qwirkle-online-6ca1c",
  storageBucket: "qwirkle-online-6ca1c.firebasestorage.app",
  messagingSenderId: "712381168296",
  appId: "1:712381168296:web:2421aa1b3619d0"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export default app;
