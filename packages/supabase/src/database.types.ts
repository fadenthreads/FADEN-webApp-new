export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_session_integrations: {
        Row: {
          appointment_id: string
          arrival_instructions: string | null
          created_at: string
          expires_at: string | null
          latitude: number | null
          longitude: number | null
          provider: string
          provider_room_name: string | null
          provider_room_url: string | null
          provisioned_at: string | null
          state: string
          updated_at: string
          venue_snapshot: Json | null
        }
        Insert: {
          appointment_id: string
          arrival_instructions?: string | null
          created_at?: string
          expires_at?: string | null
          latitude?: number | null
          longitude?: number | null
          provider: string
          provider_room_name?: string | null
          provider_room_url?: string | null
          provisioned_at?: string | null
          state?: string
          updated_at?: string
          venue_snapshot?: Json | null
        }
        Update: {
          appointment_id?: string
          arrival_instructions?: string | null
          created_at?: string
          expires_at?: string | null
          latitude?: number | null
          longitude?: number | null
          provider?: string
          provider_room_name?: string | null
          provider_room_url?: string | null
          provisioned_at?: string | null
          state?: string
          updated_at?: string
          venue_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_session_integrations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "measurement_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slots: {
        Row: {
          boutique_id: string
          ends_at: string
          id: string
          kind: string
          location: string
          owner_id: string
          starts_at: string
          state: string
        }
        Insert: {
          boutique_id: string
          ends_at: string
          id: string
          kind: string
          location?: string
          owner_id: string
          starts_at: string
          state?: string
        }
        Update: {
          boutique_id?: string
          ends_at?: string
          id?: string
          kind?: string
          location?: string
          owner_id?: string
          starts_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      atelier_request_notes: {
        Row: {
          notes: string
          share_id: string
          updated_at: string
        }
        Insert: {
          notes: string
          share_id: string
          updated_at?: string
        }
        Update: {
          notes?: string
          share_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atelier_request_notes_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: true
            referencedRelation: "request_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_hash: string | null
          metadata: Json
          reason: string | null
          request_id: string | null
          user_agent_summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip_hash?: string | null
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          user_agent_summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip_hash?: string | null
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          user_agent_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boutique_invitations: {
        Row: {
          boutique_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          boutique_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          boutique_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "boutique_invitations_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutique_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boutique_members: {
        Row: {
          boutique_id: string
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          boutique_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          boutique_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boutique_members_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutique_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boutique_offers: {
        Row: {
          boutique_id: string
          created_at: string
          customer_id: string
          id: string
          quote: Json
          request_id: string
          sent_at: string | null
          share_id: string
          status: string
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          updated_at: string
          version: number
        }
        Insert: {
          boutique_id: string
          created_at?: string
          customer_id: string
          id?: string
          quote?: Json
          request_id: string
          sent_at?: string | null
          share_id: string
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          total_paise?: number
          updated_at?: string
          version?: number
        }
        Update: {
          boutique_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          quote?: Json
          request_id?: string
          sent_at?: string | null
          share_id?: string
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          total_paise?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "boutique_offers_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutique_offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutique_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "outfit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutique_offers_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: true
            referencedRelation: "request_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      boutique_profiles: {
        Row: {
          boutique_id: string
          created_at: string
          hero_image_url: string | null
          lead_time_max_weeks: number | null
          lead_time_min_weeks: number | null
          logo_url: string | null
          minimum_price_paise: number | null
          next_available_date: string | null
          rating: number
          response_time_hours: number | null
          review_count: number
          services: string[]
          specialties: string[]
          story: string | null
          story_image_url: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          boutique_id: string
          created_at?: string
          hero_image_url?: string | null
          lead_time_max_weeks?: number | null
          lead_time_min_weeks?: number | null
          logo_url?: string | null
          minimum_price_paise?: number | null
          next_available_date?: string | null
          rating?: number
          response_time_hours?: number | null
          review_count?: number
          services?: string[]
          specialties?: string[]
          story?: string | null
          story_image_url?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          boutique_id?: string
          created_at?: string
          hero_image_url?: string | null
          lead_time_max_weeks?: number | null
          lead_time_min_weeks?: number | null
          logo_url?: string | null
          minimum_price_paise?: number | null
          next_available_date?: string | null
          rating?: number
          response_time_hours?: number | null
          review_count?: number
          services?: string[]
          specialties?: string[]
          story?: string | null
          story_image_url?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "boutique_profiles_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: true
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
        ]
      }
      boutiques: {
        Row: {
          city: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          owner_id: string | null
          slug: string
          status: Database["public"]["Enums"]["boutique_status"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          owner_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["boutique_status"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          owner_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["boutique_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boutiques_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          accepted_at: string
          accepted_offer_version: number
          advance_paise: number
          boutique_id: string
          boutique_name: string
          boutique_owner_id: string
          cancelled_at: string | null
          consent_version: string
          currency: string
          customer_id: string
          id: string
          offer_id: string
          quote: Json
          request_id: string
          share_id: string
          status: string
          subtotal_paise: number
          tax_paise: number
          test_paid_at: string | null
          total_paise: number
        }
        Insert: {
          accepted_at?: string
          accepted_offer_version: number
          advance_paise: number
          boutique_id: string
          boutique_name: string
          boutique_owner_id: string
          cancelled_at?: string | null
          consent_version?: string
          currency?: string
          customer_id: string
          id?: string
          offer_id: string
          quote: Json
          request_id: string
          share_id: string
          status?: string
          subtotal_paise: number
          tax_paise: number
          test_paid_at?: string | null
          total_paise: number
        }
        Update: {
          accepted_at?: string
          accepted_offer_version?: number
          advance_paise?: number
          boutique_id?: string
          boutique_name?: string
          boutique_owner_id?: string
          cancelled_at?: string | null
          consent_version?: string
          currency?: string
          customer_id?: string
          id?: string
          offer_id?: string
          quote?: Json
          request_id?: string
          share_id?: string
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          test_paid_at?: string | null
          total_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_boutique_owner_id_fkey"
            columns: ["boutique_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "boutique_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "outfit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "request_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      designs: {
        Row: {
          base_price_paise: number
          boutique_id: string
          created_at: string
          currency: string
          customizable_elements: string[]
          description: string | null
          gallery_image_urls: string[]
          id: string
          is_featured: boolean
          lead_time_max_weeks: number
          lead_time_min_weeks: number
          materials: string[]
          occasions: string[]
          primary_image_url: string
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["catalog_status"]
          tags: string[]
          techniques: string[]
          title: string
          updated_at: string
        }
        Insert: {
          base_price_paise: number
          boutique_id: string
          created_at?: string
          currency?: string
          customizable_elements?: string[]
          description?: string | null
          gallery_image_urls?: string[]
          id?: string
          is_featured?: boolean
          lead_time_max_weeks: number
          lead_time_min_weeks: number
          materials?: string[]
          occasions?: string[]
          primary_image_url: string
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["catalog_status"]
          tags?: string[]
          techniques?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          base_price_paise?: number
          boutique_id?: string
          created_at?: string
          currency?: string
          customizable_elements?: string[]
          description?: string | null
          gallery_image_urls?: string[]
          id?: string
          is_featured?: boolean
          lead_time_max_weeks?: number
          lead_time_min_weeks?: number
          materials?: string[]
          occasions?: string[]
          primary_image_url?: string
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["catalog_status"]
          tags?: string[]
          techniques?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designs_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_appointments: {
        Row: {
          boutique_id: string
          cancelled_at: string | null
          created_at: string
          customer_id: string
          ends_at: string
          follow_up_of: string | null
          id: string
          kind: string
          location: string
          mode: string
          order_id: string
          outcome_at: string | null
          outcome_by: string | null
          owner_id: string
          previous_id: string | null
          slot_id: string
          starts_at: string
          status: string
        }
        Insert: {
          boutique_id: string
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          ends_at: string
          follow_up_of?: string | null
          id: string
          kind: string
          location: string
          mode?: string
          order_id: string
          outcome_at?: string | null
          outcome_by?: string | null
          owner_id: string
          previous_id?: string | null
          slot_id: string
          starts_at: string
          status?: string
        }
        Update: {
          boutique_id?: string
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          ends_at?: string
          follow_up_of?: string | null
          id?: string
          kind?: string
          location?: string
          mode?: string
          order_id?: string
          outcome_at?: string | null
          outcome_by?: string | null
          owner_id?: string
          previous_id?: string | null
          slot_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_appointments_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_appointments_follow_up_of_fkey"
            columns: ["follow_up_of"]
            isOneToOne: false
            referencedRelation: "measurement_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_appointments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_appointments_outcome_by_fkey"
            columns: ["outcome_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_appointments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_appointments_previous_id_fkey"
            columns: ["previous_id"]
            isOneToOne: false
            referencedRelation: "measurement_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_appointments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "appointment_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_profiles: {
        Row: {
          measurements: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          measurements: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          measurements?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_aftercare_events: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          item_id: string
          note: string
          status: string
          version: number
        }
        Insert: {
          actor_id: string
          created_at?: string
          id: string
          item_id: string
          note: string
          status: string
          version: number
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          item_id?: string
          note?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_aftercare_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_aftercare_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "order_aftercare_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_aftercare_items: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          mode: string
          order_id: string
          rating: number | null
          status: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          id: string
          kind: string
          mode?: string
          order_id: string
          rating?: number | null
          status: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          mode?: string
          order_id?: string
          rating?: number | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_aftercare_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_confirmations: {
        Row: {
          confirmed_at: string
          customer_id: string
          mode: string
          order_id: string
          shipment_event_id: string
        }
        Insert: {
          confirmed_at?: string
          customer_id: string
          mode?: string
          order_id: string
          shipment_event_id: string
        }
        Update: {
          confirmed_at?: string
          customer_id?: string
          mode?: string
          order_id?: string
          shipment_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_confirmations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_confirmations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_confirmations_shipment_event_id_fkey"
            columns: ["shipment_event_id"]
            isOneToOne: false
            referencedRelation: "order_shipment_events"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_details: {
        Row: {
          address: Json
          confirmed_at: string
          last_command_id: string
          mode: string
          order_id: string
          revision: number
          verification: string
        }
        Insert: {
          address: Json
          confirmed_at?: string
          last_command_id: string
          mode?: string
          order_id: string
          revision: number
          verification?: string
        }
        Update: {
          address?: Json
          confirmed_at?: string
          last_command_id?: string
          mode?: string
          order_id?: string
          revision?: number
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_design_reviews: {
        Row: {
          created_at: string
          designer_note: string
          detailing: string
          fabric: string
          feedback: string
          id: string
          inspiration: string
          order_id: string
          reviewed_at: string | null
          revision: number
          sketch_path: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          designer_note: string
          detailing: string
          fabric: string
          feedback?: string
          id?: string
          inspiration: string
          order_id: string
          reviewed_at?: string | null
          revision: number
          sketch_path: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          designer_note?: string
          detailing?: string
          fabric?: string
          feedback?: string
          id?: string
          inspiration?: string
          order_id?: string
          reviewed_at?: string | null
          revision?: number
          sketch_path?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_design_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_message_reads: {
        Row: {
          last_sequence: number
          order_id: string
          reader_id: string
        }
        Insert: {
          last_sequence: number
          order_id: string
          reader_id: string
        }
        Update: {
          last_sequence?: number
          order_id?: string
          reader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_message_reads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_message_reads_reader_id_fkey"
            columns: ["reader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
          sequence: number
        }
        Insert: {
          body: string
          created_at?: string
          id: string
          order_id: string
          sender_id: string
          sequence: number
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment_attempts: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          customer_id: string
          id: string
          key_id: string
          mode: string
          order_id: string
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          key_id: string
          mode?: string
          order_id: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          verified_at?: string | null
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          key_id?: string
          mode?: string
          order_id?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_attempts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_production_updates: {
        Row: {
          created_at: string
          id: string
          mode: string
          note: string
          order_id: string
          photo_path: string | null
          sequence: number
          stage: number
        }
        Insert: {
          created_at?: string
          id: string
          mode?: string
          note: string
          order_id: string
          photo_path?: string | null
          sequence: number
          stage: number
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          note?: string
          order_id?: string
          photo_path?: string | null
          sequence?: number
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_production_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipment_events: {
        Row: {
          address_revision: number
          created_at: string
          id: string
          mode: string
          note: string
          order_id: string
          sequence: number
          stage: number
        }
        Insert: {
          address_revision: number
          created_at?: string
          id: string
          mode?: string
          note: string
          order_id: string
          sequence: number
          stage: number
        }
        Update: {
          address_revision?: number
          created_at?: string
          id?: string
          mode?: string
          note?: string
          order_id?: string
          sequence?: number
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_shipment_events_order_id_address_revision_fkey"
            columns: ["order_id", "address_revision"]
            isOneToOne: false
            referencedRelation: "order_delivery_details"
            referencedColumns: ["order_id", "revision"]
          },
          {
            foreignKeyName: "order_shipment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipments: {
        Row: {
          address_revision: number
          awb_code: string | null
          booked_at: string | null
          courier_id: string | null
          courier_name: string | null
          created_at: string
          id: string
          label_url: string | null
          manifest_url: string | null
          order_id: string
          provider: string
          provider_order_id: string | null
          provider_shipment_id: string | null
          status: string
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          address_revision: number
          awb_code?: string | null
          booked_at?: string | null
          courier_id?: string | null
          courier_name?: string | null
          created_at?: string
          id?: string
          label_url?: string | null
          manifest_url?: string | null
          order_id: string
          provider: string
          provider_order_id?: string | null
          provider_shipment_id?: string | null
          status?: string
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          address_revision?: number
          awb_code?: string | null
          booked_at?: string | null
          courier_id?: string | null
          courier_name?: string | null
          created_at?: string
          id?: string
          label_url?: string | null
          manifest_url?: string | null
          order_id?: string
          provider?: string
          provider_order_id?: string | null
          provider_shipment_id?: string | null
          status?: string
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipments_order_id_address_revision_fkey"
            columns: ["order_id", "address_revision"]
            isOneToOne: false
            referencedRelation: "order_delivery_details"
            referencedColumns: ["order_id", "revision"]
          },
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          id: number
          last_error: string | null
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type: string
          id?: never
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          id?: never
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: []
      }
      outfit_requests: {
        Row: {
          boutique_id: string | null
          created_at: string
          design_id: string | null
          draft: Json
          id: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          boutique_id?: string | null
          created_at?: string
          design_id?: string | null
          draft?: Json
          id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          boutique_id?: string | null
          created_at?: string
          design_id?: string | null
          draft?: Json
          id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "outfit_requests_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_requests_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      request_shares: {
        Row: {
          boutique_id: string
          brief: Json
          client_label: string
          created_at: string
          customer_id: string
          id: string
          include_inspiration: boolean
          include_measurements: boolean
          request_id: string
          revoked_at: string | null
        }
        Insert: {
          boutique_id: string
          brief: Json
          client_label: string
          created_at?: string
          customer_id: string
          id?: string
          include_inspiration?: boolean
          include_measurements?: boolean
          request_id: string
          revoked_at?: string | null
        }
        Update: {
          boutique_id?: string
          brief?: Json
          client_label?: string
          created_at?: string
          customer_id?: string
          id?: string
          include_inspiration?: boolean
          include_measurements?: boolean
          request_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_shares_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_shares_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_shares_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "outfit_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_boutiques: {
        Row: {
          boutique_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          boutique_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          boutique_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_boutiques_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_boutiques_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_designs: {
        Row: {
          created_at: string
          design_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          design_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          design_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_designs_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_designs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_tracking_events: {
        Row: {
          id: number
          label: string
          location: string | null
          occurred_at: string
          provider_event_id: string
          received_at: string
          shipment_id: string
          status: string
        }
        Insert: {
          id?: never
          label: string
          location?: string | null
          occurred_at: string
          provider_event_id: string
          received_at?: string
          shipment_id: string
          status: string
        }
        Update: {
          id?: never
          label?: string
          location?: string | null
          occurred_at?: string
          provider_event_id?: string
          received_at?: string
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "order_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_commands: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          operation: string
          order_id: string
          provider_reference: string | null
          request_key: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id: string
          last_error?: string | null
          operation: string
          order_id: string
          provider_reference?: string | null
          request_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          operation?: string
          order_id?: string
          provider_reference?: string | null
          request_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_commands_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_addresses: {
        Row: {
          city: string
          country_code: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          line1: string
          line2: string | null
          longitude: number | null
          phone: string | null
          postal_code: string
          recipient_name: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country_code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          line1: string
          line2?: string | null
          longitude?: number | null
          phone?: string | null
          postal_code: string
          recipient_name: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          line1?: string
          line2?: string | null
          longitude?: number | null
          phone?: string | null
          postal_code?: string
          recipient_name?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          currency: string
          email_marketing: boolean
          email_transactional: boolean
          locale: string
          sms_transactional: boolean
          updated_at: string
          user_id: string
          whatsapp_updates: boolean
        }
        Insert: {
          created_at?: string
          currency?: string
          email_marketing?: boolean
          email_transactional?: boolean
          locale?: string
          sms_transactional?: boolean
          updated_at?: string
          user_id: string
          whatsapp_updates?: boolean
        }
        Update: {
          created_at?: string
          currency?: string
          email_marketing?: boolean
          email_transactional?: boolean
          locale?: string
          sms_transactional?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_updates?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      order_production_summary: {
        Row: {
          created_at: string | null
          order_id: string | null
          sequence: number | null
          stage: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_production_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_boutique_offer: {
        Args: {
          confirmed: boolean
          expected_version: number
          target_offer: string
        }
        Returns: string
      }
      admin_set_user_role: {
        Args: {
          change_reason: string
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      append_audit_event: {
        Args: {
          p_action: string
          p_actor_id?: string
          p_actor_role?: Database["public"]["Enums"]["app_role"]
          p_after_json?: Json
          p_before_json?: Json
          p_entity_id?: string
          p_entity_type: string
          p_ip_hash?: string
          p_metadata?: Json
          p_reason?: string
          p_request_id?: string
          p_user_agent_summary?: string
        }
        Returns: number
      }
      attach_test_gateway_order: {
        Args: { amount: number; gateway_order: string; target_attempt: string }
        Returns: undefined
      }
      can_read_order_file: { Args: { object_name: string }; Returns: boolean }
      can_read_request_inspiration: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_read_verification_document: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_write_order_file: { Args: { object_name: string }; Returns: boolean }
      can_write_portfolio_image: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_write_request_inspiration: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_write_verification_document: {
        Args: { object_name: string }
        Returns: boolean
      }
      cancel_measurement_appointment: {
        Args: { confirmed: boolean; target_appointment: string }
        Returns: string
      }
      cancel_unpaid_order: {
        Args: { confirmed: boolean; target_order: string }
        Returns: string
      }
      close_boutique_offer: {
        Args: { action: string; expected_version: number; target_offer: string }
        Returns: undefined
      }
      confirm_delivery_rehearsal: {
        Args: {
          confirmed: boolean
          expected_event: string
          target_order: string
        }
        Returns: string
      }
      create_appointment_slot: {
        Args: {
          ends: string
          session_kind: string
          session_location: string
          slot_id: string
          starts: string
          target_boutique: string
        }
        Returns: string
      }
      create_boutique_application: {
        Args: {
          boutique_city: string
          boutique_description?: string
          boutique_name: string
          boutique_slug: string
        }
        Returns: string
      }
      decide_order_design: {
        Args: {
          confirmed: boolean
          customer_feedback: string
          decision: string
          target_review: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_aal2: { Args: never; Returns: boolean }
      is_boutique_member: {
        Args: { target_boutique_id: string }
        Returns: boolean
      }
      mark_order_messages_read: {
        Args: { target_order: string; through_sequence: number }
        Returns: undefined
      }
      normalize_audit_request_id: { Args: { input: string }; Returns: string }
      normalize_audit_user_agent: { Args: { input: string }; Returns: string }
      owns_verified_atelier: { Args: { boutique: string }; Returns: boolean }
      publish_order_design: {
        Args: {
          expected_revision: number
          proposal: Json
          target_order: string
        }
        Returns: string
      }
      record_appointment_outcome: {
        Args: {
          confirmed: boolean
          session_outcome: string
          target_appointment: string
        }
        Returns: string
      }
      record_audit_event: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type: string
          p_ip_hash?: string
          p_reason?: string
          p_request_id?: string
          p_user_agent_summary?: string
        }
        Returns: number
      }
      record_production_update: {
        Args: {
          command_id: string
          confirmed: boolean
          expected_sequence: number
          photo: string
          progress_note: string
          target_order: string
          target_stage: number
        }
        Returns: string
      }
      record_shipment_rehearsal: {
        Args: {
          command_id: string
          confirmed: boolean
          expected_sequence: number
          progress_note: string
          target_order: string
          target_stage: number
        }
        Returns: string
      }
      record_test_capture: {
        Args: {
          amount: number
          gateway_order: string
          gateway_payment: string
          payment_currency: string
          target_attempt: string
        }
        Returns: string
      }
      reserve_measurement_appointment: {
        Args: {
          command_id: string
          confirmed: boolean
          replacing: string
          target_order: string
          target_slot: string
        }
        Returns: string
      }
      reserve_test_payment: {
        Args: { actor: string; public_key_id: string; target_order: string }
        Returns: Json
      }
      revoke_request_share: {
        Args: { target_share: string }
        Returns: undefined
      }
      sanitize_audit_json: { Args: { input: Json }; Returns: Json }
      save_boutique_offer: {
        Args: {
          expected_version: number
          proposal: Json
          send_now: boolean
          target_share: string
        }
        Returns: string
      }
      save_order_delivery_details: {
        Args: {
          command_id: string
          confirmed: boolean
          details: Json
          expected_revision: number
          target_order: string
        }
        Returns: number
      }
      send_order_message: {
        Args: { command_id: string; message_body: string; target_order: string }
        Returns: string
      }
      share_outfit_request: {
        Args: {
          confirmed: boolean
          inspiration_allowed: boolean
          measurements_allowed: boolean
          target_boutique: string
          target_request: string
        }
        Returns: string
      }
      submit_aftercare_rehearsal: {
        Args: {
          command_id: string
          confirmed: boolean
          customer_note: string
          item_kind: string
          stars: number
          target_order: string
        }
        Returns: string
      }
      submit_outfit_request: {
        Args: { expected_version: number; request_id: string }
        Returns: string
      }
      update_aftercare_rehearsal: {
        Args: {
          command_id: string
          confirmed: boolean
          expected_version: number
          next_status: string
          response_note: string
          target_item: string
        }
        Returns: string
      }
      withdraw_appointment_slot: {
        Args: { target_slot: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "customer" | "boutique_owner" | "boutique_staff" | "admin"
      boutique_status:
        | "draft"
        | "pending_verification"
        | "verified"
        | "suspended"
        | "rejected"
      catalog_status: "draft" | "published" | "archived"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      job_status: "pending" | "processing" | "completed" | "failed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["customer", "boutique_owner", "boutique_staff", "admin"],
      boutique_status: [
        "draft",
        "pending_verification",
        "verified",
        "suspended",
        "rejected",
      ],
      catalog_status: ["draft", "published", "archived"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      job_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const

