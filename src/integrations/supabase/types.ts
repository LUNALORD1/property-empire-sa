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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_key: string
          id: string
          player_id: string
          unlocked_at: string
        }
        Insert: {
          badge_key: string
          id?: string
          player_id: string
          unlocked_at?: string
        }
        Update: {
          badge_key?: string
          id?: string
          player_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistants: {
        Row: {
          active: boolean
          hired_at: string
          id: string
          monthly_cost: number
          player_id: string
          points_added: number
        }
        Insert: {
          active?: boolean
          hired_at?: string
          id?: string
          monthly_cost?: number
          player_id: string
          points_added?: number
        }
        Update: {
          active?: boolean
          hired_at?: string
          id?: string
          monthly_cost?: number
          player_id?: string
          points_added?: number
        }
        Relationships: [
          {
            foreignKeyName: "assistants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          annual_appreciation_pct: number
          created_at: string
          daily_price_modifier: number
          id: string
          latitude: number
          longitude: number
          modifier_updated_on: string | null
          momentum_score: number
          name: string
          weather_label: string
          weather_multiplier: number
        }
        Insert: {
          annual_appreciation_pct?: number
          created_at?: string
          daily_price_modifier?: number
          id?: string
          latitude: number
          longitude: number
          modifier_updated_on?: string | null
          momentum_score?: number
          name: string
          weather_label?: string
          weather_multiplier?: number
        }
        Update: {
          annual_appreciation_pct?: number
          created_at?: string
          daily_price_modifier?: number
          id?: string
          latitude?: number
          longitude?: number
          modifier_updated_on?: string | null
          momentum_score?: number
          name?: string
          weather_label?: string
          weather_multiplier?: number
        }
        Relationships: []
      }
      daily_ticks: {
        Row: {
          created_at: string
          id: string
          loan_paid: number
          maintenance_paid: number
          net_cashflow: number
          player_id: string
          rent_collected: number
          summary: Json | null
          tick_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          loan_paid?: number
          maintenance_paid?: number
          net_cashflow?: number
          player_id: string
          rent_collected?: number
          summary?: Json | null
          tick_date: string
        }
        Update: {
          created_at?: string
          id?: string
          loan_paid?: number
          maintenance_paid?: number
          net_cashflow?: number
          player_id?: string
          rent_collected?: number
          summary?: Json | null
          tick_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_ticks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      leaderboard_snapshots: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          net_worth: number
          player_id: string
          properties_count: number
          rank: number
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          net_worth?: number
          player_id: string
          properties_count?: number
          rank: number
          snapshot_date: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          net_worth?: number
          player_id?: string
          properties_count?: number
          rank?: number
          snapshot_date?: string
        }
        Relationships: []
      }
      ledger: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          player_id: string
          property_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          player_id: string
          property_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          player_id?: string
          property_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          active: boolean
          balance: number
          id: string
          interest_rate: number
          ltv: number
          monthly_payment: number
          player_id: string
          player_property_id: string
          principal: number
          started_at: string
          term_months: number
        }
        Insert: {
          active?: boolean
          balance: number
          id?: string
          interest_rate: number
          ltv: number
          monthly_payment: number
          player_id: string
          player_property_id: string
          principal: number
          started_at?: string
          term_months?: number
        }
        Update: {
          active?: boolean
          balance?: number
          id?: string
          interest_rate?: number
          ltv?: number
          monthly_payment?: number
          player_id?: string
          player_property_id?: string
          principal?: number
          started_at?: string
          term_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "loans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_player_property_id_fkey"
            columns: ["player_property_id"]
            isOneToOne: false
            referencedRelation: "player_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      luck_events: {
        Row: {
          acknowledged: boolean
          amount: number | null
          created_at: string
          description: string | null
          event_key: string
          id: string
          payload: Json | null
          player_id: string
          title: string
        }
        Insert: {
          acknowledged?: boolean
          amount?: number | null
          created_at?: string
          description?: string | null
          event_key: string
          id?: string
          payload?: Json | null
          player_id: string
          title: string
        }
        Update: {
          acknowledged?: boolean
          amount?: number | null
          created_at?: string
          description?: string | null
          event_key?: string
          id?: string
          payload?: Json | null
          player_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "luck_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_news: {
        Row: {
          city_id: string | null
          created_at: string
          event_key: string
          headline: string
          id: string
          price_modifier: number
          tick_date: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          event_key: string
          headline: string
          id?: string
          price_modifier: number
          tick_date: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          event_key?: string
          headline?: string
          id?: string
          price_modifier?: number
          tick_date?: string
        }
        Relationships: []
      }
      news_events: {
        Row: {
          city_id: string | null
          created_at: string
          event_key: string
          headline: string
          id: string
          price_modifier: number
          weight: number
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          event_key: string
          headline: string
          id?: string
          price_modifier: number
          weight?: number
        }
        Update: {
          city_id?: string | null
          created_at?: string
          event_key?: string
          headline?: string
          id?: string
          price_modifier?: number
          weight?: number
        }
        Relationships: []
      }
      player_properties: {
        Row: {
          condition_score: number
          current_value: number
          evicting_until: string | null
          id: string
          monthly_maintenance: number
          monthly_rent: number
          player_id: string
          property_id: string
          purchase_price: number
          purchased_at: string
          selling_notice_until: string | null
          status: string
        }
        Insert: {
          condition_score?: number
          current_value: number
          evicting_until?: string | null
          id?: string
          monthly_maintenance: number
          monthly_rent: number
          player_id: string
          property_id: string
          purchase_price: number
          purchased_at?: string
          selling_notice_until?: string | null
          status?: string
        }
        Update: {
          condition_score?: number
          current_value?: number
          evicting_until?: string | null
          id?: string
          monthly_maintenance?: number
          monthly_rent?: number
          player_id?: string
          property_id?: string
          purchase_price?: number
          purchased_at?: string
          selling_notice_until?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_properties_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_points_cap: number
          cash: number
          created_at: string
          display_name: string | null
          game_over: boolean
          game_started_at: string
          id: string
          last_luck_event_date: string | null
          last_tick_date: string | null
          onboarded: boolean
          peak_net_worth: number
          red_zone_started_at: string | null
          total_properties_ever: number
          updated_at: string
        }
        Insert: {
          admin_points_cap?: number
          cash?: number
          created_at?: string
          display_name?: string | null
          game_over?: boolean
          game_started_at?: string
          id: string
          last_luck_event_date?: string | null
          last_tick_date?: string | null
          onboarded?: boolean
          peak_net_worth?: number
          red_zone_started_at?: string | null
          total_properties_ever?: number
          updated_at?: string
        }
        Update: {
          admin_points_cap?: number
          cash?: number
          created_at?: string
          display_name?: string | null
          game_over?: boolean
          game_started_at?: string
          id?: string
          last_luck_event_date?: string | null
          last_tick_date?: string | null
          onboarded?: boolean
          peak_net_worth?: number
          red_zone_started_at?: string | null
          total_properties_ever?: number
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          bathrooms: number
          bedrooms: number
          city_id: string
          created_at: string
          demand_tier: string
          external_id: string | null
          id: string
          is_coastal: boolean
          is_university_suburb: boolean
          latitude: number
          listing_price: number
          longitude: number
          photo_url: string | null
          single_storey: boolean
          status: string
          suburb: string
          suburb_avg_price: number
          suburb_avg_rent: number
        }
        Insert: {
          address: string
          bathrooms?: number
          bedrooms?: number
          city_id: string
          created_at?: string
          demand_tier?: string
          external_id?: string | null
          id?: string
          is_coastal?: boolean
          is_university_suburb?: boolean
          latitude: number
          listing_price: number
          longitude: number
          photo_url?: string | null
          single_storey?: boolean
          status?: string
          suburb: string
          suburb_avg_price: number
          suburb_avg_rent: number
        }
        Update: {
          address?: string
          bathrooms?: number
          bedrooms?: number
          city_id?: string
          created_at?: string
          demand_tier?: string
          external_id?: string | null
          id?: string
          is_coastal?: boolean
          is_university_suburb?: boolean
          latitude?: number
          listing_price?: number
          longitude?: number
          photo_url?: string | null
          single_storey?: boolean
          status?: string
          suburb?: string
          suburb_avg_price?: number
          suburb_avg_rent?: number
        }
        Relationships: [
          {
            foreignKeyName: "properties_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      property_value_history: {
        Row: {
          created_at: string
          id: string
          player_id: string
          player_property_id: string
          recorded_date: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          player_property_id: string
          recorded_date: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          player_property_id?: string
          recorded_date?: string
          value?: number
        }
        Relationships: []
      }
      renter_types: {
        Row: {
          damage_risk: string
          display_name: string
          flavour: string | null
          icon_key: string | null
          key: string
          lease_months: number
          low_demand_only: boolean
          max_beds: number | null
          min_beds: number
          reliability: number
          rent_modifier: number
          single_storey_only: boolean
          university_only: boolean
        }
        Insert: {
          damage_risk: string
          display_name: string
          flavour?: string | null
          icon_key?: string | null
          key: string
          lease_months: number
          low_demand_only?: boolean
          max_beds?: number | null
          min_beds?: number
          reliability: number
          rent_modifier: number
          single_storey_only?: boolean
          university_only?: boolean
        }
        Update: {
          damage_risk?: string
          display_name?: string
          flavour?: string | null
          icon_key?: string | null
          key?: string
          lease_months?: number
          low_demand_only?: boolean
          max_beds?: number | null
          min_beds?: number
          reliability?: number
          rent_modifier?: number
          single_storey_only?: boolean
          university_only?: boolean
        }
        Relationships: []
      }
      tenant_applicants: {
        Row: {
          generated_at: string
          id: string
          offered_rent: number
          player_id: string
          player_property_id: string
          renter_type_key: string
        }
        Insert: {
          generated_at?: string
          id?: string
          offered_rent: number
          player_id: string
          player_property_id: string
          renter_type_key: string
        }
        Update: {
          generated_at?: string
          id?: string
          offered_rent?: number
          player_id?: string
          player_property_id?: string
          renter_type_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_applicants_renter_type_key_fkey"
            columns: ["renter_type_key"]
            isOneToOne: false
            referencedRelation: "renter_types"
            referencedColumns: ["key"]
          },
        ]
      }
      tenants: {
        Row: {
          consecutive_missed_payments: number
          created_at: string
          happiness: number
          id: string
          lease_end: string
          lease_start: string
          monthly_rent: number
          player_id: string
          player_property_id: string
          renter_type_key: string
          status: string
        }
        Insert: {
          consecutive_missed_payments?: number
          created_at?: string
          happiness?: number
          id?: string
          lease_end: string
          lease_start?: string
          monthly_rent: number
          player_id: string
          player_property_id: string
          renter_type_key: string
          status?: string
        }
        Update: {
          consecutive_missed_payments?: number
          created_at?: string
          happiness?: number
          id?: string
          lease_end?: string
          lease_start?: string
          monthly_rent?: number
          player_id?: string
          player_property_id?: string
          renter_type_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_renter_type_key_fkey"
            columns: ["renter_type_key"]
            isOneToOne: false
            referencedRelation: "renter_types"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
