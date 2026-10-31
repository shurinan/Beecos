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
      account_holds: {
        Row: {
          ends_at: string
          id: string
          lifted_at: string | null
          report_id: string | null
          role: string
          starts_at: string
          user_id: string
        }
        Insert: {
          ends_at: string
          id?: string
          lifted_at?: string | null
          report_id?: string | null
          role: string
          starts_at?: string
          user_id: string
        }
        Update: {
          ends_at?: string
          id?: string
          lifted_at?: string | null
          report_id?: string | null
          role?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_holds_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      asaas_customers: {
        Row: {
          created_at: string
          customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_holds: {
        Row: {
          until: string
          user_id: string
        }
        Insert: {
          until: string
          user_id: string
        }
        Update: {
          until?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_terms: {
        Row: {
          anywhere: boolean
          term: string
        }
        Insert: {
          anywhere?: boolean
          term: string
        }
        Update: {
          anywhere?: boolean
          term?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          created_at: string
          profession_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          profession_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          profession_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "contact_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "contact_phones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_posts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          conversation_id: string
          created_at: string
          post_id: string
          released: boolean
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          conversation_id: string
          created_at?: string
          post_id: string
          released?: boolean
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          conversation_id?: string
          created_at?: string
          post_id?: string
          released?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "conversation_posts_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_posts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_stats"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "conversation_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_prefs: {
        Row: {
          archived: boolean
          cleared_at: string | null
          conversation_id: string
          favorite: boolean
          note: string | null
          pinned_at: string | null
          remind_at: string | null
          tag: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          cleared_at?: string | null
          conversation_id: string
          favorite?: boolean
          note?: string | null
          pinned_at?: string | null
          remind_at?: string | null
          tag?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean
          cleared_at?: string | null
          conversation_id?: string
          favorite?: boolean
          note?: string | null
          pinned_at?: string | null
          remind_at?: string | null
          tag?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_prefs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_prefs_user_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "post_stats"
            referencedColumns: ["post_id"]
          },
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
      deleted_records: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          id: number
          record: Json
          record_id: string | null
          table_name: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          id?: never
          record: Json
          record_id?: string | null
          table_name: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          id?: never
          record?: Json
          record_id?: string | null
          table_name?: string
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
        Insert: {
          accepted_at?: string | null
          cancelled_by?: string | null
          client_id: string
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          provider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          provider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_stats"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "engagements_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_expired_at: string | null
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
          attachment_expired_at?: string | null
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
          attachment_expired_at?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
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
      moderator_access_log: {
        Row: {
          at: string
          id: number
          moderator_id: string | null
          report_id: string | null
          what: string
        }
        Insert: {
          at?: string
          id?: never
          moderator_id?: string | null
          report_id?: string | null
          what: string
        }
        Update: {
          at?: string
          id?: never
          moderator_id?: string | null
          report_id?: string | null
          what?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_access_log_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          address_proof_path: string | null
          consent_at: string
          created_at: string
          doc_back_path: string | null
          doc_front_path: string
          files_deleted_at: string | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string
          status: string
          user_id: string
        }
        Insert: {
          address_proof_path?: string | null
          consent_at?: string
          created_at?: string
          doc_back_path?: string | null
          doc_front_path: string
          files_deleted_at?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path: string
          status?: string
          user_id: string
        }
        Update: {
          address_proof_path?: string | null
          consent_at?: string
          created_at?: string
          doc_back_path?: string | null
          doc_front_path?: string
          files_deleted_at?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_checks: {
        Row: {
          address_at: string | null
          document_at: string | null
          phone_at: string | null
          user_id: string
        }
        Insert: {
          address_at?: string | null
          document_at?: string | null
          phone_at?: string | null
          user_id: string
        }
        Update: {
          address_at?: string | null
          document_at?: string | null
          phone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      moderators: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          email: boolean
          in_app: boolean
          muted_profession_ids: string[]
          paused_until: string | null
          push: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          muted_profession_ids?: string[]
          paused_until?: string | null
          push?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          muted_profession_ids?: string[]
          paused_until?: string | null
          push?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          post_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind: string
          post_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          post_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_stats"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          asaas_payment_id: string
          asaas_subscription_id: string | null
          created_at: string
          id: string
          invoice_url: string | null
          kind: string
          paid_at: string | null
          post_id: string | null
          refunded_at: string | null
          status: string
          user_id: string
          value: number
        }
        Insert: {
          asaas_payment_id: string
          asaas_subscription_id?: string | null
          created_at?: string
          id?: string
          invoice_url?: string | null
          kind: string
          paid_at?: string | null
          post_id?: string | null
          refunded_at?: string | null
          status?: string
          user_id: string
          value: number
        }
        Update: {
          asaas_payment_id?: string
          asaas_subscription_id?: string | null
          created_at?: string
          id?: string
          invoice_url?: string | null
          kind?: string
          paid_at?: string | null
          post_id?: string | null
          refunded_at?: string | null
          status?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_locations: {
        Row: {
          lat: number
          lng: number
          post_id: string
          postal_code: string
          updated_at: string
        }
        Insert: {
          lat: number
          lng: number
          post_id: string
          postal_code: string
          updated_at?: string
        }
        Update: {
          lat?: number
          lng?: number
          post_id?: string
          postal_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_locations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "post_stats"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_locations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_photos: {
        Row: {
          created_at: string
          id: string
          path: string
          post_id: string
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          post_id: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          post_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_photos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_stats"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_photos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_waitlist: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_waitlist_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_stats"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_waitlist_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          city: string
          cover_color: string | null
          cover_icon: string | null
          created_at: string
          description: string
          hidden_at: string | null
          hidden_reason: string | null
          highlight: boolean
          id: string
          kind: string
          negotiable: boolean
          price: string
          price_value: number | null
          profession_id: string | null
          service_id: string | null
          slug: string
          title: string
          urgent: boolean
          user_id: string
          vacancies: number
        }
        Insert: {
          city?: string
          cover_color?: string | null
          cover_icon?: string | null
          created_at?: string
          description?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          highlight?: boolean
          id?: string
          kind: string
          negotiable?: boolean
          price?: string
          price_value?: number | null
          profession_id?: string | null
          service_id?: string | null
          slug: string
          title: string
          urgent?: boolean
          user_id: string
          vacancies?: number
        }
        Update: {
          city?: string
          cover_color?: string | null
          cover_icon?: string | null
          created_at?: string
          description?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          highlight?: boolean
          id?: string
          kind?: string
          negotiable?: boolean
          price?: string
          price_value?: number | null
          profession_id?: string | null
          service_id?: string | null
          slug?: string
          title?: string
          urgent?: boolean
          user_id?: string
          vacancies?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professions: {
        Row: {
          active: boolean
          aliases: string[]
          id: string
          name: string
          sector_id: string
          slug: string
          sort: number
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          id?: string
          name: string
          sector_id: string
          slug: string
          sort?: number
        }
        Update: {
          active?: boolean
          aliases?: string[]
          id?: string
          name?: string
          sector_id?: string
          slug?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "professions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
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
      profile_skills: {
        Row: {
          certified: boolean
          created_at: string
          had_training: boolean
          has_experience: boolean
          level: number
          notes: string
          profession_id: string | null
          service_ids: string[]
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
          profession_id?: string | null
          service_ids?: string[]
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
          profession_id?: string | null
          service_ids?: string[]
          skill?: string
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
          certificate_note: string
          city: string
          created_at: string
          experience_years: number | null
          full_name: string
          headline: string
          id: string
          service_area: string
          slug: string | null
          terms_accepted_at: string | null
          terms_version: string | null
        }
        Insert: {
          available?: boolean
          avatar_path?: string | null
          bio?: string
          certificate_note?: string
          city?: string
          created_at?: string
          experience_years?: number | null
          full_name?: string
          headline?: string
          id: string
          service_area?: string
          slug?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Update: {
          available?: boolean
          avatar_path?: string | null
          bio?: string
          certificate_note?: string
          city?: string
          created_at?: string
          experience_years?: number | null
          full_name?: string
          headline?: string
          id?: string
          service_area?: string
          slug?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          bad_faith: boolean
          created_at: string
          details: string
          id: string
          reason: string
          reported_id: string | null
          reporter_id: string | null
          resolution_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_label: string
          target_type: string
        }
        Insert: {
          bad_faith?: boolean
          created_at?: string
          details?: string
          id?: string
          reason: string
          reported_id?: string | null
          reporter_id?: string | null
          resolution_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_label?: string
          target_type: string
        }
        Update: {
          bad_faith?: boolean
          created_at?: string
          details?: string
          id?: string
          reason?: string
          reported_id?: string | null
          reporter_id?: string | null
          resolution_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_label?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
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
      sectors: {
        Row: {
          active: boolean
          id: string
          name: string
          slug: string
          sort: number
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
          slug: string
          sort?: number
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          aliases: string[]
          id: string
          name: string
          profession_id: string
          slug: string
          sort: number
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          id?: string
          name: string
          profession_id: string
          slug: string
          sort?: number
        }
        Update: {
          active?: boolean
          aliases?: string[]
          id?: string
          name?: string
          profession_id?: string
          slug?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_profession_id_fkey"
            columns: ["profession_id"]
            isOneToOne: false
            referencedRelation: "professions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active_until: string | null
          asaas_subscription_id: string | null
          cancel_requested_at: string | null
          created_at: string
          first_paid_at: string | null
          plan: string
          plan_term: string
          user_id: string
        }
        Insert: {
          active_until?: string | null
          asaas_subscription_id?: string | null
          cancel_requested_at?: string | null
          created_at?: string
          first_paid_at?: string | null
          plan?: string
          plan_term?: string
          user_id: string
        }
        Update: {
          active_until?: string | null
          asaas_subscription_id?: string | null
          cancel_requested_at?: string | null
          created_at?: string
          first_paid_at?: string | null
          plan?: string
          plan_term?: string
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
      suggestions: {
        Row: {
          body: string
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_areas: {
        Row: {
          city: string
          created_at: string
          expanded_km: number
          lat: number
          lng: number
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string
          created_at?: string
          expanded_km?: number
          lat: number
          lng: number
          postal_code: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          expanded_km?: number
          lat?: number
          lng?: number
          postal_code?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_areas_user_id_fkey"
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
      premium_users: {
        Row: {
          user_id: string | null
        }
        Insert: {
          user_id?: string | null
        }
        Update: {
          user_id?: string | null
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
      profile_rating_stats: {
        Row: {
          avg_rating: number | null
          review_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _engagement_note: {
        Args: { _conversation: string; _text: string }
        Returns: undefined
      }
      _promote_waitlist: { Args: { _post: string }; Returns: undefined }
      accept_terms: { Args: { _version: string }; Returns: undefined }
      asaas_apply_payment: {
        Args: {
          _customer: string
          _payment_id: string
          _ref: string
          _status: string
          _subscription: string
          _url: string
          _value: number
        }
        Returns: string
      }
      asaas_mark_canceled: {
        Args: { _subscription: string }
        Returns: undefined
      }
      base_radius_km: { Args: never; Returns: number }
      can_review: {
        Args: { _reviewee: string; _reviewer: string }
        Returns: boolean
      }
      cancel_engagement: { Args: { _id: string }; Returns: undefined }
      choose_provider: {
        Args: { _conversation: string; _post?: string }
        Returns: string
      }
      close_negotiation: {
        Args: { _conversation: string; _post: string; _release?: boolean }
        Returns: undefined
      }
      community_overview: {
        Args: never
        Returns: {
          members: number
          open_jobs: number
          profession_id: string
        }[]
      }
      complete_engagement: { Args: { _id: string }; Returns: undefined }
      contains_blocked_term: { Args: { _t: string }; Returns: boolean }
      contains_link: { Args: { _t: string }; Returns: boolean }
      conversation_other_read: {
        Args: { _conversation: string }
        Returns: string
      }
      current_terms_version: { Args: never; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      effective_radius_km: { Args: { _user_id: string }; Returns: number }
      export_my_data: { Args: never; Returns: Json }
      fold_text: { Args: { _t: string }; Returns: string }
      has_reports: { Args: { _u: string }; Returns: boolean }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      hold_hours: { Args: never; Returns: number }
      in_active_conversation: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      badge_info: {
        Args: { _user_ids: string[] }
        Returns: {
          user_id: string
          premium: boolean
          doc: boolean
          email: boolean
          phone: boolean
        }[]
      }
      review_verification: {
        Args: { _id: string; _approve: boolean; _reason?: string }
        Returns: string[]
      }
      mark_verification_files_deleted: { Args: { _id: string }; Returns: undefined }
      pending_verifications_count: { Args: never; Returns: number }
      is_moderator: { Args: never; Returns: boolean }
      is_on_hold: { Args: { _u: string }; Returns: boolean }
      is_premium: { Args: { _user_id: string }; Returns: boolean }
      is_valid_username: { Args: { _n: string }; Returns: boolean }
      join_waitlist: { Args: { _post: string }; Returns: string }
      mark_conversation_read: {
        Args: { _conversation: string }
        Returns: undefined
      }
      max_open_negotiations: { Args: never; Returns: number }
      moderator_case: { Args: { _report: string }; Returns: Json }
      my_hold_until: { Args: never; Returns: string }
      my_post_distances: {
        Args: { _post_ids: string[] }
        Returns: {
          far: boolean
          km: number
          notify_km: number
          post_id: string
        }[]
      }
      my_work_radius_km: { Args: never; Returns: number }
      normalize_text: { Args: { _t: string }; Returns: string }
      open_conversation: {
        Args: { _other: string; _post?: string }
        Returns: string
      }
      open_negotiations: { Args: { _post: string }; Returns: number }
      parse_price: { Args: { _t: string }; Returns: number }
      post_interest_counts: {
        Args: { _post_ids: string[] }
        Returns: {
          interested: number
          post_id: string
        }[]
      }
      purge_expired_records: { Args: never; Returns: undefined }
      reopen_negotiation: {
        Args: { _conversation: string; _post: string }
        Returns: undefined
      }
      reply_stats: {
        Args: { _user: string }
        Returns: {
          median_seconds: number
          replies: number
        }[]
      }
      report_content: {
        Args: {
          _details?: string
          _reason: string
          _target: string
          _type: string
        }
        Returns: string
      }
      reporter_bad_faith: { Args: { _report: string }; Returns: number }
      request_subscription_cancel: { Args: never; Returns: string }
      reserved_usernames: { Args: never; Returns: string[] }
      resolve_report: {
        Args: { _action: string; _id: string; _note?: string }
        Returns: undefined
      }
      respond_engagement: {
        Args: { _accept: boolean; _id: string }
        Returns: undefined
      }
      search_post_ids: {
        Args: {
          _city?: string
          _kind: string
          _limit?: number
          _max_price?: number
          _min_price?: number
          _min_rating?: number
          _only_premium?: boolean
          _q?: string
        }
        Returns: {
          id: string
          premium: boolean
        }[]
      }
      set_show_last_seen: { Args: { _show: boolean }; Returns: undefined }
      slugify: { Args: { _max?: number; _t: string }; Returns: string }
      touch_presence: { Args: never; Returns: undefined }
      unread_counts: {
        Args: never
        Returns: {
          conversation_id: string
          unread: number
        }[]
      }
      username_available: { Args: { _name: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
