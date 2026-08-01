import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { senhaFraca, traduzir } from "@/lib/admin-mensagens";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  head: () => ({
    meta: [
      { title: "Trocar senha | Controle de Estoque" },
      {
        name: "description",
        content:
          "Defina uma nova senha pessoal para acessar o controle de estoque após uma redefinição feita pelo administrador.",
      },
      { property: "og:title", content: "Trocar senha | Controle de Estoque" },
      {
        property: "og:description",
        content: "Troca obrigatória da senha provisória no primeiro acesso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrocarSenhaPage,
});

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";

function TrocarSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const fraca = senhaFraca(senha);
    if (fraca) return toast.error(fraca);
    if (senha !== confirma) return toast.error("As senhas não conferem");
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: { senha_provisoria: false },
    });
    if (error) {
      setOcupado(false);
      return toast.error(traduzir(error.message));
    }
    await supabase.auth.refreshSession();
    setOcupado(false);
    toast.success("Senha atualizada");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <form onSubmit={salvar} className="space-y-3 rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Defina sua nova senha</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Sua senha atual é provisória (definida pelo administrador). Escolha uma senha pessoal para
          continuar.
        </p>
        <div>
          <label className={labelCls}>Nova senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className={labelCls}>Confirmar senha</label>
          <input
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={ocupado}
          className="inline-flex w-full items-center justify-center rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {ocupado ? "Salvando…" : "Salvar senha"}
        </button>
      </form>
    </main>
  );
}
