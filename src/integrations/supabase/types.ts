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
      assets: {
        Row: {
          category: string
          created_at: string
          current_value: number
          id: string
          is_liquid: boolean
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          current_value?: number
          id?: string
          is_liquid?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          current_value?: number
          id?: string
          is_liquid?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_profiles: {
        Row: {
          annual_income: number | null
          created_at: string
          employment_type: string | null
          id: string
          monthly_essential_expenses: number | null
          monthly_expenses: number | null
          monthly_income: number | null
          retirement_age: number | null
          risk_profile: string | null
          salary_growth_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_income?: number | null
          created_at?: string
          employment_type?: string | null
          id?: string
          monthly_essential_expenses?: number | null
          monthly_expenses?: number | null
          monthly_income?: number | null
          retirement_age?: number | null
          risk_profile?: string | null
          salary_growth_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_income?: number | null
          created_at?: string
          employment_type?: string | null
          id?: string
          monthly_essential_expenses?: number | null
          monthly_expenses?: number | null
          monthly_income?: number | null
          retirement_age?: number | null
          risk_profile?: string | null
          salary_growth_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_scores: {
        Row: {
          band: string | null
          breakdown: Json | null
          computed_at: string
          id: string
          score_type: string
          score_value: number
          user_id: string
        }
        Insert: {
          band?: string | null
          breakdown?: Json | null
          computed_at?: string
          id?: string
          score_type: string
          score_value: number
          user_id: string
        }
        Update: {
          band?: string | null
          breakdown?: Json | null
          computed_at?: string
          id?: string
          score_type?: string
          score_value?: number
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          current_progress: number
          goal_type: string
          id: string
          monthly_contribution: number | null
          name: string
          notes: string | null
          priority: string
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_progress?: number
          goal_type: string
          id?: string
          monthly_contribution?: number | null
          name: string
          notes?: string | null
          priority?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_progress?: number
          goal_type?: string
          id?: string
          monthly_contribution?: number | null
          name?: string
          notes?: string | null
          priority?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insurance: {
        Row: {
          annual_premium: number | null
          cover_amount: number
          created_at: string
          id: string
          insurance_type: string
          nominee: string | null
          notes: string | null
          policy_end_date: string | null
          provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_premium?: number | null
          cover_amount?: number
          created_at?: string
          id?: string
          insurance_type: string
          nominee?: string | null
          notes?: string | null
          policy_end_date?: string | null
          provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_premium?: number | null
          cover_amount?: number
          created_at?: string
          id?: string
          insurance_type?: string
          nominee?: string | null
          notes?: string | null
          policy_end_date?: string | null
          provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          created_at: string
          current_value: number
          id: string
          invested_amount: number | null
          investment_type: string
          monthly_contribution: number | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          invested_amount?: number | null
          investment_type: string
          monthly_contribution?: number | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          invested_amount?: number | null
          investment_type?: string
          monthly_contribution?: number | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      liabilities: {
        Row: {
          category: string
          created_at: string
          id: string
          interest_rate: number | null
          monthly_emi: number
          name: string
          outstanding_amount: number
          tenure_months: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          interest_rate?: number | null
          monthly_emi?: number
          name: string
          outstanding_amount?: number
          tenure_months?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          interest_rate?: number | null
          monthly_emi?: number
          name?: string
          outstanding_amount?: number
          tenure_months?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          date_of_birth: string | null
          dependents: number | null
          full_name: string | null
          gender: string | null
          id: string
          marital_status: string | null
          occupation: string | null
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          dependents?: number | null
          full_name?: string | null
          gender?: string | null
          id: string
          marital_status?: string | null
          occupation?: string | null
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          dependents?: number | null
          full_name?: string | null
          gender?: string | null
          id?: string
          marital_status?: string | null
          occupation?: string | null
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          assumptions: Json | null
          category: string
          created_at: string
          display_order: number
          explanation: string | null
          id: string
          logic: string | null
          metadata: Json | null
          next_action: string | null
          priority: string
          severity: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json | null
          category: string
          created_at?: string
          display_order?: number
          explanation?: string | null
          id?: string
          logic?: string | null
          metadata?: Json | null
          next_action?: string | null
          priority?: string
          severity?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json | null
          category?: string
          created_at?: string
          display_order?: number
          explanation?: string | null
          id?: string
          logic?: string | null
          metadata?: Json | null
          next_action?: string | null
          priority?: string
          severity?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simulations: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          name: string | null
          outputs: Json | null
          simulation_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs: Json
          name?: string | null
          outputs?: Json | null
          simulation_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          name?: string | null
          outputs?: Json | null
          simulation_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          assumptions: Json | null
          created_at: string
          currency: string
          monthly_review_enabled: boolean
          notifications_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json | null
          created_at?: string
          currency?: string
          monthly_review_enabled?: boolean
          notifications_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json | null
          created_at?: string
          currency?: string
          monthly_review_enabled?: boolean
          notifications_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
