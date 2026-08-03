import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { criarPrimeiroAdmin, precisaBootstrap } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({

  head: () => ({
    meta: [
      { title: "Entrar | Controle de Estoque FIFO" },
      {
        name: "description",
        content:
          "Acesso restrito ao painel de controle de estoque: entre com e-mail e senha para ver o mapa de paletes e registrar movimentações.",
      },
      { property: "og:title", content: "Entrar | Controle de Estoque FIFO" },
      {
        property: "og:description",
        content: "Login do sistema de controle de estoque por paletes (áreas, ruas e validade).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";
const btnCls =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";

function AuthPage() {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState<boolean | null>(null);
  const [modo, setModo] = useState<"login" | "recuperar">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    precisaBootstrap()
      .then((r) => setBootstrap(r.precisa))
      .catch(() => setBootstrap(false));
  }, [navigate]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setOcupado(false);
    if (error) return toast.error("E-mail ou senha inválidos");
    navigate({ to: "/dashboard", replace: true });
  };

  const recuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    const alvo = email.trim();
    if (!alvo) return toast.error("Informe seu e-mail");
    setOcupado(true);
    // Resposta sempre neutra: não revelamos se o e-mail existe.
    await supabase.auth
      .resetPasswordForEmail(alvo, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      .catch(() => undefined);
    setOcupado(false);
    setEnviado(true);
  };

  const criarAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    try {
      await criarPrimeiroAdmin({ data: { email: email.trim(), senha, nome } });
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) throw new Error(error.message);
      toast.success("Administrador criado");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const recuperando = modo === "recuperar" && !bootstrap;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Warehouse className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-bold uppercase tracking-wide">Controle de Estoque</h1>
            <p className="text-xs text-muted-foreground">
              {bootstrap
                ? "Crie o primeiro administrador"
                : recuperando
                  ? "Recuperar acesso"
                  : "Acesso restrito"}
            </p>
          </div>
        </div>

        {recuperando ? (
          enviado ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Se o e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.
              </p>
              <button
                type="button"
                className={btnCls}
                onClick={() => {
                  setEnviado(false);
                  setModo("login");
                }}
              >
                Voltar
              </button>
            </div>
          ) : (
            <form onSubmit={recuperar} className="space-y-3">
              <div>
                <label className={labelCls}>E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  autoComplete="email"
                />
              </div>
              <button type="submit" className={btnCls} disabled={ocupado}>
                {ocupado ? "Enviando…" : "Enviar instruções"}
              </button>
              <button
                type="button"
                onClick={() => setModo("login")}
                className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Voltar
              </button>
            </form>
          )
        ) : (
          <form onSubmit={bootstrap ? criarAdmin : entrar} className="space-y-3">
            {bootstrap && (
              <div>
                <label className={labelCls}>Nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
              </div>
            )}
            <div>
              <label className={labelCls}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                autoComplete="email"
              />
            </div>
            <div>
              <label className={labelCls}>Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={inputCls}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className={btnCls} disabled={ocupado}>
              {ocupado ? "Aguarde…" : bootstrap ? "Criar administrador" : "Entrar"}
            </button>
            {!bootstrap && (
              <button
                type="button"
                onClick={() => setModo("recuperar")}
                className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Esqueci minha senha
              </button>
            )}
          </form>
        )}

        {!bootstrap && !recuperando && (
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Cadastro fechado — solicite uma conta ao administrador do sistema.
          </p>
        )}
      </div>
    </main>
  );
}

