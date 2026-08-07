/** Converte erros técnicos do banco em mensagens que o operador entende. */
const REGRAS: Array<[RegExp, string]> = [
  [/Cada rua só pode ter um produto/i, ""],
  [/duplicate key.*enderecos_codigo_unico/i, "Já existe um endereço com este código nesta área."],

  [/duplicate key.*idx_paletes_endereco_unico/i, "Este endereço já está ocupado."],
  [/duplicate key.*idx_paletes_codigo/i, "Já existe um palete com este código."],
  [/duplicate key.*produtos_codigo/i, "Já existe um produto com este código."],
  [/duplicate key/i, "Este registro já existe."],
  [/violates foreign key/i, "Registro relacionado não encontrado ou ainda em uso."],
  [/violates check constraint.*quantidade/i, "A quantidade informada não é válida."],
  [/row-level security|permission denied/i, "Você não tem permissão para esta operação."],
  [/could not serialize|deadlock/i, "Outra pessoa está movimentando este estoque. Tente de novo."],
  [/jwt|not authenticated/i, "Sua sessão expirou. Entre novamente."],
];

export function traduzErroBanco(erro: unknown): string {
  const msg =
    typeof erro === "string"
      ? erro
      : ((erro as { message?: string } | null)?.message ?? "Não foi possível concluir a operação.");
  for (const [re, texto] of REGRAS) if (re.test(msg)) return texto;
  return msg;
}
