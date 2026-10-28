/** Todo post tem um código curto: os 6 últimos caracteres do endereço (chuveiro-queimou-a3f9c1 → A3F9C1). */
export function postCode(slug: string | null | undefined): string | null {
  const m = /-([0-9a-f]{6})$/i.exec(slug ?? "");
  return m?.[1] ? m[1].toUpperCase() : null;
}

/**
 * Se o que foi digitado na busca é um código de vaga, devolve o código em minúsculas.
 * Aceita "A3F9C1", "#a3f9c1", o endereço inteiro ("chuveiro-queimou-a3f9c1") ou o link da vaga.
 */
export function parsePostCode(query: string): string | null {
  let q = query
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  if (/^#[0-9a-f]{6}$/i.test(query.trim())) return query.trim().slice(1).toLowerCase();
  if (/^[0-9a-f]{6}$/.test(q)) return q;
  q = q.split("/").pop() ?? "";
  const m = /^[a-z0-9]+(?:-[a-z0-9]+)*-([0-9a-f]{6})$/.exec(q);
  return m?.[1] ?? null;
}
