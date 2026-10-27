export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      ads: {
        Row: {
          active: boolean;
          body: string;
          created_at: string;
          ends_at: string | null;
          id: string;
          image_url: string | null;
          link_url: string;
          placement: string;
          sponsor: string;
          starts_at: string | null;
          title: string;
        };
        Insert: {
          active?: boolean;
          body?: string;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          image_url?: string | null;
          link_url: string;
          placement: string;
          sponsor: string;
          starts_at?: string | null;
          title: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          image_url?: string | null;
          link_url?: string;
          placement?: string;
          sponsor?: string;
          starts_at?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      conversation_posts: {
        Row: {
          closed_at: string | null;
          closed_by: string | null;
          conversation_id: string;
          created_at: string;
          post_id: string;
        };
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          conversation_id: string;
          created_at?: string;
          post_id: string;
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          conversation_id?: string;
          created_at?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_posts_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_posts_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string;
          post_id: string | null;
          user_a: string;
          user_b: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          post_id?: string | null;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          post_id?: string | null;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_user_a_fkey";
            columns: ["user_a"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_user_b_fkey";
            columns: ["user_b"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          attachment_type: string | null;
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          kind: string;
          sender_id: string;
        };
        Insert: {
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          attachment_type?: string | null;
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          kind?: string;
          sender_id: string;
        };
        Update: {
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          attachment_type?: string | null;
          content?: string;
          conversation_id?: string;
          kind?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          city: string;
          created_at: string;
          description: string;
          hidden_at: string | null;
          hidden_reason: string | null;
          id: string;
          kind: string;
          price: string;
          price_value: number | null;
          profession_id: string | null;
          service_id: string | null;
          slug: string;
          title: string;
          user_id: string;
          vacancies: number;
        };
        Insert: {
          city?: string;
          created_at?: string;
          description?: string;
          id?: string;
          kind: string;
          price?: string;
          profession_id?: string | null;
          service_id?: string | null;
          slug?: string;
          title: string;
          user_id: string;
          vacancies?: number;
        };
        Update: {
          city?: string;
          created_at?: string;
          description?: string;
          id?: string;
          kind?: string;
          price?: string;
          profession_id?: string | null;
          service_id?: string | null;
          slug?: string;
          title?: string;
          user_id?: string;
          vacancies?: number;
        };
        Relationships: [
          {
            foreignKeyName: "posts_profession_id_fkey";
            columns: ["profession_id"];
            isOneToOne: false;
            referencedRelation: "professions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sectors: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          slug: string;
          sort: number;
        };
        Insert: {
          active?: boolean;
          id?: string;
          name: string;
          slug: string;
          sort?: number;
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          slug?: string;
          sort?: number;
        };
        Relationships: [];
      };
      professions: {
        Row: {
          active: boolean;
          aliases: string[];
          id: string;
          name: string;
          sector_id: string;
          slug: string;
          sort: number;
        };
        Insert: {
          active?: boolean;
          aliases?: string[];
          id?: string;
          name: string;
          sector_id: string;
          slug: string;
          sort?: number;
        };
        Update: {
          active?: boolean;
          aliases?: string[];
          id?: string;
          name?: string;
          sector_id?: string;
          slug?: string;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: "professions_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          active: boolean;
          aliases: string[];
          id: string;
          name: string;
          profession_id: string;
          slug: string;
          sort: number;
        };
        Insert: {
          active?: boolean;
          aliases?: string[];
          id?: string;
          name: string;
          profession_id: string;
          slug: string;
          sort?: number;
        };
        Update: {
          active?: boolean;
          aliases?: string[];
          id?: string;
          name?: string;
          profession_id?: string;
          slug?: string;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: "services_profession_id_fkey";
            columns: ["profession_id"];
            isOneToOne: false;
            referencedRelation: "professions";
            referencedColumns: ["id"];
          },
        ];
      };
      post_locations: {
        Row: {
          lat: number;
          lng: number;
          post_id: string;
          postal_code: string;
          updated_at: string;
        };
        Insert: {
          lat: number;
          lng: number;
          post_id: string;
          postal_code: string;
          updated_at?: string;
        };
        Update: {
          lat?: number;
          lng?: number;
          post_id?: string;
          postal_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_locations_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: true;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_prefs: {
        Row: {
          email: boolean;
          in_app: boolean;
          muted_profession_ids: string[];
          paused_until: string | null;
          push: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          email?: boolean;
          in_app?: boolean;
          muted_profession_ids?: string[];
          paused_until?: string | null;
          push?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          email?: boolean;
          in_app?: boolean;
          muted_profession_ids?: string[];
          paused_until?: string | null;
          push?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          body: string;
          created_at: string;
          id: string;
          kind: string;
          post_id: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          actor_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          kind: string;
          post_id?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      work_areas: {
        Row: {
          city: string;
          created_at: string;
          expanded_km: number;
          lat: number;
          lng: number;
          postal_code: string;
          state: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          city?: string;
          created_at?: string;
          expanded_km?: number;
          lat: number;
          lng: number;
          postal_code: string;
          state?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          city?: string;
          created_at?: string;
          expanded_km?: number;
          lat?: number;
          lng?: number;
          postal_code?: string;
          state?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_areas_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_reads: {
        Row: {
          conversation_id: string;
          last_read_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          last_read_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          last_read_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_presence: {
        Row: {
          last_seen_at: string;
          show_last_seen: boolean;
          user_id: string;
        };
        Insert: {
          last_seen_at?: string;
          show_last_seen?: boolean;
          user_id: string;
        };
        Update: {
          last_seen_at?: string;
          show_last_seen?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      engagements: {
        Row: {
          accepted_at: string | null;
          cancelled_by: string | null;
          client_id: string;
          completed_at: string | null;
          conversation_id: string;
          created_at: string;
          id: string;
          post_id: string | null;
          provider_id: string;
          status: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      contact_addresses: {
        Row: {
          care_of: string;
          city: string;
          id: string;
          kind: string;
          neighborhood: string;
          postal_code: string;
          recipient: string;
          state: string;
          street: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          care_of?: string;
          city: string;
          id?: string;
          kind: string;
          neighborhood?: string;
          postal_code: string;
          recipient: string;
          state: string;
          street: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          care_of?: string;
          city?: string;
          id?: string;
          kind?: string;
          neighborhood?: string;
          postal_code?: string;
          recipient?: string;
          state?: string;
          street?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      contact_phones: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          methods: string[];
          number: string;
          shared: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          methods?: string[];
          number: string;
          shared?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          methods?: string[];
          number?: string;
          shared?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      profile_private: {
        Row: {
          birth_date: string | null;
          consent_at: string | null;
          consent_version: string;
          first_name: string;
          last_name: string;
          name_suffix: string;
          other_names: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          birth_date?: string | null;
          consent_at?: string | null;
          consent_version?: string;
          first_name?: string;
          last_name?: string;
          name_suffix?: string;
          other_names?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          birth_date?: string | null;
          consent_at?: string | null;
          consent_version?: string;
          first_name?: string;
          last_name?: string;
          name_suffix?: string;
          other_names?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          available: boolean;
          avatar_path: string | null;
          bio: string;
          city: string;
          created_at: string;
          full_name: string;
          id: string;
          slug: string | null;
          headline: string;
          experience_years: number | null;
          service_area: string;
          certificate_note: string;
        };
        Insert: {
          available?: boolean;
          avatar_path?: string | null;
          bio?: string;
          city?: string;
          created_at?: string;
          full_name?: string;
          id: string;
          slug?: string | null;
          headline?: string;
          experience_years?: number | null;
          service_area?: string;
          certificate_note?: string;
        };
        Update: {
          available?: boolean;
          avatar_path?: string | null;
          bio?: string;
          city?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          slug?: string | null;
          headline?: string;
          experience_years?: number | null;
          service_area?: string;
          certificate_note?: string;
        };
        Relationships: [];
      };
      profile_skills: {
        Row: {
          certified: boolean;
          created_at: string;
          had_training: boolean;
          has_experience: boolean;
          level: number;
          notes: string;
          profession_id: string | null;
          service_ids: string[];
          skill: string;
          updated_at: string;
          user_id: string;
          years_experience: number | null;
        };
        Insert: {
          certified?: boolean;
          created_at?: string;
          had_training?: boolean;
          has_experience?: boolean;
          level?: number;
          notes?: string;
          profession_id?: string | null;
          service_ids?: string[];
          skill: string;
          updated_at?: string;
          user_id: string;
          years_experience?: number | null;
        };
        Update: {
          certified?: boolean;
          created_at?: string;
          had_training?: boolean;
          has_experience?: boolean;
          level?: number;
          notes?: string;
          profession_id?: string | null;
          service_ids?: string[];
          skill?: string;
          updated_at?: string;
          user_id?: string;
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "profile_skills_profession_id_fkey";
            columns: ["profession_id"];
            isOneToOne: false;
            referencedRelation: "professions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_skills_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string;
          id: string;
          reason: string;
          reporter_id: string;
          resolution_note: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          target_id: string;
          target_label: string;
          target_type: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reviews: {
        Row: {
          comment: string;
          created_at: string;
          id: string;
          rating: number;
          reviewee_id: string;
          reviewer_id: string;
        };
        Insert: {
          comment?: string;
          created_at?: string;
          id?: string;
          rating: number;
          reviewee_id: string;
          reviewer_id: string;
        };
        Update: {
          comment?: string;
          created_at?: string;
          id?: string;
          rating?: number;
          reviewee_id?: string;
          reviewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey";
            columns: ["reviewee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          active_until: string | null;
          created_at: string;
          plan: string;
          user_id: string;
        };
        Insert: {
          active_until?: string | null;
          created_at?: string;
          plan?: string;
          user_id: string;
        };
        Update: {
          active_until?: string | null;
          created_at?: string;
          plan?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      premium_users: {
        Row: {
          user_id: string | null;
        };
        Relationships: [];
      };
      post_stats: {
        Row: {
          post_id: string | null;
          taken: number | null;
          vacancies: number | null;
        };
        Relationships: [];
      };
      profile_rating_stats: {
        Row: {
          avg_rating: number | null;
          review_count: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      can_review: {
        Args: { _reviewee: string; _reviewer: string };
        Returns: boolean;
      };
      close_negotiation: {
        Args: { _conversation: string; _post: string };
        Returns: undefined;
      };
      reopen_negotiation: {
        Args: { _conversation: string; _post: string };
        Returns: undefined;
      };
      choose_provider: {
        Args: { _conversation: string; _post?: string };
        Returns: string;
      };
      report_content: {
        Args: { _type: string; _target: string; _reason: string; _details?: string };
        Returns: string;
      };
      resolve_report: {
        Args: { _id: string; _action: string; _note?: string };
        Returns: undefined;
      };
      is_moderator: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      username_available: {
        Args: { _name: string };
        Returns: boolean;
      };
      is_valid_username: {
        Args: { _n: string };
        Returns: boolean;
      };
      my_post_distances: {
        Args: { _post_ids: string[] };
        Returns: {
          far: boolean;
          km: number;
          notify_km: number;
          post_id: string;
        }[];
      };
      my_work_radius_km: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      open_conversation: {
        Args: { _other: string; _post?: string };
        Returns: string;
      };
      parse_price: {
        Args: { _t: string };
        Returns: number;
      };
      search_post_ids: {
        Args: {
          _kind: string;
          _city?: string;
          _q?: string;
          _min_price?: number;
          _max_price?: number;
          _min_rating?: number;
          _only_premium?: boolean;
          _limit?: number;
        };
        Returns: { id: string; premium: boolean }[];
      };
      respond_engagement: {
        Args: { _accept: boolean; _id: string };
        Returns: undefined;
      };
      complete_engagement: {
        Args: { _id: string };
        Returns: undefined;
      };
      cancel_engagement: {
        Args: { _id: string };
        Returns: undefined;
      };
      is_premium: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      mark_conversation_read: {
        Args: { _conversation: string };
        Returns: undefined;
      };
      reply_stats: {
        Args: { _user: string };
        Returns: {
          replies: number;
          median_seconds: number;
        }[];
      };
      set_show_last_seen: {
        Args: { _show: boolean };
        Returns: undefined;
      };
      touch_presence: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      unread_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          conversation_id: string;
          unread: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
