## Sobre ver a senha

Não é possível mostrar a senha de um usuário: o sistema nunca guarda a senha em texto — só um hash irreversível. Guardar senhas legíveis seria uma falha grave de segurança (qualquer vazamento entregaria todas as contas) e nem o administrador consegue lê-las.

A solução prática para o mesmo problema (operador esqueceu a senha) é o administrador **redefinir** a senha na hora.

## O que vou implementar

### 1. Redefinir senha pelo administrador (tela Usuários)

- Em cada linha da lista de usuários, botão **"Redefinir senha"**.
- Abre um campo com a nova senha provisória: o admin digita a que quiser ou clica em **"Gerar"** para criar uma senha aleatória forte.
- Ao confirmar, a senha é trocada imediatamente e mostrada na tela uma única vez, com botão **"Copiar"**, para o admin repassar ao operador.
- A senha só aparece nesse momento; ao fechar/recarregar, não é mais recuperável (só é possível gerar outra).

### 2. Troca obrigatória no primeiro acesso (opcional, incluído)

- Senha definida pelo admin é marcada como provisória; no próximo login o operador é levado a uma tela para escolher a própria senha antes de usar o sistema.

### 3. Registro de auditoria

- Cada redefinição fica registrada (quem redefiniu, para quem, quando), visível para o admin.

## Detalhes técnicos

- Nova server function `redefinirSenha` em `src/lib/admin.functions.ts`, com `requireSupabaseAuth` + verificação de papel admin via `has_role`, usando `supabaseAdmin.auth.admin.updateUserById` (importado dentro do handler).
- Marcação de senha provisória em `user_metadata.senha_provisoria`; tela `/_authenticated/trocar-senha` e verificação no layout protegido para redirecionar enquanto a marca existir; `supabase.auth.updateUser` limpa a marca.
- Tabela `password_resets` (admin_id, user_id, criado_em) com RLS: SELECT/INSERT apenas para admin via `has_role`, mais GRANTs para `authenticated` e `service_role`. Nenhuma senha é gravada nessa tabela.
- UI em `src/routes/_authenticated/usuarios.tsx`: botão por linha, gerador de senha aleatória no cliente e exibição única com cópia.
