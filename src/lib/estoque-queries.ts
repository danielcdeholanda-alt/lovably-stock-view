import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemEstoque, PaleteStatus } from "@/data/estoque";
import { traduzErroBanco } from "@/lib/erros-banco";

export type Produto = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: string;
  ativo: boolean;
};

export type TipoMovimentacao =
  | "entrada"
  | "saida"
  | "transferencia"
  | "ajuste"
  | "bloqueio"
  | "desbloqueio";

export type Movimentacao = {
  id: string;
  tipo: TipoMovimentacao;
  area: string;
  rua: number;
  posicao: number;
  quantidade: number;
  quantidade_anterior: number | null;
  validade: string | null;
  lote: string | null;
  observacao: string | null;
  motivo: string | null;
  palete_codigo: string | null;
  area_destino: string | null;
  rua_destino: number | null;
  posicao_destino: number | null;
  data: string;
  produtos: { codigo: string; nome: string } | null;
  usuario_id: string | null;
  usuario: string | null;
};

export type PaleteSelecionado = {
  id: string;
  codigo: string;
  endereco: string | null;
  lote?: string | null;
  quantidade: number;
  validade: string | null;
  data_entrada?: string;
};

function erro(e: unknown): never {
  throw new Error(traduzErroBanco(e));
}

export function useProdutos() {
  return useQuery({
    queryKey: ["produtos"],
    queryFn: async (): Promise<Produto[]> => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, codigo, nome, descricao, unidade, ativo")
        .eq("ativo", true)
        .order("codigo");
      if (error) erro(error);
      return data ?? [];
    },
  });
}

export function useEstoque(galpaoId?: string) {
  return useQuery({
    queryKey: ["paletes", galpaoId],
    enabled: !!galpaoId,
    queryFn: async (): Promise<ItemEstoque[]> => {
      const { data, error } = await supabase
        .from("paletes")
        .select(
          "id, codigo, produto_id, area, rua, posicao, quantidade, validade, lote, status, data_entrada, data_fabricacao, endereco_id, enderecos(codigo, nivel), produtos(codigo, nome, descricao)",
        )
        .eq("galpao_id", galpaoId!)
        .order("validade");
      if (error) erro(error);
      type Row = {
        id: string;
        codigo: string;
        produto_id: string;
        area: string;
        rua: number;
        posicao: number;
        quantidade: number;
        validade: string;
        lote: string | null;
        status: PaleteStatus;
        data_entrada: string;
        data_fabricacao: string | null;
        endereco_id: string | null;
        enderecos: { codigo: string; nivel: number | null } | null;
        produtos: { codigo: string; nome: string; descricao: string | null } | null;
      };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id,
        paleteCodigo: r.codigo,
        produtoId: r.produto_id,
        codigo: r.produtos?.codigo ?? "—",
        produto: r.produtos?.nome ?? "—",
        descricao: r.produtos?.descricao ?? "",
        validade: r.validade,
        dataEntrada: r.data_entrada,
        dataFabricacao: r.data_fabricacao,
        area: r.area,
        rua: r.rua,
        posicao: r.posicao,
        nivel: r.enderecos?.nivel ?? null,
        endereco: r.enderecos?.codigo ?? null,
        enderecoId: r.endereco_id,
        status: r.status,
        quantidade: r.quantidade,
        lote: r.lote,
      }));
    },
  });
}

export function useMovimentacoes(limite = 30, galpaoId?: string, tipo?: TipoMovimentacao) {
  return useQuery({
    queryKey: ["movimentacoes", limite, galpaoId, tipo],
    queryFn: async (): Promise<Movimentacao[]> => {
      let q = supabase
        .from("movimentacoes")
        .select(
          "id, tipo, area, rua, posicao, quantidade, quantidade_anterior, validade, lote, observacao, motivo, palete_codigo, area_destino, rua_destino, posicao_destino, data, usuario_id, produtos(codigo, nome)",
        )
        .order("data", { ascending: false })
        .limit(limite);
      if (galpaoId) q = q.eq("galpao_id", galpaoId);
      if (tipo) q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) erro(error);
      const linhas = (data ?? []) as unknown as Movimentacao[];
      const ids = [...new Set(linhas.map((m) => m.usuario_id).filter(Boolean))] as string[];
      let nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", ids);
        nomes = new Map((perfis ?? []).map((p) => [p.id, p.nome ?? p.email ?? "—"]));
      }
      return linhas.map((m) => ({
        ...m,
        usuario: m.usuario_id ? (nomes.get(m.usuario_id) ?? null) : null,
      }));
    },
  });
}

/** Endereços de uma rua com a situação atual (para escolher destino/origem). */
export function useEnderecos(galpaoId?: string, area?: string, rua?: number) {
  return useQuery({
    queryKey: ["enderecos", galpaoId, area, rua],
    enabled: !!galpaoId && !!area && !!rua,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enderecos")
        .select("id, codigo, posicao, nivel, status, ativo")
        .eq("galpao_id", galpaoId!)
        .eq("area", area!)
        .eq("rua", rua!)
        .order("posicao")
        .order("nivel");
      if (error) erro(error);
      return data ?? [];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["paletes"] });
    qc.invalidateQueries({ queryKey: ["movimentacoes"] });
    qc.invalidateQueries({ queryKey: ["enderecos"] });
    qc.invalidateQueries({ queryKey: ["produtos"] });
  };
}

export function useCriarProduto() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { codigo: string; nome: string; descricao?: string; unidade: string }) => {
      const { error } = await supabase.from("produtos").insert({
        codigo: p.codigo.trim(),
        nome: p.nome.trim(),
        descricao: p.descricao?.trim() || null,
        unidade: p.unidade,
      });
      if (error) erro(error);
    },
    onSuccess: invalidate,
  });
}

/** Entrada em lote: todos os paletes entram, ou nenhum (transação no banco). */
export function useEntradaLote() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: {
      produto_id: string;
      galpao_id?: string;
      area: string;
      rua: number;
      quantidade: number;
      paletes: number;
      validade: string;
      lote?: string;
      data_fabricacao?: string;
      data_entrada?: string;
      observacao?: string;
    }): Promise<PaleteSelecionado[]> => {
      const { data, error } = await supabase.rpc("registrar_entrada_lote", {
        p_produto_id: p.produto_id,
        p_galpao_id: p.galpao_id,
        p_area: p.area,
        p_rua: p.rua,
        p_quantidade: p.quantidade,
        p_paletes: p.paletes,
        p_validade: p.validade,
        p_lote: p.lote || undefined,
        p_data_fabricacao: p.data_fabricacao || undefined,
        p_data_entrada: p.data_entrada || undefined,
        p_observacao: p.observacao || undefined,
      });
      if (error) erro(error);
      return (data ?? []) as unknown as PaleteSelecionado[];
    },
    onSuccess: invalidate,
  });
}

/** Prévia dos paletes que sairão conforme a regra do galpão (FIFO/FEFO). */
export function usePreviaSaida(p: {
  galpaoId?: string;
  produtoId?: string;
  paletes: number;
  lote?: string;
  area?: string;
  ativo: boolean;
}) {
  return useQuery({
    queryKey: ["previa-saida", p.galpaoId, p.produtoId, p.paletes, p.lote, p.area],
    enabled: p.ativo && !!p.galpaoId && !!p.produtoId && p.paletes > 0,
    queryFn: async (): Promise<PaleteSelecionado[]> => {
      const { data, error } = await supabase.rpc("previa_saida", {
        p_galpao_id: p.galpaoId!,
        p_produto_id: p.produtoId!,
        p_paletes: p.paletes,
        p_lote: p.lote || undefined,
        p_area: p.area || undefined,
      });
      if (error) erro(error);
      return (data ?? []) as unknown as PaleteSelecionado[];
    },
  });
}

/** Saída pela regra configurada no galpão, ou por seleção manual de paletes. */
export function useSaidaPorRegra() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: {
      galpao_id: string;
      produto_id?: string;
      paletes?: number;
      lote?: string;
      area?: string;
      palete_ids?: string[];
      observacao?: string;
    }): Promise<PaleteSelecionado[]> => {
      const { data, error } = await supabase.rpc("registrar_saida_por_regra", {
        p_galpao_id: p.galpao_id,
        p_produto_id: p.produto_id,
        p_paletes: p.paletes,
        p_lote: p.lote || undefined,
        p_area: p.area || undefined,
        p_palete_ids: p.palete_ids && p.palete_ids.length > 0 ? p.palete_ids : undefined,
        p_observacao: p.observacao || undefined,
      });
      if (error) erro(error);
      return (data ?? []) as unknown as PaleteSelecionado[];
    },
    onSuccess: invalidate,
  });
}

export function useTransferencia() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { palete_id: string; endereco_destino_id: string; motivo?: string }) => {
      const { error } = await supabase.rpc("registrar_transferencia", {
        p_palete_id: p.palete_id,
        p_endereco_destino_id: p.endereco_destino_id,
        p_motivo: p.motivo || undefined,
      });
      if (error) erro(error);
    },
    onSuccess: invalidate,
  });
}

export function useAjusteInventario() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: {
      palete_id: string;
      quantidade_contada: number;
      motivo: string;
      observacao?: string;
    }) => {
      const { error } = await supabase.rpc("registrar_ajuste", {
        p_palete_id: p.palete_id,
        p_quantidade_contada: p.quantidade_contada,
        p_motivo: p.motivo,
        p_observacao: p.observacao || undefined,
      });
      if (error) erro(error);
    },
    onSuccess: invalidate,
  });
}

export function useStatusPalete() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { palete_id: string; status: PaleteStatus; motivo?: string }) => {
      const { error } = await supabase.rpc("definir_status_palete", {
        p_palete_id: p.palete_id,
        p_status: p.status,
        p_motivo: p.motivo || undefined,
      });
      if (error) erro(error);
    },
    onSuccess: invalidate,
  });
}
