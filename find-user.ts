import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function findUsers() {
  console.log('Querying users...');
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    console.log(`Found ${querySnapshot.size} user documents:`);
    querySnapshot.forEach((doc) => {
      console.log(`User ID: ${doc.id}`);
      console.log(`Data:`, JSON.stringify(doc.data()));
    });
  } catch (error: any) {
    console.error('Error querying users:', error);
  }
}

findUsers();
