import { createFileRoute } from "@tanstack/react-router";
import { Kpis } from "@/components/estoque/Kpis";
import { MapaEstoque } from "@/components/estoque/MapaEstoque";
import { Graficos } from "@/components/estoque/Graficos";
import { TabelaEstoque } from "@/components/estoque/TabelaEstoque";
import { ITENS, HOJE } from "@/data/estoque";
import { Warehouse } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Estoque FIFO | Mapa de Paletes" },
      {
        name: "description",
        content:
          "Painel de controle de estoque: mapa de paletes por área e rua, ocupação do armazém, curva de validade e lista FIFO das posições.",
      },
      { property: "og:title", content: "Controle de Estoque FIFO | Mapa de Paletes" },
      {
        property: "og:description",
        content:
          "Mapa de estoque por área, rua e posição de palete, com ocupação e alertas de validade em um só painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});


function Index() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Warehouse className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold uppercase tracking-wide">
                Controle de Estoque · FIFO
              </h1>
              <p className="text-xs text-muted-foreground">
                Mapa de estoque — 43 armários × 6 níveis · base FIFO-01
              </p>
            </div>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Referência: {HOJE.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </p>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-5">
        <Kpis itens={ITENS} />
        <MapaEstoque itens={ITENS} />
        <Graficos itens={ITENS} />
        <TabelaEstoque itens={ITENS} />
      </div>
    </main>
  );
}
