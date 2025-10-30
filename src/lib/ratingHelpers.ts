export const MINIMUM_REVIEWS_THRESHOLD = 25;

export const shouldShowRating = (reviewCount: number): boolean => {
  return reviewCount >= MINIMUM_REVIEWS_THRESHOLD;
};

export interface RatingDisplay {
  rating: string;
  reviewCount: number;
  show: boolean;
  progress?: string;
}

export const getRatingDisplay = (rating: number, reviewCount: number): RatingDisplay => {
  if (reviewCount >= MINIMUM_REVIEWS_THRESHOLD) {
    return { 
      rating: rating.toFixed(1), 
      reviewCount, 
      show: true 
    };
  }
  return { 
    rating: "N/A", 
    reviewCount, 
    show: false,
    progress: `${reviewCount}/${MINIMUM_REVIEWS_THRESHOLD}`
  };
};
