import { Slot, useRootNavigationState } from 'expo-router';
   import { useAuth } from '@/hooks/useAuth';
   import { ActivityIndicator, View } from 'react-native';
   import { useRouter } from 'expo-router';
   import { useEffect, useState } from 'react';
   import { Pedometer } from 'expo-sensors';
   import stepCounter from '../services/stepCounter'; // Import the stepCounter instance

   export default function RootLayout() {
     const { user, loading } = useAuth();
     const router = useRouter();
     const [isPedometerAvailable, setIsPedometerAvailable] = useState(false);
     const [permissionGranted, setPermissionGranted] = useState(false);
     const [isCounting, setIsCounting] = useState(true);

     // Get the current route name using useRootNavigationState
     const navigationState = useRootNavigationState();
     const routes = navigationState?.routes ?? [];
     const currentRoute = routes[routes.length - 1]?.name;

     // Check pedometer availability and request permissions
     useEffect(() => {
       const setupPedometer = async () => {
         const available = await Pedometer.isAvailableAsync();
         setIsPedometerAvailable(available);

         if (available) {
           const permission = await Pedometer.requestPermissionsAsync();
           setPermissionGranted(permission.granted);
         }
       };
       setupPedometer();
     }, []);

     // Start or stop the step counter based on the current route
     useEffect(() => {
       // Routes where step counting should be paused
       const pauseRoutes = ['3']; // Removed 'activity' to allow saving on activity screen
       const shouldCount = !pauseRoutes.includes(currentRoute);

       setIsCounting(shouldCount);

       if (isPedometerAvailable && permissionGranted) {
         if (shouldCount) {
           stepCounter.start();
           console.log('Step counter started');
         } else {
           stepCounter.stop();
           console.log('Step counter stopped');
         }
       }

       // Cleanup on unmount or route change
       return () => {
         stepCounter.stop();
       };
     }, [isPedometerAvailable, permissionGranted, currentRoute]);

     // Redirect to login if not authenticated
     useEffect(() => {
       if (!loading && !user) {
         console.log('Navigating to /login');
         router.replace('/login');
       }
     }, [loading, user, router]);

     if (loading) {
       return (
         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
           <ActivityIndicator size="large" />
         </View>
       );
     }

     return <Slot />;
   }