import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  areasDeRuas,
  buildMapaArea,
  capacidadeArea,
  capacidadeRua,
  capacidadeTotal,
  ruasDaArea,
  resumoAreas,
  type ItemEstoque,
  type RuaEstrutura,
} from "@/data/estoque";

export type Galpao = {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  padrao: boolean;
  politica_saida: "FIFO" | "FEFO" | "MANUAL";
  tipo_armazenagem: string | null;
};

export type Area = { id: string; galpao_id: string; nome: string; ordem: number };

export function useGalpoes() {
  return useQuery({
    queryKey: ["galpoes"],
    queryFn: async (): Promise<Galpao[]> => {
      const { data, error } = await supabase
        .from("galpoes")
        .select("id, nome, codigo, ativo, padrao, politica_saida, tipo_armazenagem")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAreas(galpaoId?: string) {
  return useQuery({
    queryKey: ["areas", galpaoId],
    enabled: !!galpaoId,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, galpao_id, nome, ordem")
        .eq("galpao_id", galpaoId!)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRuas(galpaoId?: string) {
  return useQuery({
    queryKey: ["ruas", galpaoId],
    enabled: !!galpaoId,
    queryFn: async (): Promise<RuaEstrutura[]> => {
      const { data, error } = await supabase
        .from("ruas")
        .select("id, rua, capacidade, niveis, area_id, areas!inner(nome, galpao_id)")
        .eq("areas.galpao_id", galpaoId!)
        .order("rua");
      if (error) throw error;
      type Row = {
        id: string;
        rua: number;
        capacidade: number;
        niveis: number;
        area_id: string;
        areas: { nome: string } | null;
      };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id,
        areaId: r.area_id,
        area: r.areas?.nome ?? "—",
        rua: r.rua,
        capacidade: r.capacidade,
        niveis: r.niveis,
      }));
    },
  });
}

// ---------- Contexto de estrutura (galpão selecionado + helpers) ----------

type Ctx = {
  galpoes: Galpao[];
  galpaoId?: string;
  galpao?: Galpao;
  setGalpaoId: (id: string) => void;
  ruas: RuaEstrutura[];
  areas: string[];
  carregando: boolean;
};

const EstruturaCtx = createContext<Ctx | null>(null);

export function EstruturaProvider({ children }: { children: ReactNode }) {
  const { data: galpoes = [], isLoading: lg } = useGalpoes();
  const [selecionado, setSelecionado] = useState<string>();
  const galpaoId =
    selecionado ?? galpoes.find((g) => g.padrao)?.id ?? galpoes[0]?.id ?? undefined;
  const { data: ruas = [], isLoading: lr } = useRuas(galpaoId);

  const value = useMemo<Ctx>(
    () => ({
      galpoes,
      galpaoId,
      galpao: galpoes.find((g) => g.id === galpaoId),
      setGalpaoId: setSelecionado,
      ruas,
      areas: areasDeRuas(ruas),
      carregando: lg || lr,
    }),
    [galpoes, galpaoId, ruas, lg, lr],
  );

  return <EstruturaCtx.Provider value={value}>{children}</EstruturaCtx.Provider>;
}

export function useEstrutura() {
  const ctx = useContext(EstruturaCtx);
  if (!ctx) throw new Error("useEstrutura precisa estar dentro de EstruturaProvider");
  const { ruas } = ctx;
  return {
    ...ctx,
    capacidadeTotal: capacidadeTotal(ruas),
    ruasDaArea: (area: string) => ruasDaArea(ruas, area),
    capacidadeArea: (area: string) => capacidadeArea(ruas, area),
    capacidadeRua: (area: string, rua: number) => capacidadeRua(ruas, area, rua),
    buildMapaArea: (itens: ItemEstoque[], area: string) => buildMapaArea(ruas, itens, area),
    resumoAreas: (itens: ItemEstoque[]) => resumoAreas(ruas, itens),
  };
}

// ---------- Mutations (admin) ----------

function useInvalidarEstrutura() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["galpoes"] });
    qc.invalidateQueries({ queryKey: ["areas"] });
    qc.invalidateQueries({ queryKey: ["ruas"] });
  };
}

export function useCriarGalpao() {
  const invalidate = useInvalidarEstrutura();
  return useMutation({
    mutationFn: async (p: { nome: string; codigo: string }) => {
      const { error } = await supabase
        .from("galpoes")
        .insert({ nome: p.nome.trim(), codigo: p.codigo.trim().toUpperCase() });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCriarArea() {
  const invalidate = useInvalidarEstrutura();
  return useMutation({
    mutationFn: async (p: { galpao_id: string; nome: string }) => {
      const { error } = await supabase
        .from("areas")
        .insert({ galpao_id: p.galpao_id, nome: p.nome.trim().toUpperCase() });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCriarRuas() {
  const invalidate = useInvalidarEstrutura();
  return useMutation({
    mutationFn: async (p: {
      area_id: string;
      quantidade: number;
      capacidade: number;
      niveis: number;
    }) => {
      const { error } = await supabase.rpc("criar_ruas_em_bloco", {
        p_area_id: p.area_id,
        p_quantidade: p.quantidade,
        p_capacidade: p.capacidade,
        p_niveis: p.niveis,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAtualizarRua() {
  const invalidate = useInvalidarEstrutura();
  return useMutation({
    mutationFn: async (p: { id: string; capacidade: number; niveis: number }) => {
      const { error } = await supabase
        .from("ruas")
        .update({ capacidade: p.capacidade, niveis: p.niveis })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useExcluirRua() {
  const invalidate = useInvalidarEstrutura();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ruas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
