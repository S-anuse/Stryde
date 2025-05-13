import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '@/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

// Define types for better TypeScript support
interface WeightEntry {
  weight: number;
  date: string;
}

interface UserData {
  name: string;
  gender: string;
  height: string;
  weight: string;
  email: string;
  photoURL: string | null;
  birthdate: string;
  fitnessLevel: string;
  activityGoal: number;
  weightHistory: WeightEntry[];
}

// Interface for the CustomDropdown component props
interface CustomDropdownProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    name: '',
    gender: 'Female',
    height: '',
    weight: '',
    email: '',
    photoURL: null,
    birthdate: '',
    fitnessLevel: 'Beginner',
    activityGoal: 10000,
    weightHistory: [],
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showFitnessLevelPicker, setShowFitnessLevelPicker] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData({
              name: data.name || '',
              gender: data.gender || 'Female',
              height: data.height ? String(data.height) : '',
              weight: data.weight ? String(data.weight) : '',
              email: user.email || '',
              photoURL: data.photoURL || null,
              birthdate: data.birthdate || '',
              fitnessLevel: data.fitnessLevel || 'Beginner',
              activityGoal: data.activityGoal || 10000,
              weightHistory: data.weightHistory || []
            });
          } else {
            setUserData(prev => ({ ...prev, email: user.email || '' }));
            await setDoc(userDocRef, {
              name: '',
              gender: 'Female',
              height: '',
              weight: '',
              email: user.email || '',
              photoURL: null,
              birthdate: '',
              fitnessLevel: 'Beginner',
              activityGoal: 10000,
              weightHistory: []
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to change your profile picture");
      return;
    }
  
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
  
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUserData(prev => ({ ...prev, photoURL: result.assets[0].uri }));
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const user = auth.currentUser;
  
      if (!user) {
        Alert.alert("Error", "You must be logged in to update your profile");
        return;
      }
  
      if (!userData.name.trim()) {
        Alert.alert("Error", "Please enter your name");
        setSaving(false);
        return;
      }
  
      const heightNum = parseFloat(userData.height);
      const weightNum = parseFloat(userData.weight);
  
      if (isNaN(heightNum) || heightNum <= 0) {
        Alert.alert("Error", "Please enter a valid height");
        setSaving(false);
        return;
      }
  
      if (isNaN(weightNum) || weightNum <= 0) {
        Alert.alert("Error", "Please enter a valid weight");
        setSaving(false);
        return;
      }
  
      let updatedWeightHistory = [...userData.weightHistory];
      const lastWeightEntry = updatedWeightHistory[updatedWeightHistory.length - 1];
      
      if (!lastWeightEntry || lastWeightEntry.weight !== weightNum) {
        updatedWeightHistory.push({
          weight: weightNum,
          date: new Date().toISOString()
        });
        
        if (updatedWeightHistory.length > 12) {
          updatedWeightHistory = updatedWeightHistory.slice(-12);
        }
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name: userData.name,
        gender: userData.gender,
        height: parseFloat(userData.height),
        weight: parseFloat(userData.weight),
        photoURL: userData.photoURL,
        birthdate: userData.birthdate,
        fitnessLevel: userData.fitnessLevel,
        activityGoal: userData.activityGoal,
        weightHistory: updatedWeightHistory
      });
  
      setUserData(prev => ({
        ...prev,
        weightHistory: updatedWeightHistory
      }));
  
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/login');
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "Failed to log out");
    }
  };

  // Updated CustomDropdown component using Modal for better visibility
  const CustomDropdown = ({ label, value, options, onSelect }: CustomDropdownProps) => {
    const [modalVisible, setModalVisible] = useState(false);

    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        {isEditing ? (
          <View style={styles.dropdownWrapper}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.dropdownButtonText}>{value}</Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#555" />
            </TouchableOpacity>

            <Modal
              transparent={true}
              visible={modalVisible}
              animationType="fade"
              onRequestClose={() => setModalVisible(false)}
            >
              <Pressable 
                style={styles.modalOverlay} 
                onPress={() => setModalVisible(false)}
              >
                <View style={styles.modalContent}>
                  {options.map((option: string) => (
                    <TouchableOpacity
                      key={option}
                      style={styles.pickerItem}
                      onPress={() => {
                        onSelect(option);
                        setModalVisible(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        value === option && styles.pickerItemTextSelected
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>
          </View>
        ) : (
          <Text style={styles.infoValue}>{value || 'Not set'}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4500" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
          {!isEditing ? (
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.profileImageContainer}>
          {userData.photoURL ? (
            <Image source={{ uri: userData.photoURL }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>
                {userData.name ? userData.name[0].toUpperCase() : '?'}
              </Text>
            </View>
          )}
          {isEditing && (
            <TouchableOpacity style={styles.changePhotoButton} onPress={handlePickImage}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={userData.name}
                onChangeText={(text) => setUserData(prev => ({ ...prev, name: text }))}
                placeholder="Enter your name"
              />
            ) : (
              <Text style={styles.infoValue}>{userData.name || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userData.email}</Text>
          </View>

          <CustomDropdown
            label="Gender"
            value={userData.gender}
            options={['Female', 'Male', 'Other']}
            onSelect={(value: string) => setUserData(prev => ({ ...prev, gender: value }))}
          />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Height (cm)</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={userData.height}
                onChangeText={(text) => setUserData(prev => ({ ...prev, height: text }))}
                placeholder="Enter your height"
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.infoValue}>{userData.height || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weight (kg)</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={userData.weight}
                onChangeText={(text) => setUserData(prev => ({ ...prev, weight: text }))}
                placeholder="Enter your weight"
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.infoValue}>{userData.weight || 'Not set'}</Text>
            )}
          </View>

          {isEditing && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Birthdate</Text>
                <TextInput
                  style={styles.input}
                  value={userData.birthdate}
                  onChangeText={(text) => 
                    setUserData(prev => ({ ...prev, birthdate: text }))
                  }
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <CustomDropdown
                label="Fitness Level"
                value={userData.fitnessLevel}
                options={['Beginner', 'Intermediate', 'Advanced']}
                onSelect={(value: string) => setUserData(prev => ({ ...prev, fitnessLevel: value }))}
              />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Daily Steps Goal</Text>
                <TextInput
                  style={styles.input}
                  value={String(userData.activityGoal)}
                  onChangeText={(text) => 
                    setUserData(prev => ({ ...prev, activityGoal: parseInt(text) || 10000 }))
                  }
                  placeholder="Daily steps goal"
                  keyboardType="numeric"
                />
              </View>
            </>
          )}
        </View>

        {isEditing ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={() => setIsEditing(false)}
              disabled={saving}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.logoutButton]} 
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}>Log Out</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ff4500',
    borderRadius: 8,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#ff4500',
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ff4500',
  },
  placeholderText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#555',
  },
  changePhotoButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#007bff',
    borderRadius: 8,
  },
  changePhotoText: {
    color: 'white',
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  input: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'right',
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  dropdownWrapper: {
    flex: 2,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '80%',
    maxHeight: '50%',
    paddingVertical: 10,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    fontWeight: 'bold',
    color: '#ff4500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginRight: 5,
  },
  cancelButton: {
    backgroundColor: '#9e9e9e',
    flex: 1,
    marginLeft: 5,
  },
  logoutButton: {
    backgroundColor: '#ff4500',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});