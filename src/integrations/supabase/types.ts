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
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      fee_structures: {
        Row: {
          amount: number
          class_grade: string
          created_at: string
          fee_type: string
          id: string
        }
        Insert: {
          amount?: number
          class_grade: string
          created_at?: string
          fee_type: string
          id?: string
        }
        Update: {
          amount?: number
          class_grade?: string
          created_at?: string
          fee_type?: string
          id?: string
        }
        Relationships: []
      }
      manager_permissions: {
        Row: {
          can_access_students: boolean
          can_access_teachers: boolean
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          can_access_students?: boolean
          can_access_teachers?: boolean
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          can_access_students?: boolean
          can_access_teachers?: boolean
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paid: number
          collected_by: string | null
          created_at: string
          date: string
          fee_month: string
          fee_type: string
          id: string
          notes: string
          payment_mode: string
          proof_image_url: string
          receipt_number: string
          receipt_printed: boolean
          student_id: string
        }
        Insert: {
          amount_paid?: number
          collected_by?: string | null
          created_at?: string
          date?: string
          fee_month?: string
          fee_type: string
          id?: string
          notes?: string
          payment_mode?: string
          proof_image_url?: string
          receipt_number?: string
          receipt_printed?: boolean
          student_id: string
        }
        Update: {
          amount_paid?: number
          collected_by?: string | null
          created_at?: string
          date?: string
          fee_month?: string
          fee_type?: string
          id?: string
          notes?: string
          payment_mode?: string
          proof_image_url?: string
          receipt_number?: string
          receipt_printed?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_grade: string
          contact: string
          created_at: string
          enrollment_date: string
          guardian_name: string
          id: string
          name: string
          status: string
          student_code: string
        }
        Insert: {
          class_grade: string
          contact?: string
          created_at?: string
          enrollment_date?: string
          guardian_name?: string
          id?: string
          name: string
          status?: string
          student_code?: string
        }
        Update: {
          class_grade?: string
          contact?: string
          created_at?: string
          enrollment_date?: string
          guardian_name?: string
          id?: string
          name?: string
          status?: string
          student_code?: string
        }
        Relationships: []
      }
      teacher_advances: {
        Row: {
          amount: number
          created_at: string
          date_given: string
          id: string
          month: string
          notes: string
          payment_mode: string
          proof_image_url: string
          teacher_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date_given?: string
          id?: string
          month: string
          notes?: string
          payment_mode?: string
          proof_image_url?: string
          teacher_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date_given?: string
          id?: string
          month?: string
          notes?: string
          payment_mode?: string
          proof_image_url?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_advances_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string
          teacher_id: string
          time_in: string | null
          time_out: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string
          teacher_id: string
          time_in?: string | null
          time_out?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string
          teacher_id?: string
          time_in?: string | null
          time_out?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_bonuses: {
        Row: {
          amount: number
          created_at: string
          date_given: string
          id: string
          month: string
          notes: string
          payment_mode: string
          proof_image_url: string
          teacher_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date_given?: string
          id?: string
          month: string
          notes?: string
          payment_mode?: string
          proof_image_url?: string
          teacher_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date_given?: string
          id?: string
          month?: string
          notes?: string
          payment_mode?: string
          proof_image_url?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_bonuses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_loans: {
        Row: {
          amount: number
          created_at: string
          date_issued: string
          id: string
          notes: string
          remaining: number
          repayment_amount: number | null
          repayment_month: string | null
          repayment_percentage: number | null
          repayment_type: string
          status: string
          teacher_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date_issued?: string
          id?: string
          notes?: string
          remaining?: number
          repayment_amount?: number | null
          repayment_month?: string | null
          repayment_percentage?: number | null
          repayment_type?: string
          status?: string
          teacher_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date_issued?: string
          id?: string
          notes?: string
          remaining?: number
          repayment_amount?: number | null
          repayment_month?: string | null
          repayment_percentage?: number | null
          repayment_type?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_loans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_salaries: {
        Row: {
          base_salary: number
          created_at: string
          custom_amount: number
          date_paid: string
          id: string
          loan_deduction: number
          month: string
          net_paid: number
          notes: string
          other_deduction: number
          payment_mode: string
          proof_image_url: string
          receipt_url: string
          teacher_id: string
        }
        Insert: {
          base_salary?: number
          created_at?: string
          custom_amount?: number
          date_paid?: string
          id?: string
          loan_deduction?: number
          month: string
          net_paid?: number
          notes?: string
          other_deduction?: number
          payment_mode?: string
          proof_image_url?: string
          receipt_url?: string
          teacher_id: string
        }
        Update: {
          base_salary?: number
          created_at?: string
          custom_amount?: number
          date_paid?: string
          id?: string
          loan_deduction?: number
          month?: string
          net_paid?: number
          notes?: string
          other_deduction?: number
          payment_mode?: string
          proof_image_url?: string
          receipt_url?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_salaries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          cnic: string
          contact: string
          created_at: string
          id: string
          joining_date: string
          monthly_salary: number
          name: string
          status: string
        }
        Insert: {
          cnic?: string
          contact?: string
          created_at?: string
          id?: string
          joining_date?: string
          monthly_salary?: number
          name: string
          status?: string
        }
        Update: {
          cnic?: string
          contact?: string
          created_at?: string
          id?: string
          joining_date?: string
          monthly_salary?: number
          name?: string
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "manager"
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
      app_role: ["admin", "user", "manager"],
    },
  },
} as const
