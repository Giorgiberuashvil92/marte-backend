import { BadRequestException, Injectable } from '@nestjs/common';

export type VinDecodeInfo = {
  make?: string;
  model?: string;
  year?: string;
  trim?: string;
  bodyClass?: string;
  vehicleType?: string;
  driveType?: string;
  fuel?: string;
  engine?: string;
  transmission?: string;
};

export type AuctionRecord = {
  id: string;
  date: string;
  title: string;
  price?: string;
  imageUrl?: string;
  photoCount?: number;
  sourceName: string;
  sourceUrl?: string;
  confirmedSale: boolean;
};

export type Damage = {
  location: string;
  severity: string;
  description: string;
  photoUrls: string[];
  sourceName: string;
  sourceUrl?: string;
};

export type Finding = {
  id: string;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl?: string;
};

export type VinResearchResult = {
  vin: string;
  make: string;
  model: string;
  year: number;
  imageUrl?: string;
  specifications: string[];
  verdict: string;
  verdictDescription: string;
  score?: number;
  auctionRecords: AuctionRecord[];
  lastConfirmedPrice?: string;
  damage?: Damage;
  findings: Finding[];
  photos: string[];
  modelUsed: string;
  fallback: boolean;
};

@Injectable()
export class AIVinResearchService {
  async research(vinRaw: string): Promise<VinResearchResult> {
    const vin = this.normalizeVin(vinRaw);
    if (!vin) {
      throw new BadRequestException({
        success: false,
        message:
          '\u10e1\u10ec\u10dd\u10e0\u10d8 17-\u10e1\u10d8\u10db\u10d1\u10dd\u10da\u10dd\u10d8\u10d0\u10dc\u10d8 VIN \u10d0\u10e3\u10ea\u10d8\u10da\u10d4\u10d1\u10d4\u10da\u10d8\u10d0',
      });
    }

    const decode = await this.decodeVin(vin);
    const photos = await this.fetchPhotos(decode);

    if (!process.env.OPENAI_API_KEY) {
      return this.fallbackResult(vin, decode, photos);
    }

    try {
      const researched = await this.researchWithWebSearch(vin, decode, photos);
      return researched;
    } catch (error) {
      console.error('[AI_VIN_RESEARCH] OpenAI web research failed:', error);
      return this.fallbackResult(vin, decode, photos);
    }
  }

  normalizeVin(value: string): string | null {
    const vin = String(value || '')
      .toUpperCase()
      .replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (vin.length !== 17) return null;
    return vin;
  }

  private async decodeVin(vin: string): Promise<VinDecodeInfo> {
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
        { signal: AbortSignal.timeout(12000) },
      );
      if (!response.ok) return {};
      const json = await response.json();
      const row = json?.Results?.[0] || {};
      const engineParts = [
        row.DisplacementL ? `${row.DisplacementL}L` : '',
        row.EngineCylinders ? `${row.EngineCylinders} cyl` : '',
      ].filter(Boolean);

      return {
        make: this.clean(row.Make),
        model: this.clean(row.Model),
        year: this.clean(row.ModelYear),
        trim: this.clean(row.Trim),
        bodyClass: this.clean(row.BodyClass),
        vehicleType: this.clean(row.VehicleType),
        driveType: this.clean(row.DriveType),
        fuel: this.clean(row.FuelTypePrimary),
        engine: engineParts.join(' ') || undefined,
        transmission: this.clean(row.TransmissionStyle),
      };
    } catch (error) {
      console.error('[AI_VIN_RESEARCH] NHTSA decode failed:', error);
      return {};
    }
  }

  private async researchWithWebSearch(
    vin: string,
    decode: VinDecodeInfo,
    photos: string[],
  ): Promise<VinResearchResult> {
    const model =
      process.env.OPENAI_MODEL_VIN ||
      process.env.OPENAI_MODEL_CHAT ||
      'gpt-5.6-sol';

    const vehicleLabel = [decode.year, decode.make, decode.model]
      .filter(Boolean)
      .join(' ');

    const systemPrompt = [
      'You are MARTE AI vehicle history auditor for buyers in Georgia.',
      'Use web_search for VIN + CarCheck/auction/history/damage/photos.',
      'Return ONLY JSON. User-facing strings in Georgian. Brands/VIN/URLs unchanged.',
      'JSON keys:',
      'make, model, year (number), specifications (string[]),',
      'verdict, verdictDescription, score (0-100 number or omit if unknown),',
      'auctionRecords: [{id,date,title,price,imageUrl,photoCount,sourceName,sourceUrl,confirmedSale}],',
      'lastConfirmedPrice, damage: {location,severity,description,photoUrls,sourceName,sourceUrl} or null,',
      'findings: [{id,title,description,sourceName,sourceUrl}]',
      'CRITICAL: Do NOT invent auctions, sales, prices, or damage. Only include if sources support them.',
      'If nothing found, empty arrays and null damage; verdict should say on-site check is still needed.',
      'findings = practical buyer checklist tips (geometry, diagnostics, rust, etc.).',
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(90000),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        input: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({
              vin,
              decodedVehicle: decode,
              language: 'ka',
              searchHints: [
                `${vin} carcheck`,
                `${vin} auction`,
                `${vin} vehicle history`,
                vehicleLabel ? `${vehicleLabel} damage auction` : vin,
              ],
            }),
          },
        ],
        reasoning: { effort: 'low' },
        text: { verbosity: 'low', format: { type: 'json_object' } },
        max_output_tokens: 5500,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenAI ${response.status}: ${body.slice(0, 300)}`);
    }

    const json = await response.json();
    const parsed = this.parseJsonObject(this.extractOutputText(json));

    const make =
      this.clean(parsed.make) || decode.make || 'Unknown';
    const modelName =
      this.clean(parsed.model) || decode.model || 'Vehicle';
    const year = this.parseYear(parsed.year) || this.parseYear(decode.year) || 0;

    const auctionRecords = this.parseAuctionRecords(parsed.auctionRecords);
    const damage = this.parseDamage(parsed.damage);
    const findings = this.parseFindings(parsed.findings);
    const specifications =
      this.stringArray(parsed.specifications).length > 0
        ? this.stringArray(parsed.specifications)
        : this.defaultSpecs(decode);

    const score =
      typeof parsed.score === 'number' &&
      Number.isFinite(parsed.score) &&
      parsed.score >= 0 &&
      parsed.score <= 100
        ? Math.round(parsed.score)
        : undefined;

    const damagePhotos = damage?.photoUrls?.length
      ? damage.photoUrls
      : [];
    const allPhotos = Array.from(
      new Set([
        ...photos,
        ...damagePhotos,
        ...auctionRecords
          .map((item) => item.imageUrl)
          .filter((url): url is string => Boolean(url)),
      ]),
    );

    return {
      vin,
      make,
      model: modelName,
      year,
      imageUrl: allPhotos[0],
      specifications,
      verdict:
        this.clean(parsed.verdict) ||
        '\u10e8\u10d4\u10e4\u10d0\u10e1\u10d4\u10d1\u10d0: \u10e7\u10e3\u10e0\u10d0\u10d3\u10e6\u10d4\u10d1\u10d8\u10d7 \u10e8\u10d4\u10d0\u10db\u10dd\u10ec\u10db\u10d4',
      verdictDescription:
        this.clean(parsed.verdictDescription) ||
        '\u10dd\u10dc\u10da\u10d0\u10d8\u10dc \u10e1\u10e0\u10e3\u10da\u10d8 \u10d8\u10e1\u10e2\u10dd\u10e0\u10d8\u10d8\u10e1 \u10d2\u10d0\u10e0\u10d4\u10e8\u10d4 \u10d0\u10d3\u10d2\u10d8\u10da\u10d6\u10d4 \u10e8\u10d4\u10db\u10dd\u10ec\u10db\u10d4\u10d1\u10d0 \u10db\u10d0\u10d8\u10dc\u10ea \u10e1\u10d0\u10ed\u10d8\u10e0\u10dd\u10d0.',
      score,
      auctionRecords,
      lastConfirmedPrice: this.clean(parsed.lastConfirmedPrice),
      damage,
      findings:
        findings.length > 0 ? findings : this.defaultFindings(damage),
      photos: allPhotos,
      modelUsed: model,
      fallback: false,
    };
  }

  private fallbackResult(
    vin: string,
    decode: VinDecodeInfo,
    photos: string[],
  ): VinResearchResult {
    const year = this.parseYear(decode.year) || 0;
    return {
      vin,
      make: decode.make || 'Unknown',
      model: decode.model || 'Vehicle',
      year,
      imageUrl: photos[0],
      specifications: this.defaultSpecs(decode),
      verdict:
        '\u10e8\u10d4\u10e4\u10d0\u10e1\u10d4\u10d1\u10d0: \u10d0\u10d3\u10d2\u10d8\u10da\u10d6\u10d4 \u10e8\u10d4\u10d0\u10db\u10dd\u10ec\u10db\u10d4',
      verdictDescription:
        '\u10e1\u10e0\u10e3\u10da\u10d8 online \u10d8\u10e1\u10e2\u10dd\u10e0\u10d8\u10d0 \u10d0\u10db \u10db\u10dd\u10db\u10d4\u10dc\u10e2\u10e8\u10d8 \u10d5\u10d4\u10e0 \u10d3\u10d0\u10d3\u10d0\u10e1\u10e2\u10e3\u10e0\u10d3\u10d0. \u10d2\u10d0\u10d3\u10d0\u10ec\u10e7\u10d5\u10d4\u10e2\u10d8\u10da\u10d4\u10d1\u10d0 \u10db\u10d8\u10d8\u10e6\u10d4 \u10d0\u10d3\u10d2\u10d8\u10da\u10d6\u10d4 \u10e8\u10d4\u10db\u10dd\u10ec\u10db\u10d4\u10d1\u10d8\u10e1\u10d0 \u10d3\u10d0 \u10e2\u10d4\u10e1\u10e2-\u10d3\u10e0\u10d0\u10d8\u10d5\u10d8\u10e1 \u10e8\u10d4\u10db\u10d3\u10d4\u10d2.',
      auctionRecords: [],
      damage: undefined,
      findings: this.defaultFindings(undefined),
      photos,
      modelUsed: 'fallback',
      fallback: true,
    };
  }

  private defaultSpecs(decode: VinDecodeInfo): string[] {
    return [
      decode.bodyClass || decode.vehicleType,
      decode.engine && decode.fuel
        ? `${decode.engine} ${decode.fuel}`
        : decode.engine || decode.fuel,
      decode.driveType,
    ].filter(Boolean) as string[];
  }

  private defaultFindings(damage?: Damage): Finding[] {
    const findings: Finding[] = [
      {
        id: 'geometry',
        title:
          '\u10e8\u10d4\u10d0\u10db\u10dd\u10ec\u10db\u10d4 \u10eb\u10d0\u10e0\u10d8\u10e1 \u10d2\u10d4\u10dd\u10db\u10d4\u10e2\u10e0\u10d8\u10d0',
        description: damage
          ? `${damage.location} \u10d3\u10d0\u10d6\u10d8\u10d0\u10dc\u10d4\u10d1\u10d8\u10e1 \u10d2\u10d0\u10db\u10dd`
          : '\u10ee\u10d0\u10d6\u10d4\u10d1\u10d8\u10e1 \u10e1\u10d8\u10db\u10d4\u10e2\u10e0\u10d8\u10d0 \u10d3\u10d0 \u10dc\u10d0\u10de\u10e0\u10d0\u10da\u10d4\u10d1\u10d8 \u10d0\u10d3\u10d2\u10d8\u10da\u10d6\u10d4',
        sourceName: 'MARTE AI',
      },
      {
        id: 'diagnostics',
        title:
          '\u10d2\u10d0\u10d0\u10e2\u10d0\u10e0\u10d4 \u10d3\u10d0\u10db\u10dd\u10e3\u10d9\u10d8\u10d3\u10d4\u10d1\u10d4\u10da\u10d8 \u10d3\u10d8\u10d0\u10d2\u10dc\u10dd\u10e1\u10e2\u10d8\u10d9\u10d0',
        description:
          '\u10e8\u10d4\u10d0\u10db\u10dd\u10ec\u10db\u10d4 \u10eb\u10e0\u10d0\u10d5\u10d0, \u10d2\u10d0\u10d3\u10d0\u10ea\u10d4\u10db\u10d0\u10d7\u10d0 \u10d9\u10dd\u10da\u10dd\u10e4\u10d8 \u10d3\u10d0 \u10e1\u10d0\u10d5\u10d0\u10da\u10d8 \u10dc\u10d0\u10ec\u10d8\u10da\u10d8',
        sourceName: 'MARTE AI',
      },
    ];
    return findings;
  }

  private parseAuctionRecords(value: unknown): AuctionRecord[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item: any, index: number) => ({
        id: this.clean(item?.id) || `auction-${index + 1}`,
        date: this.clean(item?.date) || '',
        title: this.clean(item?.title) || '',
        price: this.clean(item?.price),
        imageUrl: this.clean(item?.imageUrl),
        photoCount:
          typeof item?.photoCount === 'number' ? item.photoCount : undefined,
        sourceName: this.clean(item?.sourceName) || 'Web',
        sourceUrl: this.clean(item?.sourceUrl),
        confirmedSale: Boolean(item?.confirmedSale),
      }))
      .filter((item) => item.date && item.title)
      .slice(0, 8);
  }

  private parseDamage(value: unknown): Damage | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const item = value as any;
    const location = this.clean(item.location);
    const severity = this.clean(item.severity);
    const description = this.clean(item.description);
    if (!location || !severity || !description) return undefined;
    return {
      location,
      severity,
      description,
      photoUrls: this.stringArray(item.photoUrls).filter((url) =>
        url.startsWith('http'),
      ),
      sourceName: this.clean(item.sourceName) || 'Web',
      sourceUrl: this.clean(item.sourceUrl),
    };
  }

  private parseFindings(value: unknown): Finding[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item: any, index: number) => ({
        id: this.clean(item?.id) || `finding-${index + 1}`,
        title: this.clean(item?.title) || '',
        description: this.clean(item?.description) || '',
        sourceName: this.clean(item?.sourceName) || 'MARTE AI',
        sourceUrl: this.clean(item?.sourceUrl),
      }))
      .filter((item) => item.title && item.description)
      .slice(0, 8);
  }

  private parseYear(value: unknown): number | undefined {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1950 || n > 2100) return undefined;
    return Math.round(n);
  }

  private async fetchPhotos(decode: VinDecodeInfo): Promise<string[]> {
    if (!decode.make || !decode.model) return [];
    const queries = [
      `${decode.year || ''} ${decode.make} ${decode.model}`.trim(),
      `${decode.make} ${decode.model}`,
    ];
    const photos: string[] = [];
    for (const query of queries) {
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) continue;
        const json = await response.json();
        const image =
          this.clean(json?.originalimage?.source) ||
          this.clean(json?.thumbnail?.source);
        if (image && !photos.includes(image)) photos.push(image);
        if (photos.length >= 4) break;
      } catch {
        // ignore
      }
    }
    return photos;
  }

  private extractOutputText(json: any): string {
    if (typeof json?.output_text === 'string') return json.output_text;
    const chunks: string[] = [];
    for (const item of json?.output || []) {
      for (const content of item?.content || []) {
        if (typeof content?.text === 'string') chunks.push(content.text);
      }
    }
    return chunks.join('\n');
  }

  private parseJsonObject(raw: string): Record<string, any> {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) return {};
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return {};
      }
    }
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim())
      .slice(0, 12);
  }

  private clean(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'Not Applicable') {
      return undefined;
    }
    return trimmed;
  }
}
