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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_name: string | null
          id: string
          module_name: string | null
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          action_type?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          module_name?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          action_type?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          module_name?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      b2b_applications: {
        Row: {
          admin_notes: string | null
          assigned_price_tier: string | null
          business_name: string
          business_proof_path: string | null
          business_type: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          current_brands: string | null
          data_consent: boolean | null
          expected_volume: string | null
          gst_certificate_path: string | null
          gst_number: string | null
          id: string
          mobile_number: string | null
          pincode: string | null
          preferred_dispatch: string | null
          preferred_dispatch_other_name: string | null
          registered_address: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          trade_declaration: boolean | null
          trade_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_price_tier?: string | null
          business_name: string
          business_proof_path?: string | null
          business_type?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_brands?: string | null
          data_consent?: boolean | null
          expected_volume?: string | null
          gst_certificate_path?: string | null
          gst_number?: string | null
          id?: string
          mobile_number?: string | null
          pincode?: string | null
          preferred_dispatch?: string | null
          preferred_dispatch_other_name?: string | null
          registered_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          trade_declaration?: boolean | null
          trade_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_price_tier?: string | null
          business_name?: string
          business_proof_path?: string | null
          business_type?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_brands?: string | null
          data_consent?: boolean | null
          expected_volume?: string | null
          gst_certificate_path?: string | null
          gst_number?: string | null
          id?: string
          mobile_number?: string | null
          pincode?: string | null
          preferred_dispatch?: string | null
          preferred_dispatch_other_name?: string | null
          registered_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          trade_declaration?: boolean | null
          trade_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
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
      companies: {
        Row: {
          allow_credit: boolean | null
          business_name: string
          business_volume: string | null
          courier_account_number: string | null
          created_at: string | null
          credit_limit: number | null
          current_balance: number | null
          discount_percentage: number | null
          gst_number: string | null
          id: string
          preferred_courier: string | null
          status: string | null
          wallet_balance: number | null
          website: string | null
        }
        Insert: {
          allow_credit?: boolean | null
          business_name: string
          business_volume?: string | null
          courier_account_number?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          discount_percentage?: number | null
          gst_number?: string | null
          id?: string
          preferred_courier?: string | null
          status?: string | null
          wallet_balance?: number | null
          website?: string | null
        }
        Update: {
          allow_credit?: boolean | null
          business_name?: string
          business_volume?: string | null
          courier_account_number?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          discount_percentage?: number | null
          gst_number?: string | null
          id?: string
          preferred_courier?: string | null
          status?: string | null
          wallet_balance?: number | null
          website?: string | null
        }
        Relationships: []
      }
      credit_requests: {
        Row: {
          company_id: string | null
          created_at: string | null
          credit_type: string | null
          id: string
          notes: string | null
          requested_amount: number
          requested_by: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          credit_type?: string | null
          id?: string
          notes?: string | null
          requested_amount: number
          requested_by?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          credit_type?: string | null
          id?: string
          notes?: string | null
          requested_amount?: number
          requested_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_addresses: {
        Row: {
          city: string
          company_id: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_default: boolean | null
          label: string
          pincode: string
          state: string
          street_address: string
          user_id: string | null
        }
        Insert: {
          city: string
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          label: string
          pincode: string
          state: string
          street_address: string
          user_id?: string | null
        }
        Update: {
          city?: string
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          pincode?: string
          state?: string
          street_address?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_cartons: {
        Row: {
          barcode_string: string
          box_number: number | null
          dispatch_id: string | null
          id: string
          order_id: string | null
          scanned_out_at: string | null
          status: string | null
          total_boxes: number | null
          weight_kg: number | null
        }
        Insert: {
          barcode_string: string
          box_number?: number | null
          dispatch_id?: string | null
          id?: string
          order_id?: string | null
          scanned_out_at?: string | null
          status?: string | null
          total_boxes?: number | null
          weight_kg?: number | null
        }
        Update: {
          barcode_string?: string
          box_number?: number | null
          dispatch_id?: string | null
          id?: string
          order_id?: string | null
          scanned_out_at?: string | null
          status?: string | null
          total_boxes?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_cartons_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_cartons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          company_id: string | null
          dispatch_date: string | null
          dispatch_number: string | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          order_id: string | null
          status: string | null
          tracking_number: string | null
          transporter_name: string | null
        }
        Insert: {
          company_id?: string | null
          dispatch_date?: string | null
          dispatch_number?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          order_id?: string | null
          status?: string | null
          tracking_number?: string | null
          transporter_name?: string | null
        }
        Update: {
          company_id?: string | null
          dispatch_date?: string | null
          dispatch_number?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          order_id?: string | null
          status?: string | null
          tracking_number?: string | null
          transporter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string | null
          created_at: string | null
          dispatch_id: string | null
          file_url: string | null
          id: string
          order_id: string | null
          type: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          dispatch_id?: string | null
          file_url?: string | null
          id?: string
          order_id?: string | null
          type?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          dispatch_id?: string | null
          file_url?: string | null
          id?: string
          order_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          exchange_rate: number
          id: string
          source_type: string | null
          target_currency: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_currency: string
          exchange_rate: number
          id?: string
          source_type?: string | null
          target_currency: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_currency?: string
          exchange_rate?: number
          id?: string
          source_type?: string | null
          target_currency?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      factory_holidays: {
        Row: {
          created_at: string | null
          description: string | null
          holiday_date: string
          id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          holiday_date: string
          id?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          holiday_date?: string
          id?: string
        }
        Relationships: []
      }
      factory_inventory: {
        Row: {
          id: string
          last_updated: string | null
          product_id: string | null
          quantity: number | null
        }
        Insert: {
          id?: string
          last_updated?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Update: {
          id?: string
          last_updated?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "factory_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_type: string | null
          created_at: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity: number | null
        }
        Insert: {
          adjustment_type?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Update: {
          adjustment_type?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          current_stock: number | null
          id: string
          last_restocked: string | null
          min_threshold: number | null
          name: string
          unit: string
        }
        Insert: {
          category: string
          current_stock?: number | null
          id?: string
          last_restocked?: string | null
          min_threshold?: number | null
          name: string
          unit: string
        }
        Update: {
          category?: string
          current_stock?: number | null
          id?: string
          last_restocked?: string | null
          min_threshold?: number | null
          name?: string
          unit?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string | null
          dispatch_id: string | null
          id: string
          invoice_number: string | null
          invoice_value: number | null
        }
        Insert: {
          created_at?: string | null
          dispatch_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_value?: number | null
        }
        Update: {
          created_at?: string | null
          dispatch_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      moq_rules: {
        Row: {
          carton_type: string | null
          category_id: string | null
          created_at: string
          customer_type: string | null
          id: string
          is_active: boolean | null
          min_quantity: number | null
          pack_size: string | null
          product_id: string | null
          rule_scope: string
          validation_mode: string | null
        }
        Insert: {
          carton_type?: string | null
          category_id?: string | null
          created_at?: string
          customer_type?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity?: number | null
          pack_size?: string | null
          product_id?: string | null
          rule_scope: string
          validation_mode?: string | null
        }
        Update: {
          carton_type?: string | null
          category_id?: string | null
          created_at?: string
          customer_type?: string | null
          id?: string
          is_active?: boolean | null
          min_quantity?: number | null
          pack_size?: string | null
          product_id?: string | null
          rule_scope?: string
          validation_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moq_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          message: string | null
          type: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          type?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          actual_packed_qty: number | null
          carton_type: string | null
          department: string | null
          id: string
          notes: string | null
          order_id: string | null
          pack_size: string | null
          product_id: string | null
          production_status: string | null
          quantity: number
          task_type: string | null
        }
        Insert: {
          actual_packed_qty?: number | null
          carton_type?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          pack_size?: string | null
          product_id?: string | null
          production_status?: string | null
          quantity?: number
          task_type?: string | null
        }
        Update: {
          actual_packed_qty?: number | null
          carton_type?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          pack_size?: string | null
          product_id?: string | null
          production_status?: string | null
          quantity?: number
          task_type?: string | null
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
      order_payments: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          payment_date: string | null
          payment_type: string
          reference_no: string | null
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          payment_date?: string | null
          payment_type: string
          reference_no?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          payment_date?: string | null
          payment_type?: string
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string | null
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_despatch_date: string | null
          admin_promised_date: string | null
          advance_paid: number | null
          advance_required: number | null
          closed_at: string | null
          closed_by: string | null
          company_id: string | null
          country_of_origin: string | null
          courier_name: string | null
          created_at: string | null
          dispatch_urgency: string | null
          document_stage: string | null
          estimated_despatch_date: string | null
          eway_bill_number: string | null
          eway_bill_url: string | null
          final_invoice_url: string | null
          gate_pass_number: string | null
          id: string
          is_export: boolean | null
          payment_cleared: boolean | null
          payment_receipt_url: string | null
          payment_status: string | null
          port_of_discharge: string | null
          proforma_invoice_url: string | null
          requested_dispatch_date: string | null
          sales_order_value: number | null
          status: string
          system_estimated_date: string | null
          tracking_number: string | null
        }
        Insert: {
          actual_despatch_date?: string | null
          admin_promised_date?: string | null
          advance_paid?: number | null
          advance_required?: number | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          country_of_origin?: string | null
          courier_name?: string | null
          created_at?: string | null
          dispatch_urgency?: string | null
          document_stage?: string | null
          estimated_despatch_date?: string | null
          eway_bill_number?: string | null
          eway_bill_url?: string | null
          final_invoice_url?: string | null
          gate_pass_number?: string | null
          id?: string
          is_export?: boolean | null
          payment_cleared?: boolean | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          port_of_discharge?: string | null
          proforma_invoice_url?: string | null
          requested_dispatch_date?: string | null
          sales_order_value?: number | null
          status?: string
          system_estimated_date?: string | null
          tracking_number?: string | null
        }
        Update: {
          actual_despatch_date?: string | null
          admin_promised_date?: string | null
          advance_paid?: number | null
          advance_required?: number | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          country_of_origin?: string | null
          courier_name?: string | null
          created_at?: string | null
          dispatch_urgency?: string | null
          document_stage?: string | null
          estimated_despatch_date?: string | null
          eway_bill_number?: string | null
          eway_bill_url?: string | null
          final_invoice_url?: string | null
          gate_pass_number?: string | null
          id?: string
          is_export?: boolean | null
          payment_cleared?: boolean | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          port_of_discharge?: string | null
          proforma_invoice_url?: string | null
          requested_dispatch_date?: string | null
          sales_order_value?: number | null
          status?: string
          system_estimated_date?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_lists: {
        Row: {
          carton_type: string | null
          dispatch_id: string | null
          id: string
          order_item_id: string | null
          pack_size: string | null
          packed_quantity: number
          product_id: string | null
        }
        Insert: {
          carton_type?: string | null
          dispatch_id?: string | null
          id?: string
          order_item_id?: string | null
          pack_size?: string | null
          packed_quantity?: number
          product_id?: string | null
        }
        Update: {
          carton_type?: string | null
          dispatch_id?: string | null
          id?: string
          order_item_id?: string | null
          pack_size?: string | null
          packed_quantity?: number
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_lists_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_lists_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_lists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string | null
          id: string
          module_name: string
          permission_key: string
          permission_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_name: string
          permission_key: string
          permission_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_name?: string
          permission_key?: string
          permission_name?: string
        }
        Relationships: []
      }
      portal_access_invites: {
        Row: {
          accepted_at: string | null
          application_id: string | null
          company_id: string | null
          created_at: string | null
          id: string
          invite_email: string
          notes: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          application_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          invite_email: string
          notes?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          application_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          invite_email?: string
          notes?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_invites_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "b2b_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_slabs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          slab_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          slab_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          slab_name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          allergen_warnings: string | null
          avg_weight_per_pack: number | null
          avg_weight_per_pc: number | null
          barcode_sku: string | null
          base_price: number | null
          carton_type: string | null
          category: string
          category_id: string | null
          created_at: string | null
          default_store: string | null
          department: string | null
          description: string | null
          dietary_tags: string[] | null
          festival_tags: string | null
          gross_weight_grams: number | null
          gst_percentage: number | null
          gst_rate: number | null
          hsn_code: string
          id: string
          image_url: string | null
          ingredients: string | null
          is_active: boolean
          moq: number | null
          moq_packs: number | null
          mrp: number | null
          mrp_per_pc: number | null
          name: string
          net_weight_grams: number | null
          nutrition_facts: string | null
          nutritional_info: Json | null
          pack_size: string | null
          packs_per_carton: number | null
          packs_per_master_carton: number | null
          pcs_per_master_carton: number | null
          price_b2b: number | null
          price_bulk: number | null
          price_horeca: number | null
          price_per_kg: number | null
          price_special: number | null
          price_wholesale: number | null
          primary_pack_weight_kg: number
          private_label_moq: number | null
          private_label_price: number | null
          shelf_life: string | null
          shelf_life_days: number | null
          sku: string
          storage_instructions: string | null
          storage_type: string | null
          sub_category: string | null
          uom: string | null
          weight_per_pc_grams: number | null
          wholesale_price: number | null
        }
        Insert: {
          allergen_warnings?: string | null
          avg_weight_per_pack?: number | null
          avg_weight_per_pc?: number | null
          barcode_sku?: string | null
          base_price?: number | null
          carton_type?: string | null
          category: string
          category_id?: string | null
          created_at?: string | null
          default_store?: string | null
          department?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          festival_tags?: string | null
          gross_weight_grams?: number | null
          gst_percentage?: number | null
          gst_rate?: number | null
          hsn_code: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean
          moq?: number | null
          moq_packs?: number | null
          mrp?: number | null
          mrp_per_pc?: number | null
          name: string
          net_weight_grams?: number | null
          nutrition_facts?: string | null
          nutritional_info?: Json | null
          pack_size?: string | null
          packs_per_carton?: number | null
          packs_per_master_carton?: number | null
          pcs_per_master_carton?: number | null
          price_b2b?: number | null
          price_bulk?: number | null
          price_horeca?: number | null
          price_per_kg?: number | null
          price_special?: number | null
          price_wholesale?: number | null
          primary_pack_weight_kg?: number
          private_label_moq?: number | null
          private_label_price?: number | null
          shelf_life?: string | null
          shelf_life_days?: number | null
          sku: string
          storage_instructions?: string | null
          storage_type?: string | null
          sub_category?: string | null
          uom?: string | null
          weight_per_pc_grams?: number | null
          wholesale_price?: number | null
        }
        Update: {
          allergen_warnings?: string | null
          avg_weight_per_pack?: number | null
          avg_weight_per_pc?: number | null
          barcode_sku?: string | null
          base_price?: number | null
          carton_type?: string | null
          category?: string
          category_id?: string | null
          created_at?: string | null
          default_store?: string | null
          department?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          festival_tags?: string | null
          gross_weight_grams?: number | null
          gst_percentage?: number | null
          gst_rate?: number | null
          hsn_code?: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean
          moq?: number | null
          moq_packs?: number | null
          mrp?: number | null
          mrp_per_pc?: number | null
          name?: string
          net_weight_grams?: number | null
          nutrition_facts?: string | null
          nutritional_info?: Json | null
          pack_size?: string | null
          packs_per_carton?: number | null
          packs_per_master_carton?: number | null
          pcs_per_master_carton?: number | null
          price_b2b?: number | null
          price_bulk?: number | null
          price_horeca?: number | null
          price_per_kg?: number | null
          price_special?: number | null
          price_wholesale?: number | null
          primary_pack_weight_kg?: number
          private_label_moq?: number | null
          private_label_price?: number | null
          shelf_life?: string | null
          shelf_life_days?: number | null
          sku?: string
          storage_instructions?: string | null
          storage_type?: string | null
          sub_category?: string | null
          uom?: string | null
          weight_per_pc_grams?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          credit_limit: number | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean | null
          mobile_number: string | null
          price_tier: string | null
          role: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          credit_limit?: number | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean | null
          mobile_number?: string | null
          price_tier?: string | null
          role?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          credit_limit?: number | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          mobile_number?: string | null
          price_tier?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permission_map: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string | null
          role_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_map_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permission_map_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          role_key: string
          role_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role_key: string
          role_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role_key?: string
          role_name?: string
        }
        Relationships: []
      }
      stock_logs: {
        Row: {
          created_at: string | null
          id: string
          item_id: string | null
          notes: string | null
          quantity_added: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          notes?: string | null
          quantity_added: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          notes?: string | null
          quantity_added?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      store_requisition_items: {
        Row: {
          fulfilled_qty: number | null
          id: string
          product_id: string
          requested_qty: number
          requisition_id: string
        }
        Insert: {
          fulfilled_qty?: number | null
          id?: string
          product_id: string
          requested_qty: number
          requisition_id: string
        }
        Update: {
          fulfilled_qty?: number | null
          id?: string
          product_id?: string
          requested_qty?: number
          requisition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_requisition_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "store_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      store_requisitions: {
        Row: {
          created_at: string | null
          fulfilled_at: string | null
          id: string
          notes: string | null
          order_id: string
          status: string | null
          target_store: string
        }
        Insert: {
          created_at?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          status?: string | null
          target_store: string
        }
        Update: {
          created_at?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          status?: string | null
          target_store?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_requisitions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          issue_type: string
          order_id: string
          resolution_notes: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          issue_type: string
          order_id: string
          resolution_notes?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          issue_type?: string
          order_id?: string
          resolution_notes?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          global_buffer_days: number | null
          id: number
          updated_at: string | null
        }
        Insert: {
          global_buffer_days?: number | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          global_buffer_days?: number | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          issue_type: string | null
          order_id: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          issue_type?: string | null
          order_id?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          issue_type?: string | null
          order_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          product_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_map: {
        Row: {
          created_at: string | null
          id: string
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_role_map_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_map_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          company_id: string | null
          created_at: string | null
          department: string | null
          designation: string | null
          email: string | null
          full_name: string | null
          id: string
          invite_status: string | null
          is_active: boolean | null
          joined_at: string | null
          mobile_number: string | null
          name: string | null
          phone: string | null
          preferred_language: string | null
          role: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          invite_status?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          mobile_number?: string | null
          name?: string | null
          phone?: string | null
          preferred_language?: string | null
          role: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          invite_status?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          mobile_number?: string | null
          name?: string | null
          phone?: string | null
          preferred_language?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          id: string
          reference: string | null
          type: string | null
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          id?: string
          reference?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          id?: string
          reference?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
