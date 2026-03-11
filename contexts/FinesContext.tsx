import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useCars } from './CarContext';
import { useUser } from './UserContext';
import { useSubscription } from './SubscriptionContext';
import {
  finesApi,
  Penalty,
  VehicleRegistration,
  CarFinesSubscription,
} from '../services/finesApi';

// თითო მანქანის ჯარიმების დატა
export interface CarFinesData {
  carId: string;
  licensePlate: string;
  techPassport: string;
  penalties: Penalty[];
  lastChecked: Date | null;
  loading: boolean;
  error: string | null;
}

interface FinesContextType {
  // დატა
  registeredVehicles: VehicleRegistration[];
  carFinesSubscriptions: CarFinesSubscription[];
  carLimitInfo: {
    maxCars: number;
    registeredCars: number;
    canRegisterMore: boolean;
    additionalCarPrice: number;
    isPremium: boolean;
  } | null;
  carFinesMap: Record<string, CarFinesData>; // carId → ჯარიმების დატა

  // loading
  finesDataLoading: boolean;

  // computed values
  effectiveRegisteredCars: number;
  effectiveMaxCars: number;
  effectiveCanRegisterMore: boolean;

  // helper functions
  isVehicleRegistered: (plateNumber: string) => boolean;
  isCarMonitoringActive: (carId: string, plateNumber: string) => boolean;
  hasActiveCarSubscription: (carId: string) => boolean;
  getCarSubscription: (carId: string) => CarFinesSubscription | undefined;
  getCarFines: (carId: string) => CarFinesData | null;
  getTotalUnpaidFines: () => number;
  getTotalFinesCount: () => number;

  // actions
  checkFinesForCar: (
    carId: string,
    licensePlate: string,
    techPassport: string,
  ) => Promise<Penalty[]>;
  refreshFinesData: () => Promise<void>;
}

const FinesContext = createContext<FinesContextType | undefined>(undefined);

export function FinesProvider({ children }: { children: ReactNode }) {
  const { cars, loading: carsLoading } = useCars();
  const { user } = useUser();
  const { isPremiumUser, subscription } = useSubscription();

  const [registeredVehicles, setRegisteredVehicles] = useState<
    VehicleRegistration[]
  >([]);
  const [carFinesSubscriptions, setCarFinesSubscriptions] = useState<
    CarFinesSubscription[]
  >([]);
  const [carLimitInfo, setCarLimitInfo] = useState<{
    maxCars: number;
    registeredCars: number;
    canRegisterMore: boolean;
    additionalCarPrice: number;
    isPremium: boolean;
  } | null>(null);
  const [carFinesMap, setCarFinesMap] = useState<Record<string, CarFinesData>>(
    {},
  );
  const [finesDataLoading, setFinesDataLoading] = useState(true);
  const [autoCheckedCars, setAutoCheckedCars] = useState<Set<string>>(
    new Set(),
  );

  // ======== ბაზის დატის ჩატვირთვა ========
  const loadFinesData = useCallback(async () => {
    if (!user?.id || !isPremiumUser) {
      setFinesDataLoading(false);
      return;
    }

    setFinesDataLoading(true);
    try {
      const [vehicles, limitInfo, carSubs] = await Promise.all([
        finesApi.getUserRegisteredVehicles(user.id).catch((err) => {
          console.log('[FinesContext] Could not load user registered vehicles:', err);
          return [] as VehicleRegistration[];
        }),
        finesApi.getUserFinesCarLimit(user.id).catch((err) => {
          console.log('[FinesContext] Could not load car limit info:', err);
          return null;
        }),
        finesApi.getUserCarFinesSubscriptions(user.id).catch((err) => {
          console.log(
            '[FinesContext] Could not load car fines subscriptions:',
            err,
          );
          return [] as CarFinesSubscription[];
        }),
      ]);

      setRegisteredVehicles(vehicles);
      if (limitInfo) setCarLimitInfo(limitInfo);
      setCarFinesSubscriptions(carSubs);

      console.log('✅ [FinesContext] დატა ჩაიტვირთა:', {
        vehicles: vehicles.length,
        subscriptions: carSubs.length,
        maxCars: limitInfo?.maxCars,
        registeredCars: limitInfo?.registeredCars,
      });
      console.log('🔍 [FinesContext] getUserRegisteredVehicles რესპონსი (raw):', JSON.stringify(vehicles, null, 2));
    } finally {
      setFinesDataLoading(false);
    }
  }, [user?.id, isPremiumUser]);

  useEffect(() => {
    if (isPremiumUser && user?.id) {
      loadFinesData();
    } else {
      setFinesDataLoading(false);
    }
  }, [isPremiumUser, user?.id, loadFinesData]);

  // ======== Helper Functions ========
  const normalizePlate = (plate: string) =>
    (plate || '').toUpperCase().replace(/-/g, '').trim();

  const isVehicleRegistered = useCallback(
    (plateNumber: string) => {
      const norm = normalizePlate(plateNumber);
      if (!norm) return false;
      if (
        registeredVehicles.some(
          (v) => normalizePlate(v.vehicleNumber || '') === norm,
        )
      )
        return true;
      // ფოლბექი: გამოწერა აქვს ამ ნომერზე (ბაზაში FinesVehicle ჩანაწერი ვერ ჩაიწერა)
      return carFinesSubscriptions.some(
        (s) => normalizePlate(s.vehicleNumber || '') === norm,
      );
    },
    [registeredVehicles, carFinesSubscriptions],
  );

  // SA API-ში იუზერის მანქანებიდან რამდენია რეგისტრირებული
  const actualRegisteredCars = cars.filter((car) =>
    isVehicleRegistered(car.plateNumber || ''),
  ).length;

  const effectiveRegisteredCars = Math.max(
    carLimitInfo?.registeredCars || 0,
    actualRegisteredCars,
  );
  const effectiveMaxCars = carLimitInfo?.maxCars || 1;
  const effectiveCanRegisterMore =
    isPremiumUser && effectiveRegisteredCars < effectiveMaxCars;

  const getCarSubscription = useCallback(
    (carId: string) => {
      return carFinesSubscriptions.find(
        (s) => s.carId === carId && s.status === 'active' && s.isPaid,
      );
    },
    [carFinesSubscriptions],
  );

  const hasActiveCarSubscription = useCallback(
    (carId: string) => {
      return !!getCarSubscription(carId);
    },
    [getCarSubscription],
  );

  const isCarMonitoringActive = useCallback(
    (carId: string, plateNumber: string) => {
      if (!isPremiumUser) return false;
      if (!isVehicleRegistered(plateNumber)) return false;

      // თუ აქვს აქტიური გადახდილი გამოწერა — აქტიურია
      if (hasActiveCarSubscription(carId)) return true;

      // თუ დარეგისტრირებული მანქანები ლიმიტში ეტევა — ყველა უფასოა პრემიუმით
      if (effectiveRegisteredCars <= effectiveMaxCars) return true;

      // ლიმიტს აცდენილია — შევამოწმოთ ეს მანქანა "უფასო" სლოტში ხვდება თუ არა
      const carsWithPaidSub = new Set(
        carFinesSubscriptions
          .filter((s) => s.status === 'active' && s.isPaid)
          .map((s) => s.carId),
      );
      const registeredCarsWithoutSub = cars.filter((car) => {
        const isReg = isVehicleRegistered(car.plateNumber || '');
        return isReg && !carsWithPaidSub.has(car.id);
      });
      const freeCars = registeredCarsWithoutSub.slice(0, effectiveMaxCars);
      return freeCars.some((c) => c.id === carId);
    },
    [
      isPremiumUser,
      isVehicleRegistered,
      hasActiveCarSubscription,
      effectiveRegisteredCars,
      effectiveMaxCars,
      carFinesSubscriptions,
      cars,
    ],
  );

  // ======== ჯარიმების შემოწმება კონკრეტული მანქანისთვის ========
  const checkFinesForCar = useCallback(
    async (
      carId: string,
      licensePlate: string,
      techPassport: string,
    ): Promise<Penalty[]> => {
      console.log('🔍 [FinesContext] ჯარიმების შემოწმება:', {
        carId,
        licensePlate,
        techPassport,
      });

      // კარფინესმაპში loading state
      setCarFinesMap((prev) => ({
        ...prev,
        [carId]: {
          carId,
          licensePlate,
          techPassport,
          penalties: prev[carId]?.penalties || [],
          lastChecked: prev[carId]?.lastChecked || null,
          loading: true,
          error: null,
        },
      }));

      try {
        const penalties = await finesApi.getPenalties(
          licensePlate.trim().toUpperCase(),
          techPassport.trim(),
        );

        setCarFinesMap((prev) => ({
          ...prev,
          [carId]: {
            carId,
            licensePlate,
            techPassport,
            penalties,
            lastChecked: new Date(),
            loading: false,
            error: null,
          },
        }));

        console.log(
          `✅ [FinesContext] ${licensePlate}: ${penalties.length} ჯარიმა ნაპოვნია`,
        );
        return penalties;
      } catch (error: any) {
        console.error(
          `❌ [FinesContext] ${licensePlate} ჯარიმების შემოწმების შეცდომა:`,
          error,
        );

        setCarFinesMap((prev) => ({
          ...prev,
          [carId]: {
            carId,
            licensePlate,
            techPassport,
            penalties: [],
            lastChecked: new Date(),
            loading: false,
            error: error?.message || 'შეცდომა',
          },
        }));

        return [];
      }
    },
    [],
  );

  // ======== ავტომატური შემოწმება — ყველა რეგისტრირებული მანქანისთვის ========
  useEffect(() => {
    if (carsLoading || finesDataLoading || !isPremiumUser) return;
    if (cars.length === 0) return;

    const carsToAutoCheck = cars.filter((car) => {
      if (!car.plateNumber || !car.techPassport) return false;
      if (autoCheckedCars.has(car.id)) return false;
      return isCarMonitoringActive(car.id, car.plateNumber);
    });

    if (carsToAutoCheck.length === 0) return;

    console.log(
      `🔄 [FinesContext] ავტომატურად შემოწმდება ${carsToAutoCheck.length} მანქანის ჯარიმა`,
    );

    // დავნიშნოთ როგორც checked რომ აღარ გამეორდეს
    setAutoCheckedCars((prev) => {
      const next = new Set(prev);
      carsToAutoCheck.forEach((car) => next.add(car.id));
      return next;
    });

    // parallel-ში შევამოწმოთ ყველა მანქანა
    carsToAutoCheck.forEach((car) => {
      checkFinesForCar(car.id, car.plateNumber!, car.techPassport!);
    });
  }, [
    carsLoading,
    finesDataLoading,
    isPremiumUser,
    cars,
    autoCheckedCars,
    isCarMonitoringActive,
    checkFinesForCar,
  ]);

  // ======== Computed values ========
  const getCarFines = useCallback(
    (carId: string): CarFinesData | null => {
      return carFinesMap[carId] || null;
    },
    [carFinesMap],
  );

  const getTotalUnpaidFines = useCallback(() => {
    let total = 0;
    Object.values(carFinesMap).forEach((data) => {
      data.penalties.forEach((p) => {
        total += p.finalAmount || 0;
      });
    });
    return total;
  }, [carFinesMap]);

  const getTotalFinesCount = useCallback(() => {
    let count = 0;
    Object.values(carFinesMap).forEach((data) => {
      count += data.penalties.length;
    });
    return count;
  }, [carFinesMap]);

  const refreshFinesData = useCallback(async () => {
    setAutoCheckedCars(new Set()); // რესეტი — ხელახლა შეამოწმებს
    await loadFinesData();
  }, [loadFinesData]);

  const value: FinesContextType = {
    registeredVehicles,
    carFinesSubscriptions,
    carLimitInfo,
    carFinesMap,
    finesDataLoading,
    effectiveRegisteredCars,
    effectiveMaxCars,
    effectiveCanRegisterMore,
    isVehicleRegistered,
    isCarMonitoringActive,
    hasActiveCarSubscription,
    getCarSubscription,
    getCarFines,
    getTotalUnpaidFines,
    getTotalFinesCount,
    checkFinesForCar,
    refreshFinesData,
  };

  return (
    <FinesContext.Provider value={value}>{children}</FinesContext.Provider>
  );
}

export function useFines() {
  const context = useContext(FinesContext);
  if (context === undefined) {
    throw new Error('useFines must be used within a FinesProvider');
  }
  return context;
}
