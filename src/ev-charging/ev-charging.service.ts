import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EvPartner, EvPartnerDocument } from '../schemas/ev-partner.schema';
import {
  EvStation,
  EvStationDocument,
  EvChargerEmbedded,
} from '../schemas/ev-station.schema';
import { EV_CHARGING_DEMO_SEED } from './ev-charging.seed';
import {
  EvChargingSettings,
  EvChargingSettingsDocument,
} from '../schemas/ev-charging-settings.schema';
import {
  DEFAULT_EV_PACKAGE_CTA,
  mapPackageCtaEmbed,
  parsePackageCtaBody,
  resolvePackageCta,
  type EvPackageCtaDto,
} from './ev-package-cta.util';

export type EvStationApiRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerLogoUrl?: string;
  siteName: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  chargers: EvChargerEmbedded[];
  perkHint?: string;
  heroImageUrl?: string;
  galleryImageUrls?: string[];
  openingHours?: string;
  amenities?: string[];
  rating?: number;
  reviewsCount?: number;
  priceLabel?: string;
  chargeSpeedHint?: string;
  aboutText?: string;
  isActive?: boolean;
  sortOrder?: number;
  packageCta?: EvPackageCtaDto;
};

export type EvChargingSettingsDto = {
  pageTitle: string;
  networkLabel: string;
  defaultAboutText?: string;
  reviewsPlaceholder?: string;
  packageCta: EvPackageCtaDto;
};

@Injectable()
export class EvChargingService implements OnModuleInit {
  private readonly logger = new Logger(EvChargingService.name);

  constructor(
    @InjectModel(EvPartner.name)
    private readonly partnerModel: Model<EvPartnerDocument>,
    @InjectModel(EvStation.name)
    private readonly stationModel: Model<EvStationDocument>,
    @InjectModel(EvChargingSettings.name)
    private readonly settingsModel: Model<EvChargingSettingsDocument>,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.stationModel.countDocuments();
      if (count === 0) {
        await this.seedDemo();
        this.logger.log('EV charging: დემო მონაცემები ჩაირთო (ცარიელი ბაზა)');
      }
    } catch (e) {
      this.logger.warn(
        `EV charging seed skipped: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private mapStation(doc: EvStationDocument): EvStationApiRow {
    const id =
      doc.stationId?.trim() ||
      (doc._id instanceof Types.ObjectId
        ? doc._id.toString()
        : String(doc._id));
    return {
      id,
      partnerId: doc.partnerId,
      partnerName: doc.partnerName,
      partnerLogoUrl: doc.partnerLogoUrl,
      siteName: doc.siteName,
      address: doc.address,
      latitude: doc.latitude,
      longitude: doc.longitude,
      phone: doc.phone,
      chargers: (doc.chargers || []).map((c) => ({
        id: c.id,
        label: c.label,
        connectorType: c.connectorType,
        maxPowerKw: c.maxPowerKw,
        status: c.status || 'unknown',
      })),
      perkHint: doc.perkHint,
      heroImageUrl: doc.heroImageUrl,
      galleryImageUrls: doc.galleryImageUrls?.length
        ? [...doc.galleryImageUrls]
        : undefined,
      openingHours: doc.openingHours,
      amenities: doc.amenities?.length ? [...doc.amenities] : undefined,
      rating: doc.rating,
      reviewsCount: doc.reviewsCount,
      priceLabel: doc.priceLabel,
      chargeSpeedHint: doc.chargeSpeedHint,
      aboutText: doc.aboutText,
      isActive: doc.isActive,
      sortOrder: doc.sortOrder,
    };
  }

  private async loadPartnerCtaMap(): Promise<Map<string, EvPackageCtaDto | null>> {
    const partners = await this.partnerModel.find().exec();
    const map = new Map<string, EvPackageCtaDto | null>();
    for (const p of partners) {
      map.set(p.partnerId, mapPackageCtaEmbed(p.packageCta));
    }
    return map;
  }

  private async getGlobalPackageCta(): Promise<EvPackageCtaDto> {
    const settings = await this.getSettings();
    return settings.packageCta;
  }

  async findActiveStationsForApp(): Promise<EvStationApiRow[]> {
    const [docs, globalCta, partnerCtaMap] = await Promise.all([
      this.stationModel
        .find({ isActive: { $ne: false } })
        .sort({ sortOrder: 1, siteName: 1 })
        .exec(),
      this.getGlobalPackageCta(),
      this.loadPartnerCtaMap(),
    ]);
    return docs.map((d) => {
      const row = this.mapStation(d);
      const partnerCta = partnerCtaMap.get(d.partnerId) ?? null;
      row.packageCta = resolvePackageCta(globalCta, partnerCta);
      return row;
    });
  }

  async findAllStations(activeOnly?: boolean) {
    const filter = activeOnly === false ? {} : { isActive: { $ne: false } };
    const docs = await this.stationModel
      .find(filter)
      .sort({ sortOrder: 1, siteName: 1 })
      .exec();
    return docs.map((d) => ({
      ...this.mapStation(d),
      _id: d._id.toString(),
    }));
  }

  async findAllPartners(activeOnly?: boolean) {
    const filter = activeOnly === false ? {} : { isActive: { $ne: false } };
    const docs = await this.partnerModel
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .exec();
    return docs.map((d) => ({
      _id: d._id.toString(),
      partnerId: d.partnerId,
      name: d.name,
      logoUrl: d.logoUrl,
      description: d.description,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
      packageCta: mapPackageCtaEmbed(d.packageCta) ?? undefined,
    }));
  }

  async getSettings(): Promise<EvChargingSettingsDto> {
    let doc = await this.settingsModel.findOne({ key: 'default' }).exec();
    if (!doc) {
      doc = await this.settingsModel.create({ key: 'default' });
    }
    const packageCta =
      mapPackageCtaEmbed(doc.packageCta) ?? DEFAULT_EV_PACKAGE_CTA;
    return {
      pageTitle: doc.pageTitle || 'EV პარტნიორები',
      networkLabel: doc.networkLabel || 'Marte ქსელი',
      defaultAboutText: doc.defaultAboutText,
      reviewsPlaceholder: doc.reviewsPlaceholder,
      packageCta,
    };
  }

  async updateSettings(body: Partial<EvChargingSettingsDto> & Record<string, unknown>) {
    const ctaPatch = parsePackageCtaBody(body);
    await this.settingsModel
      .findOneAndUpdate(
        { key: 'default' },
        {
          $set: {
            ...(body.pageTitle !== undefined
              ? { pageTitle: body.pageTitle }
              : {}),
            ...(body.networkLabel !== undefined
              ? { networkLabel: body.networkLabel }
              : {}),
            ...(body.defaultAboutText !== undefined
              ? { defaultAboutText: body.defaultAboutText }
              : {}),
            ...(body.reviewsPlaceholder !== undefined
              ? { reviewsPlaceholder: body.reviewsPlaceholder }
              : {}),
            ...(ctaPatch !== undefined ? { packageCta: ctaPatch } : {}),
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    return this.getSettings();
  }

  async findPartnerByMongoId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid partner id');
    }
    const doc = await this.partnerModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Partner not found');
    return doc;
  }

  async findStationByMongoId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid station id');
    }
    const doc = await this.stationModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Station not found');
    return doc;
  }

  async resolvePartnerFields(partnerId: string) {
    const partner = await this.partnerModel
      .findOne({ partnerId: partnerId.trim() })
      .exec();
    if (!partner) {
      throw new BadRequestException(`პარტნიორი არ მოიძებნა: ${partnerId}`);
    }
    return {
      partnerName: partner.name,
      partnerLogoUrl: partner.logoUrl,
    };
  }

  async createPartner(
    body: Record<string, unknown> & {
      partnerId: string;
      name: string;
    },
  ) {
    const partnerId = String(body.partnerId || '').trim();
    const name = String(body.name || '').trim();
    if (!partnerId || !name) {
      throw new BadRequestException('partnerId და name სავალდებულოა');
    }
    const existing = await this.partnerModel.findOne({ partnerId }).exec();
    if (existing) {
      throw new BadRequestException('partnerId უკვე არსებობს');
    }
    const cta = parsePackageCtaBody(body);
    return this.partnerModel.create({
      partnerId,
      name,
      logoUrl: body.logoUrl,
      description: body.description,
      isActive: body.isActive !== false,
      sortOrder: Number(body.sortOrder) || 0,
      ...(cta ? { packageCta: cta } : {}),
    });
  }

  async updatePartner(mongoId: string, body: Record<string, unknown>) {
    const doc = await this.findPartnerByMongoId(mongoId);
    if (body.partnerId !== undefined) {
      const partnerId = String(body.partnerId).trim();
      if (partnerId && partnerId !== doc.partnerId) {
        const clash = await this.partnerModel.findOne({ partnerId }).exec();
        if (clash && clash._id.toString() !== mongoId) {
          throw new BadRequestException('partnerId უკვე დაკავებულია');
        }
        doc.partnerId = partnerId;
      }
    }
    if (body.name !== undefined) doc.name = String(body.name).trim();
    if (body.logoUrl !== undefined) {
      doc.logoUrl =
        body.logoUrl == null || body.logoUrl === ''
          ? undefined
          : String(body.logoUrl);
    }
    if (body.description !== undefined) {
      doc.description =
        body.description == null || body.description === ''
          ? undefined
          : String(body.description);
    }
    if (body.isActive !== undefined) doc.isActive = body.isActive !== false;
    if (body.sortOrder !== undefined) doc.sortOrder = Number(body.sortOrder);
    if (body.packageCta !== undefined) {
      if (body.packageCta === null) {
        doc.packageCta = undefined;
      } else {
        const cta = parsePackageCtaBody(body);
        if (cta) doc.packageCta = cta;
        else doc.packageCta = undefined;
      }
    }
    await doc.save();

    if (body.name !== undefined || body.logoUrl !== undefined) {
      await this.stationModel.updateMany(
        { partnerId: doc.partnerId },
        {
          $set: {
            ...(body.name !== undefined ? { partnerName: doc.name } : {}),
            ...(body.logoUrl !== undefined
              ? { partnerLogoUrl: doc.logoUrl }
              : {}),
          },
        },
      );
    }
    return doc;
  }

  async deletePartner(mongoId: string) {
    const doc = await this.findPartnerByMongoId(mongoId);
    const stationsCount = await this.stationModel.countDocuments({
      partnerId: doc.partnerId,
    });
    if (stationsCount > 0) {
      throw new BadRequestException(
        'პარტნიორს აქვს სადგურები — ჯერ წაშალე სადგურები',
      );
    }
    await this.partnerModel.deleteOne({ _id: doc._id });
    return { deleted: true };
  }

  private normalizeChargers(
    chargers: EvChargerEmbedded[] | undefined,
  ): EvChargerEmbedded[] {
    if (!Array.isArray(chargers) || chargers.length === 0) {
      return [
        {
          id: '1',
          label: 'AC',
          connectorType: 'Type2',
          maxPowerKw: 22,
          status: 'unknown',
        },
      ];
    }
    return chargers.map((c, i) => ({
      id: String(c.id || `c${i + 1}`),
      label: String(c.label || `დამტენი ${i + 1}`),
      connectorType: String(c.connectorType || 'Type2'),
      maxPowerKw: Number(c.maxPowerKw) || 22,
      status: String(c.status || 'unknown'),
    }));
  }

  async createStation(
    body: Record<string, unknown> & {
      partnerId: string;
      siteName: string;
      address: string;
      latitude: number;
      longitude: number;
    },
  ) {
    const partnerId = String(body.partnerId || '').trim();
    if (!partnerId) throw new BadRequestException('partnerId სავალდებულოა');

    const partnerFields = await this.resolvePartnerFields(partnerId);
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('latitude და longitude სავალდებულოა');
    }

    const stationId = body.stationId
      ? String(body.stationId).trim()
      : undefined;
    if (stationId) {
      const clash = await this.stationModel.findOne({ stationId }).exec();
      if (clash) throw new BadRequestException('stationId უკვე არსებობს');
    }

    const doc = await this.stationModel.create({
      stationId,
      partnerId,
      partnerName: String(body.partnerName || partnerFields.partnerName),
      partnerLogoUrl: body.partnerLogoUrl ?? partnerFields.partnerLogoUrl,
      siteName: String(body.siteName || '').trim(),
      address: String(body.address || '').trim(),
      latitude: lat,
      longitude: lng,
      phone: body.phone ? String(body.phone) : undefined,
      chargers: this.normalizeChargers(
        body.chargers as EvChargerEmbedded[] | undefined,
      ),
      perkHint: body.perkHint ? String(body.perkHint) : undefined,
      heroImageUrl: body.heroImageUrl ? String(body.heroImageUrl) : undefined,
      galleryImageUrls: Array.isArray(body.galleryImageUrls)
        ? (body.galleryImageUrls as unknown[]).map(String).filter(Boolean)
        : [],
      openingHours: body.openingHours ? String(body.openingHours) : undefined,
      amenities: Array.isArray(body.amenities)
        ? (body.amenities as unknown[]).map(String).filter(Boolean)
        : [],
      rating:
        body.rating !== undefined && body.rating !== null
          ? Number(body.rating)
          : undefined,
      reviewsCount: Number(body.reviewsCount) || 0,
      priceLabel: body.priceLabel ? String(body.priceLabel) : undefined,
      chargeSpeedHint: body.chargeSpeedHint
        ? String(body.chargeSpeedHint)
        : undefined,
      aboutText: body.aboutText ? String(body.aboutText) : undefined,
      isActive: body.isActive !== false,
      sortOrder: Number(body.sortOrder) || 0,
    });
    return { ...this.mapStation(doc), _id: doc._id.toString() };
  }

  async updateStation(mongoId: string, body: Record<string, unknown>) {
    const doc = await this.findStationByMongoId(mongoId);

    if (body.partnerId && String(body.partnerId) !== doc.partnerId) {
      const fields = await this.resolvePartnerFields(String(body.partnerId));
      doc.partnerId = String(body.partnerId).trim();
      doc.partnerName = fields.partnerName;
      doc.partnerLogoUrl = fields.partnerLogoUrl;
    }

    if (body.partnerName !== undefined)
      doc.partnerName = String(body.partnerName);
    if (body.partnerLogoUrl !== undefined)
      doc.partnerLogoUrl = String(body.partnerLogoUrl);
    if (body.siteName !== undefined) doc.siteName = String(body.siteName);
    if (body.address !== undefined) doc.address = String(body.address);
    if (body.phone !== undefined) doc.phone = String(body.phone);
    if (body.perkHint !== undefined) doc.perkHint = String(body.perkHint);
    if (body.heroImageUrl !== undefined)
      doc.heroImageUrl = String(body.heroImageUrl);
    if (body.galleryImageUrls !== undefined) {
      doc.galleryImageUrls = Array.isArray(body.galleryImageUrls)
        ? (body.galleryImageUrls as unknown[]).map(String).filter(Boolean)
        : [];
    }
    if (body.openingHours !== undefined)
      doc.openingHours = String(body.openingHours);
    if (body.amenities !== undefined) {
      doc.amenities = Array.isArray(body.amenities)
        ? (body.amenities as unknown[]).map(String).filter(Boolean)
        : [];
    }
    if (body.priceLabel !== undefined) doc.priceLabel = String(body.priceLabel);
    if (body.chargeSpeedHint !== undefined)
      doc.chargeSpeedHint = String(body.chargeSpeedHint);
    if (body.aboutText !== undefined) doc.aboutText = String(body.aboutText);
    if (body.latitude !== undefined) doc.latitude = Number(body.latitude);
    if (body.longitude !== undefined) doc.longitude = Number(body.longitude);
    if (body.rating !== undefined) doc.rating = Number(body.rating);
    if (body.reviewsCount !== undefined) {
      doc.reviewsCount = Number(body.reviewsCount);
    }
    if (body.isActive !== undefined) doc.isActive = Boolean(body.isActive);
    if (body.sortOrder !== undefined) doc.sortOrder = Number(body.sortOrder);
    if (body.chargers !== undefined) {
      doc.chargers = this.normalizeChargers(
        body.chargers as EvChargerEmbedded[],
      );
    }

    if (body.stationId !== undefined) {
      const sid = String(body.stationId).trim();
      if (sid) {
        const clash = await this.stationModel
          .findOne({ stationId: sid, _id: { $ne: doc._id } })
          .exec();
        if (clash) throw new BadRequestException('stationId უკვე დაკავებულია');
        doc.stationId = sid;
      } else {
        doc.stationId = undefined;
      }
    }

    await doc.save();
    return { ...this.mapStation(doc), _id: doc._id.toString() };
  }

  async deleteStation(mongoId: string) {
    const doc = await this.findStationByMongoId(mongoId);
    await this.stationModel.deleteOne({ _id: doc._id });
    return { deleted: true };
  }

  async seedDemo(force = false) {
    if (!force) {
      const count = await this.stationModel.countDocuments();
      if (count > 0) {
        return { seeded: false, message: 'უკვე არის მონაცემები' };
      }
    }

    for (const p of EV_CHARGING_DEMO_SEED.partners) {
      await this.partnerModel.updateOne(
        { partnerId: p.partnerId },
        { $setOnInsert: p },
        { upsert: true },
      );
    }
    for (const s of EV_CHARGING_DEMO_SEED.stations) {
      await this.stationModel.updateOne(
        { stationId: s.stationId },
        { $set: s },
        { upsert: true },
      );
    }
    return {
      seeded: true,
      partners: EV_CHARGING_DEMO_SEED.partners.length,
      stations: EV_CHARGING_DEMO_SEED.stations.length,
    };
  }
}
