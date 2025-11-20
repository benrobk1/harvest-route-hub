import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  customer: string;
  address: string;
  status: string;
}

interface DriverInterfaceProps {
  stops: Stop[];
  onMarkDelivered: (stopId: string) => void;
  onStartNavigation: (address: string) => void;
}

export const DriverInterface = ({ stops, onMarkDelivered, onStartNavigation }: DriverInterfaceProps) => {
  const nextStop = stops.find(s => s.status === 'pending');

  return (
    <div className="space-y-4">
      {nextStop && (
        <Card className="border-2 border-primary p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Next Stop</h3>
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="text-lg font-semibold">{nextStop.customer}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Address
                </p>
                <p className="text-base">{nextStop.address}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button
                size="lg"
                className="w-full h-14 text-lg"
                onClick={() => onStartNavigation(nextStop.address)}
              >
                <Navigation className="mr-2 h-5 w-5" />
                Start Navigation
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 text-lg"
                onClick={() => onMarkDelivered(nextStop.id)}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Mark as Delivered
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold">Upcoming Stops ({stops.filter(s => s.status === 'pending').length})</h3>
        {stops.filter(s => s.id !== nextStop?.id && s.status === 'pending').map((stop, idx) => (
          <Card key={stop.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-medium">#{idx + 2} {stop.customer}</p>
                <p className="text-sm text-muted-foreground">{stop.address}</p>
              </div>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                stop.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              )}>
                {stop.status}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DriverInterface;
