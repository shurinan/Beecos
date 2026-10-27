import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useEngagementActions } from "@/components/EngagementCard";
import { Avatar, Stars } from "@/components/profile-bits";
import { useUnread } from "@/lib/chat-hooks";
import { KIND_LABEL, timeAgo, type PostKind } from "@/lib/data";
import { formatRating, levelLabel, topSkill, type SkillBase } from "@/lib/skills";
import {
  STATUS_LABEL,
  chooseLabel,
  isFilled,
  rankByArrival,
  vacanciesLabel,
  type EngagementStatus,
} from "@/lib/services";
import { usePostStats } from "@/lib/services-hooks";

export const Route = createFileRoute("/_authenticated/publicacao/$id")({
  head: () => ({
    meta: [
      { title: "Interessados — Beecos" },
      { name: "description", content: "Veja quem se interessou pela sua publicação e escolha." },
    ],
  }),
  component: Interested,
});

type Person = {
  id: string;
  full_name: string;
  headline: string;
  avatar_path: string | null;
  profile_skills: SkillBase[];
};
type ConvRow = {
  id: string;
  created_at: string;
  last_message_at: string;
  user_a: string;
  user_b: string;
  a: Person | null;
  b: Person | null;
};

const PERSON = "id, full_name, headline, avatar_path, profile_skills(skill, level)";

function Interested() {
  const { id } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const act = useEngagementActions(userId);
  const { byConversation } = useUnread(userId);
  const slots = usePostStats([id])[id];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["engagements", "interested", id],
    queryFn: async () => {
      const post = await supabase
        .from("posts")
        .select("id, kind, title, vacancies, user_id")
        .eq("id", id)
        .maybeSingle();
      if (post.error) throw post.error;
      if (!post.data) return { post: null, people: [] };
      const convs = await supabase
        .from("conversations")
        .select(
          `id, created_at, last_message_at, user_a, user_b, a:profiles!conversations_user_a_fkey(${PERSON}), b:profiles!conversations_user_b_fkey(${PERSON})`,
        )
        .eq("post_id", id);
      if (convs.error) throw convs.error;
      const rows = (convs.data ?? []) as unknown as ConvRow[];
      const convIds = rows.map((c) => c.id);
      const people = rows.map((c) => (c.user_a === userId ? c.b : c.a)).filter(Boolean) as Person[];
      const [eng, msgs, ratings] = await Promise.all([
        convIds.length
          ? supabase
              .from("engagements")
              .select("id, conversation_id, status")
              .in("conversation_id", convIds)
          : Promise.resolve({ data: [], error: null }),
        convIds.length
          ? supabase
              .from("messages")
              .select("conversation_id, sender_id")
              .in("conversation_id", convIds)
              .eq("kind", "user")
              .limit(2000)
          : Promise.resolve({ data: [], error: null }),
        people.length
          ? supabase
              .from("profile_rating_stats")
              .select("user_id, review_count, avg_rating")
              .in(
                "user_id",
                people.map((p) => p.id),
              )
          : Promise.resolve({ data: [], error: null }),
      ]);
      const error = eng.error ?? msgs.error ?? ratings.error;
      if (error) throw error;
      const engByConv = new Map((eng.data ?? []).map((e) => [e.conversation_id, e]));
      const replied = new Set((msgs.data ?? []).map((m) => `${m.conversation_id}:${m.sender_id}`));
      const ratingBy = new Map((ratings.data ?? []).map((r) => [r.user_id, r]));
      return {
        post: post.data,
        people: rankByArrival(rows).map((c) => {
          const person = (c.user_a === userId ? c.b : c.a) as Person | null;
          const e = engByConv.get(c.id);
          const r = person ? ratingBy.get(person.id) : undefined;
          return {
            conversationId: c.id,
            created_at: c.created_at,
            last_message_at: c.last_message_at,
            rank: c.rank,
            person,
            replied: !!person && replied.has(`${c.id}:${person.id}`),
            engagement: e ? { id: e.id, status: e.status as EngagementStatus } : null,
            reviewCount: r?.review_count ?? 0,
            avgRating: r?.avg_rating ?? null,
          };
        }),
      };
    },
  });

  if (isError) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível carregar os interessados.</p>
        <Button onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  const post = data?.post;
  if (!post || post.user_id !== userId) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Publicação não encontrada.</p>
        <Link to="/painel" className="text-sm font-semibold underline">
          Voltar para o meu perfil
        </Link>
      </div>
    );
  }

  const isJob = post.kind === "job";
  const full = isJob && isFilled(slots);
  const who = isJob ? "Prestador" : "Interessado";

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/painel"
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold underline"
        >
          <ArrowLeft className="h-4 w-4" /> Meu perfil
        </Link>
        <h1 className="text-2xl leading-tight">Interessados</h1>
        <p className="font-semibold">{post.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-bold uppercase text-secondary-foreground">
            {KIND_LABEL[post.kind as PostKind]}
          </span>
          {isJob && vacanciesLabel(slots ?? { vacancies: post.vacancies, taken: 0 })}
        </p>
      </div>

      {data.people.length === 0 && (
        <p className="rounded-lg border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
          Ninguém entrou em contato ainda. Quando alguém tocar em "Conversar" na sua publicação,
          aparece aqui.
        </p>
      )}
      {!isJob && data.people.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Esta é uma oferta sua: quem se interessar contrata você pelo chat.
        </p>
      )}

      {data.people.map((c) => {
        const p = c.person;
        const top = topSkill(p?.profile_skills);
        const e = c.engagement;
        const open = !e || e.status === "cancelled";
        const unread = byConversation[c.conversationId] ?? 0;
        const name = p?.full_name || "Usuário";
        return (
          <article
            key={c.conversationId}
            className={
              "block-card space-y-3 p-4 " + (e && e.status !== "cancelled" ? "bg-primary/10" : "")
            }
          >
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                {c.rank}
              </span>
              <Avatar name={name} path={p?.avatar_path} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  {who} {c.rank}
                </p>
                {p ? (
                  <Link
                    to="/perfil/$id"
                    params={{ id: p.id }}
                    search={{ post: undefined }}
                    className="block truncate font-bold underline"
                  >
                    {name}
                  </Link>
                ) : (
                  <span className="font-bold">{name}</span>
                )}
                {(p?.headline || top) && (
                  <p className="truncate text-sm text-muted-foreground">
                    {p?.headline || `${top!.skill} · ${levelLabel(top!.level)}`}
                  </p>
                )}
                {c.reviewCount > 0 && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs">
                    <Stars value={Math.round(Number(c.avgRating ?? 0))} size={12} />
                    {formatRating(c.avgRating)} ({c.reviewCount})
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Conversa ativa {timeAgo(c.last_message_at)}
                </p>
              </div>
              {e && (
                <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs font-bold uppercase text-secondary-foreground">
                  {STATUS_LABEL[e.status]}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/mensagens/$id" params={{ id: c.conversationId }}>
                  <MessageCircle /> Conversar
                  {unread > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                      {unread}
                    </span>
                  )}
                </Link>
              </Button>
              {isJob && open && (
                <ConfirmButton
                  size="sm"
                  variant="default"
                  loading={act.busy}
                  disabled={!c.replied || full}
                  title={`${chooseLabel(post.kind)}: ${name}?`}
                  description={`${name} vai receber o aviso e precisa aceitar. Você poderá desfazer a escolha enquanto o serviço não for concluído.`}
                  confirmLabel="Escolher"
                  onConfirm={() => act.choose(c.conversationId, `${name} foi escolhido(a)`)}
                >
                  <CheckCircle2 /> {chooseLabel(post.kind)}
                </ConfirmButton>
              )}
            </div>
            {isJob && open && !c.replied && (
              <p className="text-xs text-muted-foreground">
                Você poderá escolher quando {name} responder na conversa.
              </p>
            )}
            {isJob && open && c.replied && full && (
              <p className="text-xs text-muted-foreground">Todas as vagas estão preenchidas.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
