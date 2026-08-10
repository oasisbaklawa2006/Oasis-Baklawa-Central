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
          company_id: string | null
          created_at: string | null
          executive_id: string | null
          follow_up_date: string | null
          id: string
          interaction_type: string | null
          notes: string | null
          outcome: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          executive_id?: string | null
          follow_up_date?: string | null
          id?: string
          interaction_type?: string | null
          notes?: string | null
          outcome?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          executive_id?: string | null
          follow_up_date?: string | null
          id?: string
          interaction_type?: string | null
          notes?: string | null
          outcome?: string | null
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
            foreignKeyName: "client_interactions_executive_id_fkey"
            columns: ["executive_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      catalogue_tag_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          review_notes: string | null
          source_app: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogue_alias_drafts: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          review_notes: string | null
          source_app: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
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
          reviewed_at: string | null
          reviewed_by: string | null
          review_notes: string | null
          source_app: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
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
          reviewed_at: string | null
          reviewed_by: string | null
          review_notes: string | null
          source_app: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          target_record_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
          source_app?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          target_record_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
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
          sales_exec_id: string | null
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
          sales_exec_id?: string | null
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
          sales_exec_id?: string | null
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
            foreignKeyName: "crm_tasks_sales_exec_id_fkey"
            columns: ["sales_exec_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
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
      debug_webhooks: {
        Row: {
          created_at: string
          direction: string
          discard_reason: string | null
          error_message: string | null
          id: string
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
          created_at: string | null
          error_log: string | null
          event_type: string | null
          id: string
          message_body: string
          priority: string | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_log?: string | null
          event_type?: string | null
          id?: string
          message_body: string
          priority?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_log?: string | null
          event_type?: string | null
          id?: string
          message_body?: string
          priority?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string | null
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
            foreignKeyName: "orders_duplicate_of_order_id_fkey"
            columns: ["duplicate_of_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          component_name: string | null
          component_product_id: string | null
          created_at: string
          id: string
          product_id: string
          quantity_per_unit: number
          source_department: string | null
        }
        Insert: {
          component_name?: string | null
          component_product_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity_per_unit?: number
          source_department?: string | null
        }
        Update: {
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
          barcode_sku: string | null
          base_price: number | null
          bom_summary: string | null
          carton_type: string | null
          category: string
          category_id: string | null
          created_at: string | null
          default_store: string | null
          department: string | null
          description: string | null
          dietary_tags: string[] | null
          dimensions: string | null
          festival_tags: string | null
          grams_per_piece: number | null
          gross_weight_grams: number | null
          gross_weight_kg: number | null
          gst_percentage: number | null
          gst_rate: number | null
          hsn_code: string
          id: string
          image_url: string | null
          ingredients: string | null
          is_active: boolean
          material: string | null
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
          product_family: string | null
          production_department: string | null
          settlement_unit: string | null
          shelf_life: string | null
          shelf_life_days: number | null
          sku: string
          storage_instructions: string | null
          storage_type: string | null
          sub_category: string | null
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
          barcode_sku?: string | null
          base_price?: number | null
          bom_summary?: string | null
          carton_type?: string | null
          category: string
          category_id?: string | null
          created_at?: string | null
          default_store?: string | null
          department?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          dimensions?: string | null
          festival_tags?: string | null
          grams_per_piece?: number | null
          gross_weight_grams?: number | null
          gross_weight_kg?: number | null
          gst_percentage?: number | null
          gst_rate?: number | null
          hsn_code: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean
          material?: string | null
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
          product_family?: string | null
          production_department?: string | null
          settlement_unit?: string | null
          shelf_life?: string | null
          shelf_life_days?: number | null
          sku: string
          storage_instructions?: string | null
          storage_type?: string | null
          sub_category?: string | null
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
          barcode_sku?: string | null
          base_price?: number | null
          bom_summary?: string | null
          carton_type?: string | null
          category?: string
          category_id?: string | null
          created_at?: string | null
          default_store?: string | null
          department?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          dimensions?: string | null
          festival_tags?: string | null
          grams_per_piece?: number | null
          gross_weight_grams?: number | null
          gross_weight_kg?: number | null
          gst_percentage?: number | null
          gst_rate?: number | null
          hsn_code?: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean
          material?: string | null
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
          product_family?: string | null
          production_department?: string | null
          settlement_unit?: string | null
          shelf_life?: string | null
          shelf_life_days?: number | null
          sku?: string
          storage_instructions?: string | null
          storage_type?: string | null
          sub_category?: string | null
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
        Relationships: []
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
          commission_rate_percentage: number | null
          company_id: string | null
          created_at: string | null
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
      cmd_department_health: {
        Row: {
          department: string | null
          total_produced: number | null
          total_wastage: number | null
          wastage_rate: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: { Args: { _user_id: string }; Returns: string }
      increment_announcement_counter: {
        Args: { ann_id: string; counter_name: string }
        Returns: undefined
      }
      is_account_manager: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_internal_staff: { Args: { _user_id: string }; Returns: boolean }
      approve_b2b_trade_application_v1: {
        Args: {
          p_application_id: string
          p_assigned_price_tier?: string | null
          p_admin_notes?: string | null
        }
        Returns: {
          application_id: string
          application_status: string
          company_id: string
        }[]
      }
      reject_b2b_trade_application_v1: {
        Args: {
          p_application_id: string
          p_rejection_reason: string
        }
        Returns: {
          application_id: string
          application_status: string
        }[]
      }
      is_staff_role: { Args: { _role: string }; Returns: boolean }
      log_cart_failure: {
        Args: {
          _company_id: string
          _context?: Json
          _error_code?: string
          _error_message: string
        }
        Returns: undefined
      }
      restore_order_financials: { Args: { _order_id: string }; Returns: number }
      run_month_end_credit_lock: { Args: never; Returns: Json }
      approve_catalogue_tag_draft: { Args: { draft_id: string }; Returns: Json }
      approve_catalogue_alias_draft: { Args: { draft_id: string }; Returns: Json }
      reject_catalogue_tag_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_alias_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      approve_catalogue_pricing_draft: { Args: { draft_id: string }; Returns: Json }
      approve_catalogue_moq_draft: { Args: { draft_id: string }; Returns: Json }
      reject_catalogue_pricing_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      reject_catalogue_moq_draft: {
        Args: { draft_id: string; reason: string }
        Returns: Json
      }
      transition_sales_order_draft_status: {
        Args: {
          p_draft_id: string
          p_expected_status: string
          p_next_status: string
          p_action: string
          p_actor_id: string
          p_actor_name: string
          p_review_notes?: string | null
          p_rejection_reason?: string | null
          p_approver_id?: string | null
          p_approver_name?: string | null
          p_metadata?: Json
        }
        Returns: string
      }
      create_sales_order_draft_atomic: {
        Args: {
          p_header: Json
          p_lines: Json
          p_actor_id: string
          p_actor_name: string
          p_audit_metadata?: Json
        }
        Returns: string
      }
      update_sales_order_draft_operator_final: {
        Args: {
          p_draft_id: string
          p_expected_extraction_request_key: string
          p_operator_final_snapshot: Json
          p_readiness_overall_score: number
          p_readiness_dimensions: Json
          p_lines: Json
          p_actor_id: string
          p_actor_name: string
          p_audit_metadata?: Json
        }
        Returns: string
      }
      submit_sales_order_draft_for_review_atomic: {
        Args: {
          p_draft_id: string
          p_expected_extraction_request_key: string
          p_operator_final_snapshot: Json
          p_readiness_overall_score: number
          p_readiness_dimensions: Json
          p_lines: Json
          p_actor_id: string
          p_actor_name: string
          p_audit_metadata?: Json
        }
        Returns: string
      }
      approve_sales_order_draft_for_so_atomic: {
        Args: {
          p_draft_id: string
          p_expected_extraction_request_key: string
          p_actor_id: string
          p_actor_name: string
          p_review_notes?: string | null
          p_metadata?: Json
        }
        Returns: {
          draft_id: string
          promoted_order_id: string
          order_number: string
          already_promoted: boolean
        }[]
      }
      reject_sales_order_draft_atomic: {
        Args: {
          p_draft_id: string
          p_actor_id: string
          p_actor_name: string
          p_rejection_reason: string
          p_review_notes?: string | null
          p_metadata?: Json
        }
        Returns: string
      }
      validate_sales_order_draft_readiness: {
        Args: {
          p_dimensions: Json
        }
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
