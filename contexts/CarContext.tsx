import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Car } from '../types/garage';
import { garageApi, Car as ApiCar, CreateCarData, Reminder, CreateReminderData, FuelEntry, ServiceHistory, CreateServiceHistoryData } from '../services/garageApi';
import { useUser } from './UserContext';

interface CarContextType {
  cars: Car[];
  selectedCar: Car | null;
  reminders: Reminder[];
  fuelEntries: FuelEntry[];
  serviceHistory: ServiceHistory[];
  loading: boolean;
  error: string | null;
  addCar: (car: Omit<Car, 'id' | 'lastService' | 'nextService'>) => Promise<void>;
  selectCar: (car: Car) => void;
  removeCar: (carId: string) => Promise<void>;
  updateCar: (carId: string, updates: Partial<Car>) => Promise<void>;
  addReminder: (reminder: CreateReminderData) => Promise<void>;
  updateReminder: (reminderId: string, updates: Partial<CreateReminderData>) => Promise<void>;
  deleteReminder: (reminderId: string) => Promise<void>;
  markReminderCompleted: (reminderId: string) => Promise<void>;
  loadFuel: (carId?: string) => Promise<void>;
  addFuel: (entry: Omit<FuelEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  addServiceHistory: (service: CreateServiceHistoryData) => Promise<void>;
  updateServiceHistory: (serviceId: string, updates: Partial<CreateServiceHistoryData>) => Promise<void>;
  deleteServiceHistory: (serviceId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const CarContext = createContext<CarContextType | undefined>(undefined);


export function CarProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [serviceHistory, setServiceHistory] = useState<ServiceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) {
      console.log('No user found in loadData');
      setCars([]);
      setSelectedCar(null);
      return;
    }
    
    try {
      console.log('Loading data for user:', user.id);
      console.log('CarContext: User object:', {
        id: user.id,
        name: user.name,
        email: user.email
      });
      setLoading(true);
      setError(null);
      
      // Set user ID for API calls
      garageApi.setUserId(user.id);
      console.log('User ID set for API calls:', user.id);
      
      const [carsData, remindersData, fuelData] = await Promise.all([
        garageApi.getCars(),
        garageApi.getReminders(),
        garageApi.getFuelEntries(),
      ]);
      

      // API Car-ს გადაყვანა Local Car-ში
      const convertedCars: Car[] = carsData.map((apiCar: ApiCar) => ({
        id: apiCar.id,
        make: apiCar.make,
        model: apiCar.model,
        year: apiCar.year,
        plateNumber: apiCar.plateNumber,
        imageUri: apiCar.imageUri || getCarImage(apiCar.make),
        vin: (apiCar as any).vin,
        techPassport: (apiCar as any).techPassport,
        lastService: apiCar.lastService ? new Date(apiCar.lastService) : undefined,
        nextService: apiCar.nextService ? new Date(apiCar.nextService) : undefined,
      }));

      setCars(convertedCars);
      setReminders(remindersData);
      setFuelEntries(fuelData);

      // თუ არჩეული მანქანა არ არის, პირველი აირჩიე
      let finalSelectedCar = selectedCar;
      if (!selectedCar && convertedCars.length > 0) {
        finalSelectedCar = convertedCars[0];
        setSelectedCar(finalSelectedCar);
      } else if (convertedCars.length === 0) {
        setSelectedCar(null);
        setServiceHistory([]);
        return;
      }

      // Load service history for selected car
      if (finalSelectedCar) {
        try {
          const serviceHistoryData = await garageApi.getServiceHistories(finalSelectedCar.id);
          setServiceHistory(serviceHistoryData);
        } catch (err) {
          console.error('Error loading service history:', err);
          setServiceHistory([]);
        }
      } else {
        setServiceHistory([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'მონაცემების ჩატვირთვის შეცდომა');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      console.log('User loaded, loading data for user:', user.id);
      // Reset selection on user change to avoid stale car from previous user
      setSelectedCar(null);
      setCars([]);
      loadData();
    } else {
      console.log('No user found, waiting for user...');
      setSelectedCar(null);
      setCars([]);
    }
  }, [user]);

  const getCarImage = (make: string) => {
    const carImages: { [key: string]: string } = {
      'BMW': 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Mercedes-Benz': 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Audi': 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Toyota': 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Honda': 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Nissan': 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Ford': 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Volkswagen': 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Hyundai': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Kia': 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Mazda': 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Subaru': 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Lexus': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Infiniti': 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Acura': 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Volvo': 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Jaguar': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'Porsche': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    };
    return carImages[make] || 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
  };

  // API ფუნქციები
  const addCar = async (carData: Omit<Car, 'id' | 'lastService' | 'nextService'>) => {
    try {
      const createCarData: CreateCarData = {
        make: carData.make,
        model: carData.model,
        year: carData.year,
        plateNumber: carData.plateNumber,
        imageUri: carData.imageUri || getCarImage(carData.make),
        mileage: (carData as any).mileage,
        color: (carData as any).color,
        vin: carData.vin,
        techPassport: carData.techPassport,
      };

      const newApiCar = await garageApi.createCar(createCarData);
      
      const newCar: Car = {
        id: newApiCar.id,
        make: newApiCar.make,
        model: newApiCar.model,
        year: newApiCar.year,
        plateNumber: newApiCar.plateNumber,
        imageUri: newApiCar.imageUri || carData.imageUri || getCarImage(newApiCar.make),
        vin: (newApiCar as any).vin,
        techPassport: (newApiCar as any).techPassport,
        lastService: newApiCar.lastService ? new Date(newApiCar.lastService) : undefined,
        nextService: newApiCar.nextService ? new Date(newApiCar.nextService) : undefined,
      };

      setCars(prevCars => [...prevCars, newCar]);
      
      // If this is the first car, select it
      if (cars.length === 0) {
        setSelectedCar(newCar);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'მანქანის დამატების შეცდომა');
      throw err;
    }
  };

  const selectCar = (car: Car) => {
    setSelectedCar(car);
  };

  const removeCar = async (carId: string) => {
    try {
      await garageApi.deleteCar(carId);
      setCars(prevCars => prevCars.filter(car => car.id !== carId));
      
      // If we're removing the selected car, select the first available car
      if (selectedCar?.id === carId) {
        const remainingCars = cars.filter(car => car.id !== carId);
        setSelectedCar(remainingCars.length > 0 ? remainingCars[0] : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'მანქანის წაშლის შეცდომა');
      throw err;
    }
  };

  const updateCar = async (carId: string, updates: Partial<Car>) => {
    try {
      const updateData: Partial<CreateCarData> = {
        make: updates.make,
        model: updates.model,
        year: updates.year,
        plateNumber: updates.plateNumber,
        imageUri: updates.imageUri,
        vin: updates.vin,
        techPassport: updates.techPassport,
      };

      const updatedApiCar = await garageApi.updateCar(carId, updateData);
      
      const updatedCar: Car = {
        id: updatedApiCar.id,
        make: updatedApiCar.make,
        model: updatedApiCar.model,
        year: updatedApiCar.year,
        plateNumber: updatedApiCar.plateNumber,
        imageUri: updatedApiCar.imageUri || getCarImage(updatedApiCar.make),
        vin: (updatedApiCar as any).vin,
        techPassport: (updatedApiCar as any).techPassport,
        lastService: updatedApiCar.lastService ? new Date(updatedApiCar.lastService) : undefined,
        nextService: updatedApiCar.nextService ? new Date(updatedApiCar.nextService) : undefined,
      };

      setCars(prevCars => 
        prevCars.map(car => 
          car.id === carId ? updatedCar : car
        )
      );
      
      // Update selected car if it's the one being updated
      if (selectedCar?.id === carId) {
        setSelectedCar(updatedCar);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'მანქანის განახლების შეცდომა');
      throw err;
    }
  };

  // შეხსენებების API ფუნქციები
  const addReminder = async (reminderData: CreateReminderData) => {
    try {
      const newReminder = await garageApi.createReminder(reminderData);
      setReminders(prevReminders => [...prevReminders, newReminder]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეხსენების დამატების შეცდომა');
      throw err;
    }
  };

  const updateReminder = async (reminderId: string, updates: Partial<CreateReminderData>) => {
    try {
      const updatedReminder = await garageApi.updateReminder(reminderId, updates);
      setReminders(prevReminders => 
        prevReminders.map(reminder => 
          reminder.id === reminderId ? updatedReminder : reminder
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეხსენების განახლების შეცდომა');
      throw err;
    }
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      await garageApi.deleteReminder(reminderId);
      setReminders(prevReminders => prevReminders.filter(reminder => reminder.id !== reminderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეხსენების წაშლის შეცდომა');
      throw err;
    }
  };

  const markReminderCompleted = async (reminderId: string) => {
    try {
      const updatedReminder = await garageApi.markReminderCompleted(reminderId);
      setReminders(prevReminders => 
        prevReminders.map(reminder => 
          reminder.id === reminderId ? updatedReminder : reminder
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეხსენების დასრულების შეცდომა');
      throw err;
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  const loadFuel = async (carId?: string) => {
    const data = carId ? await garageApi.getFuelEntriesByCar(carId) : await garageApi.getFuelEntries();
    setFuelEntries(data);
  };

  const addFuel = async (entry: Omit<FuelEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    const created = await garageApi.createFuelEntry(entry);
    setFuelEntries(prev => [created, ...prev]);
  };

  const addServiceHistory = async (serviceData: CreateServiceHistoryData) => {
    try {
      const newService = await garageApi.createServiceHistory(serviceData);
      setServiceHistory(prev => [...prev, newService]);
      // Reload cars to update lastService
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'სერვისის დამატების შეცდომა');
      throw err;
    }
  };

  const updateServiceHistory = async (serviceId: string, updates: Partial<CreateServiceHistoryData>) => {
    try {
      const updatedService = await garageApi.updateServiceHistory(serviceId, updates);
      setServiceHistory(prev => 
        prev.map(service => 
          service.id === serviceId ? updatedService : service
        )
      );
      // Reload cars to update lastService
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'სერვისის განახლების შეცდომა');
      throw err;
    }
  };

  const deleteServiceHistory = async (serviceId: string) => {
    try {
      await garageApi.deleteServiceHistory(serviceId);
      setServiceHistory(prev => prev.filter(service => service.id !== serviceId));
      // Reload cars to update lastService
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'სერვისის წაშლის შეცდომა');
      throw err;
    }
  };

  // Reload service history when selected car changes
  useEffect(() => {
    if (selectedCar) {
      garageApi.getServiceHistories(selectedCar.id).then(data => {
        setServiceHistory(data);
      }).catch(err => {
        console.error('Error loading service history:', err);
      });
    } else {
      setServiceHistory([]);
    }
  }, [selectedCar]);

  return (
    <CarContext.Provider value={{
      cars,
      selectedCar,
      reminders,
      fuelEntries,
      serviceHistory,
      loading,
      error,
      addCar,
      selectCar,
      removeCar,
      updateCar,
      addReminder,
      updateReminder,
      deleteReminder,
      markReminderCompleted,
      loadFuel,
      addFuel,
      addServiceHistory,
      updateServiceHistory,
      deleteServiceHistory,
      refreshData,
    }}>
      {children}
    </CarContext.Provider>
  );
}

export function useCars() {
  const context = useContext(CarContext);
  if (context === undefined) {
    throw new Error('useCars must be used within a CarProvider');
  }
  return context;
}
