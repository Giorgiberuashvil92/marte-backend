/**
 * GeoJSON Radars Service
 * იტვირთება რადარების ლოკაციებს GeoJSON ფაილიდან
 */

import { Radar } from './radarsApi';

export interface GeoJSONFeature {
  type: string;
  properties: {
    [key: string]: any;
    '@id'?: string;
    highway?: string;
    maxspeed?: string;
    name?: string;
    description?: string;
    note?: string;
  };
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  id?: string;
}

export interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

class GeoJSONRadarsService {
  /**
   * იტვირთება GeoJSON ფაილს და გადააქცევს Radar ფორმატში
   */
  async loadRadarsFromGeoJSON(geojsonPath: string): Promise<Radar[]> {
    try {
      // React Native-ში ვიყენებთ require ან fetch
      let geojsonData: GeoJSONData;

      // Try to load from assets
      try {
        // For React Native, we might need to use require or fetch
        const response = await fetch(geojsonPath);
        if (response.ok) {
          geojsonData = await response.json();
        } else {
          throw new Error(`Failed to load GeoJSON: ${response.status}`);
        }
      } catch (fetchError) {
        console.error('❌ Error loading GeoJSON file:', fetchError);
        return [];
      }

      return this.parseGeoJSONToRadars(geojsonData);
    } catch (error) {
      console.error('❌ Error loading radars from GeoJSON:', error);
      return [];
    }
  }

  /**
   * პარსავს GeoJSON მონაცემებს და გადააქცევს Radar ფორმატში
   */
  parseGeoJSONToRadars(geojsonData: GeoJSONData): Radar[] {
    const radars: Radar[] = [];

    if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
      console.warn('⚠️ GeoJSON features array not found');
      return [];
    }

    geojsonData.features.forEach((feature, index) => {
      try {
        // Extract coordinates
        let latitude: number | null = null;
        let longitude: number | null = null;

        if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
          // GeoJSON uses [longitude, latitude] format
          const coords = feature.geometry.coordinates as number[];
          if (coords.length >= 2) {
            longitude = coords[0];
            latitude = coords[1];
          }
        } else if (feature.geometry.type === 'LineString' && Array.isArray(feature.geometry.coordinates)) {
          // For LineString, use first point
          const coords = feature.geometry.coordinates[0] as number[];
          if (coords && coords.length >= 2) {
            longitude = coords[0];
            latitude = coords[1];
          }
        } else if (feature.geometry.type === 'Polygon' && Array.isArray(feature.geometry.coordinates)) {
          // For Polygon, use first point of first ring
          const ring = feature.geometry.coordinates[0] as number[][];
          if (ring && ring.length > 0 && Array.isArray(ring[0]) && ring[0].length >= 2) {
            longitude = ring[0][0];
            latitude = ring[0][1];
          }
        }

        if (latitude === null || longitude === null) {
          console.warn(`⚠️ Could not extract coordinates from feature ${index}`);
          return;
        }

        // Extract properties
        const props = feature.properties || {};
        // Check for maxspeed in different formats (maxspeed, max-speed, max_speed)
        const maxSpeedValue = props.maxspeed || props['max-speed'] || props.max_speed;
        const maxSpeed = maxSpeedValue ? parseInt(String(maxSpeedValue)) : undefined;
        const radarType = props.highway === 'speed_camera' ? 'fixed' : 'fixed'; // Default to fixed

        // 🔍 დეტალური ლოგი GeoJSON feature-ისთვის
        console.log('📋 GeoJSON Feature:', {
          id: feature.id,
          index,
          properties: props,
          highway: props.highway,
          maxspeed: maxSpeed,
        });

        // Create Radar object
        const radar: Radar = {
          _id: feature.id || `geojson-${latitude}-${longitude}-${index}`,
          latitude,
          longitude,
          type: radarType,
          speedLimit: maxSpeed,
          address: props.name || props.description || props.note,
          description: props.description || props.note || 
                     (props.highway === 'speed_camera' ? 'სიჩქარის კამერა (GeoJSON)' : 'რადარი (GeoJSON)'),
          isActive: true,
          fineCount: 0,
          source: 'geojson',
          radarSubType: props.highway || props.enforcement || props.surveillance, // დამატებითი ტიპი
        };

        radars.push(radar);
      } catch (error) {
        console.error(`❌ Error parsing feature ${index}:`, error);
      }
    });

    console.log(`✅ GeoJSON რადარები პარსირებული: ${radars.length}`);
    return radars;
  }

  /**
   * იტვირთება GeoJSON-ს inline (თუ ფაილი უკვე იმპორტირებულია)
   */
  loadRadarsFromInlineGeoJSON(geojsonData: GeoJSONData): Radar[] {
    return this.parseGeoJSONToRadars(geojsonData);
  }
}

export const geojsonRadarsService = new GeoJSONRadarsService();
