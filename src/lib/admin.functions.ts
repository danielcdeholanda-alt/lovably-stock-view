import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const novoUsuario = z.object({
  email: z.string().email(),
  senha: z.string().min(8),
  nome: z.string().min(1).max(120),
  role: z.enum(["admin", "operador"]).default("operador"),
});

async function garantirAdmin(supabase: { rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: unknown }> }, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Somente administradores podem fazer isso");
}

/** Público: informa se o sistema ainda não tem nenhum usuário (bootstrap do 1º admin). */
export const precisaBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { precisa: (count ?? 0) === 0 };
});

/** Público apenas enquanto não existir nenhum usuário: cria o primeiro administrador. */
export const criarPrimeiroAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => novoUsuario.omit({ role: true }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("O sistema já possui usuários cadastrados");

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfis, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nome, created_at")
      .order("created_at");
    if (error) throw new Error(error.message);
    const { data: papeis } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: resets } = await supabaseAdmin
      .from("password_resets")
      .select("user_id, created_at")
      .order("created_at", { ascending: false });
    const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    return (perfis ?? []).map((p) => ({
      ...p,
      roles: (papeis ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      ultimoReset: (resets ?? []).find((r) => r.user_id === p.id)?.created_at ?? null,
      senhaProvisoria:
        (lista?.users ?? []).find((u) => u.id === p.id)?.user_metadata?.senha_provisoria === true,
    }));
  });

/** Admin redefine a senha de um usuário. A senha nunca é armazenada nem recuperável depois. */
export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), senha: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await garantirAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: alvo } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!alvo.user) throw new Error("Usuário não encontrado");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
      user_metadata: { ...(alvo.user.user_metadata ?? {}), senha_provisoria: true },
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("password_resets")
      .insert({ admin_id: context.userId, user_id: data.userId });

    return { ok: true };
  });


export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => novoUsuario.parse(input))
  .handler(async ({ data, context }) => {
    await garantirAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome, role: data.role },
    });
    if (error) throw new Error(error.message);
    return { id: criado.user?.id };
  });

export const definirPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "operador"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await garantirAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await garantirAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
