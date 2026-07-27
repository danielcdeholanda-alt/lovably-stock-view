// Regra do código de produto: 4 dígitos de TIPO + "000" + 3 dígitos de SABOR.
// Ex.: 0401 000 089 → tipo "0401", sabor "089".

export const CODIGO_REGEX = /^\d{4}000\d{3}$/;

/** Remove tudo que não é dígito e completa com zeros à esquerda até 10 dígitos. */
export function normalizarCodigo(codigo: string): string {
  const digitos = (codigo ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.length < 10 ? digitos.padStart(10, "0") : digitos;
}

export function codigoValido(codigo: string): boolean {
  return CODIGO_REGEX.test(normalizarCodigo(codigo));
}

export function tipoDoCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo);
  return CODIGO_REGEX.test(c) ? c.slice(0, 4) : "—";
}

export function saborDoCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo);
  return CODIGO_REGEX.test(c) ? c.slice(7) : "—";
}

/** Exibe o código segmentado: 0401·000·089 */
export function formatarCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo);
  if (!CODIGO_REGEX.test(c)) return codigo;
  return `${c.slice(0, 4)}·000·${c.slice(7)}`;
}

export const MSG_CODIGO_INVALIDO =
  'Código inválido. Use 4 dígitos de tipo + "000" + 3 dígitos de sabor (ex.: 0401000089).';
