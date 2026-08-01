import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Trash2, KeyRound, Copy, RefreshCw } from "lucide-react";
import { usePapel } from "@/lib/auth";
import {
  criarUsuario,
  definirPapel,
  excluirUsuario,
  listarUsuarios,
  redefinirSenha,
} from "@/lib/admin.functions";

function gerarSenha(tamanho = 12) {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(tamanho);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}


export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários | Controle de Estoque" },
      {
        name: "description",
        content:
          "Gerencie contas de acesso ao controle de estoque: crie usuários administradores ou operadores e defina permissões.",
      },
      { property: "og:title", content: "Usuários | Controle de Estoque" },
      {
        property: "og:description",
        content: "Cadastro fechado: administradores criam contas de operadores do armazém.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsuariosPage,
});

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";
const btnCls =
  "inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";

function UsuariosPage() {
  const { isAdmin, carregando } = usePapel();
  const qc = useQueryClient();
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: () => listarUsuarios(), enabled: isAdmin });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["usuarios"] });

  const criar = useMutation({
    mutationFn: (p: { email: string; senha: string; nome: string; role: "admin" | "operador" }) =>
      criarUsuario({ data: p }),
    onSuccess: invalidar,
  });
  const papel = useMutation({
    mutationFn: (p: { userId: string; role: "admin" | "operador" }) => definirPapel({ data: p }),
    onSuccess: invalidar,
  });
  const remover = useMutation({
    mutationFn: (userId: string) => excluirUsuario({ data: { userId } }),
    onSuccess: invalidar,
  });
  const resetar = useMutation({
    mutationFn: (p: { userId: string; senha: string }) => redefinirSenha({ data: p }),
    onSuccess: invalidar,
  });

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");
  const [resetAlvo, setResetAlvo] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<{ userId: string; senha: string } | null>(null);


  if (carregando) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Apenas administradores podem gerenciar usuários.
      </p>
    );

  return (
    <main className="mx-auto grid max-w-[1200px] gap-4 px-4 py-5 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (senha.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres");
          criar.mutate(
            { email, senha, nome, role },
            {
              onSuccess: () => {
                toast.success("Usuário criado");
                setEmail("");
                setSenha("");
                setNome("");
              },
              onError: (e2: Error) => toast.error(e2.message),
            },
          );
        }}
        className="space-y-3 rounded-md border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Novo usuário</h2>
        <div>
          <label className={labelCls}>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Senha provisória</label>
          <input
            type="text"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Papel</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "operador")}
            className={inputCls}
          >
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button className={btnCls} disabled={criar.isPending}>
          <UserPlus className="size-4" /> Criar usuário
        </button>
      </form>

      <section className="rounded-md border border-border bg-card">
        <header className="border-b border-border px-4 py-3 text-sm font-semibold">
          Usuários do sistema
        </header>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Papel</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(usuarios.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.nome}</td>
                  <td className="px-3 py-2 font-mono">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.roles.includes("admin") ? "admin" : "operador"}
                      onChange={(e) =>
                        papel.mutate(
                          { userId: u.id, role: e.target.value as "admin" | "operador" },
                          { onError: (er: Error) => toast.error(er.message) },
                        )
                      }
                      className="rounded-sm border border-input bg-background px-1.5 py-1"
                    >
                      <option value="operador">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        remover.mutate(u.id, { onError: (er: Error) => toast.error(er.message) })
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
    </main>
  );
}
