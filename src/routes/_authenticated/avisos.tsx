import { createFileRoute, Link } from "@tanstack/react-router";
import { BellOff } from "lucide-react";
import { toast } from "sonner";
import { AlertPrefsCard } from "@/components/AlertPrefsCard";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAlertPrefs, useAlerts, useMarkAlertsRead, useMyProfessions } from "@/lib/alerts";
import { getPlanUsage } from "@/lib/plans";
import { timeAgo } from "@/lib/data";
import { postParams } from "@/lib/urls";

export const Route = createFileRoute("/_authenticated/avisos")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Avisos — Beecos" },
      { name: "description", content: "Vagas novas da sua profissão perto de você." },
    ],
  }),
  component: Alerts,
});

function Alerts() {
  const { userId } = Route.useRouteContext();
  const { alerts, unread, isLoading, isError, refetch } = useAlerts(userId);
  const { prefs, save } = useAlertPrefs(userId);
  const { data: myProfessions } = useMyProfessions(userId);
  const { data: usage } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
  });
  const markRead = useMarkAlertsRead(userId);
  const quiet = (p: Promise<void>) => p.catch(() => toast.error("Não consegui marcar como lido."));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl">Avisos</h1>
        {unread > 0 && (
          <Button type="button" variant="outline" onClick={() => void quiet(markRead())}>
            Marcar tudo como lido
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {isError && (
        <p role="alert">
          Não consegui carregar os avisos.{" "}
          <button className="font-bold underline" onClick={() => refetch()}>
            Tentar de novo
          </button>
        </p>
      )}
      {!isLoading && !isError && alerts.length === 0 && (
        <div className="block-card flex items-center gap-3 p-4">
          <BellOff className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm">
            Nenhum aviso ainda. Quando alguém publicar uma vaga da sua profissão perto de você, ela
            aparece aqui. Confira se você cadastrou suas habilidades e o lugar onde atua no seu
            perfil.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {alerts.map((a) => {
          const card = (
            <>
              <span className="flex items-start justify-between gap-2">
                <span className={a.read_at ? "font-semibold" : "font-bold"}>{a.title}</span>
                {!a.read_at && (
                  <span
                    aria-label="Não lido"
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-foreground bg-destructive"
                  />
                )}
              </span>
              <span className="block text-sm">{a.body}</span>
              <span className="block text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
            </>
          );
          return (
            <li key={a.id}>
              {a.posts ? (
                <Link
                  to="/vagas/$profissao/$codigo"
                  params={postParams(a.posts)}
                  className={"block-card block space-y-1 p-4 " + (a.read_at ? "opacity-80" : "")}
                  onClick={() => {
                    if (!a.read_at) void quiet(markRead([a.id]));
                  }}
                >
                  {card}
                </Link>
              ) : (
                <div className="block-card space-y-1 p-4">{card}</div>
              )}
            </li>
          );
        })}
      </ul>

      <AlertPrefsCard
        prefs={prefs}
        onSave={save}
        premium={!!usage?.premium}
        professions={myProfessions ?? []}
      />
    </div>
  );
}
