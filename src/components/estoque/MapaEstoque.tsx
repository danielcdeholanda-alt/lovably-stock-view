import { useMemo, useState } from "react";
import {
  ARMARIOS,
  NIVEIS,
  buildMapa,
  statusValidade,
  type CelulaMapa,
  type ItemEstoque,
} from "@/data/estoque";
import { cn } from "@/lib/utils";

function corOcupacao(c: CelulaMapa) {
  if (c.quantidade === 0) return "bg-secondary/60 text-muted-foreground";
  const s = c.item ? statusValidade(c.item.validade) : "ok";
  if (s === "vencido") return "bg-dead/85 text-background";
  if (s === "critico") return "bg-crit/85 text-background";
  if (c.ocupacao >= 0.85) return "bg-warn/85 text-background";
  return "bg-ok/80 text-background";
}

export function MapaEstoque({ itens }: { itens: ItemEstoque[] }) {
  const mapa = useMemo(() => buildMapa(itens), [itens]);
  const [sel, setSel] = useState<CelulaMapa | null>(null);

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold tracking-tight">Mapa de estoque</h2>
          <p className="text-xs text-muted-foreground">
            Armários 1–43 × níveis 1–6 · cor indica validade e ocupação da posição
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {[
            ["bg-secondary/60", "Vazio"],
            ["bg-ok/80", "Ocupado"],
            ["bg-warn/85", "Cheio ≥85%"],
            ["bg-crit/85", "Validade ≤30d"],
            ["bg-dead/85", "Vencido"],
          ].map(([c, l]) => (
            <li key={l} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-sm", c)} />
              {l}
            </li>
          ))}
        </ul>
      </header>

      <div className="overflow-x-auto p-4">
        <div className="min-w-[900px]">
          <div className="mb-1 flex gap-[3px] pl-10">
            {ARMARIOS.map((a) => (
              <span
                key={a}
                className="w-5 shrink-0 text-center font-mono text-[9px] text-muted-foreground"
              >
                {a}
              </span>
            ))}
          </div>
          {mapa.map((linha, i) => (
            <div key={NIVEIS[i]} className="mb-[3px] flex items-center gap-[3px]">
              <span className="w-10 shrink-0 pr-2 text-right font-mono text-[10px] text-muted-foreground">
                N{NIVEIS[i]}
              </span>
              {linha.map((c) => (
                <button
                  key={`${c.armario}-${c.nivel}`}
                  type="button"
                  onClick={() => setSel(c)}
                  title={`Armário ${c.armario} · Nível ${c.nivel} · ${c.quantidade}/${c.capacidade}`}
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-sm text-[8px] font-medium transition hover:ring-2 hover:ring-ring",
                    corOcupacao(c),
                    sel?.armario === c.armario && sel?.nivel === c.nivel && "ring-2 ring-ring",
                  )}
                >
                  {c.quantidade || ""}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 text-sm">
        {sel ? (
          sel.item ? (
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Posição" value={`Armário ${sel.armario} · Nível ${sel.nivel}`} />
              <Info label="Produto" value={`${sel.item.codigo} — ${sel.item.produto}`} />
              <Info
                label="Quantidade"
                value={`${sel.quantidade} / ${sel.capacidade} (${Math.round(sel.ocupacao * 100)}%)`}
              />
              <Info
                label="Validade"
                value={new Date(sel.item.validade + "T00:00:00Z").toLocaleDateString("pt-BR")}
              />
              <p className="col-span-full text-xs text-muted-foreground">{sel.item.descricao}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Armário {sel.armario} · Nível {sel.nivel} — posição livre (capacidade {sel.capacidade}
              ).
            </p>
          )
        ) : (
          <p className="text-muted-foreground">Selecione uma posição do mapa para ver detalhes.</p>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
