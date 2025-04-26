import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '@/firebase';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Profile</Text>
      <Button
        title="Log Out"
        color="#ff4500"
        onPress={async () => {
          await auth.signOut();
          router.replace('/login');
        }}
      />
    </View>
  );
}