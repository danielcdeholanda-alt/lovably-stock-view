import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, ShieldCheck } from "lucide-react";
import { usePapel } from "@/lib/auth";
import { useEstrutura } from "@/lib/estrutura-queries";
import {
  useAuditoria,
  useProdutos,
  useUsuariosAuditoria,
  type FiltroAuditoria,
  type RegistroAuditoria,
  type TipoMovimentacao,
} from "@/lib/estoque-queries";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria de Movimentações | Estoque Inteligente" },
      {
        name: "description",
        content:
          "Histórico imutável de movimentações de paletes: entradas, saídas, transferências e ajustes com usuário, produto, lote, validade, origem e destino.",
      },
      { property: "og:title", content: "Auditoria de Movimentações" },
      {
        property: "og:description",
        content: "Log imutável de movimentações de paletes, acessível somente a administradores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auditoria,
});

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";

const TIPOS: Array<[TipoMovimentacao, string]> = [
  ["entrada", "Entrada"],
  ["saida", "Saída"],
  ["transferencia", "Transferência"],
  ["ajuste", "Ajuste"],
  ["bloqueio", "Bloqueio"],
  ["desbloqueio", "Desbloqueio"],
];

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR");
const dataBR = (iso?: string | null) =>
  iso ? new Date(iso.length <= 10 ? iso + "T00:00:00Z" : iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

function origem(m: RegistroAuditoria) {
  return `${m.area}-${String(m.rua).padStart(2, "0")}-${String(m.posicao).padStart(2, "0")}`;
}
function destino(m: RegistroAuditoria) {
  if (!m.area_destino) return null;
  return `${m.area_destino}-${String(m.rua_destino ?? 0).padStart(2, "0")}-${String(m.posicao_destino ?? 0).padStart(2, "0")}`;
}

function Auditoria() {
  const { isAdmin, carregando } = usePapel();
  const { galpaoId, galpao, areas } = useEstrutura();
  const { data: produtos = [] } = useProdutos();
  const { data: usuarios = [] } = useUsuariosAuditoria(isAdmin);

  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [produtoTexto, setProdutoTexto] = useState("");
  const [lote, setLote] = useState("");
  const [palete, setPalete] = useState("");
  const [area, setArea] = useState("");
  const [rua, setRua] = useState("");
  const [posicao, setPosicao] = useState("");
  const [tipo, setTipo] = useState("");

  const produtoId = useMemo(() => {
    const t = produtoTexto.trim().toLowerCase();
    if (!t) return undefined;
    return produtos.find(
      (p) => p.codigo.toLowerCase() === t || p.codigo.toLowerCase().includes(t) || p.nome.toLowerCase().includes(t),
    )?.id;
  }, [produtoTexto, produtos]);

  const filtro: FiltroAuditoria = {
    galpaoId,
    de: de || undefined,
    ate: ate || undefined,
    usuarioId: usuarioId || undefined,
    produtoId,
    lote: lote.trim() || undefined,
    palete: palete.trim() || undefined,
    area: area || undefined,
    rua: rua ? Number(rua) : undefined,
    posicao: posicao ? Number(posicao) : undefined,
    tipo: (tipo || undefined) as TipoMovimentacao | undefined,
  };

  const { data: registros = [], isLoading, error } = useAuditoria(filtro, isAdmin);

  const exportar = () => {
    const cab = [
      "Data/Hora",
      "Usuário",
      "Tipo",
      "Produto",
      "Descrição",
      "Lote",
      "Validade",
      "Palete",
      "Quantidade",
      "Qtd. anterior",
      "Galpão",
      "Área",
      "Rua",
      "Posição anterior",
      "Nova posição",
      "Motivo",
      "Observação",
    ];
    const linhas = registros.map((m) => [
      dataHora(m.data),
      m.usuario ?? "—",
      m.tipo,
      m.produtos?.codigo ?? "—",
      m.produtos?.nome ?? "—",
      m.lote ?? "—",
      dataBR(m.validade),
      m.palete_codigo ?? "—",
      String(m.quantidade),
      m.quantidade_anterior != null ? String(m.quantidade_anterior) : "—",
      galpao?.nome ?? "—",
      m.area,
      String(m.rua),
      origem(m),
      destino(m) ?? "—",
      m.motivo ?? "—",
      m.observacao ?? "—",
    ]);
    const csv = [cab, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (carregando) {
    return <main className="mx-auto max-w-[1400px] px-4 py-6 text-sm text-muted-foreground">Carregando…</main>;
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-10">
        <div className="rounded-md border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A auditoria de movimentações é exclusiva para administradores.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ShieldCheck className="size-4 text-primary" />
            Auditoria de movimentações
          </h1>
          <p className="text-xs text-muted-foreground">
            Histórico imutável — nenhum registro pode ser editado ou apagado. {galpao?.nome ?? ""}
          </p>
        </div>
        <button
          type="button"
          onClick={exportar}
          disabled={registros.length === 0}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs transition hover:bg-accent disabled:opacity-50"
        >
          <Download className="size-3.5" />
          Exportar CSV
        </button>
      </header>

      <section className="grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className={labelCls}>De</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Usuário</label>
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {TIPOS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Produto (código ou nome)</label>
          <input
            value={produtoTexto}
            onChange={(e) => setProdutoTexto(e.target.value)}
            className={inputCls}
            placeholder="Todos"
          />
          {produtoTexto.trim() && !produtoId && (
            <p className="mt-1 text-[11px] text-warn">Produto não encontrado</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Lote</label>
          <input value={lote} onChange={(e) => setLote(e.target.value)} className={inputCls} placeholder="Todos" />
        </div>
        <div>
          <label className={labelCls}>Palete</label>
          <input
            value={palete}
            onChange={(e) => setPalete(e.target.value)}
            className={inputCls}
            placeholder="Ex.: PAL-000123"
          />
        </div>
        <div>
          <label className={labelCls}>Área</label>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                Área {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Rua</label>
          <input
            type="number"
            min={1}
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            className={inputCls}
            placeholder="Todas"
          />
        </div>
        <div>
          <label className={labelCls}>Posição</label>
          <input
            type="number"
            min={1}
            value={posicao}
            onChange={(e) => setPosicao(e.target.value)}
            className={inputCls}
            placeholder="Todas"
          />
        </div>
      </section>

      {error && (
        <p className="rounded-md border border-dead/40 bg-dead/10 px-4 py-3 text-sm text-dead">
          Não foi possível carregar a auditoria: {(error as Error).message}
        </p>
      )}

      <section className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data/hora</th>
              <th className="px-3 py-2 text-left">Usuário</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-left">Lote</th>
              <th className="px-3 py-2 text-left">Validade</th>
              <th className="px-3 py-2 text-left">Palete</th>
              <th className="px-3 py-2 text-right">Qtd.</th>
              <th className="px-3 py-2 text-left">De → Para</th>
              <th className="px-3 py-2 text-left">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((m) => (
              <tr key={m.id} className="border-t border-border/60 align-top">
                <td className="whitespace-nowrap px-3 py-2 font-mono">{dataHora(m.data)}</td>
                <td className="px-3 py-2">{m.usuario ?? "—"}</td>
                <td className="px-3 py-2 capitalize">{m.tipo}</td>
                <td className="px-3 py-2">
                  <span className="font-mono">{m.produtos?.codigo ?? "—"}</span>
                  <span className="block text-muted-foreground">{m.produtos?.nome ?? ""}</span>
                </td>
                <td className="px-3 py-2 font-mono">{m.lote ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">{dataBR(m.validade)}</td>
                <td className="px-3 py-2 font-mono">{m.palete_codigo ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {m.quantidade_anterior != null ? `${m.quantidade_anterior} → ` : ""}
                  {m.quantidade}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">
                  {origem(m)}
                  {destino(m) ? ` → ${destino(m)}` : ""}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{m.motivo ?? m.observacao ?? "—"}</td>
              </tr>
            ))}
            {!isLoading && registros.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhuma movimentação encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {isLoading && <p className="px-3 py-3 text-xs text-muted-foreground">Carregando registros…</p>}
      </section>
      <p className="text-[11px] text-muted-foreground">
        Exibindo até 500 registros mais recentes conforme os filtros aplicados.
      </p>
    </main>
  );
}
