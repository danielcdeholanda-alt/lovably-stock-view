import { useMemo, useState } from "react";
import {
  AREAS,
  buildMapaArea,
  capacidadeArea,
  ruasDaArea,
  statusValidade,
  type CelulaPalete,
  type ItemEstoque,
} from "@/data/estoque";
import { cn } from "@/lib/utils";

function corPalete(c: CelulaPalete) {
  if (!c.item) return "bg-secondary/60";
  const s = statusValidade(c.item.validade);
  if (s === "vencido") return "bg-dead/85";
  if (s === "critico") return "bg-crit/85";
  if (s === "atencao") return "bg-warn/85";
  return "bg-ok/80";
}

export function MapaEstoque({ itens }: { itens: ItemEstoque[] }) {
  const [area, setArea] = useState(AREAS[0]);
  const [sel, setSel] = useState<CelulaPalete | null>(null);
  const mapa = useMemo(() => buildMapaArea(itens, area), [itens, area]);
  const ruas = ruasDaArea(area);
  const capacidade = capacidadeArea(area);
  const ocupados = itens.filter((i) => i.area === area).length;

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold tracking-tight">Mapa de estoque — paletes no chão</h2>
          <p className="text-xs text-muted-foreground">
            Área {area} · {ruas.length} ruas · {ocupados.toLocaleString("pt-BR")} de{" "}
            {capacidade.toLocaleString("pt-BR")} posições de palete ocupadas
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {[
            ["bg-secondary/60", "Livre"],
            ["bg-ok/80", "Regular"],
            ["bg-warn/85", "Atenção ≤90d"],
            ["bg-crit/85", "Crítico ≤30d"],
            ["bg-dead/85", "Vencido"],
          ].map(([c, l]) => (
            <li key={l} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-sm", c)} />
              {l}
            </li>
          ))}
        </ul>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setArea(a);
              setSel(null);
            }}
            className={cn(
              "rounded-sm border px-3 py-1 text-xs font-medium transition",
              a === area
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Área {a}
          </button>
        ))}
      </div>

      <div className="max-h-[560px] overflow-auto p-4">
        <div className="space-y-[3px]">
          {mapa.map((linha, i) => (
            <div key={ruas[i].rua} className="flex items-center gap-[3px]">
              <span className="w-14 shrink-0 pr-2 text-right font-mono text-[10px] text-muted-foreground">
                {area}-{String(ruas[i].rua).padStart(2, "0")}
              </span>
              {linha.map((c) => (
                <button
                  key={c.posicao}
                  type="button"
                  onClick={() => setSel(c)}
                  title={`${c.area}-${c.rua} · palete ${c.posicao}${
                    c.item ? ` · ${c.item.codigo}` : " · livre"
                  }`}
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 rounded-[2px] transition hover:ring-2 hover:ring-ring",
                    corPalete(c),
                    sel?.rua === c.rua && sel?.posicao === c.posicao && "ring-2 ring-ring",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 text-sm">
        {sel ? (
          sel.item ? (
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
              <Info
                label="Posição"
                value={`Área ${sel.area} · Rua ${sel.rua} · Palete ${sel.posicao}`}
              />
              <Info label="Produto" value={`${sel.item.codigo} — ${sel.item.produto}`} />
              <Info label="Quantidade" value={`${sel.item.quantidade} caixas`} />
              <Info
                label="Validade"
                value={new Date(sel.item.validade + "T00:00:00Z").toLocaleDateString("pt-BR")}
              />
              <p className="col-span-full text-xs text-muted-foreground">{sel.item.descricao}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Área {sel.area} · Rua {sel.rua} · Palete {sel.posicao} — posição livre.
            </p>
          )
        ) : (
          <p className="text-muted-foreground">
            Selecione uma posição de palete no mapa para ver detalhes.
          </p>
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
