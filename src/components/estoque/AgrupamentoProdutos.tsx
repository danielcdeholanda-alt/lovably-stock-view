import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { statusValidade, type ItemEstoque } from "@/data/estoque";
import { saborDoCodigo, tipoDoCodigo } from "@/lib/codigo-produto";
import { cn } from "@/lib/utils";

type Linha = {
  chave: string;
  rotulo: string;
  paletes: number;
  caixas: number;
  criticos: number;
  produtos: number;
};

function agrupar(itens: ItemEstoque[], chaveDe: (i: ItemEstoque) => string, rotuloDe: (k: string) => string) {
  const mapa = new Map<string, { paletes: number; caixas: number; criticos: number; skus: Set<string> }>();
  for (const i of itens) {
    const k = chaveDe(i);
    const atual = mapa.get(k) ?? { paletes: 0, caixas: 0, criticos: 0, skus: new Set<string>() };
    atual.paletes += 1;
    atual.caixas += i.quantidade;
    const s = statusValidade(i.validade);
    if (s === "critico" || s === "vencido") atual.criticos += 1;
    atual.skus.add(i.codigo);
    mapa.set(k, atual);
  }
  const linhas: Linha[] = [...mapa.entries()].map(([chave, v]) => ({
    chave,
    rotulo: rotuloDe(chave),
    paletes: v.paletes,
    caixas: v.caixas,
    criticos: v.criticos,
    produtos: v.skus.size,
  }));
  return linhas.sort((a, b) => b.paletes - a.paletes || a.chave.localeCompare(b.chave));
}

export function AgrupamentoProdutos({ itens }: { itens: ItemEstoque[] }) {
  const [aberto, setAberto] = useState<string | null>(null);

  const porTipo = useMemo(
    () => agrupar(itens, (i) => tipoDoCodigo(i.codigo), (k) => `Tipo ${k}`),
    [itens],
  );

  const saboresDoTipo = useMemo(() => {
    if (!aberto) return [];
    const doTipo = itens.filter((i) => tipoDoCodigo(i.codigo) === aberto);
    return agrupar(doTipo, (i) => saborDoCodigo(i.codigo), (k) => `Sabor ${k}`);
  }, [itens, aberto]);

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Layers className="size-4 text-primary" />
        <div>
          <h2 className="font-semibold tracking-tight">Estoque por tipo de produto e sabor</h2>
          <p className="text-xs text-muted-foreground">
            Código = 4 dígitos de tipo + 000 + 3 dígitos de sabor — clique num tipo para ver os sabores
          </p>
        </div>
      </header>

      {porTipo.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum palete em estoque.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Tipo", "Produtos", "Paletes", "Caixas", "Crít./Venc."].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porTipo.map((t) => (
                <Fragment key={t.chave}>
                  <tr
                    onClick={() => setAberto(aberto === t.chave ? null : t.chave)}
                    className={cn(
                      "cursor-pointer border-t border-border/60 hover:bg-accent/40",
                      aberto === t.chave && "bg-accent/30",
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        {aberto === t.chave ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                        {t.rotulo}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{t.produtos}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.paletes}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {t.caixas.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{t.criticos}</td>
                  </tr>
                  {aberto === t.chave &&
                    saboresDoTipo.map((s) => (
                      <tr key={`${t.chave}-${s.chave}`} className="border-t border-border/40 bg-background/40">
                        <td className="py-1.5 pl-9 pr-3 font-mono text-[11px] text-muted-foreground">
                          {s.rotulo}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                          {s.produtos}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{s.paletes}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">
                          {s.caixas.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">{s.criticos}</td>
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
