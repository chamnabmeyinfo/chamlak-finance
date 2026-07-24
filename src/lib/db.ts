import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs,
  getDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { Transaction, Budget } from '../types';

/**
 * Strips keys with `undefined` values recursively so Firestore does not throw invalid data errors.
 */
function cleanFirestoreData<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        cleaned[key] = cleanFirestoreData(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

export async function saveUserSettingsToFirestore(userId: string, userSettings: any): Promise<void> {
  if (!userId || userId === 'offline-user') return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { userSettings: cleanFirestoreData(userSettings), initialized: true }, { merge: true });
  } catch (err) {
    console.warn('Could not save user settings to Firestore (offline or permission error):', err);
  }
}

/**
 * Saves a single transaction to user's transactions subcollection.
 */
export async function saveTransaction(userId: string, tx: Transaction): Promise<void> {
  const docRef = doc(db, 'users', userId, 'transactions', tx.id);
  await setDoc(docRef, cleanFirestoreData(tx));
  await setDoc(doc(db, 'users', userId), { initialized: true }, { merge: true });
}

/**
 * Saves multiple transactions in atomic batches (up to 450 items per batch)
 */
export async function saveTransactionsBatch(userId: string, txs: Transaction[]): Promise<void> {
  if (!userId || userId === 'offline-user' || txs.length === 0) return;
  const BATCH_SIZE = 450;
  for (let i = 0; i < txs.length; i += BATCH_SIZE) {
    const chunk = txs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((tx) => {
      const txRef = doc(db, 'users', userId, 'transactions', tx.id);
      batch.set(txRef, cleanFirestoreData(tx));
    });
    const userRef = doc(db, 'users', userId);
    batch.set(userRef, { initialized: true }, { merge: true });
    await batch.commit();
  }
}

/**
 * Deletes a single transaction.
 */
export async function deleteTransaction(userId: string, txId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'transactions', txId);
  await deleteDoc(docRef);
}

/**
 * Saves a budget category target limit.
 */
export async function saveBudget(userId: string, budget: Budget): Promise<void> {
  const docRef = doc(db, 'users', userId, 'budgets', budget.category);
  await setDoc(docRef, cleanFirestoreData(budget));
  await setDoc(doc(db, 'users', userId), { initialized: true }, { merge: true });
}

/**
 * Seeds a user's collection with sample data in a single batch.
 */
export async function seedUserData(userId: string, txs: Transaction[], budgets: Budget[]): Promise<void> {
  const batch = writeBatch(db);

  // Seed transactions
  txs.forEach((tx) => {
    const txRef = doc(db, 'users', userId, 'transactions', tx.id);
    batch.set(txRef, cleanFirestoreData(tx));
  });

  // Seed budgets
  budgets.forEach((b) => {
    const bRef = doc(db, 'users', userId, 'budgets', b.category);
    batch.set(bRef, cleanFirestoreData(b));
  });

  // Mark user document as initialized
  const userRef = doc(db, 'users', userId);
  batch.set(userRef, { initialized: true, seededAt: new Date().toISOString() }, { merge: true });

  await batch.commit();
}

/**
 * Clears all user transactions.
 */
export async function clearUserTransactions(userId: string, txs?: Transaction[]): Promise<void> {
  const batch = writeBatch(db);

  try {
    // Get all actual transaction documents in Firestore
    const txDocs = await getDocs(collection(db, 'users', userId, 'transactions'));
    txDocs.forEach((d) => {
      batch.delete(d.ref);
    });
  } catch (err) {
    console.warn('Could not fetch txDocs for clearUserTransactions (offline or error):', err);
  }

  // Also fallback to any txs provided
  if (txs && txs.length > 0) {
    txs.forEach((tx) => {
      const txRef = doc(db, 'users', userId, 'transactions', tx.id);
      batch.delete(txRef);
    });
  }

  try {
    const userRef = doc(db, 'users', userId);
    batch.set(userRef, { initialized: true, clearedAt: new Date().toISOString() }, { merge: true });
    await batch.commit();
  } catch (err) {
    console.warn('Could not commit clearUserTransactions batch (offline or error):', err);
  }
}

/**
 * Completely nukes and erases all data for a user in Firestore.
 */
export async function nukeUserData(userId: string): Promise<void> {
  const batch = writeBatch(db);

  try {
    // 1. Delete all transactions
    const txDocs = await getDocs(collection(db, 'users', userId, 'transactions'));
    txDocs.forEach((d) => {
      batch.delete(d.ref);
    });
  } catch (err) {
    console.warn('Could not fetch txDocs for nukeUserData (offline or error):', err);
  }

  try {
    // 2. Delete all budgets
    const budgetDocs = await getDocs(collection(db, 'users', userId, 'budgets'));
    budgetDocs.forEach((d) => {
      batch.delete(d.ref);
    });
  } catch (err) {
    console.warn('Could not fetch budgetDocs for nukeUserData (offline or error):', err);
  }

  try {
    // 3. Mark user document as initialized and nuked
    const userRef = doc(db, 'users', userId);
    batch.set(userRef, { initialized: true, nuked: true, nukedAt: new Date().toISOString() }, { merge: true });
    await batch.commit();
  } catch (err) {
    console.warn('Could not commit nukeUserData batch (offline or error):', err);
  }
}

