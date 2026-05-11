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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          notes: string | null
          order_description: string | null
          owner_id: string
          paid_at: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["bill_status"]
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          order_description?: string | null
          owner_id: string
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          order_description?: string | null
          owner_id?: string
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      accounts_receivable: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string
          customer: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          owner_id: string
          receipt_url: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["bill_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by: string
          customer?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          owner_id: string
          receipt_url?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string
          customer?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          owner_id?: string
          receipt_url?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          updated_at?: string
        }
        Relationships: []
      }
      broadcast_reads: {
        Row: {
          broadcast_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_reads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          link_url: string | null
          sender_id: string
          title: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          sender_id: string
          title?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          sender_id?: string
          title?: string | null
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          owner_id: string
          reference_id: string | null
          register_id: string | null
          type: Database["public"]["Enums"]["cash_movement_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          reference_id?: string | null
          register_id?: string | null
          type: Database["public"]["Enums"]["cash_movement_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          reference_id?: string | null
          register_id?: string | null
          type?: Database["public"]["Enums"]["cash_movement_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          created_at: string
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          owner_id: string
          status: Database["public"]["Enums"]["cash_register_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          owner_id: string
          status?: Database["public"]["Enums"]["cash_register_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          owner_id?: string
          status?: Database["public"]["Enums"]["cash_register_status"]
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          read_at: string | null
          sender_id: string
          sender_role: string
          ticket_id: string | null
          type: string
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          read_at?: string | null
          sender_id: string
          sender_role?: string
          ticket_id?: string | null
          type?: string
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          read_at?: string | null
          sender_id?: string
          sender_role?: string
          ticket_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          billing_cycle: string
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_cycle?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          category_id: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          owner_id: string
          price: number
          sku: string | null
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          owner_id: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          owner_id?: string
          price?: number
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
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
          auto_print: boolean | null
          avatar_url: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          pix_merchant_city: string | null
          pix_merchant_name: string | null
          printer_copies: number | null
          printer_name: string | null
          printer_width_mm: number | null
          store_name: string | null
          support_display_name: string | null
          theme_mode: string | null
          theme_palette: string | null
          updated_at: string
        }
        Insert: {
          auto_print?: boolean | null
          avatar_url?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          printer_copies?: number | null
          printer_name?: string | null
          printer_width_mm?: number | null
          store_name?: string | null
          support_display_name?: string | null
          theme_mode?: string | null
          theme_palette?: string | null
          updated_at?: string
        }
        Update: {
          auto_print?: boolean | null
          avatar_url?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_merchant_city?: string | null
          pix_merchant_name?: string | null
          printer_copies?: number | null
          printer_name?: string | null
          printer_width_mm?: number | null
          store_name?: string | null
          support_display_name?: string | null
          theme_mode?: string | null
          theme_palette?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_received: number | null
          cashier_id: string
          change_amount: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount: number
          id: string
          notes: string | null
          owner_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number: number
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          total: number
        }
        Insert: {
          amount_received?: number | null
          cashier_id: string
          change_amount?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          notes?: string | null
          owner_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total?: number
        }
        Update: {
          amount_received?: number | null
          cashier_id?: string
          change_amount?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          notes?: string | null
          owner_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_logs: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          actor_role: string | null
          created_at: string
          id: string
          metadata: Json | null
          outcome: string | null
          reason: string | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          reason?: string | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          reason?: string | null
          ticket_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_name: string | null
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          closed_by_role: string | null
          closed_outcome: string | null
          closed_reason: string | null
          created_at: string
          id: string
          last_message_at: string
          rated_at: string | null
          rating: number | null
          rating_comment: string | null
          status: string
          subject: string | null
          support_unread: number
          updated_at: string
          user_id: string
          user_unread: number
        }
        Insert: {
          assigned_name?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closed_by_role?: string | null
          closed_outcome?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          status?: string
          subject?: string | null
          support_unread?: number
          updated_at?: string
          user_id: string
          user_unread?: number
        }
        Update: {
          assigned_name?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closed_by_role?: string | null
          closed_outcome?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          status?: string
          subject?: string | null
          support_unread?: number
          updated_at?: string
          user_id?: string
          user_unread?: number
        }
        Relationships: []
      }
      table_order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          owner_id: string
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          owner_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          owner_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "table_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      table_orders: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          owner_id: string
          sale_id: string | null
          status: Database["public"]["Enums"]["table_order_status"]
          table_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          owner_id: string
          sale_id?: string | null
          status?: Database["public"]["Enums"]["table_order_status"]
          table_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          owner_id?: string
          sale_id?: string | null
          status?: Database["public"]["Enums"]["table_order_status"]
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          id: string
          name: string | null
          notes: string | null
          number: number
          owner_id: string
          seats: number
          status: Database["public"]["Enums"]["table_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          number: number
          owner_id: string
          seats?: number
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          number?: number
          owner_id?: string
          seats?: number
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          status?: string
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
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_table_item: {
        Args: { _order_id: string; _product_id: string; _quantity: number }
        Returns: string
      }
      close_table_order: {
        Args: {
          _amount_received: number
          _discount: number
          _order_id: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
      create_sale: {
        Args: {
          _amount_received: number
          _customer_id?: string
          _customer_name?: string
          _discount: number
          _items: Json
          _notes: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
      get_or_create_my_ticket: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_product_stock: {
        Args: { _product_id: string; _quantity: number; _reason?: string }
        Returns: number
      }
      open_table_order: {
        Args: {
          _customer_id?: string
          _customer_name?: string
          _table_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier" | "support"
      bill_status: "pending" | "paid" | "overdue" | "canceled"
      cash_movement_type:
        | "sale"
        | "withdrawal"
        | "supply"
        | "expense"
        | "income"
      cash_register_status: "open" | "closed"
      payment_method: "cash" | "credit" | "debit" | "pix" | "other"
      sale_status: "completed" | "cancelled" | "pending"
      stock_movement_type: "in" | "out" | "adjustment" | "sale" | "entry"
      table_order_status: "open" | "closed" | "cancelled"
      table_status: "free" | "occupied" | "reserved"
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
      app_role: ["admin", "manager", "cashier", "support"],
      bill_status: ["pending", "paid", "overdue", "canceled"],
      cash_movement_type: ["sale", "withdrawal", "supply", "expense", "income"],
      cash_register_status: ["open", "closed"],
      payment_method: ["cash", "credit", "debit", "pix", "other"],
      sale_status: ["completed", "cancelled", "pending"],
      stock_movement_type: ["in", "out", "adjustment", "sale", "entry"],
      table_order_status: ["open", "closed", "cancelled"],
      table_status: ["free", "occupied", "reserved"],
    },
  },
} as const
