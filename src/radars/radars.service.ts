import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Radar, RadarDocument } from '../schemas/radar.schema';

@Injectable()
export class RadarsService {
  private readonly logger = new Logger(RadarsService.name);
  private readonly RADARS_GE_API = 'https://radars.ge/api'; // თუ აქვს API
  private readonly BORBALO_API = 'https://api.borbalo.ge'; // ბორბალოს API თუ აქვს

  constructor(
    @InjectModel(Radar.name) private radarModel: Model<RadarDocument>,
  ) {}

  /**
   * ყველა რადარის მიღება
   */
  async getAllRadars(): Promise<Radar[]> {
    return this.radarModel.find({ isActive: true }).exec();
  }

  /**
   * რადარების მიღება რეგიონის მიხედვით
   */
  async getRadarsByRegion(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
  ): Promise<Radar[]> {
    return this.radarModel
      .find({
        isActive: true,
        latitude: { $gte: minLat, $lte: maxLat },
        longitude: { $gte: minLng, $lte: maxLng },
      })
      .exec();
  }

  /**
   * რადარების მიღება მანძილის მიხედვით
   */
  async getRadarsNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
  ): Promise<Radar[]> {
    // MongoDB-სთვის გეოსპაციალური ძიება
    const allRadars = await this.radarModel.find({ isActive: true }).exec();

    // ფილტრაცია მანძილის მიხედვით
    return allRadars.filter((radar) => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        radar.latitude,
        radar.longitude,
      );
      return distance <= radiusKm;
    });
  }

  /**
   * რადარის მიღება ID-ით
   */
  async getRadarById(id: string): Promise<Radar> {
    const radar = await this.radarModel.findById(id).exec();
    if (!radar) {
      throw new Error('რადარი ვერ მოიძებნა');
    }
    return radar;
  }

  /**
   * რადარის შექმნა
   */
  async createRadar(radarData: Partial<Radar>): Promise<Radar> {
    const radar = new this.radarModel(radarData);
    return radar.save();
  }

  /**
   * რადარის განახლება
   */
  async updateRadar(id: string, radarData: Partial<Radar>): Promise<Radar> {
    const radar = await this.radarModel
      .findByIdAndUpdate(id, radarData, { new: true })
      .exec();
    if (!radar) {
      throw new Error('რადარი ვერ მოიძებნა');
    }
    return radar;
  }

  /**
   * რადარის წაშლა
   */
  async deleteRadar(id: string): Promise<void> {
    const result = await this.radarModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error('რადარი ვერ მოიძებნა');
    }
  }

  /**
   * ჯარიმის დამატება რადარზე
   */
  async addFine(radarId: string): Promise<Radar> {
    const radar = await this.radarModel.findById(radarId).exec();
    if (!radar) {
      throw new Error('რადარი ვერ მოიძებნა');
    }
    radar.fineCount += 1;
    radar.lastFineDate = new Date();
    return radar.save();
  }

  /**
   * რადარების სინქრონიზაცია radars.ge-დან
   */
  async syncFromRadarsGe(): Promise<void> {
    try {
      this.logger.log('რადარების სინქრონიზაცია radars.ge-დან...');

      // თუ radars.ge-ს აქვს API, აქ უნდა გავაკეთოთ მოთხოვნა
      // ახლა ვიყენებთ mock მონაცემებს
      const mockRadars = this.getMockRadars();

      for (const radarData of mockRadars) {
        const existing = await this.radarModel
          .findOne({
            latitude: radarData.latitude,
            longitude: radarData.longitude,
          })
          .exec();

        if (!existing) {
          await this.createRadar({
            ...radarData,
            source: 'radars.ge',
          });
        }
      }

      this.logger.log('რადარების სინქრონიზაცია დასრულდა');
    } catch (error) {
      this.logger.error('რადარების სინქრონიზაციის შეცდომა:', error);
    }
  }

  /**
   * Mock რადარების მონაცემები საქართველოსთვის
   * რეალური API-ს შემთხვევაში ეს უნდა შეიცვალოს
   */
  private getMockRadars(): Partial<Radar>[] {
    return [
      // თბილისი - ვაზიანის გზატკეცილი (ცოტა შორს მანქანისგან)
      {
        latitude: 41.7171, // +0.002 = ~220 მეტრი ჩრდილოეთით
        longitude: 44.8291, // +0.002 = ~220 მეტრი აღმოსავლეთით
        type: 'fixed',
        speedLimit: 60,
        address: 'ვაზიანის გზატკეცილი, თბილისი',
        direction: 'თბილისი-რუსთავი',
        fineCount: 15,
        lastFineDate: new Date('2024-01-15'),
        description: 'ფიქსირებული რადარი ვაზიანის გზატკეცილზე',
        isActive: true,
      },
      // თბილისი - რუსთაველის გამზირი
      {
        latitude: 41.7201,
        longitude: 44.7801,
        type: 'fixed',
        speedLimit: 50,
        address: 'რუსთაველის გამზირი, თბილისი',
        direction: 'ცენტრი-ვაკე',
        fineCount: 23,
        lastFineDate: new Date('2024-01-20'),
        description: 'ფიქსირებული რადარი რუსთაველის გამზირზე, ცენტრალურ ნაწილში',
        isActive: true,
      },
      // თბილისი - აგმაშენების გამზირი
      {
        latitude: 41.7080,
        longitude: 44.7900,
        type: 'fixed',
        speedLimit: 50,
        address: 'აგმაშენების გამზირი, თბილისი',
        direction: 'ცენტრი-ისანი',
        fineCount: 8,
        lastFineDate: new Date('2024-01-10'),
        description: 'ფიქსირებული რადარი აგმაშენების გამზირზე',
        isActive: true,
      },
      // თბილისი - ქავთარაძის გამზირი
      {
        latitude: 41.7300,
        longitude: 44.7500,
        type: 'mobile',
        speedLimit: 60,
        address: 'ქავთარაძის გამზირი, თბილისი',
        direction: 'ვაკე-დიღომი',
        fineCount: 12,
        lastFineDate: new Date('2024-01-18'),
        description: 'მობილური რადარი ქავთარაძის გამზირზე',
        isActive: true,
      },
      // თბილისი - თბილისის ზღვა
      {
        latitude: 41.7400,
        longitude: 44.8200,
        type: 'fixed',
        speedLimit: 50,
        address: 'თბილისის ზღვა, თბილისი',
        direction: 'ცენტრი-საბურთალო',
        fineCount: 5,
        lastFineDate: new Date('2024-01-12'),
        description: 'ფიქსირებული რადარი თბილისის ზღვის მიდამოებში',
        isActive: true,
      },
      // თბილისი - კახეთის გზატკეცილი
      {
        latitude: 41.7500,
        longitude: 44.8500,
        type: 'average_speed',
        speedLimit: 80,
        address: 'კახეთის გზატკეცილი, თბილისი',
        direction: 'თბილისი-კახეთი',
        fineCount: 18,
        lastFineDate: new Date('2024-01-22'),
        description: 'საშუალო სიჩქარის რადარი კახეთის გზატკეცილზე',
        isActive: true,
      },
      // თბილისი - ვარკეთილის გამზირი
      {
        latitude: 41.7000,
        longitude: 44.7600,
        type: 'fixed',
        speedLimit: 50,
        address: 'ვარკეთილის გამზირი, თბილისი',
        direction: 'ცენტრი-ნაძალადევი',
        fineCount: 10,
        lastFineDate: new Date('2024-01-16'),
        description: 'ფიქსირებული რადარი ვარკეთილის გამზირზე',
        isActive: true,
      },
      // თბილისი - ბათონის გამზირი
      {
        latitude: 41.7100,
        longitude: 44.7700,
        type: 'mobile',
        speedLimit: 60,
        address: 'ბათონის გამზირი, თბილისი',
        direction: 'ცენტრი-დიდუბე',
        fineCount: 7,
        lastFineDate: new Date('2024-01-14'),
        description: 'მობილური რადარი ბათონის გამზირზე',
        isActive: true,
      },
      // თბილისი-ბათუმის გზატკეცილი
      {
        latitude: 41.8000,
        longitude: 44.9000,
        type: 'average_speed',
        speedLimit: 90,
        address: 'თბილისი-ბათუმის გზატკეცილი',
        direction: 'თბილისი-ბათუმი',
        fineCount: 30,
        lastFineDate: new Date('2024-01-25'),
        description: 'საშუალო სიჩქარის რადარი თბილისი-ბათუმის გზატკეცილზე',
        isActive: true,
      },
      // ბათუმი - ბულვარი
      {
        latitude: 41.6500,
        longitude: 41.6400,
        type: 'fixed',
        speedLimit: 50,
        address: 'ბათუმის ბულვარი',
        direction: 'ცენტრი',
        fineCount: 6,
        lastFineDate: new Date('2024-01-11'),
        description: 'ფიქსირებული რადარი ბათუმის ბულვარზე',
        isActive: true,
      },
      // ქუთაისი - რუსთაველის გამზირი
      {
        latitude: 42.2679,
        longitude: 42.7016,
        type: 'fixed',
        speedLimit: 60,
        address: 'რუსთაველის გამზირი, ქუთაისი',
        direction: 'ცენტრი',
        fineCount: 4,
        lastFineDate: new Date('2024-01-09'),
        description: 'ფიქსირებული რადარი ქუთაისში',
        isActive: true,
      },
    ];
  }

  /**
   * მანძილის გამოთვლა ორ წერტილს შორის (კმ-ში)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // დედამიწის რადიუსი კმ-ში
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
