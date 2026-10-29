/** Deixa só os números do CPF (até 11). */
export function cpfDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

/** 000.000.000-00 enquanto a pessoa digita. */
export function formatCpf(raw: string): string {
  const d = cpfDigits(raw);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** Confere os dois dígitos verificadores. */
export function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}
