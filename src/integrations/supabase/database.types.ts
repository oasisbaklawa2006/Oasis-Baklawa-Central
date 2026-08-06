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
      access_permissions: {
        Row: {
          created_at: string
          description: string
          is_active: boolean
          permission_key: string
          requires_step_up: boolean
          risk_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          is_active?: boolean
          permission_key: string
          requires_step_up?: boolean
          risk_level?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          is_active?: boolean
          permission_key?: string
          requires_step_up?: boolean
          risk_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_manual_entries: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_snapshot_url: string | null
          role_target: string | null
          step_order: number | null
          tool_name: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_snapshot_url?: string | null
          role_target?: string | null
          step_order?: number | null
          tool_name?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_snapshot_url?: string | null
          role_target?: string | null
          step_order?: number | null
          tool_name?: string | null
        }
        Relationships: []
      }
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
      archive_logs: {
        Row: {
          action_type: string | null
          actor_id: string | null
          archived_at: string
          created_at: string
          entity_id: string | null
          entity_name: string | null
          id: string
          module_name: string | null
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          risk_level: string | null
        }
        Insert: {
          action_type?: string | null
          actor_id?: string | null
          archived_at?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          module_name?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          risk_level?: string | null
        }
        Update: {
          action_type?: string | null
          actor_id?: string | null
          archived_at?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          module_name?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          risk_level?: string | null
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
          risk_level: string | null
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
          risk_level?: string | null
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
          risk_level?: string | null
        }
        Relationships: []
      }
      auth_logs: {
        Row: {
          channel: string | null
          created_at: string
          description: string | null
          event_name: string | null
          event_type: string | null
          failure_reason: string | null
          id: string
          phone: string | null
          raw_payload: Json | null
          request_id: string | null
          status: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          description?: string | null
          event_name?: string | null
          event_type?: string | null
          failure_reason?: string | null
          id?: string
          phone?: string | null
          raw_payload?: Json | null
          request_id?: string | null
          status?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          description?: string | null
          event_name?: string | null
          event_type?: string | null
          failure_reason?: string | null
          id?: string
          phone?: string | null
          raw_payload?: Json | null
          request_id?: string | null
          status?: string | null
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
          requested_info_at: string | null
          requested_info_note: string | null
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
          requested_info_at?: string | null
          requested_info_note?: string | null
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
          requested_info_at?: string | null
          requested_info_note?: string | null
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
      b2b_assembly_components: {
        Row: {
          assembly_job_id: string
          consumed_qty: number
          created_at: string
          id: string
          issued_qty: number
          product_id: string
          required_qty: number
          reserved_qty: number
          returned_qty: number
          sku: string
          source_store_code: string
          wasted_qty: number
        }
        Insert: {
          assembly_job_id: string
          consumed_qty?: number
          created_at?: string
          id?: string
          issued_qty?: number
          product_id: string
          required_qty: number
          reserved_qty?: number
          returned_qty?: number
          sku: string
          source_store_code: string
          wasted_qty?: number
        }
        Update: {
          assembly_job_id?: string
          consumed_qty?: number
          created_at?: string
          id?: string
          issued_qty?: number
          product_id?: string
          required_qty?: number
          reserved_qty?: number
          returned_qty?: number
          sku?: string
          source_store_code?: string
          wasted_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "b2b_assembly_components_assembly_job_id_fkey"
            columns: ["assembly_job_id"]
            isOneToOne: false
            referencedRelation: "b2b_assembly_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_assembly_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_assembly_components_source_store_code_fkey"
            columns: ["source_store_code"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      b2b_assembly_jobs: {
        Row: {
          accepted_qty: number
          assembly_job_number: string
          completed_at: string | null
          completed_by: string | null
          completed_qty: number
          correlation_id: string
          created_at: string
          id: string
          order_id: string
          output_product_id: string
          output_sku: string
          planned_qty: number
          qc_accepted_by: string | null
          rejected_qty: number
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_qty?: number
          assembly_job_number: string
          completed_at?: string | null
          completed_by?: string | null
          completed_qty?: number
          correlation_id: string
          created_at?: string
          id?: string
          order_id: string
          output_product_id: string
          output_sku: string
          planned_qty: number
          qc_accepted_by?: string | null
          rejected_qty?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_qty?: number
          assembly_job_number?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_qty?: number
          correlation_id?: string
          created_at?: string
          id?: string
          order_id?: string
          output_product_id?: string
          output_sku?: string
          planned_qty?: number
          qc_accepted_by?: string | null
          rejected_qty?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_assembly_jobs_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_assembly_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_assembly_jobs_output_product_id_fkey"
            columns: ["output_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_assembly_jobs_qc_accepted_by_fkey"
            columns: ["qc_accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_assembly_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_carton_items: {
        Row: {
          barcode_value: string
          batch_lot: string
          carton_id: string
          consignment_line_id: string
          created_at: string
          expiry_date: string | null
          id: string
          order_item_id: string
          product_code: string
          product_id: string
          quantity: number
          scan_device_id: string | null
          scan_status: string
          scanned_at: string
          scanned_by: string | null
          uom: string
        }
        Insert: {
          barcode_value: string
          batch_lot: string
          carton_id: string
          consignment_line_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          order_item_id: string
          product_code: string
          product_id: string
          quantity: number
          scan_device_id?: string | null
          scan_status?: string
          scanned_at?: string
          scanned_by?: string | null
          uom: string
        }
        Update: {
          barcode_value?: string
          batch_lot?: string
          carton_id?: string
          consignment_line_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          order_item_id?: string
          product_code?: string
          product_id?: string
          quantity?: number
          scan_device_id?: string | null
          scan_status?: string
          scanned_at?: string
          scanned_by?: string | null
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_carton_items_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_carton_items_consignment_line_id_fkey"
            columns: ["consignment_line_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignment_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_carton_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_so_line_fulfilment"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_carton_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_carton_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_cartons: {
        Row: {
          carton_code: string
          carton_sequence: number
          consignment_id: string
          created_at: string
          current_version: number
          gross_weight: number | null
          handling_labels: Json
          id: string
          locked_at: string | null
          locked_by: string | null
          net_weight: number | null
          open_photo_ref: string | null
          physical_location: string
          reopen_count: number
          seal_reference: string | null
          status: string
          updated_at: string
          weight_uom: string
        }
        Insert: {
          carton_code: string
          carton_sequence: number
          consignment_id: string
          created_at?: string
          current_version?: number
          gross_weight?: number | null
          handling_labels?: Json
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          net_weight?: number | null
          open_photo_ref?: string | null
          physical_location?: string
          reopen_count?: number
          seal_reference?: string | null
          status?: string
          updated_at?: string
          weight_uom?: string
        }
        Update: {
          carton_code?: string
          carton_sequence?: number
          consignment_id?: string
          created_at?: string
          current_version?: number
          gross_weight?: number | null
          handling_labels?: Json
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          net_weight?: number | null
          open_photo_ref?: string | null
          physical_location?: string
          reopen_count?: number
          seal_reference?: string | null
          status?: string
          updated_at?: string
          weight_uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_cartons_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_cartons_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_consignment_lines: {
        Row: {
          accepted_ready_qty: number
          consignment_id: string
          created_at: string
          delivered_qty: number
          dispatched_qty: number
          held_qty: number
          id: string
          loaded_qty: number
          order_item_id: string
          original_order_qty: number
          packed_qty: number
          product_code: string
          product_id: string
          rejected_qty: number
          selected_qty: number
          uom: string
          updated_at: string
        }
        Insert: {
          accepted_ready_qty?: number
          consignment_id: string
          created_at?: string
          delivered_qty?: number
          dispatched_qty?: number
          held_qty?: number
          id?: string
          loaded_qty?: number
          order_item_id: string
          original_order_qty: number
          packed_qty?: number
          product_code: string
          product_id: string
          rejected_qty?: number
          selected_qty: number
          uom: string
          updated_at?: string
        }
        Update: {
          accepted_ready_qty?: number
          consignment_id?: string
          created_at?: string
          delivered_qty?: number
          dispatched_qty?: number
          held_qty?: number
          id?: string
          loaded_qty?: number
          order_item_id?: string
          original_order_qty?: number
          packed_qty?: number
          product_code?: string
          product_id?: string
          rejected_qty?: number
          selected_qty?: number
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_consignment_lines_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_consignment_lines_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_consignment_lines_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_so_line_fulfilment"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_consignment_lines_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_consignment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_consignments: {
        Row: {
          actual_departure_at: string | null
          approved_by: string | null
          committed_cutoff: string | null
          consignment_number: string
          correlation_id: string
          created_at: string
          created_by: string | null
          customer_instruction_ref: string | null
          destination_snapshot: Json
          dispatch_mode: string
          fragmentation_origin: string | null
          fragmentation_reason: string | null
          handling_instructions: Json
          id: string
          order_id: string
          planned_departure_at: string | null
          sequence_number: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_departure_at?: string | null
          approved_by?: string | null
          committed_cutoff?: string | null
          consignment_number: string
          correlation_id: string
          created_at?: string
          created_by?: string | null
          customer_instruction_ref?: string | null
          destination_snapshot?: Json
          dispatch_mode: string
          fragmentation_origin?: string | null
          fragmentation_reason?: string | null
          handling_instructions?: Json
          id?: string
          order_id: string
          planned_departure_at?: string | null
          sequence_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_departure_at?: string | null
          approved_by?: string | null
          committed_cutoff?: string | null
          consignment_number?: string
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          customer_instruction_ref?: string | null
          destination_snapshot?: Json
          dispatch_mode?: string
          fragmentation_origin?: string | null
          fragmentation_reason?: string | null
          handling_instructions?: Json
          id?: string
          order_id?: string
          planned_departure_at?: string | null
          sequence_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_consignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          authority_id: string | null
          carton_id: string | null
          consignment_id: string | null
          correlation_id: string
          created_at: string
          custodian_id: string | null
          device_event_at: string | null
          device_id: string | null
          document_version_id: string | null
          event_type: string
          evidence_refs: Json
          id: string
          location_code: string | null
          metadata: Json
          new_status: string | null
          old_status: string | null
          order_id: string
          order_item_id: string | null
          quantity: number | null
          reason: string | null
          server_event_at: string
          shipment_id: string | null
          source_record_id: string | null
          source_record_type: string | null
          uom: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          authority_id?: string | null
          carton_id?: string | null
          consignment_id?: string | null
          correlation_id: string
          created_at?: string
          custodian_id?: string | null
          device_event_at?: string | null
          device_id?: string | null
          document_version_id?: string | null
          event_type: string
          evidence_refs?: Json
          id?: string
          location_code?: string | null
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          order_id: string
          order_item_id?: string | null
          quantity?: number | null
          reason?: string | null
          server_event_at?: string
          shipment_id?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          uom?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          authority_id?: string | null
          carton_id?: string | null
          consignment_id?: string | null
          correlation_id?: string
          created_at?: string
          custodian_id?: string | null
          device_event_at?: string | null
          device_id?: string | null
          document_version_id?: string | null
          event_type?: string
          evidence_refs?: Json
          id?: string
          location_code?: string | null
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          order_id?: string
          order_item_id?: string | null
          quantity?: number | null
          reason?: string | null
          server_event_at?: string
          shipment_id?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_events_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_events_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_events_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_events_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_packing_list_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_so_line_fulfilment"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_exceptions: {
        Row: {
          carton_id: string | null
          commitment_effect: string | null
          consignment_id: string | null
          correlation_id: string
          created_at: string
          decision_authority: string | null
          detected_at: string
          evidence_ref: string
          exception_type: string
          final_disposition: string | null
          id: string
          order_id: string
          owner_id: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          severity: string
          source_department: string | null
          status: string
          updated_at: string
        }
        Insert: {
          carton_id?: string | null
          commitment_effect?: string | null
          consignment_id?: string | null
          correlation_id: string
          created_at?: string
          decision_authority?: string | null
          detected_at?: string
          evidence_ref: string
          exception_type: string
          final_disposition?: string | null
          id?: string
          order_id: string
          owner_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          severity: string
          source_department?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          carton_id?: string | null
          commitment_effect?: string | null
          consignment_id?: string | null
          correlation_id?: string
          created_at?: string
          decision_authority?: string | null
          detected_at?: string
          evidence_ref?: string
          exception_type?: string
          final_disposition?: string | null
          id?: string
          order_id?: string
          owner_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          severity?: string
          source_department?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_exceptions_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_exceptions_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_exceptions_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_handoff_lines: {
        Row: {
          accepted_qty: number
          batch_lot: string | null
          created_at: string
          declared_qty: number
          discrepancy_reason: string | null
          expiry_date: string | null
          handoff_id: string
          held_qty: number
          id: string
          order_item_id: string
          physically_received_qty: number
          product_code: string
          product_id: string
          rejected_qty: number
          uom: string
        }
        Insert: {
          accepted_qty?: number
          batch_lot?: string | null
          created_at?: string
          declared_qty: number
          discrepancy_reason?: string | null
          expiry_date?: string | null
          handoff_id: string
          held_qty?: number
          id?: string
          order_item_id: string
          physically_received_qty?: number
          product_code: string
          product_id: string
          rejected_qty?: number
          uom: string
        }
        Update: {
          accepted_qty?: number
          batch_lot?: string | null
          created_at?: string
          declared_qty?: number
          discrepancy_reason?: string | null
          expiry_date?: string | null
          handoff_id?: string
          held_qty?: number
          id?: string
          order_item_id?: string
          physically_received_qty?: number
          product_code?: string
          product_id?: string
          rejected_qty?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_handoff_lines_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_handoff_lines_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_so_line_fulfilment"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_handoff_lines_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_handoff_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_handoffs: {
        Row: {
          consignment_id: string | null
          correlation_id: string
          created_at: string
          declared_at: string
          destination_location: string
          handoff_number: string
          id: string
          issued_by: string | null
          notes: string | null
          order_id: string
          received_at: string | null
          received_by: string | null
          source_department: string
          source_location: string
          status: string
          updated_at: string
        }
        Insert: {
          consignment_id?: string | null
          correlation_id: string
          created_at?: string
          declared_at?: string
          destination_location?: string
          handoff_number: string
          id?: string
          issued_by?: string | null
          notes?: string | null
          order_id: string
          received_at?: string | null
          received_by?: string | null
          source_department: string
          source_location: string
          status?: string
          updated_at?: string
        }
        Update: {
          consignment_id?: string | null
          correlation_id?: string
          created_at?: string
          declared_at?: string
          destination_location?: string
          handoff_number?: string
          id?: string
          issued_by?: string | null
          notes?: string | null
          order_id?: string
          received_at?: string | null
          received_by?: string | null
          source_department?: string
          source_location?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_handoffs_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_handoffs_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_handoffs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_load_scans: {
        Row: {
          carton_id: string
          correlation_id: string
          created_at: string
          device_id: string | null
          id: string
          scan_result: string
          scanned_at: string
          scanned_by: string | null
          shipment_id: string
        }
        Insert: {
          carton_id: string
          correlation_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          scan_result: string
          scanned_at?: string
          scanned_by?: string | null
          shipment_id: string
        }
        Update: {
          carton_id?: string
          correlation_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          scan_result?: string
          scanned_at?: string
          scanned_by?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_load_scans_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_load_scans_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_packing_list_versions: {
        Row: {
          consignment_id: string
          correlation_id: string
          document_ref: string | null
          finance_check_state: string
          generated_at: string
          generated_by: string | null
          id: string
          physical_truth_snapshot: Json
          status: string
          submitted_to_finance_at: string | null
          superseded_by: string | null
          version_number: number
        }
        Insert: {
          consignment_id: string
          correlation_id: string
          document_ref?: string | null
          finance_check_state?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          physical_truth_snapshot?: Json
          status?: string
          submitted_to_finance_at?: string | null
          superseded_by?: string | null
          version_number: number
        }
        Update: {
          consignment_id?: string
          correlation_id?: string
          document_ref?: string | null
          finance_check_state?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          physical_truth_snapshot?: Json
          status?: string
          submitted_to_finance_at?: string | null
          superseded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_packing_list_versions_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_packing_list_versions_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_packing_list_versions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_packing_list_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_product_scan_events: {
        Row: {
          barcode_value: string
          carton_id: string
          correlation_id: string
          created_at: string
          device_id: string | null
          id: string
          reason: string | null
          resolved_batch_lot: string | null
          resolved_product_id: string | null
          scan_result: string
          scanned_at: string
          scanned_by: string | null
        }
        Insert: {
          barcode_value: string
          carton_id: string
          correlation_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          reason?: string | null
          resolved_batch_lot?: string | null
          resolved_product_id?: string | null
          scan_result: string
          scanned_at?: string
          scanned_by?: string | null
        }
        Update: {
          barcode_value?: string
          carton_id?: string
          correlation_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          reason?: string | null
          resolved_batch_lot?: string | null
          resolved_product_id?: string | null
          scan_result?: string
          scanned_at?: string
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_product_scan_events_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_product_scan_events_resolved_product_id_fkey"
            columns: ["resolved_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_quality_checks: {
        Row: {
          carton_id: string | null
          check_family: string
          checked_at: string
          checked_by: string | null
          checklist_version: string
          correlation_id: string
          created_at: string
          evidence_ref: string | null
          exception_type: string | null
          handoff_id: string | null
          id: string
          policy_snapshot: Json
          responsible_source: string | null
          result: string
          sampled_qty: number | null
          severity: string | null
        }
        Insert: {
          carton_id?: string | null
          check_family: string
          checked_at?: string
          checked_by?: string | null
          checklist_version: string
          correlation_id: string
          created_at?: string
          evidence_ref?: string | null
          exception_type?: string | null
          handoff_id?: string | null
          id?: string
          policy_snapshot?: Json
          responsible_source?: string | null
          result: string
          sampled_qty?: number | null
          severity?: string | null
        }
        Update: {
          carton_id?: string | null
          check_family?: string
          checked_at?: string
          checked_by?: string | null
          checklist_version?: string
          correlation_id?: string
          created_at?: string
          evidence_ref?: string | null
          exception_type?: string | null
          handoff_id?: string | null
          id?: string
          policy_snapshot?: Json
          responsible_source?: string | null
          result?: string
          sampled_qty?: number | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_quality_checks_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_quality_checks_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_releases: {
        Row: {
          consignment_id: string
          correlation_id: string
          created_at: string
          expires_at: string | null
          finance_evidence_ref: string | null
          id: string
          invoice_reference: string | null
          packing_list_version_id: string
          pi_reference: string | null
          release_state: string
          released_at: string | null
          released_by: string | null
        }
        Insert: {
          consignment_id: string
          correlation_id: string
          created_at?: string
          expires_at?: string | null
          finance_evidence_ref?: string | null
          id?: string
          invoice_reference?: string | null
          packing_list_version_id: string
          pi_reference?: string | null
          release_state: string
          released_at?: string | null
          released_by?: string | null
        }
        Update: {
          consignment_id?: string
          correlation_id?: string
          created_at?: string
          expires_at?: string | null
          finance_evidence_ref?: string | null
          id?: string
          invoice_reference?: string | null
          packing_list_version_id?: string
          pi_reference?: string | null
          release_state?: string
          released_at?: string | null
          released_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_releases_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_releases_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_dispatch_releases_packing_list_version_id_fkey"
            columns: ["packing_list_version_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_packing_list_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_residual_closures: {
        Row: {
          approved_at: string
          approved_by: string
          approved_closed_qty: number
          correlation_id: string
          created_at: string
          customer_evidence_ref: string
          finance_adjustment_ref: string
          id: string
          order_item_id: string
          reason: string
          requested_by: string | null
        }
        Insert: {
          approved_at?: string
          approved_by: string
          approved_closed_qty: number
          correlation_id: string
          created_at?: string
          customer_evidence_ref: string
          finance_adjustment_ref: string
          id?: string
          order_item_id: string
          reason: string
          requested_by?: string | null
        }
        Update: {
          approved_at?: string
          approved_by?: string
          approved_closed_qty?: number
          correlation_id?: string
          created_at?: string
          customer_evidence_ref?: string
          finance_adjustment_ref?: string
          id?: string
          order_item_id?: string
          reason?: string
          requested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_residual_closures_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_so_line_fulfilment"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_residual_closures_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_shipments: {
        Row: {
          consignment_id: string
          correlation_id: string
          created_at: string
          delivered_at: string | null
          delivery_state: string
          departed_at: string | null
          driver_name: string | null
          driver_phone: string | null
          gate_arrival_ref: string | null
          gate_exit_ref: string | null
          id: string
          loaded_at: string | null
          loading_evidence_ref: string | null
          pod_ref: string | null
          shipment_number: string
          tracking_lr_awb: string | null
          transporter_ack_ref: string | null
          transporter_name: string | null
          updated_at: string
          vehicle_number: string | null
          vehicle_suitability_state: string
        }
        Insert: {
          consignment_id: string
          correlation_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_state?: string
          departed_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          gate_arrival_ref?: string | null
          gate_exit_ref?: string | null
          id?: string
          loaded_at?: string | null
          loading_evidence_ref?: string | null
          pod_ref?: string | null
          shipment_number: string
          tracking_lr_awb?: string | null
          transporter_ack_ref?: string | null
          transporter_name?: string | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_suitability_state?: string
        }
        Update: {
          consignment_id?: string
          correlation_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_state?: string
          departed_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          gate_arrival_ref?: string | null
          gate_exit_ref?: string | null
          id?: string
          loaded_at?: string | null
          loading_evidence_ref?: string | null
          pod_ref?: string | null
          shipment_number?: string
          tracking_lr_awb?: string | null
          transporter_ack_ref?: string | null
          transporter_name?: string | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_suitability_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_shipments_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: true
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_dispatch_shipments_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: true
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_inventory_bins: {
        Row: {
          active: boolean
          bin_code: string
          capacity_qty: number | null
          created_at: string
          id: string
          rack_code: string
          shelf_code: string
          storage_class: string
          store_code: string
          zone_code: string
        }
        Insert: {
          active?: boolean
          bin_code: string
          capacity_qty?: number | null
          created_at?: string
          id?: string
          rack_code: string
          shelf_code: string
          storage_class?: string
          store_code: string
          zone_code: string
        }
        Update: {
          active?: boolean
          bin_code?: string
          capacity_qty?: number | null
          created_at?: string
          id?: string
          rack_code?: string
          shelf_code?: string
          storage_class?: string
          store_code?: string
          zone_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_inventory_bins_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      b2b_inventory_grns: {
        Row: {
          correlation_id: string
          created_at: string
          finalised_at: string | null
          finalised_by: string | null
          grn_number: string
          id: string
          receipt_id: string
          reversal_grn_id: string | null
          reversal_reason: string | null
          status: string
          stock_posted_at: string | null
          stock_posted_by: string | null
        }
        Insert: {
          correlation_id: string
          created_at?: string
          finalised_at?: string | null
          finalised_by?: string | null
          grn_number: string
          id?: string
          receipt_id: string
          reversal_grn_id?: string | null
          reversal_reason?: string | null
          status?: string
          stock_posted_at?: string | null
          stock_posted_by?: string | null
        }
        Update: {
          correlation_id?: string
          created_at?: string
          finalised_at?: string | null
          finalised_by?: string | null
          grn_number?: string
          id?: string
          receipt_id?: string
          reversal_grn_id?: string | null
          reversal_reason?: string | null
          status?: string
          stock_posted_at?: string | null
          stock_posted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_inventory_grns_finalised_by_fkey"
            columns: ["finalised_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_grns_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "b2b_gate_store_reconciliation"
            referencedColumns: ["receipt_id"]
          },
          {
            foreignKeyName: "b2b_inventory_grns_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_grns_reversal_grn_id_fkey"
            columns: ["reversal_grn_id"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_grns_stock_posted_by_fkey"
            columns: ["stock_posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_inventory_item_profiles: {
        Row: {
          b2b_relevant: boolean
          b2b_saleable: boolean
          branding_status: string | null
          created_at: string
          id: string
          item_class: string
          may_issue_to_assembly: boolean
          may_issue_to_production: boolean
          metadata: Json
          primary_store_code: string
          product_id: string
          provenance_required: boolean
          sku: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          b2b_relevant?: boolean
          b2b_saleable?: boolean
          branding_status?: string | null
          created_at?: string
          id?: string
          item_class: string
          may_issue_to_assembly?: boolean
          may_issue_to_production?: boolean
          metadata?: Json
          primary_store_code: string
          product_id: string
          provenance_required?: boolean
          sku: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          b2b_relevant?: boolean
          b2b_saleable?: boolean
          branding_status?: string | null
          created_at?: string
          id?: string
          item_class?: string
          may_issue_to_assembly?: boolean
          may_issue_to_production?: boolean
          metadata?: Json
          primary_store_code?: string
          product_id?: string
          provenance_required?: boolean
          sku?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_inventory_item_profiles_primary_store_code_fkey"
            columns: ["primary_store_code"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_stores"
            referencedColumns: ["store_code"]
          },
          {
            foreignKeyName: "b2b_inventory_item_profiles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_inventory_putaway_tasks: {
        Row: {
          allocated_qty: number
          assigned_to: string | null
          bin_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          disposition: string
          exception_reason: string | null
          id: string
          placed_qty: number
          receipt_line_id: string
          status: string
          updated_at: string
        }
        Insert: {
          allocated_qty: number
          assigned_to?: string | null
          bin_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          disposition: string
          exception_reason?: string | null
          id?: string
          placed_qty?: number
          receipt_line_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          allocated_qty?: number
          assigned_to?: string | null
          bin_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          disposition?: string
          exception_reason?: string | null
          id?: string
          placed_qty?: number
          receipt_line_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_inventory_putaway_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_putaway_tasks_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_putaway_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_putaway_tasks_receipt_line_id_fkey"
            columns: ["receipt_line_id"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_receipt_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_inventory_receipt_lines: {
        Row: {
          accepted_qty: number
          created_at: string
          damaged_qty: number
          excess_qty: number | null
          expected_qty: number
          expiry_date: string | null
          id: string
          notes: string | null
          oasis_batch_lot: string | null
          product_id: string
          receipt_id: string
          received_qty: number
          rejected_qty: number
          shortage_qty: number | null
          sku: string
          supplier_batch_lot: string | null
        }
        Insert: {
          accepted_qty?: number
          created_at?: string
          damaged_qty?: number
          excess_qty?: number | null
          expected_qty?: number
          expiry_date?: string | null
          id?: string
          notes?: string | null
          oasis_batch_lot?: string | null
          product_id: string
          receipt_id: string
          received_qty?: number
          rejected_qty?: number
          shortage_qty?: number | null
          sku: string
          supplier_batch_lot?: string | null
        }
        Update: {
          accepted_qty?: number
          created_at?: string
          damaged_qty?: number
          excess_qty?: number | null
          expected_qty?: number
          expiry_date?: string | null
          id?: string
          notes?: string | null
          oasis_batch_lot?: string | null
          product_id?: string
          receipt_id?: string
          received_qty?: number
          rejected_qty?: number
          shortage_qty?: number | null
          sku?: string
          supplier_batch_lot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_inventory_receipt_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "b2b_gate_store_reconciliation"
            referencedColumns: ["receipt_id"]
          },
          {
            foreignKeyName: "b2b_inventory_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_inventory_receipts: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          correlation_id: string
          created_at: string
          destination_store_code: string
          id: string
          notes: string | null
          production_job_id: string | null
          receipt_number: string
          receipt_source: string
          received_at: string | null
          received_by: string | null
          source_document_reference: string
          source_document_type: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          correlation_id: string
          created_at?: string
          destination_store_code: string
          id?: string
          notes?: string | null
          production_job_id?: string | null
          receipt_number: string
          receipt_source: string
          received_at?: string | null
          received_by?: string | null
          source_document_reference: string
          source_document_type: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          correlation_id?: string
          created_at?: string
          destination_store_code?: string
          id?: string
          notes?: string | null
          production_job_id?: string | null
          receipt_number?: string
          receipt_source?: string
          received_at?: string | null
          received_by?: string | null
          source_document_reference?: string
          source_document_type?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_inventory_receipts_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_receipts_destination_store_code_fkey"
            columns: ["destination_store_code"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_stores"
            referencedColumns: ["store_code"]
          },
          {
            foreignKeyName: "b2b_inventory_receipts_production_job_id_fkey"
            columns: ["production_job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_inventory_store_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          authority: string
          store_code: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          authority: string
          store_code: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          authority?: string
          store_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_inventory_store_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_inventory_store_assignments_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_stores"
            referencedColumns: ["store_code"]
          },
          {
            foreignKeyName: "b2b_inventory_store_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_inventory_stores: {
        Row: {
          active: boolean
          created_at: string
          id: string
          store_code: string
          store_name: string
          store_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          store_code: string
          store_name: string
          store_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          store_code?: string
          store_name?: string
          store_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      b2b_return_arrival_cases: {
        Row: {
          arrival_state: string
          arrived_at: string
          cartons_conditionally_received: number
          cartons_presented: number
          case_number: string
          client_owner_id: string | null
          commercial_state: string
          correlation_id: string
          created_at: string
          customer_id: string | null
          driver_name: string | null
          external_condition: string
          final_decision_at: string | null
          final_decision_by: string | null
          final_disposition: string | null
          finance_owner_id: string | null
          gate_evidence_refs: Json
          gate_recorded_by: string | null
          id: string
          inventory_state: string
          operations_owner_id: string | null
          order_id: string | null
          original_consignment_id: string | null
          qa_owner_id: string | null
          quarantine_location: string | null
          refusal_witness_ref: string | null
          stated_reason: string | null
          tracking_lr_awb: string | null
          transporter_ack_ref: string | null
          transporter_ack_refused: boolean
          transporter_name: string | null
          unloading_authorised_by: string | null
          updated_at: string
          vehicle_number: string | null
        }
        Insert: {
          arrival_state?: string
          arrived_at?: string
          cartons_conditionally_received?: number
          cartons_presented: number
          case_number: string
          client_owner_id?: string | null
          commercial_state?: string
          correlation_id: string
          created_at?: string
          customer_id?: string | null
          driver_name?: string | null
          external_condition: string
          final_decision_at?: string | null
          final_decision_by?: string | null
          final_disposition?: string | null
          finance_owner_id?: string | null
          gate_evidence_refs?: Json
          gate_recorded_by?: string | null
          id?: string
          inventory_state?: string
          operations_owner_id?: string | null
          order_id?: string | null
          original_consignment_id?: string | null
          qa_owner_id?: string | null
          quarantine_location?: string | null
          refusal_witness_ref?: string | null
          stated_reason?: string | null
          tracking_lr_awb?: string | null
          transporter_ack_ref?: string | null
          transporter_ack_refused?: boolean
          transporter_name?: string | null
          unloading_authorised_by?: string | null
          updated_at?: string
          vehicle_number?: string | null
        }
        Update: {
          arrival_state?: string
          arrived_at?: string
          cartons_conditionally_received?: number
          cartons_presented?: number
          case_number?: string
          client_owner_id?: string | null
          commercial_state?: string
          correlation_id?: string
          created_at?: string
          customer_id?: string | null
          driver_name?: string | null
          external_condition?: string
          final_decision_at?: string | null
          final_decision_by?: string | null
          final_disposition?: string | null
          finance_owner_id?: string | null
          gate_evidence_refs?: Json
          gate_recorded_by?: string | null
          id?: string
          inventory_state?: string
          operations_owner_id?: string | null
          order_id?: string | null
          original_consignment_id?: string | null
          qa_owner_id?: string | null
          quarantine_location?: string | null
          refusal_witness_ref?: string | null
          stated_reason?: string | null
          tracking_lr_awb?: string | null
          transporter_ack_ref?: string | null
          transporter_ack_refused?: boolean
          transporter_name?: string | null
          unloading_authorised_by?: string | null
          updated_at?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_return_arrival_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_return_arrival_cases_original_consignment_id_fkey"
            columns: ["original_consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_command_queue"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "b2b_return_arrival_cases_original_consignment_id_fkey"
            columns: ["original_consignment_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_consignments"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_return_arrival_decisions: {
        Row: {
          authority_role: string
          correlation_id: string
          decided_at: string
          decided_by: string
          decision_reason: string
          decision_type: string
          evidence_refs: Json
          id: string
          return_case_id: string
          supersedes_decision_id: string | null
        }
        Insert: {
          authority_role: string
          correlation_id: string
          decided_at?: string
          decided_by: string
          decision_reason: string
          decision_type: string
          evidence_refs?: Json
          id?: string
          return_case_id: string
          supersedes_decision_id?: string | null
        }
        Update: {
          authority_role?: string
          correlation_id?: string
          decided_at?: string
          decided_by?: string
          decision_reason?: string
          decision_type?: string
          evidence_refs?: Json
          id?: string
          return_case_id?: string
          supersedes_decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_return_arrival_decisions_return_case_id_fkey"
            columns: ["return_case_id"]
            isOneToOne: false
            referencedRelation: "b2b_return_arrival_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_return_arrival_decisions_supersedes_decision_id_fkey"
            columns: ["supersedes_decision_id"]
            isOneToOne: false
            referencedRelation: "b2b_return_arrival_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_return_arrival_items: {
        Row: {
          batch_lot: string | null
          created_at: string
          evidence_refs: Json
          expiry_date: string | null
          id: string
          inspected_at: string | null
          inspected_by: string | null
          product_code: string | null
          product_id: string | null
          qa_findings: string | null
          qa_state: string
          quantity_presented: number
          quantity_verified: number
          return_case_id: string
          seal_state: string | null
          temperature_state: string | null
        }
        Insert: {
          batch_lot?: string | null
          created_at?: string
          evidence_refs?: Json
          expiry_date?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          product_code?: string | null
          product_id?: string | null
          qa_findings?: string | null
          qa_state?: string
          quantity_presented: number
          quantity_verified?: number
          return_case_id: string
          seal_state?: string | null
          temperature_state?: string | null
        }
        Update: {
          batch_lot?: string | null
          created_at?: string
          evidence_refs?: Json
          expiry_date?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          product_code?: string | null
          product_id?: string | null
          qa_findings?: string | null
          qa_state?: string
          quantity_presented?: number
          quantity_verified?: number
          return_case_id?: string
          seal_state?: string | null
          temperature_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_return_arrival_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_return_arrival_items_return_case_id_fkey"
            columns: ["return_case_id"]
            isOneToOne: false
            referencedRelation: "b2b_return_arrival_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_supplier_discrepancies: {
        Row: {
          created_at: string
          discrepancy_type: string
          evidence: Json
          id: string
          owner_id: string | null
          quantity: number | null
          receipt_line_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discrepancy_type: string
          evidence?: Json
          id?: string
          owner_id?: string | null
          quantity?: number | null
          receipt_line_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discrepancy_type?: string
          evidence?: Json
          id?: string
          owner_id?: string | null
          quantity?: number | null
          receipt_line_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_supplier_discrepancies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_supplier_discrepancies_receipt_line_id_fkey"
            columns: ["receipt_line_id"]
            isOneToOne: false
            referencedRelation: "b2b_inventory_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "b2b_supplier_discrepancies_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_monthly_ledgers: {
        Row: {
          company_id: string
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          order_count: number
          pdf_url: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          status: string
          total_amount: number
          whatsapp_message_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          order_count?: number
          pdf_url?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: string
          total_amount?: number
          whatsapp_message_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          order_count?: number
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: string
          total_amount?: number
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_monthly_ledgers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_monthly_ledgers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
        ]
      }
      catalogue_ai_studio_draft_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          draft_id: string
          from_status: string | null
          id: string
          metadata: Json
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          draft_id: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          draft_id?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_ai_studio_draft_audit_log_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "catalogue_ai_studio_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_ai_studio_drafts: {
        Row: {
          b2b_sales_copy: string
          catalogue_title: string
          closeup_image_prompt: string
          created_at: string
          created_by: string | null
          export_bundle_preview: string
          export_catalogue_copy: string
          hero_image_prompt: string
          hindi_description: string
          id: string
          lifestyle_image_prompt: string
          long_description: string
          packaging_image_prompt: string
          product_id: string
          published_at: string | null
          published_by: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          short_description: string
          source_snapshot: Json
          square_image_prompt: string
          status: string
          storage_shelf_life_copy: string
          updated_at: string
          version_number: number
          whatsapp_product_message: string
        }
        Insert: {
          b2b_sales_copy?: string
          catalogue_title?: string
          closeup_image_prompt?: string
          created_at?: string
          created_by?: string | null
          export_bundle_preview?: string
          export_catalogue_copy?: string
          hero_image_prompt?: string
          hindi_description?: string
          id?: string
          lifestyle_image_prompt?: string
          long_description?: string
          packaging_image_prompt?: string
          product_id: string
          published_at?: string | null
          published_by?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_description?: string
          source_snapshot?: Json
          square_image_prompt?: string
          status?: string
          storage_shelf_life_copy?: string
          updated_at?: string
          version_number?: number
          whatsapp_product_message?: string
        }
        Update: {
          b2b_sales_copy?: string
          catalogue_title?: string
          closeup_image_prompt?: string
          created_at?: string
          created_by?: string | null
          export_bundle_preview?: string
          export_catalogue_copy?: string
          hero_image_prompt?: string
          hindi_description?: string
          id?: string
          lifestyle_image_prompt?: string
          long_description?: string
          packaging_image_prompt?: string
          product_id?: string
          published_at?: string | null
          published_by?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_description?: string
          source_snapshot?: Json
          square_image_prompt?: string
          status?: string
          storage_shelf_life_copy?: string
          updated_at?: string
          version_number?: number
          whatsapp_product_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_ai_studio_drafts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_alias_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          status: string
          submitted_at: string
          submitted_by: string
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_approval_audit: {
        Row: {
          action: string
          after_snapshot: Json | null
          before_snapshot: Json | null
          created_at: string
          draft_id: string
          draft_table: string
          id: string
          notes: string | null
          payload_snapshot: Json | null
          performed_by: string | null
        }
        Insert: {
          action: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          draft_id: string
          draft_table: string
          id?: string
          notes?: string | null
          payload_snapshot?: Json | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          draft_id?: string
          draft_table?: string
          id?: string
          notes?: string | null
          payload_snapshot?: Json | null
          performed_by?: string | null
        }
        Relationships: []
      }
      catalogue_bom_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          status: string
          submitted_at: string
          submitted_by: string
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_media_submissions: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          status: string
          submitted_at: string
          submitted_by: string
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_moq_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          status: string
          submitted_at: string
          submitted_by: string
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_pricing_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          status: string
          submitted_at: string
          submitted_by: string
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_product_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          status: string
          submitted_at: string
          submitted_by: string
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_product_mappings: {
        Row: {
          central_product_id: string | null
          created_at: string
          external_catalogue_product_id: string
          id: string
          last_synced_at: string | null
          metadata: Json
          sku: string
          source_app: string
          source_version: number
          sync_status: string
          updated_at: string
        }
        Insert: {
          central_product_id?: string | null
          created_at?: string
          external_catalogue_product_id: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          sku: string
          source_app?: string
          source_version?: number
          sync_status?: string
          updated_at?: string
        }
        Update: {
          central_product_id?: string | null
          created_at?: string
          external_catalogue_product_id?: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          sku?: string
          source_app?: string
          source_version?: number
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_product_mappings_central_product_id_fkey"
            columns: ["central_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_sync_events: {
        Row: {
          catalogue_version_id: string
          error_message: string | null
          id: string
          payload_json: Json
          sync_status: string
          target_system: string
          triggered_at: string
          triggered_by: string | null
        }
        Insert: {
          catalogue_version_id: string
          error_message?: string | null
          id?: string
          payload_json?: Json
          sync_status?: string
          target_system?: string
          triggered_at?: string
          triggered_by?: string | null
        }
        Update: {
          catalogue_version_id?: string
          error_message?: string | null
          id?: string
          payload_json?: Json
          sync_status?: string
          target_system?: string
          triggered_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_sync_events_catalogue_version_id_fkey"
            columns: ["catalogue_version_id"]
            isOneToOne: false
            referencedRelation: "catalogue_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_tag_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_app: string
          status: string
          submitted_at: string
          submitted_by: string
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_app?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          product_id: string
          published_at: string | null
          sku_id: string | null
          snapshot_json: Json
          status: string
          synced_to_central_at: string | null
          updated_at: string
          version_code: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          product_id: string
          published_at?: string | null
          sku_id?: string | null
          snapshot_json?: Json
          status?: string
          synced_to_central_at?: string | null
          updated_at?: string
          version_code: string
          version_number: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          product_id?: string
          published_at?: string | null
          sku_id?: string | null
          snapshot_json?: Json
          status?: string
          synced_to_central_at?: string | null
          updated_at?: string
          version_code?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      client_interactions: {
        Row: {
          channel: string | null
          company_id: string | null
          created_at: string | null
          executive_id: string | null
          follow_up_date: string | null
          id: string
          interaction_type: string | null
          linked_order_id: string | null
          linked_ticket_id: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          outcome: string | null
          reason_code: string | null
        }
        Insert: {
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          executive_id?: string | null
          follow_up_date?: string | null
          id?: string
          interaction_type?: string | null
          linked_order_id?: string | null
          linked_ticket_id?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          reason_code?: string | null
        }
        Update: {
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          executive_id?: string | null
          follow_up_date?: string | null
          id?: string
          interaction_type?: string | null
          linked_order_id?: string | null
          linked_ticket_id?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          reason_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "client_interactions_executive_id_fkey"
            columns: ["executive_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payouts: {
        Row: {
          amount_paid: number
          created_at: string | null
          executive_id: string | null
          id: string
          paid_by: string | null
          payment_ref: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string | null
          executive_id?: string | null
          id?: string
          paid_by?: string | null
          payment_ref?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          executive_id?: string | null
          id?: string
          paid_by?: string | null
          payment_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_executive_id_fkey"
            columns: ["executive_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          account_manager_id: string | null
          allow_credit: boolean | null
          business_name: string
          business_volume: string | null
          courier_account_number: string | null
          created_at: string | null
          credit_limit: number | null
          current_balance: number | null
          discount_percentage: number | null
          fssai_number: string | null
          gst_number: string | null
          id: string
          is_frozen: boolean
          payment_terms: string
          phone: string | null
          preferred_courier: string | null
          price_tier: string | null
          registered_address: string | null
          rescue_payment_date: string | null
          settlement_deadline: string | null
          status: string | null
          total_outstanding: number
          wallet_balance: number | null
          website: string | null
        }
        Insert: {
          account_manager_id?: string | null
          allow_credit?: boolean | null
          business_name: string
          business_volume?: string | null
          courier_account_number?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          discount_percentage?: number | null
          fssai_number?: string | null
          gst_number?: string | null
          id?: string
          is_frozen?: boolean
          payment_terms?: string
          phone?: string | null
          preferred_courier?: string | null
          price_tier?: string | null
          registered_address?: string | null
          rescue_payment_date?: string | null
          settlement_deadline?: string | null
          status?: string | null
          total_outstanding?: number
          wallet_balance?: number | null
          website?: string | null
        }
        Update: {
          account_manager_id?: string | null
          allow_credit?: boolean | null
          business_name?: string
          business_volume?: string | null
          courier_account_number?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          discount_percentage?: number | null
          fssai_number?: string | null
          gst_number?: string | null
          id?: string
          is_frozen?: boolean
          payment_terms?: string
          phone?: string | null
          preferred_courier?: string | null
          price_tier?: string | null
          registered_address?: string | null
          rescue_payment_date?: string | null
          settlement_deadline?: string | null
          status?: string | null
          total_outstanding?: number
          wallet_balance?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "credit_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
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
      credit_rescue_events: {
        Row: {
          actor_id: string | null
          amount: number | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          notes: string | null
          outstanding_at_event: number | null
        }
        Insert: {
          actor_id?: string | null
          amount?: number | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
          outstanding_at_event?: number | null
        }
        Update: {
          actor_id?: string | null
          amount?: number | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          outstanding_at_event?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_rescue_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_rescue_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          last_action_at: string | null
          linked_order_id: string | null
          reason_code: string | null
          sales_exec_id: string | null
          snooze_reason: string | null
          snoozed_until: string | null
          status: string
          task_type: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          last_action_at?: string | null
          linked_order_id?: string | null
          reason_code?: string | null
          sales_exec_id?: string | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          status?: string
          task_type?: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          last_action_at?: string | null
          linked_order_id?: string | null
          reason_code?: string | null
          sales_exec_id?: string | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          status?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "crm_tasks_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contact_preferences: {
        Row: {
          company_id: string
          id: string
          notes: string | null
          opt_out_marketing: boolean
          preferred_channel: string
          preferred_contact_window: string | null
          preferred_language: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          id?: string
          notes?: string | null
          opt_out_marketing?: boolean
          preferred_channel?: string
          preferred_contact_window?: string | null
          preferred_language?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          id?: string
          notes?: string | null
          opt_out_marketing?: boolean
          preferred_channel?: string
          preferred_contact_window?: string | null
          preferred_language?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contact_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contact_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "customer_contact_preferences_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_feedback: {
        Row: {
          action_task_id: string | null
          category: string | null
          collected_by: string | null
          company_id: string
          created_at: string
          feedback: string | null
          id: string
          order_id: string | null
          rating: number | null
          requires_action: boolean
          ticket_id: string | null
        }
        Insert: {
          action_task_id?: string | null
          category?: string | null
          collected_by?: string | null
          company_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          order_id?: string | null
          rating?: number | null
          requires_action?: boolean
          ticket_id?: string | null
        }
        Update: {
          action_task_id?: string | null
          category?: string | null
          collected_by?: string | null
          company_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          order_id?: string | null
          rating?: number | null
          requires_action?: boolean
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_feedback_action_task_id_fkey"
            columns: ["action_task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_feedback_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "customer_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_import_batches: {
        Row: {
          central_mapping: Json
          created_at: string
          id: string
          loaded_at: string
          loaded_by: string | null
          notes: string | null
          row_counts: Json
          source_environment: string
          source_filename: string
          source_original_filename: string | null
          status: string
          updated_at: string
          validated_at: string | null
          validation_summary: Json
        }
        Insert: {
          central_mapping?: Json
          created_at?: string
          id?: string
          loaded_at?: string
          loaded_by?: string | null
          notes?: string | null
          row_counts?: Json
          source_environment?: string
          source_filename?: string
          source_original_filename?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validation_summary?: Json
        }
        Update: {
          central_mapping?: Json
          created_at?: string
          id?: string
          loaded_at?: string
          loaded_by?: string | null
          notes?: string | null
          row_counts?: Json
          source_environment?: string
          source_filename?: string
          source_original_filename?: string | null
          status?: string
          updated_at?: string
          validated_at?: string | null
          validation_summary?: Json
        }
        Relationships: []
      }
      customer_import_company_candidates: {
        Row: {
          account_manager_email_raw: string | null
          account_manager_id: string | null
          account_manager_name_raw: string | null
          batch_id: string
          business_name: string
          city: string | null
          country: string | null
          created_at: string
          fssai_number: string | null
          gst_number_normalized: string | null
          gst_number_raw: string | null
          id: string
          import_action: string
          match_confidence: number | null
          match_method: string | null
          matched_company_id: string | null
          payment_terms_normalized: string | null
          payment_terms_raw: string | null
          phone_last10: string | null
          phone_raw: string | null
          phone_secondary_last10: string | null
          phone_secondary_raw: string | null
          pincode: string | null
          price_tier: string | null
          raw_id: string | null
          registered_address: string | null
          registration_type: string | null
          review_notes: string | null
          source_customer_key: string
          source_row: number | null
          source_sheet: string | null
          state: string | null
          status_candidate: string | null
          trade_name: string | null
          updated_at: string
          validation_messages: string[]
          validation_status: string
          website: string | null
        }
        Insert: {
          account_manager_email_raw?: string | null
          account_manager_id?: string | null
          account_manager_name_raw?: string | null
          batch_id: string
          business_name: string
          city?: string | null
          country?: string | null
          created_at?: string
          fssai_number?: string | null
          gst_number_normalized?: string | null
          gst_number_raw?: string | null
          id?: string
          import_action?: string
          match_confidence?: number | null
          match_method?: string | null
          matched_company_id?: string | null
          payment_terms_normalized?: string | null
          payment_terms_raw?: string | null
          phone_last10?: string | null
          phone_raw?: string | null
          phone_secondary_last10?: string | null
          phone_secondary_raw?: string | null
          pincode?: string | null
          price_tier?: string | null
          raw_id?: string | null
          registered_address?: string | null
          registration_type?: string | null
          review_notes?: string | null
          source_customer_key: string
          source_row?: number | null
          source_sheet?: string | null
          state?: string | null
          status_candidate?: string | null
          trade_name?: string | null
          updated_at?: string
          validation_messages?: string[]
          validation_status?: string
          website?: string | null
        }
        Update: {
          account_manager_email_raw?: string | null
          account_manager_id?: string | null
          account_manager_name_raw?: string | null
          batch_id?: string
          business_name?: string
          city?: string | null
          country?: string | null
          created_at?: string
          fssai_number?: string | null
          gst_number_normalized?: string | null
          gst_number_raw?: string | null
          id?: string
          import_action?: string
          match_confidence?: number | null
          match_method?: string | null
          matched_company_id?: string | null
          payment_terms_normalized?: string | null
          payment_terms_raw?: string | null
          phone_last10?: string | null
          phone_raw?: string | null
          phone_secondary_last10?: string | null
          phone_secondary_raw?: string | null
          pincode?: string | null
          price_tier?: string | null
          raw_id?: string | null
          registered_address?: string | null
          registration_type?: string | null
          review_notes?: string | null
          source_customer_key?: string
          source_row?: number | null
          source_sheet?: string | null
          state?: string | null
          status_candidate?: string | null
          trade_name?: string | null
          updated_at?: string
          validation_messages?: string[]
          validation_status?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "customer_import_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_import_contact_candidates: {
        Row: {
          batch_id: string
          company_candidate_id: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          id: string
          import_action: string
          match_method: string | null
          matched_company_id: string | null
          matched_user_id: string | null
          matched_whatsapp_contact_id: string | null
          phone_last10: string | null
          raw_id: string | null
          review_notes: string | null
          source_contact_key: string
          source_customer_key: string
          source_row: number | null
          source_sheet: string | null
          updated_at: string
          validation_messages: string[]
          validation_status: string
          whatsapp_candidate_raw: string | null
          whatsapp_phone_normalized: string | null
          whatsapp_phone_raw: string
        }
        Insert: {
          batch_id: string
          company_candidate_id?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          id?: string
          import_action?: string
          match_method?: string | null
          matched_company_id?: string | null
          matched_user_id?: string | null
          matched_whatsapp_contact_id?: string | null
          phone_last10?: string | null
          raw_id?: string | null
          review_notes?: string | null
          source_contact_key: string
          source_customer_key: string
          source_row?: number | null
          source_sheet?: string | null
          updated_at?: string
          validation_messages?: string[]
          validation_status?: string
          whatsapp_candidate_raw?: string | null
          whatsapp_phone_normalized?: string | null
          whatsapp_phone_raw: string
        }
        Update: {
          batch_id?: string
          company_candidate_id?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          import_action?: string
          match_method?: string | null
          matched_company_id?: string | null
          matched_user_id?: string | null
          matched_whatsapp_contact_id?: string | null
          phone_last10?: string | null
          raw_id?: string | null
          review_notes?: string | null
          source_contact_key?: string
          source_customer_key?: string
          source_row?: number | null
          source_sheet?: string | null
          updated_at?: string
          validation_messages?: string[]
          validation_status?: string
          whatsapp_candidate_raw?: string | null
          whatsapp_phone_normalized?: string | null
          whatsapp_phone_raw?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_company_candidate_id_fkey"
            columns: ["company_candidate_id"]
            isOneToOne: false
            referencedRelation: "customer_import_company_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_company_candidate_id_fkey"
            columns: ["company_candidate_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_company_required_gaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_company_candidate_id_fkey"
            columns: ["company_candidate_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["company_candidate_id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "customer_import_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_import_duplicate_review: {
        Row: {
          batch_id: string
          candidate_details: Json
          candidate_source_keys: string[]
          chosen_winner_source_key: string | null
          created_at: string
          duplicate_key_normalized: string
          duplicate_key_raw: string
          duplicate_type: string
          id: string
          matched_companies_raw: string | null
          occurrence_count: number
          raw_id: string | null
          resolution_status: string
          review_status_raw: string | null
          reviewer_notes: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          candidate_details?: Json
          candidate_source_keys?: string[]
          chosen_winner_source_key?: string | null
          created_at?: string
          duplicate_key_normalized: string
          duplicate_key_raw: string
          duplicate_type: string
          id?: string
          matched_companies_raw?: string | null
          occurrence_count?: number
          raw_id?: string | null
          resolution_status?: string
          review_status_raw?: string | null
          reviewer_notes?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          candidate_details?: Json
          candidate_source_keys?: string[]
          chosen_winner_source_key?: string | null
          created_at?: string
          duplicate_key_normalized?: string
          duplicate_key_raw?: string
          duplicate_type?: string
          id?: string
          matched_companies_raw?: string | null
          occurrence_count?: number
          raw_id?: string | null
          resolution_status?: string
          review_status_raw?: string | null
          reviewer_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_duplicate_review_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_duplicate_review_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_duplicate_review_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_duplicate_review_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "customer_import_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_import_raw: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          parse_errors: string[]
          row_hash: string
          row_json: Json
          source_row_number: number
          source_tab: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          parse_errors?: string[]
          row_hash: string
          row_json: Json
          source_row_number: number
          source_tab: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          parse_errors?: string[]
          row_hash?: string
          row_json?: Json
          source_row_number?: number
          source_tab?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_raw_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_raw_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_raw_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      daily_production_logs: {
        Row: {
          created_at: string | null
          department: string
          id: string
          log_date: string | null
          logged_by: string | null
          produced_qty: number
          product_id: string
          wastage_qty: number | null
        }
        Insert: {
          created_at?: string | null
          department: string
          id?: string
          log_date?: string | null
          logged_by?: string | null
          produced_qty: number
          product_id: string
          wastage_qty?: number | null
        }
        Update: {
          created_at?: string | null
          department?: string
          id?: string
          log_date?: string | null
          logged_by?: string | null
          produced_qty?: number
          product_id?: string
          wastage_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_production_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_letter_entries: {
        Row: {
          attempt_count: number
          context: Json
          created_at: string
          error_code: string | null
          error_message: string
          first_failed_at: string
          id: string
          idempotency_key: string | null
          last_failed_at: string
          policy_key: string | null
          requeued_at: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_application: string
          source_record_id: string
          source_table: string
          status: string
          updated_at: string
          workload_type: string
        }
        Insert: {
          attempt_count: number
          context?: Json
          created_at?: string
          error_code?: string | null
          error_message: string
          first_failed_at?: string
          id?: string
          idempotency_key?: string | null
          last_failed_at?: string
          policy_key?: string | null
          requeued_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_application: string
          source_record_id: string
          source_table: string
          status?: string
          updated_at?: string
          workload_type: string
        }
        Update: {
          attempt_count?: number
          context?: Json
          created_at?: string
          error_code?: string | null
          error_message?: string
          first_failed_at?: string
          id?: string
          idempotency_key?: string | null
          last_failed_at?: string
          policy_key?: string | null
          requeued_at?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_application?: string
          source_record_id?: string
          source_table?: string
          status?: string
          updated_at?: string
          workload_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dead_letter_entries_policy_key_fkey"
            columns: ["policy_key"]
            isOneToOne: false
            referencedRelation: "retry_policies"
            referencedColumns: ["policy_key"]
          },
        ]
      }
      debug_webhooks: {
        Row: {
          created_at: string
          direction: string
          discard_reason: string | null
          error_message: string | null
          id: string
          message_intent: string | null
          phone_number: string | null
          processed: boolean | null
          raw_payload: Json
          wamid: string | null
        }
        Insert: {
          created_at?: string
          direction?: string
          discard_reason?: string | null
          error_message?: string | null
          id?: string
          message_intent?: string | null
          phone_number?: string | null
          processed?: boolean | null
          raw_payload?: Json
          wamid?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          discard_reason?: string | null
          error_message?: string | null
          id?: string
          message_intent?: string | null
          phone_number?: string | null
          processed?: boolean | null
          raw_payload?: Json
          wamid?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "delivery_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
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
      dispatch_completion_evidence: {
        Row: {
          actor_department: string | null
          actor_id: string | null
          actor_role: string | null
          completion_status: string
          correlation_id: string
          courier_ref: string | null
          created_at: string
          evidence_ref: string | null
          evidence_status: string
          evidence_type: string
          id: string
          manifest_ref: string | null
          metadata: Json
          order_id: string
          override_reason: string | null
          queue_item_id: string | null
        }
        Insert: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          completion_status: string
          correlation_id: string
          courier_ref?: string | null
          created_at?: string
          evidence_ref?: string | null
          evidence_status: string
          evidence_type: string
          id?: string
          manifest_ref?: string | null
          metadata?: Json
          order_id: string
          override_reason?: string | null
          queue_item_id?: string | null
        }
        Update: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          completion_status?: string
          correlation_id?: string
          courier_ref?: string | null
          created_at?: string
          evidence_ref?: string | null
          evidence_status?: string
          evidence_type?: string
          id?: string
          manifest_ref?: string | null
          metadata?: Json
          order_id?: string
          override_reason?: string | null
          queue_item_id?: string | null
        }
        Relationships: []
      }
      dispatch_readiness_evidence: {
        Row: {
          actor_department: string | null
          actor_id: string | null
          actor_role: string | null
          barcode_ref: string | null
          correlation_id: string
          created_at: string
          document_ref: string | null
          evidence_ref: string | null
          evidence_status: string
          evidence_type: string
          id: string
          metadata: Json
          order_id: string
          photo_ref: string | null
          queue_item_id: string | null
        }
        Insert: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          barcode_ref?: string | null
          correlation_id: string
          created_at?: string
          document_ref?: string | null
          evidence_ref?: string | null
          evidence_status: string
          evidence_type: string
          id?: string
          metadata?: Json
          order_id: string
          photo_ref?: string | null
          queue_item_id?: string | null
        }
        Update: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          barcode_ref?: string | null
          correlation_id?: string
          created_at?: string
          document_ref?: string | null
          evidence_ref?: string | null
          evidence_status?: string
          evidence_type?: string
          id?: string
          metadata?: Json
          order_id?: string
          photo_ref?: string | null
          queue_item_id?: string | null
        }
        Relationships: []
      }
      dispatch_release_lineage: {
        Row: {
          actor_department: string | null
          actor_id: string | null
          actor_role: string | null
          completion_reference: string | null
          correlation_id: string
          created_at: string
          gate_reference: string | null
          id: string
          metadata: Json
          next_status: string
          order_id: string
          override_reason: string | null
          previous_status: string
          release_reason: string | null
          release_type: string
          transporter_reference: string | null
        }
        Insert: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          completion_reference?: string | null
          correlation_id: string
          created_at?: string
          gate_reference?: string | null
          id?: string
          metadata?: Json
          next_status: string
          order_id: string
          override_reason?: string | null
          previous_status: string
          release_reason?: string | null
          release_type: string
          transporter_reference?: string | null
        }
        Update: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          completion_reference?: string | null
          correlation_id?: string
          created_at?: string
          gate_reference?: string | null
          id?: string
          metadata?: Json
          next_status?: string
          order_id?: string
          override_reason?: string | null
          previous_status?: string
          release_reason?: string | null
          release_type?: string
          transporter_reference?: string | null
        }
        Relationships: []
      }
      dispatches: {
        Row: {
          company_id: string | null
          dispatch_date: string | null
          dispatch_number: string | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          is_partial: boolean
          order_id: string | null
          proof_storage_path: string | null
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
          is_partial?: boolean
          order_id?: string | null
          proof_storage_path?: string | null
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
          is_partial?: boolean
          order_id?: string | null
          proof_storage_path?: string | null
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
      employee_performance_logs: {
        Row: {
          avg_rating: number | null
          employee_id: string
          id: string
          never_responded_count: number | null
          period_end: string
          period_start: string
          sla_compliance_pct: number | null
          total_handled: number | null
          total_penalty_score: number | null
          updated_at: string | null
        }
        Insert: {
          avg_rating?: number | null
          employee_id: string
          id?: string
          never_responded_count?: number | null
          period_end?: string
          period_start?: string
          sla_compliance_pct?: number | null
          total_handled?: number | null
          total_penalty_score?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_rating?: number | null
          employee_id?: string
          id?: string
          never_responded_count?: number | null
          period_end?: string
          period_start?: string
          sla_compliance_pct?: number | null
          total_handled?: number | null
          total_penalty_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_performance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      finance_review_evidence: {
        Row: {
          actor_department: string | null
          actor_id: string | null
          actor_role: string | null
          amount: number | null
          correlation_id: string
          created_at: string
          currency: string | null
          evidence_ref: string | null
          evidence_type: string
          id: string
          metadata: Json
          order_id: string
          override_reason: string | null
          review_status: string
          review_type: string
          utr_ref: string | null
        }
        Insert: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          amount?: number | null
          correlation_id: string
          created_at?: string
          currency?: string | null
          evidence_ref?: string | null
          evidence_type: string
          id?: string
          metadata?: Json
          order_id: string
          override_reason?: string | null
          review_status: string
          review_type: string
          utr_ref?: string | null
        }
        Update: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          amount?: number | null
          correlation_id?: string
          created_at?: string
          currency?: string | null
          evidence_ref?: string | null
          evidence_type?: string
          id?: string
          metadata?: Json
          order_id?: string
          override_reason?: string | null
          review_status?: string
          review_type?: string
          utr_ref?: string | null
        }
        Relationships: []
      }
      follow_up_snoozes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          previous_due_date: string
          reason_code: string
          snoozed_by: string
          snoozed_until: string
          task_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_due_date: string
          reason_code: string
          snoozed_by: string
          snoozed_until: string
          task_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          previous_due_date?: string
          reason_code?: string
          snoozed_by?: string
          snoozed_until?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_snoozes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_snoozes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "follow_up_snoozes_snoozed_by_fkey"
            columns: ["snoozed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_snoozes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_ledger: {
        Row: {
          advance_paid_amt: number | null
          balance_due_amt: number | null
          created_at: string | null
          id: string
          order_id: string | null
          payment_status: string | null
          total_freight_amt: number | null
          transporter_name: string | null
        }
        Insert: {
          advance_paid_amt?: number | null
          balance_due_amt?: number | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          payment_status?: string | null
          total_freight_amt?: number | null
          transporter_name?: string | null
        }
        Update: {
          advance_paid_amt?: number | null
          balance_due_amt?: number | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          payment_status?: string | null
          total_freight_amt?: number | null
          transporter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          identity_class: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          identity_class?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          identity_class?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      inventory_movements: {
        Row: {
          actor_id: string | null
          batch_lot: string | null
          correlation_id: string
          created_at: string
          destination_location: string | null
          expiry_date: string | null
          id: string
          metadata: Json
          movement_type: string
          product_id: string
          quantity: number
          reason_code: string | null
          reservation_id: string | null
          sku: string
          source_document_reference: string | null
          source_document_type: string | null
          source_location: string | null
        }
        Insert: {
          actor_id?: string | null
          batch_lot?: string | null
          correlation_id: string
          created_at?: string
          destination_location?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json
          movement_type: string
          product_id: string
          quantity: number
          reason_code?: string | null
          reservation_id?: string | null
          sku: string
          source_document_reference?: string | null
          source_document_type?: string | null
          source_location?: string | null
        }
        Update: {
          actor_id?: string | null
          batch_lot?: string | null
          correlation_id?: string
          created_at?: string
          destination_location?: string | null
          expiry_date?: string | null
          id?: string
          metadata?: Json
          movement_type?: string
          product_id?: string
          quantity?: number
          reason_code?: string | null
          reservation_id?: string | null
          sku?: string
          source_document_reference?: string | null
          source_document_type?: string | null
          source_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservation_allocations: {
        Row: {
          allocated_at: string
          allocated_qty: number
          allocation_status: string
          id: string
          inventory_entity_id: string
          inventory_entity_type: string
          reservation_id: string
        }
        Insert: {
          allocated_at?: string
          allocated_qty: number
          allocation_status?: string
          id?: string
          inventory_entity_id: string
          inventory_entity_type: string
          reservation_id: string
        }
        Update: {
          allocated_at?: string
          allocated_qty?: number
          allocation_status?: string
          id?: string
          inventory_entity_id?: string
          inventory_entity_type?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservation_allocations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          approved_by: string | null
          correlation_id: string
          created_at: string
          customer_id: string | null
          expires_at: string | null
          fulfilled_qty: number
          id: string
          notes: string | null
          order_id: string
          product_id: string
          queue_item_id: string | null
          released_qty: number
          requested_qty: number
          reservation_number: string
          reservation_priority: string
          reservation_status: string
          reserved_by: string | null
          reserved_qty: number
          sku: string
          source_department: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_by?: string | null
          correlation_id: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          fulfilled_qty?: number
          id?: string
          notes?: string | null
          order_id: string
          product_id: string
          queue_item_id?: string | null
          released_qty?: number
          requested_qty: number
          reservation_number: string
          reservation_priority?: string
          reservation_status?: string
          reserved_by?: string | null
          reserved_qty?: number
          sku: string
          source_department?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved_by?: string | null
          correlation_id?: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          fulfilled_qty?: number
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string
          queue_item_id?: string | null
          released_qty?: number
          requested_qty?: number
          reservation_number?: string
          reservation_priority?: string
          reservation_status?: string
          reserved_by?: string | null
          reserved_qty?: number
          sku?: string
          source_department?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "operational_queue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_balances: {
        Row: {
          available_qty: number
          damaged_qty: number
          expired_qty: number
          id: string
          location_code: string
          product_id: string
          quarantine_qty: number
          reserved_qty: number
          sku: string
          updated_at: string
          version: number
        }
        Insert: {
          available_qty?: number
          damaged_qty?: number
          expired_qty?: number
          id?: string
          location_code: string
          product_id: string
          quarantine_qty?: number
          reserved_qty?: number
          sku: string
          updated_at?: string
          version?: number
        }
        Update: {
          available_qty?: number
          damaged_qty?: number
          expired_qty?: number
          id?: string
          location_code?: string
          product_id?: string
          quarantine_qty?: number
          reserved_qty?: number
          sku?: string
          updated_at?: string
          version?: number
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
      inward_material_advice: {
        Row: {
          accompanying_docs: string | null
          company_id: string | null
          created_at: string | null
          expected_value: number | null
          fault_attribution: string | null
          fault_department: string | null
          gate_entry_id: string | null
          id: string
          is_defect: boolean | null
          reason: string | null
          sales_exec_id: string | null
          settled_at: string | null
          settled_by: string | null
          settlement_value: number | null
          status: string | null
          type: string | null
        }
        Insert: {
          accompanying_docs?: string | null
          company_id?: string | null
          created_at?: string | null
          expected_value?: number | null
          fault_attribution?: string | null
          fault_department?: string | null
          gate_entry_id?: string | null
          id?: string
          is_defect?: boolean | null
          reason?: string | null
          sales_exec_id?: string | null
          settled_at?: string | null
          settled_by?: string | null
          settlement_value?: number | null
          status?: string | null
          type?: string | null
        }
        Update: {
          accompanying_docs?: string | null
          company_id?: string | null
          created_at?: string | null
          expected_value?: number | null
          fault_attribution?: string | null
          fault_department?: string | null
          gate_entry_id?: string | null
          id?: string
          is_defect?: boolean | null
          reason?: string | null
          sales_exec_id?: string | null
          settled_at?: string | null
          settled_by?: string | null
          settlement_value?: number | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inward_material_advice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inward_material_advice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "inward_material_advice_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inward_material_items: {
        Row: {
          advice_id: string | null
          expected_qty: number | null
          id: string
          product_id: string | null
          received_qty: number | null
        }
        Insert: {
          advice_id?: string | null
          expected_qty?: number | null
          id?: string
          product_id?: string | null
          received_qty?: number | null
        }
        Update: {
          advice_id?: string | null
          expected_qty?: number | null
          id?: string
          product_id?: string | null
          received_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inward_material_items_advice_id_fkey"
            columns: ["advice_id"]
            isOneToOne: false
            referencedRelation: "inward_material_advice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inward_material_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_disputes: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          ledger_id: string
          raised_via: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          ledger_id: string
          raised_via?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          ledger_id?: string
          raised_via?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_disputes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_disputes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "ledger_disputes_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "bi_monthly_ledgers"
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
      notification_events: {
        Row: {
          channels: string[] | null
          created_at: string | null
          event_key: string
          event_name: string
          id: string
          is_enabled: boolean | null
          priority: string | null
          template_body: string
        }
        Insert: {
          channels?: string[] | null
          created_at?: string | null
          event_key: string
          event_name: string
          id?: string
          is_enabled?: boolean | null
          priority?: string | null
          template_body: string
        }
        Update: {
          channels?: string[] | null
          created_at?: string | null
          event_key?: string
          event_name?: string
          id?: string
          is_enabled?: boolean | null
          priority?: string | null
          template_body?: string
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string | null
          error_log: string | null
          event_id: string | null
          event_type: string | null
          id: string
          idempotency_key: string | null
          last_attempt_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message_body: string
          next_attempt_at: string
          priority: string | null
          provider_message_id: string | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          source_application: string
          status: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string | null
          error_log?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message_body: string
          next_attempt_at?: string
          priority?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          source_application?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string | null
          error_log?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          idempotency_key?: string | null
          last_attempt_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          message_body?: string
          next_attempt_at?: string
          priority?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          source_application?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
        ]
      }
      ols_audit_logs: {
        Row: {
          action: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ols_carton_contents: {
        Row: {
          added_at: string
          carton_id: string
          id: string
          manual_qty: number | null
          manual_reason: string | null
          manual_sku: string | null
          production_label_id: string | null
        }
        Insert: {
          added_at?: string
          carton_id: string
          id?: string
          manual_qty?: number | null
          manual_reason?: string | null
          manual_sku?: string | null
          production_label_id?: string | null
        }
        Update: {
          added_at?: string
          carton_id?: string
          id?: string
          manual_qty?: number | null
          manual_reason?: string | null
          manual_sku?: string | null
          production_label_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_carton_contents_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "ols_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_carton_contents_production_label_id_fkey"
            columns: ["production_label_id"]
            isOneToOne: false
            referencedRelation: "ols_production_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_cartons: {
        Row: {
          carton_index: number | null
          carton_no: string
          carton_total: number | null
          created_at: string
          customer_code: string | null
          customer_name: string | null
          gross_weight: number | null
          id: string
          metadata: Json | null
          net_weight: number | null
          order_ref: string | null
          packed_at: string | null
          packed_by: string | null
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          carton_index?: number | null
          carton_no: string
          carton_total?: number | null
          created_at?: string
          customer_code?: string | null
          customer_name?: string | null
          gross_weight?: number | null
          id?: string
          metadata?: Json | null
          net_weight?: number | null
          order_ref?: string | null
          packed_at?: string | null
          packed_by?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          carton_index?: number | null
          carton_no?: string
          carton_total?: number | null
          created_at?: string
          customer_code?: string | null
          customer_name?: string | null
          gross_weight?: number | null
          id?: string
          metadata?: Json | null
          net_weight?: number | null
          order_ref?: string | null
          packed_at?: string | null
          packed_by?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ols_departments: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          kind: string | null
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          kind?: string | null
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          kind?: string | null
          name?: string
        }
        Relationships: []
      }
      ols_dispatch_document_bundles: {
        Row: {
          created_at: string
          dpl_id: string | null
          eway_ref: string | null
          gate_pass_no: string | null
          id: string
          invoice_ref: string | null
          pi_id: string | null
          status: string | null
          transport_ref: string | null
        }
        Insert: {
          created_at?: string
          dpl_id?: string | null
          eway_ref?: string | null
          gate_pass_no?: string | null
          id?: string
          invoice_ref?: string | null
          pi_id?: string | null
          status?: string | null
          transport_ref?: string | null
        }
        Update: {
          created_at?: string
          dpl_id?: string | null
          eway_ref?: string | null
          gate_pass_no?: string | null
          id?: string
          invoice_ref?: string | null
          pi_id?: string | null
          status?: string | null
          transport_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_dispatch_document_bundles_dpl_id_fkey"
            columns: ["dpl_id"]
            isOneToOne: false
            referencedRelation: "ols_dpl_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_dispatch_document_bundles_pi_id_fkey"
            columns: ["pi_id"]
            isOneToOne: false
            referencedRelation: "ols_finance_pi"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_dpl_cartons: {
        Row: {
          carton_id: string
          dpl_id: string
          id: string
          position: number | null
        }
        Insert: {
          carton_id: string
          dpl_id: string
          id?: string
          position?: number | null
        }
        Update: {
          carton_id?: string
          dpl_id?: string
          id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_dpl_cartons_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "ols_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_dpl_cartons_dpl_id_fkey"
            columns: ["dpl_id"]
            isOneToOne: false
            referencedRelation: "ols_dpl_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_dpl_documents: {
        Row: {
          created_at: string
          customer_name: string | null
          destination: string | null
          dpl_no: string
          id: string
          order_ref: string | null
          prepared_at: string | null
          prepared_by: string | null
          remarks: string | null
          status: string | null
          total_cartons: number | null
          total_gross: number | null
          total_net: number | null
          transport_mode: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          destination?: string | null
          dpl_no: string
          id?: string
          order_ref?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          remarks?: string | null
          status?: string | null
          total_cartons?: number | null
          total_gross?: number | null
          total_net?: number | null
          transport_mode?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          destination?: string | null
          dpl_no?: string
          id?: string
          order_ref?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          remarks?: string | null
          status?: string | null
          total_cartons?: number | null
          total_gross?: number | null
          total_net?: number | null
          transport_mode?: string | null
        }
        Relationships: []
      }
      ols_finance_pi: {
        Row: {
          cleared_at: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          dpl_id: string | null
          eway_bill_no: string | null
          eway_status: string | null
          id: string
          invoice_ref: string | null
          order_ref: string | null
          pi_no: string
          status: string | null
          tally_invoice_no: string | null
          tally_sync_status: string | null
          updated_at: string
        }
        Insert: {
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          dpl_id?: string | null
          eway_bill_no?: string | null
          eway_status?: string | null
          id?: string
          invoice_ref?: string | null
          order_ref?: string | null
          pi_no: string
          status?: string | null
          tally_invoice_no?: string | null
          tally_sync_status?: string | null
          updated_at?: string
        }
        Update: {
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          dpl_id?: string | null
          eway_bill_no?: string | null
          eway_status?: string | null
          id?: string
          invoice_ref?: string | null
          order_ref?: string | null
          pi_no?: string
          status?: string | null
          tally_invoice_no?: string | null
          tally_sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ols_finance_pi_dpl_id_fkey"
            columns: ["dpl_id"]
            isOneToOne: false
            referencedRelation: "ols_dpl_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_finance_pi_cartons: {
        Row: {
          carton_id: string
          id: string
          pi_id: string
        }
        Insert: {
          carton_id: string
          id?: string
          pi_id: string
        }
        Update: {
          carton_id?: string
          id?: string
          pi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ols_finance_pi_cartons_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "ols_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_finance_pi_cartons_pi_id_fkey"
            columns: ["pi_id"]
            isOneToOne: false
            referencedRelation: "ols_finance_pi"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_finance_pi_lines: {
        Row: {
          gross_weight: number | null
          id: string
          net_weight: number | null
          pi_id: string
          product_name: string | null
          quantity: number | null
          sku: string | null
        }
        Insert: {
          gross_weight?: number | null
          id?: string
          net_weight?: number | null
          pi_id: string
          product_name?: string | null
          quantity?: number | null
          sku?: string | null
        }
        Update: {
          gross_weight?: number | null
          id?: string
          net_weight?: number | null
          pi_id?: string
          product_name?: string | null
          quantity?: number | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_finance_pi_lines_pi_id_fkey"
            columns: ["pi_id"]
            isOneToOne: false
            referencedRelation: "ols_finance_pi"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_gate_scans: {
        Row: {
          id: string
          qr_ref: string | null
          reason: string | null
          result: string | null
          scanned_at: string
          scanned_by: string | null
          shipping_label_id: string | null
        }
        Insert: {
          id?: string
          qr_ref?: string | null
          reason?: string | null
          result?: string | null
          scanned_at?: string
          scanned_by?: string | null
          shipping_label_id?: string | null
        }
        Update: {
          id?: string
          qr_ref?: string | null
          reason?: string | null
          result?: string | null
          scanned_at?: string
          scanned_by?: string | null
          shipping_label_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_gate_scans_shipping_label_id_fkey"
            columns: ["shipping_label_id"]
            isOneToOne: false
            referencedRelation: "ols_shipping_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_inventory_movements: {
        Row: {
          created_at: string
          from_location: string | null
          id: string
          movement_type: string | null
          notes: string | null
          production_label_id: string | null
          reference_no: string | null
          to_location: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          from_location?: string | null
          id?: string
          movement_type?: string | null
          notes?: string | null
          production_label_id?: string | null
          reference_no?: string | null
          to_location?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          from_location?: string | null
          id?: string
          movement_type?: string | null
          notes?: string | null
          production_label_id?: string | null
          reference_no?: string | null
          to_location?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_inventory_movements_production_label_id_fkey"
            columns: ["production_label_id"]
            isOneToOne: false
            referencedRelation: "ols_production_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_label_templates: {
        Row: {
          barcode_type: string | null
          created_at: string
          fields: Json | null
          font_scale: number | null
          height_mm: number
          id: string
          label_type: string
          name: string
          show_qr: boolean | null
          updated_at: string
          width_mm: number
        }
        Insert: {
          barcode_type?: string | null
          created_at?: string
          fields?: Json | null
          font_scale?: number | null
          height_mm: number
          id?: string
          label_type: string
          name: string
          show_qr?: boolean | null
          updated_at?: string
          width_mm: number
        }
        Update: {
          barcode_type?: string | null
          created_at?: string
          fields?: Json | null
          font_scale?: number | null
          height_mm?: number
          id?: string
          label_type?: string
          name?: string
          show_qr?: boolean | null
          updated_at?: string
          width_mm?: number
        }
        Relationships: []
      }
      ols_manual_override_logs: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          ref_id: string | null
          ref_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ols_orders_cache: {
        Row: {
          created_at: string
          customer_code: string | null
          customer_name: string | null
          destination: string | null
          external_ref: string | null
          id: string
          metadata: Json | null
          order_number: string
          status: string | null
          transport_mode: string | null
        }
        Insert: {
          created_at?: string
          customer_code?: string | null
          customer_name?: string | null
          destination?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json | null
          order_number: string
          status?: string | null
          transport_mode?: string | null
        }
        Update: {
          created_at?: string
          customer_code?: string | null
          customer_name?: string | null
          destination?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json | null
          order_number?: string
          status?: string | null
          transport_mode?: string | null
        }
        Relationships: []
      }
      ols_permissions: {
        Row: {
          can_approve: boolean | null
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          id: string
          module: string
          role: string
        }
        Insert: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          module: string
          role: string
        }
        Update: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          id?: string
          module?: string
          role?: string
        }
        Relationships: []
      }
      ols_print_jobs: {
        Row: {
          command_lang: string | null
          command_payload: string | null
          created_at: string
          created_by: string | null
          id: string
          printer_id: string | null
          status: string | null
          template_id: string | null
        }
        Insert: {
          command_lang?: string | null
          command_payload?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          printer_id?: string | null
          status?: string | null
          template_id?: string | null
        }
        Update: {
          command_lang?: string | null
          command_payload?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          printer_id?: string | null
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "ols_printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_print_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ols_label_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_print_logs: {
        Row: {
          created_at: string
          id: string
          is_reprint: boolean | null
          printed_by: string | null
          printer_id: string | null
          reason: string | null
          ref_id: string | null
          ref_type: string | null
          reprint_count: number | null
          success: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_reprint?: boolean | null
          printed_by?: string | null
          printer_id?: string | null
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          reprint_count?: number | null
          success?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          is_reprint?: boolean | null
          printed_by?: string | null
          printer_id?: string | null
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          reprint_count?: number | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_print_logs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "ols_printers"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_printer_settings: {
        Row: {
          black_mark_offset_mm: number | null
          darkness: number | null
          gap_mm: number | null
          height_mm: number | null
          id: string
          metadata: Json | null
          printer_id: string
          speed: number | null
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          black_mark_offset_mm?: number | null
          darkness?: number | null
          gap_mm?: number | null
          height_mm?: number | null
          id?: string
          metadata?: Json | null
          printer_id: string
          speed?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          black_mark_offset_mm?: number | null
          darkness?: number | null
          gap_mm?: number | null
          height_mm?: number | null
          id?: string
          metadata?: Json | null
          printer_id?: string
          speed?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_printer_settings_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "ols_printers"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_printers: {
        Row: {
          command_lang: string | null
          created_at: string
          id: string
          location: string | null
          model: string | null
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          command_lang?: string | null
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          command_lang?: string | null
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ols_production_batches: {
        Row: {
          batch_no: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          mfg_date: string | null
          product_id: string | null
          qc_status: string | null
          remarks: string | null
          shelf_life_days: number | null
          shift: string | null
        }
        Insert: {
          batch_no: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string | null
          qc_status?: string | null
          remarks?: string | null
          shelf_life_days?: number | null
          shift?: string | null
        }
        Update: {
          batch_no?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string | null
          qc_status?: string | null
          remarks?: string | null
          shelf_life_days?: number | null
          shift?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_production_batches_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ols_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_production_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ols_products_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_production_labels: {
        Row: {
          batch_id: string | null
          best_before: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          gross_weight: number | null
          id: string
          label_no: string
          metadata: Json | null
          mfg_date: string | null
          net_weight: number | null
          operator_name: string | null
          product_id: string | null
          qc_status: string | null
          status: string | null
          tray_serial: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          best_before?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          gross_weight?: number | null
          id?: string
          label_no: string
          metadata?: Json | null
          mfg_date?: string | null
          net_weight?: number | null
          operator_name?: string | null
          product_id?: string | null
          qc_status?: string | null
          status?: string | null
          tray_serial?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          best_before?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          gross_weight?: number | null
          id?: string
          label_no?: string
          metadata?: Json | null
          mfg_date?: string | null
          net_weight?: number | null
          operator_name?: string | null
          product_id?: string | null
          qc_status?: string | null
          status?: string | null
          tray_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ols_production_labels_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ols_production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_production_labels_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "ols_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_production_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ols_products_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_products_cache: {
        Row: {
          category: string | null
          created_at: string
          default_gross_weight: number | null
          default_net_weight: number | null
          external_ref: string | null
          id: string
          metadata: Json | null
          name: string
          shelf_life_days: number | null
          sku: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_gross_weight?: number | null
          default_net_weight?: number | null
          external_ref?: string | null
          id?: string
          metadata?: Json | null
          name: string
          shelf_life_days?: number | null
          sku?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          default_gross_weight?: number | null
          default_net_weight?: number | null
          external_ref?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          shelf_life_days?: number | null
          sku?: string | null
        }
        Relationships: []
      }
      ols_profiles_light: {
        Row: {
          created_at: string
          default_role: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_role?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_role?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ols_reprint_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          reason: string | null
          ref_id: string | null
          ref_type: string | null
          requested_by: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          requested_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          requested_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ols_scan_history: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          result: string | null
          scan_context: string | null
          scan_value: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          result?: string | null
          scan_context?: string | null
          scan_value?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          result?: string | null
          scan_context?: string | null
          scan_value?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ols_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      ols_shipping_labels: {
        Row: {
          address: string | null
          carton_id: string | null
          consignee: string | null
          consignor: string | null
          created_at: string
          eway_ref: string | null
          handling_marks: string | null
          id: string
          invoice_ref: string | null
          phone: string | null
          pi_id: string | null
          qr_ref: string | null
          route: string | null
          shipping_no: string
          status: string | null
          transport_ref: string | null
        }
        Insert: {
          address?: string | null
          carton_id?: string | null
          consignee?: string | null
          consignor?: string | null
          created_at?: string
          eway_ref?: string | null
          handling_marks?: string | null
          id?: string
          invoice_ref?: string | null
          phone?: string | null
          pi_id?: string | null
          qr_ref?: string | null
          route?: string | null
          shipping_no: string
          status?: string | null
          transport_ref?: string | null
        }
        Update: {
          address?: string | null
          carton_id?: string | null
          consignee?: string | null
          consignor?: string | null
          created_at?: string
          eway_ref?: string | null
          handling_marks?: string | null
          id?: string
          invoice_ref?: string | null
          phone?: string | null
          pi_id?: string | null
          qr_ref?: string | null
          route?: string | null
          shipping_no?: string
          status?: string | null
          transport_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ols_shipping_labels_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "ols_cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ols_shipping_labels_pi_id_fkey"
            columns: ["pi_id"]
            isOneToOne: false
            referencedRelation: "ols_finance_pi"
            referencedColumns: ["id"]
          },
        ]
      }
      ols_stock_units: {
        Row: {
          current_location: string | null
          current_status: string | null
          id: string
          production_label_id: string | null
          updated_at: string
        }
        Insert: {
          current_location?: string | null
          current_status?: string | null
          id?: string
          production_label_id?: string | null
          updated_at?: string
        }
        Update: {
          current_location?: string | null
          current_status?: string | null
          id?: string
          production_label_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ols_stock_units_production_label_id_fkey"
            columns: ["production_label_id"]
            isOneToOne: true
            referencedRelation: "ols_production_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_events: {
        Row: {
          actor_department: string | null
          actor_id: string | null
          actor_role: string | null
          causation_id: string | null
          command_id: string | null
          command_name: string | null
          correlation_id: string
          created_at: string
          customer_id: string | null
          entity_id: string
          entity_type: string
          event_type: string
          event_version: number
          id: string
          idempotency_key: string | null
          message: string | null
          metadata: Json
          occurred_at: string
          order_id: string | null
          payload_fingerprint: string
          queue_item_id: string | null
          reason_code: string | null
          reason_text: string | null
          severity: string
          source_application: string
          title: string
          visibility: string
        }
        Insert: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          causation_id?: string | null
          command_id?: string | null
          command_name?: string | null
          correlation_id: string
          created_at?: string
          customer_id?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          event_version?: number
          id?: string
          idempotency_key?: string | null
          message?: string | null
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          payload_fingerprint: string
          queue_item_id?: string | null
          reason_code?: string | null
          reason_text?: string | null
          severity?: string
          source_application?: string
          title: string
          visibility?: string
        }
        Update: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          causation_id?: string | null
          command_id?: string | null
          command_name?: string | null
          correlation_id?: string
          created_at?: string
          customer_id?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          event_version?: number
          id?: string
          idempotency_key?: string | null
          message?: string | null
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          payload_fingerprint?: string
          queue_item_id?: string | null
          reason_code?: string | null
          reason_text?: string | null
          severity?: string
          source_application?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_events_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "operational_queue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_queue_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          from_department: string | null
          from_user_id: string | null
          id: string
          queue_item_id: string
          reason: string | null
          to_department: string | null
          to_user_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          from_department?: string | null
          from_user_id?: string | null
          id?: string
          queue_item_id: string
          reason?: string | null
          to_department?: string | null
          to_user_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          from_department?: string | null
          from_user_id?: string | null
          id?: string
          queue_item_id?: string
          reason?: string | null
          to_department?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_queue_assignments_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "operational_queue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_queue_items: {
        Row: {
          assigned_to: string | null
          blocker_code: string | null
          blocker_summary: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          entity_id: string
          entity_type: string
          escalation_level: string
          id: string
          order_id: string | null
          owner_department: string | null
          priority: string
          queue_type: string
          sla_due_at: string | null
          source: string
          state: string
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          assigned_to?: string | null
          blocker_code?: string | null
          blocker_summary?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          entity_id: string
          entity_type: string
          escalation_level?: string
          id?: string
          order_id?: string | null
          owner_department?: string | null
          priority?: string
          queue_type: string
          sla_due_at?: string | null
          source?: string
          state?: string
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          assigned_to?: string | null
          blocker_code?: string | null
          blocker_summary?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          entity_id?: string
          entity_type?: string
          escalation_level?: string
          id?: string
          order_id?: string | null
          owner_department?: string | null
          priority?: string
          queue_type?: string
          sla_due_at?: string | null
          source?: string
          state?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      operational_scan_records: {
        Row: {
          actor_department: string | null
          actor_id: string | null
          actor_role: string | null
          barcode_value: string
          correlation_id: string
          created_at: string
          entity_id: string
          entity_type: string
          expected_barcode: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          mismatch_reason: string | null
          order_id: string | null
          photo_evidence_url: string | null
          queue_item_id: string | null
          scan_device_id: string | null
          scan_source: string
          scan_type: string
          verification_status: string
          verification_type: string
        }
        Insert: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          barcode_value: string
          correlation_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          expected_barcode?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          mismatch_reason?: string | null
          order_id?: string | null
          photo_evidence_url?: string | null
          queue_item_id?: string | null
          scan_device_id?: string | null
          scan_source: string
          scan_type: string
          verification_status: string
          verification_type: string
        }
        Update: {
          actor_department?: string | null
          actor_id?: string | null
          actor_role?: string | null
          barcode_value?: string
          correlation_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          expected_barcode?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          mismatch_reason?: string | null
          order_id?: string | null
          photo_evidence_url?: string | null
          queue_item_id?: string | null
          scan_device_id?: string | null
          scan_source?: string
          scan_type?: string
          verification_status?: string
          verification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_scan_records_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "operational_queue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_search_index: {
        Row: {
          aliases: string[]
          barcode_values: string[]
          created_at: string
          customer_id: string | null
          department: string | null
          email_tokens: string[]
          entity_id: string
          entity_type: string
          event_id: string | null
          id: string
          metadata: Json
          normalized_tokens: string[]
          order_id: string | null
          phone_tokens: string[]
          public_ref: string | null
          queue_item_id: string | null
          scan_record_id: string | null
          search_body: string | null
          search_subtitle: string | null
          search_title: string
          sensitivity: string
          so_numbers: string[]
          source: string
          updated_at: string
          visibility: string
        }
        Insert: {
          aliases?: string[]
          barcode_values?: string[]
          created_at?: string
          customer_id?: string | null
          department?: string | null
          email_tokens?: string[]
          entity_id: string
          entity_type: string
          event_id?: string | null
          id?: string
          metadata?: Json
          normalized_tokens?: string[]
          order_id?: string | null
          phone_tokens?: string[]
          public_ref?: string | null
          queue_item_id?: string | null
          scan_record_id?: string | null
          search_body?: string | null
          search_subtitle?: string | null
          search_title: string
          sensitivity?: string
          so_numbers?: string[]
          source: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          aliases?: string[]
          barcode_values?: string[]
          created_at?: string
          customer_id?: string | null
          department?: string | null
          email_tokens?: string[]
          entity_id?: string
          entity_type?: string
          event_id?: string | null
          id?: string
          metadata?: Json
          normalized_tokens?: string[]
          order_id?: string | null
          phone_tokens?: string[]
          public_ref?: string | null
          queue_item_id?: string | null
          scan_record_id?: string | null
          search_body?: string | null
          search_subtitle?: string | null
          search_title?: string
          sensitivity?: string
          so_numbers?: string[]
          source?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_search_index_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "operational_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_search_index_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "operational_queue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_search_index_scan_record_id_fkey"
            columns: ["scan_record_id"]
            isOneToOne: false
            referencedRelation: "operational_scan_records"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          attachment_type: string | null
          created_at: string | null
          file_url: string
          id: string
          order_id: string | null
        }
        Insert: {
          attachment_type?: string | null
          created_at?: string | null
          file_url: string
          id?: string
          order_id?: string | null
        }
        Update: {
          attachment_type?: string | null
          created_at?: string | null
          file_url?: string
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          weight_kg: number | null
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
          weight_kg?: number | null
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
          weight_kg?: number | null
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
          proof_storage_path: string | null
          proof_url: string | null
          reference_no: string | null
          rejection_reason: string | null
          status: string | null
          verified_at: string | null
          verified_by: string | null
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
          proof_storage_path?: string | null
          proof_url?: string | null
          reference_no?: string | null
          rejection_reason?: string | null
          status?: string | null
          verified_at?: string | null
          verified_by?: string | null
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
          proof_storage_path?: string | null
          proof_url?: string | null
          reference_no?: string | null
          rejection_reason?: string | null
          status?: string | null
          verified_at?: string | null
          verified_by?: string | null
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
            foreignKeyName: "order_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
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
      order_returns: {
        Row: {
          admin_approval: boolean | null
          created_at: string | null
          defect_details: string | null
          final_credit_value: number | null
          gate_entry_logged_at: string | null
          id: string
          inspection_notes: string | null
          is_manufacturing_defect: boolean | null
          logged_by: string | null
          loss_amount: number | null
          order_id: string | null
          original_value: number | null
          product_id: string | null
          quantity_returned: number
          reason: string | null
          status: string | null
        }
        Insert: {
          admin_approval?: boolean | null
          created_at?: string | null
          defect_details?: string | null
          final_credit_value?: number | null
          gate_entry_logged_at?: string | null
          id?: string
          inspection_notes?: string | null
          is_manufacturing_defect?: boolean | null
          logged_by?: string | null
          loss_amount?: number | null
          order_id?: string | null
          original_value?: number | null
          product_id?: string | null
          quantity_returned: number
          reason?: string | null
          status?: string | null
        }
        Update: {
          admin_approval?: boolean | null
          created_at?: string | null
          defect_details?: string | null
          final_credit_value?: number | null
          gate_entry_logged_at?: string | null
          id?: string
          inspection_notes?: string | null
          is_manufacturing_defect?: boolean | null
          logged_by?: string | null
          loss_amount?: number | null
          order_id?: string | null
          original_value?: number | null
          product_id?: string | null
          quantity_returned?: number
          reason?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_returns_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          duplicate_of_order_id: string | null
          estimated_despatch_date: string | null
          eway_bill_number: string | null
          eway_bill_url: string | null
          final_invoice_url: string | null
          finance_verified_at: string | null
          finance_verified_by: string | null
          gate_pass_number: string | null
          id: string
          is_duplicate: boolean
          is_export: boolean | null
          is_starter_pack: boolean
          is_waste: boolean
          needs_clarification: boolean
          order_number: string
          parser_confidence: number | null
          payment_cleared: boolean | null
          payment_receipt_url: string | null
          payment_rejection_reason: string | null
          payment_status: string | null
          port_of_discharge: string | null
          proforma_invoice_url: string | null
          requested_dispatch_date: string | null
          sales_order_value: number | null
          status: string
          system_estimated_date: string | null
          total_weight_kg: number | null
          tracking_number: string | null
          tracking_token: string | null
          wamid: string | null
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
          duplicate_of_order_id?: string | null
          estimated_despatch_date?: string | null
          eway_bill_number?: string | null
          eway_bill_url?: string | null
          final_invoice_url?: string | null
          finance_verified_at?: string | null
          finance_verified_by?: string | null
          gate_pass_number?: string | null
          id?: string
          is_duplicate?: boolean
          is_export?: boolean | null
          is_starter_pack?: boolean
          is_waste?: boolean
          needs_clarification?: boolean
          order_number: string
          parser_confidence?: number | null
          payment_cleared?: boolean | null
          payment_receipt_url?: string | null
          payment_rejection_reason?: string | null
          payment_status?: string | null
          port_of_discharge?: string | null
          proforma_invoice_url?: string | null
          requested_dispatch_date?: string | null
          sales_order_value?: number | null
          status?: string
          system_estimated_date?: string | null
          total_weight_kg?: number | null
          tracking_number?: string | null
          tracking_token?: string | null
          wamid?: string | null
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
          duplicate_of_order_id?: string | null
          estimated_despatch_date?: string | null
          eway_bill_number?: string | null
          eway_bill_url?: string | null
          final_invoice_url?: string | null
          finance_verified_at?: string | null
          finance_verified_by?: string | null
          gate_pass_number?: string | null
          id?: string
          is_duplicate?: boolean
          is_export?: boolean | null
          is_starter_pack?: boolean
          is_waste?: boolean
          needs_clarification?: boolean
          order_number?: string
          parser_confidence?: number | null
          payment_cleared?: boolean | null
          payment_receipt_url?: string | null
          payment_rejection_reason?: string | null
          payment_status?: string | null
          port_of_discharge?: string | null
          proforma_invoice_url?: string | null
          requested_dispatch_date?: string | null
          sales_order_value?: number | null
          status?: string
          system_estimated_date?: string | null
          total_weight_kg?: number | null
          tracking_number?: string | null
          tracking_token?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "orders_duplicate_of_order_id_fkey"
            columns: ["duplicate_of_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      org_branches: {
        Row: {
          branch_code: string | null
          branch_type: string
          company_id: string
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_code?: string | null
          branch_type?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_code?: string | null
          branch_type?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "org_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_companies: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          external_ref: string | null
          id: string
          legal_name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_ref?: string | null
          id?: string
          legal_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_ref?: string | null
          id?: string
          legal_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_contacts: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_membership_branch_scopes: {
        Row: {
          branch_id: string
          created_at: string
          membership_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          membership_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_membership_branch_scopes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "org_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_membership_branch_scopes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "org_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      org_membership_roles: {
        Row: {
          created_at: string
          membership_id: string
          role_key: string
        }
        Insert: {
          created_at?: string
          membership_id: string
          role_key: string
        }
        Update: {
          created_at?: string
          membership_id?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_membership_roles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "org_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "org_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "org_contacts"
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
            referencedRelation: "b2b_dispatch_so_line_fulfilment"
            referencedColumns: ["order_item_id"]
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
          {
            foreignKeyName: "portal_access_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
        ]
      }
      premium_announcements: {
        Row: {
          completion_count: number
          created_at: string
          cta_link: string | null
          cta_text: string | null
          display_duration: number
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          priority: string
          skip_count: number
          start_date: string
          subtitle: string | null
          target_audience: string
          target_region: string | null
          title: string
          trigger_delay: number
          updated_at: string
          video_url: string | null
          view_count: number
        }
        Insert: {
          completion_count?: number
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          display_duration?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          priority?: string
          skip_count?: number
          start_date?: string
          subtitle?: string | null
          target_audience?: string
          target_region?: string | null
          title: string
          trigger_delay?: number
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Update: {
          completion_count?: number
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          display_duration?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          priority?: string
          skip_count?: number
          start_date?: string
          subtitle?: string | null
          target_audience?: string
          target_region?: string | null
          title?: string
          trigger_delay?: number
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Relationships: []
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
      product_aliases: {
        Row: {
          alias_text: string
          canonical_name: string
          created_at: string
          id: string
          product_id: string | null
        }
        Insert: {
          alias_text: string
          canonical_name: string
          created_at?: string
          id?: string
          product_id?: string | null
        }
        Update: {
          alias_text?: string
          canonical_name?: string
          created_at?: string
          id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bom: {
        Row: {
          bom_type: string
          component_name: string | null
          component_product_id: string | null
          created_at: string
          id: string
          product_id: string
          quantity_per_unit: number
          source_department: string | null
        }
        Insert: {
          bom_type?: string
          component_name?: string | null
          component_product_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity_per_unit?: number
          source_department?: string | null
        }
        Update: {
          bom_type?: string
          component_name?: string | null
          component_product_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity_per_unit?: number
          source_department?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_bom_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bom_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt_text: string | null
          angle: string | null
          created_at: string
          file_url: string
          id: string
          product_id: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          alt_text?: string | null
          angle?: string | null
          created_at?: string
          file_url: string
          id?: string
          product_id?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          alt_text?: string | null
          angle?: string | null
          created_at?: string
          file_url?: string
          id?: string
          product_id?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_moq_rules: {
        Row: {
          allow_override: boolean
          carton_logic: string | null
          channel: string
          created_at: string
          customer_type: string | null
          id: string
          increment_uom: string | null
          increment_value: number | null
          min_carton_qty: number | null
          moq_applicable: boolean
          moq_uom: string | null
          moq_value: number | null
          notes: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          allow_override?: boolean
          carton_logic?: string | null
          channel: string
          created_at?: string
          customer_type?: string | null
          id?: string
          increment_uom?: string | null
          increment_value?: number | null
          min_carton_qty?: number | null
          moq_applicable?: boolean
          moq_uom?: string | null
          moq_value?: number | null
          notes?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          allow_override?: boolean
          carton_logic?: string | null
          channel?: string
          created_at?: string
          customer_type?: string | null
          id?: string
          increment_uom?: string | null
          increment_value?: number | null
          min_carton_qty?: number | null
          moq_applicable?: boolean
          moq_uom?: string | null
          moq_value?: number | null
          notes?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_moq_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_rules: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          base_price: number | null
          calculated_price: number | null
          created_at: string
          currency: string
          discount_percent: number | null
          gst_rate: number | null
          id: string
          notes: string | null
          price_channel: string
          price_type: string
          product_id: string
          source: string
          tax_inclusive: boolean
          uom: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          base_price?: number | null
          calculated_price?: number | null
          created_at?: string
          currency?: string
          discount_percent?: number | null
          gst_rate?: number | null
          id?: string
          notes?: string | null
          price_channel: string
          price_type?: string
          product_id: string
          source?: string
          tax_inclusive?: boolean
          uom?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          base_price?: number | null
          calculated_price?: number | null
          created_at?: string
          currency?: string
          discount_percent?: number | null
          gst_rate?: number | null
          id?: string
          notes?: string | null
          price_channel?: string
          price_type?: string
          product_id?: string
          source?: string
          tax_inclusive?: boolean
          uom?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tag_mapping: {
        Row: {
          id: string
          manual_sort_index: number | null
          product_id: string | null
          tag_id: string | null
        }
        Insert: {
          id?: string
          manual_sort_index?: number | null
          product_id?: string | null
          tag_id?: string | null
        }
        Update: {
          id?: string
          manual_sort_index?: number | null
          product_id?: string | null
          tag_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_tag_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tag_mapping_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "product_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          tag_key: string
          tag_label: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          tag_key: string
          tag_label: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          tag_key?: string
          tag_label?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          moq: number
          price: number
          product_id: string
          sku: string | null
          updated_at: string
          variant_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          moq?: number
          price?: number
          product_id: string
          sku?: string | null
          updated_at?: string
          variant_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          moq?: number
          price?: number
          product_id?: string
          sku?: string | null
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_issues: {
        Row: {
          comment: string | null
          created_at: string | null
          department: string
          id: string
          issue_type: string
          job_id: string | null
          photo_url: string | null
          reported_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          department: string
          id?: string
          issue_type: string
          job_id?: string | null
          photo_url?: string | null
          reported_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          department?: string
          id?: string
          issue_type?: string
          job_id?: string | null
          photo_url?: string | null
          reported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_jobs: {
        Row: {
          assigned_qty: number
          assigned_to: string | null
          batch_number: string | null
          completed_at: string | null
          created_at: string | null
          department: string
          id: string
          locked: boolean | null
          net_weight_per_unit: number | null
          order_id: string | null
          order_item_id: string | null
          priority: string
          produced_qty: number | null
          product_id: string | null
          rejection_reason: string | null
          stage: string
          started_at: string | null
          status: string
          updated_at: string | null
          wasted_qty: number | null
        }
        Insert: {
          assigned_qty?: number
          assigned_to?: string | null
          batch_number?: string | null
          completed_at?: string | null
          created_at?: string | null
          department: string
          id?: string
          locked?: boolean | null
          net_weight_per_unit?: number | null
          order_id?: string | null
          order_item_id?: string | null
          priority?: string
          produced_qty?: number | null
          product_id?: string | null
          rejection_reason?: string | null
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          wasted_qty?: number | null
        }
        Update: {
          assigned_qty?: number
          assigned_to?: string | null
          batch_number?: string | null
          completed_at?: string | null
          created_at?: string | null
          department?: string
          id?: string
          locked?: boolean | null
          net_weight_per_unit?: number | null
          order_id?: string | null
          order_item_id?: string | null
          priority?: string
          produced_qty?: number | null
          product_id?: string | null
          rejection_reason?: string | null
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          wasted_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "b2b_dispatch_so_line_fulfilment"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "production_jobs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_pauses: {
        Row: {
          comment: string | null
          id: string
          job_id: string
          paused_at: string | null
          paused_by: string | null
          reason: string
          resumed_at: string | null
        }
        Insert: {
          comment?: string | null
          id?: string
          job_id: string
          paused_at?: string | null
          paused_by?: string | null
          reason: string
          resumed_at?: string | null
        }
        Update: {
          comment?: string | null
          id?: string
          job_id?: string
          paused_at?: string | null
          paused_by?: string | null
          reason?: string
          resumed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_pauses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_rgs_transfers: {
        Row: {
          batch_number: string | null
          created_at: string | null
          id: string
          job_id: string
          product_id: string | null
          quantity: number
          rgs_notified: boolean | null
          transferred_by: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          product_id?: string | null
          quantity?: number
          rgs_notified?: boolean | null
          transferred_by?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          product_id?: string | null
          quantity?: number
          rgs_notified?: boolean | null
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_rgs_transfers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_rgs_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          aliases: string[] | null
          allergen_warnings: string | null
          avg_weight_per_pack: number | null
          avg_weight_per_pc: number | null
          b2b_uom: string | null
          barcode_sku: string | null
          base_price: number | null
          bom_required: boolean
          bom_summary: string | null
          carton_logic: string | null
          carton_qty: number | null
          carton_type: string | null
          carton_uom: string | null
          category: string
          category_code: string | null
          category_id: string | null
          color_finish_notes: string | null
          cost_per_kg: number | null
          cost_per_master_carton: number | null
          cost_per_pc: number | null
          cost_per_primary_pack: number | null
          created_at: string | null
          currency: string | null
          customization_allowed: boolean | null
          customization_caution: string | null
          customization_note: string | null
          default_store: string | null
          department: string | null
          description: string | null
          dietary_tags: string[] | null
          dimension_h_cm: number | null
          dimension_l_cm: number | null
          dimension_w_cm: number | null
          dimensions: string | null
          division_code: string | null
          external_reference_code: string | null
          festival_tags: string | null
          fixed_carton_required: boolean | null
          frozen_shelf_life_days: number | null
          grams_per_piece: number | null
          gross_weight_g: number | null
          gross_weight_grams: number | null
          gross_weight_kg: number | null
          gst_percentage: number | null
          gst_rate: number | null
          hero_image_url: string | null
          hsn_code: string
          id: string
          image_url: string | null
          increment_uom: string | null
          increment_value: number | null
          ingredients: string | null
          is_active: boolean
          is_catalogue_ready: boolean | null
          is_sample: boolean | null
          kg_per_master_carton: number | null
          kg_per_primary_pack: number | null
          label_status: string | null
          legacy_sku: string | null
          main_department: string | null
          master_carton_qty: number | null
          master_carton_uom: string | null
          material: string | null
          material_type: string | null
          media_status: string | null
          moq: number | null
          moq_packs: number | null
          moq_rule_type: string | null
          moq_text: string | null
          moq_uom: string | null
          moq_value: number | null
          mrp: number | null
          mrp_per_kg: number | null
          mrp_per_master_carton: number | null
          mrp_per_pc: number | null
          mrp_per_primary_pack: number | null
          name: string
          net_weight_g: number | null
          net_weight_grams: number | null
          nutrition_facts: string | null
          nutritional_info: Json | null
          operational_notes: string | null
          pack_size: string | null
          packaging_code: string | null
          packs_per_carton: number | null
          packs_per_master_carton: number | null
          pcs_per_carton: number | null
          pcs_per_kg: number | null
          pcs_per_master_carton: number | null
          pcs_per_pack: number | null
          pcs_per_primary_pack: number | null
          post_processing_shelf_life_days: number | null
          price_b2b: number | null
          price_b2b_per_carton: number | null
          price_b2b_per_pack: number | null
          price_bulk: number | null
          price_horeca: number | null
          price_per_kg: number | null
          price_special: number | null
          price_wholesale: number | null
          pricing_notes: string | null
          primary_pack_weight_kg: number
          primary_uom: string | null
          private_label_allowed: boolean | null
          private_label_cost_per_unit: number | null
          private_label_moq: number | null
          private_label_moq_uom: string | null
          private_label_price: number | null
          private_label_upfront_cost: number | null
          product_class: string | null
          product_dimensions_cm: string | null
          product_family: string | null
          product_name: string | null
          product_type: string | null
          production_department: string | null
          retail_uom: string | null
          serial_no: number | null
          settlement_unit: string | null
          shelf_life: string | null
          shelf_life_days: number | null
          short_description: string | null
          short_name: string | null
          sku: string
          sku_locked: boolean | null
          storage_instructions: string | null
          storage_type: string | null
          sub_category: string | null
          subcategory: string | null
          subcategory_code: string | null
          temperature_requirement: string | null
          thawing_instruction: string | null
          unit_conversion_note: string | null
          uom: string | null
          visible_in_catalog: boolean
          weight_per_box_kg: number | null
          weight_per_pc_grams: number | null
          wholesale_price: number | null
        }
        Insert: {
          aliases?: string[] | null
          allergen_warnings?: string | null
          avg_weight_per_pack?: number | null
          avg_weight_per_pc?: number | null
          b2b_uom?: string | null
          barcode_sku?: string | null
          base_price?: number | null
          bom_required?: boolean
          bom_summary?: string | null
          carton_logic?: string | null
          carton_qty?: number | null
          carton_type?: string | null
          carton_uom?: string | null
          category: string
          category_code?: string | null
          category_id?: string | null
          color_finish_notes?: string | null
          cost_per_kg?: number | null
          cost_per_master_carton?: number | null
          cost_per_pc?: number | null
          cost_per_primary_pack?: number | null
          created_at?: string | null
          currency?: string | null
          customization_allowed?: boolean | null
          customization_caution?: string | null
          customization_note?: string | null
          default_store?: string | null
          department?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          dimension_h_cm?: number | null
          dimension_l_cm?: number | null
          dimension_w_cm?: number | null
          dimensions?: string | null
          division_code?: string | null
          external_reference_code?: string | null
          festival_tags?: string | null
          fixed_carton_required?: boolean | null
          frozen_shelf_life_days?: number | null
          grams_per_piece?: number | null
          gross_weight_g?: number | null
          gross_weight_grams?: number | null
          gross_weight_kg?: number | null
          gst_percentage?: number | null
          gst_rate?: number | null
          hero_image_url?: string | null
          hsn_code: string
          id?: string
          image_url?: string | null
          increment_uom?: string | null
          increment_value?: number | null
          ingredients?: string | null
          is_active?: boolean
          is_catalogue_ready?: boolean | null
          is_sample?: boolean | null
          kg_per_master_carton?: number | null
          kg_per_primary_pack?: number | null
          label_status?: string | null
          legacy_sku?: string | null
          main_department?: string | null
          master_carton_qty?: number | null
          master_carton_uom?: string | null
          material?: string | null
          material_type?: string | null
          media_status?: string | null
          moq?: number | null
          moq_packs?: number | null
          moq_rule_type?: string | null
          moq_text?: string | null
          moq_uom?: string | null
          moq_value?: number | null
          mrp?: number | null
          mrp_per_kg?: number | null
          mrp_per_master_carton?: number | null
          mrp_per_pc?: number | null
          mrp_per_primary_pack?: number | null
          name: string
          net_weight_g?: number | null
          net_weight_grams?: number | null
          nutrition_facts?: string | null
          nutritional_info?: Json | null
          operational_notes?: string | null
          pack_size?: string | null
          packaging_code?: string | null
          packs_per_carton?: number | null
          packs_per_master_carton?: number | null
          pcs_per_carton?: number | null
          pcs_per_kg?: number | null
          pcs_per_master_carton?: number | null
          pcs_per_pack?: number | null
          pcs_per_primary_pack?: number | null
          post_processing_shelf_life_days?: number | null
          price_b2b?: number | null
          price_b2b_per_carton?: number | null
          price_b2b_per_pack?: number | null
          price_bulk?: number | null
          price_horeca?: number | null
          price_per_kg?: number | null
          price_special?: number | null
          price_wholesale?: number | null
          pricing_notes?: string | null
          primary_pack_weight_kg?: number
          primary_uom?: string | null
          private_label_allowed?: boolean | null
          private_label_cost_per_unit?: number | null
          private_label_moq?: number | null
          private_label_moq_uom?: string | null
          private_label_price?: number | null
          private_label_upfront_cost?: number | null
          product_class?: string | null
          product_dimensions_cm?: string | null
          product_family?: string | null
          product_name?: string | null
          product_type?: string | null
          production_department?: string | null
          retail_uom?: string | null
          serial_no?: number | null
          settlement_unit?: string | null
          shelf_life?: string | null
          shelf_life_days?: number | null
          short_description?: string | null
          short_name?: string | null
          sku: string
          sku_locked?: boolean | null
          storage_instructions?: string | null
          storage_type?: string | null
          sub_category?: string | null
          subcategory?: string | null
          subcategory_code?: string | null
          temperature_requirement?: string | null
          thawing_instruction?: string | null
          unit_conversion_note?: string | null
          uom?: string | null
          visible_in_catalog?: boolean
          weight_per_box_kg?: number | null
          weight_per_pc_grams?: number | null
          wholesale_price?: number | null
        }
        Update: {
          aliases?: string[] | null
          allergen_warnings?: string | null
          avg_weight_per_pack?: number | null
          avg_weight_per_pc?: number | null
          b2b_uom?: string | null
          barcode_sku?: string | null
          base_price?: number | null
          bom_required?: boolean
          bom_summary?: string | null
          carton_logic?: string | null
          carton_qty?: number | null
          carton_type?: string | null
          carton_uom?: string | null
          category?: string
          category_code?: string | null
          category_id?: string | null
          color_finish_notes?: string | null
          cost_per_kg?: number | null
          cost_per_master_carton?: number | null
          cost_per_pc?: number | null
          cost_per_primary_pack?: number | null
          created_at?: string | null
          currency?: string | null
          customization_allowed?: boolean | null
          customization_caution?: string | null
          customization_note?: string | null
          default_store?: string | null
          department?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          dimension_h_cm?: number | null
          dimension_l_cm?: number | null
          dimension_w_cm?: number | null
          dimensions?: string | null
          division_code?: string | null
          external_reference_code?: string | null
          festival_tags?: string | null
          fixed_carton_required?: boolean | null
          frozen_shelf_life_days?: number | null
          grams_per_piece?: number | null
          gross_weight_g?: number | null
          gross_weight_grams?: number | null
          gross_weight_kg?: number | null
          gst_percentage?: number | null
          gst_rate?: number | null
          hero_image_url?: string | null
          hsn_code?: string
          id?: string
          image_url?: string | null
          increment_uom?: string | null
          increment_value?: number | null
          ingredients?: string | null
          is_active?: boolean
          is_catalogue_ready?: boolean | null
          is_sample?: boolean | null
          kg_per_master_carton?: number | null
          kg_per_primary_pack?: number | null
          label_status?: string | null
          legacy_sku?: string | null
          main_department?: string | null
          master_carton_qty?: number | null
          master_carton_uom?: string | null
          material?: string | null
          material_type?: string | null
          media_status?: string | null
          moq?: number | null
          moq_packs?: number | null
          moq_rule_type?: string | null
          moq_text?: string | null
          moq_uom?: string | null
          moq_value?: number | null
          mrp?: number | null
          mrp_per_kg?: number | null
          mrp_per_master_carton?: number | null
          mrp_per_pc?: number | null
          mrp_per_primary_pack?: number | null
          name?: string
          net_weight_g?: number | null
          net_weight_grams?: number | null
          nutrition_facts?: string | null
          nutritional_info?: Json | null
          operational_notes?: string | null
          pack_size?: string | null
          packaging_code?: string | null
          packs_per_carton?: number | null
          packs_per_master_carton?: number | null
          pcs_per_carton?: number | null
          pcs_per_kg?: number | null
          pcs_per_master_carton?: number | null
          pcs_per_pack?: number | null
          pcs_per_primary_pack?: number | null
          post_processing_shelf_life_days?: number | null
          price_b2b?: number | null
          price_b2b_per_carton?: number | null
          price_b2b_per_pack?: number | null
          price_bulk?: number | null
          price_horeca?: number | null
          price_per_kg?: number | null
          price_special?: number | null
          price_wholesale?: number | null
          pricing_notes?: string | null
          primary_pack_weight_kg?: number
          primary_uom?: string | null
          private_label_allowed?: boolean | null
          private_label_cost_per_unit?: number | null
          private_label_moq?: number | null
          private_label_moq_uom?: string | null
          private_label_price?: number | null
          private_label_upfront_cost?: number | null
          product_class?: string | null
          product_dimensions_cm?: string | null
          product_family?: string | null
          product_name?: string | null
          product_type?: string | null
          production_department?: string | null
          retail_uom?: string | null
          serial_no?: number | null
          settlement_unit?: string | null
          shelf_life?: string | null
          shelf_life_days?: number | null
          short_description?: string | null
          short_name?: string | null
          sku?: string
          sku_locked?: boolean | null
          storage_instructions?: string | null
          storage_type?: string | null
          sub_category?: string | null
          subcategory?: string | null
          subcategory_code?: string | null
          temperature_requirement?: string | null
          thawing_instruction?: string | null
          unit_conversion_note?: string | null
          uom?: string | null
          visible_in_catalog?: boolean
          weight_per_box_kg?: number | null
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
      profile_change_requests: {
        Row: {
          admin_notes: string | null
          company_id: string
          created_at: string
          current_value: string | null
          field_name: string
          id: string
          requested_by: string | null
          requested_value: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          company_id: string
          created_at?: string
          current_value?: string | null
          field_name: string
          id?: string
          requested_by?: string | null
          requested_value: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          company_id?: string
          created_at?: string
          current_value?: string | null
          field_name?: string
          id?: string
          requested_by?: string | null
          requested_value?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
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
          status: string
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
          status?: string
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
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
        ]
      }
      realtime_subscription_contracts: {
        Row: {
          consumer_applications: string[]
          created_at: string
          enabled: boolean
          event_types: string[]
          id: string
          notes: string | null
          owning_application: string
          rls_required: boolean
          row_filter_required: boolean
          schema_name: string
          table_name: string
          updated_at: string
        }
        Insert: {
          consumer_applications?: string[]
          created_at?: string
          enabled?: boolean
          event_types?: string[]
          id?: string
          notes?: string | null
          owning_application: string
          rls_required?: boolean
          row_filter_required?: boolean
          schema_name?: string
          table_name: string
          updated_at?: string
        }
        Update: {
          consumer_applications?: string[]
          created_at?: string
          enabled?: boolean
          event_types?: string[]
          id?: string
          notes?: string | null
          owning_application?: string
          rls_required?: boolean
          row_filter_required?: boolean
          schema_name?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      reorder_alerts: {
        Row: {
          company_id: string
          contacted_at: string | null
          created_at: string
          expected_on: string
          id: string
          last_order_id: string | null
          reason_code: string
          resolution_notes: string | null
          resolved_at: string | null
          sales_exec_id: string | null
          snoozed_until: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contacted_at?: string | null
          created_at?: string
          expected_on: string
          id?: string
          last_order_id?: string | null
          reason_code: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sales_exec_id?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contacted_at?: string | null
          created_at?: string
          expected_on?: string
          id?: string
          last_order_id?: string | null
          reason_code?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sales_exec_id?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reorder_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "reorder_alerts_last_order_id_fkey"
            columns: ["last_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alerts_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      retry_policies: {
        Row: {
          backoff_multiplier: number
          base_delay_seconds: number
          created_at: string
          dead_letter_enabled: boolean
          id: string
          is_active: boolean
          jitter_percent: number
          max_attempts: number
          max_delay_seconds: number
          owning_application: string
          policy_key: string
          updated_at: string
          workload_type: string
        }
        Insert: {
          backoff_multiplier?: number
          base_delay_seconds?: number
          created_at?: string
          dead_letter_enabled?: boolean
          id?: string
          is_active?: boolean
          jitter_percent?: number
          max_attempts?: number
          max_delay_seconds?: number
          owning_application: string
          policy_key: string
          updated_at?: string
          workload_type: string
        }
        Update: {
          backoff_multiplier?: number
          base_delay_seconds?: number
          created_at?: string
          dead_letter_enabled?: boolean
          id?: string
          is_active?: boolean
          jitter_percent?: number
          max_attempts?: number
          max_delay_seconds?: number
          owning_application?: string
          policy_key?: string
          updated_at?: string
          workload_type?: string
        }
        Relationships: []
      }
      role_permission_grants: {
        Row: {
          created_at: string
          effect: string
          permission_key: string
          role_key: string
        }
        Insert: {
          created_at?: string
          effect?: string
          permission_key: string
          role_key: string
        }
        Update: {
          created_at?: string
          effect?: string
          permission_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_grants_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "access_permissions"
            referencedColumns: ["permission_key"]
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
      sales_commission_events: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          order_id: string | null
          reason: string
          sales_exec_id: string
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          order_id?: string | null
          reason: string
          sales_exec_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          reason?: string
          sales_exec_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_commission_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commission_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "sales_commission_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commission_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commission_events_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_escalations: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          escalation_type: string
          id: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          sales_exec_id: string | null
          severity: string
          status: string
          task_id: string | null
          ticket_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          escalation_type: string
          id?: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sales_exec_id?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          escalation_type?: string
          id?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sales_exec_id?: string | null
          severity?: string
          status?: string
          task_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_escalations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_escalations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_escalations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "sales_escalations_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_escalations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_escalations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_draft_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          draft_id: string
          from_status: string | null
          id: string
          metadata: Json
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          draft_id: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          draft_id?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_draft_audit_log_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sales_order_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_draft_lines: {
        Row: {
          ai_line_snapshot: Json
          conversion_explanation: string | null
          created_at: string
          draft_id: string
          id: string
          line_index: number
          normalized_quantity: number | null
          normalized_unit: string | null
          operator_line_snapshot: Json
          operator_quantity: number | null
          original_text_span: string | null
          product_confidence: number | null
          product_id: string | null
          product_name: string
          quantity_confidence: number | null
          raw_quantity: number
          raw_unit: string | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          ai_line_snapshot?: Json
          conversion_explanation?: string | null
          created_at?: string
          draft_id: string
          id?: string
          line_index: number
          normalized_quantity?: number | null
          normalized_unit?: string | null
          operator_line_snapshot?: Json
          operator_quantity?: number | null
          original_text_span?: string | null
          product_confidence?: number | null
          product_id?: string | null
          product_name?: string
          quantity_confidence?: number | null
          raw_quantity?: number
          raw_unit?: string | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          ai_line_snapshot?: Json
          conversion_explanation?: string | null
          created_at?: string
          draft_id?: string
          id?: string
          line_index?: number
          normalized_quantity?: number | null
          normalized_unit?: string | null
          operator_line_snapshot?: Json
          operator_quantity?: number | null
          original_text_span?: string | null
          product_confidence?: number | null
          product_id?: string | null
          product_name?: string
          quantity_confidence?: number | null
          raw_quantity?: number
          raw_unit?: string | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_draft_lines_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "sales_order_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_drafts: {
        Row: {
          ai_draft_snapshot: Json
          approver_id: string | null
          approver_name: string | null
          client_owner_id: string | null
          client_owner_name: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          created_by: string | null
          extraction_request_key: string
          id: string
          operator_final_snapshot: Json
          order_creator_id: string | null
          order_creator_name: string | null
          order_handler_id: string | null
          order_handler_name: string | null
          original_whatsapp_text: string
          packet_id: string
          promoted_order_id: string | null
          readiness_dimensions: Json
          readiness_overall_score: number
          rejection_reason: string | null
          review_notes: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_draft_snapshot?: Json
          approver_id?: string | null
          approver_name?: string | null
          client_owner_id?: string | null
          client_owner_name?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          extraction_request_key: string
          id?: string
          operator_final_snapshot?: Json
          order_creator_id?: string | null
          order_creator_name?: string | null
          order_handler_id?: string | null
          order_handler_name?: string | null
          original_whatsapp_text?: string
          packet_id: string
          promoted_order_id?: string | null
          readiness_dimensions?: Json
          readiness_overall_score?: number
          rejection_reason?: string | null
          review_notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_draft_snapshot?: Json
          approver_id?: string | null
          approver_name?: string | null
          client_owner_id?: string | null
          client_owner_name?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          extraction_request_key?: string
          id?: string
          operator_final_snapshot?: Json
          order_creator_id?: string | null
          order_creator_name?: string | null
          order_handler_id?: string | null
          order_handler_name?: string | null
          original_whatsapp_text?: string
          packet_id?: string
          promoted_order_id?: string | null
          readiness_dimensions?: Json
          readiness_overall_score?: number
          rejection_reason?: string | null
          review_notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "sales_order_drafts_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_drafts_promoted_order_id_fkey"
            columns: ["promoted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_performance_events: {
        Row: {
          attribution_reason: string
          company_id: string | null
          created_at: string
          event_type: string
          id: string
          order_id: string | null
          outcome: string
          sales_exec_id: string
          score_delta: number
          task_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          attribution_reason: string
          company_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          order_id?: string | null
          outcome?: string
          sales_exec_id: string
          score_delta?: number
          task_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          attribution_reason?: string
          company_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string | null
          outcome?: string
          sales_exec_id?: string
          score_delta?: number
          task_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_performance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_performance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "sales_performance_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_performance_events_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_performance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_performance_events_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_relationships: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          company_id: string
          created_at: string
          ends_at: string | null
          id: string
          relationship_role: string
          sales_exec_id: string
          starts_at: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          company_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          relationship_role?: string
          sales_exec_id: string
          starts_at?: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          company_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          relationship_role?: string
          sales_exec_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_relationships_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_relationships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_relationships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "sales_relationships_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_requests: {
        Row: {
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          product_id: string | null
          reason: string
          request_type: string
          requested_amount: number | null
          requested_by: string | null
          requested_price: number | null
          status: string
          supporting_notes: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          reason: string
          request_type: string
          requested_amount?: number | null
          requested_by?: string | null
          requested_price?: number | null
          status?: string
          supporting_notes?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          reason?: string
          request_type?: string
          requested_amount?: number | null
          requested_by?: string | null
          requested_price?: number | null
          status?: string
          supporting_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "sales_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shadow_clients: {
        Row: {
          created_at: string
          extracted_address: string | null
          extracted_business_name: string | null
          extracted_contact_email: string | null
          extracted_gst: string | null
          id: string
          last_prompt_sent_at: string | null
          notes: string | null
          promoted_to_company_id: string | null
          sender_name: string | null
          sender_phone: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_address?: string | null
          extracted_business_name?: string | null
          extracted_contact_email?: string | null
          extracted_gst?: string | null
          id?: string
          last_prompt_sent_at?: string | null
          notes?: string | null
          promoted_to_company_id?: string | null
          sender_name?: string | null
          sender_phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_address?: string | null
          extracted_business_name?: string | null
          extracted_contact_email?: string | null
          extracted_gst?: string | null
          id?: string
          last_prompt_sent_at?: string | null
          notes?: string | null
          promoted_to_company_id?: string | null
          sender_name?: string | null
          sender_phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sku_code_rules: {
        Row: {
          code: string
          code_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          code_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          code_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      starter_packs: {
        Row: {
          created_at: string
          description: string | null
          estimated_investment: number
          id: string
          is_active: boolean
          items: Json
          name: string
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_investment?: number
          id?: string
          is_active?: boolean
          items?: Json
          name: string
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_investment?: number
          id?: string
          is_active?: boolean
          items?: Json
          name?: string
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_consumption_lineage: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          consumed_qty: number
          correlation_id: string
          created_at: string
          dispatch_lineage_id: string | null
          gate_reference: string | null
          id: string
          lineage_type: string
          location_code: string
          metadata: Json
          movement_id: string | null
          order_id: string
          product_id: string
          reason_code: string | null
          reservation_id: string | null
          scan_reference: string | null
          sku: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          consumed_qty: number
          correlation_id: string
          created_at?: string
          dispatch_lineage_id?: string | null
          gate_reference?: string | null
          id?: string
          lineage_type: string
          location_code: string
          metadata?: Json
          movement_id?: string | null
          order_id: string
          product_id: string
          reason_code?: string | null
          reservation_id?: string | null
          scan_reference?: string | null
          sku: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          consumed_qty?: number
          correlation_id?: string
          created_at?: string
          dispatch_lineage_id?: string | null
          gate_reference?: string | null
          id?: string
          lineage_type?: string
          location_code?: string
          metadata?: Json
          movement_id?: string | null
          order_id?: string
          product_id?: string
          reason_code?: string | null
          reservation_id?: string | null
          scan_reference?: string | null
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_consumption_lineage_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
        ]
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
      storage_bucket_contracts: {
        Row: {
          bucket_id: string
          classification: string
          created_at: string
          migration_status: string
          owning_application: string
          path_convention: string
          public_delivery: boolean
          retention_notes: string | null
          updated_at: string
          write_authority: string
        }
        Insert: {
          bucket_id: string
          classification: string
          created_at?: string
          migration_status?: string
          owning_application: string
          path_convention: string
          public_delivery?: boolean
          retention_notes?: string | null
          updated_at?: string
          write_authority: string
        }
        Update: {
          bucket_id?: string
          classification?: string
          created_at?: string
          migration_status?: string
          owning_application?: string
          path_convention?: string
          public_delivery?: boolean
          retention_notes?: string | null
          updated_at?: string
          write_authority?: string
        }
        Relationships: []
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
          is_panic_order: boolean | null
          notes: string | null
          order_id: string
          status: string | null
          target_store: string
        }
        Insert: {
          created_at?: string | null
          fulfilled_at?: string | null
          id?: string
          is_panic_order?: boolean | null
          notes?: string | null
          order_id: string
          status?: string | null
          target_store: string
        }
        Update: {
          created_at?: string | null
          fulfilled_at?: string | null
          id?: string
          is_panic_order?: boolean | null
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
      suggested_orders: {
        Row: {
          ai_confidence: number | null
          ai_model: string | null
          created_at: string
          extracted_business_name: string | null
          extracted_delivery_date: string | null
          extracted_items: Json
          extracted_notes: string | null
          id: string
          matched_company_id: string | null
          promoted_order_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_name: string | null
          sender_phone: string
          shadow_client_id: string | null
          source_image_url: string | null
          source_message_ids: string[] | null
          source_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_model?: string | null
          created_at?: string
          extracted_business_name?: string | null
          extracted_delivery_date?: string | null
          extracted_items?: Json
          extracted_notes?: string | null
          id?: string
          matched_company_id?: string | null
          promoted_order_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name?: string | null
          sender_phone: string
          shadow_client_id?: string | null
          source_image_url?: string | null
          source_message_ids?: string[] | null
          source_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_model?: string | null
          created_at?: string
          extracted_business_name?: string | null
          extracted_delivery_date?: string | null
          extracted_items?: Json
          extracted_notes?: string | null
          id?: string
          matched_company_id?: string | null
          promoted_order_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name?: string | null
          sender_phone?: string
          shadow_client_id?: string | null
          source_image_url?: string | null
          source_message_ids?: string[] | null
          source_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_orders_matched_company_id_fkey"
            columns: ["matched_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_orders_matched_company_id_fkey"
            columns: ["matched_company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "suggested_orders_promoted_order_id_fkey"
            columns: ["promoted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_orders_shadow_client_id_fkey"
            columns: ["shadow_client_id"]
            isOneToOne: false
            referencedRelation: "shadow_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_rating_communication: number | null
          admin_rating_quality: number | null
          admin_rating_speed: number | null
          ai_rewritten_reply: string | null
          assigned_employee_id: string | null
          commission_blocked: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_rating: number | null
          description: string
          dispatch_date: string | null
          escalated_to_hod: boolean | null
          estimated_financial_loss: number | null
          id: string
          issue_type: string
          order_id: string
          product_sku: string | null
          proof_url: string | null
          qty_affected: number | null
          rejection_reason_template: string | null
          resolution_notes: string | null
          resolution_template_used: string | null
          routed_to_department: string | null
          severity: string | null
          sla_action_at: string | null
          sla_action_due: string | null
          sla_first_response_at: string | null
          sla_first_response_due: string | null
          sla_resolution_due: string | null
          sla_resolved_at: string | null
          sla_state: string | null
          status: string | null
          updated_at: string
          user_id: string | null
          window_status: string | null
        }
        Insert: {
          admin_rating_communication?: number | null
          admin_rating_quality?: number | null
          admin_rating_speed?: number | null
          ai_rewritten_reply?: string | null
          assigned_employee_id?: string | null
          commission_blocked?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_rating?: number | null
          description: string
          dispatch_date?: string | null
          escalated_to_hod?: boolean | null
          estimated_financial_loss?: number | null
          id?: string
          issue_type: string
          order_id: string
          product_sku?: string | null
          proof_url?: string | null
          qty_affected?: number | null
          rejection_reason_template?: string | null
          resolution_notes?: string | null
          resolution_template_used?: string | null
          routed_to_department?: string | null
          severity?: string | null
          sla_action_at?: string | null
          sla_action_due?: string | null
          sla_first_response_at?: string | null
          sla_first_response_due?: string | null
          sla_resolution_due?: string | null
          sla_resolved_at?: string | null
          sla_state?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          window_status?: string | null
        }
        Update: {
          admin_rating_communication?: number | null
          admin_rating_quality?: number | null
          admin_rating_speed?: number | null
          ai_rewritten_reply?: string | null
          assigned_employee_id?: string | null
          commission_blocked?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_rating?: number | null
          description?: string
          dispatch_date?: string | null
          escalated_to_hod?: boolean | null
          estimated_financial_loss?: number | null
          id?: string
          issue_type?: string
          order_id?: string
          product_sku?: string | null
          proof_url?: string | null
          qty_affected?: number | null
          rejection_reason_template?: string | null
          resolution_notes?: string | null
          resolution_template_used?: string | null
          routed_to_department?: string | null
          severity?: string | null
          sla_action_at?: string | null
          sla_action_due?: string | null
          sla_first_response_at?: string | null
          sla_first_response_due?: string | null
          sla_resolution_due?: string | null
          sla_resolved_at?: string | null
          sla_state?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          window_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          message: string
          priority: string | null
          target_role: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          priority?: string | null
          target_role?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          priority?: string | null
          target_role?: string | null
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
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
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
            foreignKeyName: "user_favorites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
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
          commission_rate_percentage: number | null
          company_id: string | null
          created_at: string | null
          deleted_at: string | null
          department: string | null
          designation: string | null
          email: string | null
          full_name: string | null
          has_seen_tutorial: boolean | null
          id: string
          invite_status: string | null
          is_active: boolean | null
          is_sales_executive: boolean
          joined_at: string | null
          mobile_number: string | null
          name: string | null
          phone: string | null
          preferred_language: string | null
          role: string
          secondary_phones: string[] | null
        }
        Insert: {
          commission_rate_percentage?: number | null
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          has_seen_tutorial?: boolean | null
          id?: string
          invite_status?: string | null
          is_active?: boolean | null
          is_sales_executive?: boolean
          joined_at?: string | null
          mobile_number?: string | null
          name?: string | null
          phone?: string | null
          preferred_language?: string | null
          role: string
          secondary_phones?: string[] | null
        }
        Update: {
          commission_rate_percentage?: number | null
          company_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          has_seen_tutorial?: boolean | null
          id?: string
          invite_status?: string | null
          is_active?: boolean | null
          is_sales_executive?: boolean
          joined_at?: string | null
          mobile_number?: string | null
          name?: string | null
          phone?: string | null
          preferred_language?: string | null
          role?: string
          secondary_phones?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
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
          {
            foreignKeyName: "wallet_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
        ]
      }
      whatsapp_automations: {
        Row: {
          contact_id: string
          created_at: string | null
          failure_reason: string | null
          id: string
          message_template: string | null
          order_id: string
          provider: string
          provider_message_id: string | null
          retry_count: number | null
          sent_at: string | null
          status: string
          trigger_type: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          message_template?: string | null
          order_id: string
          provider: string
          provider_message_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          trigger_type: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          message_template?: string | null
          order_id?: string
          provider?: string
          provider_message_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_buffer: {
        Row: {
          bundle_status: string
          created_at: string
          flushed_at: string | null
          id: string
          media_mime_type: string | null
          media_url: string | null
          message_type: string | null
          raw_payload: Json | null
          sender_name: string | null
          sender_phone: string
          text_content: string | null
          webhook_id: string | null
        }
        Insert: {
          bundle_status?: string
          created_at?: string
          flushed_at?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          raw_payload?: Json | null
          sender_name?: string | null
          sender_phone: string
          text_content?: string | null
          webhook_id?: string | null
        }
        Update: {
          bundle_status?: string
          created_at?: string
          flushed_at?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          raw_payload?: Json | null
          sender_name?: string | null
          sender_phone?: string
          text_content?: string | null
          webhook_id?: string | null
        }
        Relationships: []
      }
      whatsapp_case_channel_migrations: {
        Row: {
          case_id: string
          correlation_key: string
          created_at: string
          customer_ack_message_id: string | null
          from_phone_e164: string
          id: string
          invitation_outbound_decision_id: string | null
          migrated_at: string | null
          official_phone_e164: string
          recorded_by: string
          status: string
        }
        Insert: {
          case_id: string
          correlation_key: string
          created_at?: string
          customer_ack_message_id?: string | null
          from_phone_e164: string
          id?: string
          invitation_outbound_decision_id?: string | null
          migrated_at?: string | null
          official_phone_e164: string
          recorded_by: string
          status?: string
        }
        Update: {
          case_id?: string
          correlation_key?: string
          created_at?: string
          customer_ack_message_id?: string | null
          from_phone_e164?: string
          id?: string
          invitation_outbound_decision_id?: string | null
          migrated_at?: string | null
          official_phone_e164?: string
          recorded_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_channel_migrati_invitation_outbound_decision_fkey"
            columns: ["invitation_outbound_decision_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_outbound_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_channel_migrations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_clarification_followups: {
        Row: {
          action: string
          clarification_id: string
          correlation_key: string
          id: string
          metadata: Json
          performed_at: string
          performed_by: string | null
          recipient_authorization_id: string | null
          sequence_number: number
          source_outbound_message_id: string | null
        }
        Insert: {
          action: string
          clarification_id: string
          correlation_key: string
          id?: string
          metadata?: Json
          performed_at?: string
          performed_by?: string | null
          recipient_authorization_id?: string | null
          sequence_number: number
          source_outbound_message_id?: string | null
        }
        Update: {
          action?: string
          clarification_id?: string
          correlation_key?: string
          id?: string
          metadata?: Json
          performed_at?: string
          performed_by?: string | null
          recipient_authorization_id?: string | null
          sequence_number?: number
          source_outbound_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_clarification_fol_recipient_authorization_id_fkey"
            columns: ["recipient_authorization_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_recipient_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_clarification_followups_clarification_id_fkey"
            columns: ["clarification_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_clarifications"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_clarifications: {
        Row: {
          answer_payload: Json | null
          answer_source_message_id: string | null
          answer_text: string | null
          answered_at: string | null
          answered_by_identity_id: string | null
          asked_at: string
          asked_by: string
          case_id: string
          confirmed_by: string | null
          correlation_key: string
          created_at: string
          due_at: string
          field_name: string
          follow_up_count: number
          id: string
          interpretation_id: string | null
          next_follow_up_at: string | null
          question: string
          recipient_authorization_id: string
          requested_line_id: string | null
          source_outbound_message_id: string | null
          status: string
          unresolved_value: Json | null
        }
        Insert: {
          answer_payload?: Json | null
          answer_source_message_id?: string | null
          answer_text?: string | null
          answered_at?: string | null
          answered_by_identity_id?: string | null
          asked_at?: string
          asked_by: string
          case_id: string
          confirmed_by?: string | null
          correlation_key: string
          created_at?: string
          due_at: string
          field_name: string
          follow_up_count?: number
          id?: string
          interpretation_id?: string | null
          next_follow_up_at?: string | null
          question: string
          recipient_authorization_id: string
          requested_line_id?: string | null
          source_outbound_message_id?: string | null
          status?: string
          unresolved_value?: Json | null
        }
        Update: {
          answer_payload?: Json | null
          answer_source_message_id?: string | null
          answer_text?: string | null
          answered_at?: string | null
          answered_by_identity_id?: string | null
          asked_at?: string
          asked_by?: string
          case_id?: string
          confirmed_by?: string | null
          correlation_key?: string
          created_at?: string
          due_at?: string
          field_name?: string
          follow_up_count?: number
          id?: string
          interpretation_id?: string | null
          next_follow_up_at?: string | null
          question?: string
          recipient_authorization_id?: string
          requested_line_id?: string | null
          source_outbound_message_id?: string | null
          status?: string
          unresolved_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_clarifications_answered_by_identity_id_fkey"
            columns: ["answered_by_identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_clarifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_clarifications_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_interpretations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_clarifications_recipient_authorization_id_fkey"
            columns: ["recipient_authorization_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_recipient_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_clarifications_requested_line_id_fkey"
            columns: ["requested_line_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_requested_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_closures: {
        Row: {
          case_id: string
          closed_at: string
          closed_by: string
          closure_outbound_decision_id: string | null
          closure_type: string
          correlation_key: string
          created_at: string
          customer_notified: boolean
          id: string
          resolution_summary: string
          unresolved_items: Json
        }
        Insert: {
          case_id: string
          closed_at: string
          closed_by: string
          closure_outbound_decision_id?: string | null
          closure_type: string
          correlation_key: string
          created_at?: string
          customer_notified: boolean
          id?: string
          resolution_summary: string
          unresolved_items?: Json
        }
        Update: {
          case_id?: string
          closed_at?: string
          closed_by?: string
          closure_outbound_decision_id?: string | null
          closure_type?: string
          correlation_key?: string
          created_at?: string
          customer_notified?: boolean
          id?: string
          resolution_summary?: string
          unresolved_items?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_closures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_closures_closure_outbound_decision_id_fkey"
            columns: ["closure_outbound_decision_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_outbound_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_confirmations: {
        Row: {
          case_id: string
          confirmation_scope: Json
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          recipient_identity_id: string
          source_message_id: string | null
          status: string
          version: number
        }
        Insert: {
          case_id: string
          confirmation_scope: Json
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          recipient_identity_id: string
          source_message_id?: string | null
          status?: string
          version: number
        }
        Update: {
          case_id?: string
          confirmation_scope?: Json
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          recipient_identity_id?: string
          source_message_id?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_confirmations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_confirmations_recipient_identity_id_fkey"
            columns: ["recipient_identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_department_tasks: {
        Row: {
          assigned_user_id: string | null
          case_id: string
          completed_at: string | null
          completed_by: string | null
          correlation_key: string
          created_at: string
          created_by: string
          department: string
          due_at: string
          id: string
          instructions: string
          response_payload: Json | null
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          correlation_key: string
          created_at?: string
          created_by: string
          department: string
          due_at: string
          id?: string
          instructions: string
          response_payload?: Json | null
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          correlation_key?: string
          created_at?: string
          created_by?: string
          department?: string
          due_at?: string
          id?: string
          instructions?: string
          response_payload?: Json | null
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_department_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_escalations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          case_id: string
          correlation_key: string
          created_at: string
          department_task_id: string | null
          due_at: string
          escalated_to_team: string
          escalated_to_user_id: string | null
          escalation_level: number
          id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          case_id: string
          correlation_key: string
          created_at?: string
          department_task_id?: string | null
          due_at: string
          escalated_to_team: string
          escalated_to_user_id?: string | null
          escalation_level: number
          id?: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          case_id?: string
          correlation_key?: string
          created_at?: string
          department_task_id?: string | null
          due_at?: string
          escalated_to_team?: string
          escalated_to_user_id?: string | null
          escalation_level?: number
          id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_escalations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_escalations_department_task_id_fkey"
            columns: ["department_task_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_department_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          case_id: string
          correlation_key: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          prior_state: Json | null
          recorded_at: string
          resulting_state: Json | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          case_id: string
          correlation_key: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          prior_state?: Json | null
          recorded_at?: string
          resulting_state?: Json | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          case_id?: string
          correlation_key?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          prior_state?: Json | null
          recorded_at?: string
          resulting_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_handoffs: {
        Row: {
          accepted_at: string
          accepted_by: string
          case_id: string
          correlation_key: string
          created_at: string
          from_owner_id: string
          from_team: string
          id: string
          open_work_snapshot: Json
          reason: string
          to_owner_id: string
          to_team: string
        }
        Insert: {
          accepted_at: string
          accepted_by: string
          case_id: string
          correlation_key: string
          created_at?: string
          from_owner_id: string
          from_team: string
          id?: string
          open_work_snapshot: Json
          reason: string
          to_owner_id: string
          to_team: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string
          case_id?: string
          correlation_key?: string
          created_at?: string
          from_owner_id?: string
          from_team?: string
          id?: string
          open_work_snapshot?: Json
          reason?: string
          to_owner_id?: string
          to_team?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_handoffs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_identities: {
        Row: {
          case_id: string
          confidence: number | null
          created_at: string
          display_label: string | null
          evidence: Json
          id: string
          identity_role: string
          party_id: string | null
          party_type: string
          phone_e164: string | null
          resolution_status: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          case_id: string
          confidence?: number | null
          created_at?: string
          display_label?: string | null
          evidence?: Json
          id?: string
          identity_role: string
          party_id?: string | null
          party_type: string
          phone_e164?: string | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          case_id?: string
          confidence?: number | null
          created_at?: string
          display_label?: string | null
          evidence?: Json
          id?: string
          identity_role?: string
          party_id?: string | null
          party_type?: string
          phone_e164?: string | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_identities_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_interpretations: {
        Row: {
          confidence: number
          created_at: string
          created_by: string | null
          evidence: Json
          id: string
          inference_source: string
          instructions: string | null
          model_or_rule_version: string
          packaging: string | null
          product_id: string | null
          quantity: number | null
          requested_line_id: string
          required_date: string | null
          unit: string | null
          unresolved_fields: string[]
          version: number
        }
        Insert: {
          confidence: number
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          inference_source: string
          instructions?: string | null
          model_or_rule_version: string
          packaging?: string | null
          product_id?: string | null
          quantity?: number | null
          requested_line_id: string
          required_date?: string | null
          unit?: string | null
          unresolved_fields?: string[]
          version: number
        }
        Update: {
          confidence?: number
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          inference_source?: string
          instructions?: string | null
          model_or_rule_version?: string
          packaging?: string | null
          product_id?: string | null
          quantity?: number | null
          requested_line_id?: string
          required_date?: string | null
          unit?: string | null
          unresolved_fields?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_interpretations_requested_line_id_fkey"
            columns: ["requested_line_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_requested_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_manual_assignments: {
        Row: {
          accepted_at: string | null
          assigned_sales_user_id: string
          case_id: string
          contacted_at: string | null
          correlation_key: string
          created_at: string
          created_by: string
          customer_segment: string
          due_at: string
          escalation_id: string | null
          id: string
          reason: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_sales_user_id: string
          case_id: string
          contacted_at?: string | null
          correlation_key: string
          created_at?: string
          created_by: string
          customer_segment: string
          due_at: string
          escalation_id?: string | null
          id?: string
          reason: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_sales_user_id?: string
          case_id?: string
          contacted_at?: string | null
          correlation_key?: string
          created_at?: string
          created_by?: string
          customer_segment?: string
          due_at?: string
          escalation_id?: string | null
          id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_manual_assignments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_manual_assignments_escalation_id_fkey"
            columns: ["escalation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_escalations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_milestone_events: {
        Row: {
          business_object_id: string | null
          business_object_type: string | null
          case_id: string
          customer_relevance: string
          facts: Json
          id: string
          milestone_type: string
          occurred_at: string
          recorded_at: string
          source: string
          source_event_key: string
        }
        Insert: {
          business_object_id?: string | null
          business_object_type?: string | null
          case_id: string
          customer_relevance: string
          facts?: Json
          id?: string
          milestone_type: string
          occurred_at: string
          recorded_at?: string
          source: string
          source_event_key: string
        }
        Update: {
          business_object_id?: string | null
          business_object_type?: string | null
          case_id?: string
          customer_relevance?: string
          facts?: Json
          id?: string
          milestone_type?: string
          occurred_at?: string
          recorded_at?: string
          source?: string
          source_event_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_milestone_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_outbound_attempts: {
        Row: {
          attempt_number: number
          attempted_at: string
          failure_code: string | null
          failure_detail: string | null
          id: string
          idempotency_key: string
          metadata: Json
          outbound_decision_id: string
          provider: string
          provider_message_id: string | null
          status: string
          status_at: string
        }
        Insert: {
          attempt_number: number
          attempted_at?: string
          failure_code?: string | null
          failure_detail?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          outbound_decision_id: string
          provider: string
          provider_message_id?: string | null
          status: string
          status_at?: string
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          failure_code?: string | null
          failure_detail?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          outbound_decision_id?: string
          provider?: string
          provider_message_id?: string | null
          status?: string
          status_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_outbound_attempts_outbound_decision_id_fkey"
            columns: ["outbound_decision_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_outbound_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_outbound_decisions: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          disclosure_scope: string[]
          id: string
          idempotency_key: string
          message_body: string
          message_purpose: string
          recipient_authorization_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          related_clarification_id: string | null
          related_confirmation_id: string | null
          related_milestone_event_id: string | null
          released_at: string | null
          released_by: string | null
          rule_version: string
          scheduled_for: string | null
          status: string
          template_language: string | null
          template_name: string | null
          validated_at: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by: string
          disclosure_scope?: string[]
          id?: string
          idempotency_key: string
          message_body: string
          message_purpose: string
          recipient_authorization_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_clarification_id?: string | null
          related_confirmation_id?: string | null
          related_milestone_event_id?: string | null
          released_at?: string | null
          released_by?: string | null
          rule_version: string
          scheduled_for?: string | null
          status?: string
          template_language?: string | null
          template_name?: string | null
          validated_at?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          disclosure_scope?: string[]
          id?: string
          idempotency_key?: string
          message_body?: string
          message_purpose?: string
          recipient_authorization_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_clarification_id?: string | null
          related_confirmation_id?: string | null
          related_milestone_event_id?: string | null
          released_at?: string | null
          released_by?: string | null
          rule_version?: string
          scheduled_for?: string | null
          status?: string
          template_language?: string | null
          template_name?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_outbound_decision_recipient_authorization_id_fkey"
            columns: ["recipient_authorization_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_recipient_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_outbound_decision_related_milestone_event_id_fkey"
            columns: ["related_milestone_event_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_milestone_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_outbound_decisions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_outbound_decisions_related_clarification_id_fkey"
            columns: ["related_clarification_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_clarifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_outbound_decisions_related_confirmation_id_fkey"
            columns: ["related_confirmation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_confirmations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_payment_proofs: {
        Row: {
          case_id: string
          claimed_amount: number | null
          claimed_reference: string | null
          correlation_key: string
          created_at: string
          id: string
          receipt_status: string
          received_at: string
          rejection_reason: string | null
          restricted_evidence_id: string
          verified_amount: number | null
          verified_at: string | null
          verified_by: string | null
          verified_reference: string | null
        }
        Insert: {
          case_id: string
          claimed_amount?: number | null
          claimed_reference?: string | null
          correlation_key: string
          created_at?: string
          id?: string
          receipt_status?: string
          received_at: string
          rejection_reason?: string | null
          restricted_evidence_id: string
          verified_amount?: number | null
          verified_at?: string | null
          verified_by?: string | null
          verified_reference?: string | null
        }
        Update: {
          case_id?: string
          claimed_amount?: number | null
          claimed_reference?: string | null
          correlation_key?: string
          created_at?: string
          id?: string
          receipt_status?: string
          received_at?: string
          rejection_reason?: string | null
          restricted_evidence_id?: string
          verified_amount?: number | null
          verified_at?: string | null
          verified_by?: string | null
          verified_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_payment_proofs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_payment_proofs_restricted_evidence_id_fkey"
            columns: ["restricted_evidence_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_restricted_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_proposed_changes: {
        Row: {
          authority_status: string
          case_id: string
          change_type: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          interpretation_id: string | null
          proposed_by: string | null
          proposed_value: Json
          reason: string
          requested_value: Json
        }
        Insert: {
          authority_status?: string
          case_id: string
          change_type: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          interpretation_id?: string | null
          proposed_by?: string | null
          proposed_value: Json
          reason: string
          requested_value?: Json
        }
        Update: {
          authority_status?: string
          case_id?: string
          change_type?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          interpretation_id?: string | null
          proposed_by?: string | null
          proposed_value?: Json
          reason?: string
          requested_value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_proposed_changes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_proposed_changes_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_interpretations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_recipient_authorizations: {
        Row: {
          case_id: string
          correlation_key: string
          created_at: string
          disclosure_scope: string[]
          id: string
          identity_id: string
          may_confirm_commercial_scope: boolean
          may_receive_clarification: boolean
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          verification_method: string
          verified_at: string
          verified_by: string
        }
        Insert: {
          case_id: string
          correlation_key: string
          created_at?: string
          disclosure_scope?: string[]
          id?: string
          identity_id: string
          may_confirm_commercial_scope?: boolean
          may_receive_clarification?: boolean
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          verification_method: string
          verified_at: string
          verified_by: string
        }
        Update: {
          case_id?: string
          correlation_key?: string
          created_at?: string
          disclosure_scope?: string[]
          id?: string
          identity_id?: string
          may_confirm_commercial_scope?: boolean
          may_receive_clarification?: boolean
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          verification_method?: string
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_recipient_authorizations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_recipient_authorizations_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_reply_validations: {
        Row: {
          ambiguity_status: string
          commercial_commitment_status: string
          correlation_key: string
          disclosure_status: string
          factual_consistency_status: string
          findings: Json
          id: string
          outbound_decision_id: string
          recipient_authority_status: string
          validated_at: string
          validated_by: string | null
          validation_version: number
          validator_type: string
          validator_version: string
        }
        Insert: {
          ambiguity_status: string
          commercial_commitment_status: string
          correlation_key: string
          disclosure_status: string
          factual_consistency_status: string
          findings?: Json
          id?: string
          outbound_decision_id: string
          recipient_authority_status: string
          validated_at?: string
          validated_by?: string | null
          validation_version: number
          validator_type: string
          validator_version: string
        }
        Update: {
          ambiguity_status?: string
          commercial_commitment_status?: string
          correlation_key?: string
          disclosure_status?: string
          factual_consistency_status?: string
          findings?: Json
          id?: string
          outbound_decision_id?: string
          recipient_authority_status?: string
          validated_at?: string
          validated_by?: string | null
          validation_version?: number
          validator_type?: string
          validator_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_reply_validations_outbound_decision_id_fkey"
            columns: ["outbound_decision_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_outbound_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_requested_lines: {
        Row: {
          case_id: string
          correction_of_line_id: string | null
          created_at: string
          delivery_text: string | null
          id: string
          line_number: number
          packaging_text: string | null
          product_text: string | null
          quantity_text: string | null
          source_message_ids: string[]
          superseded_at: string | null
          unit_text: string | null
          verbatim_request: string
        }
        Insert: {
          case_id: string
          correction_of_line_id?: string | null
          created_at?: string
          delivery_text?: string | null
          id?: string
          line_number: number
          packaging_text?: string | null
          product_text?: string | null
          quantity_text?: string | null
          source_message_ids?: string[]
          superseded_at?: string | null
          unit_text?: string | null
          verbatim_request: string
        }
        Update: {
          case_id?: string
          correction_of_line_id?: string | null
          created_at?: string
          delivery_text?: string | null
          id?: string
          line_number?: number
          packaging_text?: string | null
          product_text?: string | null
          quantity_text?: string | null
          source_message_ids?: string[]
          superseded_at?: string | null
          unit_text?: string | null
          verbatim_request?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_requested_lines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_case_requested_lines_correction_of_line_id_fkey"
            columns: ["correction_of_line_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_requested_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_case_restricted_evidence: {
        Row: {
          access_class: string
          case_id: string
          content_hash: string
          correlation_key: string
          created_at: string
          detected_by: string
          evidence_type: string
          id: string
          public_mask: string
          quarantine_status: string
          release_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_message_id: string | null
          storage_reference: string
        }
        Insert: {
          access_class: string
          case_id: string
          content_hash: string
          correlation_key: string
          created_at?: string
          detected_by: string
          evidence_type: string
          id?: string
          public_mask: string
          quarantine_status?: string
          release_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_message_id?: string | null
          storage_reference: string
        }
        Update: {
          access_class?: string
          case_id?: string
          content_hash?: string
          correlation_key?: string
          created_at?: string
          detected_by?: string
          evidence_type?: string
          id?: string
          public_mask?: string
          quarantine_status?: string
          release_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_message_id?: string | null
          storage_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_case_restricted_evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_communication_cases: {
        Row: {
          accountability_status: string
          accountable_owner_id: string | null
          accountable_team: string | null
          assigned_at: string | null
          assigned_by: string | null
          case_type: string
          closed_at: string | null
          company_id: string | null
          created_at: string
          id: string
          last_escalated_at: string | null
          next_action: string | null
          next_action_due_at: string | null
          packet_id: string
          rule_version: string
          sales_order_draft_id: string | null
          source_channel: string
          status: string
          updated_at: string
        }
        Insert: {
          accountability_status?: string
          accountable_owner_id?: string | null
          accountable_team?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          case_type?: string
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          last_escalated_at?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          packet_id: string
          rule_version: string
          sales_order_draft_id?: string | null
          source_channel?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accountability_status?: string
          accountable_owner_id?: string | null
          accountable_team?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          case_type?: string
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          last_escalated_at?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          packet_id?: string
          rule_version?: string
          sales_order_draft_id?: string | null
          source_channel?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_communication_cases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_communication_cases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_gst_match_existing"
            referencedColumns: ["existing_company_id"]
          },
          {
            foreignKeyName: "whatsapp_communication_cases_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_message_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_communication_cases_sales_order_draft_id_fkey"
            columns: ["sales_order_draft_id"]
            isOneToOne: false
            referencedRelation: "sales_order_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_communication_preferences: {
        Row: {
          communication_class: string
          consent_status: string
          correlation_key: string
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          identity_id: string
          max_messages_per_day: number | null
          preferred_language: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reason: string
          recorded_by: string | null
          source_message_id: string | null
          timezone_name: string
        }
        Insert: {
          communication_class: string
          consent_status: string
          correlation_key: string
          created_at?: string
          effective_from: string
          effective_until?: string | null
          id?: string
          identity_id: string
          max_messages_per_day?: number | null
          preferred_language?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reason: string
          recorded_by?: string | null
          source_message_id?: string | null
          timezone_name?: string
        }
        Update: {
          communication_class?: string
          consent_status?: string
          correlation_key?: string
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          identity_id?: string
          max_messages_per_day?: number | null
          preferred_language?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reason?: string
          recorded_by?: string | null
          source_message_id?: string | null
          timezone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_communication_preferences_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_case_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          api_key: string
          created_at: string | null
          default_country_code: string | null
          id: string
          instance_id: string
          is_active: boolean | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_key: string
          created_at?: string | null
          default_country_code?: string | null
          id?: string
          instance_id: string
          is_active?: boolean | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string | null
          default_country_code?: string | null
          id?: string
          instance_id?: string
          is_active?: boolean | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          company_name: string | null
          created_at: string | null
          customer_name: string | null
          first_message_at: string | null
          id: string
          last_message_at: string | null
          phone_number: string
          updated_at: string | null
          wa_contact_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          customer_name?: string | null
          first_message_at?: string | null
          id?: string
          last_message_at?: string | null
          phone_number: string
          updated_at?: string | null
          wa_contact_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          customer_name?: string | null
          first_message_at?: string | null
          id?: string
          last_message_at?: string | null
          phone_number?: string
          updated_at?: string | null
          wa_contact_id?: string | null
        }
        Relationships: []
      }
      whatsapp_inbound_messages: {
        Row: {
          created_at: string
          id: string
          message_body: string
          message_type: string
          provider_message_id: string | null
          raw_payload: Json | null
          received_at: string
          resolver_result_json: Json | null
          resolver_status: string
          sender_name: string | null
          sender_phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_body: string
          message_type?: string
          provider_message_id?: string | null
          raw_payload?: Json | null
          received_at?: string
          resolver_result_json?: Json | null
          resolver_status?: string
          sender_name?: string | null
          sender_phone: string
        }
        Update: {
          created_at?: string
          id?: string
          message_body?: string
          message_type?: string
          provider_message_id?: string | null
          raw_payload?: Json | null
          received_at?: string
          resolver_result_json?: Json | null
          resolver_status?: string
          sender_name?: string | null
          sender_phone?: string
        }
        Relationships: []
      }
      whatsapp_learning_candidates: {
        Row: {
          candidate_type: string
          case_id: string
          correlation_key: string
          created_at: string
          evidence: Json
          id: string
          inference_ruleset_version: string
          observed_value: string
          promoted_object_id: string | null
          promoted_object_type: string | null
          proposed_mapping: Json
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_message_id: string | null
          status: string
        }
        Insert: {
          candidate_type: string
          case_id: string
          correlation_key: string
          created_at?: string
          evidence: Json
          id?: string
          inference_ruleset_version: string
          observed_value: string
          promoted_object_id?: string | null
          promoted_object_type?: string | null
          proposed_mapping: Json
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_message_id?: string | null
          status?: string
        }
        Update: {
          candidate_type?: string
          case_id?: string
          correlation_key?: string
          created_at?: string
          evidence?: Json
          id?: string
          inference_ruleset_version?: string
          observed_value?: string
          promoted_object_id?: string | null
          promoted_object_type?: string | null
          proposed_mapping?: Json
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_learning_candidates_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_communication_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_legacy_capability_retirements: {
        Row: {
          canonical_destination: string
          capability_key: string
          commercial_write_authority: boolean
          disposition: string
          evidence: Json
          id: string
          legacy_surface: string
          revision_number: number
          supersedes_retirement_id: string | null
          verified_at: string
          verified_by: string
        }
        Insert: {
          canonical_destination: string
          capability_key: string
          commercial_write_authority: boolean
          disposition: string
          evidence: Json
          id?: string
          legacy_surface: string
          revision_number?: number
          supersedes_retirement_id?: string | null
          verified_at?: string
          verified_by: string
        }
        Update: {
          canonical_destination?: string
          capability_key?: string
          commercial_write_authority?: boolean
          disposition?: string
          evidence?: Json
          id?: string
          legacy_surface?: string
          revision_number?: number
          supersedes_retirement_id?: string | null
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_legacy_capability_retire_supersedes_retirement_id_fkey"
            columns: ["supersedes_retirement_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_legacy_capability_retirements"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_packets: {
        Row: {
          closed_at: string | null
          contact_id: string
          created_at: string | null
          first_message_at: string
          fragment_count: number
          id: string
          intent_classified: boolean | null
          last_message_at: string
          manual_merge_at: string | null
          manual_merge_by: string | null
          manual_merge_parent_id: string | null
          manual_merge_reason: string | null
          manual_split: boolean | null
          manual_split_at: string | null
          manual_split_by: string | null
          manual_split_reason: string | null
          routed_at: string | null
          sender_identified: boolean | null
          status: string
          stitched_content: Json
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          contact_id: string
          created_at?: string | null
          first_message_at: string
          fragment_count?: number
          id?: string
          intent_classified?: boolean | null
          last_message_at: string
          manual_merge_at?: string | null
          manual_merge_by?: string | null
          manual_merge_parent_id?: string | null
          manual_merge_reason?: string | null
          manual_split?: boolean | null
          manual_split_at?: string | null
          manual_split_by?: string | null
          manual_split_reason?: string | null
          routed_at?: string | null
          sender_identified?: boolean | null
          status?: string
          stitched_content: Json
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          contact_id?: string
          created_at?: string | null
          first_message_at?: string
          fragment_count?: number
          id?: string
          intent_classified?: boolean | null
          last_message_at?: string
          manual_merge_at?: string | null
          manual_merge_by?: string | null
          manual_merge_parent_id?: string | null
          manual_merge_reason?: string | null
          manual_split?: boolean | null
          manual_split_at?: string | null
          manual_split_by?: string | null
          manual_split_reason?: string | null
          routed_at?: string | null
          sender_identified?: boolean | null
          status?: string
          stitched_content?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_packets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_packets_manual_merge_parent_id_fkey"
            columns: ["manual_merge_parent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          contact_id: string
          content: string | null
          created_at: string | null
          direction: string
          failure_reason: string | null
          id: string
          is_raw: boolean | null
          media_url: string | null
          message_timestamp: string | null
          message_type: string
          order_id: string | null
          packet_id: string | null
          packet_sequence: number | null
          packet_status: string | null
          provider: string
          provider_message_id: string | null
          retry_count: number | null
          status: string
          stitched_at: string | null
        }
        Insert: {
          contact_id: string
          content?: string | null
          created_at?: string | null
          direction: string
          failure_reason?: string | null
          id?: string
          is_raw?: boolean | null
          media_url?: string | null
          message_timestamp?: string | null
          message_type?: string
          order_id?: string | null
          packet_id?: string | null
          packet_sequence?: number | null
          packet_status?: string | null
          provider: string
          provider_message_id?: string | null
          retry_count?: number | null
          status?: string
          stitched_at?: string | null
        }
        Update: {
          contact_id?: string
          content?: string | null
          created_at?: string | null
          direction?: string
          failure_reason?: string | null
          id?: string
          is_raw?: boolean | null
          media_url?: string | null
          message_timestamp?: string | null
          message_type?: string
          order_id?: string | null
          packet_id?: string | null
          packet_sequence?: number | null
          packet_status?: string | null
          provider?: string
          provider_message_id?: string | null
          retry_count?: number | null
          status?: string
          stitched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_whatsapp_messages_packet_id"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_operator_decisions: {
        Row: {
          action: string
          confidence_band: string | null
          decided_at: string
          decided_by: string
          id: string
          product_name: string | null
          sku: string | null
          source_message_id: string
          whatsapp_sales_order_draft_id: string | null
        }
        Insert: {
          action: string
          confidence_band?: string | null
          decided_at?: string
          decided_by: string
          id?: string
          product_name?: string | null
          sku?: string | null
          source_message_id: string
          whatsapp_sales_order_draft_id?: string | null
        }
        Update: {
          action?: string
          confidence_band?: string | null
          decided_at?: string
          decided_by?: string
          id?: string
          product_name?: string | null
          sku?: string | null
          source_message_id?: string
          whatsapp_sales_order_draft_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_operator_decisions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_operator_decisions_whatsapp_sales_order_draft_id_fkey"
            columns: ["whatsapp_sales_order_draft_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sales_order_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_override_log: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string | null
          id: string
          new_team: string
          operator_id: string
          operator_name: string
          packet_id: string
          previous_team: string | null
          priority: string
          reason: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string | null
          id?: string
          new_team: string
          operator_id: string
          operator_name: string
          packet_id: string
          previous_team?: string | null
          priority: string
          reason: string
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string | null
          id?: string
          new_team?: string
          operator_id?: string
          operator_name?: string
          packet_id?: string
          previous_team?: string | null
          priority?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_override_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_override_log_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_reconciliation_exceptions: {
        Row: {
          business_object_id: string | null
          business_object_type: string
          created_at: string
          details: Json
          due_at: string
          exception_type: string
          id: string
          owner_id: string
          reconciliation_run_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          business_object_id?: string | null
          business_object_type: string
          created_at?: string
          details: Json
          due_at: string
          exception_type: string
          id?: string
          owner_id: string
          reconciliation_run_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          business_object_id?: string | null
          business_object_type?: string
          created_at?: string
          details?: Json
          due_at?: string
          exception_type?: string
          id?: string
          owner_id?: string
          reconciliation_run_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_reconciliation_exceptions_reconciliation_run_id_fkey"
            columns: ["reconciliation_run_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_reconciliation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_reconciliation_runs: {
        Row: {
          case_source_count: number
          correlation_key: string
          duplicate_count: number
          id: string
          orphan_message_count: number
          packet_fragment_count: number
          raw_message_count: number
          reconciled_at: string
          reconciled_by: string
          shift_code: string
          signed_off_at: string | null
          signed_off_by: string | null
          status: string
          unresolved_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          case_source_count: number
          correlation_key: string
          duplicate_count: number
          id?: string
          orphan_message_count: number
          packet_fragment_count: number
          raw_message_count: number
          reconciled_at?: string
          reconciled_by: string
          shift_code: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status: string
          unresolved_count: number
          window_end: string
          window_start: string
        }
        Update: {
          case_source_count?: number
          correlation_key?: string
          duplicate_count?: number
          id?: string
          orphan_message_count?: number
          packet_fragment_count?: number
          raw_message_count?: number
          reconciled_at?: string
          reconciled_by?: string
          shift_code?: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: string
          unresolved_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      whatsapp_replay_results: {
        Row: {
          actual_outcome: Json
          created_at: string
          dedup_result: string
          expected_outcome: Json
          failure_reasons: Json
          fixture_key: string
          id: string
          identity_result: string
          input_sha256: string
          intent_result: string
          passed: boolean
          quantity_result: string
          replay_run_id: string
          source_packet_id: string | null
          stitch_result: string
        }
        Insert: {
          actual_outcome: Json
          created_at?: string
          dedup_result: string
          expected_outcome: Json
          failure_reasons?: Json
          fixture_key: string
          id?: string
          identity_result: string
          input_sha256: string
          intent_result: string
          passed: boolean
          quantity_result: string
          replay_run_id: string
          source_packet_id?: string | null
          stitch_result: string
        }
        Update: {
          actual_outcome?: Json
          created_at?: string
          dedup_result?: string
          expected_outcome?: Json
          failure_reasons?: Json
          fixture_key?: string
          id?: string
          identity_result?: string
          input_sha256?: string
          intent_result?: string
          passed?: boolean
          quantity_result?: string
          replay_run_id?: string
          source_packet_id?: string | null
          stitch_result?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_replay_results_replay_run_id_fkey"
            columns: ["replay_run_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_replay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_replay_results_source_packet_id_fkey"
            columns: ["source_packet_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_replay_runs: {
        Row: {
          actual_case_count: number | null
          commercial_writes_observed: number
          completed_at: string | null
          correlation_key: string
          expected_case_count: number
          id: string
          result_summary: Json
          ruleset_version: string
          run_type: string
          source_scope: Json
          started_at: string
          started_by: string
          status: string
        }
        Insert: {
          actual_case_count?: number | null
          commercial_writes_observed?: number
          completed_at?: string | null
          correlation_key: string
          expected_case_count: number
          id?: string
          result_summary?: Json
          ruleset_version: string
          run_type: string
          source_scope: Json
          started_at?: string
          started_by: string
          status?: string
        }
        Update: {
          actual_case_count?: number | null
          commercial_writes_observed?: number
          completed_at?: string | null
          correlation_key?: string
          expected_case_count?: number
          id?: string
          result_summary?: Json
          ruleset_version?: string
          run_type?: string
          source_scope?: Json
          started_at?: string
          started_by?: string
          status?: string
        }
        Relationships: []
      }
      whatsapp_sales_order_drafts: {
        Row: {
          confidence_band: string
          created_at: string
          created_by: string
          customer_name: string | null
          id: string
          message_body: string
          operator_decision: string
          quantity: number
          resolved_product_id: string | null
          resolved_product_name: string | null
          resolved_sku: string
          sender_phone: string
          source: string
          source_message_id: string
          status: string
        }
        Insert: {
          confidence_band: string
          created_at?: string
          created_by: string
          customer_name?: string | null
          id?: string
          message_body: string
          operator_decision: string
          quantity?: number
          resolved_product_id?: string | null
          resolved_product_name?: string | null
          resolved_sku: string
          sender_phone: string
          source?: string
          source_message_id: string
          status?: string
        }
        Update: {
          confidence_band?: string
          created_at?: string
          created_by?: string
          customer_name?: string | null
          id?: string
          message_body?: string
          operator_decision?: string
          quantity?: number
          resolved_product_id?: string | null
          resolved_product_name?: string | null
          resolved_sku?: string
          sender_phone?: string
          source?: string
          source_message_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sales_order_drafts_resolved_product_id_fkey"
            columns: ["resolved_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sales_order_drafts_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_inbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_stitched_packets: {
        Row: {
          closed_at: string | null
          contact_id: string
          created_at: string | null
          first_message_at: string
          id: string
          intent_classified: boolean | null
          last_message_at: string
          manual_merge_at: string | null
          manual_merge_by: string | null
          manual_merge_parent_id: string | null
          manual_merge_reason: string | null
          manual_split: boolean | null
          manual_split_at: string | null
          manual_split_by: string | null
          manual_split_reason: string | null
          message_count: number | null
          message_ids: Json | null
          packet_sequence: number | null
          routed_at: string | null
          sender_identified: boolean | null
          status: string
          stitching_window_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          contact_id: string
          created_at?: string | null
          first_message_at: string
          id?: string
          intent_classified?: boolean | null
          last_message_at: string
          manual_merge_at?: string | null
          manual_merge_by?: string | null
          manual_merge_parent_id?: string | null
          manual_merge_reason?: string | null
          manual_split?: boolean | null
          manual_split_at?: string | null
          manual_split_by?: string | null
          manual_split_reason?: string | null
          message_count?: number | null
          message_ids?: Json | null
          packet_sequence?: number | null
          routed_at?: string | null
          sender_identified?: boolean | null
          status?: string
          stitching_window_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          contact_id?: string
          created_at?: string | null
          first_message_at?: string
          id?: string
          intent_classified?: boolean | null
          last_message_at?: string
          manual_merge_at?: string | null
          manual_merge_by?: string | null
          manual_merge_parent_id?: string | null
          manual_merge_reason?: string | null
          manual_split?: boolean | null
          manual_split_at?: string | null
          manual_split_by?: string | null
          manual_split_reason?: string | null
          message_count?: number | null
          message_ids?: Json | null
          packet_sequence?: number | null
          routed_at?: string | null
          sender_identified?: boolean | null
          status?: string
          stitching_window_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_stitched_packets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_stitched_packets_manual_merge_parent_id_fkey"
            columns: ["manual_merge_parent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_stitched_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_studio_inbox_bridge_state: {
        Row: {
          id: number
          last_erp_cursor: string
          last_erp_row_id: string | null
          last_error: string | null
          last_run_at: string | null
          last_run_errors: Json | null
          last_run_rows_duplicate: number
          last_run_rows_failed: number
          last_run_rows_ingested: number
          last_run_rows_read: number
          last_run_rows_skipped: number
          updated_at: string
        }
        Insert: {
          id?: number
          last_erp_cursor?: string
          last_erp_row_id?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_run_errors?: Json | null
          last_run_rows_duplicate?: number
          last_run_rows_failed?: number
          last_run_rows_ingested?: number
          last_run_rows_read?: number
          last_run_rows_skipped?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_erp_cursor?: string
          last_erp_row_id?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_run_errors?: Json | null
          last_run_rows_duplicate?: number
          last_run_rows_failed?: number
          last_run_rows_ingested?: number
          last_run_rows_read?: number
          last_run_rows_skipped?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_suggestions_log: {
        Row: {
          action: string
          confidence: number
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          packet_id: string
          suggestion_type: string
        }
        Insert: {
          action: string
          confidence: number
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          packet_id: string
          suggestion_type: string
        }
        Update: {
          action?: string
          confidence?: number
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          packet_id?: string
          suggestion_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_suggestions_log_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_packets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      b2b_dispatch_command_queue: {
        Row: {
          actual_departure_at: string | null
          carton_count: number | null
          committed_cutoff: string | null
          consignment_id: string | null
          consignment_number: string | null
          delivery_state: string | null
          dispatch_mode: string | null
          dispatched_qty: number | null
          fragmentation_origin: string | null
          open_exception_count: number | null
          order_id: string | null
          packed_qty: number | null
          planned_departure_at: string | null
          release_state: string | null
          selected_qty: number | null
          sequence_number: number | null
          status: string | null
          transporter_name: string | null
          vehicle_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_dispatch_consignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_dispatch_so_line_fulfilment: {
        Row: {
          approved_closed_qty: number | null
          cumulative_dispatched_qty: number | null
          order_id: string | null
          order_item_id: string | null
          original_order_qty: number | null
          product_id: string | null
          residual_qty: number | null
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
      b2b_gate_store_reconciliation: {
        Row: {
          created_at: string | null
          finalised_at: string | null
          grn_number: string | null
          grn_status: string | null
          open_discrepancies: number | null
          open_putaway_tasks: number | null
          putaway_task_count: number | null
          receipt_id: string | null
          receipt_number: string | null
          receipt_status: string | null
          received_at: string | null
          reconciliation_status: string | null
        }
        Relationships: []
      }
      b2b_order_availability: {
        Row: {
          available_for_b2b_qty: number | null
          available_qty: number | null
          b2b_saleable: boolean | null
          balance_id: string | null
          damaged_qty: number | null
          expired_qty: number | null
          item_class: string | null
          product_id: string | null
          provenance_required: boolean | null
          quarantine_qty: number | null
          reserved_qty: number | null
          sku: string | null
          store_code: string | null
          unavailable_qty: number | null
          updated_at: string | null
          version: number | null
        }
        Relationships: []
      }
      cmd_department_health: {
        Row: {
          department: string | null
          total_produced: number | null
          total_wastage: number | null
          wastage_rate: number | null
        }
        Relationships: []
      }
      realtime_contract_health: {
        Row: {
          consumer_applications: string[] | null
          enabled: boolean | null
          has_read_policy: boolean | null
          health_status: string | null
          is_published: boolean | null
          owning_application: string | null
          rls_enabled: boolean | null
          rls_required: boolean | null
          row_filter_required: boolean | null
          schema_name: string | null
          table_name: string | null
        }
        Relationships: []
      }
      v_customer_import_batch_summary: {
        Row: {
          batch_id: string | null
          batch_status: string | null
          company_candidates: number | null
          company_errors: number | null
          company_valid: number | null
          contact_candidates: number | null
          contact_valid: number | null
          duplicate_review_rows: number | null
          duplicates_pending: number | null
          loaded_at: string | null
          raw_rows: number | null
          source_filename: string | null
        }
        Insert: {
          batch_id?: string | null
          batch_status?: string | null
          company_candidates?: never
          company_errors?: never
          company_valid?: never
          contact_candidates?: never
          contact_valid?: never
          duplicate_review_rows?: never
          duplicates_pending?: never
          loaded_at?: string | null
          raw_rows?: never
          source_filename?: string | null
        }
        Update: {
          batch_id?: string | null
          batch_status?: string | null
          company_candidates?: never
          company_errors?: never
          company_valid?: never
          contact_candidates?: never
          contact_valid?: never
          duplicate_review_rows?: never
          duplicates_pending?: never
          loaded_at?: string | null
          raw_rows?: never
          source_filename?: string | null
        }
        Relationships: []
      }
      v_customer_import_company_phone_slots: {
        Row: {
          batch_id: string | null
          business_name: string | null
          phone_last10: string | null
          phone_slot: string | null
          source_customer_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_company_required_gaps: {
        Row: {
          batch_id: string | null
          business_name: string | null
          gap_codes: string[] | null
          id: string | null
          source_customer_key: string | null
          validation_status: string | null
        }
        Insert: {
          batch_id?: string | null
          business_name?: string | null
          gap_codes?: never
          id?: string | null
          source_customer_key?: string | null
          validation_status?: string | null
        }
        Update: {
          batch_id?: string | null
          business_name?: string | null
          gap_codes?: never
          id?: string | null
          source_customer_key?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_contact_phone_gaps: {
        Row: {
          batch_id: string | null
          gap_codes: string[] | null
          id: string | null
          phone_last10: string | null
          source_contact_key: string | null
          source_customer_key: string | null
          validation_status: string | null
          whatsapp_phone_raw: string | null
        }
        Insert: {
          batch_id?: string | null
          gap_codes?: never
          id?: string | null
          phone_last10?: string | null
          source_contact_key?: string | null
          source_customer_key?: string | null
          validation_status?: string | null
          whatsapp_phone_raw?: string | null
        }
        Update: {
          batch_id?: string | null
          gap_codes?: never
          id?: string | null
          phone_last10?: string | null
          source_contact_key?: string | null
          source_customer_key?: string | null
          validation_status?: string | null
          whatsapp_phone_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_duplicate_contact_phone_in_batch: {
        Row: {
          batch_id: string | null
          contact_count: number | null
          phone_last10: string | null
          source_contact_keys: string[] | null
          source_customer_keys: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_duplicate_gst_in_batch: {
        Row: {
          batch_id: string | null
          business_names: string[] | null
          candidate_count: number | null
          gst_number_normalized: string | null
          source_customer_keys: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_duplicate_name_in_batch: {
        Row: {
          batch_id: string | null
          business_name_normalized: string | null
          business_names: string[] | null
          candidate_count: number | null
          source_customer_keys: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_duplicate_phone_any_in_batch: {
        Row: {
          batch_id: string | null
          company_candidate_count: number | null
          contact_candidate_count: number | null
          occurrence_count: number | null
          phone_last10: string | null
          source_keys: string[] | null
        }
        Relationships: []
      }
      v_customer_import_duplicate_phone_in_batch: {
        Row: {
          batch_id: string | null
          business_names: string[] | null
          candidate_count: number | null
          phone_last10: string | null
          source_customer_keys: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_gst_match_existing: {
        Row: {
          batch_id: string | null
          company_candidate_id: string | null
          existing_business_name: string | null
          existing_company_id: string | null
          existing_status: string | null
          gst_number_normalized: string | null
          import_business_name: string | null
          match_outcome: string | null
          source_customer_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_company_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_orphan_contacts: {
        Row: {
          batch_id: string | null
          company_name: string | null
          id: string | null
          source_contact_key: string | null
          source_customer_key: string | null
          validation_status: string | null
          whatsapp_phone_raw: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "customer_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_batch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "customer_import_contact_candidates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_customer_import_promotion_readiness"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_customer_import_promotion_readiness: {
        Row: {
          batch_id: string | null
          batch_status: string | null
          has_company_rows_pending_review: boolean | null
          has_contact_phone_gaps: boolean | null
          has_contact_rows_pending_review: boolean | null
          has_orphan_contacts: boolean | null
          has_pending_duplicate_review: boolean | null
          has_required_field_gaps: boolean | null
          has_unresolved_duplicate_contact_phone_in_batch: boolean | null
          has_unresolved_duplicate_gst_in_batch: boolean | null
          has_unresolved_duplicate_name_in_batch: boolean | null
          has_unresolved_duplicate_phone_in_batch: boolean | null
          safe_for_staging_promotion_review: boolean | null
        }
        Insert: {
          batch_id?: string | null
          batch_status?: string | null
          has_company_rows_pending_review?: never
          has_contact_phone_gaps?: never
          has_contact_rows_pending_review?: never
          has_orphan_contacts?: never
          has_pending_duplicate_review?: never
          has_required_field_gaps?: never
          has_unresolved_duplicate_contact_phone_in_batch?: never
          has_unresolved_duplicate_gst_in_batch?: never
          has_unresolved_duplicate_name_in_batch?: never
          has_unresolved_duplicate_phone_in_batch?: never
          safe_for_staging_promotion_review?: never
        }
        Update: {
          batch_id?: string | null
          batch_status?: string | null
          has_company_rows_pending_review?: never
          has_contact_phone_gaps?: never
          has_contact_rows_pending_review?: never
          has_orphan_contacts?: never
          has_pending_duplicate_review?: never
          has_required_field_gaps?: never
          has_unresolved_duplicate_contact_phone_in_batch?: never
          has_unresolved_duplicate_gst_in_batch?: never
          has_unresolved_duplicate_name_in_batch?: never
          has_unresolved_duplicate_phone_in_batch?: never
          safe_for_staging_promotion_review?: never
        }
        Relationships: []
      }
    }
    Functions: {
      accept_b2b_inventory_receipt: {
        Args: { p_correlation_id: string; p_lines: Json; p_receipt_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          correlation_id: string
          created_at: string
          destination_store_code: string
          id: string
          notes: string | null
          production_job_id: string | null
          receipt_number: string
          receipt_source: string
          received_at: string | null
          received_by: string | null
          source_document_reference: string
          source_document_type: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "b2b_inventory_receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_b2b_inventory_receipt_phase3_posting: {
        Args: { p_correlation_id: string; p_lines: Json; p_receipt_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          correlation_id: string
          created_at: string
          destination_store_code: string
          id: string
          notes: string | null
          production_job_id: string | null
          receipt_number: string
          receipt_source: string
          received_at: string | null
          received_by: string | null
          source_document_reference: string
          source_document_type: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "b2b_inventory_receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      allocate_b2b_inventory_putaway: {
        Args: {
          p_allocations: Json
          p_correlation_id: string
          p_receipt_id: string
        }
        Returns: {
          allocated_qty: number
          assigned_to: string | null
          bin_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          disposition: string
          exception_reason: string | null
          id: string
          placed_qty: number
          receipt_line_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "b2b_inventory_putaway_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      append_operational_event_v1: {
        Args: {
          p_actor_department?: string
          p_actor_id?: string
          p_actor_role?: string
          p_causation_id?: string
          p_command_id?: string
          p_command_name?: string
          p_correlation_id: string
          p_customer_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_event_version?: number
          p_idempotency_key?: string
          p_message?: string
          p_metadata?: Json
          p_occurred_at?: string
          p_order_id?: string
          p_queue_item_id?: string
          p_reason_code?: string
          p_reason_text?: string
          p_severity?: string
          p_source_application: string
          p_title: string
          p_visibility?: string
        }
        Returns: string
      }
      approve_catalogue_alias_draft: {
        Args: { draft_id: string }
        Returns: Json
      }
      approve_catalogue_bom_draft: { Args: { draft_id: string }; Returns: Json }
      approve_catalogue_draft_internal: {
        Args: { p_draft_id: string; p_draft_table: string }
        Returns: Json
      }
      approve_catalogue_media_submission: {
        Args: { draft_id: string }
        Returns: Json
      }
      approve_catalogue_moq_draft: { Args: { draft_id: string }; Returns: Json }
      approve_catalogue_pricing_draft: {
        Args: { draft_id: string }
        Returns: Json
      }
      approve_catalogue_product_draft: {
        Args: { draft_id: string }
        Returns: Json
      }
      approve_catalogue_tag_draft: { Args: { draft_id: string }; Returns: Json }
      approve_sales_order_draft_for_so_atomic: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_draft_id: string
          p_expected_extraction_request_key: string
          p_metadata?: Json
          p_review_notes?: string
        }
        Returns: string
      }
      auth_buyer_company_id: { Args: never; Returns: string }
      buyer_product_prices_v1: {
        Args: never
        Returns: {
          applied_discount_percent: number
          currency: string
          gst_rate: number
          minimum_order_quantity: number
          minimum_order_uom: string
          order_increment: number
          order_increment_uom: string
          product_id: string
          selling_price: number
          tax_inclusive: boolean
          uom: string
          valid_from: string
          valid_until: string
        }[]
      }
      calculate_retry_delay_v1: {
        Args: {
          p_attempt_count: number
          p_jitter_seed?: string
          p_policy_key: string
        }
        Returns: number
      }
      can_access_b2b_inventory_store: {
        Args: {
          p_required_authority: string
          p_store_code: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_manage_b2b_dispatch: { Args: { _user_id: string }; Returns: boolean }
      can_manage_b2b_inventory: { Args: { _user_id: string }; Returns: boolean }
      can_receive_b2b_inventory: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_verify_b2b_dispatch_finance: {
        Args: { _user_id: string }
        Returns: boolean
      }
      catalogue_slugify_tag_part: { Args: { p_text: string }; Returns: string }
      claim_notification_batch_v1: {
        Args: {
          p_batch_size?: number
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          channel: string
          created_at: string | null
          error_log: string | null
          event_id: string | null
          event_type: string | null
          id: string
          idempotency_key: string | null
          last_attempt_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          message_body: string
          next_attempt_at: string
          priority: string | null
          provider_message_id: string | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          source_application: string
          status: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_notification_v1: {
        Args: {
          p_notification_id: string
          p_provider_message_id?: string
          p_worker_id: string
        }
        Returns: undefined
      }
      confirm_b2b_inventory_putaway: {
        Args: {
          p_bin_code: string
          p_correlation_id: string
          p_quantity: number
          p_task_id: string
        }
        Returns: {
          allocated_qty: number
          assigned_to: string | null
          bin_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          disposition: string
          exception_reason: string | null
          id: string
          placed_qty: number
          receipt_line_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "b2b_inventory_putaway_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sales_order_draft_atomic: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_audit_metadata?: Json
          p_header: Json
          p_lines: Json
        }
        Returns: string
      }
      create_whatsapp_sales_order_draft_from_operator: {
        Args: {
          _confidence_band: string
          _operator_decision: string
          _quantity?: number
          _resolved_product_id: string
          _resolved_product_name: string
          _resolved_sku: string
          _source_message_id: string
        }
        Returns: {
          confidence_band: string
          created_at: string
          created_by: string
          customer_name: string | null
          id: string
          message_body: string
          operator_decision: string
          quantity: number
          resolved_product_id: string | null
          resolved_product_name: string | null
          resolved_sku: string
          sender_phone: string
          source: string
          source_message_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "whatsapp_sales_order_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      customer_import_normalize_gst: {
        Args: { p_gst: string }
        Returns: string
      }
      customer_import_normalize_payment_terms: {
        Args: { p_terms: string }
        Returns: string
      }
      customer_import_normalize_phone_last10: {
        Args: { p_phone: string }
        Returns: string
      }
      customer_order_items_v1: {
        Args: never
        Returns: {
          item_id: string
          order_id: string
          pack_size: string
          packed_quantity: number
          product_id: string
          product_name: string
          quantity: number
          sku: string
          weight_kg: number
        }[]
      }
      customer_order_status_v1: {
        Args: never
        Returns: {
          courier_name: string
          created_at: string
          customer_stage: string
          order_id: string
          order_number: string
          order_value: number
          payment_stage: string
          promised_dispatch_date: string
          requested_dispatch_date: string
          total_weight_kg: number
          tracking_number: string
          updated_at: string
        }[]
      }
      customer_support_tickets_v1: {
        Args: never
        Returns: {
          created_at: string
          customer_rating: number
          customer_status: string
          description: string
          first_response_due: string
          issue_type: string
          order_id: string
          order_number: string
          product_sku: string
          quantity_affected: number
          resolution_due: string
          resolved_at: string
          ticket_id: string
          updated_at: string
        }[]
      }
      enqueue_notification_v1: {
        Args: {
          p_channel: string
          p_event_id?: string
          p_event_type: string
          p_idempotency_key: string
          p_max_attempts?: number
          p_message_body: string
          p_next_attempt_at?: string
          p_priority?: string
          p_recipient_email?: string
          p_recipient_phone?: string
          p_source_application: string
        }
        Returns: string
      }
      fail_notification_v1: {
        Args: {
          p_error: string
          p_notification_id: string
          p_retry_delay_seconds?: number
          p_worker_id: string
        }
        Returns: string
      }
      finalise_b2b_inventory_grn: {
        Args: {
          p_correlation_id: string
          p_grn_number: string
          p_receipt_id: string
        }
        Returns: {
          correlation_id: string
          created_at: string
          finalised_at: string | null
          finalised_by: string | null
          grn_number: string
          id: string
          receipt_id: string
          reversal_grn_id: string | null
          reversal_reason: string | null
          status: string
          stock_posted_at: string | null
          stock_posted_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "b2b_inventory_grns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_oasis_sku: {
        Args: {
          _category_code: string
          _division_code: string
          _packaging_code: string
          _subcategory_code: string
        }
        Returns: string
      }
      get_current_user_roles: { Args: never; Returns: string[] }
      get_my_role_keys: { Args: never; Returns: string[] }
      get_product_price: {
        Args: { _customer_type?: string; _product_id: string }
        Returns: number
      }
      get_product_price_usd: { Args: { _product_id: string }; Returns: number }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_active_company_membership: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      has_app_permission: {
        Args: {
          p_branch_id?: string
          p_company_id?: string
          p_permission_key: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_catalogue_permission: {
        Args: { p_permission_key: string }
        Returns: boolean
      }
      has_step_up_auth: { Args: never; Returns: boolean }
      increment_announcement_counter: {
        Args: { ann_id: string; counter_name: string }
        Returns: undefined
      }
      ingest_whatsapp_inbound_message: {
        Args: {
          _message_body: string
          _message_type?: string
          _provider_message_id: string
          _raw_payload?: Json
          _received_at?: string
          _resolver_result_json?: Json
          _resolver_status?: string
          _sender_name: string
          _sender_phone: string
        }
        Returns: {
          created_at: string
          id: string
          message_body: string
          message_type: string
          provider_message_id: string | null
          raw_payload: Json | null
          received_at: string
          resolver_result_json: Json | null
          resolver_status: string
          sender_name: string | null
          sender_phone: string
        }
        SetofOptions: {
          from: "*"
          to: "whatsapp_inbound_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_account_manager: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_catalogue_reviewer: { Args: never; Returns: boolean }
      is_internal_staff: { Args: { _user_id: string }; Returns: boolean }
      is_inventory_manage_role: { Args: { _role: string }; Returns: boolean }
      is_inventory_receive_role: { Args: { _role: string }; Returns: boolean }
      is_staff_role: { Args: { _role: string }; Returns: boolean }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
      is_whatsapp_inbox_reader: { Args: { _user_id: string }; Returns: boolean }
      log_cart_failure: {
        Args: {
          _company_id: string
          _context?: Json
          _error_code?: string
          _error_message: string
        }
        Returns: undefined
      }
      published_products_v1: {
        Args: never
        Returns: {
          allergen_warnings: string
          category: string
          created_at: string
          dietary_tags: string[]
          hero_image_url: string
          long_description: string
          pack_size: string
          primary_uom: string
          product_id: string
          product_name: string
          shelf_life: string
          shelf_life_days: number
          short_description: string
          sku: string
          storage_type: string
          subcategory: string
        }[]
      }
      record_b2b_inventory_receipt: {
        Args: { p_correlation_id: string; p_lines: Json; p_receipt_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          correlation_id: string
          created_at: string
          destination_store_code: string
          id: string
          notes: string | null
          production_job_id: string | null
          receipt_number: string
          receipt_source: string
          received_at: string | null
          received_by: string | null
          source_document_reference: string
          source_document_type: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "b2b_inventory_receipts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_dead_letter_v1: {
        Args: {
          p_attempt_count: number
          p_context?: Json
          p_error_code?: string
          p_error_message: string
          p_idempotency_key?: string
          p_policy_key: string
          p_source_application: string
          p_source_record_id: string
          p_source_table: string
          p_workload_type: string
        }
        Returns: string
      }
      record_whatsapp_operator_decision: {
        Args: {
          _action: string
          _confidence_band: string
          _product_name: string
          _sku: string
          _source_message_id: string
        }
        Returns: {
          action: string
          confidence_band: string | null
          decided_at: string
          decided_by: string
          id: string
          product_name: string | null
          sku: string | null
          source_message_id: string
          whatsapp_sales_order_draft_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "whatsapp_operator_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_catalogue_alias_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_bom_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_draft_internal: {
        Args: { p_draft_id: string; p_draft_table: string; p_reason: string }
        Returns: Json
      }
      reject_catalogue_media_submission: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_moq_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_pricing_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_product_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_tag_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_sales_order_draft_atomic: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_draft_id: string
          p_metadata?: Json
          p_rejection_reason: string
          p_review_notes?: string
        }
        Returns: string
      }
      resolve_b2b_supplier_discrepancy: {
        Args: {
          p_discrepancy_id: string
          p_resolution: string
          p_status?: string
        }
        Returns: {
          created_at: string
          discrepancy_type: string
          evidence: Json
          id: string
          owner_id: string | null
          quantity: number | null
          receipt_line_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "b2b_supplier_discrepancies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_dead_letter_v1: {
        Args: {
          p_dead_letter_id: string
          p_resolution_note?: string
          p_status: string
        }
        Returns: undefined
      }
      resolve_order_qty_to_kg: {
        Args: { _input_uom: string; _product_id: string; _qty: number }
        Returns: {
          b2b_price_total: number
          confidence: string
          converted_to: string
          input_was: string
          qty_in_kg: number
          qty_in_pcs: number
        }[]
      }
      restore_order_financials: { Args: { _order_id: string }; Returns: number }
      reverse_b2b_inventory_grn: {
        Args: {
          p_correlation_id: string
          p_grn_id: string
          p_reason: string
          p_reversal_number: string
        }
        Returns: {
          correlation_id: string
          created_at: string
          finalised_at: string | null
          finalised_by: string | null
          grn_number: string
          id: string
          receipt_id: string
          reversal_grn_id: string | null
          reversal_reason: string | null
          status: string
          stock_posted_at: string | null
          stock_posted_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "b2b_inventory_grns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_customer_import_validation: {
        Args: { p_batch_id: string }
        Returns: {
          check_code: string
          detail: string
          is_blocking: boolean
          row_count: number
          severity: string
        }[]
      }
      run_month_end_credit_lock: { Args: never; Returns: Json }
      storage_object_path_matches_buyer_owned_order: {
        Args: { object_path: string }
        Returns: boolean
      }
      submit_customer_support_ticket_v1: {
        Args: {
          p_description: string
          p_issue_type: string
          p_order_id: string
          p_product_sku?: string
          p_quantity_affected?: number
        }
        Returns: string
      }
      submit_sales_order_draft_for_review_atomic: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_audit_metadata?: Json
          p_draft_id: string
          p_expected_extraction_request_key: string
          p_lines: Json
          p_operator_final_snapshot: Json
          p_readiness_dimensions: Json
          p_readiness_overall_score: number
        }
        Returns: string
      }
      transition_sales_order_draft_status: {
        Args: {
          p_action: string
          p_actor_id: string
          p_actor_name: string
          p_approver_id?: string
          p_approver_name?: string
          p_draft_id: string
          p_expected_status: string
          p_metadata?: Json
          p_next_status: string
          p_rejection_reason?: string
          p_review_notes?: string
        }
        Returns: string
      }
      update_sales_order_draft_operator_final: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_audit_metadata?: Json
          p_draft_id: string
          p_expected_extraction_request_key: string
          p_lines: Json
          p_operator_final_snapshot: Json
          p_readiness_dimensions: Json
          p_readiness_overall_score: number
        }
        Returns: string
      }
      validate_sales_order_draft_readiness: {
        Args: { p_dimensions: Json }
        Returns: undefined
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
