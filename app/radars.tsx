import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, PanResponder, Image, ImageBackground } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import type { LocationObject } from 'expo-location';
import { radarsApi, Radar } from '../services/radarsApi';
import API_BASE_URL from '../config/api';
import { useCars } from '../contexts/CarContext';
import { Vibration } from 'react-native';

const { width, height } = Dimensions.get('window');

export const options = {
  headerShown: false,
};

const MAP_STYLE_MINIMAL_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#0B0B0E' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0B0E' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1B2A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1F2937' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#112031' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function RadarsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedCar, cars } = useCars();
  const [radars, setRadars] = useState<Radar[]>([]);
  const [selectedRadar, setSelectedRadar] = useState<Radar | null>(null);
  const [showRadarInfo, setShowRadarInfo] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationObject | null>(null);
  const [showRadarAlert, setShowRadarAlert] = useState(false);
  const [nearbyRadar, setNearbyRadar] = useState<Radar | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'fixed' | 'mobile' | 'average_speed'>('all');
  const [showList, setShowList] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(false);
  const [isReadyToDrive, setIsReadyToDrive] = useState(false);
  const [showIntroScreen, setShowIntroScreen] = useState(true); // Intro screen state
  const [showAddRadarModal, setShowAddRadarModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [speedLimitInput, setSpeedLimitInput] = useState('60');
  
  const [mapRegion, setMapRegion] = useState({
    latitude: 41.7151, // თბილისი, საქართველო
    longitude: 44.8271,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  
  const mapRef = useRef<any>(null);
  const alertScale = useRef(new Animated.Value(0)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(height * 0.5 - 100)).current;
  
  // Modal animations
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  
  // Waze-style info boxes animations
  const speedLimitSlideY = useRef(new Animated.Value(-100)).current;
  const speedLimitOpacity = useRef(new Animated.Value(0)).current;
  const nextRadarSlideY = useRef(new Animated.Value(-100)).current;
  const nextRadarOpacity = useRef(new Animated.Value(0)).current;
  const [nextRadar, setNextRadar] = useState<Radar | null>(null);
  const [currentSpeedLimit, setCurrentSpeedLimit] = useState<number | null>(null);
  const [isSpeedExceeded, setIsSpeedExceeded] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState(0);
  const speedExceededAnimation = useRef(new Animated.Value(1)).current;
  
  // სიჩქარის გამოთვლა (m/s -> km/h)
  const getCurrentSpeed = (): number | null => {
    if (!userLocation) {
      return null;
    }
    
    // Check if speed is available and valid
    const speedInMps = userLocation.coords.speed;
    
    // speed can be null, undefined, or a number
    // If it's null or undefined, return null
    if (speedInMps === null || speedInMps === undefined) {
      return null;
    }
    
    // If speed is 0 or negative, it might mean the device is stationary
    // But we'll still show it as 0
    if (speedInMps < 0) {
      return 0;
    }
    
    // m/s -> km/h: 1 m/s = 3.6 km/h
    const speedInKmh = speedInMps * 3.6;
    
    // Round to nearest integer
    return Math.round(speedInKmh);
  };
  
  const currentSpeed = getCurrentSpeed();
  
  // Debug log to see what speed we're getting
  useEffect(() => {
    if (userLocation) {
      console.log('🚗 Speed Debug:', {
        speed: userLocation.coords.speed,
        calculatedSpeed: currentSpeed,
        hasSpeed: userLocation.coords.speed !== null && userLocation.coords.speed !== undefined,
      });
    }
  }, [userLocation, currentSpeed]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0B0B0E',
    },
    header: {
      position: 'absolute',
      top: (insets.top || (Platform.OS === 'ios' ? 48 : 18)) + 8,
      left: 16,
      right: 16,
      zIndex: 20,
    },
    headerCard: {
      backgroundColor: 'rgba(17,24,39,0.9)',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.28,
      shadowRadius: 24,
      elevation: 10,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: '#111827',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#1F2937',
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: 'Poppins_700Bold',
      color: '#F9FAFB',
      letterSpacing: -0.2,
      flex: 1,
      textAlign: 'center',
    },
    mapContainer: {
      flex: 1,
      backgroundColor: '#0B0B0E',
    },
    map: {
      width: '100%',
      height: '100%',
    },
    zoomControls: {
      position: 'absolute',
      right: 16,
      bottom: 180,
      backgroundColor: 'rgba(17,24,39,0.85)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
    zoomButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    zoomDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    radarInfoCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(17,24,39,0.98)', // Waze-style: more opaque
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 12,
      paddingBottom: insets.bottom + 20,
      paddingHorizontal: 20,
      borderTopWidth: 2,
      borderTopColor: 'rgba(255,255,255,0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 120,
      zIndex: 2000,
      overflow: 'hidden',
    },
    infoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    infoTitle: {
      fontSize: 18,
      fontFamily: 'Poppins_700Bold',
      color: '#F3F4F6',
      flex: 1,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    infoLabel: {
      fontSize: 13,
      fontFamily: 'Poppins_500Medium',
      color: '#9CA3AF',
      minWidth: 100,
    },
    infoValue: {
      fontSize: 13,
      fontFamily: 'Poppins_600SemiBold',
      color: '#E5E7EB',
      flex: 1,
    },
    fineBadge: {
      backgroundColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.4)',
      marginTop: 8,
    },
    fineText: {
      color: '#FCA5A5',
      fontFamily: 'Poppins_700Bold',
      fontSize: 14,
    },
    alertContainer: {
      position: 'absolute',
      top: (insets.top || (Platform.OS === 'ios' ? 48 : 18)) + 100,
      left: 16,
      right: 16,
      zIndex: 1000,
    },
    alertCard: {
      backgroundColor: 'rgba(239,68,68,0.95)',
      borderRadius: 16,
      padding: 14,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 12,
      maxHeight: 200,
    },
    alertTitle: {
      fontSize: 16,
      fontFamily: 'Poppins_700Bold',
      color: '#FFFFFF',
      marginBottom: 6,
    },
    alertText: {
      fontSize: 12,
      fontFamily: 'Poppins_600SemiBold',
      color: '#FFFFFF',
      marginBottom: 3,
      lineHeight: 16,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    statItem: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      fontSize: 20,
      fontFamily: 'Poppins_700Bold',
      color: '#FFFFFF',
    },
    statLabel: {
      fontSize: 11,
      fontFamily: 'Poppins_500Medium',
      color: 'rgba(255,255,255,0.8)',
      marginTop: 4,
    },
    dragHandleContainer: {
      alignItems: 'center',
      paddingVertical: 8,
      marginBottom: 8,
    },
    dragHandle: {
      width: 40,
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 2,
      marginBottom: 8,
    },
    collapseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    filterChipActive: {
      backgroundColor: '#3B82F6',
      borderColor: '#3B82F6',
    },
    filterChipText: {
      fontSize: 12,
      fontFamily: 'Poppins_600SemiBold',
      color: 'rgba(255,255,255,0.8)',
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    infoCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 12,
    },
  });

  // Load radars
  useEffect(() => {
    const loadRadars = async () => {
      try {
        setLoading(true);
        
        // პირველ რიგში სინქრონიზაცია (თუ რადარები არ არის)
        try {
          await fetch(`${API_BASE_URL}/radars/sync`, { method: 'POST' });
        } catch (syncError) {
          console.log('Sync error (might be ok if radars already exist):', syncError);
        }
        
        // რადარების მიღება
        const radarsData = await radarsApi.getAllRadars();
        console.log('📡 რადარების მიღებული:', radarsData.length);
        
        // თუ რადარები არ არის, გამოვიყენოთ mock მონაცემები
        if (radarsData.length === 0) {
          console.log('⚠️ რადარები არ მოიძებნა, გამოიყენება mock მონაცემები');
          const mockRadars: Radar[] = [
            {
              _id: '1',
              latitude: 41.7151,
              longitude: 44.8271,
              type: 'fixed',
              speedLimit: 60,
              address: 'ვაზიანის გზატკეცილი, თბილისი',
              direction: 'თბილისი-რუსთავი',
              fineCount: 15,
              lastFineDate: new Date('2024-01-15').toISOString(),
              description: 'ფიქსირებული რადარი ვაზიანის გზატკეცილზე',
              isActive: true,
            },
            {
              _id: '2',
              latitude: 41.7201,
              longitude: 44.7801,
              type: 'fixed',
              speedLimit: 50,
              address: 'რუსთაველის გამზირი, თბილისი',
              direction: 'ცენტრი-ვაკე',
              fineCount: 23,
              lastFineDate: new Date('2024-01-20').toISOString(),
              description: 'ფიქსირებული რადარი რუსთაველის გამზირზე, ცენტრალურ ნაწილში',
              isActive: true,
            },
            {
              _id: '3',
              latitude: 41.7080,
              longitude: 44.7900,
              type: 'fixed',
              speedLimit: 50,
              address: 'აგმაშენების გამზირი, თბილისი',
              direction: 'ცენტრი-ისანი',
              fineCount: 8,
              lastFineDate: new Date('2024-01-10').toISOString(),
              description: 'ფიქსირებული რადარი აგმაშენების გამზირზე',
              isActive: true,
            },
            {
              _id: '4',
              latitude: 41.7300,
              longitude: 44.7500,
              type: 'mobile',
              speedLimit: 60,
              address: 'ქავთარაძის გამზირი, თბილისი',
              direction: 'ვაკე-დიღომი',
              fineCount: 12,
              lastFineDate: new Date('2024-01-18').toISOString(),
              description: 'მობილური რადარი ქავთარაძის გამზირზე',
              isActive: true,
            },
            {
              _id: '5',
              latitude: 41.7400,
              longitude: 44.8200,
              type: 'fixed',
              speedLimit: 50,
              address: 'თბილისის ზღვა, თბილისი',
              direction: 'ცენტრი-საბურთალო',
              fineCount: 5,
              lastFineDate: new Date('2024-01-12').toISOString(),
              description: 'ფიქსირებული რადარი თბილისის ზღვის მიდამოებში',
              isActive: true,
            },
            {
              _id: '6',
              latitude: 41.7500,
              longitude: 44.8500,
              type: 'average_speed',
              speedLimit: 80,
              address: 'კახეთის გზატკეცილი, თბილისი',
              direction: 'თბილისი-კახეთი',
              fineCount: 18,
              lastFineDate: new Date('2024-01-22').toISOString(),
              description: 'საშუალო სიჩქარის რადარი კახეთის გზატკეცილზე',
              isActive: true,
            },
            {
              _id: '7',
              latitude: 41.7000,
              longitude: 44.7600,
              type: 'fixed',
              speedLimit: 50,
              address: 'ვარკეთილის გამზირი, თბილისი',
              direction: 'ცენტრი-ნაძალადევი',
              fineCount: 10,
              lastFineDate: new Date('2024-01-16').toISOString(),
              description: 'ფიქსირებული რადარი ვარკეთილის გამზირზე',
              isActive: true,
            },
            {
              _id: '8',
              latitude: 41.7100,
              longitude: 44.7700,
              type: 'mobile',
              speedLimit: 60,
              address: 'ბათონის გამზირი, თბილისი',
              direction: 'ცენტრი-დიდუბე',
              fineCount: 7,
              lastFineDate: new Date('2024-01-14').toISOString(),
              description: 'მობილური რადარი ბათონის გამზირზე',
              isActive: true,
            },
          ];
          console.log('✅ Mock რადარები დაყენებული:', mockRadars.length);
          setRadars(mockRadars);
        } else {
          console.log('✅ რადარები ჩატვირთული:', radarsData.length);
          setRadars(radarsData);
        }
      } catch (error) {
        console.error('❌ რადარების ჩატვირთვის შეცდომა:', error);
        // Fallback to mock data on error
        const mockRadars: Radar[] = [
          {
            _id: '1',
            latitude: 41.7151,
            longitude: 44.8271,
            type: 'fixed',
            speedLimit: 60,
            address: 'ვაზიანის გზატკეცილი, თბილისი',
            direction: 'თბილისი-რუსთავი',
            fineCount: 15,
            isActive: true,
          },
          {
            _id: '2',
            latitude: 41.7201,
            longitude: 44.7801,
            type: 'fixed',
            speedLimit: 50,
            address: 'რუსთაველის გამზირი, თბილისი',
            direction: 'ცენტრი-ვაკე',
            fineCount: 23,
            isActive: true,
          },
        ];
        setRadars(mockRadars);
      } finally {
        setLoading(false);
      }
    };

    loadRadars();
  }, []);

  // Load user location - GPS tracking for real-time speed
  useEffect(() => {
    let locationSubscription: any;
    
    (async () => {
      try {
        // Request location permission
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied, using Tbilisi fallback');
          // Fallback to Tbilisi
          const tbilisiLocation: LocationObject = {
            coords: {
              latitude: 41.7151,
              longitude: 44.8271,
              altitude: null,
              accuracy: 50,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          };
          setUserLocation(tbilisiLocation);
          return;
        }

        // Get initial location
        const location = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });
        setUserLocation(location);
        
        // Update map region
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        };
        setMapRegion(newRegion);
        
        // Waze-style camera: 3D perspective, high zoom, follows car
        setTimeout(() => {
          mapRef.current?.animateCamera(
            {
              center: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
              altitude: 200,
              pitch: 70,
              heading: location.coords.heading || 0,
            },
            { duration: 1000 }
          );
        }, 500);

        // Real-time location tracking for speed
        locationSubscription = await ExpoLocation.watchPositionAsync(
          {
            accuracy: ExpoLocation.Accuracy.High,
            timeInterval: 1000, // Update every 1 second for smooth speed display
            distanceInterval: 5, // Or every 5 meters
          },
          (newLocation) => {
            setUserLocation(newLocation);
            // Update map camera to follow car
            if (mapRef.current) {
              mapRef.current.animateCamera(
                {
                  center: {
                    latitude: newLocation.coords.latitude,
                    longitude: newLocation.coords.longitude,
                  },
                  altitude: 200,
                  pitch: 70,
                  heading: newLocation.coords.heading || 0,
                },
                { duration: 500 }
              );
            }
          }
        );
      } catch (error) {
        console.log('Error getting location:', error);
        // Fallback to Tbilisi
        const tbilisiLocation: LocationObject = {
          coords: {
            latitude: 41.7151,
            longitude: 44.8271,
            altitude: null,
            accuracy: 50,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        };
        setUserLocation(tbilisiLocation);
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Waze-style: Find next radar and current speed limit
  useEffect(() => {
    if (!userLocation || radars.length === 0) return;

    const updateWazeInfo = () => {
      const userLat = userLocation.coords.latitude;
      const userLng = userLocation.coords.longitude;
      
      // Find closest radar (next radar ahead)
      let closestRadar: Radar | null = null;
      let minDistance = Infinity;
      
      for (const radar of radars) {
        const distance = getDistanceKm(userLat, userLng, radar.latitude, radar.longitude);
        if (distance < minDistance && distance <= 5) { // Within 5km
          minDistance = distance;
          closestRadar = radar;
        }
      }
      
      // Update next radar
      if (closestRadar && closestRadar._id !== nextRadar?._id) {
        setNextRadar(closestRadar);
        // Animate in - slide from top
        Animated.parallel([
          Animated.spring(nextRadarSlideY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }),
          Animated.timing(nextRadarOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (!closestRadar && nextRadar) {
        // Hide if no radar nearby
        Animated.parallel([
          Animated.timing(nextRadarSlideY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(nextRadarOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setNextRadar(null);
        });
      }
      
      // Update speed limit from closest radar
      if (closestRadar && closestRadar.speedLimit) {
        if (currentSpeedLimit !== closestRadar.speedLimit) {
          setCurrentSpeedLimit(closestRadar.speedLimit);
          // Animate in - slide from top
          Animated.parallel([
            Animated.spring(speedLimitSlideY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }),
            Animated.timing(speedLimitOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start();
        }
      } else if (!closestRadar && currentSpeedLimit) {
        // Hide if no radar nearby
        Animated.parallel([
          Animated.timing(speedLimitSlideY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(speedLimitOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setCurrentSpeedLimit(null);
        });
      }
    };

    updateWazeInfo();
    const interval = setInterval(updateWazeInfo, 1000);
    return () => clearInterval(interval);
  }, [userLocation, radars, nextRadar, currentSpeedLimit]);

  // Check for speed limit violation and play alert
  useEffect(() => {
    if (!currentSpeed || !nextRadar || !nextRadar.speedLimit) {
      setIsSpeedExceeded(false);
      return;
    }

    const speedExceeded = currentSpeed > nextRadar.speedLimit;
    const now = Date.now();
    const timeSinceLastAlert = now - lastAlertTime;
    const ALERT_COOLDOWN = 2000; // 2 seconds between alerts

    if (speedExceeded && timeSinceLastAlert > ALERT_COOLDOWN) {
      setIsSpeedExceeded(true);
      setLastAlertTime(now);

      // Visual alert - blinking animation
      Animated.sequence([
        Animated.timing(speedExceededAnimation, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(speedExceededAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(speedExceededAnimation, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(speedExceededAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Vibration - Pattern: vibrate for 400ms, pause 200ms, vibrate 400ms
      try {
        Vibration.vibrate([400, 200, 400]);
      } catch (error) {
        console.log('Vibration error:', error);
      }

      // Sound alert - Use Alert.alert with sound (system beep)
      console.log('🚨 სიჩქარის ლიმიტი გადააჭარბა!', {
        currentSpeed,
        speedLimit: nextRadar.speedLimit,
        difference: currentSpeed - nextRadar.speedLimit,
      });
      
      // System beep sound (works on iOS and Android)
      // On iOS, Alert.alert plays a system sound
      // On Android, we can use a simple vibration pattern
      if (Platform.OS === 'ios') {
        // iOS plays system sound automatically with Alert
        Alert.alert('', '', [{ text: 'OK' }], { cancelable: true });
      }
    } else if (!speedExceeded) {
      setIsSpeedExceeded(false);
    }
  }, [currentSpeed, nextRadar, lastAlertTime]);

  // Check for nearby radars and show alert
  useEffect(() => {
    if (!userLocation || radars.length === 0) return;

    const checkNearbyRadars = () => {
      const userLat = userLocation.coords.latitude;
      const userLng = userLocation.coords.longitude;
      const alertRadius = 0.5; // 500 მეტრი

      for (const radar of radars) {
        const distance = getDistanceKm(userLat, userLng, radar.latitude, radar.longitude);

        if (distance <= alertRadius) {
          if (!showRadarAlert || nearbyRadar?._id !== radar._id) {
            setNearbyRadar(radar);
            setShowRadarAlert(true);

            // Animate alert
            Animated.parallel([
              Animated.spring(alertScale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
              }),
              Animated.timing(alertOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();

            // Auto-hide after 8 seconds
            setTimeout(() => {
              Animated.parallel([
                Animated.timing(alertScale, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(alertOpacity, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                setShowRadarAlert(false);
              });
            }, 8000);
          }
          break;
        }
      }
    };

    checkNearbyRadars();

    const interval = setInterval(checkNearbyRadars, 2000);
    return () => clearInterval(interval);
  }, [userLocation, radars, showRadarAlert, nearbyRadar]);

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getRadarIcon = (type: string) => {
    switch (type) {
      case 'fixed':
        return 'radio';
      case 'mobile':
        return 'alert-circle';
      case 'average_speed':
        return 'speedometer';
      default:
        return 'radio';
    }
  };

  const getRadarColor = (type: string) => {
    switch (type) {
      case 'fixed':
        return '#EF4444'; // წითელი
      case 'mobile':
        return '#F59E0B'; // ყვითელი
      case 'average_speed':
        return '#8B5CF6'; // იისფერი
      default:
        return '#EF4444';
    }
  };

  const getRadarTypeName = (type: string) => {
    switch (type) {
      case 'fixed':
        return 'ფიქსირებული რადარი';
      case 'mobile':
        return 'მობილური რადარი';
      case 'average_speed':
        return 'საშუალო სიჩქარის რადარი';
      default:
        return 'რადარი';
    }
  };

  const onZoomIn = async () => {
    try {
      const camera = await mapRef.current?.getCamera();
      console.log('🔍 ZOOM IN - Current Camera:', {
        zoom: camera?.zoom,
        center: camera?.center,
        pitch: camera?.pitch,
        heading: camera?.heading,
        altitude: camera?.altitude,
      });
      
      if (camera && typeof camera.zoom === 'number') {
        // Zoom in - zoom level-ის გაზრდა (უფრო მაღალი zoom = უფრო ახლოს) + ზემოთ გადაადგილება
        const newZoom = Math.min(camera.zoom + 1, 20); // მაქსიმუმ 20
        
        // ზემოთ გადაადგილება - latitude-ის გაზრდა (north)
        const currentCenter = camera.center || {
          latitude: 41.7151,
          longitude: 44.8271,
        };
        const newCenter = {
          latitude: currentCenter.latitude + 0.001, // ზემოთ (north) - ~100 მეტრი
          longitude: currentCenter.longitude,
        };
        
        const newCamera = { 
          center: newCenter,
          zoom: newZoom,
          pitch: 70, // Maintain 3D perspective
          heading: camera.heading || 0,
        };
        
        console.log('🔍 ZOOM IN - New Camera:', newCamera);
        
        await mapRef.current?.animateCamera(newCamera, { duration: 200 });
        
        // დავალოგოთ რა მოხდა
        setTimeout(async () => {
          const afterCamera = await mapRef.current?.getCamera();
          console.log('🔍 ZOOM IN - After Animation:', {
            zoom: afterCamera?.zoom,
            center: afterCamera?.center,
            pitch: afterCamera?.pitch,
            heading: afterCamera?.heading,
          });
        }, 250);
        
        return;
      }
    } catch (error) {
      console.error('❌ ZOOM IN Error:', error);
    }
    // Fallback - use altitude-based zoom (zoom in = ნაკლები altitude) + ზემოთ გადაადგილება
    try {
      const camera = await mapRef.current?.getCamera();
      const currentAltitude = camera?.altitude || 303.75;
      const newAltitude = Math.max(currentAltitude * 0.7, 100);
      
      // ზემოთ გადაადგილება
      const currentCenter = camera?.center || {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      };
      const newCenter = {
        latitude: currentCenter.latitude + 0.001, // ზემოთ (north)
        longitude: currentCenter.longitude,
      };
      
      await mapRef.current?.animateCamera({
        center: newCenter,
        altitude: newAltitude,
        pitch: 70,
        heading: userLocation?.coords.heading || 0,
      }, { duration: 200 });
    } catch {}
  };

  const onZoomOut = async () => {
    try {
      const camera = await mapRef.current?.getCamera();
      if (camera && typeof camera.zoom === 'number') {
        await mapRef.current?.animateCamera({ 
          ...camera, 
          zoom: Math.max(camera.zoom - 0.5, 10), // ნაკლები zoom out - მხოლოდ 0.5-ით და მინიმუმ 10
          pitch: 70, // Maintain 3D perspective
        }, { duration: 200 });
        return;
      }
    } catch {}
    // Fallback - use region-based zoom (ნაკლები zoom out)
    try {
      const newRegion = {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
        latitudeDelta: Math.min(mapRegion.latitudeDelta * 1.3, 0.1), // ნაკლები zoom out - 1.3x და მაქსიმუმ 0.1
        longitudeDelta: Math.min(mapRegion.longitudeDelta * 1.3, 0.1),
      };
      setMapRegion(newRegion as any);
      mapRef.current?.animateToRegion(newRegion as any, 200);
      // Maintain 3D perspective after region change
      setTimeout(() => {
        mapRef.current?.animateCamera({
          center: {
            latitude: newRegion.latitude,
            longitude: newRegion.longitude,
          },
          zoom: 18,
          pitch: 70,
          heading: userLocation?.coords.heading || 0,
        }, { duration: 0 });
      }, 100);
    } catch {}
  };

  const onMyLocation = async () => {
    if (!userLocation) return;
    try {
      await mapRef.current?.animateCamera(
        {
          center: {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
          },
          altitude: 303.75, // მანქანასთან ახლოს - ~300 მეტრი
          pitch: 70, // 3D პერსპექტივა (70 გრადუსი - ძალიან დახრილი ხედვა)
          heading: userLocation.coords.heading || 0,
        },
        { duration: 800 }
      );
    } catch {}
  };

  const handleRadarPress = (radar: Radar) => {
    setSelectedRadar(radar);
    setShowRadarInfo(true);
    setCardExpanded(false); // Default-ად დაკეცილი
    
    // Waze-style: ნელ-ნელა გამოჩნდეს bottom sheet (slide up from bottom)
    const collapsedY = height * 0.5 - 100;
    cardTranslateY.setValue(height); // Start from bottom (off-screen)
    Animated.spring(cardTranslateY, {
      toValue: collapsedY,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
    
    // Focus on radar - maintain 3D perspective
    mapRef.current?.animateCamera(
      {
        center: {
          latitude: radar.latitude,
          longitude: radar.longitude,
        },
        altitude: 200,
        pitch: 70, // Maintain 3D perspective
        heading: 0,
      },
      { duration: 400 }
    );
  };

  const toggleCard = useCallback(() => {
    const newExpanded = !cardExpanded;
    setCardExpanded(newExpanded);
    
    if (newExpanded) {
      // Expand
      Animated.spring(cardTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      // Collapse
      const collapsedY = height * 0.5 - 100;
      Animated.spring(cardTranslateY, {
        toValue: collapsedY,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [cardExpanded, cardTranslateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (cardExpanded) {
          // თუ გახსნილია, შეგვიძლია swipe down
          if (gestureState.dy > 0) {
            cardTranslateY.setValue(Math.min(gestureState.dy, height * 0.5 - 100));
          }
        } else {
          // თუ დაკეცილია, შეგვიძლია swipe up
          if (gestureState.dy < 0) {
            const collapsedY = height * 0.5 - 100;
            cardTranslateY.setValue(Math.max(collapsedY + gestureState.dy, 0));
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (cardExpanded) {
          // თუ გახსნილია და swipe down-ია
          if (gestureState.dy > 100) {
            // Swiped down enough, collapse
            setCardExpanded(false);
            const collapsedY = height * 0.5 - 100;
            Animated.spring(cardTranslateY, {
              toValue: collapsedY,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          } else {
            // Spring back to expanded
            Animated.spring(cardTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          }
        } else {
          // თუ დაკეცილია და swipe up-ია
          if (gestureState.dy < -50) {
            // Swiped up enough, expand
            setCardExpanded(true);
            Animated.spring(cardTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          } else {
            // Spring back to collapsed
            const collapsedY = height * 0.5 - 100;
            Animated.spring(cardTranslateY, {
              toValue: collapsedY,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          }
        }
      },
    })
  ).current;

  const totalFines = radars.reduce((sum, radar) => sum + (radar.fineCount || 0), 0);
  const activeRadars = radars.filter((r) => r.isActive).length;
  const fixedRadars = radars.filter((r) => r.type === 'fixed').length;
  const mobileRadars = radars.filter((r) => r.type === 'mobile').length;
  const averageSpeedRadars = radars.filter((r) => r.type === 'average_speed').length;
  
  // Filtered radars based on selected filter
  const filteredRadars = selectedFilter === 'all' 
    ? radars 
    : radars.filter((r) => r.type === selectedFilter);

  // Filter radars by distance - show only nearby radars (within 2km)
  const nearbyFilteredRadars = userLocation
    ? filteredRadars.filter((radar) => {
        const distance = getDistanceKm(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          radar.latitude,
          radar.longitude
        );
        return distance <= 2; // მხოლოდ 2 კმ-ის რადიუსში
      })
    : filteredRadars;

  const handleAddRadar = () => {
    if (!userLocation) {
      setModalMessage('ლოკაცია ვერ მოიძებნა');
      setShowErrorModal(true);
      // Animate error modal
      modalScale.setValue(0);
      modalOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    setSpeedLimitInput('60'); // Reset to default
    setShowAddRadarModal(true);
    // Animate modal in
    modalScale.setValue(0);
    modalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const confirmAddRadar = async () => {
    if (!userLocation) return;
    
    // Animate modal out
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAddRadarModal(false);
    });
    
    try {
      const speedLimit = parseInt(speedLimitInput) || 60;
      const newRadar = {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        type: 'fixed' as const,
        speedLimit: speedLimit,
        isActive: true,
      };

      const createdRadar = await radarsApi.createRadar(newRadar);
      if (createdRadar) {
        setRadars([...radars, createdRadar]);
        setShowSuccessModal(true);
        // Animate success modal
        modalScale.setValue(0);
        modalOpacity.setValue(0);
        Animated.parallel([
          Animated.spring(modalScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
          Animated.timing(modalOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error) {
      console.error('❌ რადარის დაფიქსირების შეცდომა:', error);
      setModalMessage('რადარის დაფიქსირება ვერ მოხერხდა');
      setShowErrorModal(true);
      // Animate error modal
      modalScale.setValue(0);
      modalOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(modalScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // მანქანის ფოტოს მიღება
  const getCarImage = () => {
    if (selectedCar?.imageUri) {
      return selectedCar.imageUri;
    }
    // Fallback - default car image (Porsche 911 style)
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800&auto=format&fit=crop';
  };

  // Intro Screen - Fullscreen onboarding
  if (showIntroScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0E' }}>
        <ImageBackground
          source={{ uri: getCarImage() }}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          {/* Dark overlay for text readability */}
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: 24,
          }}>
            {/* Text Content */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{
                fontSize: 32,
                fontFamily: 'Poppins_700Bold',
                color: '#FFFFFF',
                marginBottom: 16,
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
              }}>
                მზად ხარ სამოძრაოდ?
              </Text>
              <Text style={{
                fontSize: 16,
                fontFamily: 'Poppins_400Regular',
                color: '#E5E7EB',
                lineHeight: 24,
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}>
                {selectedCar 
                  ? `იხილე რადარები და ჯარიმების ინფორმაცია ${selectedCar.make} ${selectedCar.model}-ისთვის`
                  : 'იხილე რადარები და ჯარიმების ინფორმაცია'}
              </Text>
            </View>

            {/* Start Button */}
            <TouchableOpacity
              onPress={() => {
                setShowIntroScreen(false);
                // Waze-style: გადაიტანოს კამერა მანქანაზე როცა იწყება
                setTimeout(() => {
                  if (userLocation && mapRef.current) {
                    mapRef.current.animateCamera(
                      {
                        center: {
                          latitude: userLocation.coords.latitude,
                          longitude: userLocation.coords.longitude,
                        },
                        altitude: 200, // Waze-style: ძალიან ახლოს
                        pitch: 70, // 3D perspective
                        heading: userLocation.coords.heading || 0,
                      },
                      { duration: 1000 }
                    );
                  }
                }, 100);
              }}
              style={{
                backgroundColor: '#111827',
                paddingVertical: 18,
                paddingHorizontal: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 10,
                borderWidth: 2,
                borderColor: '#1F2937',
              }}
              activeOpacity={0.8}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontFamily: 'Poppins_700Bold',
                letterSpacing: 0.5,
              }}>
                დაწყება
              </Text>
            </TouchableOpacity>

            {/* Pagination dots */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: 24,
              gap: 8,
            }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#FFFFFF',
              }} />
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.3)',
              }} />
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.3)',
              }} />
            </View>
          </View>
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back Button - Top Left */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: (insets.top || (Platform.OS === 'ios' ? 48 : 18)) + 16,
          left: 16,
          backgroundColor: 'rgba(17,24,39,0.95)',
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 10,
          zIndex: 1000,
        }}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Bottom Left Corner - Speed & Radar Info */}
      <View
        style={{
          position: 'absolute',
          bottom: (insets.bottom || 20) + (showRadarInfo ? height * 0.5 : 0) + 20,
          left: 16,
          zIndex: 1000,
          gap: 12,
        }}
      >
        {/* User Speed Indicator */}
        {currentSpeed !== null && (
          <Animated.View
            style={{
              backgroundColor: isSpeedExceeded ? 'rgba(239,68,68,0.95)' : 'rgba(17,24,39,0.95)',
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderWidth: 2,
              borderColor: isSpeedExceeded ? '#EF4444' : '#3B82F6',
              shadowColor: isSpeedExceeded ? '#EF4444' : '#3B82F6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              minWidth: 120,
              opacity: speedExceededAnimation,
            }}
          >
            <Ionicons name="speedometer" size={22} color={isSpeedExceeded ? "#EF4444" : "#3B82F6"} />
            <View>
              <Text style={{
                color: '#9CA3AF',
                fontSize: 10,
                fontFamily: 'Poppins_500Medium',
              }}>
                სიჩქარე
              </Text>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 20,
                fontFamily: 'Poppins_700Bold',
                marginTop: 2,
              }}>
                {currentSpeed} კმ/სთ
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Next Radar Distance */}
        {nextRadar && userLocation && (
          <Animated.View
            style={{
              transform: [{ translateY: nextRadarSlideY }],
              opacity: nextRadarOpacity,
              maxWidth: width * 0.7,
            }}
          >
            <View
              style={{
                backgroundColor: 'rgba(17,24,39,0.95)',
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 16,
                borderWidth: 2,
                borderColor: '#EF4444',
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.6,
                shadowRadius: 16,
                elevation: 12,
                overflow: 'hidden',
              }}
            >
              {/* Gradient overlay effect */}
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: '#EF4444',
                opacity: 0.8,
              }} />
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {/* Icon Container */}
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                  elevation: 5,
                }}>
                  <Ionicons name={getRadarIcon(nextRadar.type) as any} size={24} color="#FFFFFF" />
                </View>
                
                {/* Content */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{
                      color: '#9CA3AF',
                      fontSize: 10,
                      fontFamily: 'Poppins_500Medium',
                    }}>
                      შემდეგი რადარი
                    </Text>
                    <View style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: '#EF4444',
                    }} />
                    <Text style={{
                      color: '#EF4444',
                      fontSize: 10,
                      fontFamily: 'Poppins_600SemiBold',
                    }}>
                      {getRadarTypeName(nextRadar.type)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 24,
                      fontFamily: 'Poppins_700Bold',
                      letterSpacing: -0.5,
                    }}>
                      {getDistanceKm(
                        userLocation.coords.latitude,
                        userLocation.coords.longitude,
                        nextRadar.latitude,
                        nextRadar.longitude
                      ).toFixed(1)}
                    </Text>
                    <Text style={{
                      color: '#9CA3AF',
                      fontSize: 14,
                      fontFamily: 'Poppins_500Medium',
                    }}>
                      კმ
                    </Text>
                  </View>
                </View>
                
                {/* Speed Limit Badge */}
                {nextRadar.speedLimit && (
                  <View style={{
                    backgroundColor: '#EF4444',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    shadowColor: '#EF4444',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.4,
                    shadowRadius: 6,
                    elevation: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 50,
                  }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontFamily: 'Poppins_500Medium',
                      marginBottom: 2,
                    }}>
                      ლიმიტი
                    </Text>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 18,
                      fontFamily: 'Poppins_700Bold',
                    }}>
                      {nextRadar.speedLimit}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Radar Alert */}
      
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={(ref) => {
            mapRef.current = ref;
          }}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={mapRegion}
          onRegionChangeComplete={(region) => {
            setMapRegion(region);
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          customMapStyle={MAP_STYLE_MINIMAL_DARK}
          pitchEnabled={true}
          rotateEnabled={true}
          initialCamera={{
            center: {
              latitude: mapRegion.latitude,
              longitude: mapRegion.longitude,
            },
            altitude: 200, // Waze-style: ძალიან ახლოს - ~200 მეტრი (navigation mode)
            pitch: 70, // 3D პერსპექტივა (70 გრადუსი - horizontal view, Waze-style)
            heading: 0, // Car's heading
          }}
          followsUserLocation={false} // We control camera manually
          showsCompass={false}
          showsScale={false}
          showsBuildings={true} // Waze shows buildings
          showsTraffic={false}
        >
          {/* User location marker - Waze-style car marker */}
          {userLocation && (
            <Marker
              coordinate={{
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={userLocation.coords.heading || 0}
              flat={true}
              zIndex={1000}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Waze-style car: blue circle with white car icon */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#3B82F6',
                    borderWidth: 3,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                    elevation: 10,
                  }}
                >
                  <Ionicons name="car-sport" size={20} color="#FFFFFF" />
                </View>
                {/* Direction indicator - small triangle pointing forward */}
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderBottomWidth: 8,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: '#3B82F6',
                  }}
                />
              </View>
            </Marker>
          )}

          {/* Accuracy circle */}
          {userLocation && userLocation.coords.accuracy && (
            <Circle
              center={{
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
              }}
              radius={userLocation.coords.accuracy}
              fillColor="rgba(96, 165, 250, 0.1)"
              strokeColor="rgba(96, 165, 250, 0.3)"
              strokeWidth={1}
            />
          )}

          {/* Radar markers - მხოლოდ ახლო რადარები */}
          {nearbyFilteredRadars.map((radar, index) => {
            const radarColor = getRadarColor(radar.type);
            const isSelected = selectedRadar?._id === radar._id;

            return (
              <Marker
                key={`radar-${radar._id || index}`}
                coordinate={{
                  latitude: radar.latitude,
                  longitude: radar.longitude,
                }}
                onPress={() => handleRadarPress(radar)}
              >
                <View
                  style={{
                    backgroundColor: radarColor,
                    borderRadius: 20,
                    width: 44,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: isSelected ? 3 : 2,
                    borderColor: '#FFFFFF',
                    shadowColor: radarColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.6,
                    shadowRadius: 8,
                    elevation: 10,
                    transform: isSelected ? [{ scale: 1.2 }] : [],
                  }}
                >
                  <Ionicons name={getRadarIcon(radar.type) as any} size={22} color="#FFFFFF" />
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Location Button */}
        <TouchableOpacity 
          style={{
            position: 'absolute',
            right: 16,
            bottom: 180,
            backgroundColor: 'rgba(17,24,39,0.85)',
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 6,
          }}
          onPress={onMyLocation}
          activeOpacity={0.7}
        >
          <Feather name="navigation" size={18} color="#60A5FA" />
        </TouchableOpacity>

        {/* Add Radar Button - Top Right */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: (insets.top || (Platform.OS === 'ios' ? 48 : 18)) + 16, // Top right corner
            right: 16,
            backgroundColor: '#EF4444',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 10,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            zIndex: 1000,
          }}
          onPress={handleAddRadar}
          activeOpacity={0.8}
        >
          <Text style={{
            color: '#FFFFFF',
            fontSize: 12,
            fontFamily: 'Poppins_600SemiBold',
            letterSpacing: 0.3,
          }}>
            რადარის დაფიქსირება
          </Text>
        </TouchableOpacity>

        {/* Info Add Button - Bottom Right */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            bottom: (insets.bottom || 20) + (showRadarInfo ? height * 0.5 : 0) + 20, // Bottom right, above radar info card if visible
            right: 16,
            backgroundColor: 'rgba(17,24,39,0.95)',
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.2)',
            zIndex: 1000,
          }}
          onPress={() => {
            // TODO: Add info functionality
            Alert.alert('ინფორმაცია', 'ინფორმაციის დამატების ფუნქცია მალე დაემატება');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="information-circle" size={28} color="#60A5FA" />
        </TouchableOpacity>
      </View>

      {/* Add Radar Modal */}
      {showAddRadarModal && userLocation && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            opacity: modalOpacity,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: '#1F2937',
              borderRadius: 24,
              padding: 24,
              width: width * 0.85,
              maxWidth: 400,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.1)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 20,
              transform: [{ scale: modalScale }],
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#EF4444',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="radio" size={24} color="#FFFFFF" />
              </View>
              <Text style={{
                fontSize: 18,
                fontFamily: 'Poppins_700Bold',
                color: '#FFFFFF',
                flex: 1,
              }}>
                რადარის დაფიქსირება
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Animated.parallel([
                    Animated.timing(modalScale, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }),
                    Animated.timing(modalOpacity, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }),
                  ]).start(() => {
                    setShowAddRadarModal(false);
                  });
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <Text style={{
              fontSize: 14,
              fontFamily: 'Poppins_500Medium',
              color: '#E5E7EB',
              marginBottom: 16,
              lineHeight: 20,
            }}>
              დააფიქსირებთ რადარს ამ ადგილას?
            </Text>

            {/* Coordinates */}
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Feather name="map-pin" size={14} color="#60A5FA" />
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'Poppins_600SemiBold',
                  color: '#60A5FA',
                  marginLeft: 8,
                }}>
                  კოორდინატები
                </Text>
              </View>
              <Text style={{
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#9CA3AF',
                marginTop: 4,
              }}>
                {userLocation.coords.latitude.toFixed(6)}, {userLocation.coords.longitude.toFixed(6)}
              </Text>
            </View>

            {/* Speed Limit Input */}
            <View style={{
              backgroundColor: 'rgba(59,130,246,0.1)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: 'rgba(59,130,246,0.3)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="speedometer" size={14} color="#3B82F6" />
                <Text style={{
                  fontSize: 11,
                  fontFamily: 'Poppins_600SemiBold',
                  color: '#3B82F6',
                  marginLeft: 8,
                }}>
                  დაშვებული სიჩქარე (კმ/სთ)
                </Text>
              </View>
              <TextInput
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  fontFamily: 'Poppins_600SemiBold',
                  color: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: 'rgba(59,130,246,0.3)',
                  marginTop: 8,
                }}
                value={speedLimitInput}
                onChangeText={setSpeedLimitInput}
                placeholder="60"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  Animated.parallel([
                    Animated.timing(modalScale, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }),
                    Animated.timing(modalOpacity, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }),
                  ]).start(() => {
                    setShowAddRadarModal(false);
                  });
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontSize: 13,
                  fontFamily: 'Poppins_600SemiBold',
                  color: '#E5E7EB',
                }}>
                  გაუქმება
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmAddRadar}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                  elevation: 8,
                }}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 13,
                  fontFamily: 'Poppins_700Bold',
                  color: '#FFFFFF',
                }}>
                  დაფიქსირება
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            opacity: modalOpacity,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: '#1F2937',
              borderRadius: 24,
              padding: 32,
              width: width * 0.8,
              maxWidth: 350,
              borderWidth: 2,
              borderColor: '#22C55E',
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 20,
              alignItems: 'center',
              transform: [{ scale: modalScale }],
            }}
          >
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#22C55E',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="checkmark" size={32} color="#FFFFFF" />
            </View>
            <Text style={{
              fontSize: 18,
              fontFamily: 'Poppins_700Bold',
              color: '#FFFFFF',
              marginBottom: 12,
              textAlign: 'center',
            }}>
              წარმატება
            </Text>
            <Text style={{
              fontSize: 13,
              fontFamily: 'Poppins_500Medium',
              color: '#E5E7EB',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              რადარი წარმატებით დაფიქსირებულია!
            </Text>
            <TouchableOpacity
              onPress={() => {
                Animated.parallel([
                  Animated.timing(modalScale, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(modalOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  setShowSuccessModal(false);
                });
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 32,
                borderRadius: 12,
                backgroundColor: '#22C55E',
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
              activeOpacity={0.8}
            >
              <Text style={{
                fontSize: 13,
                fontFamily: 'Poppins_700Bold',
                color: '#FFFFFF',
              }}>
                კარგი
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            opacity: modalOpacity,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: '#1F2937',
              borderRadius: 24,
              padding: 32,
              width: width * 0.8,
              maxWidth: 350,
              borderWidth: 2,
              borderColor: '#EF4444',
              shadowColor: '#EF4444',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 20,
              alignItems: 'center',
              transform: [{ scale: modalScale }],
            }}
          >
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#EF4444',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            </View>
            <Text style={{
              fontSize: 18,
              fontFamily: 'Poppins_700Bold',
              color: '#FFFFFF',
              marginBottom: 12,
              textAlign: 'center',
            }}>
              შეცდომა
            </Text>
            <Text style={{
              fontSize: 13,
              fontFamily: 'Poppins_500Medium',
              color: '#E5E7EB',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              {modalMessage}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Animated.parallel([
                  Animated.timing(modalScale, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(modalOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  setShowErrorModal(false);
                });
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 32,
                borderRadius: 12,
                backgroundColor: '#EF4444',
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
              activeOpacity={0.8}
            >
              <Text style={{
                fontSize: 13,
                fontFamily: 'Poppins_700Bold',
                color: '#FFFFFF',
              }}>
                კარგი
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Radar Info Card */}
      {showRadarInfo && selectedRadar && (
        <Animated.View
          style={[
            styles.radarInfoCard,
            {
              transform: [{ translateY: cardTranslateY }],
              height: height * 0.5,
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <TouchableOpacity
              style={styles.collapseButton}
              onPress={toggleCard}
              activeOpacity={0.7}
            >
              <Feather 
                name={cardExpanded ? "chevron-down" : "chevron-up"} 
                size={20} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: getRadarColor(selectedRadar.type) + '25',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2.5,
                    borderColor: getRadarColor(selectedRadar.type),
                    shadowColor: getRadarColor(selectedRadar.type),
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Ionicons 
                    name={getRadarIcon(selectedRadar.type) as any} 
                    size={24} 
                    color={getRadarColor(selectedRadar.type)} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { fontSize: 20, marginBottom: 4 }]}>
                    {getRadarTypeName(selectedRadar.type)}
                  </Text>
                  {selectedRadar.address && (
                    <Text style={{ color: '#9CA3AF', fontSize: 13, fontFamily: 'Poppins_500Medium' }} numberOfLines={1}>
                      {selectedRadar.address}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={toggleCard}
                activeOpacity={0.7}
              >
                <Feather 
                  name={cardExpanded ? "chevron-down" : "chevron-up"} 
                  size={18} 
                  color="#9CA3AF" 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  // Waze-style: slide down and hide
                  Animated.timing(cardTranslateY, {
                    toValue: height,
                    duration: 300,
                    useNativeDriver: true,
                  }).start(() => {
                    setShowRadarInfo(false);
                    setSelectedRadar(null);
                    setCardExpanded(false);
                  });
                }}
              >
                <Feather name="x" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {cardExpanded ? (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
            {/* Speed Limit Card */}
            {selectedRadar.speedLimit && (
              <View style={[styles.infoCard, { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 24, 
                    backgroundColor: '#3B82F6', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Ionicons name="speedometer" size={24} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'Poppins_500Medium' }}>
                      სიჩქარის ლიმიტი
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 24, fontFamily: 'Poppins_700Bold', marginTop: 2 }}>
                      {selectedRadar.speedLimit} კმ/სთ
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Info Grid */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {selectedRadar.direction && (
                <View style={[styles.infoCard, { flex: 1, backgroundColor: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.3)' }]}>
                  <Feather name="navigation" size={20} color="#8B5CF6" />
                  <Text style={{ color: '#9CA3AF', fontSize: 10, fontFamily: 'Poppins_500Medium', marginTop: 6 }}>
                    მიმართულება
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold', marginTop: 2 }} numberOfLines={2}>
                    {selectedRadar.direction}
                  </Text>
                </View>
              )}
              {userLocation && (
                <View style={[styles.infoCard, { flex: 1, backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' }]}>
                  <Ionicons name="resize" size={20} color="#22C55E" />
                  <Text style={{ color: '#9CA3AF', fontSize: 10, fontFamily: 'Poppins_500Medium', marginTop: 6 }}>
                    მანძილი
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold', marginTop: 2 }}>
                    {getDistanceKm(
                      userLocation.coords.latitude,
                      userLocation.coords.longitude,
                      selectedRadar.latitude,
                      selectedRadar.longitude
                    ).toFixed(2)} კმ
                  </Text>
                </View>
              )}
            </View>

            {selectedRadar.description && (
              <View style={[styles.infoCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Feather name="info" size={16} color="#60A5FA" />
                  <Text style={{ color: '#60A5FA', fontSize: 13, fontFamily: 'Poppins_600SemiBold' }}>
                    აღწერა
                  </Text>
                </View>
                <Text style={{ color: '#E5E7EB', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 20 }}>
                  {selectedRadar.description}
                </Text>
              </View>
            )}

            {/* Fine Information */}
            {selectedRadar.fineCount > 0 && (
              <View style={styles.fineBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name="warning" size={18} color="#FCA5A5" />
                  <Text style={styles.fineText}>
                    ⚠️ ამ რადარზე დაწერილია {selectedRadar.fineCount} ჯარიმა
                  </Text>
                </View>
                {selectedRadar.lastFineDate && (
                  <Text style={{ color: '#FCA5A5', fontSize: 11, fontFamily: 'Poppins_500Medium' }}>
                    ბოლო ჯარიმა: {new Date(selectedRadar.lastFineDate).toLocaleDateString('ka-GE')}
                  </Text>
                )}
                <Text
                  style={{
                    color: '#FCA5A5',
                    fontSize: 11,
                    fontFamily: 'Poppins_500Medium',
                    marginTop: 4,
                  }}
                >
                  💡 ყურადღებით გაიარე ამ ადგილას!
                </Text>
              </View>
            )}

            {/* Coordinates */}
            <View style={[styles.infoCard, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Feather name="map-pin" size={16} color="#9CA3AF" />
                <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'Poppins_500Medium' }}>
                  კოორდინატები
                </Text>
              </View>
              <Text style={[styles.infoValue, { fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }]}>
                {selectedRadar.latitude.toFixed(6)}, {selectedRadar.longitude.toFixed(6)}
              </Text>
            </View>
          </ScrollView>
          ) : (
            <View style={{ paddingTop: 8 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 12, fontFamily: 'Poppins_500Medium', textAlign: 'center' }}>
                დაჭერე ზემოთ რომ ნახო დეტალები
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}
