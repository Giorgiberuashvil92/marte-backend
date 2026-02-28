/**
 * Overpass API Service
 * გამოიყენება OpenStreetMap-ის მონაცემების მოსაძებნად
 * https://overpass-api.de/api/interpreter
 */

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export interface SpeedLimit {
  latitude: number;
  longitude: number;
  maxSpeed: number; // კმ/სთ
  wayId?: number;
  roadName?: string;
}

export interface RadarLocation {
  latitude: number;
  longitude: number;
  type?: string;
  name?: string;
  description?: string;
  tags?: { [key: string]: string };
}

export interface OverpassResponse {
  elements: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    tags?: {
      [key: string]: string;
    };
    geometry?: Array<{
      lat: number;
      lon: number;
    }>;
  }>;
}

class OverpassApiService {
  /**
   * მოიძებნის სიჩქარის ლიმიტებს მოცემული რეგიონისთვის
   */
  async getSpeedLimits(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
  ): Promise<SpeedLimit[]> {
    try {
      // Overpass QL query - ვეძებთ ყველა გზას maxspeed tag-ით
      const query = `
        [out:json][timeout:25];
        (
          way["maxspeed"](${minLat},${minLon},${maxLat},${maxLon});
          relation["maxspeed"](${minLat},${minLon},${maxLat},${maxLon});
        );
        out geom;
      `;

      const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      const speedLimits: SpeedLimit[] = [];

      // Process ways (roads)
      data.elements.forEach((element) => {
        if (element.type === 'way' && element.tags?.maxspeed) {
          const maxSpeed = this.parseMaxSpeed(element.tags.maxspeed);
          if (maxSpeed && element.geometry && element.geometry.length > 0) {
            // Take the first point of the way as reference
            const firstPoint = element.geometry[0];
            speedLimits.push({
              latitude: firstPoint.lat,
              longitude: firstPoint.lon,
              maxSpeed,
              wayId: element.id,
              roadName: element.tags?.name || element.tags?.ref || undefined,
            });
          }
        }
      });

      return speedLimits;
    } catch (error) {
      console.error('❌ Overpass API error:', error);
      return [];
    }
  }

  /**
   * მოიძებნის სიჩქარის ლიმიტს მოცემული კოორდინატებისთვის
   */
  async getSpeedLimitAtLocation(
    latitude: number,
    longitude: number,
    radius: number = 0.001, // ~100 მეტრი
  ): Promise<SpeedLimit | null> {
    try {
      const minLat = latitude - radius;
      const maxLat = latitude + radius;
      const minLon = longitude - radius;
      const maxLon = longitude + radius;

      const speedLimits = await this.getSpeedLimits(minLat, maxLat, minLon, maxLon);

      if (speedLimits.length === 0) {
        return null;
      }

      // Find the closest speed limit
      let closest = speedLimits[0];
      let minDistance = this.calculateDistance(
        latitude,
        longitude,
        closest.latitude,
        closest.longitude,
      );

      speedLimits.forEach((limit) => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          limit.latitude,
          limit.longitude,
        );
        if (distance < minDistance) {
          minDistance = distance;
          closest = limit;
        }
      });

      return closest;
    } catch (error) {
      console.error('❌ Error getting speed limit at location:', error);
      return null;
    }
  }

  /**
   * მოიძებნის სიჩქარის ლიმიტებს მარშრუტის გასწვრივ
   */
  async getSpeedLimitsAlongRoute(
    coordinates: Array<{ latitude: number; longitude: number }>,
    radius: number = 0.005, // ~500 მეტრი
  ): Promise<SpeedLimit[]> {
    try {
      if (coordinates.length === 0) {
        return [];
      }

      // Find bounding box for all coordinates
      const lats = coordinates.map((c) => c.latitude);
      const lons = coordinates.map((c) => c.longitude);
      const minLat = Math.min(...lats) - radius;
      const maxLat = Math.max(...lats) + radius;
      const minLon = Math.min(...lons) - radius;
      const maxLon = Math.max(...lons) + radius;

      return await this.getSpeedLimits(minLat, maxLat, minLon, maxLon);
    } catch (error) {
      console.error('❌ Error getting speed limits along route:', error);
      return [];
    }
  }

  /**
   * Parses maxspeed value from OSM format (e.g., "50", "50 km/h", "50 mph")
   */
  private parseMaxSpeed(maxSpeedStr: string): number | null {
    if (!maxSpeedStr) {
      return null;
    }

    // Remove whitespace and convert to lowercase
    const cleaned = maxSpeedStr.trim().toLowerCase();

    // Extract number
    const match = cleaned.match(/(\d+)/);
    if (!match) {
      return null;
    }

    let speed = parseInt(match[1], 10);

    // Convert mph to km/h if needed
    if (cleaned.includes('mph')) {
      speed = Math.round(speed * 1.60934);
    }

    return speed;
  }

  /**
   * Calculates distance between two coordinates in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
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

  /**
   * გამოიყენებს custom Overpass query-ს რადარების/ლოკაციების მოსაძებნად
   * @param query Overpass QL query string
   * @param bbox Optional bounding box: [minLat, minLon, maxLat, maxLon]
   */
  async executeCustomQuery(
    query: string,
    bbox?: [number, number, number, number],
  ): Promise<RadarLocation[]> {
    try {
      let finalQuery = query;

      // Replace {{bbox}} placeholder if bbox is provided
      if (bbox) {
        const [minLat, minLon, maxLat, maxLon] = bbox;
        finalQuery = query.replace(
          /{{bbox}}/g,
          `${minLat},${minLon},${maxLat},${maxLon}`,
        );
      }

      // Ensure output format is JSON
      if (!finalQuery.includes('[out:json]')) {
        finalQuery = `[out:json][timeout:25];\n${finalQuery}`;
      }

      const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(finalQuery)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      const locations: RadarLocation[] = [];

      // Process all elements (nodes, ways, relations)
      data.elements.forEach((element) => {
        if (element.type === 'node' && element.lat && element.lon) {
          locations.push({
            latitude: element.lat,
            longitude: element.lon,
            type: element.tags?.type || element.tags?.amenity || element.tags?.highway,
            name: element.tags?.name,
            description: element.tags?.description || element.tags?.note,
            tags: element.tags || {},
          });
        } else if (element.type === 'way' && element.geometry && element.geometry.length > 0) {
          // For ways, use the first point as reference
          const firstPoint = element.geometry[0];
          locations.push({
            latitude: firstPoint.lat,
            longitude: firstPoint.lon,
            type: element.tags?.type || element.tags?.highway,
            name: element.tags?.name,
            description: element.tags?.description || element.tags?.note,
            tags: element.tags || {},
          });
        } else if (element.type === 'relation' && element.geometry && element.geometry.length > 0) {
          // For relations, use the first point as reference
          const firstPoint = element.geometry[0];
          locations.push({
            latitude: firstPoint.lat,
            longitude: firstPoint.lon,
            type: element.tags?.type,
            name: element.tags?.name,
            description: element.tags?.description || element.tags?.note,
            tags: element.tags || {},
          });
        }
      });

      return locations;
    } catch (error) {
      console.error('❌ Custom Overpass query error:', error);
      return [];
    }
  }

  /**
   * მოიძებნის რადარების ლოკაციებს მოცემული რეგიონისთვის
   * გამოიყენება custom query რადარების მოსაძებნად საქართველოში
   */
  async getRadarLocations(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
  ): Promise<RadarLocation[]> {
    try {
      // Overpass query რადარების მოსაძებნად საქართველოში
      // ეს query ეძებს speed_camera, traffic_monitoring, red light cameras, average speed control და CCTV-ს
      const query = `
        [out:json][timeout:25];
        area["ISO3166-1"="GE"][admin_level=2]->.searchArea;
        (
          /* Speed cameras */
          node["highway"="speed_camera"](area.searchArea);
          way["highway"="speed_camera"](area.searchArea);
          relation["highway"="speed_camera"](area.searchArea);

          /* Traffic monitoring */
          node["man_made"="surveillance"]["surveillance"="traffic_monitoring"](area.searchArea);
          way["man_made"="surveillance"]["surveillance"="traffic_monitoring"](area.searchArea);

          /* Red light cameras */
          node["enforcement"="traffic_signals"](area.searchArea);
          way["enforcement"="traffic_signals"](area.searchArea);

          /* Average speed control */
          node["enforcement"="average_speed"](area.searchArea);
          relation["enforcement"="average_speed"](area.searchArea);

          /* General CCTV */
          node["man_made"="surveillance"]["surveillance"="yes"](area.searchArea);
        );
        out center;
      `;

      // Execute query (bbox არ გამოიყენება, რადგან query იყენებს area-ს)
      console.log('🌐 Overpass API query გაგზავნილი...');
      const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      console.log('📡 Overpass API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Overpass API error response:', errorText);
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data: OverpassResponse = await response.json();
      console.log('📊 Overpass API elements მიღებული:', data.elements?.length || 0);
      const locations: RadarLocation[] = [];

      // Process all elements
      // `out center` აბრუნებს center point-ს nodes-ისთვის და ways/relations-ისთვის
      data.elements.forEach((element) => {
        let lat: number | null = null;
        let lon: number | null = null;

        // Get coordinates from element
        if (element.lat && element.lon) {
          // Node with direct coordinates
          lat = element.lat;
          lon = element.lon;
        } else if (element.geometry && element.geometry.length > 0) {
          // Way/Relation with geometry - use center point
          const centerIndex = Math.floor(element.geometry.length / 2);
          lat = element.geometry[centerIndex].lat;
          lon = element.geometry[centerIndex].lon;
        }

        // Filter by bounding box if coordinates are available
        if (lat !== null && lon !== null) {
          if (
            lat >= minLat &&
            lat <= maxLat &&
            lon >= minLon &&
            lon <= maxLon
          ) {
            const description = element.tags?.description || 
                               element.tags?.note || 
                               (element.tags?.highway === 'speed_camera' ? 'სიჩქარის კამერა' : 
                                element.tags?.surveillance === 'traffic_monitoring' ? 'ტრაფიკის მონიტორინგი' : 
                                element.tags?.man_made === 'surveillance' ? 'სათვალიანი კამერა' : '');

            // 🔍 დეტალური ლოგი tags-ებისთვის
            console.log('📋 OSM Element Tags:', {
              id: element.id,
              type: element.type,
              tags: element.tags,
              highway: element.tags?.highway,
              man_made: element.tags?.man_made,
              surveillance: element.tags?.surveillance,
              enforcement: element.tags?.enforcement,
              maxspeed: element.tags?.maxspeed,
            });

            locations.push({
              latitude: lat,
              longitude: lon,
              type: element.tags?.highway || element.tags?.man_made || element.tags?.surveillance || element.tags?.enforcement,
              name: element.tags?.name || element.tags?.ref,
              description,
              tags: element.tags || {},
            });
          }
        }
      });

      console.log('✅ OSM რადარების ლოკაციები ფილტრირებული:', locations.length);
      return locations;
    } catch (error) {
      console.error('❌ Error getting radar locations:', error);
      return [];
    }
  }

  /**
   * გამოიყენებს custom Overpass query-ს (მაგ. Overpass Turbo share link-იდან)
   * @param customQuery Custom Overpass QL query string
   * @param bbox Optional bounding box: [minLat, minLon, maxLat, maxLon]
   */
  async executeCustomRadarQuery(
    customQuery: string,
    bbox?: [number, number, number, number],
  ): Promise<RadarLocation[]> {
    try {
      return await this.executeCustomQuery(customQuery, bbox);
    } catch (error) {
      console.error('❌ Error executing custom radar query:', error);
      return [];
    }
  }

  /**
   * ჩამოტვირთავს და decode-ს query-ს Overpass Turbo share link-იდან
   * @param shareLink Overpass Turbo share link (მაგ: https://overpass-turbo.eu/s/2lhu)
   */
  async loadQueryFromShareLink(shareLink: string): Promise<string | null> {
    try {
      // Overpass Turbo share link-ების ფორმატი: https://overpass-turbo.eu/s/{id}
      const match = shareLink.match(/overpass-turbo\.eu\/s\/([a-zA-Z0-9]+)/);
      if (!match) {
        console.error('❌ Invalid Overpass Turbo share link format');
        return null;
      }

      const shareId = match[1];
      
      // Overpass Turbo API endpoint share link-ის query-ს მოსაძებნად
      // Note: ეს შეიძლება არ იმუშაოს, რადგან Overpass Turbo-ს API შეიძლება არ იყოს public
      // ალტერნატიულად, შეგიძლიათ manually დააკოპიროთ query და გამოიყენოთ executeCustomRadarQuery
      
      // Try to fetch from Overpass Turbo API (if available)
      try {
        const response = await fetch(`https://overpass-turbo.eu/s/${shareId}.json`);
        if (response.ok) {
          const data = await response.json();
          return data.query || null;
        }
      } catch (fetchError) {
        console.log('⚠️ Could not fetch query from share link, using manual query');
      }

      return null;
    } catch (error) {
      console.error('❌ Error loading query from share link:', error);
      return null;
    }
  }
}

export const overpassApi = new OverpassApiService();
