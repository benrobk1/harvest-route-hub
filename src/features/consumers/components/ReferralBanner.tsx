import { Button } from '@/components/ui/button';
import { Gift, X } from 'lucide-react';
import { useState } from 'react';

interface ReferralBannerProps {
  onOpenModal: () => void;
}

export const ReferralBanner = ({ onOpenModal }: ReferralBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-lg p-4 mb-6">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-center justify-between gap-4 pr-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-full">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Refer & Earn $25</h3>
            <p className="text-sm text-muted-foreground">
              Share Blue Harvests with friends and both earn $25 in credits
            </p>
          </div>
        </div>
        
        <Button onClick={onOpenModal} variant="default">
          Share Now
        </Button>
      </div>
    </div>
  );
};
