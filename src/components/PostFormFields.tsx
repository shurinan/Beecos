import { toast } from "sonner";
import { Crown, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PostCard } from "@/components/PostCard";
import { URGENT_PRICE } from "@/lib/plans";
import { COVER_BG, COVER_COLORS, coverVars, LOOK_ICONS, resolveCover } from "@/lib/post-look";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CatalogPicker } from "@/components/CatalogPicker";
import type { Catalog } from "@/lib/catalog";
import { GeoError, formatCep, isValidCep, lookupCep } from "@/lib/geo";
import { clampVacancies, MAX_DESCRIPTION, MAX_TITLE, type PostDraft } from "@/lib/post-form";

/** Os campos de uma vaga ou anúncio, iguais ao publicar e ao editar. */
export function PostFormFields({
  draft,
  onChange,
  catalog,
  idPrefix,
  minVacancies = 1,
  lookup = lookupCep,
  premium = false,
}: {
  draft: PostDraft;
  onChange: (next: PostDraft) => void;
  catalog: Catalog | undefined;
  idPrefix: string;
  /** Vagas já ocupadas: o número de vagas não pode ficar abaixo disso. */
  minVacancies?: number;
  lookup?: typeof lookupCep;
  /** Quem é Premium pode destacar a vaga na lista. */
  premium?: boolean;
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

  const look = draft.look;
  const setLook = (patch: Partial<typeof look>) =>
    onChange({ ...draft, look: { ...look, ...patch } });
  const profession = draft.pick.professionId
    ? catalog?.professions.get(draft.pick.professionId)
    : undefined;
  const service = draft.pick.serviceIds[0]
    ? catalog?.services.get(draft.pick.serviceIds[0])
    : undefined;
  const chosenCover = resolveCover(look.coverColor, profession?.name);
  const sw =
    "h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 ";

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
          maxLength={MAX_TITLE}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </div>
      <Textarea
        aria-label="Detalhes"
        placeholder="Detalhes: o que precisa, quando, onde…"
        value={draft.description}
        maxLength={MAX_DESCRIPTION}
        rows={5}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
      />
      <p className="-mt-2 text-right text-xs text-muted-foreground" aria-live="polite">
        {draft.description.length}/{MAX_DESCRIPTION}
      </p>
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
      <section
        className="space-y-4 rounded-xl border-2 border-foreground/15 bg-muted/40 p-3"
        aria-label="Personalizar a vaga"
      >
        <h3 className="text-base font-extrabold">Personalizar {job ? "a vaga" : "o anúncio"}</h3>
        <div className="pointer-events-none select-none" aria-hidden="true">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Prévia
          </p>
          <PostCard
            post={{
              id: "preview",
              kind: draft.kind,
              title: draft.title || (job ? "Título da vaga" : "Título do anúncio"),
              description: draft.description,
              city: draft.city,
              price: draft.price,
              created_at: new Date().toISOString(),
              user_id: "preview",
              vacancies: draft.vacancies,
              premium,
              cover_color: look.coverColor,
              cover_icon: look.icon,
              urgent: job && look.urgent,
              negotiable: job && look.negotiable,
              highlight: look.highlight,
              professions: profession ? { name: profession.name } : null,
              services: service ? { name: service.name } : null,
              profiles: null,
            }}
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">
            Cor da capa <span className="font-normal text-muted-foreground">· Grátis</span>
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {COVER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={chosenCover === c}
                onClick={() => setLook({ coverColor: c })}
                className={
                  COVER_BG +
                  " " +
                  sw +
                  (chosenCover === c
                    ? "border-foreground shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--foreground)]"
                    : "border-foreground/30")
                }
                style={coverVars(c)}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">
            Ícone{" "}
            <span className="font-normal text-muted-foreground">
              · Grátis · padrão: o da profissão
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={look.icon === null}
              onClick={() => setLook({ icon: null })}
              className={
                "rounded-lg border-2 px-2.5 py-1.5 text-xs font-bold " +
                (look.icon === null ? "border-foreground bg-primary" : "border-foreground/30")
              }
            >
              Padrão
            </button>
            {LOOK_ICONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={look.icon === key}
                onClick={() => setLook({ icon: key })}
                className={
                  "flex h-9 w-9 items-center justify-center rounded-lg border-2 " +
                  (look.icon === key ? "border-foreground bg-primary" : "border-foreground/30")
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-bold">Selos</legend>
          {job && (
            <>
              <LookToggle
                label="Urgente"
                hint={premium ? "Incluído no Premium" : `${URGENT_PRICE} por vaga`}
                {...(premium ? {} : { icon: <Lock className="h-4 w-4" aria-hidden="true" /> })}
                checked={premium && look.urgent}
                disabled={!premium}
                onChange={(v) => setLook({ urgent: v })}
              />
              <LookToggle
                label="Combinar valor"
                hint="Grátis · no lugar do preço"
                checked={look.negotiable}
                onChange={(v) => setLook({ negotiable: v })}
              />
            </>
          )}
          <LookToggle
            label="Destaque na lista"
            hint="Premium"
            icon={
              premium ? (
                <Crown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Lock className="h-4 w-4" aria-hidden="true" />
              )
            }
            checked={premium && look.highlight}
            disabled={!premium}
            onChange={(v) => setLook({ highlight: v })}
          />
          {!premium && (
            <p className="text-xs text-muted-foreground">
              O destaque é do plano Premium. O selo Urgente custa {URGENT_PRICE} por vaga, e o
              pagamento avulso abre em breve; no Premium ele já vem incluído.{" "}
              <Link to="/plano" className="font-bold underline">
                Conhecer o Premium
              </Link>
            </p>
          )}
        </fieldset>
      </section>
    </>
  );
}

function LookToggle({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  icon,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={
        "flex items-center justify-between gap-3 rounded-lg border-2 border-foreground/15 bg-card px-3 py-2 " +
        (disabled ? "opacity-60" : "cursor-pointer")
      }
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
        <span className="text-xs font-normal text-muted-foreground">· {hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="h-5 w-5 accent-[var(--primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
