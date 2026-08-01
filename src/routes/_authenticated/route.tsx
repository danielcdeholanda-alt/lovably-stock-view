import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePapel } from "@/lib/auth";
import { EstruturaProvider, useEstrutura } from "@/lib/estrutura-queries";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (
      data.user.user_metadata?.senha_provisoria === true &&
      location.pathname !== "/trocar-senha"
    ) {
      throw redirect({ to: "/trocar-senha" });
    }
    return { user: data.user };
  },
  component: Layout,
});


function Layout() {
  return (
    <EstruturaProvider>
      <div className="min-h-screen bg-background">
        <Cabecalho />
        <Outlet />
      </div>
    </EstruturaProvider>
  );
}

function Cabecalho() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session, isAdmin } = usePapel();
  const { galpoes, galpaoId, setGalpaoId } = useEstrutura();

  const sair = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <Warehouse className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-bold uppercase tracking-wide">Controle de Estoque</h1>
            <p className="text-xs text-muted-foreground">{session?.user.email}</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-xs">
          {galpoes.length > 0 && (
            <select
              value={galpaoId ?? ""}
              onChange={(e) => setGalpaoId(e.target.value)}
              className="rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
              aria-label="Galpão"
            >
              {galpoes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          )}
          <Link
            to="/dashboard"
            className="rounded-sm border border-border px-3 py-1.5 transition hover:bg-accent [&.active]:border-primary [&.active]:text-primary"
          >
            Painel
          </Link>
          {isAdmin && (
            <>
              <Link
                to="/estrutura"
                className="rounded-sm border border-border px-3 py-1.5 transition hover:bg-accent [&.active]:border-primary [&.active]:text-primary"
              >
                Estrutura
              </Link>
              <Link
                to="/usuarios"
                className="rounded-sm border border-border px-3 py-1.5 transition hover:bg-accent [&.active]:border-primary [&.active]:text-primary"
              >
                Usuários
              </Link>
            </>
          )}
          <Link
            to="/trocar-senha"
            className="rounded-sm border border-border px-3 py-1.5 transition hover:bg-accent [&.active]:border-primary [&.active]:text-primary"
          >
            Trocar senha
          </Link>
          <button
            type="button"
            onClick={sair}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 transition hover:bg-accent"
          >
            <LogOut className="size-3.5" />
            Sair
          </button>
        </nav>
      </div>
    </header>
  );
}
