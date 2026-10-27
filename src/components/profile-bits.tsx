import { Star } from "lucide-react";
import { levelLabel } from "@/lib/skills";

/** Cinco pontinhos preenchidos até o nível: dá para comparar prestadores num relance. */
export function LevelDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={
            "h-1.5 w-1.5 rounded-full border border-foreground " +
            (n <= level ? "bg-foreground" : "bg-transparent")
          }
        />
      ))}
    </span>
  );
}

export function SkillChip({ skill, level }: { skill: string; level: number }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border-2 border-foreground px-3 py-0.5 text-sm font-semibold"
      title={levelLabel(level)}
    >
      {skill}
      <LevelDots level={level} />
      <span className="sr-only">{levelLabel(level)}</span>
    </span>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex" role="img" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          className={n <= full ? "fill-foreground" : "fill-transparent text-muted-foreground"}
        />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Nota">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            width={28}
            height={28}
            className={n <= value ? "fill-foreground" : "fill-transparent text-muted-foreground"}
          />
        </button>
      ))}
    </div>
  );
}
