import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemEstoque } from "@/data/estoque";

export type Produto = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  unidade: string;
  ativo: boolean;
};

export type Movimentacao = {
  id: string;
  tipo: "entrada" | "saida";
  area: string;
  rua: number;
  posicao: number;
  quantidade: number;
  validade: string | null;
  lote: string | null;
  observacao: string | null;
  data: string;
  produtos: { codigo: string; nome: string } | null;
};

export function useProdutos() {
  return useQuery({
    queryKey: ["produtos"],
    queryFn: async (): Promise<Produto[]> => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, codigo, nome, descricao, unidade, ativo")
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEstoque() {
  return useQuery({
    queryKey: ["paletes"],
    queryFn: async (): Promise<ItemEstoque[]> => {
      const { data, error } = await supabase
        .from("paletes")
        .select("id, area, rua, posicao, quantidade, validade, lote, produtos(codigo, nome, descricao)")
        .order("validade");
      if (error) throw error;
      type Row = {
        id: string;
        area: string;
        rua: number;
        posicao: number;
        quantidade: number;
        validade: string;
        lote: string | null;
        produtos: { codigo: string; nome: string; descricao: string | null } | null;
      };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id,
        codigo: r.produtos?.codigo ?? "—",
        produto: r.produtos?.nome ?? "—",
        descricao: r.produtos?.descricao ?? "",
        validade: r.validade,
        area: r.area,
        rua: r.rua,
        posicao: r.posicao,
        quantidade: r.quantidade,
        lote: r.lote,
      }));
    },
  });
}

export function useMovimentacoes(limite = 30) {
  return useQuery({
    queryKey: ["movimentacoes", limite],
    queryFn: async (): Promise<Movimentacao[]> => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select(
          "id, tipo, area, rua, posicao, quantidade, validade, lote, observacao, data, produtos(codigo, nome)",
        )
        .order("data", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return (data ?? []) as unknown as Movimentacao[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["paletes"] });
    qc.invalidateQueries({ queryKey: ["movimentacoes"] });
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
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRegistrarEntrada() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: {
      produto_id: string;
      area: string;
      rua: number;
      quantidade: number;
      validade: string;
      lote?: string;
      observacao?: string;
    }) => {
      const { error } = await supabase.rpc("registrar_entrada", {
        p_produto_id: p.produto_id,
        p_area: p.area,
        p_rua: p.rua,
        p_quantidade: p.quantidade,
        p_validade: p.validade,
        p_lote: p.lote || null,
        p_observacao: p.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRegistrarSaida() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: { palete_id: string; observacao?: string }) => {
      const { error } = await supabase.rpc("registrar_saida", {
        p_palete_id: p.palete_id,
        p_observacao: p.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
