import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchCatalog, type Catalog } from "@/lib/catalog";

/** O que a pessoa escolheu. `other` = "Outro", uma profissão que não está na lista. */
export type CatalogSelection = {
  professionId: string | null;
  other: boolean;
  serviceIds: string[];
};

export const EMPTY_SELECTION: CatalogSelection = {
  professionId: null,
  other: false,
  serviceIds: [],
};

const OTHER = "__other__";

const choice =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-foreground bg-background px-3 py-2 has-[:checked]:bg-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

/**
 * Escolha em dois passos: a profissão (por busca ou pela lista) e depois os serviços dela.
 * Com `multipleServices` marca vários (perfil); sem, escolhe um só ou nenhum (vaga).
 */
export function CatalogPicker({
  catalog,
  value,
  onChange,
  multipleServices,
  professionLabel = "Profissão",
  servicesLabel,
  lockProfession = false,
  allowOther = true,
}: {
  catalog: Catalog | undefined;
  value: CatalogSelection;
  onChange: (next: CatalogSelection) => void;
  multipleServices: boolean;
  professionLabel?: string;
  servicesLabel: string;
  /** Ao editar, a profissão não muda (é a chave da habilidade). */
  lockProfession?: boolean;
  allowOther?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const hits = useMemo(() => (catalog ? searchCatalog(catalog, query) : []), [catalog, query]);
  const profession = value.professionId ? catalog?.professions.get(value.professionId) : undefined;

  if (!catalog) {
    return <p className="text-sm text-muted-foreground">Carregando a lista de profissões…</p>;
  }

  function pick(professionId: string, serviceId?: string) {
    onChange({
      professionId,
      other: false,
      serviceIds: serviceId ? [serviceId] : [],
    });
    setQuery("");
  }

  function toggleService(serviceId: string) {
    if (multipleServices) {
      const has = value.serviceIds.includes(serviceId);
      onChange({
        ...value,
        serviceIds: has
          ? value.serviceIds.filter((x) => x !== serviceId)
          : [...value.serviceIds, serviceId],
      });
    } else {
      onChange({ ...value, serviceIds: [serviceId] });
    }
  }

  return (
    <div className="space-y-3">
      {lockProfession ? (
        <div className="space-y-1">
          <p className="text-sm font-bold">{professionLabel}</p>
          <p className="rounded-lg border-2 border-foreground bg-muted px-3 py-2 font-semibold">
            {profession?.name ?? "Outro"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <label htmlFor={`${id}-search`} className="text-sm font-bold">
              {professionLabel}
            </label>
            <Input
              id={`${id}-search`}
              type="search"
              autoComplete="off"
              placeholder="Buscar: eletricista, chuveiro, bico de pedreiro…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query.trim() !== "" && (
              <ul className="space-y-1" aria-label="Resultados da busca">
                {hits.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Nada encontrado.
                    {allowOther ? ' Escolha "Outro" na lista abaixo.' : ""}
                  </li>
                )}
                {hits.map((h) => (
                  <li key={h.service?.id ?? h.profession.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full flex-col items-start justify-center rounded-lg border-2 border-foreground bg-background px-3 py-1 text-left hover:bg-primary/30"
                      onClick={() => pick(h.profession.id, h.service?.id)}
                    >
                      <span className="font-semibold">{h.service?.name ?? h.profession.name}</span>
                      {h.service && (
                        <span className="text-xs text-muted-foreground">{h.profession.name}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor={`${id}-list`} className="text-sm font-semibold">
              Ou escolha na lista
            </label>
            <select
              id={`${id}-list`}
              className="h-11 w-full rounded-md border-2 border-foreground bg-background px-3"
              value={value.other ? OTHER : (value.professionId ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                if (v === OTHER) onChange({ professionId: null, other: true, serviceIds: [] });
                else if (v) pick(v);
                else onChange(EMPTY_SELECTION);
              }}
            >
              <option value="">Escolher…</option>
              {catalog.sectors.map((s) => (
                <optgroup key={s.id} label={s.name}>
                  {s.professions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              {allowOther && <option value={OTHER}>Outro (não está na lista)</option>}
            </select>
          </div>
        </>
      )}

      {profession && profession.services.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">{servicesLabel}</legend>
          {!multipleServices && (
            <label className={choice}>
              <input
                type="radio"
                name={`${id}-service`}
                className="h-4 w-4 accent-foreground"
                checked={value.serviceIds.length === 0}
                onChange={() => onChange({ ...value, serviceIds: [] })}
              />
              <span>Outro serviço ou não sei</span>
            </label>
          )}
          {profession.services.map((s) => (
            <label key={s.id} className={choice}>
              <input
                type={multipleServices ? "checkbox" : "radio"}
                name={`${id}-service`}
                className="h-4 w-4 accent-foreground"
                checked={value.serviceIds.includes(s.id)}
                onChange={() => toggleService(s.id)}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
