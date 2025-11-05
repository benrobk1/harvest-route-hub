import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const CartItemSkeleton = () => {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-16 w-16 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
};

export default React.memo(CartItemSkeleton);
