/** O que falta numa publicação para ela funcionar bem (aparece só para quem publicou). */
export type PostGapInput = {
  kind: string;
  profession_id?: string | null;
  description?: string | null;
  hasLocation: boolean;
};

export function postGaps(p: PostGapInput): string[] {
  const gaps: string[] = [];
  if (p.kind === "job") {
    if (!p.hasLocation) gaps.push("local (sem ele ninguém é avisado e a distância não aparece)");
    if (!p.profession_id) gaps.push("profissão (sem ela a vaga não gera avisos)");
  }
  if (!p.description || !p.description.trim()) gaps.push("descrição");
  return gaps;
}
