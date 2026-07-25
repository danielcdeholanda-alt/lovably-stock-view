// Estrutura espelhada da planilha FIFO (aba ESTOQUE) e do MAPA DE ESTOQUE.
// Capacidade por armário conforme a planilha original.

export type ItemEstoque = {
  codigo: string;
  produto: string;
  descricao: string;
  validade: string; // ISO
  nivel: number;
  armario: number;
  quantidade: number;
  armazem: string;
};

export const NIVEIS = [1, 2, 3, 4, 5, 6];

export const CAPACIDADE_ARMARIO: Record<number, number> = (() => {
  const map: Record<number, number> = {};
  for (let a = 1; a <= 43; a++) {
    if (a <= 18) map[a] = 47;
    else if (a <= 30) map[a] = 39;
    else if (a <= 40) map[a] = 29;
    else if (a === 41) map[a] = 17;
    else map[a] = 47;
  }
  return map;
})();

export const ARMARIOS = Object.keys(CAPACIDADE_ARMARIO).map(Number);

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

const ARMAZENS = ["ARMAZÉM 01", "ARMAZÉM 02", "ARMAZÉM 03"];

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
  const ocupados = new Set<string>();

  for (let i = 0; i < 96; i++) {
    const p = PRODUTOS[Math.floor(rnd() * PRODUTOS.length)];
    let armario = 0;
    let nivel = 0;
    let chave = "";
    let tentativas = 0;
    do {
      armario = 1 + Math.floor(rnd() * 43);
      nivel = 1 + Math.floor(rnd() * NIVEIS.length);
      chave = `${armario}-${nivel}`;
      tentativas++;
    } while (ocupados.has(chave) && tentativas < 40);
    ocupados.add(chave);

    const cap = CAPACIDADE_ARMARIO[armario];
    const quantidade = Math.max(1, Math.round(cap * (0.15 + rnd() * 0.85)));
    const diasValidade = Math.round(-25 + rnd() * 320);
    const validade = new Date(HOJE.getTime() + diasValidade * 86400000);

    itens.push({
      codigo: p.codigo,
      produto: p.produto,
      descricao: p.descricao,
      validade: validade.toISOString().slice(0, 10),
      nivel,
      armario,
      quantidade,
      armazem: ARMAZENS[armario <= 18 ? 0 : armario <= 30 ? 1 : 2],
    });
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

export type CelulaMapa = {
  armario: number;
  nivel: number;
  quantidade: number;
  capacidade: number;
  ocupacao: number;
  item?: ItemEstoque;
};

export function buildMapa(itens: ItemEstoque[]): CelulaMapa[][] {
  return NIVEIS.map((nivel) =>
    ARMARIOS.map((armario) => {
      const item = itens.find((i) => i.armario === armario && i.nivel === nivel);
      const capacidade = CAPACIDADE_ARMARIO[armario];
      const quantidade = item?.quantidade ?? 0;
      return {
        armario,
        nivel,
        quantidade,
        capacidade,
        ocupacao: capacidade ? quantidade / capacidade : 0,
        item,
      };
    }),
  );
}
