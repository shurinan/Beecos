import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCatalog } from "@/lib/catalog";
import { DEADLINES, MAX_CHANNEL_PROFESSIONS, type Deadline } from "@/lib/channels";

export type ChannelValues = {
  name: string;
  description: string;
  professionIds: string[];
  days: Deadline;
};

export const EMPTY_CHANNEL: ChannelValues = {
  name: "",
  description: "",
  professionIds: [],
  days: 7,
};

/** Campos do canal, usados para criar e para editar. */
export function ChannelForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial: ChannelValues;
  submitLabel: string;
  busy: boolean;
  onSubmit: (v: ChannelValues) => void;
}) {
  const { data: catalog } = useCatalog();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [picked, setPicked] = useState<string[]>(initial.professionIds);
  const [days, setDays] = useState<Deadline>(initial.days);

  function toggle(id: string) {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_CHANNEL_PROFESSIONS) {
        toast.error(`Escolha no máximo ${MAX_CHANNEL_PROFESSIONS} profissões.`);
        return cur;
      }
      return [...cur, id];
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return void toast.error("Dê um nome ao canal (mínimo 3 letras).");
    onSubmit({ name: name.trim(), description: description.trim(), professionIds: picked, days });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <Label htmlFor="ch-name" className="font-bold">
          Nome
        </Label>
        <Input id="ch-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ch-desc" className="font-bold">
          Descrição
        </Label>
        <Textarea
          id="ch-desc"
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex.: Obras residenciais em Campinas. Contratamos por obra."
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="font-bold">Quais profissões você procura?</legend>
        <p className="text-xs text-muted-foreground">
          Ajuda as pessoas a encontrarem seu canal. Até {MAX_CHANNEL_PROFESSIONS}.
        </p>
        {catalog?.sectors.map((s) => (
          <div key={s.id} className="space-y-1">
            <p className="text-xs font-bold uppercase text-muted-foreground">{s.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {s.professions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={picked.includes(p.id)}
                  onClick={() => toggle(p.id)}
                  className={
                    "rounded-full border-2 border-foreground px-3 py-1 text-sm font-semibold " +
                    (picked.includes(p.id) ? "bg-foreground text-background" : "")
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-bold">Prazo padrão das vagas</legend>
        <div className="flex flex-wrap gap-1.5">
          {DEADLINES.map((d) => (
            <button
              key={d.days}
              type="button"
              aria-pressed={days === d.days}
              onClick={() => setDays(d.days)}
              className={
                "rounded-full border-2 border-foreground px-3 py-1 text-sm font-semibold " +
                (days === d.days ? "bg-foreground text-background" : "")
              }
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          A vaga só vai ao canal se você escolher publicar nele, e também aparece na comunidade da
          profissão. Você escolhe o prazo em cada vaga.
        </p>
      </fieldset>
      <Button type="submit" className="w-full" size="lg" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
