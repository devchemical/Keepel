export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      maintenance_records: {
        Row: {
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          mileage: number | null
          notes: string | null
          service_date: string
          type: string
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          mileage?: number | null
          notes?: string | null
          service_date: string
          type: string
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          mileage?: number | null
          notes?: string | null
          service_date?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_vehicle_owner"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_services: {
        Row: {
          completed_record_id: string | null
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          scheduled_date: string | null
          scheduled_mileage: number | null
          status: string
          type: string
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          completed_record_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          scheduled_mileage?: number | null
          status?: string
          type: string
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          completed_record_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          scheduled_mileage?: number | null
          status?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_completion_vehicle"
            columns: ["completed_record_id", "vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id", "vehicle_id", "user_id"]
          },
          {
            foreignKeyName: "scheduled_vehicle_owner"
            columns: ["vehicle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          license_plate: string | null
          make: string
          mileage: number | null
          model: string
          updated_at: string | null
          user_id: string
          vin: string | null
          year: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          license_plate?: string | null
          make: string
          mileage?: number | null
          model: string
          updated_at?: string | null
          user_id: string
          vin?: string | null
          year: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          license_plate?: string | null
          make?: string
          mileage?: number | null
          model?: string
          updated_at?: string | null
          user_id?: string
          vin?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_maintenance_batch: {
        Args: {
          p_batch: Json
          p_completion?: Json
          p_operation_id: string
          p_today: string
          p_vehicle_id: string
        }
        Returns: Json
      }
      get_data_operation: { Args: { p_operation_id: string }; Returns: Json }
      get_maintenance_batch_operation: {
        Args: { p_operation_id: string }
        Returns: Json
      }
      mutate_data: {
        Args: {
          p_action: string
          p_id: string
          p_operation_id: string
          p_values: Json
        }
        Returns: Json
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
