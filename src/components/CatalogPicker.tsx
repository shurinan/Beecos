import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { searchCatalog, type Catalog, type CatalogHit } from "@/lib/catalog";

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

const field =
  "h-11 w-full rounded-md border-2 border-foreground bg-background px-3 text-left disabled:opacity-60";

type Option = { key: string; label: string; hint?: string; pick: () => void; selected?: boolean };

/**
 * Escolha em dois passos, sem digitação livre: a profissão sai de uma lista que se filtra enquanto
 * a pessoa digita (por nome ou apelido), e os serviços ficam recolhidos até ela abri-los.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [servicesOpen, setServicesOpen] = useState(false);

  const profession = value.professionId ? catalog?.professions.get(value.professionId) : undefined;
  const selectedLabel = value.other ? "Outro (não está na lista)" : (profession?.name ?? "");

  const options = useMemo<Option[]>(() => {
    if (!catalog) return [];
    const q = query.trim();
    const out: Option[] = [];
    const pickProfession = (professionId: string, serviceId?: string) => () => {
      onChange({ professionId, other: false, serviceIds: serviceId ? [serviceId] : [] });
      setOpen(false);
      setQuery("");
      setServicesOpen(false);
    };
    if (q) {
      const hits: CatalogHit[] = searchCatalog(catalog, q, 10);
      for (const h of hits) {
        out.push({
          key: h.service?.id ?? h.profession.id,
          label: h.service?.name ?? h.profession.name,
          ...(h.service ? { hint: h.profession.name } : {}),
          pick: pickProfession(h.profession.id, h.service?.id),
        });
      }
    } else {
      for (const s of catalog.sectors) {
        for (const p of s.professions) {
          out.push({
            key: p.id,
            label: p.name,
            hint: s.name,
            pick: pickProfession(p.id),
            selected: p.id === value.professionId,
          });
        }
      }
    }
    if (allowOther) {
      out.push({
        key: "__other__",
        label: "Outro (não está na lista)",
        pick: () => {
          onChange({ professionId: null, other: true, serviceIds: [] });
          setOpen(false);
          setQuery("");
          setServicesOpen(false);
        },
        selected: value.other,
      });
    }
    return out;
  }, [catalog, query, allowOther, onChange, value.professionId, value.other]);

  if (!catalog) {
    return <p className="text-sm text-muted-foreground">Carregando a lista de profissões…</p>;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      options[active]?.pick();
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
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
      setServicesOpen(false);
    }
  }

  const services = profession?.services ?? [];
  const chosenServices = value.serviceIds.flatMap((sid) => catalog.services.get(sid)?.name ?? []);
  const servicesSummary =
    chosenServices.length === 0
      ? multipleServices
        ? "Escolher os serviços (opcional)"
        : "Escolher o serviço (opcional)"
      : chosenServices.length === 1
        ? chosenServices[0]!
        : `${chosenServices.length} serviços escolhidos`;

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
        <div
          ref={rootRef}
          className="space-y-1"
          onBlur={(e) => {
            // fecha só quando o foco sai de todo o seletor (tocar numa opção não conta)
            if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
              setOpen(false);
              setQuery("");
            }
          }}
        >
          <label htmlFor={`${id}-input`} className="text-sm font-bold">
            {professionLabel}
          </label>
          <div className="relative">
            <input
              id={`${id}-input`}
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              autoComplete="off"
              className={field + " pr-9 placeholder:text-muted-foreground"}
              placeholder="Digite e escolha: eletricista, chuveiro, bico…"
              value={open ? query : selectedLabel}
              onFocus={() => {
                setOpen(true);
                setQuery("");
                setActive(0);
              }}
              onClick={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
            <ChevronDown
              className="pointer-events-none absolute right-3 top-3.5 h-4 w-4"
              aria-hidden="true"
            />
          </div>
          {open && (
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-label={professionLabel}
              className="max-h-64 space-y-1 overflow-y-auto rounded-lg border-2 border-foreground bg-background p-1"
              onMouseDown={(e) => e.preventDefault()}
            >
              {options.map((o, i) => (
                <li
                  key={o.key}
                  role="option"
                  aria-selected={!!o.selected}
                  className={
                    "flex min-h-11 cursor-pointer flex-col justify-center rounded-md px-3 py-1 " +
                    (i === active ? "bg-primary/40 " : "hover:bg-primary/20 ") +
                    (o.selected ? "font-bold" : "")
                  }
                  onMouseEnter={() => setActive(i)}
                  onClick={o.pick}
                >
                  <span>{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </li>
              ))}
              {options.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</li>
              )}
            </ul>
          )}
        </div>
      )}

      {profession && services.length > 0 && (
        <div className="space-y-1">
          <p id={`${id}-services-label`} className="text-sm font-bold">
            {servicesLabel}
          </p>
          <button
            type="button"
            aria-expanded={servicesOpen}
            aria-labelledby={`${id}-services-label ${id}-services-btn`}
            id={`${id}-services-btn`}
            className={field + " flex items-center justify-between gap-2"}
            onClick={() => setServicesOpen((o) => !o)}
          >
            <span className={chosenServices.length === 0 ? "text-muted-foreground" : ""}>
              {servicesSummary}
            </span>
            <ChevronDown
              className={
                "h-4 w-4 shrink-0 transition-transform " + (servicesOpen ? "rotate-180" : "")
              }
              aria-hidden="true"
            />
          </button>
          {servicesOpen && (
            <div
              role="group"
              aria-labelledby={`${id}-services-label`}
              className="max-h-64 space-y-1 overflow-y-auto rounded-lg border-2 border-foreground bg-background p-1"
            >
              {!multipleServices && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 hover:bg-primary/20">
                  <input
                    type="radio"
                    name={`${id}-service`}
                    className="h-4 w-4 accent-foreground"
                    checked={value.serviceIds.length === 0}
                    onChange={() => {
                      onChange({ ...value, serviceIds: [] });
                      setServicesOpen(false);
                    }}
                  />
                  <span>Outro serviço ou não sei</span>
                </label>
              )}
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 hover:bg-primary/20 has-[:checked]:bg-primary/40"
                >
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
              {multipleServices && (
                <button
                  type="button"
                  className="w-full rounded-md py-2 text-sm font-bold underline"
                  onClick={() => setServicesOpen(false)}
                >
                  Pronto
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
