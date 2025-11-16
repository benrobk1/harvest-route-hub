/**
 * FEEDBACK DOMAIN TYPES
 * Shared type definitions for feedback and ratings
 */

export type FeedbackTag = string;

export interface DriverFeedbackTags {
  positive: FeedbackTag[];
  neutral: FeedbackTag[];
  negative: FeedbackTag[];
}

export interface FarmFeedbackTags {
  positive: FeedbackTag[];
  negative: FeedbackTag[];
}

export interface ItemFeedbackTags {
  positive: FeedbackTag[];
  negative: FeedbackTag[];
}

export const DRIVER_FEEDBACK_TAGS: DriverFeedbackTags = {
  positive: [
    'Professional',
    'Friendly',
    'On Time',
    'Careful Handling',
    'Great Communication',
  ],
  neutral: [
    'Average Service',
  ],
  negative: [
    'Poor Communication',
    'Late Delivery',
    'Damaged Items',
    'Unprofessional',
  ],
};

export const FARM_FEEDBACK_TAGS: FarmFeedbackTags = {
  positive: [
    'Fresh Products',
    'Great Variety',
    'Excellent Quality',
    'Well Packaged',
    'Great Value',
  ],
  negative: [
    'Inconsistent Quality',
    'Poor Packaging',
    'Limited Selection',
    'Overpriced',
  ],
};

export const ITEM_FEEDBACK_TAGS: ItemFeedbackTags = {
  positive: [
    'Perfect!',
    'Very Fresh',
    'Good Value',
    'Great Quality',
    'Better Than Expected',
  ],
  negative: [
    'Overripe',
    'Damaged',
    'Wrong Size',
    'Not Fresh',
    'Poor Quality',
  ],
};

export interface DeliveryRating {
  id: string;
  order_id: string;
  driver_id: string;
  rating: number;
  feedback?: string;
  feedback_tags?: FeedbackTag[];
  reviewer_type: 'consumer' | 'lead_farmer';
  created_at: string;
}

export interface FarmRating {
  id: string;
  farm_profile_id: string;
  consumer_id: string;
  order_id: string;
  rating: number;
  feedback?: string;
  feedback_tags?: FeedbackTag[];
  created_at: string;
}

export interface OrderItemRating {
  id: string;
  order_item_id: string;
  consumer_id: string;
  product_id: string;
  farm_profile_id: string;
  rating: number;
  feedback?: string;
  feedback_tags?: FeedbackTag[];
  created_at: string;
}
