import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BASE_RADIUS_KM,
  EXPANDED_OPTIONS,
  GeoError,
  formatCep,
  isValidCep,
  lookupCep,
  type Place,
  type WorkArea,
} from "@/lib/geo";

const cepDigitsOf = (v: string) => v.replace(/\D/g, "");

export type WorkAreaInput = Place & { expanded_km: number };

/**
 * "Onde você atua": o CEP vira cidade e um ponto aproximado no mapa. Todos os planos recebem
 * avisos de vagas até 20 km; o Premium pode somar um raio expandido.
 */
export function WorkAreaDialog({
  open,
  onOpenChange,
  initial,
  premium,
  suggestedCep,
  onSave,
  onUpgrade,
  lookup = lookupCep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: WorkArea | null;
  premium: boolean;
  /** CEP do endereço físico que a pessoa já cadastrou, oferecido como atalho. */
  suggestedCep?: string | null | undefined;
  onSave: (area: WorkAreaInput) => Promise<boolean>;
  onUpgrade: () => void;
  /** Troca a consulta de CEP (nos testes). */
  lookup?: (cep: string) => Promise<Place>;
}) {
  const [cep, setCep] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [expanded, setExpanded] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCep(initial ? formatCep(initial.postal_code) : "");
    setPlace(null);
    setExpanded(initial?.expanded_km ?? 0);
    setError("");
    setBusy(false);
  }, [open, initial]);

  async function search(value: string) {
    setError("");
    setPlace(null);
    if (!isValidCep(value)) return;
    setBusy(true);
    try {
      setPlace(await lookup(value));
    } catch (e) {
      setError(e instanceof GeoError ? e.message : "Não foi possível buscar o CEP.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCep(cep)) return setError("Digite o CEP com 8 números.");
    let found = place;
    if (!found) {
      if (initial && cep.replace(/\D/g, "") === initial.postal_code) {
        // CEP igual ao guardado: só o raio mudou, mas precisamos do ponto para salvar de novo.
        setBusy(true);
        try {
          found = await lookup(cep);
        } catch (err) {
          setBusy(false);
          return setError(err instanceof GeoError ? err.message : "Não foi possível buscar o CEP.");
        }
      } else {
        return setError("Toque em Buscar para conferir o CEP.");
      }
    }
    setBusy(true);
    const saved = await onSave({ ...found, expanded_km: premium ? expanded : 0 });
    setBusy(false);
    if (saved) onOpenChange(false);
  }

  const total = BASE_RADIUS_KM + (premium ? expanded : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Onde você atua</DialogTitle>
          <DialogDescription>
            Usamos o CEP só para calcular a distância até as vagas. Os outros usuários nunca veem o
            seu CEP, nem a sua localização.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="work-cep" className="text-sm font-bold">
              CEP de onde você trabalha ou mora
            </label>
            <div className="flex gap-2">
              <Input
                id="work-cep"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => {
                  const v = formatCep(e.target.value);
                  setCep(v);
                  setPlace(null);
                  setError("");
                  if (isValidCep(v)) void search(v);
                }}
              />
              <Button type="button" variant="outline" loading={busy} onClick={() => search(cep)}>
                Buscar
              </Button>
            </div>
            {suggestedCep &&
              isValidCep(suggestedCep) &&
              cepDigitsOf(cep) !== cepDigitsOf(suggestedCep) && (
                <button
                  type="button"
                  className="text-sm font-bold underline"
                  onClick={() => {
                    const v = formatCep(suggestedCep);
                    setCep(v);
                    void search(v);
                  }}
                >
                  Usar o CEP do meu endereço físico ({formatCep(suggestedCep)})
                </button>
              )}
            {place && (
              <p className="text-sm font-semibold">
                {place.city} - {place.state}
              </p>
            )}
            {!place && initial && cep.replace(/\D/g, "") === initial.postal_code && (
              <p className="text-sm font-semibold">
                {initial.city} - {initial.state}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">Raio de trabalho</p>
            <p className="rounded-lg border-2 border-foreground bg-muted px-3 py-2 text-sm">
              <span className="font-bold">{BASE_RADIUS_KM} km</span>: você recebe aviso das vagas da
              sua profissão até essa distância. Vale para todos os planos.
            </p>
            <div className="space-y-1">
              <label htmlFor="work-expanded" className="text-sm font-bold">
                Raio expandido <span className="rounded bg-accent px-1.5 text-xs">Premium</span>
              </label>
              <select
                id="work-expanded"
                className="h-11 w-full rounded-md border-2 border-foreground bg-background px-3 disabled:opacity-60"
                disabled={!premium}
                value={premium ? expanded : 0}
                onChange={(e) => setExpanded(Number(e.target.value))}
              >
                {EXPANDED_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value === 0
                      ? o.label
                      : `${o.label} (${BASE_RADIUS_KM + o.value} km no total)`}
                  </option>
                ))}
              </select>
              {premium ? (
                <p className="text-xs text-muted-foreground">
                  Você recebe aviso de vagas até {total} km. As mais longe aparecem no feed com
                  "pode ser longe".
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem o raio expandido, você não recebe aviso de vagas além dos {BASE_RADIUS_KM} km,
                  mas continua vendo todas no feed.{" "}
                  <button type="button" className="font-bold underline" onClick={onUpgrade}>
                    Quero ser Premium
                  </button>
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
