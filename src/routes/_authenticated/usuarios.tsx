import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Trash2, KeyRound, Copy, RefreshCw } from "lucide-react";
import { usePapel } from "@/lib/auth";
import { senhaFraca } from "@/lib/admin-mensagens";
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
  const { isAdmin, carregando, session } = usePapel();
  const meuId = session?.user.id;
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
          const fraca = senhaFraca(senha);
          if (fraca) return toast.error(fraca);
          if (!nome.trim()) return toast.error("Informe o nome do usuário");
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
          <table className="w-full min-w-[560px] text-xs">
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
                <tr key={u.id} className="align-top">
                  <td className="px-3 py-2">
                    {u.nome}
                    {u.senhaProvisoria && (
                      <span className="ml-1 rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                        senha provisória
                      </span>
                    )}
                  </td>
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
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {u.id === meuId && (
                        <span className="rounded-sm border border-border px-2 py-1 text-[11px] text-muted-foreground">
                          Sua conta
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={u.id === meuId}
                        title={
                          u.id === meuId
                            ? "Use a tela “Trocar senha” para alterar a sua própria senha"
                            : undefined
                        }
                        onClick={() => {
                          setSenhaGerada(null);
                          setNovaSenha(gerarSenha());
                          setResetAlvo(resetAlvo === u.id ? null : u.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40"
                      >
                        <KeyRound className="size-3" /> Redefinir senha
                      </button>
                      <button
                        type="button"
                        disabled={u.id === meuId}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Excluir definitivamente o usuário ${u.nome ?? u.email}? Esta ação não pode ser desfeita.`,
                            )
                          )
                            return;
                          remover.mutate(u.id, {
                            onSuccess: () => toast.success("Usuário excluído"),
                            onError: (er: Error) => toast.error(er.message),
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40"
                      >
                        <Trash2 className="size-3" /> Excluir
                      </button>
                    </div>

                    {resetAlvo === u.id && (
                      <div className="mt-2 space-y-2 rounded-sm border border-border bg-background p-2 text-left">
                        <div className="flex gap-1">
                          <input
                            value={novaSenha}
                            onChange={(e) => setNovaSenha(e.target.value)}
                            className="w-full rounded-sm border border-input bg-background px-2 py-1 font-mono text-[11px]"
                            aria-label="Nova senha provisória"
                          />
                          <button
                            type="button"
                            onClick={() => setNovaSenha(gerarSenha())}
                            className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] hover:bg-accent"
                          >
                            <RefreshCw className="size-3" /> Gerar
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={resetar.isPending}
                          onClick={() => {
                            const fraca = senhaFraca(novaSenha);
                            if (fraca) return toast.error(fraca);
                            if (
                              !window.confirm(
                                `Redefinir a senha de ${u.nome ?? u.email}? As sessões abertas dele serão encerradas.`,
                              )
                            )
                              return;
                            resetar.mutate(
                              { userId: u.id, senha: novaSenha },
                              {
                                onSuccess: () => {
                                  setSenhaGerada({ userId: u.id, senha: novaSenha });
                                  setResetAlvo(null);
                                  toast.success("Senha redefinida");
                                },
                                onError: (er: Error) => toast.error(er.message),
                              },
                            );
                          }}
                          className="rounded-sm bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Confirmar redefinição
                        </button>
                      </div>
                    )}

                    {senhaGerada?.userId === u.id && (
                      <div className="mt-2 rounded-sm border border-primary/40 bg-primary/5 p-2 text-left">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Senha provisória — anote agora, ela não será exibida novamente
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="font-mono text-xs">{senhaGerada.senha}</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(senhaGerada.senha);
                              toast.success("Senha copiada");
                            }}
                            className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
                          >
                            <Copy className="size-3" /> Copiar
                          </button>
                          <button
                            type="button"
                            onClick={() => setSenhaGerada(null)}
                            className="text-[10px] text-muted-foreground underline"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    )}

                    {u.ultimoReset && (
                      <p className="mt-1 text-right text-[10px] text-muted-foreground">
                        Última redefinição: {new Date(u.ultimoReset).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
              {usuarios.isSuccess && (usuarios.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum usuário cadastrado ainda.
                  </td>
                </tr>
              )}
              {usuarios.isLoading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Carregando usuários…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
