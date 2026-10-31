import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PAUSE_OPTIONS, pauseUntil, pausedNow, type AlertPrefs } from "@/lib/alerts";

/**
 * Como a pessoa quer ser avisada. Ligar, desligar e pausar são grátis para todos;
 * e-mail e push chegam nas próximas etapas.
 */
export function AlertPrefsCard({
  prefs,
  onSave,
  premium = false,
  professions = [],
}: {
  prefs: AlertPrefs;
  onSave: (patch: Partial<AlertPrefs>) => Promise<void>;
  /** Premium escolhe de quais profissões recebe avisos. */
  premium?: boolean;
  professions?: { id: string; name: string }[];
}) {
  const paused = pausedNow(prefs);
  const run = (patch: Partial<AlertPrefs>) =>
    onSave(patch).catch(() => toast.error("Não foi possível salvar. Tente de novo."));
  return (
    <section className="block-card space-y-3 p-4" aria-label="Preferências de avisos">
      <h2 className="text-lg">Como quero ser avisado</h2>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-bold">Vagas da minha profissão perto de mim</span>
          <span className="block text-sm text-muted-foreground">
            Aviso no app, num raio de 20 km do lugar onde você atua.
          </span>
        </span>
        <Switch
          aria-label="Receber avisos de vagas"
          checked={prefs.in_app}
          onCheckedChange={(v) => void run({ in_app: v })}
        />
      </label>
      {prefs.in_app && (
        <div className="space-y-2 border-t border-dashed border-foreground/30 pt-3">
          {paused ? (
            <>
              <p className="text-sm">
                Avisos pausados até{" "}
                <strong>{new Date(prefs.paused_until!).toLocaleDateString("pt-BR")}</strong>.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void run({ paused_until: null })}
              >
                Voltar a receber agora
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold">Pausar por um tempo</p>
              <div className="flex flex-wrap gap-2">
                {PAUSE_OPTIONS.map((o) => (
                  <Button
                    key={o.days}
                    type="button"
                    variant="outline"
                    onClick={() => void run({ paused_until: pauseUntil(o.days) })}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {prefs.in_app && professions.length > 0 && (
        <div className="space-y-2 border-t border-dashed border-foreground/30 pt-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            Profissões que me avisam
            <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 text-xs">
              <Crown className="h-3 w-3" aria-hidden="true" /> Premium
            </span>
          </p>
          {premium ? (
            professions.map((pr) => {
              const on = !prefs.muted_profession_ids.includes(pr.id);
              return (
                <label key={pr.id} className="flex items-center justify-between gap-3">
                  <span>{pr.name}</span>
                  <Switch
                    aria-label={`Avisos de ${pr.name}`}
                    checked={on}
                    onCheckedChange={(v) =>
                      void run({
                        muted_profession_ids: v
                          ? prefs.muted_profession_ids.filter((x) => x !== pr.id)
                          : [...prefs.muted_profession_ids, pr.id],
                      })
                    }
                  />
                </label>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Hoje você recebe avisos de todas as suas profissões. No Premium dá para escolher de
              quais.{" "}
              <Link to="/plano" className="font-bold underline">
                Ver o plano
              </Link>
            </p>
          )}
        </div>
      )}
      <div className="space-y-1 border-t border-dashed border-foreground/30 pt-3 text-sm text-muted-foreground">
        <p>
          Quer ser avisado de vagas mais longe? Aumente o raio em “Onde você atua” (plano Premium).
        </p>
      </div>
    </section>
  );
}
