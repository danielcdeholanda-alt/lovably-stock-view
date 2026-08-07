import { AlertTriangle } from "lucide-react";
import { useEstrutura } from "@/lib/estrutura-queries";
import { usePaletesForaDeOrdem } from "@/lib/estoque-queries";

const dataBR = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });

/** Aponta paletes que não respeitam a ordem de validade (FEFO) dentro da rua. */
export function AlertaFefo() {
  const { galpaoId } = useEstrutura();
  const { data: fora = [] } = usePaletesForaDeOrdem(galpaoId);

  if (fora.length === 0) return null;

  return (
    <section className="rounded-md border border-warn/40 bg-warn/10">
      <header className="flex items-center gap-2 border-b border-warn/30 px-4 py-2.5">
        <AlertTriangle className="size-4 text-warn" />
        <h2 className="text-sm font-semibold text-warn">
          {fora.length} palete(s) fora da ordem de validade (FEFO)
        </h2>
      </header>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-1.5 text-left">Palete</th>
              <th className="px-4 py-1.5 text-left">Validade</th>
              <th className="px-4 py-1.5 text-left">Está em</th>
              <th className="px-4 py-1.5 text-left">Deveria estar em</th>
            </tr>
          </thead>
          <tbody>
            {fora.map((p) => (
              <tr key={p.palete_id} className="border-t border-warn/20">
                <td className="px-4 py-1.5 font-mono">{p.codigo}</td>
                <td className="px-4 py-1.5 font-mono">{dataBR(p.validade)}</td>
                <td className="px-4 py-1.5 font-mono">
                  {p.endereco ?? `${p.area}-${String(p.rua).padStart(2, "0")}-${String(p.posicao).padStart(2, "0")}`}
                </td>
                <td className="px-4 py-1.5 font-mono text-warn">{p.sugerido_endereco ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-muted-foreground">
        Use a transferência para reposicionar: a posição 01 deve ficar com a validade mais próxima.
        Nada é movido automaticamente.
      </p>
    </section>
  );
}
