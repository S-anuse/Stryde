import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { db, auth } from '../firebase';
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, DocumentData,
} from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

// Define the type for feedback items
interface Feedback {
  id: string;
  name: string;
  email: string;
  message: string;
  timestamp: any; // You can use a more specific type if needed (e.g., firebase.firestore.Timestamp)
}

const FeedbackScreen: React.FC = () => {
  const router = useRouter();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState<boolean>(true);

  // Pre-fill name and email if the user is logged in
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setEmail(user.email || '');
      setName(user.displayName || '');
    }
  }, []);

  // Submit Feedback
  const handleSubmit = async () => {
    if (!name || !email || !message) {
      Toast.show({ type: 'error', text1: 'Missing Fields', text2: 'Please fill all fields.' });
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'feedbacks'), {
        name,
        email,
        message,
        timestamp: serverTimestamp(),
      });

      Toast.show({ type: 'success', text1: 'Feedback Sent', text2: 'Thank you!' });

      setName('');
      setEmail('');
      setMessage('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Feedbacks in Real-time
  useEffect(() => {
    const q = query(collection(db, 'feedbacks'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Feedback[] = snapshot.docs.map((doc: DocumentData) => ({
        id: doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        message: doc.data().message || '',
        timestamp: doc.data().timestamp,
      }));
      setFeedbacks(data);
      setLoadingFeedbacks(false);
    }, (error: unknown) => {
      console.error("Error fetching feedbacks:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load feedbacks';
      Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
      setLoadingFeedbacks(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>We'd love your Feedback!</Text>

      <TextInput
        style={styles.input}
        placeholder="Your Name"
        value={name}
        onChangeText={setName}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Your Email"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        keyboardType="email-address"
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Your Feedback"
        value={message}
        onChangeText={setMessage}
        multiline
        editable={!loading}
      />

      <TouchableOpacity onPress={handleSubmit} style={styles.button} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Submit Feedback'}</Text>
      </TouchableOpacity>

      <Text style={styles.subHeading}>Feedbacks from Users</Text>

      {loadingFeedbacks ? (
        <ActivityIndicator size="large" color="#000" />
      ) : feedbacks.length === 0 ? (
        <Text style={styles.noFeedbackText}>No feedback available yet.</Text>
      ) : (
        <FlatList
          data={feedbacks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackName}>{item.name}</Text>
              <Text style={styles.feedbackEmail}>{item.email}</Text>
              <Text style={styles.feedbackMessage}>{item.message}</Text>
            </View>
          )}
        />
      )}

      <Toast />
    </View>
  );
};

export default FeedbackScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '500',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  subHeading: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 25,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#ff4500',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  feedbackName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  feedbackEmail: {
    fontStyle: 'italic',
    fontSize: 14,
    marginBottom: 4,
  },
  feedbackMessage: {
    fontSize: 15,
    marginBottom: 8,
  },
  noFeedbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
});