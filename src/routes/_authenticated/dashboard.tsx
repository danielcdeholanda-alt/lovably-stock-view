import { createFileRoute } from "@tanstack/react-router";
import { Kpis } from "@/components/estoque/Kpis";
import { MapaEstoque } from "@/components/estoque/MapaEstoque";
import { Graficos } from "@/components/estoque/Graficos";
import { AlertaFefo } from "@/components/estoque/AlertaFefo";

import { AgrupamentoProdutos } from "@/components/estoque/AgrupamentoProdutos";
import { TabelaEstoque } from "@/components/estoque/TabelaEstoque";
import { PainelMovimentacao } from "@/components/estoque/PainelMovimentacao";
import { useEstoque } from "@/lib/estoque-queries";
import { useEstrutura } from "@/lib/estrutura-queries";
import { HOJE } from "@/data/estoque";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel de Estoque | Mapa de Paletes" },
      {
        name: "description",
        content:
          "Painel de controle de estoque: mapa de paletes por área e rua, ocupação do galpão, curva de validade e lista FIFO das posições.",
      },
      { property: "og:title", content: "Painel de Estoque | Mapa de Paletes" },
      {
        property: "og:description",
        content: "Mapa de paletes por área, rua e posição, com ocupação e alertas de validade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { galpaoId, galpao, areas, carregando } = useEstrutura();
  const { data: itens = [], isLoading, error } = useEstoque(galpaoId);

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {galpao?.nome ?? "Galpão"} · {areas.length} área(s) ·{" "}
          {areas.join(", ") || "sem áreas cadastradas"}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          Referência: {HOJE.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-dead/40 bg-dead/10 px-4 py-3 text-sm text-dead">
          Não foi possível carregar o estoque: {(error as Error).message}
        </p>
      )}

      <Kpis itens={itens} />
      <AlertaFefo />
      <PainelMovimentacao itens={itens} />
      <MapaEstoque itens={itens} />

      <Graficos itens={itens} />
      <AgrupamentoProdutos itens={itens} />
      <TabelaEstoque itens={itens} />
      {(isLoading || carregando) && (
        <p className="text-xs text-muted-foreground">Carregando dados…</p>
      )}
    </main>
  );
}
