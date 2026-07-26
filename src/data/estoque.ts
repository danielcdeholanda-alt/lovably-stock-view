// Estrutura real do armazém: áreas → ruas → posições de palete (paletes no chão).
// Os dados de estoque vêm do banco (produtos, paletes e movimentações) — nada é gerado aqui.

export type ItemEstoque = {
  id: string;
  codigo: string;
  produto: string;
  descricao: string;
  validade: string; // ISO (yyyy-mm-dd)
  area: string;
  rua: number;
  posicao: number;
  quantidade: number; // caixas no palete
  lote: string | null;
};

export type BlocoRua = { ruas: number; paletesPorRua: number };

// Layout informado: quantidade de ruas por área e paletes por rua.
export const LAYOUT: Record<string, BlocoRua[]> = {
  A: [{ ruas: 70, paletesPorRua: 63 }],
  B: [
    { ruas: 32, paletesPorRua: 19 },
    { ruas: 4, paletesPorRua: 43 },
    { ruas: 20, paletesPorRua: 19 },
  ],
  C: [{ ruas: 61, paletesPorRua: 33 }],
  D: [
    { ruas: 34, paletesPorRua: 33 },
    { ruas: 26, paletesPorRua: 49 },
  ],
  E: [{ ruas: 34, paletesPorRua: 15 }],
  F: [{ ruas: 63, paletesPorRua: 35 }],
};

export const AREAS = Object.keys(LAYOUT);

export type Rua = { area: string; rua: number; paletes: number };

export const RUAS: Rua[] = AREAS.flatMap((area) => {
  const lista: Rua[] = [];
  let n = 0;
  for (const bloco of LAYOUT[area]) {
    for (let i = 0; i < bloco.ruas; i++) {
      n++;
      lista.push({ area, rua: n, paletes: bloco.paletesPorRua });
    }
  }
  return lista;
});

export function ruasDaArea(area: string) {
  return RUAS.filter((r) => r.area === area);
}

export function capacidadeArea(area: string) {
  return ruasDaArea(area).reduce((s, r) => s + r.paletes, 0);
}

export function capacidadeRua(area: string, rua: number) {
  return RUAS.find((r) => r.area === area && r.rua === rua)?.paletes ?? 0;
}

export const CAPACIDADE_TOTAL = RUAS.reduce((s, r) => s + r.paletes, 0);

function hojeUTC() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export const HOJE = new Date(hojeUTC());

export type StatusValidade = "vencido" | "critico" | "atencao" | "ok";

export function diasParaVencer(validade: string) {
  return Math.round((new Date(validade + "T00:00:00Z").getTime() - hojeUTC()) / 86400000);
}

export function statusValidade(validade: string): StatusValidade {
  const d = diasParaVencer(validade);
  if (d < 0) return "vencido";
  if (d <= 30) return "critico";
  if (d <= 90) return "atencao";
  return "ok";
}

export const STATUS_LABEL: Record<StatusValidade, string> = {
  vencido: "Vencido",
  critico: "Crítico (≤30d)",
  atencao: "Atenção (≤90d)",
  ok: "Regular",
};

export type CelulaPalete = {
  area: string;
  rua: number;
  posicao: number;
  item?: ItemEstoque;
};

export function buildMapaArea(itens: ItemEstoque[], area: string): CelulaPalete[][] {
  const porChave = new Map<string, ItemEstoque>();
  for (const i of itens) {
    if (i.area === area) porChave.set(`${i.rua}-${i.posicao}`, i);
  }
  return ruasDaArea(area).map((r) =>
    Array.from({ length: r.paletes }, (_, k) => ({
      area,
      rua: r.rua,
      posicao: k + 1,
      item: porChave.get(`${r.rua}-${k + 1}`),
    })),
  );
}

export function resumoAreas(itens: ItemEstoque[]) {
  return AREAS.map((area) => {
    const capacidade = capacidadeArea(area);
    const ocupados = itens.filter((i) => i.area === area).length;
    return {
      area,
      ruas: ruasDaArea(area).length,
      capacidade,
      ocupados,
      ocupacao: capacidade ? ocupados / capacidade : 0,
    };
  });
}
