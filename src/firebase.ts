import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
const auth = getAuth(app);

// Test Firestore connection on boot
import { doc, getDocFromServer } from 'firebase/firestore';
const testConnection = async () => {
  try {
    // We attempt to read a non-existent doc just to trigger the connection
    await getDocFromServer(doc(db, '_connection_test', 'startup'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.error("Firestore is offline. Check your configuration.");
    }
  }
};
testConnection();

export { db, auth };
