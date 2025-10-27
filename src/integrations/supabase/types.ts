export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      batch_stops: {
        Row: {
          actual_arrival: string | null
          address: string
          created_at: string
          delivery_batch_id: string
          estimated_arrival: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          order_id: string
          sequence_number: number
          status: string
        }
        Insert: {
          actual_arrival?: string | null
          address: string
          created_at?: string
          delivery_batch_id: string
          estimated_arrival?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id: string
          sequence_number: number
          status?: string
        }
        Update: {
          actual_arrival?: string | null
          address?: string
          created_at?: string
          delivery_batch_id?: string
          estimated_arrival?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string
          sequence_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_stops_delivery_batch_id_fkey"
            columns: ["delivery_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "shopping_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credits_ledger: {
        Row: {
          amount: number
          balance_after: number
          consumer_id: string
          created_at: string
          description: string
          expires_at: string | null
          id: string
          order_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          consumer_id: string
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          consumer_id?: string
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_batches: {
        Row: {
          batch_number: number
          created_at: string | null
          delivery_date: string
          driver_id: string | null
          estimated_duration_minutes: number | null
          id: string
          lead_farmer_id: string
          status: string | null
          updated_at: string | null
          zip_codes: string[] | null
        }
        Insert: {
          batch_number: number
          created_at?: string | null
          delivery_date: string
          driver_id?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          lead_farmer_id: string
          status?: string | null
          updated_at?: string | null
          zip_codes?: string[] | null
        }
        Update: {
          batch_number?: number
          created_at?: string | null
          delivery_date?: string
          driver_id?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          lead_farmer_id?: string
          status?: string | null
          updated_at?: string | null
          zip_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_batches_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_lead_farmer_id_fkey"
            columns: ["lead_farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proofs: {
        Row: {
          batch_stop_id: string
          created_at: string
          delivered_at: string
          driver_id: string
          id: string
          notes: string | null
          photo_url: string | null
          recipient_name: string | null
          signature_url: string | null
        }
        Insert: {
          batch_stop_id: string
          created_at?: string
          delivered_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          recipient_name?: string | null
          signature_url?: string | null
        }
        Update: {
          batch_stop_id?: string
          created_at?: string
          delivered_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          recipient_name?: string | null
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_batch_stop_id_fkey"
            columns: ["batch_stop_id"]
            isOneToOne: false
            referencedRelation: "batch_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_photos: {
        Row: {
          created_at: string | null
          display_order: number | null
          farm_profile_id: string
          id: string
          photo_url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          farm_profile_id: string
          id?: string
          photo_url: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          farm_profile_id?: string
          id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_photos_farm_profile_id_fkey"
            columns: ["farm_profile_id"]
            isOneToOne: false
            referencedRelation: "farm_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          farm_name: string
          farmer_id: string
          id: string
          location: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          farm_name: string
          farmer_id: string
          id?: string
          location?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          farm_name?: string
          farmer_id?: string
          id?: string
          location?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_profiles_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          consumer_id: string
          created_at: string
          expires_at: string
          id: string
          order_id: string | null
          product_id: string
          quantity: number
          status: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          expires_at: string
          id?: string
          order_id?: string | null
          product_id: string
          quantity: number
          status?: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      market_configs: {
        Row: {
          active: boolean
          created_at: string
          cutoff_time: string
          delivery_days: string[]
          delivery_fee: number
          id: string
          minimum_order: number
          updated_at: string
          zip_code: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cutoff_time?: string
          delivery_days: string[]
          delivery_fee: number
          id?: string
          minimum_order?: number
          updated_at?: string
          zip_code: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cutoff_time?: string
          delivery_days?: string[]
          delivery_fee?: number
          id?: string
          minimum_order?: number
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          consumer_id: string
          created_at: string | null
          delivery_batch_id: string | null
          delivery_date: string
          id: string
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          consumer_id: string
          created_at?: string | null
          delivery_batch_id?: string | null
          delivery_date: string
          id?: string
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          consumer_id?: string
          created_at?: string | null
          delivery_batch_id?: string | null
          delivery_date?: string
          id?: string
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_delivery_batch"
            columns: ["delivery_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          client_secret: string | null
          consumer_id: string
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          payment_method: string | null
          status: string
          stripe_payment_intent_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          client_secret?: string | null
          consumer_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_method?: string | null
          status: string
          stripe_payment_intent_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client_secret?: string | null
          consumer_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_method?: string | null
          status?: string
          stripe_payment_intent_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          order_id: string
          recipient_id: string
          recipient_type: string
          status: string
          stripe_connect_account_id: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_id: string
          recipient_id: string
          recipient_type: string
          status?: string
          stripe_connect_account_id?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string
          recipient_id?: string
          recipient_type?: string
          status?: string
          stripe_connect_account_id?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_quantity: number | null
          created_at: string | null
          description: string | null
          farm_profile_id: string
          id: string
          image_url: string | null
          name: string
          price: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string | null
          description?: string | null
          farm_profile_id: string
          id?: string
          image_url?: string | null
          name: string
          price: number
          unit: string
          updated_at?: string | null
        }
        Update: {
          available_quantity?: number | null
          created_at?: string | null
          description?: string | null
          farm_profile_id?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_farm_profile_id_fkey"
            columns: ["farm_profile_id"]
            isOneToOne: false
            referencedRelation: "farm_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          collection_point_address: string | null
          collection_point_lead_farmer_id: string | null
          commission_rate: number | null
          created_at: string | null
          delivery_address: string | null
          delivery_days: string[] | null
          delivery_schedule: string[] | null
          email: string
          farm_name: string | null
          full_name: string | null
          id: string
          license_number: string | null
          payment_setup_complete: boolean | null
          phone: string | null
          stripe_charges_enabled: boolean | null
          stripe_connect_account_id: string | null
          stripe_onboarding_complete: boolean | null
          stripe_payouts_enabled: boolean | null
          updated_at: string | null
          vehicle_make: string | null
          vehicle_type: string | null
          vehicle_year: string | null
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          collection_point_address?: string | null
          collection_point_lead_farmer_id?: string | null
          commission_rate?: number | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_days?: string[] | null
          delivery_schedule?: string[] | null
          email: string
          farm_name?: string | null
          full_name?: string | null
          id: string
          license_number?: string | null
          payment_setup_complete?: boolean | null
          phone?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_connect_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          collection_point_address?: string | null
          collection_point_lead_farmer_id?: string | null
          commission_rate?: number | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_days?: string[] | null
          delivery_schedule?: string[] | null
          email?: string
          farm_name?: string | null
          full_name?: string | null
          id?: string
          license_number?: string | null
          payment_setup_complete?: boolean | null
          phone?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_connect_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_collection_point_lead_farmer_id_fkey"
            columns: ["collection_point_lead_farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          completed_at: string | null
          created_at: string | null
          delivery_batch_id: string
          driver_id: string
          id: string
          route_data: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          delivery_batch_id: string
          driver_id: string
          id?: string
          route_data?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          delivery_batch_id?: string
          driver_id?: string
          id?: string
          route_data?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_delivery_batch_id_fkey"
            columns: ["delivery_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_carts: {
        Row: {
          consumer_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transaction_fees: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          fee_type: string
          id: string
          order_id: string
          recipient_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          fee_type: string
          id?: string
          order_id: string
          recipient_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          order_id?: string
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_fees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "consumer" | "farmer" | "lead_farmer" | "driver" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["consumer", "farmer", "lead_farmer", "driver", "admin"],
    },
  },
} as const
