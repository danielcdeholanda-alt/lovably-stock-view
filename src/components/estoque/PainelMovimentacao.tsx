import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  Lock,
  MoveRight,
  PackagePlus,
} from "lucide-react";
import {
  PALETE_STATUS_LABEL,
  statusValidade,
  STATUS_LABEL,
  type ItemEstoque,
  type PaleteStatus,
} from "@/data/estoque";
import { useEstrutura } from "@/lib/estrutura-queries";
import { usePapel } from "@/lib/auth";
import {
  useAjusteInventario,
  useCriarProduto,
  useEnderecos,
  useEntradaLote,
  useMovimentacoes,
  usePreviaSaida,
  useProdutos,
  useSaidaPorRegra,
  useStatusPalete,
  useSugestaoRuas,

  useTransferencia,
  type PaleteSelecionado,
} from "@/lib/estoque-queries";
import {
  MSG_CODIGO_INVALIDO,
  codigoValido,
  normalizarCodigo,
  saborDoCodigo,
  tipoDoCodigo,
} from "@/lib/codigo-produto";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";
const btnCls =
  "inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] transition hover:bg-accent disabled:opacity-50";

type Aba = "entrada" | "saida" | "transferencia" | "ajuste" | "produto";

const dataBR = (iso?: string | null) =>
  iso ? new Date(iso.length <= 10 ? iso + "T00:00:00Z" : iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

export function PainelMovimentacao({ itens }: { itens: ItemEstoque[] }) {
  const [aba, setAba] = useState<Aba>("entrada");
  const { isAdmin } = usePapel();
  const { galpao } = useEstrutura();

  const abas: Array<[Aba, string]> = [
    ["entrada", "Entrada"],
    ["saida", "Saída"],
    ["transferencia", "Transferência"],
    ...(isAdmin ? ([["ajuste", "Inventário"]] as Array<[Aba, string]>) : []),
    ["produto", "Novo produto"],
  ];

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-semibold tracking-tight">Operações de armazém</h2>
        <p className="text-xs text-muted-foreground">
          Entradas, saídas, transferências e inventário — regra de saída deste galpão:{" "}
          <span className="font-mono text-foreground">{galpao?.politica_saida ?? "—"}</span>
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        {abas.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={cn(
              "rounded-sm border px-3 py-1 text-xs font-medium transition",
              aba === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {aba === "entrada" && <FormEntrada itens={itens} />}
        {aba === "saida" && <FormSaida itens={itens} />}
        {aba === "transferencia" && <FormTransferencia itens={itens} />}
        {aba === "ajuste" && isAdmin && <FormAjuste itens={itens} />}
        {aba === "produto" && <FormProduto />}
        <UltimasMovimentacoes />
      </div>
    </section>
  );
}

/** Campo de código de produto com sugestões. */
function CampoProduto({
  codigo,
  setCodigo,
}: {
  codigo: string;
  setCodigo: (v: string) => void;
}) {
  const { data: produtos = [] } = useProdutos();
  const produto = useMemo(() => {
    const c = normalizarCodigo(codigo);
    if (!c) return undefined;
    return produtos.find((p) => normalizarCodigo(p.codigo) === c);
  }, [codigo, produtos]);

  const sugestoes = useMemo(() => {
    const c = codigo.trim().toLowerCase();
    if (!c || produto) return [];
    return produtos
      .filter((p) => p.codigo.toLowerCase().includes(c) || p.nome.toLowerCase().includes(c))
      .slice(0, 6);
  }, [codigo, produtos, produto]);

  return {
    produto,
    campo: (
      <div>
        <label className={labelCls}>Código do produto</label>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className={inputCls}
          placeholder="Digite o código (ex.: 0401000089)"
          autoComplete="off"
        />
        {produto ? (
          <p className="mt-1 text-xs text-ok">
            {produto.nome}{" "}
            <span className="font-mono text-muted-foreground">
              · tipo {tipoDoCodigo(produto.codigo)} · sabor {saborDoCodigo(produto.codigo)}
            </span>
          </p>
        ) : codigo.trim() ? (
          <div className="mt-1 space-y-1">
            <p className="text-xs text-warn">Produto não encontrado</p>
            {sugestoes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCodigo(s.codigo)}
                className="block w-full truncate rounded-sm border border-border px-2 py-1 text-left text-[11px] hover:bg-accent"
              >
                {s.codigo} — {s.nome}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    ),
  };
}

function FormEntrada({ itens }: { itens: ItemEstoque[] }) {
  const entrada = useEntradaLote();
  const estrutura = useEstrutura();
  const AREAS = estrutura.areas;
  const [codigo, setCodigo] = useState("");
  const { produto, campo } = CampoProduto({ codigo, setCodigo });
  const [areaSel, setArea] = useState("");
  const area = areaSel || AREAS[0] || "";
  const [rua, setRua] = useState(1);
  const [quantidade, setQuantidade] = useState("");
  const [paletes, setPaletes] = useState("1");
  const [validade, setValidade] = useState("");
  const [fabricacao, setFabricacao] = useState("");
  const [lote, setLote] = useState("");
  const [observacao, setObservacao] = useState("");
  const { data: sugestoes = [] } = useSugestaoRuas(
    estrutura.galpaoId,
    produto?.id,
    Math.max(Number(paletes) || 1, 1),
  );
  /** Produto que já ocupa cada rua da área (regra: 1 produto por rua). */
  const produtoDaRua = useMemo(() => {
    const m = new Map<number, ItemEstoque>();
    for (const i of itens) if (i.area === area && !m.has(i.rua)) m.set(i.rua, i);
    return m;
  }, [itens, area]);
  const ocupanteRua = produtoDaRua.get(rua);
  const ruaBloqueada = !!(produto && ocupanteRua && ocupanteRua.produtoId !== produto.id);
  const posicaoFefo = useMemo(() => {
    if (!validade) return null;
    return (
      itens.filter((i) => i.area === area && i.rua === rua && i.validade <= validade).length + 1
    );
  }, [itens, area, rua, validade]);


  const ruas = estrutura.ruasDaArea(area);
  const ocupados = itens.filter((i) => i.area === area && i.rua === rua).length;
  const capacidade = estrutura.capacidadeRua(area, rua);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto) return toast.error("Informe um código de produto válido");
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) return toast.error("Informe a quantidade de caixas por palete");
    const nPaletes = Number(paletes);
    if (!nPaletes || nPaletes <= 0) return toast.error("Informe a quantidade de paletes");
    if (!validade) return toast.error("Informe a validade");
    if (fabricacao && fabricacao > validade)
      return toast.error("A fabricação não pode ser posterior à validade");

    entrada.mutate(
      {
        produto_id: produto.id,
        galpao_id: estrutura.galpaoId,
        area,
        rua,
        quantidade: qtd,
        paletes: nPaletes,
        validade,
        lote,
        data_fabricacao: fabricacao || undefined,
        observacao,
      },
      {
        onSuccess: (novos) => {
          toast.success(
            `${novos.length} palete(s) em ${area}-${rua}: ${novos.map((n) => n.endereco).join(", ")}`,
          );
          setQuantidade("");
          setPaletes("1");
          setLote("");
          setObservacao("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {campo}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Área</label>
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setRua(1);
            }}
            className={inputCls}
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>
                Área {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Rua</label>
          <select value={rua} onChange={(e) => setRua(Number(e.target.value))} className={inputCls}>
            {ruas.map((r) => {
              const dono = produtoDaRua.get(r.rua);
              const bloqueada = !!(produto && dono && dono.produtoId !== produto.id);
              return (
                <option key={r.rua} value={r.rua} disabled={bloqueada}>
                  {area}-{String(r.rua).padStart(2, "0")} ({r.capacidade * r.niveis} posições)
                  {dono ? ` · ${dono.codigo}` : " · livre"}
                  {bloqueada ? " — outro produto" : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground">
        {capacidade - ocupados} endereço(s) livre(s) de {capacidade}
        {ocupanteRua ? ` · rua ocupada por ${ocupanteRua.codigo}` : " · rua livre"}
        {posicaoFefo ? ` · posição FEFO sugerida: ${String(posicaoFefo).padStart(2, "0")}` : ""}
      </p>

      {ruaBloqueada && (
        <p className="rounded-sm border border-dead/40 bg-dead/10 px-2 py-1.5 text-xs text-dead">
          A rua {area}-{String(rua).padStart(2, "0")} já armazena o produto {ocupanteRua?.codigo} —{" "}
          {ocupanteRua?.produto}. Cada rua só pode ter um produto: escolha outra rua.
        </p>
      )}

      {produto && sugestoes.length > 0 && (
        <div className="rounded-sm border border-border p-2">
          <p className={labelCls}>Ruas sugeridas para este produto</p>
          <div className="flex flex-wrap gap-1.5">
            {sugestoes.slice(0, 8).map((s) => (
              <button
                key={`${s.area}-${s.rua}`}
                type="button"
                onClick={() => {
                  setArea(s.area);
                  setRua(s.rua);
                }}
                className={cn(
                  "rounded-sm border px-2 py-1 font-mono text-[11px] transition hover:bg-accent",
                  s.prioridade === 1 ? "border-ok text-ok" : "border-border text-muted-foreground",
                )}
                title={s.prioridade === 1 ? "Já tem este produto" : "Rua vazia"}
              >
                {s.area}-{String(s.rua).padStart(2, "0")} · {s.livres} livre(s)
              </button>
            ))}
          </div>
        </div>
      )}


      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Qtd. de paletes</label>
          <input
            type="number"
            min={1}
            value={paletes}
            onChange={(e) => setPaletes(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Caixas por palete</label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className={inputCls}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Validade</label>
          <input
            type="date"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Fabricação (opcional)</label>
          <input
            type="date"
            value={fabricacao}
            onChange={(e) => setFabricacao(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Lote (opcional)</label>
          <input value={lote} onChange={(e) => setLote(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Observação (opcional)</label>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <button type="submit" className={btnCls} disabled={entrada.isPending}>
        <ArrowDownToLine className="size-4" />
        {entrada.isPending ? "Registrando…" : "Registrar entrada"}
      </button>
      <p className="text-[11px] text-muted-foreground">
        A entrada é feita em uma única transação: ou todos os paletes entram, ou nenhum.
      </p>
    </form>
  );
}

function ListaPrevia({ paletes }: { paletes: PaleteSelecionado[] }) {
  const unidades = paletes.reduce((s, p) => s + p.quantidade, 0);
  return (
    <div className="rounded-sm border border-border">
      <p className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Paletes selecionados
      </p>
      <ul className="max-h-48 divide-y divide-border/60 overflow-auto">
        {paletes.map((p) => (
          <li key={p.id} className="px-3 py-1.5 font-mono text-[11px]">
            {p.codigo} · {p.endereco ?? "sem endereço"} · entrada {dataBR(p.data_entrada)} · val{" "}
            {dataBR(p.validade)} · {p.quantidade} cx
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-3 py-2 font-mono text-[11px]">
        Total: {paletes.length} palete(s) · {unidades} unidade(s)
      </p>
    </div>
  );
}

function FormSaida({ itens }: { itens: ItemEstoque[] }) {
  const estrutura = useEstrutura();
  const saida = useSaidaPorRegra();
  const status = useStatusPalete();
  const politica = estrutura.galpao?.politica_saida ?? "FIFO";
  const [modo, setModo] = useState<"auto" | "manual">(politica === "MANUAL" ? "manual" : "auto");
  const [codigo, setCodigo] = useState("");
  const { produto, campo } = CampoProduto({ codigo, setCodigo });
  const [qtdPaletes, setQtdPaletes] = useState("1");
  const [lote, setLote] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [selecao, setSelecao] = useState<string[]>([]);

  const previa = usePreviaSaida({
    galpaoId: estrutura.galpaoId,
    produtoId: produto?.id,
    paletes: Number(qtdPaletes) || 0,
    lote: lote || undefined,
    ativo: modo === "auto" && politica !== "MANUAL",
  });

  const disponiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => i.status === "disponivel")
      .filter(
        (i) =>
          !q ||
          i.codigo.toLowerCase().includes(q) ||
          i.produto.toLowerCase().includes(q) ||
          (i.lote ?? "").toLowerCase().includes(q) ||
          i.paleteCodigo.toLowerCase().includes(q) ||
          (i.endereco ?? `${i.area}-${i.rua}`).toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [itens, busca]);

  const confirmarAuto = () => {
    if (!estrutura.galpaoId) return;
    if (!produto) return toast.error("Informe o produto");
    const n = Number(qtdPaletes);
    if (!n || n <= 0) return toast.error("Informe a quantidade de paletes");
    saida.mutate(
      {
        galpao_id: estrutura.galpaoId,
        produto_id: produto.id,
        paletes: n,
        lote: lote || undefined,
        observacao,
      },
      {
        onSuccess: (saidos) => {
          toast.success(
            `Saída registrada (${politica}): ${saidos.length} palete(s) — ${saidos.map((s) => s.codigo).join(", ")}`,
          );
          setObservacao("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  const confirmarManual = () => {
    if (!estrutura.galpaoId) return;
    if (selecao.length === 0) return toast.error("Selecione ao menos um palete");
    saida.mutate(
      { galpao_id: estrutura.galpaoId, palete_ids: selecao, observacao },
      {
        onSuccess: (saidos) => {
          toast.success(`Saída registrada: ${saidos.length} palete(s)`);
          setSelecao([]);
          setObservacao("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  const selecionados = itens.filter((i) => selecao.includes(i.id));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(
          [
            ["auto", `Automática (${politica})`],
            ["manual", "Manual"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            disabled={k === "auto" && politica === "MANUAL"}
            onClick={() => setModo(k)}
            className={cn(
              "rounded-sm border px-3 py-1 text-xs transition disabled:opacity-40",
              modo === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {modo === "auto" ? (
        <>
          {campo}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Qtd. de paletes</label>
              <input
                type="number"
                min={1}
                value={qtdPaletes}
                onChange={(e) => setQtdPaletes(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Lote (opcional)</label>
              <input value={lote} onChange={(e) => setLote(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Observação</label>
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {previa.data && previa.data.length > 0 ? (
            <ListaPrevia paletes={previa.data} />
          ) : produto ? (
            <p className="text-xs text-warn">Nenhum palete disponível para este filtro.</p>
          ) : null}

          <button
            type="button"
            className={btnCls}
            onClick={confirmarAuto}
            disabled={saida.isPending || !previa.data?.length}
          >
            <ArrowUpFromLine className="size-4" />
            {saida.isPending ? "Registrando…" : "Confirmar saída"}
          </button>
        </>
      ) : (
        <>
          <div>
            <label className={labelCls}>Buscar palete</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={inputCls}
              placeholder="Produto, lote, palete ou endereço"
            />
          </div>
          <div>
            <label className={labelCls}>Observação (opcional)</label>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="max-h-64 overflow-auto rounded-sm border border-border">
            {disponiveis.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nenhum palete disponível.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {disponiveis.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selecao.includes(i.id)}
                      onChange={(e) =>
                        setSelecao((s) =>
                          e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id),
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {i.codigo} — {i.produto}
                      </p>
                      <p className="truncate font-mono text-muted-foreground">
                        {i.paleteCodigo} · {i.endereco ?? `${i.area}-${i.rua}`} · {i.quantidade} cx ·
                        val {dataBR(i.validade)} · {STATUS_LABEL[statusValidade(i.validade)]}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={status.isPending}
                      onClick={() =>
                        status.mutate(
                          { palete_id: i.id, status: "bloqueado", motivo: "Bloqueio manual" },
                          {
                            onSuccess: () => toast.success(`${i.paleteCodigo} bloqueado`),
                            onError: (err: Error) => toast.error(err.message),
                          },
                        )
                      }
                    >
                      <Lock className="size-3" />
                      Bloquear
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selecionados.length > 0 && (
            <ListaPrevia
              paletes={selecionados.map((i) => ({
                id: i.id,
                codigo: i.paleteCodigo,
                endereco: i.endereco,
                quantidade: i.quantidade,
                validade: i.validade,
                data_entrada: i.dataEntrada,
              }))}
            />
          )}

          <button
            type="button"
            className={btnCls}
            onClick={confirmarManual}
            disabled={saida.isPending || selecao.length === 0}
          >
            <ArrowUpFromLine className="size-4" />
            {saida.isPending ? "Registrando…" : `Confirmar saída (${selecao.length})`}
          </button>
        </>
      )}
    </div>
  );
}

function FormTransferencia({ itens }: { itens: ItemEstoque[] }) {
  const estrutura = useEstrutura();
  const transferir = useTransferencia();
  const [busca, setBusca] = useState("");
  const [paleteId, setPaleteId] = useState("");
  const [areaSel, setArea] = useState("");
  const area = areaSel || estrutura.areas[0] || "";
  const [rua, setRua] = useState(1);
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data: enderecos = [] } = useEnderecos(estrutura.galpaoId, area, rua);
  const livres = enderecos.filter((e) => e.status === "livre" && e.ativo);

  const candidatos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => i.status === "disponivel")
      .filter(
        (i) =>
          !q ||
          i.paleteCodigo.toLowerCase().includes(q) ||
          i.codigo.toLowerCase().includes(q) ||
          (i.endereco ?? "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [itens, busca]);

  const palete = itens.find((i) => i.id === paleteId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!palete) return toast.error("Selecione o palete de origem");
    if (!destino) return toast.error("Selecione o endereço de destino");
    transferir.mutate(
      { palete_id: palete.id, endereco_destino_id: destino, motivo },
      {
        onSuccess: () => {
          toast.success("Transferência concluída");
          setPaleteId("");
          setDestino("");
          setMotivo("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Buscar palete de origem</label>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={inputCls}
          placeholder="Palete, produto ou endereço"
        />
      </div>
      <div className="max-h-40 overflow-auto rounded-sm border border-border">
        {candidatos.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setPaleteId(i.id)}
            className={cn(
              "block w-full truncate px-3 py-1.5 text-left font-mono text-[11px] hover:bg-accent",
              paleteId === i.id && "bg-primary/10",
            )}
          >
            {i.paleteCodigo} · {i.endereco ?? `${i.area}-${i.rua}`} · {i.codigo} · {i.quantidade} cx
          </button>
        ))}
        {candidatos.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhum palete disponível.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Área destino</label>
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setRua(1);
              setDestino("");
            }}
            className={inputCls}
          >
            {estrutura.areas.map((a) => (
              <option key={a} value={a}>
                Área {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Rua destino</label>
          <select
            value={rua}
            onChange={(e) => {
              setRua(Number(e.target.value));
              setDestino("");
            }}
            className={inputCls}
          >
            {estrutura.ruasDaArea(area).map((r) => (
              <option key={r.rua} value={r.rua}>
                {area}-{String(r.rua).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Endereço livre</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls}>
            <option value="">Selecione…</option>
            {livres.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Motivo (opcional)</label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
      </div>

      {palete && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {palete.paleteCodigo}: {palete.endereco ?? `${palete.area}-${palete.rua}`} →{" "}
          {livres.find((l) => l.id === destino)?.codigo ?? "?"}
        </p>
      )}

      <button type="submit" className={btnCls} disabled={transferir.isPending}>
        <MoveRight className="size-4" />
        {transferir.isPending ? "Transferindo…" : "Confirmar transferência"}
      </button>
    </form>
  );
}

function FormAjuste({ itens }: { itens: ItemEstoque[] }) {
  const ajuste = useAjusteInventario();
  const status = useStatusPalete();
  const [busca, setBusca] = useState("");
  const [paleteId, setPaleteId] = useState("");
  const [contagem, setContagem] = useState("");
  const [motivo, setMotivo] = useState("");

  const candidatos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter(
        (i) =>
          !q ||
          i.paleteCodigo.toLowerCase().includes(q) ||
          i.codigo.toLowerCase().includes(q) ||
          (i.endereco ?? "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [itens, busca]);

  const palete = itens.find((i) => i.id === paleteId);
  const diferenca = palete && contagem !== "" ? Number(contagem) - palete.quantidade : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!palete) return toast.error("Selecione o palete contado");
    if (contagem === "" || Number(contagem) < 0) return toast.error("Informe a contagem física");
    if (!motivo.trim()) return toast.error("Informe o motivo do ajuste");
    ajuste.mutate(
      { palete_id: palete.id, quantidade_contada: Number(contagem), motivo },
      {
        onSuccess: () => {
          toast.success("Inventário ajustado");
          setContagem("");
          setMotivo("");
          setPaleteId("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelCls}>Buscar palete</label>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={inputCls}
          placeholder="Palete, produto ou endereço"
        />
      </div>
      <div className="max-h-40 overflow-auto rounded-sm border border-border">
        {candidatos.map((i) => (
          <div key={i.id} className="flex items-center gap-2 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setPaleteId(i.id)}
              className={cn(
                "min-w-0 flex-1 truncate text-left font-mono text-[11px]",
                paleteId === i.id && "text-primary",
              )}
            >
              {i.paleteCodigo} · {i.endereco ?? `${i.area}-${i.rua}`} · {i.quantidade} cx ·{" "}
              {PALETE_STATUS_LABEL[i.status]}
            </button>
            <select
              value={i.status}
              onChange={(e) =>
                status.mutate(
                  { palete_id: i.id, status: e.target.value as PaleteStatus, motivo: "Alteração de situação" },
                  {
                    onSuccess: () => toast.success("Situação atualizada"),
                    onError: (err: Error) => toast.error(err.message),
                  },
                )
              }
              className="rounded-sm border border-border bg-background px-1 py-0.5 text-[10px]"
            >
              {(Object.keys(PALETE_STATUS_LABEL) as PaleteStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PALETE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        ))}
        {candidatos.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum palete.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Contagem física</label>
          <input
            type="number"
            min={0}
            value={contagem}
            onChange={(e) => setContagem(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Motivo</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
        </div>
      </div>

      {palete && (
        <p className="font-mono text-[11px] text-muted-foreground">
          Sistema: {palete.quantidade} · Contagem: {contagem || "—"} ·{" "}
          {diferenca === null ? "—" : `Diferença: ${diferenca > 0 ? "+" : ""}${diferenca}`}
        </p>
      )}

      <button type="submit" className={btnCls} disabled={ajuste.isPending}>
        <ClipboardCheck className="size-4" />
        {ajuste.isPending ? "Ajustando…" : "Registrar ajuste"}
      </button>
    </form>
  );
}

function FormProduto() {
  const criar = useCriarProduto();
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("caixa");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoValido(codigo)) return toast.error(MSG_CODIGO_INVALIDO);
    if (!nome.trim()) return toast.error("Informe o nome do produto");
    criar.mutate(
      { codigo: normalizarCodigo(codigo), nome, descricao, unidade },
      {
        onSuccess: () => {
          toast.success("Produto cadastrado");
          setCodigo("");
          setNome("");
          setDescricao("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Código (tipo + 000 + sabor)</label>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className={inputCls}
            placeholder="0401000089"
            inputMode="numeric"
          />
          {codigo.trim() ? (
            codigoValido(codigo) ? (
              <p className="mt-1 font-mono text-[11px] text-ok">
                {normalizarCodigo(codigo)} · tipo {tipoDoCodigo(codigo)} · sabor{" "}
                {saborDoCodigo(codigo)}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-warn">{MSG_CODIGO_INVALIDO}</p>
            )
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Unidade</label>
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputCls}>
            {["caixa", "fardo", "saco", "unidade"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Descrição (opcional)</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={inputCls}
        />
      </div>
      <button type="submit" className={btnCls} disabled={criar.isPending}>
        <PackagePlus className="size-4" />
        {criar.isPending ? "Salvando…" : "Cadastrar produto"}
      </button>
    </form>
  );
}

const CORES_TIPO: Record<string, string> = {
  entrada: "border-ok/40 bg-ok/15 text-ok",
  saida: "border-warn/40 bg-warn/15 text-warn",
  transferencia: "border-primary/40 bg-primary/15 text-primary",
  ajuste: "border-crit/40 bg-crit/15 text-crit",
  bloqueio: "border-border bg-muted text-muted-foreground",
  desbloqueio: "border-border bg-muted text-muted-foreground",
};

function UltimasMovimentacoes() {
  const { galpaoId } = useEstrutura();
  const { data: movs = [] } = useMovimentacoes(20, galpaoId);

  return (
    <div className="rounded-sm border border-border">
      <p className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Últimas movimentações
      </p>
      {movs.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          Nenhuma movimentação registrada.
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-border/60 overflow-auto">
          {movs.map((m) => (
            <li key={m.id} className="px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded-sm border px-1.5 py-0.5 text-[10px] uppercase",
                    CORES_TIPO[m.tipo] ?? "border-border",
                  )}
                >
                  {m.tipo}
                </span>
                <span className="font-mono text-muted-foreground">
                  {new Date(m.data).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="mt-1 font-medium">
                {m.produtos?.codigo} — {m.produtos?.nome}
              </p>
              <p className="font-mono text-muted-foreground">
                {m.palete_codigo ? `${m.palete_codigo} · ` : ""}
                {m.area}-{String(m.rua).padStart(2, "0")} · pos {m.posicao}
                {m.area_destino
                  ? ` → ${m.area_destino}-${String(m.rua_destino ?? 0).padStart(2, "0")} · pos ${m.posicao_destino}`
                  : ` · ${m.quantidade} cx`}
                {m.lote ? ` · lote ${m.lote}` : ""}
              </p>
              {m.tipo === "ajuste" && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {m.quantidade_anterior} → {(m.quantidade_anterior ?? 0) + m.quantidade}
                </p>
              )}
              {m.usuario && (
                <p className="text-[10px] text-muted-foreground">Registrado por {m.usuario}</p>
              )}
              {(m.motivo || m.observacao) && (
                <p className="text-muted-foreground">{m.motivo ?? m.observacao}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
