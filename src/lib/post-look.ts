import { Bike, Briefcase, HardHat, HeartPulse, Scissors, Sparkles, Truck, Wrench, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Cores de capa do card (pastéis do Beecos; o texto sobre elas é sempre escuro). */
export const COVER_COLORS = ["#F9C80E", "#7FC8A9", "#8FB8F0", "#F2A48B", "#C9B5F0"] as const;
export const FILLED_COVER = "#D9D7CC";

/** Mesma chave, mesma cor: a capa não muda de uma visita para a outra. */
export function coverColor(key: string | null | undefined): string {
  const k = key ?? "";
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return COVER_COLORS[h % COVER_COLORS.length]!;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const RULES: [RegExp, LucideIcon][] = [
  [/eletric|eletron/, Zap],
  [/encanad|hidraul|bombeir|cano/, Wrench],
  [/limpez|faxin|diarista|lavand|jardin/, Sparkles],
  [/obra|pedrei|pintor|reform|construc|gesso|azulej|telhad|marceneir|carpint/, HardHat],
  [/mudanc|frete|carret|transport|motorist/, Truck],
  [/saude|enferm|optom|cuidador|fisio|medic|dentis|psicol|nutri/, HeartPulse],
  [/beleza|cabel|barbeir|manicur|maquia|estetic|depila/, Scissors],
  [/entrega|motoboy|ciclist|courier/, Bike],
];

/** Ícone do card a partir do nome da profissão; sem correspondência, uma maleta. */
export function professionIcon(name: string | null | undefined): LucideIcon {
  const n = norm(name ?? "");
  for (const [re, icon] of RULES) if (re.test(n)) return icon;
  return Briefcase;
}
