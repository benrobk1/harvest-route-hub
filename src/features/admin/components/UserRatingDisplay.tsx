import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getRatingDisplay } from '@/lib/ratingHelpers';
import { driverQueries } from '@/features/drivers';

interface UserRatingDisplayProps {
  driverId: string;
}

export const UserRatingDisplay = ({ driverId }: UserRatingDisplayProps) => {
  const { data: ratingData, isLoading } = useQuery({
    queryKey: driverQueries.rating(driverId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_ratings')
        .select('rating')
        .eq('driver_id', driverId);

      if (error) throw error;

      const ratings = data || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      return {
        avgRating,
        count: ratings.length,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-5 w-32" />;
  }

  if (!ratingData) {
    return <span className="text-sm text-muted-foreground">No ratings</span>;
  }

  const display = getRatingDisplay(ratingData.avgRating, ratingData.count);

  if (!display.show) {
    return (
      <span className="text-sm text-muted-foreground">
        N/A ({display.progress})
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      <span className="text-sm font-medium">{display.rating}</span>
      <span className="text-xs text-muted-foreground">({display.reviewCount})</span>
    </div>
  );
};
