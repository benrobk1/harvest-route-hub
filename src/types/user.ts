/**
 * USER DOMAIN TYPES
 * Shared type definitions for users and profiles across the application
 */

export type UserRole = 'consumer' | 'farmer' | 'lead_farmer' | 'driver' | 'admin';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  street_address: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
  referral_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsumerProfile extends UserProfile {
  delivery_address: string | null;
  delivery_days: string[] | null;
  push_subscription: any | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
}

export interface FarmerProfile extends UserProfile {
  farm_name: string | null;
  farm_size: string | null;
  produce_types: string | null;
  stripe_connect_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  payment_setup_complete: boolean;
  w9_submitted_at: string | null;
  collection_point_lead_farmer_id: string | null;
  commission_rate: number;
}

export interface DriverProfile extends UserProfile {
  vehicle_type: string | null;
  vehicle_make: string | null;
  driver_license_url: string | null;
  insurance_url: string | null;
  coi_url: string | null;
  stripe_connect_account_id: string | null;
  stripe_onboarding_complete: boolean;
  payment_setup_complete: boolean;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  street_address?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  avatar_url?: string;
}
