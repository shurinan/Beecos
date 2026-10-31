import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CommunityPostCard } from "@/components/CommunityPostCard";
import { ReportButton } from "@/components/ReportButton";
import { Seal } from "@/components/Seal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useBadge } from "@/lib/badges";
import { useCatalog } from "@/lib/catalog";
import { deadlineLabel, useChannel, useChannelFeed, useFollow } from "@/lib/channels";
import { FEED_ORDERS, FEED_ORDER_LABEL, type FeedOrder } from "@/lib/community";
import { initials, openConversation } from "@/lib/data";
import { usePostDistances } from "@/lib/geo";
import { showInterestError } from "@/lib/interest";
import { usePostStats } from "@/lib/services-hooks";
import { profileParam } from "@/lib/urls";

export const Route = createFileRoute("/_authenticated/canais/$slug")({
  staticData: { sitemap: false },
  validateSearch: (q: Record<string, unknown>): { ordem?: FeedOrder | undefined } => ({
    ordem: FEED_ORDERS.find((o) => o === q["ordem"]),
  }),
  head: () => ({ meta: [{ title: "Canal — Beecos" }] }),
  component: ChannelPage,
});

function ChannelPage() {
  const { slug } = Route.useParams();
  const { ordem } = Route.useSearch();
  const order: FeedOrder = ordem ?? "novo";
  const { userId } = useAuth();
  const navigate = useNavigate();
  const { data: catalog } = useCatalog();
  const { data, isLoading } = useChannel(slug);
  const { follow, unfollow } = useFollow(userId);
  const { data: posts, isLoading: loadingFeed } = useChannelFeed(data?.channel.id, order);
  const { tier } = useBadge(data?.channel.owner_id);
  const [applying, setApplying] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const postIds = posts?.map((p) => p.id) ?? [];
  const slots = usePostStats(postIds);
  const distances = usePostDistances(userId, postIds);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!data)
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Canal não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/canais">Ver canais</Link>
        </Button>
      </div>
    );

  const { channel, numbers } = data;
  const mine = channel.owner_id === userId;
  const names = channel.channel_professions
    .map((p) => catalog?.professions.get(p.profession_id)?.name)
    .filter((n): n is string => !!n);

  async function toggleFollow() {
    setBusy(true);
    try {
      if (numbers.following) await unfollow(channel.id);
      else await follow(channel.id);
    } catch {
      toast.error("Não consegui atualizar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function apply(postUser: string, postId: string, pslug: string | null | undefined) {
    setApplying(postId);
    try {
      await openConversation(userId!, postUser, postId);
      navigate({
        to: "/conversas/$slug",
        params: { slug: profileParam({ id: postUser, slug: pslug }) },
      });
    } catch (e) {
      showInterestError(e);
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="block-card space-y-3 p-5 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground bg-primary font-display text-xl"
        >
          {initials(channel.name)}
        </span>
        <h1 className="flex items-center justify-center gap-2 text-2xl">
          {channel.name} {tier && <Seal tier={tier} size={22} />}
        </h1>
        <p className="text-sm text-muted-foreground">
          Canal · {numbers.followers} {numbers.followers === 1 ? "seguidor" : "seguidores"} ·{" "}
          {numbers.open_jobs} {numbers.open_jobs === 1 ? "vaga aberta" : "vagas abertas"}
        </p>
        {channel.description && <p className="text-sm">{channel.description}</p>}
        {names.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-1.5">
            {names.map((n) => (
              <li
                key={n}
                className="rounded border-[1.5px] border-foreground bg-accent px-2 py-0.5 text-xs font-bold"
              >
                {n}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Prazo padrão das vagas: {deadlineLabel(channel.default_days)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {mine ? (
            <Button asChild>
              <Link to="/publicar" search={{ tipo: "contratar", canal: channel.id }}>
                Publicar vaga neste canal
              </Link>
            </Button>
          ) : (
            <Button
              variant={numbers.following ? "outline" : "default"}
              disabled={busy}
              onClick={() => void toggleFollow()}
            >
              {numbers.following ? "✓ Seguindo" : "Seguir"}
            </Button>
          )}
          {!mine && <ReportButton type="channel" targetId={channel.id} what="este canal" />}
        </div>
        {!numbers.following && !mine && (
          <p className="text-xs text-muted-foreground">
            Sem seguir você vê tudo, mas não recebe avisos das vagas novas.
          </p>
        )}
      </header>

      <div role="group" aria-label="Ordenar vagas" className="flex flex-wrap gap-2">
        {FEED_ORDERS.map((o) => (
          <Link
            key={o}
            to="/canais/$slug"
            params={{ slug }}
            search={{ ordem: o === "novo" ? undefined : o }}
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

      {loadingFeed && <p className="text-muted-foreground">Carregando vagas…</p>}
      {!loadingFeed && posts?.length === 0 && (
        <p className="block-card p-5 text-center text-muted-foreground">
          Nenhuma vaga aberta neste canal por enquanto.
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
