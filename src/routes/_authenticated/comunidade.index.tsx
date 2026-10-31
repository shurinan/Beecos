import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CommunityPostCard } from "@/components/CommunityPostCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCatalog } from "@/lib/catalog";
import {
  FEED_ORDERS,
  FEED_ORDER_LABEL,
  type FeedOrder,
  groupsSummary,
  useCommunityFeed,
  useCommunityOverview,
  useMyCommunities,
} from "@/lib/community";
import { openConversation } from "@/lib/data";
import { usePostDistances } from "@/lib/geo";
import { showInterestError } from "@/lib/interest";
import { usePostStats } from "@/lib/services-hooks";
import { profileParam } from "@/lib/urls";

export const Route = createFileRoute("/_authenticated/comunidade/")({
  staticData: { sitemap: true },
  validateSearch: (
    q: Record<string, unknown>,
  ): { grupo?: string | undefined; ordem?: FeedOrder | undefined } => ({
    grupo: typeof q["grupo"] === "string" ? (q["grupo"] as string) : undefined,
    ordem: FEED_ORDERS.find((o) => o === q["ordem"]),
  }),
  head: () => ({
    meta: [
      { title: "Comunidade — Beecos" },
      {
        name: "description",
        content: "Grupos por profissão com as vagas da sua área, num feed só.",
      },
    ],
  }),
  component: Community,
});

function Community() {
  const { userId, ready } = useAuth();
  const { grupo, ordem } = Route.useSearch();
  const order: FeedOrder = ordem ?? "novo";
  const navigate = useNavigate();
  const { data: catalog } = useCatalog();
  const { ids, isLoading: loadingMine, leave, join } = useMyCommunities(userId);
  const { data: overview } = useCommunityOverview();
  const [applying, setApplying] = useState<string | null>(null);

  const mine = ids
    .map((id) => catalog?.professions.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const selected = mine.find((p) => p.id === grupo);
  // dá para ver um grupo sem participar dele; avisos só chegam a quem entra
  const visiting = !selected && grupo ? catalog?.professions.get(grupo) : undefined;
  const feedIds = selected ? [selected.id] : visiting ? [visiting.id] : ids;
  const { data: posts, isLoading: loadingFeed } = useCommunityFeed(feedIds, !!userId, order);

  const postIds = posts?.map((p) => p.id) ?? [];
  const slots = usePostStats(postIds);
  const distances = usePostDistances(userId, postIds);

  if (!ready) return <p className="text-muted-foreground">Carregando…</p>;

  if (!userId) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Entre para participar dos grupos da sua profissão.</p>
          <Button asChild>
            <Link to="/auth">Entrar ou criar conta</Link>
          </Button>
          <p>
            <Link to="/comunidade/grupos" className="text-sm font-bold underline">
              Ver os grupos
            </Link>
          </p>
        </div>
      </div>
    );
  }

  async function apply(postUser: string, postId: string, slug: string | null | undefined) {
    setApplying(postId);
    try {
      await openConversation(userId!, postUser, postId);
      navigate({
        to: "/conversas/$slug",
        params: { slug: profileParam({ id: postUser, slug }) },
      });
    } catch (e) {
      showInterestError(e);
    } finally {
      setApplying(null);
    }
  }

  const openJobs = (selected ? [selected.id] : ids).reduce(
    (sum, id) => sum + (overview?.get(id)?.open_jobs ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <Header />

      {mine.length > 0 && (
        <>
          <nav aria-label="Seus grupos" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2 pb-1">
              <li>
                <Chip active={!selected} to={undefined}>
                  Todos
                </Chip>
              </li>
              {mine.map((p) => (
                <li key={p.id}>
                  <Chip active={selected?.id === p.id} to={p.id}>
                    {p.name}
                  </Chip>
                </li>
              ))}
              <li>
                <Link
                  to="/comunidade/grupos"
                  className="block whitespace-nowrap rounded-full border-2 border-dashed border-foreground px-3 py-1.5 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-150 hover:bg-foreground/[0.07] hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] active:scale-95"
                >
                  + Grupos
                </Link>
              </li>
            </ul>
          </nav>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {groupsSummary(selected ? 1 : mine.length, openJobs)}
            </p>
            {selected && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  leave(selected.id)
                    .then(() => {
                      toast.success(`Você saiu do grupo ${selected.name}.`);
                      navigate({ to: "/comunidade", search: { grupo: undefined } });
                    })
                    .catch(() => toast.error("Não consegui sair. Tente de novo."));
                }}
              >
                Sair do grupo
              </Button>
            )}
          </div>
        </>
      )}

      {visiting && (
        <div className="block-card flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="text-sm">
            Você está vendo <strong>{visiting.name}</strong>. Entre no grupo para receber avisos das
            novas vagas.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              join(visiting.id)
                .then(() => toast.success(`Você entrou no grupo ${visiting.name}.`))
                .catch(() => toast.error("Não consegui entrar. Tente de novo."));
            }}
          >
            Entrar no grupo
          </Button>
        </div>
      )}

      {(mine.length > 0 || visiting) && (
        <div role="group" aria-label="Ordenar vagas" className="flex flex-wrap gap-2">
          {FEED_ORDERS.map((o) => (
            <Link
              key={o}
              to="/comunidade"
              search={{ grupo, ordem: o === "novo" ? undefined : o }}
              aria-current={order === o ? "true" : undefined}
              className={
                "rounded-full border-2 border-foreground px-3 py-1 text-xs font-semibold " +
                (order === o ? "bg-foreground text-background" : "")
              }
            >
              {FEED_ORDER_LABEL[o]}
            </Link>
          ))}
        </div>
      )}

      {!loadingMine && mine.length === 0 && !visiting && (
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Você ainda não está em nenhum grupo.</p>
          <p className="text-sm text-muted-foreground">
            Entre nos grupos da sua área para ver as vagas dela aqui, como num feed.
          </p>
          <Button asChild>
            <Link to="/comunidade/grupos">Escolher grupos</Link>
          </Button>
        </div>
      )}

      {loadingFeed && <p className="text-muted-foreground">Carregando vagas…</p>}
      {(mine.length > 0 || visiting) && !loadingFeed && posts?.length === 0 && (
        <p className="block-card p-5 text-center text-muted-foreground">
          Nenhuma vaga {selected ? `de ${selected.name}` : "nos seus grupos"} por enquanto. Quando
          surgir, avisamos você.
        </p>
      )}
      <ul className="space-y-3">
        {posts?.map((p) => (
          <li key={p.id}>
            <CommunityPostCard
              post={p}
              slots={slots[p.id]}
              distance={distances.get(p.id)}
              mine={p.user_id === userId}
              busy={applying === p.id}
              onApply={() => void apply(p.user_id, p.id, p.profiles?.slug)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between gap-2">
      <h1 className="flex items-center gap-2 text-2xl">
        <Users className="h-6 w-6" aria-hidden="true" /> Comunidade
      </h1>
      <Link to="/canais" className="text-sm font-bold underline">
        Ver canais das empresas →
      </Link>
    </header>
  );
}

function Chip({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <Link
      to="/comunidade"
      search={{ grupo: to, ordem: undefined }}
      aria-current={active ? "page" : undefined}
      className={
        "block whitespace-nowrap rounded-full border-2 border-foreground px-3 py-1.5 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-150 hover:bg-foreground/[0.07] hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] active:scale-95 " +
        (active ? "bg-foreground text-background" : "")
      }
    >
      {children}
    </Link>
  );
}
