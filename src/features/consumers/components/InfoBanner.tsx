import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/formatMoney';

export const InfoBanner = () => {
  return (
    <Card className="mb-8 bg-primary text-primary-foreground p-6">
      <div className="grid gap-4 md:grid-cols-3 text-center">
        <div>
          <div className="text-2xl font-bold mb-1">{formatMoney(25)}</div>
          <div className="text-sm opacity-90">Minimum Order</div>
        </div>
        <div>
          <div className="text-2xl font-bold mb-1">{formatMoney(7.50)}</div>
          <div className="text-sm opacity-90">Delivery Fee (100% to Driver)</div>
        </div>
        <div>
          <div className="text-2xl font-bold mb-1">{formatMoney(10)}</div>
          <div className="text-sm opacity-90">Credit for $100+ Monthly Spend</div>
        </div>
      </div>
    </Card>
  );
};
