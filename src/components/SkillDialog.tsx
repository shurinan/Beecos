import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CatalogPicker, EMPTY_SELECTION, type CatalogSelection } from "@/components/CatalogPicker";
import type { Catalog } from "@/lib/catalog";
import {
  MAX_SKILL_NOTES,
  MAX_YEARS,
  SKILL_LEVELS,
  normalizeSkill,
  type ProfileSkill,
  type SkillInput,
} from "@/lib/skills";

type Errors = Partial<
  Record<"skill" | "level" | "has_experience" | "years" | "had_training" | "certified", string>
>;

const cardBase =
  "flex cursor-pointer gap-3 rounded-lg border-2 border-foreground bg-background p-3 has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

function Question({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold">{label}</legend>
      {children}
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function YesNo({
  name,
  value,
  onChange,
}: {
  name: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, label: "Sim" },
        { v: false, label: "Não" },
      ].map((o) => (
        <label key={o.label} className={cardBase + " items-center px-4"}>
          <input
            type="radio"
            name={name}
            className="h-4 w-4 accent-foreground"
            checked={value === o.v}
            onChange={() => onChange(o.v)}
          />
          <span className="font-semibold">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Formulário "Adicionar habilidade": nome, nível de competência, três perguntas Sim/Não e outras informações.
 * Ao editar, o nome fica travado (é a chave da habilidade no perfil).
 */
export function SkillDialog({
  open,
  onOpenChange,
  initial,
  existing,
  catalog,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ProfileSkill | null;
  existing: string[];
  /** Lista de profissões e serviços; nula enquanto carrega. */
  catalog: Catalog | undefined;
  onSave: (skill: SkillInput) => Promise<boolean>;
}) {
  const editing = initial !== null;
  const [pick, setPick] = useState<CatalogSelection>(EMPTY_SELECTION);
  const [name, setName] = useState("");
  const [level, setLevel] = useState(0);
  const [experience, setExperience] = useState<boolean | null>(null);
  const [years, setYears] = useState("");
  const [training, setTraining] = useState<boolean | null>(null);
  const [certified, setCertified] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPick(
      initial
        ? {
            professionId: initial.profession_id,
            other: initial.profession_id === null,
            serviceIds: initial.service_ids ?? [],
          }
        : EMPTY_SELECTION,
    );
    setName(initial?.skill ?? "");
    setLevel(initial?.level ?? 0);
    setExperience(initial ? initial.has_experience : null);
    setYears(initial?.years_experience == null ? "" : String(initial.years_experience));
    setTraining(initial ? initial.had_training : null);
    setCertified(initial ? initial.certified : null);
    setNotes(initial?.notes ?? "");
    setErrors({});
    setSaving(false);
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = pick.professionId ? catalog?.professions.get(pick.professionId) : undefined;
    const trimmed = pick.other ? name.trim() : (chosen?.name ?? "");
    const next: Errors = {};
    if (!pick.other && !chosen) next.skill = "Escolha a profissão.";
    else if (!trimmed) next.skill = "Escreva o nome da habilidade.";
    else if (!editing && existing.some((n) => normalizeSkill(n) === normalizeSkill(trimmed)))
      next.skill = "Você já adicionou essa habilidade.";
    if (level < 1) next.level = "Escolha o seu nível.";
    if (experience === null) next.has_experience = "Responda sim ou não.";
    const yearsNumber = years.trim() === "" ? null : Number(years);
    if (
      experience === true &&
      yearsNumber !== null &&
      (!Number.isInteger(yearsNumber) || yearsNumber < 0 || yearsNumber > MAX_YEARS)
    )
      next.years = `Use um número inteiro de 0 a ${MAX_YEARS}.`;
    if (training === null) next.had_training = "Responda sim ou não.";
    if (certified === null) next.certified = "Responda sim ou não.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const saved = await onSave({
      skill: trimmed,
      profession_id: pick.other ? null : pick.professionId,
      service_ids: pick.other ? [] : pick.serviceIds,
      level,
      has_experience: experience === true,
      years_experience: experience === true ? yearsNumber : null,
      had_training: training === true,
      certified: certified === true,
      notes: notes.trim(),
    });
    setSaving(false);
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar habilidade" : "Adicionar habilidade"}</DialogTitle>
          <DialogDescription>Aparece no seu perfil como informado por você.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <CatalogPicker
            catalog={catalog}
            value={pick}
            onChange={setPick}
            multipleServices
            professionLabel="Profissão"
            servicesLabel="Quais serviços você faz?"
            lockProfession={editing}
          />

          {pick.other && (
            <div className="space-y-1">
              <label htmlFor="skill-name" className="text-sm font-bold">
                Qual é a habilidade?
              </label>
              <Input
                id="skill-name"
                maxLength={40}
                placeholder="Ex: Instalador de toldos"
                value={name}
                readOnly={editing}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          {errors.skill && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {errors.skill}
            </p>
          )}

          <Question label="Nível de competência" error={errors.level}>
            <div className="space-y-2">
              {SKILL_LEVELS.map((l) => (
                <label key={l.level} className={cardBase + " items-start"}>
                  <input
                    type="radio"
                    name="skill-level"
                    className="mt-1 h-4 w-4 accent-foreground"
                    checked={level === l.level}
                    onChange={() => setLevel(l.level)}
                  />
                  <span>
                    <span className="block font-bold">{l.label}</span>
                    <span className="block text-sm text-muted-foreground">{l.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Question>

          <Question
            label="Você tem experiência profissional usando essa habilidade?"
            error={errors.has_experience}
          >
            <YesNo name="skill-experience" value={experience} onChange={setExperience} />
            {experience === true && (
              <div className="space-y-1">
                <label htmlFor="skill-years" className="text-sm font-semibold">
                  Há quantos anos?{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  id="skill-years"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_YEARS}
                  className="w-32"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                />
                {errors.years && (
                  <p role="alert" className="text-xs font-semibold text-destructive">
                    {errors.years}
                  </p>
                )}
              </div>
            )}
          </Question>

          <Question
            label="Já teve algum treinamento ou fez aulas para aprender essa habilidade?"
            error={errors.had_training}
          >
            <YesNo name="skill-training" value={training} onChange={setTraining} />
          </Question>

          <Question label="Licenciado/certificado" error={errors.certified}>
            <YesNo name="skill-certified" value={certified} onChange={setCertified} />
          </Question>

          <div className="space-y-1">
            <label htmlFor="skill-notes" className="text-sm font-bold">
              Outras informações
            </label>
            <p className="text-sm text-muted-foreground">
              Como você aprendeu e onde já usou essa habilidade.
            </p>
            <Textarea
              id="skill-notes"
              maxLength={MAX_SKILL_NOTES}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {notes.length}/{MAX_SKILL_NOTES}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar habilidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
