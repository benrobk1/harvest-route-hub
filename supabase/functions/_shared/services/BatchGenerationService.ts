import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * BATCH GENERATION SERVICE
 * 
 * Extracted from generate-batches edge function.
 * Handles complex routing, optimization, and batch creation logic.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Stop {
  delivery_batch_id: string;
  order_id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  sequence_number?: number;
  estimated_arrival?: string;
}

export interface RouteOptimizationResult {
  optimizedStops: Stop[];
  method: string;
  distanceMatrix?: number[][];
}

interface OSRMManeuver {
  type: string;
  instruction?: string;
}

interface OSRMStep {
  maneuver: OSRMManeuver;
  name?: string;
  distance: number;
  duration: number;
}

interface OSRMLeg {
  distance: number;
  duration: number;
  steps: OSRMStep[];
}

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: string;
  legs: OSRMLeg[];
}

export class BatchGenerationService {
  constructor(
    private supabase: SupabaseClient,
    private mapboxToken?: string,
    private osrmServer: string = 'https://router.project-osrm.org'
  ) {}

  /**
   * ZIP code center coordinates fallback (NYC demo ZIPs)
   */
  private getZipCenterCoordinates(zipCode: string): Coordinates {
    const zipCenters: { [key: string]: [number, number] } = {
      '10001': [40.7506, -73.9971],
      '10002': [40.7157, -73.9860],
      '10003': [40.7320, -73.9875],
      '10004': [40.6990, -74.0177],
      '10005': [40.7056, -74.0087],
      '10006': [40.7093, -74.0120],
      '10007': [40.7135, -74.0078],
      '10009': [40.7264, -73.9779],
      '10010': [40.7392, -73.9817],
      '10011': [40.7406, -74.0008]
    };
    
    const coords = zipCenters[zipCode] || [40.7580, -73.9855]; // Default NYC center
    return { latitude: coords[0], longitude: coords[1] };
  }

  /**
   * Geocode address using Mapbox API with ZIP fallback
   */
  async geocodeAddress(address: string, zipCode?: string): Promise<Coordinates | null> {
    if (!this.mapboxToken) {
      console.warn('⚠️ MAPBOX_PUBLIC_TOKEN not configured - using ZIP-based fallback (accuracy: ~1km)');
      return zipCode ? this.getZipCenterCoordinates(zipCode) : null;
    }

    try {
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${this.mapboxToken}&limit=1`
      );
      
      if (!response.ok) {
        console.warn('Mapbox geocoding failed:', response.status, '- using ZIP fallback');
        return zipCode ? this.getZipCenterCoordinates(zipCode) : null;
      }

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center;
        return { latitude, longitude };
      }
      
      console.warn('No Mapbox results - using ZIP fallback');
      return zipCode ? this.getZipCenterCoordinates(zipCode) : null;
    } catch (error) {
      console.warn('Error geocoding address:', error, '- using ZIP fallback');
      return zipCode ? this.getZipCenterCoordinates(zipCode) : null;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get OSRM distance matrix for multiple stops
   */
  private async getOsrmDistanceMatrix(
    coordinates: [number, number][]
  ): Promise<{ durations: number[][]; distances: number[][] } | null> {
    if (coordinates.length < 2) {
      console.warn('Need at least 2 coordinates for distance matrix');
      return null;
    }

    try {
      const coordString = coordinates
        .map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`)
        .join(';');

      const url = `${this.osrmServer}/table/v1/driving/${coordString}?annotations=distance,duration`;
      
      console.log(`Fetching OSRM distance matrix for ${coordinates.length} stops...`);
      const response = await fetch(url);

      if (!response.ok) {
        console.error('OSRM distance matrix request failed:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.code !== 'Ok') {
        console.error('OSRM error:', data.code, data.message);
        return null;
      }

      // Convert durations to minutes and distances to km
      const durations = data.durations.map((row: number[]) => 
        row.map((seconds: number) => seconds / 60)
      );
      const distances = data.distances.map((row: number[]) => 
        row.map((meters: number) => meters / 1000)
      );

      return { durations, distances };
    } catch (error) {
      console.error('Error fetching OSRM distance matrix:', error);
      return null;
    }
  }

  /**
   * Get detailed OSRM route with turn-by-turn directions
   */
  async getOsrmRoute(coordinates: [number, number][]): Promise<OSRMRoute | null> {
    if (coordinates.length < 2) {
      return null;
    }

    try {
      const coordString = coordinates
        .map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`)
        .join(';');

      const url = `${this.osrmServer}/route/v1/driving/${coordString}?overview=full&geometries=polyline&steps=true`;
      
      console.log('Fetching OSRM route with turn-by-turn directions...');
      const response = await fetch(url);

      if (!response.ok) {
        console.error('OSRM route request failed:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.error('OSRM route error:', data.code);
        return null;
      }

      const route: OSRMRoute = data.routes[0];
      return {
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
        geometry: route.geometry,
        legs: route.legs.map(leg => ({
          distance: leg.distance / 1000,
          duration: leg.duration / 60,
          steps: leg.steps.map((step: OSRMStep) => ({
            maneuver: step.maneuver.type,
            instruction: step.maneuver.instruction || `${step.maneuver.type} ${step.name || ''}`,
            distance: step.distance / 1000,
            duration: step.duration / 60
          }))
        }))
      };
    } catch (error) {
      console.error('Error fetching OSRM route:', error);
      return null;
    }
  }

  /**
   * 2-opt algorithm to improve route
   */
  private twoOptImprove(route: Stop[], distanceMatrix: number[][]): Stop[] {
    if (route.length < 4) return route;

    let improved = true;
    let bestRoute = [...route];

    while (improved) {
      improved = false;
      
      for (let i = 1; i < bestRoute.length - 2; i++) {
        for (let j = i + 1; j < bestRoute.length - 1; j++) {
          const currentDist = 
            distanceMatrix[i - 1][i] +
            distanceMatrix[j][j + 1];
          
          const newDist = 
            distanceMatrix[i - 1][j] +
            distanceMatrix[i][j + 1];
          
          if (newDist < currentDist) {
            const newRoute = [
              ...bestRoute.slice(0, i),
              ...bestRoute.slice(i, j + 1).reverse(),
              ...bestRoute.slice(j + 1)
            ];
            bestRoute = newRoute;
            improved = true;
          }
        }
      }
    }

    return bestRoute;
  }

  /**
   * Fallback nearest-neighbor using Haversine or ZIP-based sorting
   */
  private optimizeRouteFallback(stops: Stop[]): Stop[] {
    if (stops.length <= 1) return stops;

    // Sort by ZIP code first, then by street address
    const sorted = [...stops].sort((a, b) => {
      const zipA = a.address?.match(/\d{5}/)?.[0] || '';
      const zipB = b.address?.match(/\d{5}/)?.[0] || '';
      
      if (zipA !== zipB) {
        return zipA.localeCompare(zipB);
      }
      
      return (a.address || '').localeCompare(b.address || '');
    });

    // Then apply nearest-neighbor if coordinates available
    const optimized = [];
    const remaining = [...sorted];
    
    let current = remaining.shift()!;
    optimized.push(current);

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        if (current.latitude && current.longitude && 
            remaining[i].latitude && remaining[i].longitude) {
          const distance = this.calculateDistance(
            current.latitude,
            current.longitude,
            remaining[i].latitude!,
            remaining[i].longitude!
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        } else {
          nearestIndex = i;
          break;
        }
      }

      current = remaining.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    console.log('Using ZIP-based routing fallback');
    return optimized;
  }

  /**
   * OSRM-based route optimization with 2-opt improvement
   */
  async optimizeRouteWithOsrm(stops: Stop[]): Promise<RouteOptimizationResult> {
    if (stops.length <= 1) {
      return { optimizedStops: stops, method: 'single_stop' };
    }

    const validStops = stops.filter(s => s.latitude && s.longitude);
    
    if (validStops.length !== stops.length) {
      console.warn(`${stops.length - validStops.length} stops missing coordinates, using fallback`);
    }

    if (validStops.length === 0) {
      return { optimizedStops: stops, method: 'no_coordinates' };
    }

    const coordinates: [number, number][] = validStops.map(s => [s.longitude!, s.latitude!]);
    const matrixResult = await this.getOsrmDistanceMatrix(coordinates);

    if (!matrixResult) {
      console.warn('OSRM unavailable, falling back to Haversine');
      return { optimizedStops: this.optimizeRouteFallback(stops), method: 'haversine_fallback' };
    }

    const { distances } = matrixResult;

    // Nearest-neighbor using OSRM distances
    const optimized = [];
    const remaining = [...validStops];
    const indices: number[] = validStops.map((_, i) => i);
    
    let currentIndex = 0;
    optimized.push(remaining.shift()!);
    indices.shift();

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const distance = distances[currentIndex][indices[i]];
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      currentIndex = indices.splice(nearestIndex, 1)[0];
      optimized.push(remaining.splice(nearestIndex, 1)[0]);
    }

    // Apply 2-opt improvement
    console.log('Applying 2-opt optimization...');
    const improvedRoute = this.twoOptImprove(optimized, distances);

    return { 
      optimizedStops: improvedRoute, 
      method: 'osrm_with_2opt',
      distanceMatrix: distances
    };
  }

  /**
   * Calculate estimated arrival times with OSRM route data
   */
  async calculateEstimatedArrivalsWithOsrm(stops: Stop[], startTime: Date): Promise<Stop[]> {
    const stopDurationMinutes = 10;
    
    const coordinates: [number, number][] = stops
      .filter(s => s.latitude && s.longitude)
      .map(s => [s.longitude!, s.latitude!]);

    const osrmRoute = await this.getOsrmRoute(coordinates);

    if (osrmRoute && osrmRoute.legs) {
      let currentTime = new Date(startTime);
      
      return stops.map((stop, index) => {
        if (index > 0 && osrmRoute.legs[index - 1]) {
          const travelMinutes = osrmRoute.legs[index - 1].duration;
          currentTime = new Date(currentTime.getTime() + (travelMinutes + stopDurationMinutes) * 60000);
        }
        
        return {
          ...stop,
          estimated_arrival: currentTime.toISOString()
        };
      });
    }

    // Fallback to Haversine-based calculation
    console.warn('Using fallback time calculation with Haversine');
    const avgSpeedKmh = 40;
    let currentTime = new Date(startTime);

    return stops.map((stop, index) => {
      if (index > 0 && stop.latitude && stop.longitude && 
          stops[index - 1].latitude && stops[index - 1].longitude) {
        const distance = this.calculateDistance(
          stops[index - 1].latitude!,
          stops[index - 1].longitude!,
          stop.latitude,
          stop.longitude
        );
        const travelMinutes = (distance / avgSpeedKmh) * 60;
        currentTime = new Date(currentTime.getTime() + (travelMinutes + stopDurationMinutes) * 60000);
      }
      
      return {
        ...stop,
        estimated_arrival: currentTime.toISOString()
      };
    });
  }
}
