import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Layers, Plus, Trash2 } from "lucide-react";
import { usePapel } from "@/lib/auth";
import {
  useAreas,
  useAtualizarRua,
  useCriarArea,
  useCriarGalpao,
  useCriarRuas,
  useEstrutura,
  useExcluirRua,
} from "@/lib/estrutura-queries";
import { posicoesDaRua } from "@/data/estoque";

export const Route = createFileRoute("/_authenticated/estrutura")({
  head: () => ({
    meta: [
      { title: "Estrutura do Galpão | Controle de Estoque" },
      {
        name: "description",
        content:
          "Cadastre galpões, áreas e ruas com capacidade de paletes e níveis — estrutura modular para novos armazéns.",
      },
      { property: "og:title", content: "Estrutura do Galpão | Controle de Estoque" },
      {
        property: "og:description",
        content: "Configuração modular de galpões, áreas, ruas, capacidade e níveis de paletes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EstruturaPage,
});

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";
const btnCls =
  "inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";

function EstruturaPage() {
  const { isAdmin, carregando } = usePapel();
  const { galpoes, galpaoId, galpao, ruas, areas, capacidadeTotal } = useEstrutura();
  const { data: listaAreas = [] } = useAreas(galpaoId);

  if (carregando) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Apenas administradores podem alterar a estrutura do armazém.
      </p>
    );

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-5">
      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="font-semibold tracking-tight">Estrutura modular</h2>
        <p className="text-xs text-muted-foreground">
          {galpao?.nome ?? "—"} · {areas.length} área(s) · {ruas.length} rua(s) ·{" "}
          {capacidadeTotal.toLocaleString("pt-BR")} posições de palete ·{" "}
          {galpoes.length} galpão(ões) cadastrados
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <NovoGalpao />
        <NovaArea galpaoId={galpaoId} />
        <NovasRuas areas={listaAreas} />
      </div>

      <ListaRuas />
    </main>
  );
}

function NovoGalpao() {
  const criar = useCriarGalpao();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim() || !codigo.trim()) return toast.error("Informe nome e código do galpão");
        criar.mutate(
          { nome, codigo },
          {
            onSuccess: () => {
              toast.success("Galpão criado");
              setNome("");
              setCodigo("");
            },
            onError: (e2: Error) => toast.error(e2.message),
          },
        );
      }}
      className="space-y-3 rounded-md border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold">Novo galpão</h3>
      <div>
        <label className={labelCls}>Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Código</label>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className={inputCls}
          placeholder="CD02"
        />
      </div>
      <button className={btnCls} disabled={criar.isPending}>
        <Plus className="size-4" /> Criar galpão
      </button>
    </form>
  );
}

function NovaArea({ galpaoId }: { galpaoId?: string }) {
  const criar = useCriarArea();
  const [nome, setNome] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!galpaoId) return toast.error("Selecione um galpão");
        if (!nome.trim()) return toast.error("Informe o nome da área");
        criar.mutate(
          { galpao_id: galpaoId, nome },
          {
            onSuccess: () => {
              toast.success("Área criada");
              setNome("");
            },
            onError: (e2: Error) => toast.error(e2.message),
          },
        );
      }}
      className="space-y-3 rounded-md border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold">Nova área (galpão selecionado)</h3>
      <div>
        <label className={labelCls}>Nome da área</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={inputCls}
          placeholder="G"
        />
      </div>
      <button className={btnCls} disabled={criar.isPending}>
        <Plus className="size-4" /> Criar área
      </button>
    </form>
  );
}

function NovasRuas({ areas }: { areas: { id: string; nome: string }[] }) {
  const criar = useCriarRuas();
  const [areaId, setAreaId] = useState("");
  const [quantidade, setQuantidade] = useState("10");
  const [capacidade, setCapacidade] = useState("30");
  const [niveis, setNiveis] = useState("1");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const alvo = areaId || areas[0]?.id;
        if (!alvo) return toast.error("Cadastre uma área primeiro");
        criar.mutate(
          {
            area_id: alvo,
            quantidade: Number(quantidade),
            capacidade: Number(capacidade),
            niveis: Number(niveis),
          },
          {
            onSuccess: () => toast.success("Ruas criadas"),
            onError: (e2: Error) => toast.error(e2.message),
          },
        );
      }}
      className="space-y-3 rounded-md border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold">Adicionar ruas em bloco</h3>
      <div>
        <label className={labelCls}>Área</label>
        <select
          value={areaId || areas[0]?.id || ""}
          onChange={(e) => setAreaId(e.target.value)}
          className={inputCls}
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              Área {a.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelCls}>Qtd. ruas</label>
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Paletes/rua</label>
          <input
            type="number"
            min={1}
            value={capacidade}
            onChange={(e) => setCapacidade(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Níveis</label>
          <input
            type="number"
            min={1}
            value={niveis}
            onChange={(e) => setNiveis(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
      <button className={btnCls} disabled={criar.isPending}>
        <Layers className="size-4" /> Criar ruas
      </button>
    </form>
  );
}

function ListaRuas() {
  const { ruas, areas } = useEstrutura();
  const atualizar = useAtualizarRua();
  const excluir = useExcluirRua();
  const [area, setArea] = useState<string>("");
  const areaAtual = area || areas[0] || "";
  const lista = ruas.filter((r) => r.area === areaAtual).sort((a, b) => a.rua - b.rua);

  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h3 className="mr-auto text-sm font-semibold">Ruas cadastradas</h3>
        <select
          value={areaAtual}
          onChange={(e) => setArea(e.target.value)}
          className="rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
        >
          {areas.map((a) => (
            <option key={a} value={a}>
              Área {a}
            </option>
          ))}
        </select>
      </header>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rua</th>
              <th className="px-3 py-2">Paletes por nível</th>
              <th className="px-3 py-2">Níveis</th>
              <th className="px-3 py-2">Posições</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {lista.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5 font-mono">
                  {r.area}-{String(r.rua).padStart(2, "0")}
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={1}
                    defaultValue={r.capacidade}
                    onBlur={(e) =>
                      Number(e.target.value) !== r.capacidade &&
                      atualizar.mutate(
                        { id: r.id, capacidade: Number(e.target.value), niveis: r.niveis },
                        { onError: (er: Error) => toast.error(er.message) },
                      )
                    }
                    className="w-20 rounded-sm border border-input bg-background px-1.5 py-1"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={1}
                    defaultValue={r.niveis}
                    onBlur={(e) =>
                      Number(e.target.value) !== r.niveis &&
                      atualizar.mutate(
                        { id: r.id, capacidade: r.capacidade, niveis: Number(e.target.value) },
                        { onError: (er: Error) => toast.error(er.message) },
                      )
                    }
                    className="w-16 rounded-sm border border-input bg-background px-1.5 py-1"
                  />
                </td>
                <td className="px-3 py-1.5 font-mono">{posicoesDaRua(r)}</td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      excluir.mutate(r.id, { onError: (er: Error) => toast.error(er.message) })
                    }
                    className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] hover:bg-accent"
                  >
                    <Trash2 className="size-3" /> Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
