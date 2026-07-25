import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STATUS_LABEL, statusValidade, type ItemEstoque } from "@/data/estoque";

const STATUS_COLORS: Record<string, string> = {
  vencido: "var(--dead)",
  critico: "var(--crit)",
  atencao: "var(--warn)",
  ok: "var(--ok)",
};

export function Graficos({ itens }: { itens: ItemEstoque[] }) {
  const porStatus = (["vencido", "critico", "atencao", "ok"] as const).map((s) => ({
    name: STATUS_LABEL[s],
    key: s,
    value: itens.filter((i) => statusValidade(i.validade) === s).length,
  }));

  const porProduto = Object.values(
    itens.reduce<Record<string, { produto: string; quantidade: number }>>((acc, i) => {
      acc[i.codigo] = acc[i.codigo] ?? { produto: i.produto, quantidade: 0 };
      acc[i.codigo].quantidade += i.quantidade;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 8);

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      <div className="rounded-md border border-border bg-card p-4 lg:col-span-3">
        <h2 className="font-semibold tracking-tight">Top produtos por volume</h2>
        <p className="mb-3 text-xs text-muted-foreground">Unidades em estoque por SKU</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porProduto} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis
              type="category"
              dataKey="produto"
              width={130}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="quantidade" fill="var(--chart-1)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-md border border-border bg-card p-4 lg:col-span-2">
        <h2 className="font-semibold tracking-tight">Situação de validade</h2>
        <p className="mb-3 text-xs text-muted-foreground">Posições por faixa de vencimento</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={porStatus} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {porStatus.map((d) => (
                <Cell key={d.key} fill={STATUS_COLORS[d.key]} stroke="var(--card)" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <ul className="mt-2 space-y-1 text-xs">
          {porStatus.map((d) => (
            <li key={d.key} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: STATUS_COLORS[d.key] }}
                />
                {d.name}
              </span>
              <span className="font-mono">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
