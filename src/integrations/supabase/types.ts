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
      areas: {
        Row: {
          altura_max: number
          created_at: string
          galpao_id: string
          id: string
          nome: string
          ordem: number
          tipo_armazenagem: Database["public"]["Enums"]["tipo_armazenagem"]
        }
        Insert: {
          altura_max?: number
          created_at?: string
          galpao_id: string
          id?: string
          nome: string
          ordem?: number
          tipo_armazenagem?: Database["public"]["Enums"]["tipo_armazenagem"]
        }
        Update: {
          altura_max?: number
          created_at?: string
          galpao_id?: string
          id?: string
          nome?: string
          ordem?: number
          tipo_armazenagem?: Database["public"]["Enums"]["tipo_armazenagem"]
        }
        Relationships: [
          {
            foreignKeyName: "areas_galpao_id_fkey"
            columns: ["galpao_id"]
            isOneToOne: false
            referencedRelation: "galpoes"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          created_at: string
          id: string
          motivo: string | null
          registro_id: string | null
          tabela: string
          usuario_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          motivo?: string | null
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          motivo?: string | null
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      enderecos: {
        Row: {
          area: string
          area_id: string
          ativo: boolean
          bloco: string | null
          capacidade: number
          codigo: string
          created_at: string
          galpao_id: string
          id: string
          nivel: number | null
          posicao: number | null
          rua: number | null
          rua_id: string | null
          status: Database["public"]["Enums"]["endereco_status"]
          updated_at: string
        }
        Insert: {
          area: string
          area_id: string
          ativo?: boolean
          bloco?: string | null
          capacidade?: number
          codigo: string
          created_at?: string
          galpao_id: string
          id?: string
          nivel?: number | null
          posicao?: number | null
          rua?: number | null
          rua_id?: string | null
          status?: Database["public"]["Enums"]["endereco_status"]
          updated_at?: string
        }
        Update: {
          area?: string
          area_id?: string
          ativo?: boolean
          bloco?: string | null
          capacidade?: number
          codigo?: string
          created_at?: string
          galpao_id?: string
          id?: string
          nivel?: number | null
          posicao?: number | null
          rua?: number | null
          rua_id?: string | null
          status?: Database["public"]["Enums"]["endereco_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enderecos_galpao_id_fkey"
            columns: ["galpao_id"]
            isOneToOne: false
            referencedRelation: "galpoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enderecos_rua_id_fkey"
            columns: ["rua_id"]
            isOneToOne: false
            referencedRelation: "ruas"
            referencedColumns: ["id"]
          },
        ]
      }
      galpoes: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          padrao: boolean
          politica_saida: Database["public"]["Enums"]["politica_saida"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          padrao?: boolean
          politica_saida?: Database["public"]["Enums"]["politica_saida"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          padrao?: boolean
          politica_saida?: Database["public"]["Enums"]["politica_saida"]
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          area: string
          area_destino: string | null
          created_at: string
          data: string
          endereco_destino_id: string | null
          endereco_id: string | null
          galpao_id: string
          id: string
          lote: string | null
          motivo: string | null
          observacao: string | null
          palete_codigo: string | null
          palete_id: string | null
          posicao: number
          posicao_destino: number | null
          produto_id: string
          quantidade: number
          quantidade_anterior: number | null
          rua: number
          rua_destino: number | null
          tipo: string
          usuario_id: string | null
          validade: string | null
        }
        Insert: {
          area: string
          area_destino?: string | null
          created_at?: string
          data?: string
          endereco_destino_id?: string | null
          endereco_id?: string | null
          galpao_id: string
          id?: string
          lote?: string | null
          motivo?: string | null
          observacao?: string | null
          palete_codigo?: string | null
          palete_id?: string | null
          posicao: number
          posicao_destino?: number | null
          produto_id: string
          quantidade: number
          quantidade_anterior?: number | null
          rua: number
          rua_destino?: number | null
          tipo: string
          usuario_id?: string | null
          validade?: string | null
        }
        Update: {
          area?: string
          area_destino?: string | null
          created_at?: string
          data?: string
          endereco_destino_id?: string | null
          endereco_id?: string | null
          galpao_id?: string
          id?: string
          lote?: string | null
          motivo?: string | null
          observacao?: string | null
          palete_codigo?: string | null
          palete_id?: string | null
          posicao?: number
          posicao_destino?: number | null
          produto_id?: string
          quantidade?: number
          quantidade_anterior?: number | null
          rua?: number
          rua_destino?: number | null
          tipo?: string
          usuario_id?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_endereco_destino_id_fkey"
            columns: ["endereco_destino_id"]
            isOneToOne: false
            referencedRelation: "enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_galpao_id_fkey"
            columns: ["galpao_id"]
            isOneToOne: false
            referencedRelation: "galpoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      paletes: {
        Row: {
          area: string
          codigo: string
          created_at: string
          data_entrada: string
          data_fabricacao: string | null
          endereco_id: string | null
          galpao_id: string
          id: string
          lote: string | null
          posicao: number
          produto_id: string
          quantidade: number
          rua: number
          status: Database["public"]["Enums"]["palete_status"]
          ultima_mov_em: string | null
          ultima_mov_por: string | null
          usuario_entrada: string | null
          validade: string
        }
        Insert: {
          area: string
          codigo?: string
          created_at?: string
          data_entrada?: string
          data_fabricacao?: string | null
          endereco_id?: string | null
          galpao_id: string
          id?: string
          lote?: string | null
          posicao: number
          produto_id: string
          quantidade: number
          rua: number
          status?: Database["public"]["Enums"]["palete_status"]
          ultima_mov_em?: string | null
          ultima_mov_por?: string | null
          usuario_entrada?: string | null
          validade: string
        }
        Update: {
          area?: string
          codigo?: string
          created_at?: string
          data_entrada?: string
          data_fabricacao?: string | null
          endereco_id?: string | null
          galpao_id?: string
          id?: string
          lote?: string | null
          posicao?: number
          produto_id?: string
          quantidade?: number
          rua?: number
          status?: Database["public"]["Enums"]["palete_status"]
          ultima_mov_em?: string | null
          ultima_mov_por?: string | null
          usuario_entrada?: string | null
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "paletes_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paletes_galpao_id_fkey"
            columns: ["galpao_id"]
            isOneToOne: false
            referencedRelation: "galpoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paletes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          sabor_codigo: string | null
          tipo_codigo: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          sabor_codigo?: string | null
          tipo_codigo?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          sabor_codigo?: string | null
          tipo_codigo?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ruas: {
        Row: {
          area: string
          area_id: string
          capacidade: number
          id: string
          niveis: number
          produto_id: string | null
          rua: number
        }
        Insert: {
          area: string
          area_id: string
          capacidade: number
          id?: string
          niveis?: number
          produto_id?: string | null
          rua: number
        }
        Update: {
          area?: string
          area_id?: string
          capacidade?: number
          id?: string
          niveis?: number
          produto_id?: string | null
          rua?: number
        }
        Relationships: [
          {
            foreignKeyName: "ruas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_ruas_em_bloco: {
        Args: {
          p_area_id: string
          p_capacidade: number
          p_niveis?: number
          p_quantidade: number
        }
        Returns: number
      }
      definir_status_palete: {
        Args: {
          p_motivo?: string
          p_palete_id: string
          p_status: Database["public"]["Enums"]["palete_status"]
        }
        Returns: undefined
      }
      exigir_login: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      paletes_fora_de_ordem: {
        Args: { p_galpao_id: string }
        Returns: {
          area: string
          codigo: string
          endereco: string
          palete_id: string
          posicao: number
          rua: number
          sugerido_endereco: string
          sugerido_posicao: number
          validade: string
        }[]
      }
      previa_saida: {
        Args: {
          p_area?: string
          p_galpao_id: string
          p_lote?: string
          p_paletes: number
          p_produto_id: string
        }
        Returns: {
          codigo: string
          data_entrada: string
          endereco: string
          id: string
          lote: string
          quantidade: number
          validade: string
        }[]
      }
      registrar_ajuste: {
        Args: {
          p_motivo: string
          p_observacao?: string
          p_palete_id: string
          p_quantidade_contada: number
        }
        Returns: undefined
      }
      registrar_entrada: {
        Args: {
          p_area: string
          p_galpao_id?: string
          p_lote?: string
          p_observacao?: string
          p_produto_id: string
          p_quantidade: number
          p_rua: number
          p_validade: string
        }
        Returns: {
          area: string
          codigo: string
          created_at: string
          data_entrada: string
          data_fabricacao: string | null
          endereco_id: string | null
          galpao_id: string
          id: string
          lote: string | null
          posicao: number
          produto_id: string
          quantidade: number
          rua: number
          status: Database["public"]["Enums"]["palete_status"]
          ultima_mov_em: string | null
          ultima_mov_por: string | null
          usuario_entrada: string | null
          validade: string
        }
        SetofOptions: {
          from: "*"
          to: "paletes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_entrada_lote: {
        Args: {
          p_area: string
          p_data_entrada?: string
          p_data_fabricacao?: string
          p_galpao_id?: string
          p_lote?: string
          p_observacao?: string
          p_paletes?: number
          p_produto_id: string
          p_quantidade: number
          p_rua: number
          p_validade: string
        }
        Returns: {
          codigo: string
          data_entrada: string
          endereco: string
          id: string
          quantidade: number
          validade: string
        }[]
      }
      registrar_saida: {
        Args: { p_observacao?: string; p_palete_id: string }
        Returns: undefined
      }
      registrar_saida_por_regra: {
        Args: {
          p_area?: string
          p_galpao_id: string
          p_lote?: string
          p_observacao?: string
          p_palete_ids?: string[]
          p_paletes?: number
          p_produto_id?: string
        }
        Returns: {
          codigo: string
          endereco: string
          id: string
          quantidade: number
          validade: string
        }[]
      }
      registrar_transferencia: {
        Args: {
          p_endereco_destino_id: string
          p_motivo?: string
          p_palete_id: string
        }
        Returns: undefined
      }
      rua_do_palete: {
        Args: { p_area: string; p_galpao_id: string; p_rua: number }
        Returns: {
          area: string
          area_id: string
          capacidade: number
          id: string
          niveis: number
          produto_id: string | null
          rua: number
        }
        SetofOptions: {
          from: "*"
          to: "ruas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sugerir_ruas_fefo: {
        Args: { p_galpao_id: string; p_paletes?: number; p_produto_id: string }
        Returns: {
          area: string
          livres: number
          ocupados: number
          prioridade: number
          produto_atual: string
          rua: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "operador"
      endereco_status:
        | "livre"
        | "ocupado"
        | "reservado"
        | "bloqueado"
        | "interditado"
      palete_status:
        | "disponivel"
        | "reservado"
        | "bloqueado"
        | "quarentena"
        | "expedido"
      politica_saida: "FIFO" | "FEFO" | "MANUAL"
      tipo_armazenagem:
        | "porta_paletes"
        | "palete_chao"
        | "blocado"
        | "empilhamento"
        | "outro"
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
      app_role: ["admin", "operador"],
      endereco_status: [
        "livre",
        "ocupado",
        "reservado",
        "bloqueado",
        "interditado",
      ],
      palete_status: [
        "disponivel",
        "reservado",
        "bloqueado",
        "quarentena",
        "expedido",
      ],
      politica_saida: ["FIFO", "FEFO", "MANUAL"],
      tipo_armazenagem: [
        "porta_paletes",
        "palete_chao",
        "blocado",
        "empilhamento",
        "outro",
      ],
    },
  },
} as const
