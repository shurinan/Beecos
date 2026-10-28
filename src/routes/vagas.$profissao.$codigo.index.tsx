import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/ReportButton";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { openConversation } from "@/lib/data";
import { usePostDistances } from "@/lib/geo";
import { limitMessage } from "@/lib/plans";
import { usePostStats } from "@/lib/services-hooks";
import { useInterestCounts } from "@/lib/community";
import { postParams, profileParam } from "@/lib/urls";

export const Route = createFileRoute("/vagas/$profissao/$codigo/")({
  head: () => ({
    meta: [
      { title: "Vaga — Beecos" },
      { name: "description", content: "Veja os detalhes da vaga e converse direto no Beecos." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { profissao, codigo } = Route.useParams();
  const { userId, ready } = useAuth();
  const navigate = useNavigate();

  const {
    data: post,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["post-page", codigo, !!userId],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          userId
            ? "*, professions(name, slug), services(name), profiles(full_name, slug, avatar_path, profile_skills(skill, level))"
            : "*, professions(name, slug), services(name)",
        )
        .eq("slug", codigo)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PostWithAuthor | null;
    },
  });

  // a profissão no endereço segue a da vaga: se ela mudou, o link corrige sozinho
  const canonical = post
    ? postParams({ slug: post.slug ?? codigo, professions: post.professions ?? null })
    : null;
  useEffect(() => {
    if (canonical && canonical.profissao !== profissao) {
      navigate({ to: "/vagas/$profissao/$codigo", params: canonical, replace: true });
    }
  }, [canonical, profissao, navigate]);

  const slots = usePostStats(post ? [post.id] : []);
  const interest = useInterestCounts(post ? [post.id] : []);
  const distance = usePostDistances(userId, post ? [post.id] : []).get(post?.id ?? "");

  async function talk() {
    if (!post) return;
    if (!userId) return navigate({ to: "/auth" });
    try {
      await openConversation(userId, post.user_id, post.id);
      navigate({
        to: "/conversas/$slug",
        params: { slug: profileParam({ id: post.user_id, slug: post.profiles?.slug }) },
      });
    } catch (e) {
      toast.error(limitMessage(e) ?? "Não foi possível abrir a conversa");
    }
  }

  const back = (
    <Link
      to="/vagas"
      search={{ q: undefined, tipo: undefined }}
      className="mb-2 inline-flex items-center gap-1 text-sm font-semibold underline"
    >
      <ArrowLeft className="h-4 w-4" /> Todas as vagas
    </Link>
  );

  if (isError) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível carregar esta vaga.</p>
        <Button onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }
  if (isLoading || !ready) return <p className="text-center text-muted-foreground">Carregando…</p>;
  if (!post) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-semibold">Esta vaga não existe mais.</p>
        {back}
      </div>
    );
  }
  const mine = userId === post.user_id;
  return (
    <div className="space-y-4">
      {back}
      <PostCard
        post={post}
        slots={slots[post.id]}
        distance={distance}
        interested={interest.get(post.id) ?? 0}
        full
      />
      {mine ? (
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link
            to="/vagas/$profissao/$codigo/interessados"
            params={postParams({
              slug: post.slug ?? codigo,
              professions: post.professions ?? null,
            })}
          >
            <Users /> Ver interessados
          </Link>
        </Button>
      ) : (
        <Button size="lg" className="w-full" onClick={talk}>
          <MessageCircle /> {post.kind === "job" ? "Tenho interesse" : "Conversar e negociar"}
        </Button>
      )}
      {userId && !mine && (
        <div className="text-center">
          <ReportButton type="post" targetId={post.id} what="esta publicação" />
        </div>
      )}
      {mine && (post as { hidden_at?: string | null }).hidden_at && (
        <p role="note" className="rounded border-2 border-destructive p-3 text-sm">
          <b>Esta vaga está oculta.</b> A moderação a tirou das listas e das buscas. Se achar que foi
          um engano, fale com o suporte.
        </p>
      )}
    </div>
  );
}
