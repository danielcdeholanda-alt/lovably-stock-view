import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PALETE_STATUS_LABEL, type ItemEstoque } from "@/data/estoque";
import { useEnderecos, useSaidaPorRegra, useTransferencia } from "@/lib/estoque-queries";
import { useEstrutura } from "@/lib/estrutura-queries";

type Acao = "menu" | "retirar" | "transferir";

export function AcoesPalete({
  item,
  aberto,
  onFechar,
}: {
  item: ItemEstoque | null;
  aberto: boolean;
  onFechar: () => void;
}) {
  const [acao, setAcao] = useState<Acao>("menu");

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) {
          setAcao("menu");
          onFechar();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        {item && (
          <Conteudo item={item} acao={acao} setAcao={setAcao} onConcluir={onFechar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  item,
  acao,
  setAcao,
  onConcluir,
}: {
  item: ItemEstoque;
  acao: Acao;
  setAcao: (a: Acao) => void;
  onConcluir: () => void;
}) {
  const disponivel = item.status === "disponivel";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-mono text-base">{item.paleteCodigo}</DialogTitle>
        <DialogDescription>
          {item.codigo} — {item.produto}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Campo
          label="Endereço"
          valor={item.endereco ?? `${item.area}-${item.rua} · palete ${item.posicao}`}
        />
        <Campo label="Quantidade" valor={`${item.quantidade} caixas`} />
        <Campo label="Lote" valor={item.lote ?? "—"} />
        <Campo
          label="Validade"
          valor={new Date(item.validade + "T00:00:00Z").toLocaleDateString("pt-BR")}
        />
        <Campo label="Situação" valor={PALETE_STATUS_LABEL[item.status]} />
        <Campo
          label="Entrada"
          valor={new Date(item.dataEntrada).toLocaleDateString("pt-BR")}
        />
      </div>

      {!disponivel && (
        <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          Este palete está {PALETE_STATUS_LABEL[item.status].toLowerCase()}. Desbloqueie no painel
          de movimentação antes de retirar ou transferir.
        </p>
      )}

      {acao === "menu" && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={!disponivel} onClick={() => setAcao("retirar")}>
            Retirar palete
          </Button>
          <Button
            variant="secondary"
            disabled={!disponivel}
            onClick={() => setAcao("transferir")}
          >
            Transferir palete
          </Button>
        </div>
      )}

      {acao === "retirar" && (
        <FormRetirada item={item} onVoltar={() => setAcao("menu")} onConcluir={onConcluir} />
      )}
      {acao === "transferir" && (
        <FormTransferencia item={item} onVoltar={() => setAcao("menu")} onConcluir={onConcluir} />
      )}
    </>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}

function FormRetirada({
  item,
  onVoltar,
  onConcluir,
}: {
  item: ItemEstoque;
  onVoltar: () => void;
  onConcluir: () => void;
}) {
  const { galpaoId } = useEstrutura();
  const [observacao, setObservacao] = useState("");
  const saida = useSaidaPorRegra();

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-sm">
        Confirmar a saída do palete <span className="font-mono">{item.paleteCodigo}</span> do
        endereço{" "}
        <span className="font-mono">
          {item.endereco ?? `${item.area}-${item.rua}-${item.posicao}`}
        </span>
        ?
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="obs-retirada">Observação (opcional)</Label>
        <Input
          id="obs-retirada"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: pedido 1234"
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!galpaoId || saida.isPending}
          onClick={() => {
            if (!galpaoId) return;
            saida.mutate(
              { galpao_id: galpaoId, palete_ids: [item.id], observacao },
              {
                onSuccess: () => {
                  toast.success(`Palete ${item.paleteCodigo} retirado.`);
                  onConcluir();
                },
                onError: (e) => toast.error((e as Error).message),
              },
            );
          }}
        >
          {saida.isPending ? "Retirando…" : "Confirmar retirada"}
        </Button>
        <Button variant="ghost" onClick={onVoltar}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

function FormTransferencia({
  item,
  onVoltar,
  onConcluir,
}: {
  item: ItemEstoque;
  onVoltar: () => void;
  onConcluir: () => void;
}) {
  const estrutura = useEstrutura();
  const [area, setArea] = useState(item.area);
  const [rua, setRua] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const transferir = useTransferencia();

  const ruas = estrutura.ruasDaArea(area);
  const { data: enderecos = [], isLoading } = useEnderecos(
    estrutura.galpaoId,
    area,
    rua ? Number(rua) : undefined,
  );
  const livres = enderecos.filter((e) => e.ativo && e.status === "livre");

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Área de destino</Label>
          <Select
            value={area}
            onValueChange={(v) => {
              setArea(v);
              setRua("");
              setDestino("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              {estrutura.areas.map((a) => (
                <SelectItem key={a} value={a}>
                  Área {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Rua de destino</Label>
          <Select
            value={rua}
            onValueChange={(v) => {
              setRua(v);
              setDestino("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Rua" />
            </SelectTrigger>
            <SelectContent>
              {ruas.map((r) => (
                <SelectItem key={r.id} value={String(r.rua)}>
                  Rua {r.rua}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Endereço livre</Label>
        <Select value={destino} onValueChange={setDestino} disabled={!rua || isLoading}>
          <SelectTrigger>
            <SelectValue
              placeholder={
                !rua ? "Escolha a rua" : isLoading ? "Carregando…" : "Selecione o endereço"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {livres.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.codigo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rua && !isLoading && livres.length === 0 && (
          <p className="text-xs text-muted-foreground">Não há endereços livres nesta rua.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="motivo-transf">Motivo (opcional)</Label>
        <Input
          id="motivo-transf"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: reorganização da rua"
        />
      </div>

      <div className="flex gap-2">
        <Button
          disabled={!destino || transferir.isPending}
          onClick={() =>
            transferir.mutate(
              { palete_id: item.id, endereco_destino_id: destino, motivo },
              {
                onSuccess: () => {
                  toast.success(`Palete ${item.paleteCodigo} transferido.`);
                  onConcluir();
                },
                onError: (e) => toast.error((e as Error).message),
              },
            )
          }
        >
          {transferir.isPending ? "Transferindo…" : "Confirmar transferência"}
        </Button>
        <Button variant="ghost" onClick={onVoltar}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
