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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_controls: {
        Row: {
          banned: boolean
          daily_limit: number | null
          pro_granted: boolean
          pro_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banned?: boolean
          daily_limit?: number | null
          pro_granted?: boolean
          pro_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banned?: boolean
          daily_limit?: number | null
          pro_granted?: boolean
          pro_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_key: string
          account_label: string
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          credential_kind: string
          enabled: boolean
          id: string
          reconnect_required: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_key?: string
          account_label?: string
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          credential_kind?: string
          enabled?: boolean
          id?: string
          reconnect_required?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_key?: string
          account_label?: string
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          credential_kind?: string
          enabled?: boolean
          id?: string
          reconnect_required?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_shares: {
        Row: {
          created_at: string
          id: string
          messages: Json
          revoked_at: string | null
          thread_id: string | null
          title: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages: Json
          revoked_at?: string | null
          thread_id?: string | null
          title: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          revoked_at?: string | null
          thread_id?: string | null
          title?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_shares_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          ui_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          thread_id: string
          ui_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          ui_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      oxford_memory_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          kind: string
          note: string | null
          published: boolean
          published_at: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          note?: string | null
          published?: boolean
          published_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          note?: string | null
          published?: boolean
          published_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_actions: {
        Row: {
          connector_id: string
          created_at: string
          id: string
          operation: string
          payload: Json
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connector_id: string
          created_at?: string
          id?: string
          operation: string
          payload: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connector_id?: string
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_daily: {
        Row: {
          count: number
          day: string
          user_id: string
        }
        Insert: {
          count?: number
          day?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bot_registry: {
        Row: {
          entries: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          entries?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          entries?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wechat_kf_accounts: {
        Row: {
          aes_key_ciphertext: string
          bot_name: string
          bot_prompt: string
          corp_id: string
          created_at: string
          cursor: string
          enabled: boolean
          id: string
          label: string
          open_kfid: string
          secret_ciphertext: string
          token_ciphertext: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aes_key_ciphertext: string
          bot_name?: string
          bot_prompt?: string
          corp_id: string
          created_at?: string
          cursor?: string
          enabled?: boolean
          id?: string
          label?: string
          open_kfid?: string
          secret_ciphertext: string
          token_ciphertext: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aes_key_ciphertext?: string
          bot_name?: string
          bot_prompt?: string
          corp_id?: string
          created_at?: string
          cursor?: string
          enabled?: boolean
          id?: string
          label?: string
          open_kfid?: string
          secret_ciphertext?: string
          token_ciphertext?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_daily_message: {
        Args: { check_env: string; free_limit: number; pro_limit: number }
        Returns: Json
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      read_conversation_share: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          messages: Json
          title: string
        }[]
      }
      thread_previews: {
        Args: { p_thread_ids: string[] }
        Returns: {
          preview: string
          role: string
          thread_id: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
