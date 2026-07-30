import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, PackagePlus } from "lucide-react";
import { statusValidade, STATUS_LABEL, type ItemEstoque } from "@/data/estoque";
import { useEstrutura } from "@/lib/estrutura-queries";

import {
  useCriarProduto,
  useMovimentacoes,
  useProdutos,
  useRegistrarEntrada,
  useRegistrarSaida,
  useRegistrarSaidaLote,
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

type Aba = "entrada" | "saida" | "produto";

export function PainelMovimentacao({ itens }: { itens: ItemEstoque[] }) {
  const [aba, setAba] = useState<Aba>("entrada");

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-semibold tracking-tight">Registro de movimentações</h2>
        <p className="text-xs text-muted-foreground">
          Cadastre produtos e lance entradas e saídas de paletes — os indicadores atualizam
          automaticamente
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
        {(
          [
            ["entrada", "Entrada de palete"],
            ["saida", "Saída de palete"],
            ["produto", "Novo produto"],
          ] as const
        ).map(([k, l]) => (
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
        {aba === "produto" && <FormProduto />}
        <UltimasMovimentacoes />
      </div>
    </section>
  );
}

function FormEntrada({ itens }: { itens: ItemEstoque[] }) {
  const { data: produtos = [] } = useProdutos();
  const entrada = useRegistrarEntrada();
  const [codigo, setCodigo] = useState("");
  const estrutura = useEstrutura();
  const AREAS = estrutura.areas;
  const [areaSel, setArea] = useState("");
  const area = areaSel || AREAS[0] || "";
  const [rua, setRua] = useState(1);
  const [quantidade, setQuantidade] = useState("");
  const [paletes, setPaletes] = useState("1");
  const [validade, setValidade] = useState("");
  const [lote, setLote] = useState("");
  const [observacao, setObservacao] = useState("");

  const ruas = estrutura.ruasDaArea(area);
  const ocupados = itens.filter((i) => i.area === area && i.rua === rua).length;
  const capacidade = estrutura.capacidadeRua(area, rua);


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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto) return toast.error("Informe um código de produto válido");
    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) return toast.error("Informe a quantidade de caixas por palete");
    const nPaletes = Number(paletes);
    if (!nPaletes || nPaletes <= 0) return toast.error("Informe a quantidade de paletes");
    if (nPaletes > capacidade - ocupados)
      return toast.error(`Rua ${area}-${rua} tem apenas ${capacidade - ocupados} posição(ões) livre(s)`);
    if (!validade) return toast.error("Informe a validade");
    entrada.mutate(
      {
        produto_id: produto.id,
        area,
        rua,
        quantidade: qtd,
        validade,
        lote,
        observacao,
        paletes: nPaletes,
      },
      {
        onSuccess: (total) => {
          toast.success(`${total} palete(s) registrado(s) em ${area}-${rua}`);
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
            {ruas.map((r) => (
              <option key={r.rua} value={r.rua}>
                {area}-{String(r.rua).padStart(2, "0")} ({r.capacidade * r.niveis} paletes)
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground">
        Próxima posição livre: {Math.min(ocupados + 1, capacidade)} de {capacidade} ·{" "}
        {capacidade - ocupados} livre(s)
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Qtd. de paletes</label>
          <input
            type="number"
            min={1}
            value={paletes}
            onChange={(e) => setPaletes(e.target.value)}
            className={inputCls}
            placeholder="1"
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

      <div className="grid grid-cols-2 gap-3">
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
    </form>
  );
}

function FormSaida({ itens }: { itens: ItemEstoque[] }) {
  const saida = useRegistrarSaida();
  const saidaLote = useRegistrarSaidaLote();
  const [busca, setBusca] = useState("");
  const [observacao, setObservacao] = useState("");
  const [qtdPaletes, setQtdPaletes] = useState("1");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter(
      (i) =>
        !q ||
        i.codigo.toLowerCase().includes(q) ||
        i.produto.toLowerCase().includes(q) ||
        `${i.area}-${i.rua}`.toLowerCase().includes(q),
    );
  }, [itens, busca]);

  const fifo = filtrados.slice(0, 40);

  const darSaidaEmLote = () => {
    const n = Number(qtdPaletes);
    if (!n || n <= 0) return toast.error("Informe a quantidade de paletes");
    if (!busca.trim()) return toast.error("Filtre por código, produto ou área-rua antes");
    if (n > filtrados.length)
      return toast.error(`Só há ${filtrados.length} palete(s) no filtro atual`);
    saidaLote.mutate(
      { palete_ids: filtrados.slice(0, n).map((i) => i.id), observacao },
      {
        onSuccess: (feitos) => {
          toast.success(`${feitos} palete(s) com saída registrada — ruas reagrupadas`);
          setObservacao("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Buscar palete (ordem FIFO)</label>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={inputCls}
          placeholder="Código, produto ou área-rua"
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

      <div className="rounded-sm border border-border p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Saída por quantidade de paletes (FIFO no filtro acima)
        </p>
        <div className="flex items-end gap-2">
          <div className="w-32">
            <label className={labelCls}>Qtd. de paletes</label>
            <input
              type="number"
              min={1}
              value={qtdPaletes}
              onChange={(e) => setQtdPaletes(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            className={btnCls}
            disabled={saidaLote.isPending}
            onClick={darSaidaEmLote}
          >
            <ArrowUpFromLine className="size-4" />
            {saidaLote.isPending ? "Registrando…" : "Dar saída"}
          </button>
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {filtrados.length} palete(s) no filtro atual
        </p>
      </div>

      <div className="max-h-64 overflow-auto rounded-sm border border-border">
        {fifo.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhum palete em estoque.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {fifo.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div>
                  <p className="font-medium">
                    {i.codigo} — {i.produto}
                  </p>
                  <p className="font-mono text-muted-foreground">
                    {i.area}-{String(i.rua).padStart(2, "0")} · palete {i.posicao} · {i.quantidade}{" "}
                    cx · val{" "}
                    {new Date(i.validade + "T00:00:00Z").toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}{" "}
                    · {STATUS_LABEL[statusValidade(i.validade)]}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] transition hover:bg-accent"
                  disabled={saida.isPending}
                  onClick={() =>
                    saida.mutate(
                      { palete_id: i.id, observacao },
                      {
                        onSuccess: () => {
                          toast.success("Saída registrada — rua reagrupada");
                          setObservacao("");
                        },
                        onError: (err: Error) => toast.error(err.message),
                      },
                    )
                  }
                >
                  <ArrowUpFromLine className="size-3" />
                  Dar saída
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
    if (!codigo.trim() || !nome.trim()) return toast.error("Informe código e nome do produto");
    if (!codigoValido(codigo)) return toast.error(MSG_CODIGO_INVALIDO);
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

function UltimasMovimentacoes() {
  const { data: movs = [] } = useMovimentacoes(20);

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
                    m.tipo === "entrada"
                      ? "border-ok/40 bg-ok/15 text-ok"
                      : "border-warn/40 bg-warn/15 text-warn",
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
                {m.area}-{String(m.rua).padStart(2, "0")} · palete {m.posicao} · {m.quantidade} cx
                {m.lote ? ` · lote ${m.lote}` : ""}
              </p>
              {m.observacao && <p className="text-muted-foreground">{m.observacao}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
