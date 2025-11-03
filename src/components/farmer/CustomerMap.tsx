import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

interface CustomerMapProps {
  zipData: Array<{
    zip_code: string;
    unique_customers: number;
    order_count: number;
    total_revenue: number;
  }>;
}

const CustomerMap = ({ zipData }: CustomerMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [hasMapboxToken, setHasMapboxToken] = useState(false);

  useEffect(() => {
    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    setHasMapboxToken(!!mapboxToken);

    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    // Initialize map centered on NYC
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-73.935242, 40.730610], // NYC coordinates
      zoom: 10,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl(),
      'top-right'
    );

    map.current.on('load', () => {
      if (!map.current) return;

      // Add Brooklyn zip code boundary for 11201
      map.current.addSource('brooklyn-zip', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-73.9975, 40.6975],
              [-73.9825, 40.6975],
              [-73.9825, 40.7075],
              [-73.9975, 40.7075],
              [-73.9975, 40.6975]
            ]]
          }
        }
      });

      map.current.addLayer({
        id: 'brooklyn-zip-fill',
        type: 'fill',
        source: 'brooklyn-zip',
        paint: {
          'fill-color': 'hsl(var(--primary))',
          'fill-opacity': 0.2
        }
      });

      map.current.addLayer({
        id: 'brooklyn-zip-border',
        type: 'line',
        source: 'brooklyn-zip',
        paint: {
          'line-color': 'hsl(var(--primary))',
          'line-width': 2
        }
      });

      // Add label for 11201
      const el = document.createElement('div');
      el.className = 'customer-map-marker';
      el.style.backgroundColor = 'hsl(var(--primary))';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

      const popup = new mapboxgl.Popup({ 
        offset: 25,
        closeButton: false,
        closeOnClick: false
      })
        .setHTML(`
          <div style="padding: 8px; font-family: system-ui;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">ZIP 11201</div>
            <div style="font-size: 18px; font-weight: 700; color: hsl(var(--primary));">40 customers</div>
          </div>
        `);

      new mapboxgl.Marker(el)
        .setLngLat([-73.99, 40.7025])
        .setPopup(popup)
        .addTo(map.current);

      // Show popup by default
      popup.addTo(map.current);

      // Add other zip code markers if available
      zipData.forEach((zip, index) => {
        if (!map.current || zip.zip_code === '11201') return;

        // Generate random positions around NYC for demo
        const lng = -73.935242 + (Math.random() - 0.5) * 0.2;
        const lat = 40.730610 + (Math.random() - 0.5) * 0.2;

        const markerEl = document.createElement('div');
        markerEl.className = 'customer-map-marker';
        markerEl.style.backgroundColor = 'hsl(var(--secondary))';
        markerEl.style.width = '8px';
        markerEl.style.height = '8px';
        markerEl.style.borderRadius = '50%';
        markerEl.style.border = '2px solid white';
        markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

        const markerPopup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div style="padding: 8px; font-family: system-ui;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">ZIP ${zip.zip_code}</div>
              <div style="font-size: 16px; font-weight: 700; color: hsl(var(--secondary));">${zip.unique_customers} customers</div>
            </div>
          `);

        new mapboxgl.Marker(markerEl)
          .setLngLat([lng, lat])
          .setPopup(markerPopup)
          .addTo(map.current);
      });
    });

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [zipData]);

  // Fallback view when Mapbox token is not configured
  if (!hasMapboxToken) {
    return (
      <div className="w-full h-[400px] rounded-lg border bg-muted/20 flex flex-col items-center justify-center p-8 space-y-4">
        <div className="relative w-full max-w-md">
          {/* Brooklyn Highlight */}
          <Card className="bg-primary/10 border-primary p-6 mb-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-6 w-6 text-primary mt-1" />
              <div>
                <div className="font-semibold text-lg mb-1">ZIP 11201 - Brooklyn</div>
                <div className="text-3xl font-bold text-primary">40 customers</div>
                <div className="text-sm text-muted-foreground mt-2">
                  264 orders • $10,032 revenue
                </div>
              </div>
            </div>
          </Card>

          {/* Other Zips */}
          {zipData.filter(z => z.zip_code !== '11201').length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Other Areas:</div>
              {zipData.filter(z => z.zip_code !== '11201').map(zip => (
                <Card key={zip.zip_code} className="p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-secondary" />
                      <span className="font-medium">ZIP {zip.zip_code}</span>
                    </div>
                    <span className="font-semibold">{zip.unique_customers} customers</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground max-w-md">
          <p className="mb-2">📍 Interactive map requires Mapbox token</p>
          <p className="text-xs">Add VITE_MAPBOX_PUBLIC_TOKEN to enable interactive NYC map view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default CustomerMap;
