// Estrutura real do armazém: áreas → ruas → posições de palete (paletes no chão).

export type ItemEstoque = {
  codigo: string;
  produto: string;
  descricao: string;
  validade: string; // ISO
  area: string;
  rua: number;
  posicao: number;
  quantidade: number; // caixas no palete
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

export const CAPACIDADE_TOTAL = RUAS.reduce((s, r) => s + r.paletes, 0);

const PRODUTOS: { codigo: string; produto: string; descricao: string }[] = [
  { codigo: "P-1001", produto: "Farinha de Trigo", descricao: "Farinha de trigo tipo 1 - saco 25kg" },
  { codigo: "P-1002", produto: "Açúcar Refinado", descricao: "Açúcar refinado - fardo 30x1kg" },
  { codigo: "P-1003", produto: "Óleo de Soja", descricao: "Óleo de soja refinado - caixa 20x900ml" },
  { codigo: "P-1004", produto: "Arroz Parboilizado", descricao: "Arroz parboilizado tipo 1 - fardo 30x1kg" },
  { codigo: "P-1005", produto: "Feijão Carioca", descricao: "Feijão carioca tipo 1 - fardo 30x1kg" },
  { codigo: "P-1006", produto: "Leite UHT Integral", descricao: "Leite UHT integral - caixa 12x1L" },
  { codigo: "P-1007", produto: "Café Torrado", descricao: "Café torrado e moído - fardo 20x500g" },
  { codigo: "P-1008", produto: "Macarrão Espaguete", descricao: "Macarrão espaguete sêmola - fardo 20x500g" },
  { codigo: "P-1009", produto: "Molho de Tomate", descricao: "Molho de tomate tradicional - caixa 24x340g" },
  { codigo: "P-1010", produto: "Sal Refinado", descricao: "Sal refinado iodado - fardo 30x1kg" },
  { codigo: "P-1011", produto: "Margarina", descricao: "Margarina cremosa 80% lipídios - caixa 12x500g" },
  { codigo: "P-1012", produto: "Biscoito Cream Cracker", descricao: "Biscoito cream cracker - caixa 20x400g" },
  { codigo: "P-1013", produto: "Achocolatado em Pó", descricao: "Achocolatado em pó - caixa 12x400g" },
  { codigo: "P-1014", produto: "Fermento Químico", descricao: "Fermento químico em pó - caixa 24x100g" },
  { codigo: "P-1015", produto: "Amido de Milho", descricao: "Amido de milho - caixa 24x500g" },
  { codigo: "P-1016", produto: "Vinagre de Álcool", descricao: "Vinagre de álcool - caixa 12x750ml" },
];

// Gerador determinístico (LCG) para manter os dados estáveis entre renders/SSR.
function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const HOJE = new Date("2026-07-25T00:00:00Z");

function buildItens(): ItemEstoque[] {
  const rnd = makeRandom(20260725);
  const itens: ItemEstoque[] = [];

  for (const r of RUAS) {
    // ocupação variável por rua (0–95% dos paletes)
    const taxa = rnd() * 0.95;
    for (let pos = 1; pos <= r.paletes; pos++) {
      if (rnd() > taxa) continue;
      const p = PRODUTOS[Math.floor(rnd() * PRODUTOS.length)];
      const diasValidade = Math.round(-25 + rnd() * 320);
      const validade = new Date(HOJE.getTime() + diasValidade * 86400000);
      itens.push({
        codigo: p.codigo,
        produto: p.produto,
        descricao: p.descricao,
        validade: validade.toISOString().slice(0, 10),
        area: r.area,
        rua: r.rua,
        posicao: pos,
        quantidade: 20 + Math.floor(rnd() * 60),
      });
    }
  }
  return itens.sort((a, b) => a.validade.localeCompare(b.validade));
}

export const ITENS: ItemEstoque[] = buildItens();

export type StatusValidade = "vencido" | "critico" | "atencao" | "ok";

export function diasParaVencer(validade: string) {
  return Math.round((new Date(validade + "T00:00:00Z").getTime() - HOJE.getTime()) / 86400000);
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
