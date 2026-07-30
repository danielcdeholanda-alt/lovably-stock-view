import { statusValidade, type ItemEstoque } from "@/data/estoque";
import { useEstrutura } from "@/lib/estrutura-queries";
import { cn } from "@/lib/utils";
import { AlertTriangle, Boxes, PackageCheck, Warehouse } from "lucide-react";

export function Kpis({ itens }: { itens: ItemEstoque[] }) {
  const { ruas, capacidadeTotal } = useEstrutura();
  const paletes = itens.length;
  const caixas = itens.reduce((s, i) => s + i.quantidade, 0);
  const ocupacao = capacidadeTotal ? Math.round((paletes / capacidadeTotal) * 100) : 0;
  const criticos = itens.filter((i) => statusValidade(i.validade) === "critico").length;


  const cards = [
    {
      label: "Paletes em estoque",
      value: paletes.toLocaleString("pt-BR"),
      hint: `${caixas.toLocaleString("pt-BR")} caixas · ${RUAS.length} ruas`,
      icon: Boxes,
      tone: "text-primary",
    },
    {
      label: "Ocupação do armazém",
      value: `${ocupacao}%`,
      hint: `${CAPACIDADE_TOTAL.toLocaleString("pt-BR")} posições de palete`,
      icon: Warehouse,
      tone: "text-chart-3",
    },
    {
      label: "Validade crítica (≤30d)",
      value: criticos.toLocaleString("pt-BR"),
      hint: "priorizar saída FIFO",
      icon: AlertTriangle,
      tone: "text-crit",
    },
    {
      label: "Vencidos / SKUs ativos",
      value: `${vencidos.toLocaleString("pt-BR")} / ${skus}`,
      hint: "bloquear e dar baixa",
      icon: PackageCheck,
      tone: vencidos ? "text-dead" : "text-ok",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-md border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <c.icon className={cn("size-4", c.tone)} />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold leading-none">{c.value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
