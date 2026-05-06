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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          link_type: string
          link_value: string
          media_type: string
          position: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_type?: string
          link_value: string
          media_type?: string
          position?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_type?: string
          link_value?: string
          media_type?: string
          position?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          rule_key: string
          rule_type: string
          rule_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          rule_key: string
          rule_type: string
          rule_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          rule_key?: string
          rule_type?: string
          rule_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      custom_form_fields: {
        Row: {
          created_at: string
          display_order: number | null
          field_label: string
          field_options: Json | null
          field_type: string
          id: string
          is_required: boolean | null
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          field_label: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          field_label?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_form_fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_orders: {
        Row: {
          admin_notes: string | null
          created_at: string
          form_data: Json
          id: string
          product_id: string
          status: string
          total_amount: number | null
          updated_at: string
          user_id: string
          vendor_id: string | null
          vendor_notes: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          form_data: Json
          id?: string
          product_id: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
          vendor_notes?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          form_data?: Json
          id?: string
          product_id?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
          vendor_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delhivery_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      dropshipper_applications: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          referred_by_dropshipper_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          referred_by_dropshipper_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          referred_by_dropshipper_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promoter_applications_referred_by_promoter_id_fkey"
            columns: ["referred_by_dropshipper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dropshipper_products: {
        Row: {
          created_at: string
          dropshipper_id: string
          id: string
          is_active: boolean
          product_id: string
          selling_price: number
          shopper_discount_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dropshipper_id: string
          id?: string
          is_active?: boolean
          product_id: string
          selling_price: number
          shopper_discount_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dropshipper_id?: string
          id?: string
          is_active?: boolean
          product_id?: string
          selling_price?: number
          shopper_discount_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropshipper_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dropshipper_referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string | null
          referred_dropshipper_id: string
          referrer_dropshipper_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code?: string | null
          referred_dropshipper_id: string
          referrer_dropshipper_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string | null
          referred_dropshipper_id?: string
          referrer_dropshipper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promoter_referrals_referred_promoter_id_fkey"
            columns: ["referred_dropshipper_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promoter_referrals_referrer_promoter_id_fkey"
            columns: ["referrer_dropshipper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          base_amount: number
          created_at: string
          dropshipper_id: string
          earning_type: string | null
          formula_breakdown: Json | null
          id: string
          referral_source_dropshipper_id: string | null
          referral_source_subscription_id: string | null
          return_window_ends_at: string | null
          sale_date: string
          status: Database["public"]["Enums"]["approval_status"] | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          base_amount: number
          created_at?: string
          dropshipper_id: string
          earning_type?: string | null
          formula_breakdown?: Json | null
          id?: string
          referral_source_dropshipper_id?: string | null
          referral_source_subscription_id?: string | null
          return_window_ends_at?: string | null
          sale_date: string
          status?: Database["public"]["Enums"]["approval_status"] | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          created_at?: string
          dropshipper_id?: string
          earning_type?: string | null
          formula_breakdown?: Json | null
          id?: string
          referral_source_dropshipper_id?: string | null
          referral_source_subscription_id?: string | null
          return_window_ends_at?: string | null
          sale_date?: string
          status?: Database["public"]["Enums"]["approval_status"] | null
        }
        Relationships: []
      }
      earnings_backup_phase3: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          base_amount: number | null
          created_at: string | null
          earning_type: string | null
          formula_breakdown: Json | null
          id: string | null
          performance_bonus_percent: number | null
          promoter_id: string | null
          referral_source_promoter_id: string | null
          referral_source_subscription_id: string | null
          registration_bonus: number | null
          return_window_ends_at: string | null
          sale_date: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          streak_bonus_percent: number | null
          surge_multiplier: number | null
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number | null
          created_at?: string | null
          earning_type?: string | null
          formula_breakdown?: Json | null
          id?: string | null
          performance_bonus_percent?: number | null
          promoter_id?: string | null
          referral_source_promoter_id?: string | null
          referral_source_subscription_id?: string | null
          registration_bonus?: number | null
          return_window_ends_at?: string | null
          sale_date?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          streak_bonus_percent?: number | null
          surge_multiplier?: number | null
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number | null
          created_at?: string | null
          earning_type?: string | null
          formula_breakdown?: Json | null
          id?: string | null
          performance_bonus_percent?: number | null
          promoter_id?: string | null
          referral_source_promoter_id?: string | null
          referral_source_subscription_id?: string | null
          registration_bonus?: number | null
          return_window_ends_at?: string | null
          sale_date?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          streak_bonus_percent?: number | null
          surge_multiplier?: number | null
        }
        Relationships: []
      }
      home_sections: {
        Row: {
          created_at: string
          display_order: number | null
          emoji: string | null
          id: string
          image_url: string | null
          is_enabled: boolean | null
          section_key: string
          selected_category_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean | null
          section_key: string
          selected_category_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean | null
          section_key?: string
          selected_category_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      manager_passwords: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          manager_id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          manager_id: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          manager_id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          name: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          name: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          name?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_email: string
          buyer_name: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          delhivery_order_id: string | null
          delhivery_status: string | null
          delhivery_waybill: string | null
          delivered_at: string | null
          delivery_address: Json | null
          dropshipper_base_price_snapshot: number | null
          dropshipper_id: string | null
          final_sale_price: number | null
          id: string
          is_digital: boolean | null
          order_id: string | null
          payment_id: string | null
          pricing_model: string
          product_id: string
          profit_amount: number | null
          quantity: number
          referral_link_id: string | null
          selling_price_snapshot: number | null
          shipping_created_at: string | null
          status: string
          total_amount: number
          tracking_info: Json | null
          unit_price: number
          updated_at: string
          user_id: string | null
          vendor_base_price_snapshot: number | null
          vendor_id: string | null
        }
        Insert: {
          buyer_email: string
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          delhivery_order_id?: string | null
          delhivery_status?: string | null
          delhivery_waybill?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          dropshipper_base_price_snapshot?: number | null
          dropshipper_id?: string | null
          final_sale_price?: number | null
          id?: string
          is_digital?: boolean | null
          order_id?: string | null
          payment_id?: string | null
          pricing_model?: string
          product_id: string
          profit_amount?: number | null
          quantity?: number
          referral_link_id?: string | null
          selling_price_snapshot?: number | null
          shipping_created_at?: string | null
          status?: string
          total_amount: number
          tracking_info?: Json | null
          unit_price: number
          updated_at?: string
          user_id?: string | null
          vendor_base_price_snapshot?: number | null
          vendor_id?: string | null
        }
        Update: {
          buyer_email?: string
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          delhivery_order_id?: string | null
          delhivery_status?: string | null
          delhivery_waybill?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          dropshipper_base_price_snapshot?: number | null
          dropshipper_id?: string | null
          final_sale_price?: number | null
          id?: string
          is_digital?: boolean | null
          order_id?: string | null
          payment_id?: string | null
          pricing_model?: string
          product_id?: string
          profit_amount?: number | null
          quantity?: number
          referral_link_id?: string | null
          selling_price_snapshot?: number | null
          shipping_created_at?: string | null
          status?: string
          total_amount?: number
          tracking_info?: Json | null
          unit_price?: number
          updated_at?: string
          user_id?: string | null
          vendor_base_price_snapshot?: number | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_backup_phase3: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          delhivery_order_id: string | null
          delhivery_status: string | null
          delhivery_waybill: string | null
          delivered_at: string | null
          delivery_address: Json | null
          dropshipper_base_price_snapshot: number | null
          dropshipper_id: string | null
          final_sale_price: number | null
          id: string | null
          is_digital: boolean | null
          order_id: string | null
          payment_id: string | null
          pricing_model: string | null
          product_id: string | null
          profit_amount: number | null
          promoter_id: string | null
          quantity: number | null
          referral_link_id: string | null
          selling_price_snapshot: number | null
          shipping_created_at: string | null
          status: string | null
          total_amount: number | null
          tracking_info: Json | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
          vendor_base_price_snapshot: number | null
          vendor_id: string | null
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          delhivery_order_id?: string | null
          delhivery_status?: string | null
          delhivery_waybill?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          dropshipper_base_price_snapshot?: number | null
          dropshipper_id?: string | null
          final_sale_price?: number | null
          id?: string | null
          is_digital?: boolean | null
          order_id?: string | null
          payment_id?: string | null
          pricing_model?: string | null
          product_id?: string | null
          profit_amount?: number | null
          promoter_id?: string | null
          quantity?: number | null
          referral_link_id?: string | null
          selling_price_snapshot?: number | null
          shipping_created_at?: string | null
          status?: string | null
          total_amount?: number | null
          tracking_info?: Json | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_base_price_snapshot?: number | null
          vendor_id?: string | null
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          delhivery_order_id?: string | null
          delhivery_status?: string | null
          delhivery_waybill?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          dropshipper_base_price_snapshot?: number | null
          dropshipper_id?: string | null
          final_sale_price?: number | null
          id?: string | null
          is_digital?: boolean | null
          order_id?: string | null
          payment_id?: string | null
          pricing_model?: string | null
          product_id?: string | null
          profit_amount?: number | null
          promoter_id?: string | null
          quantity?: number | null
          referral_link_id?: string | null
          selling_price_snapshot?: number | null
          shipping_created_at?: string | null
          status?: string | null
          total_amount?: number | null
          tracking_info?: Json | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_base_price_snapshot?: number | null
          vendor_id?: string | null
        }
        Relationships: []
      }
      product_enquiries: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          message: string | null
          product_id: string
          user_id: string
          vendor_id: string | null
          whatsapp_sent: boolean | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          message?: string | null
          product_id: string
          user_id: string
          vendor_id?: string | null
          whatsapp_sent?: boolean | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          message?: string | null
          product_id?: string
          user_id?: string
          vendor_id?: string | null
          whatsapp_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_enquiries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          admin_response: string | null
          admin_response_at: string | null
          admin_response_by: string | null
          buyer_email: string
          created_at: string
          id: string
          product_id: string
          rating: number
          review_text: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          admin_response_at?: string | null
          admin_response_by?: string | null
          buyer_email: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          review_text?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          admin_response_at?: string | null
          admin_response_by?: string | null
          buyer_email?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          review_text?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          admin_sale_price: number
          availability_slots: Json | null
          available_from: string | null
          available_to: string | null
          category: string
          created_at: string
          description: string | null
          digital_file_url: string | null
          discount_type: string | null
          discount_value: number | null
          dropshipper_base_price: number
          id: string
          image_urls: string[] | null
          is_active: boolean | null
          is_digital: boolean | null
          is_featured: boolean | null
          is_hot_deal: boolean | null
          mrp: number | null
          name: string
          price: number
          product_type: string
          shipping_charge: number | null
          shopper_discount_percent: number | null
          stock_quantity: number | null
          tax_rate: number | null
          unit: string | null
          unit_quantity: number | null
          updated_at: string
          vendor_base_price: number
          vendor_id: string | null
          weight_grams: number | null
        }
        Insert: {
          admin_sale_price: number
          availability_slots?: Json | null
          available_from?: string | null
          available_to?: string | null
          category: string
          created_at?: string
          description?: string | null
          digital_file_url?: string | null
          discount_type?: string | null
          discount_value?: number | null
          dropshipper_base_price: number
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          is_digital?: boolean | null
          is_featured?: boolean | null
          is_hot_deal?: boolean | null
          mrp?: number | null
          name: string
          price: number
          product_type?: string
          shipping_charge?: number | null
          shopper_discount_percent?: number | null
          stock_quantity?: number | null
          tax_rate?: number | null
          unit?: string | null
          unit_quantity?: number | null
          updated_at?: string
          vendor_base_price: number
          vendor_id?: string | null
          weight_grams?: number | null
        }
        Update: {
          admin_sale_price?: number
          availability_slots?: Json | null
          available_from?: string | null
          available_to?: string | null
          category?: string
          created_at?: string
          description?: string | null
          digital_file_url?: string | null
          discount_type?: string | null
          discount_value?: number | null
          dropshipper_base_price?: number
          id?: string
          image_urls?: string[] | null
          is_active?: boolean | null
          is_digital?: boolean | null
          is_featured?: boolean | null
          is_hot_deal?: boolean | null
          mrp?: number | null
          name?: string
          price?: number
          product_type?: string
          shipping_charge?: number | null
          shopper_discount_percent?: number | null
          stock_quantity?: number | null
          tax_rate?: number | null
          unit?: string | null
          unit_quantity?: number | null
          updated_at?: string
          vendor_base_price?: number
          vendor_id?: string | null
          weight_grams?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          address_proof_url: string | null
          avatar_url: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          created_at: string
          custom_domain: string | null
          custom_domain_verification_token: string | null
          custom_domain_verified: boolean
          delivery_address: string | null
          delivery_city: string | null
          delivery_name: string | null
          delivery_phone: string | null
          delivery_pincode: string | null
          delivery_state: string | null
          email: string
          full_name: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["approval_status"] | null
          kyc_verified_at: string | null
          phone: string | null
          referred_by_dropshipper_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_proof_url?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_pincode?: string | null
          delivery_state?: string | null
          email: string
          full_name?: string | null
          id: string
          kyc_status?: Database["public"]["Enums"]["approval_status"] | null
          kyc_verified_at?: string | null
          phone?: string | null
          referred_by_dropshipper_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_proof_url?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_pincode?: string | null
          delivery_state?: string | null
          email?: string
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["approval_status"] | null
          kyc_verified_at?: string | null
          phone?: string | null
          referred_by_dropshipper_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_promoter_id_fkey"
            columns: ["referred_by_dropshipper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_backup_rename: {
        Row: {
          address: string | null
          address_proof_url: string | null
          avatar_url: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          created_at: string | null
          custom_domain: string | null
          custom_domain_verification_token: string | null
          custom_domain_verified: boolean | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_name: string | null
          delivery_phone: string | null
          delivery_pincode: string | null
          delivery_state: string | null
          email: string | null
          full_name: string | null
          id: string | null
          kyc_status: Database["public"]["Enums"]["approval_status"] | null
          kyc_verified_at: string | null
          phone: string | null
          referred_by_promoter_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_proof_url?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          created_at?: string | null
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_pincode?: string | null
          delivery_state?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          kyc_status?: Database["public"]["Enums"]["approval_status"] | null
          kyc_verified_at?: string | null
          phone?: string | null
          referred_by_promoter_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_proof_url?: string | null
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          created_at?: string | null
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          delivery_pincode?: string | null
          delivery_state?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          kyc_status?: Database["public"]["Enums"]["approval_status"] | null
          kyc_verified_at?: string | null
          phone?: string | null
          referred_by_promoter_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      referral_commission_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      referral_links: {
        Row: {
          clicks: number | null
          conversions: number | null
          created_at: string
          dropshipper_id: string
          expires_at: string | null
          id: string
          link_code: string
          product_id: string | null
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          dropshipper_id: string
          expires_at?: string | null
          id?: string
          link_code: string
          product_id?: string | null
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          dropshipper_id?: string
          expires_at?: string | null
          id?: string
          link_code?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          order_id: string
          pickup_address: Json | null
          pickup_scheduled_at: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string
          refund_amount: number | null
          refund_method: string | null
          refund_processed_at: string | null
          refund_transaction_id: string | null
          request_type: string
          return_carrier: string | null
          return_tracking_number: string | null
          return_tracking_url: string | null
          shipping_label_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          order_id: string
          pickup_address?: Json | null
          pickup_scheduled_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          refund_amount?: number | null
          refund_method?: string | null
          refund_processed_at?: string | null
          refund_transaction_id?: string | null
          request_type: string
          return_carrier?: string | null
          return_tracking_number?: string | null
          return_tracking_url?: string | null
          shipping_label_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          order_id?: string
          pickup_address?: Json | null
          pickup_scheduled_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          refund_amount?: number | null
          refund_method?: string | null
          refund_processed_at?: string | null
          refund_transaction_id?: string | null
          request_type?: string
          return_carrier?: string | null
          return_tracking_number?: string | null
          return_tracking_url?: string | null
          shipping_label_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          buyer_email: string | null
          commission_amount: number
          commission_rate: number
          created_at: string
          dropshipper_id: string
          id: string
          product_id: string
          quantity: number
          referral_link_id: string | null
          refunded_at: string | null
          status: string
          total_amount: number
          unit_price: number
        }
        Insert: {
          buyer_email?: string | null
          commission_amount: number
          commission_rate: number
          created_at?: string
          dropshipper_id: string
          id?: string
          product_id: string
          quantity?: number
          referral_link_id?: string | null
          refunded_at?: string | null
          status?: string
          total_amount: number
          unit_price: number
        }
        Update: {
          buyer_email?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          dropshipper_id?: string
          id?: string
          product_id?: string
          quantity?: number
          referral_link_id?: string | null
          refunded_at?: string | null
          status?: string
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          is_default: boolean | null
          label: string
          name: string
          phone: string
          pincode: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          name: string
          phone: string
          pincode: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          name?: string
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      showcase_shops: {
        Row: {
          auto_pay_failed: boolean | null
          auto_pay_failed_at: string | null
          banner_url: string | null
          billing_token: string | null
          billing_token_expires_at: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          owner_type: string
          premium_paid_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          selected_product_ids: string[] | null
          shop_name: string
          subscription_auto_renew: boolean | null
          subscription_expires_at: string | null
          subscription_plan_type: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_pay_failed?: boolean | null
          auto_pay_failed_at?: string | null
          banner_url?: string | null
          billing_token?: string | null
          billing_token_expires_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          owner_type: string
          premium_paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_product_ids?: string[] | null
          shop_name: string
          subscription_auto_renew?: boolean | null
          subscription_expires_at?: string | null
          subscription_plan_type?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_pay_failed?: boolean | null
          auto_pay_failed_at?: string | null
          banner_url?: string | null
          billing_token?: string | null
          billing_token_expires_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          owner_type?: string
          premium_paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          selected_product_ids?: string[] | null
          shop_name?: string
          subscription_auto_renew?: boolean | null
          subscription_expires_at?: string | null
          subscription_plan_type?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_replied_at: string | null
          admin_replied_by: string | null
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_replied_at?: string | null
          admin_replied_by?: string | null
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_replied_at?: string | null
          admin_replied_by?: string | null
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles_backup_rename: {
        Row: {
          created_at: string | null
          id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      vendor_applications: {
        Row: {
          business_address: string
          business_description: string
          business_name: string
          created_at: string
          gst_number: string | null
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_address: string
          business_description: string
          business_name: string
          created_at?: string
          gst_number?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_address?: string
          business_description?: string
          business_name?: string
          created_at?: string
          gst_number?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendor_earnings: {
        Row: {
          commission_deducted: number
          created_at: string
          id: string
          net_earning: number
          order_id: string
          product_id: string
          status: string
          total_amount: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          commission_deducted?: number
          created_at?: string
          id?: string
          net_earning: number
          order_id: string
          product_id: string
          status?: string
          total_amount: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          commission_deducted?: number
          created_at?: string
          id?: string
          net_earning?: number
          order_id?: string
          product_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_earnings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profiles: {
        Row: {
          business_name: string
          coverage_pincodes: string[] | null
          coverage_states: string[] | null
          created_at: string
          delivery_type: string
          gstin: string | null
          id: string
          pickup_address: string
          pickup_city: string
          pickup_email: string | null
          pickup_phone: string
          pickup_pincode: string
          pickup_state: string
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          business_name: string
          coverage_pincodes?: string[] | null
          coverage_states?: string[] | null
          created_at?: string
          delivery_type?: string
          gstin?: string | null
          id?: string
          pickup_address: string
          pickup_city: string
          pickup_email?: string | null
          pickup_phone: string
          pickup_pincode: string
          pickup_state: string
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          business_name?: string
          coverage_pincodes?: string[] | null
          coverage_states?: string[] | null
          created_at?: string
          delivery_type?: string
          gstin?: string | null
          id?: string
          pickup_address?: string
          pickup_city?: string
          pickup_email?: string | null
          pickup_phone?: string
          pickup_pincode?: string
          pickup_state?: string
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      video_ads: {
        Row: {
          created_at: string
          description: string | null
          dropshipper_id: string
          id: string
          product_id: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
          views_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          dropshipper_id: string
          id?: string
          product_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
          views_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          dropshipper_id?: string
          id?: string
          product_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_ads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          status?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          bank_details: Json | null
          created_at: string
          dropshipper_id: string
          id: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          bank_details?: Json | null
          created_at?: string
          dropshipper_id: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          bank_details?: Json | null
          created_at?: string
          dropshipper_id?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          transaction_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      showcase_shops_public: {
        Row: {
          banner_url: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          is_premium: boolean | null
          owner_type: string | null
          selected_product_ids: string[] | null
          shop_name: string | null
          subscription_auto_renew: boolean | null
          subscription_expires_at: string | null
          subscription_plan_type: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          owner_type?: string | null
          selected_product_ids?: string[] | null
          shop_name?: string | null
          subscription_auto_renew?: boolean | null
          subscription_expires_at?: string | null
          subscription_plan_type?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          owner_type?: string | null
          selected_product_ids?: string[] | null
          shop_name?: string | null
          subscription_auto_renew?: boolean | null
          subscription_expires_at?: string | null
          subscription_plan_type?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_digital_file_url: { Args: { _product_id: string }; Returns: string }
      get_profiles_for_manager: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          kyc_status: Database["public"]["Enums"]["approval_status"]
          phone: string
          referred_by_dropshipper_id: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_referral_clicks: {
        Args: { link_code: string }
        Returns: undefined
      }
      set_manager_password: {
        Args: { _manager_id: string; _plaintext: string }
        Returns: undefined
      }
      verify_manager_password: {
        Args: { _plaintext: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "buyer" | "dropshipper" | "manager" | "admin" | "vendor"
      approval_status: "pending" | "approved" | "rejected"
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
      app_role: ["buyer", "dropshipper", "manager", "admin", "vendor"],
      approval_status: ["pending", "approved", "rejected"],
    },
  },
} as const
