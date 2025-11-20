import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { DriverRating } from './DriverRating';
import { FarmRating } from './FarmRating';
import { ItemRating } from './ItemRating';
import type { FeedbackTag } from '../types/feedback';
import type { OrderWithDetails } from '@/features/orders/types';

interface FarmRatingData {
  farmProfileId: string;
  farmName: string;
  rating: number;
  feedback: string;
  tags: FeedbackTag[];
}

interface ItemRatingData {
  orderItemId: string;
  productId: string;
  farmProfileId: string;
  productName: string;
  quantity: number;
  unit: string;
  rating: number;
  feedback: string;
  tags: FeedbackTag[];
}

interface CompleteFeedbackDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderWithDetails;
  hasDriverRating: boolean;
}

export const CompleteFeedbackDrawer = ({
  open,
  onOpenChange,
  order,
  hasDriverRating,
}: CompleteFeedbackDrawerProps) => {
  const [step, setStep] = useState(0);
  const [driverRated, setDriverRated] = useState(hasDriverRating);
  const queryClient = useQueryClient();

  // Farm ratings state
  const [farmRatings, setFarmRatings] = useState<Record<string, FarmRatingData>>({});

  // Item ratings state
  const [itemRatings, setItemRatings] = useState<Record<string, ItemRatingData>>({});

  // Extract unique farms from order items
  const farms = order.order_items.reduce((acc, item) => {
    const farmId = item.products.farm_profiles.id;
    if (!acc[farmId]) {
      acc[farmId] = {
        id: farmId,
        name: item.products.farm_profiles.farm_name,
      };
    }
    return acc;
  }, {} as Record<string, { id: string; name: string }>);

  // Initialize ratings state
  useEffect(() => {
    if (open) {
      // Initialize farm ratings
      const initialFarmRatings: Record<string, FarmRatingData> = {};
      Object.values(farms).forEach(farm => {
        initialFarmRatings[farm.id] = {
          farmProfileId: farm.id,
          farmName: farm.name,
          rating: 0,
          feedback: '',
          tags: [],
        };
      });
      setFarmRatings(initialFarmRatings);

      // Initialize item ratings
      const initialItemRatings: Record<string, ItemRatingData> = {};
      order.order_items.forEach((item) => {
        initialItemRatings[item.id] = {
          orderItemId: item.id,
          productId: item.products.id,
          farmProfileId: item.products.farm_profiles.id,
          productName: item.products.name,
          quantity: item.quantity,
          unit: item.products.unit,
          rating: 0,
          feedback: '',
          tags: [],
        };
      });
      setItemRatings(initialItemRatings);

      setStep(driverRated ? 1 : 0);
    }
  }, [open, order.order_items, farms, driverRated]);

  const submitAllFeedback = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Submit farm ratings
      const farmRatingsToSubmit = Object.values(farmRatings).filter(r => r.rating > 0);
      if (farmRatingsToSubmit.length > 0) {
        const { error: farmError } = await supabase.from('farm_ratings').insert(
          farmRatingsToSubmit.map(r => ({
            farm_profile_id: r.farmProfileId,
            consumer_id: user.id,
            order_id: order.id,
            rating: r.rating,
            feedback: r.feedback || null,
            feedback_tags: r.tags,
          }))
        );
        if (farmError) throw farmError;
      }

      // Submit item ratings
      const itemRatingsToSubmit = Object.values(itemRatings).filter(r => r.rating > 0);
      if (itemRatingsToSubmit.length > 0) {
        const { error: itemError } = await supabase.from('order_item_ratings').insert(
          itemRatingsToSubmit.map(r => ({
            order_item_id: r.orderItemId,
            consumer_id: user.id,
            product_id: r.productId,
            farm_profile_id: r.farmProfileId,
            rating: r.rating,
            feedback: r.feedback || null,
            feedback_tags: r.tags,
          }))
        );
        if (itemError) throw itemError;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your detailed feedback!',
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error submitting feedback',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const totalSteps = driverRated ? 2 : 3;
  const currentProgress = ((step + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      submitAllFeedback.mutate();
    }
  };

  const handleSkip = () => {
    if (step === totalSteps - 1) {
      submitAllFeedback.mutate();
    } else {
      setStep(step + 1);
    }
  };

  const canProceed = () => {
    if (step === 0 && !driverRated) return driverRated;
    if (step === (driverRated ? 0 : 1)) {
      return Object.values(farmRatings).some(r => r.rating > 0);
    }
    return true;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Share Your Feedback</DrawerTitle>
            <DrawerDescription>
              Help us improve by rating your experience
            </DrawerDescription>
            <Progress value={currentProgress} className="mt-4" />
            <p className="text-sm text-muted-foreground mt-2">
              Step {step + 1} of {totalSteps}
            </p>
          </DrawerHeader>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
            {step === 0 && !driverRated && order.delivery_batches?.driver_id && (
              <DriverRating
                orderId={order.id}
                driverId={order.delivery_batches.driver_id}
                driverName={order.delivery_batches.profiles.full_name}
                onRatingSubmitted={() => {
                  setDriverRated(true);
                  setStep(1);
                }}
              />
            )}

            {step === (driverRated ? 0 : 1) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Rate Farms</h3>
                {Object.values(farms).map(farm => (
                  <FarmRating
                    key={farm.id}
                    farmName={farm.name}
                    farmProfileId={farm.id}
                    rating={farmRatings[farm.id]?.rating || 0}
                    onRatingChange={(rating) =>
                      setFarmRatings(prev => ({
                        ...prev,
                        [farm.id]: { ...prev[farm.id], rating },
                      }))
                    }
                    feedback={farmRatings[farm.id]?.feedback || ''}
                    onFeedbackChange={(feedback) =>
                      setFarmRatings(prev => ({
                        ...prev,
                        [farm.id]: { ...prev[farm.id], feedback },
                      }))
                    }
                    selectedTags={farmRatings[farm.id]?.tags || []}
                    onTagsChange={(tags) =>
                      setFarmRatings(prev => ({
                        ...prev,
                        [farm.id]: { ...prev[farm.id], tags },
                      }))
                    }
                  />
                ))}
              </div>
            )}

            {step === (driverRated ? 1 : 2) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Rate Individual Items</h3>
                <p className="text-sm text-muted-foreground">
                  Expand items to rate them (optional)
                </p>
                {order.order_items.map((item) => (
                  <ItemRating
                    key={item.id}
                    productName={item.products.name}
                    quantity={item.quantity}
                    unit={item.products.unit}
                    rating={itemRatings[item.id]?.rating || 0}
                    onRatingChange={(rating) =>
                      setItemRatings(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], rating },
                      }))
                    }
                    feedback={itemRatings[item.id]?.feedback || ''}
                    onFeedbackChange={(feedback) =>
                      setItemRatings(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], feedback },
                      }))
                    }
                    selectedTags={itemRatings[item.id]?.tags || []}
                    onTagsChange={(tags) =>
                      setItemRatings(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], tags },
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="p-6 flex justify-between">
            <Button variant="outline" onClick={handleSkip}>
              Skip
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed() || submitAllFeedback.isPending}
            >
              {step === totalSteps - 1
                ? submitAllFeedback.isPending
                  ? 'Submitting...'
                  : 'Submit All'
                : 'Next'}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
