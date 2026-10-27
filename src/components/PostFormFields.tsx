import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CatalogPicker } from "@/components/CatalogPicker";
import type { Catalog } from "@/lib/catalog";
import { GeoError, formatCep, isValidCep, lookupCep } from "@/lib/geo";
import { clampVacancies, type PostDraft } from "@/lib/post-form";

/** Os campos de uma vaga ou anúncio, iguais ao publicar e ao editar. */
export function PostFormFields({
  draft,
  onChange,
  catalog,
  idPrefix,
  minVacancies = 1,
  lookup = lookupCep,
}: {
  draft: PostDraft;
  onChange: (next: PostDraft) => void;
  catalog: Catalog | undefined;
  idPrefix: string;
  /** Vagas já ocupadas: o número de vagas não pode ficar abaixo disso. */
  minVacancies?: number;
  lookup?: typeof lookupCep;
}) {
  const job = draft.kind === "job";

  async function findPlace() {
    if (!isValidCep(draft.cep) || draft.place) return;
    try {
      const place = await lookup(draft.cep);
      onChange({ ...draft, place, city: `${place.city} - ${place.state}` });
    } catch (err) {
      toast.error(err instanceof GeoError ? err.message : "Não foi possível buscar o CEP");
    }
  }

  return (
    <>
      <CatalogPicker
        catalog={catalog}
        value={draft.pick}
        onChange={(pick) => onChange({ ...draft, pick })}
        multipleServices={false}
        professionLabel={job ? "Que profissional você procura?" : "Qual é a sua profissão?"}
        servicesLabel={job ? "Qual serviço?" : "Qual serviço você oferece?"}
      />
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-title`}>Título</Label>
        <Input
          id={`${idPrefix}-title`}
          required
          placeholder={
            job ? "Ex: Preciso de ajudante para mudança" : "Ex: Pedreiro disponível esta semana"
          }
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </div>
      <Textarea
        aria-label="Detalhes"
        placeholder="Detalhes: o que precisa, quando, onde…"
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
      />
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-cep`}>
          {job ? "CEP de onde o serviço será feito" : "Seu CEP (opcional)"}
        </Label>
        <Input
          id={`${idPrefix}-cep`}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={draft.cep}
          onChange={(e) => onChange({ ...draft, cep: formatCep(e.target.value), place: null })}
          onBlur={findPlace}
        />
        <p className="text-xs text-muted-foreground">
          {draft.place ? `${draft.place.city} - ${draft.place.state}. ` : ""}O CEP fica oculto: só
          serve para calcular a distância até quem procura.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Cidade"
          placeholder="Cidade"
          value={draft.city}
          onChange={(e) => onChange({ ...draft, city: e.target.value })}
        />
        <Input
          aria-label="Valor"
          placeholder="Valor (ex: R$150/dia)"
          value={draft.price}
          onChange={(e) => onChange({ ...draft, price: e.target.value })}
        />
      </div>
      {job && (
        <div>
          <Label htmlFor={`${idPrefix}-vacancies`}>Quantas pessoas você precisa?</Label>
          <Input
            id={`${idPrefix}-vacancies`}
            type="number"
            inputMode="numeric"
            min={Math.max(1, minVacancies)}
            max={20}
            value={draft.vacancies}
            onChange={(e) =>
              onChange({ ...draft, vacancies: clampVacancies(Number(e.target.value)) })
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Você escolhe quem fica com cada vaga entre os interessados.
            {minVacancies > 0 && ` Já ocupadas: ${minVacancies}.`}
          </p>
        </div>
      )}
    </>
  );
}
