import { useMemo, useState } from "react";
import {
  STATUS_LABEL,
  diasParaVencer,
  statusValidade,
  type ItemEstoque,
  type StatusValidade,
} from "@/data/estoque";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const TONE: Record<StatusValidade, string> = {
  vencido: "bg-dead/20 text-dead border-dead/40",
  critico: "bg-crit/20 text-crit border-crit/40",
  atencao: "bg-warn/20 text-warn border-warn/40",
  ok: "bg-ok/15 text-ok border-ok/40",
};

export function TabelaEstoque({ itens }: { itens: ItemEstoque[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | StatusValidade>("todos");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      const s = statusValidade(i.validade);
      if (filtro !== "todos" && s !== filtro) return false;
      if (!q) return true;
      return (
        i.codigo.toLowerCase().includes(q) ||
        i.produto.toLowerCase().includes(q) ||
        i.area.toLowerCase() === q ||
        `${i.area}-${i.rua}`.toLowerCase().includes(q)
      );
    });
  }, [itens, busca, filtro]);

  const visiveis = filtrados.slice(0, 300);


  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold tracking-tight">Posições de estoque (FIFO)</h2>
          <p className="text-xs text-muted-foreground">
            Ordenado pela validade mais antiga — primeiro a sair
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["todos", "vencido", "critico", "atencao", "ok"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-sm border px-2.5 py-1 text-xs transition",
                filtro === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "todos" ? "Todos" : STATUS_LABEL[f]}
            </button>
          ))}
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar código, produto, área, rua…"
              className="w-56 rounded-sm border border-input bg-background py-1 pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      </header>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {[
                "Código",
                "Produto",
                "Validade",
                "Dias",
                "Área",
                "Rua",
                "Palete",
                "Caixas",
                "Status",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i, idx) => {
              const s = statusValidade(i.validade);
              const dias = diasParaVencer(i.validade);
              return (
                <tr
                  key={`${i.area}-${i.rua}-${i.posicao}-${idx}`}
                  className="border-t border-border/60 hover:bg-accent/40"
                >
                  <td className="px-3 py-2 font-mono text-xs">{i.codigo}</td>
                  <td className="px-3 py-2">{i.produto}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {new Date(i.validade + "T00:00:00Z").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{dias}</td>
                  <td className="px-3 py-2 font-mono text-xs">{i.area}</td>
                  <td className="px-3 py-2 font-mono text-xs">{i.rua}</td>
                  <td className="px-3 py-2 font-mono text-xs">{i.posicao}</td>
                  <td className="px-3 py-2 font-mono text-xs">{i.quantidade}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-sm border px-2 py-0.5 text-[11px]", TONE[s])}>
                      {STATUS_LABEL[s]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma posição encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Exibindo {visiveis.length.toLocaleString("pt-BR")} de{" "}
        {filtrados.length.toLocaleString("pt-BR")} paletes
      </p>

    </section>
  );
}
