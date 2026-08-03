import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { senhaFraca, traduzir } from "@/lib/admin-mensagens";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha | Controle de Estoque" },
      {
        name: "description",
        content:
          "Defina uma nova senha de acesso ao controle de estoque usando o link de recuperação enviado por e-mail.",
      },
      { property: "og:title", content: "Redefinir senha | Controle de Estoque" },
      {
        property: "og:description",
        content: "Página segura para criar uma nova senha a partir do link de recuperação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RedefinirSenhaPage,
});

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";
const btnCls =
  "inline-flex w-full items-center justify-center rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";

type Estado = "verificando" | "valido" | "invalido" | "concluido";

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    // Erro devolvido pelo link (expirado/já usado) vem no fragmento da URL.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error") || hash.get("error_description")) {
      setEstado("invalido");
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY" || (evento === "SIGNED_IN" && sessao)) {
        setEstado((e) => (e === "concluido" ? e : "valido"));
      }
    });

    const timer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setEstado((e) => (e === "verificando" ? (data.session ? "valido" : "invalido") : e));
    }, 1200);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const fraca = senhaFraca(senha);
    if (fraca) return toast.error(fraca);
    if (senha !== confirma) return toast.error("As senhas não conferem");

    setOcupado(true);
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setOcupado(false);
      setEstado("invalido");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: { senha_provisoria: false },
    });
    setOcupado(false);
    if (error) return toast.error(traduzir(error.message));

    setEstado("concluido");
    toast.success("Senha redefinida");
    await supabase.auth.signOut();
    window.history.replaceState(null, "", window.location.pathname);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h1 className="text-sm font-semibold">Redefinir senha</h1>
        </div>

        {estado === "verificando" && (
          <p className="text-xs text-muted-foreground">Validando o link de recuperação…</p>
        )}

        {estado === "invalido" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Este link de recuperação é inválido ou expirou. Solicite uma nova redefinição de
              senha.
            </p>
            <button
              type="button"
              className={btnCls}
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Voltar ao login
            </button>
          </div>
        )}

        {estado === "concluido" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Senha redefinida com sucesso. Entre novamente com a nova senha.
            </p>
            <button
              type="button"
              className={btnCls}
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Ir para o login
            </button>
          </div>
        )}

        {estado === "valido" && (
          <form onSubmit={salvar} className="space-y-3">
            <div>
              <label className={labelCls}>Nova senha</label>
              <input
                type="password"
                value={senha}
                onChange={(ev) => setSenha(ev.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls}>Confirmar nova senha</label>
              <input
                type="password"
                value={confirma}
                onChange={(ev) => setConfirma(ev.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className={btnCls} disabled={ocupado}>
              {ocupado ? "Salvando…" : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
