import type { ReactNode } from "react";
import { Award, BadgeCheck, GraduationCap, Hammer, Star } from "lucide-react";
import { MAX_LEVEL, levelLabel, type ProfileSkill } from "@/lib/skills";

/** Pontinhos preenchidos até o nível: dá para comparar prestadores num relance. */
export function LevelDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => (
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

/** Cartão de uma habilidade com tudo que foi respondido no formulário. `actions` é opcional (editar/remover). */
export function SkillCard({ skill, actions }: { skill: ProfileSkill; actions?: ReactNode }) {
  const marks = [
    { on: skill.has_experience, label: "Experiência profissional", icon: Hammer },
    { on: skill.had_training, label: "Fez treinamento ou aulas", icon: GraduationCap },
    { on: skill.certified, label: "Licenciado/certificado", icon: BadgeCheck },
  ].filter((m) => m.on);
  return (
    <article className="rounded-lg border-2 border-foreground p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base leading-tight">{skill.skill}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold">
            <LevelDots level={skill.level} />
            {levelLabel(skill.level)}
          </p>
        </div>
        {actions}
      </div>
      {marks.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {marks.map(({ label, icon: Icon }) => (
            <li
              key={label}
              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </li>
          ))}
        </ul>
      )}
      {skill.notes && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{skill.notes}</p>
      )}
    </article>
  );
}

/** Aviso curto de que nível, certificado e experiência são informados pelo próprio profissional. */
export function SelfDeclared() {
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Award className="h-3.5 w-3.5" /> Informado pelo próprio profissional.
    </p>
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
