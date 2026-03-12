import API_BASE_URL from '../config/api';

const GARAGE_API_URL = `${API_BASE_URL}/garage`;

export interface Car {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  imageUri?: string;
  lastService?: Date;
  nextService?: Date;
  mileage?: number;
  color?: string;
  vin?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  id: string;
  userId: string;
  carId: string;
  car?: Car;
  title: string;
  description?: string;
  type: string;
  priority: string;
  reminderDate: Date;
  reminderTime?: string;
  reminderTime2?: string; // მეორე დრო "ყოველდღე"-სთვის (დღეში 2 ჯერ)
  startDate?: string; // დაწყების თარიღი recurring-ისთვის
  endDate?: string; // დასრულების თარიღი recurring-ისთვის
  recurringInterval?: string; // 'daily' | 'weekly' | 'monthly' | 'yearly'
  isCompleted: boolean;
  isUrgent: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCarData {
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  imageUri?: string;
  mileage?: number;
  color?: string;
  vin?: string;
  techPassport?: string;
}

export interface CreateReminderData {
  carId: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  reminderDate: string;
  reminderTime?: string;
  reminderTime2?: string; // მეორე დრო "ყოველდღე"-სთვის (დღეში 2 ჯერ)
  startDate?: string; // დაწყების თარიღი recurring-ისთვის
  endDate?: string; // დასრულების თარიღი recurring-ისთვის
  recurringInterval?: string; // 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export interface GarageStats {
  totalCars: number;
  totalReminders: number;
  urgentReminders: number;
  upcomingReminders: number;
  completedReminders: number;
}

export interface FuelEntry {
  id: string;
  userId: string;
  carId: string;
  date: string; // ISO
  liters: number;
  pricePerLiter: number;
  totalPrice: number;
  mileage: number;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface ServiceHistory {
  id: string;
  userId: string;
  carId: string;
  serviceType: string;
  date: Date | string;
  mileage: number;
  cost?: number;
  description?: string;
  provider?: string;
  location?: string;
  images?: string[];
  warrantyUntil?: Date | string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateServiceHistoryData {
  carId: string;
  serviceType: string;
  date: string;
  mileage: number;
  cost?: number;
  description?: string;
  provider?: string;
  location?: string;
  images?: string[];
  warrantyUntil?: string;
}

class GarageApiService {
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
      
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${GARAGE_API_URL}${endpoint}`;
    const userId = this.userId || 'demo-user';
    
    if (!this.userId) {
      console.warn('No user ID set! Using demo-user as fallback');
    }
    
    if (userId === 'demo-user') {
      console.warn('Using demo-user ID! This should be a real user ID');
    }
    
    // Log the actual user ID being used
    // Force real user ID if available
    if (this.userId && this.userId !== 'demo-user') {
    } else {
      console.warn('No real user ID available, using demo-user');
    }
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // 204 No Content ან ცარიელი body (მაგ. DELETE) – json არ ვპარსოთ
    const text = await response.text();
    if (response.status === 204 || !text?.trim()) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined as T;
    }
  }

  // მანქანების API
  async getCars(): Promise<Car[]> {
    return this.request<Car[]>('/cars');
  }

  async getCar(id: string): Promise<Car> {
    return this.request<Car>(`/cars/${id}`);
  }

  async createCar(carData: CreateCarData): Promise<Car> {
    return this.request<Car>('/cars', {
      method: 'POST',
      body: JSON.stringify(carData),
    });
  }

  async updateCar(id: string, carData: Partial<CreateCarData>): Promise<Car> {
    return this.request<Car>(`/cars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(carData),
    });
  }

  async deleteCar(id: string): Promise<void> {
    return this.request<void>(`/cars/${id}`, {
      method: 'DELETE',
    });
  }

  // შეხსენებების API
  async getReminders(): Promise<Reminder[]> {
    return this.request<Reminder[]>('/reminders');
  }

  async getRemindersByCar(carId: string): Promise<Reminder[]> {
    return this.request<Reminder[]>(`/reminders/car/${carId}`);
  }

  async getReminder(id: string): Promise<Reminder> {
    return this.request<Reminder>(`/reminders/${id}`);
  }

  async createReminder(reminderData: CreateReminderData): Promise<Reminder> {
    return this.request<Reminder>('/reminders', {
      method: 'POST',
      body: JSON.stringify(reminderData),
    });
  }

  async updateReminder(id: string, reminderData: Partial<CreateReminderData>): Promise<Reminder> {
    return this.request<Reminder>(`/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(reminderData),
    });
  }

  async deleteReminder(id: string): Promise<void> {
    return this.request<void>(`/reminders/${id}`, {
      method: 'DELETE',
    });
  }

  async markReminderCompleted(id: string): Promise<Reminder> {
    return this.request<Reminder>(`/reminders/${id}/complete`, {
      method: 'PATCH',
    });
  }

  // სტატისტიკა
  async getGarageStats(): Promise<GarageStats> {
    return this.request<GarageStats>('/stats');
  }

  // საწვავი
  async getFuelEntries(): Promise<FuelEntry[]> {
    return this.request<FuelEntry[]>('/fuel');
  }

  async getFuelEntriesByCar(carId: string): Promise<FuelEntry[]> {
    return this.request<FuelEntry[]>(`/fuel/car/${carId}`);
  }

  async createFuelEntry(entry: Omit<FuelEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<FuelEntry> {
    return this.request<FuelEntry>('/fuel', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  // Service History API
  async getServiceHistories(carId?: string): Promise<ServiceHistory[]> {
    const endpoint = carId ? `/services/car/${carId}` : '/services';
    return this.request<ServiceHistory[]>(endpoint);
  }

  async getServiceHistory(id: string): Promise<ServiceHistory> {
    return this.request<ServiceHistory>(`/services/${id}`);
  }

  async createServiceHistory(serviceData: CreateServiceHistoryData): Promise<ServiceHistory> {
    return this.request<ServiceHistory>('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }

  async updateServiceHistory(id: string, serviceData: Partial<CreateServiceHistoryData>): Promise<ServiceHistory> {
    return this.request<ServiceHistory>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(serviceData),
    });
  }

  async deleteServiceHistory(id: string): Promise<void> {
    return this.request<void>(`/services/${id}`, {
      method: 'DELETE',
    });
  }
}

export const garageApi = new GarageApiService();
