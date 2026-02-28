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
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import type { LocationObject } from 'expo-location';
import { radarsApi, Radar } from '../services/radarsApi';
import { overpassApi, SpeedLimit, RadarLocation } from '../services/overpassApi';
import { geojsonRadarsService } from '../services/geojsonRadars';
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
  const [initialLoading, setInitialLoading] = useState(true); // Initial loading state
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 2, message: 'რადარების ჩატვირთვა...' });
  const [osmSpeedLimit, setOsmSpeedLimit] = useState<SpeedLimit | null>(null);
  const [loadingSpeedLimit, setLoadingSpeedLimit] = useState(false);
  const [osmRadarLocations, setOsmRadarLocations] = useState<RadarLocation[]>([]);
  const [loadingOsmRadars, setLoadingOsmRadars] = useState(false);
  const [geojsonLoaded, setGeojsonLoaded] = useState(false);
  const [allRadarsLoaded, setAllRadarsLoaded] = useState(false); // Flag to prevent re-loading
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
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  
  // Loading animation values
  const loadingDots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];
  
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
  
  // ხმის დაკვრის ფუნქცია - ვიბრაცია (expo-av არ არის დამატებული)
  const playAlertSound = async () => {
    // ვიბრაცია უკვე იკრება alert-ის გამოჩენისას
    // ხმა დაემატება მომავალში expo-av-ის დამატების შემდეგ
    console.log('Alert sound - vibration only (expo-av not installed)');
  };
  
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
      bottom: 240, // Location button-ის ზემოთ
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
      bottom: 20,
      left: 16,
      right: 16,
      backgroundColor: 'rgba(17,24,39,0.95)', // Floating card style
      borderRadius: 24,
      padding: 20,
      paddingTop: 20,
      paddingBottom: insets.bottom + 20,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 24,
      elevation: 120,
      zIndex: 2000,
      overflow: 'hidden',
      maxHeight: height * 0.6, // Max height
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

  // Load radars from GeoJSON + OSM (Overpass API) - ერთხელ
  useEffect(() => {
    const loadRadars = async () => {
      if (allRadarsLoaded) {
        return; // Already loaded
      }

      try {
        setInitialLoading(true);
        const allRadars: Radar[] = [];
        
        // Step 1: Load GeoJSON radars (static)
        setLoadingProgress({ current: 1, total: 2, message: 'GeoJSON რადარების ჩატვირთვა...' });
        try {
          const { geojsonData } = require('../geojson/export');
          
          if (geojsonData && geojsonData.features) {
            const geojsonRadars = geojsonRadarsService.loadRadarsFromInlineGeoJSON(geojsonData);
            
            if (geojsonRadars.length > 0) {
              allRadars.push(...geojsonRadars);
              setGeojsonLoaded(true);
            }
          }
        } catch (importError) {
        }

        // Step 2: Load OSM radars from Overpass API (საქართველოსთვის)
        setLoadingProgress({ current: 2, total: 2, message: 'OSM რადარების ჩატვირთვა...' });
        try {
          // Georgia bounding box (approximate) - მთელი საქართველო
          const georgiaBbox = {
            minLat: 41.0,
            maxLat: 43.6,
            minLng: 39.9,
            maxLng: 46.7,
          };

         
          const osmLocations = await overpassApi.getRadarLocations(
            georgiaBbox.minLat,
            georgiaBbox.maxLat,
            georgiaBbox.minLng,
            georgiaBbox.maxLng
          );


          if (osmLocations.length > 0) {
            const osmRadars: Radar[] = osmLocations.map((location, index) => {
              // Check for maxspeed in different formats (maxspeed, max-speed, max_speed)
              const maxSpeedValue = location.tags?.maxspeed || location.tags?.['max-speed'] || location.tags?.max_speed;
              const maxSpeed = maxSpeedValue ? parseInt(String(maxSpeedValue)) : undefined;
              
              // 🔍 დეტალური ლოგი location-ისთვის
            
              
              // განვსაზღვროთ რადარის ტიპი tags-ების მიხედვით
              let radarType: 'fixed' | 'mobile' | 'average_speed' = 'fixed';
              if (location.tags?.highway === 'speed_camera') {
                radarType = 'fixed'; // სიჩქარის კამერა
              } else if (location.tags?.enforcement === 'average_speed') {
                radarType = 'average_speed'; // საშუალო სიჩქარის კონტროლი
              } else if (location.tags?.enforcement === 'traffic_signals') {
                radarType = 'fixed'; // სინათლის კამერა
              } else if (location.tags?.surveillance === 'traffic_monitoring' || location.tags?.man_made === 'surveillance') {
                radarType = 'fixed'; // ტრაფიკის მონიტორინგი/CCTV
              }
              
              return {
                _id: `osm-${location.latitude}-${location.longitude}-${index}`,
                latitude: location.latitude,
                longitude: location.longitude,
                type: radarType,
                speedLimit: maxSpeed,
                address: location.name || location.description,
                description: location.description || `OSM: ${location.type || 'რადარი'}`,
                isActive: true,
                fineCount: 0,
                source: 'osm',
                // დავამატოთ დამატებითი ინფორმაცია tags-ებიდან
                radarSubType: location.tags?.highway || location.tags?.enforcement || location.tags?.surveillance,
              };
            });

            // Add OSM radars (avoid duplicates by coordinates)
            const existingCoords = new Set(
              allRadars.map(r => `${r.latitude.toFixed(6)}-${r.longitude.toFixed(6)}`)
            );
            const newOsmRadars = osmRadars.filter(r => {
              const coordKey = `${r.latitude.toFixed(6)}-${r.longitude.toFixed(6)}`;
              return !existingCoords.has(coordKey);
            });
            
            allRadars.push(...newOsmRadars);
          }
        } catch (osmError) {
          console.error('❌ OSM რადარების ჩატვირთვის შეცდომა:', osmError);
        }

        // Set all radars
        setRadars(allRadars);
        setAllRadarsLoaded(true);
        setInitialLoading(false);
      } catch (error) {
        console.error('❌ რადარების ჩატვირთვის შეცდომა:', error);
        setRadars([]);
        setAllRadarsLoaded(true);
        setInitialLoading(false);
      }
    };

    loadRadars();
  }, []); // Run only once on mount

  // Loading dots animation
  useEffect(() => {
    if (!initialLoading) return;

    const animateDots = () => {
      const animations = loadingDots.map((dot, index) => {
        return Animated.sequence([
          Animated.delay(index * 200),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]);
      });

      Animated.loop(Animated.parallel(animations)).start();
    };

    animateDots();
  }, [initialLoading]);

  // აღარ ვიტვირთავთ რადარებს userLocation-ის ან region-ის ცვლილებისას
  // ყველა რადარი უკვე ჩატვირთულია component mount-ისას

  // Load speed limit from Overpass API (OpenStreetMap)
  useEffect(() => {
    const loadSpeedLimit = async () => {
      if (!userLocation || !isReadyToDrive) {
        return;
      }

      try {
        setLoadingSpeedLimit(true);
        const speedLimit = await overpassApi.getSpeedLimitAtLocation(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          0.001 // ~100 მეტრი რადიუსი
        );

        if (speedLimit) {
          setOsmSpeedLimit(speedLimit);
        } else {
          setOsmSpeedLimit(null);
        }
      } catch (error) {
        console.error('❌ OSM სიჩქარის ლიმიტის ჩატვირთვის შეცდომა:', error);
        setOsmSpeedLimit(null);
      } finally {
        setLoadingSpeedLimit(false);
      }
    };

    // Debounce - სიჩქარის ლიმიტის განახლება 3 წამში ერთხელ
    const debounceTimer = setTimeout(() => {
      loadSpeedLimit();
    }, 3000);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [userLocation?.coords.latitude, userLocation?.coords.longitude, isReadyToDrive]);

  // Load user location - GPS tracking for real-time speed
  useEffect(() => {
    let locationSubscription: any;
    
    // Helper function to set Tbilisi location
    const setTbilisiLocation = () => {
      const tbilisiLocation: LocationObject = {
        coords: {
          latitude: 41.7151, // თბილისი, საქართველო
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
      
      // Update map region to Tbilisi
      const tbilisiRegion = {
        latitude: 41.7151,
        longitude: 44.8271,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setMapRegion(tbilisiRegion);
      
      // Animate camera to Tbilisi
      setTimeout(() => {
        mapRef.current?.animateCamera(
          {
            center: {
              latitude: 41.7151,
              longitude: 44.8271,
            },
            altitude: 200,
            pitch: 70,
            heading: 0,
          },
          { duration: 1000 }
        );
      }, 500);
    };
    
    // Helper function to check if location is in America (rough bounds)
    const isLocationInAmerica = (lat: number, lng: number): boolean => {
      // America bounds: roughly 25-50 N, -125 to -65 W
      return lat >= 25 && lat <= 50 && lng >= -125 && lng <= -65;
    };
    
    (async () => {
      try {
        // Default: Use Tbilisi location (სტატიკურად თბილისი)
        // Set Tbilisi immediately
        setTbilisiLocation();
        
        // Request location permission
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          // Already set to Tbilisi above
          return;
        }

        // Get initial location
        const location = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });
        
        // Check if location is in America - if so, use Tbilisi instead
        if (isLocationInAmerica(location.coords.latitude, location.coords.longitude)) {
          console.log('📍 Location is in America, using Tbilisi instead');
          // Already set to Tbilisi above, so just return
          return;
        }
        
        // Location is valid (not in America), use it
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

        // Real-time location tracking for speed (only if location is valid)
        if (!isLocationInAmerica(location.coords.latitude, location.coords.longitude)) {
          locationSubscription = await ExpoLocation.watchPositionAsync(
            {
              accuracy: ExpoLocation.Accuracy.High,
              timeInterval: 1000, // Update every 1 second for smooth speed display
              distanceInterval: 5, // Or every 5 meters
            },
            (newLocation) => {
              // Check if new location is in America - if so, ignore it
              if (isLocationInAmerica(newLocation.coords.latitude, newLocation.coords.longitude)) {
                return; // Ignore America locations
              }
              
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
        }
      } catch (error) {
        // Fallback to Tbilisi - default location (already set above)
        console.log('📍 Error getting location, using Tbilisi');
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
      
      // Update speed limit from closest radar or OSM
      if (closestRadar && closestRadar.speedLimit) {
        // Priority: Use radar speed limit if available
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
      } else if (osmSpeedLimit && osmSpeedLimit.maxSpeed) {
        // Fallback: Use OSM speed limit if no radar nearby
        if (currentSpeedLimit !== osmSpeedLimit.maxSpeed) {
          setCurrentSpeedLimit(osmSpeedLimit.maxSpeed);
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
      } else if (!closestRadar && !osmSpeedLimit && currentSpeedLimit) {
        // Hide if no radar or OSM speed limit available
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
  }, [userLocation, radars, nextRadar, currentSpeedLimit, osmSpeedLimit]);

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

      try {
        Vibration.vibrate([400, 200, 400]);
      } catch (error) {
      }


     
      if (Platform.OS === 'ios') {
        Alert.alert('', '', [{ text: 'OK' }], { cancelable: true });
      }
    } else if (!speedExceeded) {
      setIsSpeedExceeded(false);
    }
  }, [currentSpeed, nextRadar, lastAlertTime]);

  useEffect(() => {
    if (!userLocation || radars.length === 0) return;

    const checkNearbyRadars = () => {
      const userLat = userLocation.coords.latitude;
      const userLng = userLocation.coords.longitude;
      const alertRadius = 0.2; // 200 მეტრი - შეანელე მოძრაობა

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

            // Vibration alert
            try {
              Vibration.vibrate([300, 100, 300, 100, 300]);
            } catch (error) {
            }

            // Sound alert
            playAlertSound();

            // Auto-hide after 10 seconds (უფრო მეტი დრო რომ შეანელოს)
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
            }, 10000);
          }
          break;
        } else if (showRadarAlert && nearbyRadar?._id === radar._id) {
          // თუ გავცდით რადარს, დავხუროთ alert
          setShowRadarAlert(false);
          setNearbyRadar(null);
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

  const getRadarIcon = (radar: Radar) => {
    // განვასხვავოთ radarSubType-ის მიხედვით
    if (radar.radarSubType === 'speed_camera') {
      return 'camera'; // 📷 სიჩქარის კამერა
    } else if (radar.radarSubType === 'traffic_signals') {
      return 'stop-circle'; // 🚦 სინათლის კამერა (traffic signals)
    } else if (radar.radarSubType === 'average_speed') {
      return 'speedometer'; // ⚡ საშუალო სიჩქარის კონტროლი
    } else if (radar.radarSubType === 'traffic_monitoring' || radar.radarSubType === 'surveillance') {
      return 'videocam'; // 📹 ტრაფიკის მონიტორინგი/CCTV
    }
    
    // Fallback to type-based icons
    switch (radar.type) {
      case 'fixed':
        return 'radio'; // 📡 ფიქსირებული რადარი
      case 'mobile':
        return 'alert-circle'; // ⚠️ მობილური რადარი
      case 'average_speed':
        return 'speedometer'; // ⚡ საშუალო სიჩქარის რადარი
      default:
        return 'radio';
    }
  };

  const getRadarColor = (radar: Radar) => {
    // განვასხვავოთ radarSubType-ის მიხედვით
    if (radar.radarSubType === 'speed_camera') {
      return '#3B82F6'; // ლურჯი - სიჩქარის კამერა
    } else if (radar.radarSubType === 'traffic_signals') {
      return '#F59E0B'; // ყვითელი - სინათლის კამერა
    } else if (radar.radarSubType === 'average_speed') {
      return '#8B5CF6'; // იისფერი - საშუალო სიჩქარის კონტროლი
    } else if (radar.radarSubType === 'traffic_monitoring' || radar.radarSubType === 'surveillance') {
      return '#10B981'; // მწვანე - ტრაფიკის მონიტორინგი/CCTV
    }
    
    // Fallback to type-based colors
    switch (radar.type) {
      case 'fixed':
        return '#3B82F6'; // ლურჯი
      case 'mobile':
        return '#F59E0B'; // ყვითელი
      case 'average_speed':
        return '#8B5CF6'; // იისფერი
      default:
        return '#3B82F6'; // ლურჯი
    }
  };

  const getRadarTypeName = (radar: Radar) => {
    // განვასხვავოთ radarSubType-ის მიხედვით
    if (radar.radarSubType === 'speed_camera') {
      return 'სიჩქარის კამერა';
    } else if (radar.radarSubType === 'traffic_signals') {
      return 'სინათლის კამერა';
    } else if (radar.radarSubType === 'average_speed') {
      return 'საშუალო სიჩქარის კონტროლი';
    } else if (radar.radarSubType === 'traffic_monitoring' || radar.radarSubType === 'surveillance') {
      return 'ტრაფიკის მონიტორინგი';
    }
    
    // Fallback to type-based names
    switch (radar.type) {
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
        
        
        await mapRef.current?.animateCamera(newCamera, { duration: 200 });
        
        // დავალოგოთ რა მოხდა

        
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
    setCardExpanded(true); // Default-ად გახსნილი (უფრო მიმზიდველი)
    
    // Auto-show with smooth animation
    cardTranslateY.setValue(0); // Start from bottom
    cardOpacity.setValue(0); // Start invisible
    Animated.parallel([
      Animated.spring(cardTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
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

  // Show ALL radars (no map region filtering)
  const nearbyFilteredRadars = filteredRadars;



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
    // Fallback - default car image (მოდერნული სპორტული მანქანა)
    return 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=1920&auto=format&fit=crop';
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
                რადარის სისტემა ფუნქციონირებს სატესტო რეჟიმში.
                მიმდინარეობს ტექნიკური მონიტორინგი და ოპტიმიზაცია.
              </Text>
            </View>

            {/* Start Button */}
            <TouchableOpacity
              onPress={() => {
                setShowIntroScreen(false);
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

      </View>

      {/* Radar Alert - 200 მეტრით ადრე */}
      {showRadarAlert && nearbyRadar && (
        <Animated.View
          style={[
            styles.alertContainer,
            {
              opacity: alertOpacity,
              transform: [{ scale: alertScale }],
            },
          ]}
        >
          <View style={[styles.alertCard, { padding: 12, maxHeight: 120 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#EF4444',
                }}
              >
                <Ionicons name="warning" size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { fontSize: 14, marginBottom: 2 }]}>
                  შეანელე!
                </Text>
                <Text style={[styles.alertText, { fontSize: 11 }]}>
                  რადარი {getDistanceKm(
                    userLocation?.coords.latitude || 0,
                    userLocation?.coords.longitude || 0,
                    nearbyRadar.latitude,
                    nearbyRadar.longitude
                  ).toFixed(1)} კმ
                </Text>
              </View>
              {nearbyRadar.speedLimit && (
                <View style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  width: 50,
                  height: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#EF4444',
                }}>
                  <Text style={{
                    fontSize: 20,
                    fontFamily: 'Poppins_700Bold',
                    color: '#EF4444',
                  }}>
                    {nearbyRadar.speedLimit}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}
      
      {/* Initial Loading Overlay - Beautiful Animation */}
      {initialLoading && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 10000,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Animated.View
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.98)',
              borderRadius: 28,
              padding: 40,
              alignItems: 'center',
              minWidth: 300,
              maxWidth: 340,
              borderWidth: 1.5,
              borderColor: 'rgba(59, 130, 246, 0.3)',
              shadowColor: '#3B82F6',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 15,
            }}
          >
            {/* Animated Radar Icon */}
            <Animated.View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                borderWidth: 3,
                borderColor: '#3B82F6',
              }}
            >
              <ActivityIndicator size="large" color="#3B82F6" />
            </Animated.View>
            
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontFamily: 'Poppins_700Bold',
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {loadingProgress.message}
            </Text>
            
            <Text
              style={{
                color: '#9CA3AF',
                fontSize: 13,
                fontFamily: 'Poppins_500Medium',
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              {loadingProgress.current} / {loadingProgress.total}
            </Text>
            
            {/* Beautiful Progress Bar with Animation */}
            <View
              style={{
                width: 260,
                height: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 10,
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <Animated.View
                style={{
                  width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                  height: '100%',
                  backgroundColor: '#3B82F6',
                  borderRadius: 10,
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              />
            </View>
            
            {/* Loading Dots Animation */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {loadingDots.map((dot, index) => (
                <Animated.View
                  key={index}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#3B82F6',
                    opacity: dot,
                  }}
                />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      )}

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

          {/* Radar markers - ყველა რადარი */}
          {nearbyFilteredRadars.map((radar, index) => {
            const radarColor = getRadarColor(radar);
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
                  <Ionicons name={getRadarIcon(radar) as any} size={22} color="#FFFFFF" />
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity 
            style={styles.zoomButton}
            onPress={onZoomIn}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity 
            style={styles.zoomButton}
            onPress={onZoomOut}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

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

      {/* Radar Info Card - Floating Style */}
      {showRadarInfo && selectedRadar && (
        <Animated.View
          style={[
            styles.radarInfoCard,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          {/* Close Button - Top Right */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
            onPress={() => {
              Animated.parallel([
                Animated.timing(cardOpacity, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(cardTranslateY, {
                  toValue: 50,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                setShowRadarInfo(false);
                setSelectedRadar(null);
                setCardExpanded(false);
              });
            }}
            activeOpacity={0.7}
          >
            <Feather name="x" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.infoHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: getRadarColor(selectedRadar) + '25',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2.5,
                    borderColor: getRadarColor(selectedRadar),
                    shadowColor: getRadarColor(selectedRadar),
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Ionicons 
                    name={getRadarIcon(selectedRadar) as any} 
                    size={24} 
                    color={getRadarColor(selectedRadar)} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { fontSize: 20, marginBottom: 4 }]}>
                    {getRadarTypeName(selectedRadar)}
                  </Text>
                  {selectedRadar.address && (
                    <Text style={{ color: '#9CA3AF', fontSize: 13, fontFamily: 'Poppins_500Medium' }} numberOfLines={1}>
                      {selectedRadar.address}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Content - Always visible */}
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
                      რამდენია დაშვებული
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
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#22C55E',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4,
                  }}>
                    <Ionicons name="car-sport" size={24} color="#FFFFFF" />
                  </View>
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
        </Animated.View>
      )}
    </View>
  );
}
