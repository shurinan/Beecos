import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Award,
  Crown,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Route as RouteIcon,
  Smartphone,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { AdSlot } from "@/components/AdSlot";
import { Avatar, SelfDeclared, SkillCard, StarInput, Stars } from "@/components/profile-bits";
import { useAuth } from "@/lib/auth";
import { isUuid, openConversation, timeAgo } from "@/lib/data";
import { profileParam } from "@/lib/urls";
import { ReportButton } from "@/components/ReportButton";
import { usePremiumIds } from "@/lib/discovery";
import { useCatalog } from "@/lib/catalog";
import { showInterestError } from "@/lib/interest";
import { PHONE_KIND_LABEL, formatMethods, type ContactPhone } from "@/lib/contact";
import { telUrl, whatsappUrl } from "@/lib/services";
import { usePostStats } from "@/lib/services-hooks";
import { BLOCKED_TEXT_MESSAGE, isBlockedTextError, replySpeedLabel } from "@/lib/chat";
import { SKILL_COLUMNS, formatRating, sortSkills, type ProfileSkill } from "@/lib/skills";

export const Route = createFileRoute("/perfil/$slug")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>) => ({
    post: typeof s["post"] === "string" ? (s["post"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Perfil — Beecos" },
      {
        name: "description",
        content: "Veja as habilidades, avaliações e publicações deste trabalhador no Beecos.",
      },
      { property: "og:title", content: "Perfil — Beecos" },
      {
        property: "og:description",
        content: "Veja as habilidades, avaliações e publicações deste trabalhador no Beecos.",
      },
    ],
  }),
  component: ProfileRoute,
});

type ReviewRow = {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: { full_name: string } | null;
};

/**
 * O endereço traz o nome legível (/perfil/bruno-espindola). Aqui ele vira o id da pessoa; um link
 * antigo com o id continua abrindo e é trocado pelo endereço bonito.
 */
function ProfileRoute() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const byId = isUuid(slug);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile-ref", slug],
    queryFn: async () => {
      const q = supabase.from("profiles").select("id, slug");
      const { data, error } = await (byId ? q.eq("id", slug) : q.eq("slug", slug)).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const pretty = data?.slug && byId ? data.slug : null;
  useEffect(() => {
    if (pretty) navigate({ to: "/perfil/$slug", params: { slug: pretty }, search, replace: true });
  }, [pretty, navigate, search]);
  if (byId) return <ProfilePage id={slug} />; // não espera a consulta: o perfil já carrega pelo id
  if (isLoading) return <p className="text-center text-muted-foreground">Carregando…</p>;
  if (isError) {
    return (
      <p className="text-center">
        Entre na sua conta para ver este perfil.{" "}
        <Link to="/auth" className="font-bold underline">
          Entrar
        </Link>
      </p>
    );
  }
  if (!data) return <p className="text-center">Perfil não encontrado.</p>;
  return <ProfilePage id={data.id} />;
}

function ProfilePage({ id }: { id: string }) {
  const { post } = Route.useSearch();
  const { userId, ready } = useAuth();
  const navigate = useNavigate();
  const premium = usePremiumIds([id]).has(id);
  const { data: catalog } = useCatalog();

  const { data: replyStats } = useQuery({
    queryKey: ["reply-stats", id],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("reply_stats", { _user: id });
      const r = data?.[0];
      return r ? { replies: Number(r.replies), median_seconds: Number(r.median_seconds) } : null;
    },
  });
  const speed = replySpeedLabel(replyStats);

  const { data, isError, refetch } = useQuery({
    queryKey: ["profile", id],
    // perfis só podem ser lidos por quem tem conta
    enabled: !!userId,
    queryFn: async () => {
      const [p, skills, posts, stats, reviews] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("profile_skills").select(SKILL_COLUMNS).eq("user_id", id),
        supabase
          .from("posts")
          .select(
            "*, professions(name, slug), services(name), post_photos(id, path, sort), profiles!posts_user_id_fkey(full_name, slug, profile_skills(skill, level))",
          )
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profile_rating_stats")
          .select("review_count, avg_rating")
          .eq("user_id", id)
          .maybeSingle(),
        supabase
          .from("reviews")
          .select(
            "id, reviewer_id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name)",
          )
          .eq("reviewee_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const error = p.error ?? skills.error ?? posts.error ?? reviews.error;
      if (error) throw error;
      return {
        profile: p.data,
        skills: sortSkills((skills.data ?? []) as ProfileSkill[]),
        posts: (posts.data ?? []) as PostWithAuthor[],
        reviewCount: stats.data?.review_count ?? 0,
        avgRating: stats.data?.avg_rating ?? null,
        reviews: (reviews.data ?? []) as unknown as ReviewRow[],
      };
    },
  });

  const slots = usePostStats(data?.posts.map((p) => p.id));

  if (ready && !userId) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Entre para ver este perfil.</p>
        <p className="text-sm text-muted-foreground">
          Os perfis são vistos só por quem tem conta no Beecos.
        </p>
        <Button asChild>
          <Link to="/auth">Entrar ou criar conta</Link>
        </Button>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível carregar este perfil.</p>
        <Button onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }
  if (!data) return <p className="text-center text-muted-foreground">Carregando…</p>;
  if (!data.profile) return <p className="text-center">Perfil não encontrado.</p>;
  const pr = data.profile;

  async function chat() {
    if (!userId) return navigate({ to: "/auth" });
    try {
      await openConversation(userId, id, post ?? null);
      navigate({ to: "/conversas/$slug", params: { slug: profileParam(pr) } });
    } catch (e) {
      showInterestError(e);
    }
  }

  return (
    <div className="space-y-5">
      <section className="block-card p-5">
        <div className="flex items-center gap-4">
          <Avatar name={pr.full_name} path={pr.avatar_path} size={64} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl leading-tight">
              {pr.slug ? `@${pr.slug}` : pr.full_name || "Usuário"}
            </h1>
            {pr.slug && <p className="truncate font-semibold">{pr.full_name}</p>}
            {premium && (
              <p className="mt-1 inline-flex items-center gap-1 rounded bg-foreground px-2 py-0.5 text-xs font-bold uppercase text-background">
                <Crown className="h-3 w-3" aria-hidden="true" /> Premium
              </p>
            )}
            {speed && (
              <p className="mt-1 inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                <Zap className="h-3 w-3" /> {speed}
              </p>
            )}
            {pr.headline && <p className="font-semibold">{pr.headline}</p>}
            {pr.city && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {pr.city}
              </p>
            )}
          </div>
        </div>

        {data.reviewCount > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Stars value={Number(data.avgRating)} />
            <b>{formatRating(data.avgRating)}</b>
            <span className="text-muted-foreground">
              ({data.reviewCount} {data.reviewCount === 1 ? "avaliação" : "avaliações"})
            </span>
          </p>
        )}

        {pr.available && (
          <p className="mt-3 inline-block rounded bg-secondary px-2 py-1 text-xs font-bold uppercase text-secondary-foreground">
            ● Disponível para trabalhar
          </p>
        )}

        <ul className="mt-3 space-y-1 text-sm">
          {pr.service_area && (
            <li className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4 shrink-0" /> Atende: {pr.service_area}
            </li>
          )}
          {pr.certificate_note && (
            <li className="flex items-start gap-2">
              <Award className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {pr.certificate_note}{" "}
                <span className="text-xs text-muted-foreground">
                  (informado pelo próprio profissional)
                </span>
              </span>
            </li>
          )}
        </ul>

        {pr.bio && <p className="mt-3">{pr.bio}</p>}

        {userId === id ? (
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/perfil">Editar meu perfil</Link>
          </Button>
        ) : (
          <Button size="lg" className="mt-4 w-full" onClick={chat}>
            <MessageCircle /> Conversar e negociar
          </Button>
        )}
        {userId && userId !== id && (
          <p className="mt-3 text-center">
            <ReportButton type="profile" targetId={id} what="este perfil" />
          </p>
        )}
      </section>

      <SharedContacts ownerId={id} viewerId={userId} />

      {data.skills.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">Habilidades e experiência</h2>
          <SelfDeclared />
          {data.skills.map((sk) => (
            <SkillCard
              key={sk.skill}
              skill={sk}
              services={(sk.service_ids ?? []).flatMap(
                (sid) => catalog?.services.get(sid)?.name ?? [],
              )}
            />
          ))}
        </section>
      )}

      <Reviews profileId={id} viewerId={userId} data={data} />

      <h2 className="text-xl">Publicações</h2>
      {data.posts.length === 0 && <p className="text-muted-foreground">Nenhuma publicação.</p>}
      {data.posts.map((p) => (
        <PostCard key={p.id} post={p} slots={slots[p.id]} />
      ))}

      <AdSlot placement="profile" />
    </div>
  );
}

/** Telefones que a pessoa escolheu mostrar para quem já conversou com ela (o banco decide quem vê). */
function SharedContacts({ ownerId, viewerId }: { ownerId: string; viewerId: string | null }) {
  const enabled = !!viewerId && viewerId !== ownerId;
  const { data: phones } = useQuery({
    queryKey: ["shared-phones", viewerId, ownerId],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_phones")
        .select("id, kind, number, methods, shared")
        .eq("user_id", ownerId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ContactPhone[];
    },
  });
  if (!enabled || !phones || phones.length === 0) return null;
  return (
    <section className="block-card space-y-3 p-5">
      <h2 className="text-xl">Contatos</h2>
      <p className="text-xs text-muted-foreground">Compartilhados porque vocês já conversaram.</p>
      <ul className="space-y-2">
        {phones.map((ph) => {
          const wa = ph.methods.includes("whatsapp") ? whatsappUrl(ph.number) : null;
          return (
            <li key={ph.id} className="space-y-2 rounded-lg border-2 border-foreground p-3">
              <p className="flex items-center gap-1.5 font-semibold">
                <Phone className="h-4 w-4" /> {ph.number}
              </p>
              <p className="text-sm text-muted-foreground">
                {PHONE_KIND_LABEL[ph.kind]} · aceita {formatMethods(ph.methods)}
              </p>
              <div className="flex flex-wrap gap-2">
                {wa && (
                  <Button asChild size="sm">
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      <MessageSquare /> WhatsApp
                    </a>
                  </Button>
                )}
                {ph.methods.includes("call") && (
                  <Button asChild size="sm" variant="outline">
                    <a href={telUrl(ph.number)}>
                      <Smartphone /> Ligar
                    </a>
                  </Button>
                )}
                {ph.methods.includes("sms") && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`sms:${telUrl(ph.number).slice(4)}`}>SMS</a>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Reviews({
  profileId,
  viewerId,
  data,
}: {
  profileId: string;
  viewerId: string | null;
  data: { reviews: ReviewRow[]; reviewCount: number };
}) {
  const qc = useQueryClient();
  const mine = viewerId ? data.reviews.find((r) => r.reviewer_id === viewerId) : undefined;
  const isOther = !!viewerId && viewerId !== profileId;

  const { data: canReview } = useQuery({
    queryKey: ["can-review", viewerId, profileId],
    enabled: isOther,
    queryFn: async () => {
      const { data: ok, error } = await supabase.rpc("can_review", {
        _reviewer: viewerId!,
        _reviewee: profileId,
      });
      if (error) throw error;
      return ok === true;
    },
  });

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  function startEdit() {
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Escolha uma nota de 1 a 5");
      return;
    }
    const text = comment.trim();
    const { error } = mine
      ? await supabase.from("reviews").update({ rating, comment: text }).eq("id", mine.id)
      : await supabase
          .from("reviews")
          .insert({ reviewer_id: viewerId!, reviewee_id: profileId, rating, comment: text });
    if (error) {
      toast.error(
        isBlockedTextError(error) ? BLOCKED_TEXT_MESSAGE : "Não foi possível salvar a avaliação",
      );
      return;
    }
    toast.success("Avaliação salva");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["profile", profileId] });
  }

  async function remove() {
    if (!mine) return;
    const { error } = await supabase.from("reviews").delete().eq("id", mine.id);
    if (error) {
      toast.error("Não foi possível apagar a avaliação");
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile", profileId] });
  }

  const showForm = isOther && (canReview || mine) && (editing || !mine);
  if (data.reviews.length === 0 && !isOther) return null;

  return (
    <section id="avaliar" className="scroll-mt-20 space-y-3">
      <h2 className="text-xl">Avaliações</h2>

      {isOther && !mine && canReview === false && (
        <p className="text-sm text-muted-foreground">
          Você poderá avaliar esta pessoa depois de concluir um serviço com ela.
        </p>
      )}

      {showForm && (
        <form onSubmit={save} className="block-card space-y-3 p-4">
          <p className="font-semibold">
            {mine ? "Editar sua avaliação" : "Avaliar este profissional"}
          </p>
          <StarInput value={rating} onChange={setRating} />
          <Textarea
            placeholder="Como foi o serviço? (opcional)"
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Salvar avaliação
            </Button>
            {mine && (
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}

      {data.reviews.length === 0 && isOther && canReview && !editing && (
        <p className="text-sm text-muted-foreground">Ainda sem avaliações. Seja o primeiro.</p>
      )}

      {data.reviews.map((r) => (
        <article key={r.id} className="rounded-lg border-2 border-foreground p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{r.reviewer?.full_name || "Usuário"}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
          </div>
          <Stars value={r.rating} size={14} />
          {r.comment && <p className="mt-1 whitespace-pre-wrap text-sm">{r.comment}</p>}
          {r.reviewer_id === viewerId && !editing && (
            <div className="mt-2 flex gap-3 text-sm font-semibold underline">
              <button type="button" onClick={startEdit}>
                Editar
              </button>
              <button type="button" onClick={remove}>
                Apagar
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
