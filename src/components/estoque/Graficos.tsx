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
import { STATUS_LABEL, resumoAreas, statusValidade, type ItemEstoque } from "@/data/estoque";

const STATUS_COLORS: Record<string, string> = {
  vencido: "var(--dead)",
  critico: "var(--crit)",
  atencao: "var(--warn)",
  ok: "var(--ok)",
};

export function Graficos({ itens }: { itens: ItemEstoque[] }) {
  const estrutura = useEstrutura();
  const porStatus = (["vencido", "critico", "atencao", "ok"] as const).map((s) => ({
    name: STATUS_LABEL[s],
    key: s,
    value: itens.filter((i) => statusValidade(i.validade) === s).length,
  }));

  const porArea = estrutura.resumoAreas(itens).map((a) => ({

    area: `Área ${a.area}`,
    ocupados: a.ocupados,
    livres: a.capacidade - a.ocupados,
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      <div className="rounded-md border border-border bg-card p-4 lg:col-span-3">
        <h2 className="font-semibold tracking-tight">Ocupação por área</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Posições de palete ocupadas x livres em cada área
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porArea} margin={{ left: 8, right: 16 }}>
            <XAxis dataKey="area" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="ocupados" stackId="a" fill="var(--chart-1)" isAnimationActive={false} />
            <Bar dataKey="livres" stackId="a" fill="var(--secondary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>


      <div className="rounded-md border border-border bg-card p-4 lg:col-span-2">
        <h2 className="font-semibold tracking-tight">Situação de validade</h2>
        <p className="mb-3 text-xs text-muted-foreground">Posições por faixa de vencimento</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={porStatus}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={false}
            >
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
