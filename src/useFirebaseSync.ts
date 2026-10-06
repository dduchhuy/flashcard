import { useEffect, useRef, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFlashcardStore } from './store';

export function useFirebaseSync() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch data from Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.state) {
              // Override Zustand state with cloud data
              useFlashcardStore.setState(data.state);
            }
          }
        } catch (error) {
          console.error("Failed to fetch data from Firestore", error);
        }
      }
      
      setIsLoading(false);
      isInitialLoadRef.current = false;
    });

    return () => unsubscribe();
  }, []);

  // Sync back to Firestore on any change
  useEffect(() => {
    const unsubscribeStore = useFlashcardStore.subscribe((state) => {
      if (user && !isInitialLoadRef.current) {
        // Debounce or just save directly (Firestore is fast, but debounce is better for many changes)
        const userDocRef = doc(db, 'users', user.uid);
        // Only save flashcards and settings to cloud, activeTags might be local only
        setDoc(userDocRef, {
          state: {
            flashcards: state.flashcards,
            settings: state.settings,
          },
          updatedAt: Date.now()
        }, { merge: true }).catch(err => console.error("Save to Firestore failed", err));
      }
    });

    return () => unsubscribeStore();
  }, [user]);

  return { user, isLoading };
}
