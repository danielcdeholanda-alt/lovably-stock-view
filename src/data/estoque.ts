// Estrutura do armazém agora é dinâmica: galpões → áreas → ruas (capacidade × níveis).
// Este módulo guarda apenas tipos e helpers puros; os dados vêm do banco.

export type PaleteStatus =
  | "disponivel"
  | "reservado"
  | "bloqueado"
  | "quarentena"
  | "expedido";

export const PALETE_STATUS_LABEL: Record<PaleteStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  bloqueado: "Bloqueado",
  quarentena: "Quarentena",
  expedido: "Expedido",
};

export type ItemEstoque = {
  id: string;
  paleteCodigo: string;
  produtoId: string;
  codigo: string;
  produto: string;
  descricao: string;
  validade: string; // ISO (yyyy-mm-dd)
  dataEntrada: string; // ISO timestamp
  dataFabricacao: string | null;
  area: string;
  rua: number;
  posicao: number;
  nivel: number | null;
  endereco: string | null;
  enderecoId: string | null;
  status: PaleteStatus;
  quantidade: number; // caixas no palete
  lote: string | null;
};


export type RuaEstrutura = {
  id: string;
  areaId: string;
  area: string;
  rua: number;
  capacidade: number;
  niveis: number;
};

export function posicoesDaRua(r: RuaEstrutura) {
  return r.capacidade * r.niveis;
}

export function areasDeRuas(ruas: RuaEstrutura[]) {
  return Array.from(new Set(ruas.map((r) => r.area))).sort();
}

export function ruasDaArea(ruas: RuaEstrutura[], area: string) {
  return ruas.filter((r) => r.area === area).sort((a, b) => a.rua - b.rua);
}

export function capacidadeArea(ruas: RuaEstrutura[], area: string) {
  return ruasDaArea(ruas, area).reduce((s, r) => s + posicoesDaRua(r), 0);
}

export function capacidadeRua(ruas: RuaEstrutura[], area: string, rua: number) {
  const r = ruas.find((x) => x.area === area && x.rua === rua);
  return r ? posicoesDaRua(r) : 0;
}

export function capacidadeTotal(ruas: RuaEstrutura[]) {
  return ruas.reduce((s, r) => s + posicoesDaRua(r), 0);
}

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

export function buildMapaArea(
  ruas: RuaEstrutura[],
  itens: ItemEstoque[],
  area: string,
): CelulaPalete[][] {
  const porChave = new Map<string, ItemEstoque>();
  for (const i of itens) {
    if (i.area === area) porChave.set(`${i.rua}-${i.posicao}`, i);
  }
  return ruasDaArea(ruas, area).map((r) =>
    Array.from({ length: posicoesDaRua(r) }, (_, k) => ({
      area,
      rua: r.rua,
      posicao: k + 1,
      item: porChave.get(`${r.rua}-${k + 1}`),
    })),
  );
}

export function resumoAreas(ruas: RuaEstrutura[], itens: ItemEstoque[]) {
  return areasDeRuas(ruas).map((area) => {
    const capacidade = capacidadeArea(ruas, area);
    const ocupados = itens.filter((i) => i.area === area).length;
    return {
      area,
      ruas: ruasDaArea(ruas, area).length,
      capacidade,
      ocupados,
      ocupacao: capacidade ? ocupados / capacidade : 0,
    };
  });
}
