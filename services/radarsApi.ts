import API_BASE_URL from '../config/api';

export interface Radar {
  _id?: string;
  id?: string;
  latitude: number;
  longitude: number;
  type: 'fixed' | 'mobile' | 'average_speed';
  direction?: string;
  speedLimit?: number;
  fineCount: number;
  lastFineDate?: string;
  description?: string;
  address?: string;
  isActive: boolean;
  source?: string;
}

export interface RadarsResponse {
  success: boolean;
  data: Radar[];
}

class RadarsApiService {
  /**
   */
  async getAllRadars(): Promise<Radar[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/radars`);
      if (!response.ok) {
        throw new Error('რადარების მიღება ვერ მოხერხდა');
      }
      const result: RadarsResponse = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('❌ რადარების მიღების შეცდომა:', error);
      return [];
    }
  }


  async getRadarsByRegion(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
  ): Promise<Radar[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/radars/region?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}`,
      );
      if (!response.ok) {
        throw new Error('რადარების მიღება ვერ მოხერხდა');
      }
      const result: RadarsResponse = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('❌ რადარების მიღების შეცდომა:', error);
      return [];
    }
  }

  async getRadarsNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
  ): Promise<Radar[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/radars/nearby?lat=${latitude}&lng=${longitude}&radius=${radiusKm}`,
      );
      if (!response.ok) {
        throw new Error('რადარების მიღება ვერ მოხერხდა');
      }
      const result: RadarsResponse = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('❌ რადარების მიღების შეცდომა:', error);
      return [];
    }
  }


  async addFine(radarId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/radars/${radarId}/fine`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('ჯარიმის დამატება ვერ მოხერხდა');
      }
      return true;
    } catch (error) {
      console.error('❌ ჯარიმის დამატების შეცდომა:', error);
      return false;
    }
  }

  /**
   * ახალი რადარის შექმნა
   */
  async createRadar(radarData: Partial<Radar>): Promise<Radar | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/radars`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(radarData),
      });
      if (!response.ok) {
        throw new Error('რადარის შექმნა ვერ მოხერხდა');
      }
      const result = await response.json();
      return result.data || result;
    } catch (error) {
      console.error('❌ რადარის შექმნის შეცდომა:', error);
      return null;
    }
  }
}

export const radarsApi = new RadarsApiService();
