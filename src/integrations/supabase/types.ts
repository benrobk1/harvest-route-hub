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
      admin_audit_log: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_value: Json | null
          old_value: Json | null
          target_resource_id: string | null
          target_resource_type: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invitation_token: string
          invited_by?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          new_status: string
          previous_status: string
          reason: string | null
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          previous_status: string
          reason?: string | null
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      batch_metadata: {
        Row: {
          ai_optimization_data: Json | null
          collection_point_address: string | null
          collection_point_id: string | null
          created_at: string | null
          delivery_batch_id: string | null
          estimated_route_hours: number | null
          id: string
          is_subsidized: boolean | null
          merged_zips: string[] | null
          order_count: number
          original_zip_codes: string[] | null
        }
        Insert: {
          ai_optimization_data?: Json | null
          collection_point_address?: string | null
          collection_point_id?: string | null
          created_at?: string | null
          delivery_batch_id?: string | null
          estimated_route_hours?: number | null
          id?: string
          is_subsidized?: boolean | null
          merged_zips?: string[] | null
          order_count: number
          original_zip_codes?: string[] | null
        }
        Update: {
          ai_optimization_data?: Json | null
          collection_point_address?: string | null
          collection_point_id?: string | null
          created_at?: string | null
          delivery_batch_id?: string | null
          estimated_route_hours?: number | null
          id?: string
          is_subsidized?: boolean | null
          merged_zips?: string[] | null
          order_count?: number
          original_zip_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_metadata_collection_point_id_fkey"
            columns: ["collection_point_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_metadata_delivery_batch_id_fkey"
            columns: ["delivery_batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_stops: {
        Row: {
          actual_arrival: string | null
          address: string
          address_visible_at: string | null
          city: string | null
          created_at: string
          delivery_batch_id: string
          estimated_arrival: string | null
          geojson: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          order_id: string
          sequence_number: number
          state: string | null
          status: string
          street_address: string | null
          zip_code: string | null
        }
        Insert: {
          actual_arrival?: string | null
          address: string
          address_visible_at?: string | null
          city?: string | null
          created_at?: string
          delivery_batch_id: string
          estimated_arrival?: string | null
          geojson?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id: string
          sequence_number: number
          state?: string | null
          status?: string
          street_address?: string | null
          zip_code?: string | null
        }
        Update: {
          actual_arrival?: string | null
          address?: string
          address_visible_at?: string | null
          city?: string | null
          created_at?: string
          delivery_batch_id?: string
          estimated_arrival?: string | null
          geojson?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string
          sequence_number?: number
          state?: string | null
          status?: string
          street_address?: string | null
          zip_code?: string | null
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
          {
            foreignKeyName: "delivery_proofs_batch_stop_id_fkey"
            columns: ["batch_stop_id"]
            isOneToOne: false
            referencedRelation: "driver_batch_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proofs_batch_stop_id_fkey"
            columns: ["batch_stop_id"]
            isOneToOne: false
            referencedRelation: "driver_batch_stops_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ratings: {
        Row: {
          created_at: string
          driver_id: string
          feedback: string | null
          feedback_tags: Json | null
          id: string
          order_id: string
          rating: number
          reviewer_type: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          feedback?: string | null
          feedback_tags?: Json | null
          id?: string
          order_id: string
          rating: number
          reviewer_type?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          feedback?: string | null
          feedback_tags?: Json | null
          id?: string
          order_id?: string
          rating?: number
          reviewer_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_scan_logs: {
        Row: {
          batch_id: string | null
          box_code: string
          created_at: string
          driver_id: string
          id: string
          latitude: number | null
          longitude: number | null
          order_id: string | null
          scan_type: string
          scanned_at: string
          stop_id: string | null
        }
        Insert: {
          batch_id?: string | null
          box_code: string
          created_at?: string
          driver_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_id?: string | null
          scan_type: string
          scanned_at?: string
          stop_id?: string | null
        }
        Update: {
          batch_id?: string | null
          box_code?: string
          created_at?: string
          driver_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_id?: string | null
          scan_type?: string
          scanned_at?: string
          stop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_scan_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "delivery_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_scan_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_scan_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_scan_logs_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "batch_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_scan_logs_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "driver_batch_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_scan_logs_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "driver_batch_stops_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          consumer_id: string
          created_at: string
          description: string
          dispute_type: string
          id: string
          order_id: string
          refund_amount: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          description: string
          dispute_type: string
          id?: string
          order_id: string
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          description?: string
          dispute_type?: string
          id?: string
          order_id?: string
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_affiliations: {
        Row: {
          active: boolean | null
          commission_rate: number | null
          created_at: string | null
          farm_profile_id: string
          id: string
          lead_farmer_id: string
        }
        Insert: {
          active?: boolean | null
          commission_rate?: number | null
          created_at?: string | null
          farm_profile_id: string
          id?: string
          lead_farmer_id: string
        }
        Update: {
          active?: boolean | null
          commission_rate?: number | null
          created_at?: string | null
          farm_profile_id?: string
          id?: string
          lead_farmer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_affiliations_farm_profile_id_fkey"
            columns: ["farm_profile_id"]
            isOneToOne: false
            referencedRelation: "farm_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_affiliations_lead_farmer_id_fkey"
            columns: ["lead_farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          bio: string | null
          created_at: string | null
          description: string | null
          farm_name: string
          farmer_id: string
          id: string
          location: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          description?: string | null
          farm_name: string
          farmer_id: string
          id?: string
          location?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
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
      farm_ratings: {
        Row: {
          consumer_id: string
          created_at: string | null
          farm_profile_id: string
          feedback: string | null
          feedback_tags: Json | null
          id: string
          order_id: string
          rating: number
        }
        Insert: {
          consumer_id: string
          created_at?: string | null
          farm_profile_id: string
          feedback?: string | null
          feedback_tags?: Json | null
          id?: string
          order_id: string
          rating: number
        }
        Update: {
          consumer_id?: string
          created_at?: string | null
          farm_profile_id?: string
          feedback?: string | null
          feedback_tags?: Json | null
          id?: string
          order_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "farm_ratings_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_ratings_farm_profile_id_fkey"
            columns: ["farm_profile_id"]
            isOneToOne: false
            referencedRelation: "farm_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          collection_point_id: string | null
          created_at: string
          cutoff_time: string
          delivery_days: string[]
          delivery_fee: number
          id: string
          max_batch_size: number | null
          max_route_hours: number | null
          min_batch_size: number | null
          minimum_order: number
          target_batch_size: number | null
          updated_at: string
          zip_code: string
        }
        Insert: {
          active?: boolean
          collection_point_id?: string | null
          created_at?: string
          cutoff_time?: string
          delivery_days: string[]
          delivery_fee: number
          id?: string
          max_batch_size?: number | null
          max_route_hours?: number | null
          min_batch_size?: number | null
          minimum_order?: number
          target_batch_size?: number | null
          updated_at?: string
          zip_code: string
        }
        Update: {
          active?: boolean
          collection_point_id?: string | null
          created_at?: string
          cutoff_time?: string
          delivery_days?: string[]
          delivery_fee?: number
          id?: string
          max_batch_size?: number | null
          max_route_hours?: number | null
          min_batch_size?: number | null
          minimum_order?: number
          target_batch_size?: number | null
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_configs_collection_point_id_fkey"
            columns: ["collection_point_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_ratings: {
        Row: {
          consumer_id: string
          created_at: string | null
          farm_profile_id: string
          feedback: string | null
          feedback_tags: Json | null
          id: string
          order_item_id: string
          product_id: string
          rating: number
        }
        Insert: {
          consumer_id: string
          created_at?: string | null
          farm_profile_id: string
          feedback?: string | null
          feedback_tags?: Json | null
          id?: string
          order_item_id: string
          product_id: string
          rating: number
        }
        Update: {
          consumer_id?: string
          created_at?: string | null
          farm_profile_id?: string
          feedback?: string | null
          feedback_tags?: Json | null
          id?: string
          order_item_id?: string
          product_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_ratings_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_ratings_farm_profile_id_fkey"
            columns: ["farm_profile_id"]
            isOneToOne: false
            referencedRelation: "farm_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_ratings_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          box_code: string | null
          consumer_id: string
          created_at: string | null
          delivery_batch_id: string | null
          delivery_date: string
          id: string
          status: string | null
          tip_amount: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          box_code?: string | null
          consumer_id: string
          created_at?: string | null
          delivery_batch_id?: string | null
          delivery_date: string
          id?: string
          status?: string | null
          tip_amount?: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          box_code?: string | null
          consumer_id?: string
          created_at?: string | null
          delivery_batch_id?: string | null
          delivery_date?: string
          id?: string
          status?: string | null
          tip_amount?: number
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
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          available_quantity: number | null
          created_at: string | null
          description: string | null
          farm_profile_id: string
          harvest_date: string | null
          id: string
          image_url: string | null
          last_reviewed_at: string | null
          name: string
          price: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          available_quantity?: number | null
          created_at?: string | null
          description?: string | null
          farm_profile_id: string
          harvest_date?: string | null
          id?: string
          image_url?: string | null
          last_reviewed_at?: string | null
          name: string
          price: number
          unit: string
          updated_at?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          available_quantity?: number | null
          created_at?: string | null
          description?: string | null
          farm_profile_id?: string
          harvest_date?: string | null
          id?: string
          image_url?: string | null
          last_reviewed_at?: string | null
          name?: string
          price?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          acquisition_channel: string | null
          additional_info: string | null
          address_line_2: string | null
          applied_role: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          city: string | null
          coi_url: string | null
          collection_point_address: string | null
          collection_point_lead_farmer_id: string | null
          commission_rate: number | null
          country: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_days: string[] | null
          delivery_schedule: string[] | null
          driver_license_url: string | null
          email: string
          farm_name: string | null
          farm_size: string | null
          full_name: string | null
          id: string
          insurance_url: string | null
          license_number: string | null
          payment_setup_complete: boolean | null
          phone: string | null
          privacy_accepted_at: string | null
          produce_types: string | null
          push_subscription: Json | null
          referral_code: string | null
          rejected_reason: string | null
          state: string | null
          street_address: string | null
          stripe_charges_enabled: boolean | null
          stripe_connect_account_id: string | null
          stripe_onboarding_complete: boolean | null
          stripe_payouts_enabled: boolean | null
          tax_address: string | null
          tax_id_encrypted: string | null
          tax_id_type: string | null
          tax_name: string | null
          terms_accepted_at: string | null
          updated_at: string | null
          vehicle_make: string | null
          vehicle_type: string | null
          vehicle_year: string | null
          w9_submitted_at: string | null
          zip_code: string | null
        }
        Insert: {
          acquisition_channel?: string | null
          additional_info?: string | null
          address_line_2?: string | null
          applied_role?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          city?: string | null
          coi_url?: string | null
          collection_point_address?: string | null
          collection_point_lead_farmer_id?: string | null
          commission_rate?: number | null
          country?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_days?: string[] | null
          delivery_schedule?: string[] | null
          driver_license_url?: string | null
          email: string
          farm_name?: string | null
          farm_size?: string | null
          full_name?: string | null
          id: string
          insurance_url?: string | null
          license_number?: string | null
          payment_setup_complete?: boolean | null
          phone?: string | null
          privacy_accepted_at?: string | null
          produce_types?: string | null
          push_subscription?: Json | null
          referral_code?: string | null
          rejected_reason?: string | null
          state?: string | null
          street_address?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_connect_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tax_address?: string | null
          tax_id_encrypted?: string | null
          tax_id_type?: string | null
          tax_name?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          w9_submitted_at?: string | null
          zip_code?: string | null
        }
        Update: {
          acquisition_channel?: string | null
          additional_info?: string | null
          address_line_2?: string | null
          applied_role?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          city?: string | null
          coi_url?: string | null
          collection_point_address?: string | null
          collection_point_lead_farmer_id?: string | null
          commission_rate?: number | null
          country?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_days?: string[] | null
          delivery_schedule?: string[] | null
          driver_license_url?: string | null
          email?: string
          farm_name?: string | null
          farm_size?: string | null
          full_name?: string | null
          id?: string
          insurance_url?: string | null
          license_number?: string | null
          payment_setup_complete?: boolean | null
          phone?: string | null
          privacy_accepted_at?: string | null
          produce_types?: string | null
          push_subscription?: Json | null
          referral_code?: string | null
          rejected_reason?: string | null
          state?: string | null
          street_address?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_connect_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tax_address?: string | null
          tax_id_encrypted?: string | null
          tax_id_type?: string | null
          tax_name?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
          w9_submitted_at?: string | null
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
      rate_limits: {
        Row: {
          created_at: string | null
          id: string
          key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          credit_amount: number
          credited_at: string | null
          id: string
          referee_first_order_id: string | null
          referee_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          credit_amount?: number
          credited_at?: string | null
          id?: string
          referee_first_order_id?: string | null
          referee_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          credit_amount?: number
          credited_at?: string | null
          id?: string
          referee_first_order_id?: string | null
          referee_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
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
      saved_carts: {
        Row: {
          consumer_id: string
          created_at: string
          id: string
          items: Json
          name: string
          updated_at: string
        }
        Insert: {
          consumer_id: string
          created_at?: string
          id?: string
          items: Json
          name: string
          updated_at?: string
        }
        Update: {
          consumer_id?: string
          created_at?: string
          id?: string
          items?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_carts_consumer_id_fkey"
            columns: ["consumer_id"]
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
      stripe_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          consumer_id: string
          created_at: string
          credits_earned: number
          current_period_end: string | null
          current_period_start: string | null
          id: string
          monthly_spend: number
          monthly_spend_period: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          consumer_id: string
          created_at?: string
          credits_earned?: number
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_spend?: number
          monthly_spend_period?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          consumer_id?: string
          created_at?: string
          credits_earned?: number
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_spend?: number
          monthly_spend_period?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
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
      driver_batch_stops: {
        Row: {
          actual_arrival: string | null
          address: string | null
          address_visible_at: string | null
          city: string | null
          created_at: string | null
          delivery_batch_id: string | null
          estimated_arrival: string | null
          geojson: Json | null
          id: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          order_id: string | null
          sequence_number: number | null
          state: string | null
          status: string | null
          street_address: string | null
          zip_code: string | null
        }
        Insert: {
          actual_arrival?: string | null
          address?: never
          address_visible_at?: string | null
          city?: never
          created_at?: string | null
          delivery_batch_id?: string | null
          estimated_arrival?: string | null
          geojson?: Json | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string | null
          sequence_number?: number | null
          state?: never
          status?: string | null
          street_address?: never
          zip_code?: string | null
        }
        Update: {
          actual_arrival?: string | null
          address?: never
          address_visible_at?: string | null
          city?: never
          created_at?: string | null
          delivery_batch_id?: string | null
          estimated_arrival?: string | null
          geojson?: Json | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string | null
          sequence_number?: number | null
          state?: never
          status?: string | null
          street_address?: never
          zip_code?: string | null
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
      driver_batch_stops_secure: {
        Row: {
          actual_arrival: string | null
          address: string | null
          address_visible_at: string | null
          city: string | null
          created_at: string | null
          delivery_batch_id: string | null
          estimated_arrival: string | null
          geojson: Json | null
          id: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          order_id: string | null
          sequence_number: number | null
          state: string | null
          status: string | null
          street_address: string | null
          zip_code: string | null
        }
        Insert: {
          actual_arrival?: string | null
          address?: never
          address_visible_at?: string | null
          city?: never
          created_at?: string | null
          delivery_batch_id?: string | null
          estimated_arrival?: string | null
          geojson?: Json | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string | null
          sequence_number?: number | null
          state?: never
          status?: string | null
          street_address?: never
          zip_code?: never
        }
        Update: {
          actual_arrival?: string | null
          address?: never
          address_visible_at?: string | null
          city?: never
          created_at?: string | null
          delivery_batch_id?: string | null
          estimated_arrival?: string | null
          geojson?: Json | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string | null
          sequence_number?: number | null
          state?: never
          status?: string | null
          street_address?: never
          zip_code?: never
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
    }
    Functions: {
      cleanup_expired_invitations: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      generate_box_code: {
        Args: { p_batch_id: string; p_stop_sequence: number }
        Returns: string
      }
      generate_referral_code: { Args: never; Returns: string }
      get_consumer_address: {
        Args: { _consumer_id: string; _delivery_batch_id?: string }
        Returns: {
          city: string
          full_name: string
          phone: string
          state: string
          street_address: string
          zip_code: string
        }[]
      }
      get_driver_rating: { Args: { p_driver_id: string }; Returns: number }
      get_farm_rating: { Args: { p_farm_profile_id: string }; Returns: number }
      get_product_rating: { Args: { p_product_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          _action_type: string
          _new_value?: Json
          _old_value?: Json
          _target_resource_id?: string
          _target_resource_type?: string
          _target_user_id?: string
        }
        Returns: undefined
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
