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
      ads: {
        Row: {
          active: boolean
          body: string
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          link_url: string
          placement: string
          sponsor: string
          starts_at: string | null
          title: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url: string
          placement: string
          sponsor: string
          starts_at?: string | null
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string
          placement?: string
          sponsor?: string
          starts_at?: string | null
          title?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          post_id: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          post_id?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          post_id?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          kind: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          kind?: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content?: string
          conversation_id?: string
          kind?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          city: string
          created_at: string
          description: string
          id: string
          kind: string
          price: string
          title: string
          user_id: string
          vacancies: number
        }
        Insert: {
          city?: string
          created_at?: string
          description?: string
          id?: string
          kind: string
          price?: string
          title: string
          user_id: string
          vacancies?: number
        }
        Update: {
          city?: string
          created_at?: string
          description?: string
          id?: string
          kind?: string
          price?: string
          title?: string
          user_id?: string
          vacancies?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen_at: string
          show_last_seen: boolean
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          show_last_seen?: boolean
          user_id: string
        }
        Update: {
          last_seen_at?: string
          show_last_seen?: boolean
          user_id?: string
        }
        Relationships: []
      }
      engagements: {
        Row: {
          accepted_at: string | null
          cancelled_by: string | null
          client_id: string
          completed_at: string | null
          conversation_id: string
          created_at: string
          id: string
          post_id: string | null
          provider_id: string
          status: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      contact_addresses: {
        Row: {
          care_of: string
          city: string
          id: string
          kind: string
          neighborhood: string
          postal_code: string
          recipient: string
          state: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          care_of?: string
          city: string
          id?: string
          kind: string
          neighborhood?: string
          postal_code: string
          recipient: string
          state: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          care_of?: string
          city?: string
          id?: string
          kind?: string
          neighborhood?: string
          postal_code?: string
          recipient?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_phones: {
        Row: {
          created_at: string
          id: string
          kind: string
          methods: string[]
          number: string
          shared: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          methods?: string[]
          number: string
          shared?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          methods?: string[]
          number?: string
          shared?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profile_private: {
        Row: {
          birth_date: string | null
          consent_at: string | null
          consent_version: string
          first_name: string
          last_name: string
          name_suffix: string
          other_names: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          consent_at?: string | null
          consent_version?: string
          first_name?: string
          last_name?: string
          name_suffix?: string
          other_names?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          consent_at?: string | null
          consent_version?: string
          first_name?: string
          last_name?: string
          name_suffix?: string
          other_names?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          available: boolean
          avatar_path: string | null
          bio: string
          city: string
          created_at: string
          full_name: string
          id: string
          headline: string
          experience_years: number | null
          service_area: string
          certificate_note: string
        }
        Insert: {
          available?: boolean
          avatar_path?: string | null
          bio?: string
          city?: string
          created_at?: string
          full_name?: string
          id: string
          headline?: string
          experience_years?: number | null
          service_area?: string
          certificate_note?: string
        }
        Update: {
          available?: boolean
          avatar_path?: string | null
          bio?: string
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          headline?: string
          experience_years?: number | null
          service_area?: string
          certificate_note?: string
        }
        Relationships: []
      }
      profile_skills: {
        Row: {
          certified: boolean
          created_at: string
          had_training: boolean
          has_experience: boolean
          level: number
          notes: string
          skill: string
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          certified?: boolean
          created_at?: string
          had_training?: boolean
          has_experience?: boolean
          level?: number
          notes?: string
          skill: string
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          certified?: boolean
          created_at?: string
          had_training?: boolean
          has_experience?: boolean
          level?: number
          notes?: string
          skill?: string
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active_until: string | null
          created_at: string
          plan: string
          user_id: string
        }
        Insert: {
          active_until?: string | null
          created_at?: string
          plan?: string
          user_id: string
        }
        Update: {
          active_until?: string | null
          created_at?: string
          plan?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      post_stats: {
        Row: {
          post_id: string | null
          taken: number | null
          vacancies: number | null
        }
        Relationships: []
      }
      profile_rating_stats: {
        Row: {
          avg_rating: number | null
          review_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_review: {
        Args: { _reviewee: string; _reviewer: string }
        Returns: boolean
      }
      choose_provider: {
        Args: { _conversation: string }
        Returns: string
      }
      respond_engagement: {
        Args: { _accept: boolean; _id: string }
        Returns: undefined
      }
      complete_engagement: {
        Args: { _id: string }
        Returns: undefined
      }
      cancel_engagement: {
        Args: { _id: string }
        Returns: undefined
      }
      is_premium: {
        Args: { _user_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation: string }
        Returns: undefined
      }
      reply_stats: {
        Args: { _user: string }
        Returns: {
          replies: number
          median_seconds: number
        }[]
      }
      set_show_last_seen: {
        Args: { _show: boolean }
        Returns: undefined
      }
      touch_presence: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      unread_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          conversation_id: string
          unread: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<
  Database,
  "__InternalSupabase"
>

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends
    (DefaultSchemaTableNameOrOptions extends {
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
  TableName extends
    (DefaultSchemaTableNameOrOptions extends {
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
  TableName extends
    (DefaultSchemaTableNameOrOptions extends {
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
  CompositeTypeName extends
    (PublicCompositeTypeNameOrOptions extends {
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
    Enums: {},
  },
} as const
