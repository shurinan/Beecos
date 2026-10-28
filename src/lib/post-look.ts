import { Bike, Briefcase, HardHat, HeartPulse, House, Scissors, Sparkles, Truck, Wrench, Zap } from "lucide-react";
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

/** Ícones que quem publica pode escolher (a chave é a gravada no banco). */
export const LOOK_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "briefcase", label: "Maleta", Icon: Briefcase },
  { key: "zap", label: "Raio", Icon: Zap },
  { key: "wrench", label: "Chave", Icon: Wrench },
  { key: "sparkles", label: "Brilho", Icon: Sparkles },
  { key: "hard-hat", label: "Capacete", Icon: HardHat },
  { key: "truck", label: "Caminhão", Icon: Truck },
  { key: "heart-pulse", label: "Saúde", Icon: HeartPulse },
  { key: "scissors", label: "Tesoura", Icon: Scissors },
  { key: "bike", label: "Bicicleta", Icon: Bike },
  { key: "house", label: "Casa", Icon: House },
];

/** O ícone escolhido; se não houver, o da profissão. */
export function resolveIcon(key: string | null | undefined, professionName: string | null | undefined): LucideIcon {
  return LOOK_ICONS.find((i) => i.key === key)?.Icon ?? professionIcon(professionName);
}

/** A cor escolhida; se não houver (ou for inválida), a da profissão. */
export function resolveCover(color: string | null | undefined, professionKey: string | null | undefined): string {
  return (COVER_COLORS as readonly string[]).includes(color ?? "") ? (color as string) : coverColor(professionKey);
}
