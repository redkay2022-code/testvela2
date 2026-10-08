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
      categories: {
        Row: {
          collection: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          collection?: string
          created_at?: string
          id: string
          name: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          collection?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          creator: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          creator: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          creator?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      loyalty_budget: {
        Row: {
          allocated_budget: number
          commission_amount: number
          outstanding_liability: number
          period: string
          points_issued: number
          points_redeemed: number
          updated_at: string
        }
        Insert: {
          allocated_budget?: number
          commission_amount?: number
          outstanding_liability?: number
          period: string
          points_issued?: number
          points_redeemed?: number
          updated_at?: string
        }
        Update: {
          allocated_budget?: number
          commission_amount?: number
          outstanding_liability?: number
          period?: string
          points_issued?: number
          points_redeemed?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          commission_rate_pct: number
          expiration_months: number
          id: number
          loyalty_budget_pct: number
          max_earn_rate_pct: number
          max_outstanding_liability_usd: number
          max_redemption_pct: number
          monthly_point_budget_usd: number
          point_value_usd: number
          points_enabled: boolean
          updated_at: string
        }
        Insert: {
          commission_rate_pct?: number
          expiration_months?: number
          id?: number
          loyalty_budget_pct?: number
          max_earn_rate_pct?: number
          max_outstanding_liability_usd?: number
          max_redemption_pct?: number
          monthly_point_budget_usd?: number
          point_value_usd?: number
          points_enabled?: boolean
          updated_at?: string
        }
        Update: {
          commission_rate_pct?: number
          expiration_months?: number
          id?: number
          loyalty_budget_pct?: number
          max_earn_rate_pct?: number
          max_outstanding_liability_usd?: number
          max_redemption_pct?: number
          monthly_point_budget_usd?: number
          point_value_usd?: number
          points_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_settings: {
        Row: {
          earn_rate: number
          insurance_discount: number
          insurance_rate: number
          sort_order: number
          spend_max: number | null
          spend_min: number
          tier: string
          updated_at: string
        }
        Insert: {
          earn_rate: number
          insurance_discount: number
          insurance_rate: number
          sort_order: number
          spend_max?: number | null
          spend_min: number
          tier: string
          updated_at?: string
        }
        Update: {
          earn_rate?: number
          insurance_discount?: number
          insurance_rate?: number
          sort_order?: number
          spend_max?: number | null
          spend_min?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          rolling_12_month_spend: number
          tier: string
          tier_end_date: string
          tier_start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          rolling_12_month_spend?: number
          tier?: string
          tier_end_date?: string
          tier_start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          rolling_12_month_spend?: number
          tier?: string
          tier_end_date?: string
          tier_start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_messages: {
        Row: {
          areas: string[]
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          kind: string
          order_id: string
        }
        Insert: {
          areas?: string[]
          author_id: string
          author_role: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          order_id: string
        }
        Update: {
          areas?: string[]
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_qc_media: {
        Row: {
          created_at: string
          id: string
          kind: string
          order_id: string
          path: string
          round: number
          uploader_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          order_id: string
          path: string
          round?: number
          uploader_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          order_id?: string
          path?: string
          round?: number
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_qc_media_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_usd: number
          buyer_id: string
          cancelled_at: string | null
          courier: string | null
          created_at: string
          dispute_open: boolean
          dispute_opened_at: string | null
          id: string
          image_url: string | null
          network: string | null
          order_no: string
          payment_verified_at: string | null
          points_discount_usd: number
          points_earn_base: number
          points_earn_rate: number | null
          points_earned: number
          points_pending: number
          points_redeemed: number
          post_id: string | null
          product_amount_usd: number | null
          purchase_confirmed_at: string | null
          refunded_amount_usd: number
          seller_id: string | null
          seller_name: string
          stage: string
          title: string
          tracking_checked_at: string | null
          tracking_number: string | null
          tracking_status: Json
          txid: string | null
          updated_at: string
        }
        Insert: {
          amount_usd?: number
          buyer_id: string
          cancelled_at?: string | null
          courier?: string | null
          created_at?: string
          dispute_open?: boolean
          dispute_opened_at?: string | null
          id?: string
          image_url?: string | null
          network?: string | null
          order_no?: string
          payment_verified_at?: string | null
          points_discount_usd?: number
          points_earn_base?: number
          points_earn_rate?: number | null
          points_earned?: number
          points_pending?: number
          points_redeemed?: number
          post_id?: string | null
          product_amount_usd?: number | null
          purchase_confirmed_at?: string | null
          refunded_amount_usd?: number
          seller_id?: string | null
          seller_name?: string
          stage?: string
          title: string
          tracking_checked_at?: string | null
          tracking_number?: string | null
          tracking_status?: Json
          txid?: string | null
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          buyer_id?: string
          cancelled_at?: string | null
          courier?: string | null
          created_at?: string
          dispute_open?: boolean
          dispute_opened_at?: string | null
          id?: string
          image_url?: string | null
          network?: string | null
          order_no?: string
          payment_verified_at?: string | null
          points_discount_usd?: number
          points_earn_base?: number
          points_earn_rate?: number | null
          points_earned?: number
          points_pending?: number
          points_redeemed?: number
          post_id?: string | null
          product_amount_usd?: number | null
          purchase_confirmed_at?: string | null
          refunded_amount_usd?: number
          seller_id?: string | null
          seller_name?: string
          stage?: string
          title?: string
          tracking_checked_at?: string | null
          tracking_number?: string | null
          tracking_status?: Json
          txid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount_usd: number
          created_at: string
          escrow_status: string
          id: string
          network: string
          order_id: string
          submitted_by: string
          txid: string
          verified_at: string | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          escrow_status?: string
          id?: string
          network: string
          order_id: string
          submitted_by: string
          txid: string
          verified_at?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          escrow_status?: string
          id?: string
          network?: string
          order_id?: string
          submitted_by?: string
          txid?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          order_id: string | null
          remaining: number
          source: string
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          remaining?: number
          source?: string
          type: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          remaining?: number
          source?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      point_wallets: {
        Row: {
          available_points: number
          lifetime_earned: number
          lifetime_redeemed: number
          pending_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_points?: number
          lifetime_earned?: number
          lifetime_redeemed?: number
          pending_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_points?: number
          lifetime_earned?: number
          lifetime_redeemed?: number
          pending_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          base_likes: number
          box_price: number | null
          brand: string
          category: string
          created_at: string
          creator: string
          currency: string
          data_source: string
          description: string
          duration: string | null
          featured: boolean
          id: string
          image_key: string
          low_stock_threshold: number
          media_urls: string[]
          model: string
          music_artist: string | null
          music_audio_url: string | null
          music_license_url: string | null
          music_title: string | null
          music_track_id: string | null
          price: number | null
          product_status: string | null
          reference: string
          reserved_qty: number
          sku: string
          specs: Json
          status: string
          stock_qty: number
          store_id: string | null
          subcategory: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string | null
          video_tags: Json
          video_url: string | null
        }
        Insert: {
          base_likes?: number
          box_price?: number | null
          brand?: string
          category?: string
          created_at?: string
          creator?: string
          currency?: string
          data_source?: string
          description?: string
          duration?: string | null
          featured?: boolean
          id?: string
          image_key: string
          low_stock_threshold?: number
          media_urls?: string[]
          model?: string
          music_artist?: string | null
          music_audio_url?: string | null
          music_license_url?: string | null
          music_title?: string | null
          music_track_id?: string | null
          price?: number | null
          product_status?: string | null
          reference?: string
          reserved_qty?: number
          sku?: string
          specs?: Json
          status?: string
          stock_qty?: number
          store_id?: string | null
          subcategory?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
          video_tags?: Json
          video_url?: string | null
        }
        Update: {
          base_likes?: number
          box_price?: number | null
          brand?: string
          category?: string
          created_at?: string
          creator?: string
          currency?: string
          data_source?: string
          description?: string
          duration?: string | null
          featured?: boolean
          id?: string
          image_key?: string
          low_stock_threshold?: number
          media_urls?: string[]
          model?: string
          music_artist?: string | null
          music_audio_url?: string | null
          music_license_url?: string | null
          music_title?: string | null
          music_track_id?: string | null
          price?: number | null
          product_status?: string | null
          reference?: string
          reserved_qty?: number
          sku?: string
          specs?: Json
          status?: string
          stock_qty?: number
          store_id?: string | null
          subcategory?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          video_tags?: Json
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          is_main: boolean
          kind: string
          path: string
          post_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_main?: boolean
          kind?: string
          path: string
          post_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_main?: boolean
          kind?: string
          path?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_qc: {
        Row: {
          inspection_notes: string
          post_id: string
          qc_available: boolean
          qc_video: string | null
          timegrapher: Json
          updated_at: string
        }
        Insert: {
          inspection_notes?: string
          post_id: string
          qc_available?: boolean
          qc_video?: string | null
          timegrapher?: Json
          updated_at?: string
        }
        Update: {
          inspection_notes?: string
          post_id?: string
          qc_available?: boolean
          qc_video?: string | null
          timegrapher?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_qc_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          nickname: string
          phone_hash: string
          system_code: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          nickname: string
          phone_hash: string
          system_code: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          nickname?: string
          phone_hash?: string
          system_code?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          media_urls: string[]
          nickname: string
          order_id: string | null
          post_id: string | null
          rating: number | null
          seller_id: string
          seller_name: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          media_urls?: string[]
          nickname: string
          order_id?: string | null
          post_id?: string | null
          rating?: number | null
          seller_id: string
          seller_name: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          media_urls?: string[]
          nickname?: string
          order_id?: string | null
          post_id?: string | null
          rating?: number | null
          seller_id?: string
          seller_name?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          bio: string
          created_at: string
          id: string
          nickname: string | null
          region: string
          reviewed_at: string | null
          status: string
          studio_name: string
          system_code: string | null
          user_id: string
          wechat_avatar: string | null
          wechat_id: string
          wechat_nickname: string
          wechat_phone: string | null
        }
        Insert: {
          bio?: string
          created_at?: string
          id?: string
          nickname?: string | null
          region?: string
          reviewed_at?: string | null
          status?: string
          studio_name?: string
          system_code?: string | null
          user_id: string
          wechat_avatar?: string | null
          wechat_id?: string
          wechat_nickname?: string
          wechat_phone?: string | null
        }
        Update: {
          bio?: string
          created_at?: string
          id?: string
          nickname?: string | null
          region?: string
          reviewed_at?: string | null
          status?: string
          studio_name?: string
          system_code?: string | null
          user_id?: string
          wechat_avatar?: string | null
          wechat_id?: string
          wechat_nickname?: string
          wechat_phone?: string | null
        }
        Relationships: []
      }
      seller_tier_overrides: {
        Row: {
          seller_id: string
          tier: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          seller_id: string
          tier: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          seller_id?: string
          tier?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      sellers: {
        Row: {
          account_id: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          id: string
          seller_type: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          seller_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          seller_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          avatar: string | null
          city: string
          country: string
          cover_image: string | null
          created_at: string
          data_source: string
          description: string
          featured: boolean
          id: string
          logo: string | null
          response_time: string
          seller_id: string
          shipping_information: string
          shipping_regions: string[]
          slug: string
          specialties: string[]
          status: string
          store_name: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          avatar?: string | null
          city?: string
          country?: string
          cover_image?: string | null
          created_at?: string
          data_source?: string
          description?: string
          featured?: boolean
          id?: string
          logo?: string | null
          response_time?: string
          seller_id: string
          shipping_information?: string
          shipping_regions?: string[]
          slug: string
          specialties?: string[]
          status?: string
          store_name: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          avatar?: string | null
          city?: string
          country?: string
          cover_image?: string | null
          created_at?: string
          data_source?: string
          description?: string
          featured?: boolean
          id?: string
          logo?: string | null
          response_time?: string
          seller_id?: string
          shipping_information?: string
          shipping_regions?: string[]
          slug?: string
          specialties?: string[]
          status?: string
          store_name?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
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
      wechat_identities: {
        Row: {
          avatar_url: string | null
          is_sample: boolean
          nickname: string
          phone: string | null
          user_id: string
          verified_at: string
          wechat_id: string
        }
        Insert: {
          avatar_url?: string | null
          is_sample?: boolean
          nickname: string
          phone?: string | null
          user_id: string
          verified_at?: string
          wechat_id: string
        }
        Update: {
          avatar_url?: string | null
          is_sample?: boolean
          nickname?: string
          phone?: string | null
          user_id?: string
          verified_at?: string
          wechat_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _loyalty_budget_add: {
        Args: { _commission: number; _issued: number; _redeemed: number }
        Returns: undefined
      }
      _loyalty_expires: { Args: never; Returns: string }
      _loyalty_tx: {
        Args: {
          _admin: string
          _amount: number
          _expires: string
          _note: string
          _order: string
          _source: string
          _type: string
          _uid: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_party: {
        Args: { _order_id: string; _uid: string }
        Returns: boolean
      }
      is_order_seller: {
        Args: { _order_id: string; _uid: string }
        Returns: boolean
      }
      loyalty_admin_adjust: {
        Args: {
          _bonus?: boolean
          _points: number
          _reason: string
          _user: string
        }
        Returns: number
      }
      loyalty_admin_overview: { Args: never; Returns: Json }
      loyalty_expire_user: { Args: { _uid: string }; Returns: undefined }
      loyalty_my_summary: { Args: never; Returns: Json }
      loyalty_refresh_membership: { Args: { _uid: string }; Returns: string }
      store_is_visible: { Args: { _store_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "seller" | "user"
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
      app_role: ["admin", "seller", "user"],
    },
  },
} as const
