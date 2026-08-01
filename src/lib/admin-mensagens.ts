/** Traduz mensagens de erro do serviço de autenticação para português. */
export function traduzir(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("already been registered") || m.includes("already exists"))
    return "Já existe um usuário com este e-mail.";
  if (m.includes("invalid email")) return "E-mail inválido.";
  if (m.includes("password should be at least"))
    return "A senha deve ter ao menos 8 caracteres.";
  if (m.includes("weak password") || m.includes("pwned") || m.includes("compromised"))
    return "Senha muito fraca ou vazada em outros sites. Escolha outra.";
  if (m.includes("user not found")) return "Usuário não encontrado.";
  if (m.includes("same password"))
    return "A nova senha precisa ser diferente da senha atual.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Aguarde alguns instantes e tente de novo.";
  return mensagem;
}

/** Recusa senhas óbvias (repetidas, sequenciais ou só números). */
export function senhaFraca(senha: string): string | null {
  if (senha.length < 8) return "A senha deve ter ao menos 8 caracteres.";
  if (/^\d+$/.test(senha)) return "Use letras e números, não apenas números.";
  if (/^(.)\1+$/.test(senha)) return "A senha não pode ser um único caractere repetido.";
  if (/^(?:0123456789|123456|12345678|abcdef|senha|password|qwerty)/i.test(senha))
    return "Essa senha é fácil de adivinhar. Escolha outra.";
  return null;
}
