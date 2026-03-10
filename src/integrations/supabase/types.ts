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
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key: string | null
          key_hash: string | null
          key_prefix: string | null
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string | null
          key_hash?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string | null
          key_hash?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_hwids: {
        Row: {
          blocked_by: string | null
          created_at: string
          hwid: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          hwid: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          hwid?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          ip_address: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          ip_address: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          ip_address?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          account_created: boolean | null
          company: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_created?: boolean | null
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_created?: boolean | null
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string | null
          device_name: string | null
          hwid: string
          id: string
          is_active: boolean | null
          last_verified: string | null
          license_id: string | null
          os_info: string | null
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          hwid: string
          id?: string
          is_active?: boolean | null
          last_verified?: string | null
          license_id?: string | null
          os_info?: string | null
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          hwid?: string
          id?: string
          is_active?: boolean | null
          last_verified?: string | null
          license_id?: string | null
          os_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          customer_id: string
          due_date: string | null
          id: string
          invoice_number: string
          license_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_number: string
          license_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          license_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string | null
          customer_id: string | null
          expire_at: string | null
          id: string
          license_key: string
          max_devices: number | null
          notes: string | null
          product_id: string | null
          status: Database["public"]["Enums"]["license_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          expire_at?: string | null
          id?: string
          license_key: string
          max_devices?: number | null
          notes?: string | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["license_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          expire_at?: string | null
          id?: string
          license_key?: string
          max_devices?: number | null
          notes?: string | null
          product_id?: string | null
          status?: Database["public"]["Enums"]["license_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          action: Database["public"]["Enums"]["log_action"]
          created_at: string | null
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["log_action"]
          created_at?: string | null
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["log_action"]
          created_at?: string | null
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          email_subject: string
          id: string
          kill_old_endpoint: boolean
          kill_switch_response: string | null
          notification_days: number[]
          notification_time: string
          telegram_message_template: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          email_subject?: string
          id?: string
          kill_old_endpoint?: boolean
          kill_switch_response?: string | null
          notification_days?: number[]
          notification_time?: string
          telegram_message_template?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          email_subject?: string
          id?: string
          kill_old_endpoint?: boolean
          kill_switch_response?: string | null
          notification_days?: number[]
          notification_time?: string
          telegram_message_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      project_config: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      registration_requests: {
        Row: {
          admin_note: string | null
          amount: number | null
          created_at: string
          email: string
          id: string
          name: string
          receipt_note: string | null
          requested_days: number | null
          status: string
          telegram_chat_id: number
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          email: string
          id?: string
          name: string
          receipt_note?: string | null
          requested_days?: number | null
          status?: string
          telegram_chat_id: number
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          receipt_note?: string | null
          requested_days?: number | null
          status?: string
          telegram_chat_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      renewal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          customer_id: string
          days: number
          id: string
          license_id: string
          receipt_note: string | null
          status: string
          telegram_chat_id: number | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          customer_id: string
          days: number
          id?: string
          license_id: string
          receipt_note?: string | null
          status?: string
          telegram_chat_id?: number | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          customer_id?: string
          days?: number
          id?: string
          license_id?: string
          receipt_note?: string | null
          status?: string
          telegram_chat_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_requests_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      revoked_keys: {
        Row: {
          id: string
          license_key: string
          reason: string | null
          revoked_at: string
        }
        Insert: {
          id?: string
          license_key: string
          reason?: string | null
          revoked_at?: string
        }
        Update: {
          id?: string
          license_key?: string
          reason?: string | null
          revoked_at?: string
        }
        Relationships: []
      }
      rustdesk_ids: {
        Row: {
          created_at: string
          customer_id: string
          device_label: string | null
          id: string
          rustdesk_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          device_label?: string | null
          id?: string
          rustdesk_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          device_label?: string | null
          id?: string
          rustdesk_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rustdesk_ids_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_links: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          latitude: number | null
          location_updated_at: string | null
          longitude: number | null
          telegram_chat_id: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          telegram_chat_id: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          telegram_chat_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_user_states: {
        Row: {
          data: Json | null
          step: string
          telegram_chat_id: number
          updated_at: string
        }
        Insert: {
          data?: Json | null
          step: string
          telegram_chat_id: number
          updated_at?: string
        }
        Update: {
          data?: Json | null
          step?: string
          telegram_chat_id?: number
          updated_at?: string
        }
        Relationships: []
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
      api_keys_safe: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          key_hash: string | null
          key_masked: string | null
          last_used_at: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_hash?: string | null
          key_masked?: never
          last_used_at?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_hash?: string | null
          key_masked?: never
          last_used_at?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_expire_licenses: { Args: never; Returns: number }
      generate_api_key: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_license_key: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_api_key_last_used: {
        Args: { api_key_value: string }
        Returns: undefined
      }
      validate_api_key_by_value: {
        Args: { api_key_value: string }
        Returns: {
          expires_at: string
          is_active: boolean
          key_prefix: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "customer"
      license_status: "active" | "expired" | "suspended" | "pending"
      log_action:
        | "created"
        | "updated"
        | "deleted"
        | "activated"
        | "deactivated"
        | "verified"
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
      app_role: ["admin", "moderator", "user", "customer"],
      license_status: ["active", "expired", "suspended", "pending"],
      log_action: [
        "created",
        "updated",
        "deleted",
        "activated",
        "deactivated",
        "verified",
      ],
    },
  },
} as const
