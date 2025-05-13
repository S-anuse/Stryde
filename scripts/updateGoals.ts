// E:\Stryde\scripts\updateGoals.ts
import { db } from '../firebase';
import { collection, getDocs, setDoc } from 'firebase/firestore';

const updateGoals = async () => {
  try {
    const goalsSnapshot = await getDocs(collection(db, 'goals'));
    const updates = goalsSnapshot.docs.map(async (doc) => {
      const compoundId = doc.id;
      const userId = compoundId.split('_')[0];
      await setDoc(doc.ref, { userId }, { merge: true });
    });
    await Promise.all(updates);
    console.log('Goals updated with userId field');
  } catch (error) {
    console.error('Error updating goals:', error);
  }
};

updateGoals();