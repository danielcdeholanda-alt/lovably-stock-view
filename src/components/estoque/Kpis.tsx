import { CAPACIDADE_ARMARIO, statusValidade, type ItemEstoque } from "@/data/estoque";
import { cn } from "@/lib/utils";
import { AlertTriangle, Boxes, PackageCheck, Warehouse } from "lucide-react";

export function Kpis({ itens }: { itens: ItemEstoque[] }) {
  const totalUnidades = itens.reduce((s, i) => s + i.quantidade, 0);
  const capacidadeTotal = Object.values(CAPACIDADE_ARMARIO).reduce((s, c) => s + c, 0) * 6;
  const ocupacao = Math.round((totalUnidades / capacidadeTotal) * 100);
  const criticos = itens.filter((i) => statusValidade(i.validade) === "critico").length;
  const vencidos = itens.filter((i) => statusValidade(i.validade) === "vencido").length;
  const skus = new Set(itens.map((i) => i.codigo)).size;

  const cards = [
    {
      label: "Unidades em estoque",
      value: totalUnidades.toLocaleString("pt-BR"),
      hint: `${itens.length} posições ocupadas`,
      icon: Boxes,
      tone: "text-primary",
    },
    {
      label: "Ocupação do armazém",
      value: `${ocupacao}%`,
      hint: `${capacidadeTotal.toLocaleString("pt-BR")} posições-capacidade`,
      icon: Warehouse,
      tone: "text-chart-3",
    },
    {
      label: "Validade crítica (≤30d)",
      value: String(criticos),
      hint: "priorizar saída FIFO",
      icon: AlertTriangle,
      tone: "text-crit",
    },
    {
      label: "Vencidos / SKUs ativos",
      value: `${vencidos} / ${skus}`,
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
