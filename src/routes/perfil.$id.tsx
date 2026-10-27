import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Award, Briefcase, MapPin, MessageCircle, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { AdSlot } from "@/components/AdSlot";
import { SelfDeclared, SkillCard, StarInput, Stars } from "@/components/profile-bits";
import { useAuth } from "@/lib/auth";
import { initials, openConversation, timeAgo } from "@/lib/data";
import { limitMessage } from "@/lib/plans";
import { SKILL_COLUMNS, formatRating, sortSkills, type ProfileSkill } from "@/lib/skills";

export const Route = createFileRoute("/perfil/$id")({
  validateSearch: (s: Record<string, unknown>) => ({
    post: typeof s["post"] === "string" ? (s["post"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Perfil — Beecos" },
      { name: "description", content: "Veja as habilidades, avaliações e publicações deste trabalhador no Beecos." },
      { property: "og:title", content: "Perfil — Beecos" },
      { property: "og:description", content: "Veja as habilidades, avaliações e publicações deste trabalhador no Beecos." },
    ],
  }),
  component: ProfilePage,
});

type ReviewRow = {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: { full_name: string } | null;
};

function ProfilePage() {
  const { id } = Route.useParams();
  const { post } = Route.useSearch();
  const { userId } = useAuth();
  const navigate = useNavigate();

  const { data, isError, refetch } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const [p, skills, posts, stats, reviews] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("profile_skills").select(SKILL_COLUMNS).eq("user_id", id),
        supabase
          .from("posts")
          .select("*, profiles(full_name, profile_skills(skill, level))")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("profile_rating_stats").select("review_count, avg_rating").eq("user_id", id).maybeSingle(),
        supabase
          .from("reviews")
          .select("id, reviewer_id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name)")
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
      const conv = await openConversation(userId, id, post ?? null);
      navigate({ to: "/mensagens/$id", params: { id: conv } });
    } catch (e) {
      toast.error(limitMessage(e) ?? "Não foi possível abrir a conversa");
    }
  }

  return (
    <div className="space-y-5">
      <section className="block-card p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-primary font-display text-xl">
            {initials(pr.full_name)}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight">{pr.full_name || "Usuário"}</h1>
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
          {pr.experience_years != null && (
            <li className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 shrink-0" />
              {pr.experience_years === 0
                ? "Começando agora"
                : `${pr.experience_years} ${pr.experience_years === 1 ? "ano" : "anos"} de experiência`}
            </li>
          )}
          {pr.service_area && (
            <li className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4 shrink-0" /> Atende: {pr.service_area}
            </li>
          )}
          {pr.certificate_note && (
            <li className="flex items-start gap-2">
              <Award className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {pr.certificate_note} <span className="text-xs text-muted-foreground">(informado pelo próprio profissional)</span>
              </span>
            </li>
          )}
        </ul>

        {pr.bio && <p className="mt-3">{pr.bio}</p>}

        {userId === id ? (
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/painel">Editar meu perfil</Link>
          </Button>
        ) : (
          <Button size="lg" className="mt-4 w-full" onClick={chat}>
            <MessageCircle /> Conversar e negociar
          </Button>
        )}
      </section>

      {data.skills.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">Habilidades</h2>
          <SelfDeclared />
          {data.skills.map((sk) => (
            <SkillCard key={sk.skill} skill={sk} />
          ))}
        </section>
      )}

      <Reviews profileId={id} viewerId={userId} data={data} />

      <h2 className="text-xl">Publicações</h2>
      {data.posts.length === 0 && <p className="text-muted-foreground">Nenhuma publicação.</p>}
      {data.posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}

      <AdSlot placement="profile" />
    </div>
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
      const { data: ok, error } = await supabase.rpc("can_review", { _reviewer: viewerId!, _reviewee: profileId });
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
      : await supabase.from("reviews").insert({ reviewer_id: viewerId!, reviewee_id: profileId, rating, comment: text });
    if (error) {
      toast.error("Não foi possível salvar a avaliação");
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
    <section className="space-y-3">
      <h2 className="text-xl">Avaliações</h2>

      {isOther && !mine && canReview === false && (
        <p className="text-sm text-muted-foreground">
          Você poderá avaliar depois de conversar com esta pessoa (os dois precisam ter enviado mensagem).
        </p>
      )}

      {showForm && (
        <form onSubmit={save} className="block-card space-y-3 p-4">
          <p className="font-semibold">{mine ? "Editar sua avaliação" : "Avaliar este profissional"}</p>
          <StarInput value={rating} onChange={setRating} />
          <Textarea
            placeholder="Como foi o serviço? (opcional)"
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Salvar avaliação</Button>
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
              <button type="button" onClick={startEdit}>Editar</button>
              <button type="button" onClick={remove}>Apagar</button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
