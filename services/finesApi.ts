// საქართველოს სახელმწიფო სერვისების API - ჯარიმების სერვისი
// Backend API-ს გავლით (უსაფრთხოა - Client ID და Secret არ არის exposed frontend-ში)

import API_BASE_URL from '../config/api';

const FINES_API_URL = `${API_BASE_URL}/fines`;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface VehicleRegistration {
  id: number;
  vehicleNumber: string;
  techPassportNumber: string;
  addDate?: string;
  cancelDate?: string;
}

export interface VehicleRegistrationRequest {
  VehicleNumber: string;
  TechPassportNumber: string;
  MediaFile?: boolean;
}

export interface VehicleUpdateRequest {
  VehicleNumber: string;
  TechPassportNumber: string;
  CreateNew?: boolean;
}

export interface Penalty {
  protocolId: number;
  automobileNumber: string;
  penaltyNumber: string;
  penaltyType: number;
  penaltyTypeName: string;
  taxCode: string;
  restriction: string;
  oriniginalValue: number;
  penaltyAmountValue: number;
  penaltyDate: string;
  fineAmountValue: number;
  fineDate: string;
  finalAmount: number;
  isPayable: boolean;
  isDiscountable: boolean;
  isPayedDiscounted: boolean;
  finalDiscountDate?: string;
  finalPaymentDate?: string;
  code: number;
  codeName: string;
  raionId: number;
  regionId: number;
  raionName: string;
  regionName: string;
  stateId: number;
  stateName: string;
  publishDate?: string;
  isPublished: boolean;
  techPassportNumber: string;
  actionDate?: string;
  protocolDate: string;
  activeDate?: string;
  violationDate: string;
}

export interface CarFinesSubscription {
  _id: string;
  userId: string;
  carId: string;
  vehicleNumber: string;
  techPassportNumber: string;
  price: number;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  startDate: string;
  endDate?: string;
  nextBillingDate?: string;
  isPaid: boolean;
  lastPaymentDate?: string;
  paymentTransactionId?: string;
  isFirstCar: boolean;
  totalPaid: number;
  billingCycles: number;
}

export interface CarFinesSubscriptionResponse {
  success: boolean;
  data: CarFinesSubscription;
}

// Response არის პირდაპირ string[] array (Base64 encoded images/videos)

class FinesApiService {
  /**
   * Backend API request helper
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${FINES_API_URL}${endpoint}`;
    
    console.log('📤 [FINES API] Request:', {
      url,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body as string) : undefined,
    });

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log('📥 [FINES API] Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [FINES API] Request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      
      let errorMessage = `API შეცდომა: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
        console.error('❌ [FINES API] Error details:', errorData);
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ [FINES API] Success:', {
      dataType: Array.isArray(data) ? 'array' : typeof data,
      dataLength: Array.isArray(data) ? data.length : undefined,
    });

    return data;
  }

  /**
   * მანქანის რეგისტრაცია საპატრულო ჯარიმების სისტემაში
   */
  async registerVehicle(
    userId: string,
    vehicleNumber: string,
    techPassportNumber: string,
    mediaFile: boolean = false
  ): Promise<number> {
    const data = {
      userId,
      vehicleNumber,
      techPassportNumber,
      mediaFile,
    };

    const response = await this.request<{ id: number }>(
      '/vehicles/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    return response.id;
  }

  /**
   * მანქანის გადამოწმება
   */
  async validateVehicle(
    vehicleNumber: string,
    techPassportNumber: string
  ): Promise<boolean> {
    const params = new URLSearchParams({
      vehicleNumber,
      techPassportNumber,
    });

    const response = await this.request<{ isValid: boolean }>(
      `/vehicles/validate?${params.toString()}`
    );

    return response.isValid;
  }

  /**
   * აქტიური მანქანების სია
   */
  async getActiveVehicles(): Promise<VehicleRegistration[]> {
    return this.request<VehicleRegistration[]>('/vehicles/active');
  }

  /**
   * ჯარიმების სია
   * @param vehicleNumber - ავტომობილის ნომერი (optional)
   * @param techPassportNumber - ტექ. პასპორტის ნომერი (optional)
   * თუ ორივე პარამეტრი არ არის გადაცემული, დააბრუნებს ყველა აქტიური მანქანის ჯარიმებს
   */
  async getPenalties(
    vehicleNumber?: string,
    techPassportNumber?: string
  ): Promise<Penalty[]> {
    const params = new URLSearchParams();
    if (vehicleNumber) {
      params.append('vehicleNumber', vehicleNumber);
    }
    if (techPassportNumber) {
      params.append('techPassportNumber', techPassportNumber);
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/penalties?${queryString}` : '/penalties';

    return this.request<Penalty[]>(endpoint);
  }

  /**
   * ვიდეო ჯარიმების ნახვა
   * Response არის Base64 encoded images/videos-ის array
   */
  async getPenaltyMediaFiles(
    vehicleNumber: string,
    techPassportNumber: string,
    protocolId: number
  ): Promise<string[]> {
    const params = new URLSearchParams({
      vehicleNumber,
      techPassportNumber,
    });

    return this.request<string[]>(
      `/media/${protocolId}?${params.toString()}`
    );
  }
  /**
   * იუზერის ჯარიმების მანქანების ლიმიტის ინფორმაცია
   */
  async getUserFinesCarLimit(userId: string): Promise<{
    maxCars: number;
    registeredCars: number;
    canRegisterMore: boolean;
    additionalCarPrice: number;
    isPremium: boolean;
  }> {
    return this.request(`/vehicles/limit/${userId}`);
  }

  /**
   * იუზერის დარეგისტრირებული მანქანები ჩვენს ბაზაში
   */
  async getUserRegisteredVehicles(userId: string): Promise<VehicleRegistration[]> {
    return this.request<VehicleRegistration[]>(`/vehicles/user/${userId}`);
  }

  // ==========================================
  // CarFinesSubscription მეთოდები
  // ==========================================

  /**
   * მანქანაზე ჯარიმების გამოწერის შექმნა
   */
  async createCarFinesSubscription(
    userId: string,
    carId: string,
    vehicleNumber: string,
    techPassportNumber: string,
  ): Promise<CarFinesSubscriptionResponse> {
    return this.request<CarFinesSubscriptionResponse>('/car-subscription', {
      method: 'POST',
      body: JSON.stringify({ userId, carId, vehicleNumber, techPassportNumber }),
    });
  }

  /**
   * იუზერის მანქანის გამოწერების სია
   */
  async getUserCarFinesSubscriptions(
    userId: string,
  ): Promise<CarFinesSubscription[]> {
    return this.request<CarFinesSubscription[]>(`/car-subscriptions/${userId}`);
  }

  /**
   * შევამოწმოთ მანქანას აქვს თუ არა აქტიური გამოწერა
   */
  async checkCarFinesSubscription(
    userId: string,
    carId: string,
  ): Promise<{ isActive: boolean; subscription: CarFinesSubscription | null }> {
    return this.request(`/car-subscription/check/${userId}/${carId}`);
  }

  /**
   * გამოწერის გადახდის დადასტურება
   */
  async confirmCarFinesPayment(
    subscriptionId: string,
    transactionId?: string,
  ): Promise<CarFinesSubscriptionResponse> {
    return this.request<CarFinesSubscriptionResponse>(
      '/car-subscription/confirm-payment',
      {
        method: 'POST',
        body: JSON.stringify({ subscriptionId, transactionId }),
      },
    );
  }

  /**
   * გამოწერის გაუქმება
   */
  async cancelCarFinesSubscription(
    subscriptionId: string,
  ): Promise<CarFinesSubscriptionResponse> {
    return this.request<CarFinesSubscriptionResponse>(
      `/car-subscription/cancel/${subscriptionId}`,
      { method: 'POST' },
    );
  }

  /**
   * ლიმიტის გაზრდა (upgrade) — deprecated, ახლა car-subscription გამოიყენება
   */
  async upgradeFinesCarsLimit(userId: string, additionalCars: number = 1): Promise<any> {
    const url = `${API_BASE_URL}/subscriptions/upgrade-fines-cars`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, additionalCars }),
    });
    if (!response.ok) {
      throw new Error('ლიმიტის გაზრდა ვერ მოხერხდა');
    }
    return response.json();
  }
}

export const finesApi = new FinesApiService();
