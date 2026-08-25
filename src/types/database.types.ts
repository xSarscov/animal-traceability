export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      animal_events: {
        Row: {
          animal_id: string
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["animal_event_type"]
          id: string
          metadata: Json
          occurred_at: string
          performed_by: string | null
          title: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["animal_event_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          performed_by?: string | null
          title: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["animal_event_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          performed_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          birth_date: string | null
          breed: string | null
          color: string | null
          created_at: string
          id: string
          microchip_id: string
          name: string
          organization_id: string
          owner_id: string
          sex: Database["public"]["Enums"]["animal_sex"]
          species: string
          status: Database["public"]["Enums"]["animal_status"]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          id?: string
          microchip_id: string
          name: string
          organization_id: string
          owner_id: string
          sex?: Database["public"]["Enums"]["animal_sex"]
          species: string
          status?: Database["public"]["Enums"]["animal_status"]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          id?: string
          microchip_id?: string
          name?: string
          organization_id?: string
          owner_id?: string
          sex?: Database["public"]["Enums"]["animal_sex"]
          species?: string
          status?: Database["public"]["Enums"]["animal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_microchip_same_organization_fkey"
            columns: ["organization_id", "microchip_id"]
            isOneToOne: false
            referencedRelation: "microchips"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "animals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_owner_same_organization_fkey"
            columns: ["organization_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      microchips: {
        Row: {
          batch_code: string | null
          code: string
          created_at: string
          frequency_khz: number
          id: string
          organization_id: string
          standard: string
          status: Database["public"]["Enums"]["microchip_status"]
          technology: string
          updated_at: string
        }
        Insert: {
          batch_code?: string | null
          code: string
          created_at?: string
          frequency_khz?: number
          id?: string
          organization_id: string
          standard?: string
          status?: Database["public"]["Enums"]["microchip_status"]
          technology?: string
          updated_at?: string
        }
        Update: {
          batch_code?: string | null
          code?: string
          created_at?: string
          frequency_khz?: number
          id?: string
          organization_id?: string
          standard?: string
          status?: Database["public"]["Enums"]["microchip_status"]
          technology?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "microchips_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Insert: {
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Update: {
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      owners: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_reports: {
        Row: {
          animal_id: string
          contact: string
          created_at: string
          id: string
          message: string | null
          reporter_name: string
          status: Database["public"]["Enums"]["recovery_report_status"]
        }
        Insert: {
          animal_id: string
          contact: string
          created_at?: string
          id?: string
          message?: string | null
          reporter_name: string
          status?: Database["public"]["Enums"]["recovery_report_status"]
        }
        Update: {
          animal_id?: string
          contact?: string
          created_at?: string
          id?: string
          message?: string | null
          reporter_name?: string
          status?: Database["public"]["Enums"]["recovery_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "recovery_reports_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_microchip_animal_cardinality_for_chip: {
        Args: { chip_id_to_check: string }
        Returns: undefined
      }
      mark_animal_found: {
        Args: { p_animal_id: string }
        Returns: Database["public"]["Enums"]["animal_status"]
      }
      mark_animal_lost: {
        Args: { p_animal_id: string }
        Returns: Database["public"]["Enums"]["animal_status"]
      }
      register_animal_with_chip: {
        Args: {
          p_animal_name: string
          p_birth_date: string
          p_breed: string
          p_chip_code: string
          p_color: string
          p_existing_owner_id: string
          p_owner_address: string
          p_owner_email: string
          p_owner_full_name: string
          p_owner_phone: string
          p_sex: Database["public"]["Enums"]["animal_sex"]
          p_species: string
        }
        Returns: string
      }
    }
    Enums: {
      animal_event_type:
        | "registration"
        | "implantation"
        | "vaccination"
        | "status_change"
        | "note"
      animal_sex: "male" | "female" | "unknown"
      animal_status: "active" | "lost" | "deceased"
      microchip_status: "available" | "implanted" | "blocked"
      organization_role: "admin" | "staff"
      recovery_report_status: "pending" | "reviewed" | "closed"
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
      animal_event_type: [
        "registration",
        "implantation",
        "vaccination",
        "status_change",
        "note",
      ],
      animal_sex: ["male", "female", "unknown"],
      animal_status: ["active", "lost", "deceased"],
      microchip_status: ["available", "implanted", "blocked"],
      organization_role: ["admin", "staff"],
      recovery_report_status: ["pending", "reviewed", "closed"],
    },
  },
} as const

