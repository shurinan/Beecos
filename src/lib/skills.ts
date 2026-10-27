export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export type LevelInfo = { level: SkillLevel; label: string; hint: string };

/** 1 = "Sei fazer" … 5 = "Profissional certificado". Os níveis são declarados pelo próprio prestador. */
export const SKILL_LEVELS: LevelInfo[] = [
  { level: 1, label: "Sei fazer", hint: "Já fiz algumas vezes" },
  { level: 2, label: "Tenho prática", hint: "Faço com regularidade" },
  { level: 3, label: "Experiente", hint: "Vários anos de serviço" },
  { level: 4, label: "Especialista", hint: "Resolvo casos difíceis" },
  { level: 5, label: "Profissional certificado", hint: "Curso ou certificado na área" },
];

export const MAX_SKILLS = 20;

export function levelLabel(level: number): string {
  return SKILL_LEVELS.find((l) => l.level === level)?.label ?? SKILL_LEVELS[0]!.label;
}

export function clampLevel(n: number): SkillLevel {
  const v = Math.round(Number.isFinite(n) ? n : 1);
  return Math.min(5, Math.max(1, v)) as SkillLevel;
}

export type ProfileSkill = { skill: string; level: number };

/** Mais alto primeiro; empate por nome. */
export function sortSkills<T extends ProfileSkill>(skills: T[]): T[] {
  return [...skills].sort((a, b) => b.level - a.level || a.skill.localeCompare(b.skill, "pt-BR"));
}

export function topSkill<T extends ProfileSkill>(skills: T[] | null | undefined): T | null {
  return skills && skills.length > 0 ? sortSkills(skills)[0]! : null;
}

/** Nome da habilidade comparado sem acento e sem diferença de maiúsculas, para não duplicar "Pintura"/"pintura". */
export function normalizeSkill(name: string): string {
  return name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function formatRating(avg: number | string | null | undefined): string {
  const n = Number(avg);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1).replace(".", ",") : "—";
}
