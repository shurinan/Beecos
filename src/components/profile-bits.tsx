import type { ReactNode } from "react";
import { Award, GraduationCap, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/data";
import {
  MAX_LEVEL,
  formatLongDate,
  formatYears,
  levelLabel,
  type ProfileSkill,
} from "@/lib/skills";

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

/**
 * Cartão de uma habilidade no formato da Visão geral: nome, e abaixo anos de experiência, nível de
 * competência, licenciado/certificado e data de atualização. `actions` é opcional (editar/remover).
 */
export function SkillCard({ skill, actions }: { skill: ProfileSkill; actions?: ReactNode }) {
  const fields = [
    {
      label: "Anos de experiência",
      value: skill.has_experience ? formatYears(skill.years_experience) : "—",
    },
    { label: "Nível de competência", value: levelLabel(skill.level), dots: true },
    { label: "Licenciado/certificado", value: skill.certified ? "Sim" : "Não" },
    { label: "Atualizado em", value: formatLongDate(skill.updated_at) },
  ];
  return (
    <article className="rounded-lg border-2 border-foreground p-3">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-base leading-tight">{skill.skill}</h3>
        {actions}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="flex items-center gap-1.5 text-sm font-semibold">
              {f.dots && <LevelDots level={skill.level} />}
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
      {skill.had_training && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold">
          <GraduationCap className="h-3.5 w-3.5" /> Fez treinamento ou aulas
        </p>
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

/** Foto de perfil (bucket público "avatars"); sem foto, mostra as iniciais. */
export function Avatar({
  name,
  path,
  size = 80,
}: {
  name: string;
  path?: string | null | undefined;
  size?: number;
}) {
  const url = path ? supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl : null;
  const style = { width: size, height: size, fontSize: size * 0.3 };
  return url ? (
    <img
      src={url}
      alt={`Foto de ${name || "perfil"}`}
      style={style}
      className="shrink-0 rounded-full border-2 border-foreground object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-primary font-display"
    >
      {initials(name)}
    </span>
  );
}
