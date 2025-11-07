import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

interface QuantitySelectorProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export const QuantitySelector = ({ 
  quantity, 
  onIncrement, 
  onDecrement, 
  disabled 
}: QuantitySelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onDecrement}
        disabled={disabled || quantity <= 1}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-8 text-center font-medium">{quantity}</span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onIncrement}
        disabled={disabled}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
};
