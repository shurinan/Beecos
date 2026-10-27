import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCatalog } from "@/lib/catalog";
import { communityErrorMessage, useCommunityOverview, useMyCommunities } from "@/lib/community";

export const Route = createFileRoute("/comunidade/grupos")({
  head: () => ({
    meta: [
      { title: "Grupos da comunidade — Beecos" },
      { name: "description", content: "Entre nos grupos por profissão e acompanhe as vagas." },
    ],
  }),
  component: Groups,
});

function Groups() {
  const { userId } = useAuth();
  const { data: catalog, isLoading } = useCatalog();
  const { data: overview } = useCommunityOverview();
  const { ids, join, leave } = useMyCommunities(userId);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(id: string, isIn: boolean) {
    setBusy(id);
    try {
      await (isIn ? leave(id) : join(id));
    } catch (e) {
      toast.error(communityErrorMessage(e) ?? "Não consegui salvar. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl">Grupos</h1>
        <p className="text-muted-foreground">
          Entre nos grupos da sua área. As vagas deles aparecem no seu feed da{" "}
          <Link to="/comunidade" search={{ grupo: undefined }} className="font-bold underline">
            Comunidade
          </Link>
          .
        </p>
      </header>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {catalog?.sectors.map((sector) => (
        <section key={sector.id} aria-labelledby={`g-${sector.id}`} className="space-y-2">
          <h2 id={`g-${sector.id}`} className="text-lg">
            {sector.name}
          </h2>
          <ul className="space-y-2">
            {sector.professions.map((p) => {
              const n = overview?.get(p.id);
              const isIn = ids.includes(p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border-2 border-foreground p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {n ? `${n.members} ${n.members === 1 ? "participante" : "participantes"} · ${n.open_jobs} ${n.open_jobs === 1 ? "vaga aberta" : "vagas abertas"}` : " "}
                    </p>
                  </div>
                  {userId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={isIn ? "outline" : "default"}
                      disabled={busy === p.id}
                      onClick={() => void toggle(p.id, isIn)}
                    >
                      {isIn ? "Sair" : "Entrar"}
                    </Button>
                  ) : (
                    <Button asChild size="sm">
                      <Link to="/auth">Entrar</Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
