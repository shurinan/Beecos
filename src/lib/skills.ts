export type SkillLevel = 1 | 2 | 3;

export type LevelInfo = { level: SkillLevel; label: string; hint: string };

/** Os níveis são declarados pelo próprio profissional. */
export const SKILL_LEVELS: LevelInfo[] = [
  { level: 1, label: "Quase profissional", hint: "Você pode trabalhar com pouca supervisão" },
  { level: 2, label: "Profissional", hint: "Você pode trabalhar sem supervisão" },
  { level: 3, label: "Especialista", hint: "Você pode treinar outros" },
];

export const MAX_LEVEL = 3;
export const MAX_SKILLS = 20;
export const MAX_SKILL_NOTES = 500;

export function levelLabel(level: number): string {
  return SKILL_LEVELS.find((l) => l.level === level)?.label ?? SKILL_LEVELS[0]!.label;
}

export function clampLevel(n: number): SkillLevel {
  const v = Math.round(Number.isFinite(n) ? n : 1);
  return Math.min(MAX_LEVEL, Math.max(1, v)) as SkillLevel;
}

/** O mínimo que o feed precisa para mostrar a melhor habilidade de alguém. */
export type SkillBase = { skill: string; level: number };

/** Habilidade completa, como no formulário "Adicionar habilidade". */
export type ProfileSkill = SkillBase & {
  has_experience: boolean;
  had_training: boolean;
  certified: boolean;
  notes: string;
};

/** Colunas lidas do banco para montar um ProfileSkill. */
export const SKILL_COLUMNS = "skill, level, has_experience, had_training, certified, notes";

/** Mais alto primeiro; empate por nome. */
export function sortSkills<T extends SkillBase>(skills: T[]): T[] {
  return [...skills].sort((a, b) => b.level - a.level || a.skill.localeCompare(b.skill, "pt-BR"));
}

export function topSkill<T extends SkillBase>(skills: T[] | null | undefined): T | null {
  return skills && skills.length > 0 ? sortSkills(skills)[0]! : null;
}

/** Selos mostrados no cartão da habilidade, na ordem do formulário. */
export function skillBadges(
  s: Pick<ProfileSkill, "has_experience" | "had_training" | "certified">,
): string[] {
  const out: string[] = [];
  if (s.has_experience) out.push("Experiência profissional");
  if (s.had_training) out.push("Fez treinamento ou aulas");
  if (s.certified) out.push("Licenciado/certificado");
  return out;
}

// Marcas de acento (U+0300 a U+036F). Em string porque o Prettier reescreve o escape em regex literal.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Nome da habilidade comparado sem acento e sem diferença de maiúsculas, para não duplicar "Pintura"/"pintura". */
export function normalizeSkill(name: string): string {
  return name.trim().normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

export function formatRating(avg: number | string | null | undefined): string {
  const n = Number(avg);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1).replace(".", ",") : "—";
}
