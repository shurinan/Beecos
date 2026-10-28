import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PostActions } from "@/components/PostActions";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { usePostDistances } from "@/lib/geo";
import { usePostStats } from "@/lib/services-hooks";
import { useInterestCounts } from "@/lib/community";
import { postParams } from "@/lib/urls";

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
      <PostActions post={post} />
      {mine && (post as { hidden_at?: string | null }).hidden_at && (
        <p role="note" className="rounded border-2 border-destructive p-3 text-sm">
          <b>Esta vaga está oculta.</b> A moderação a tirou das listas e das buscas. Se achar que foi
          um engano, fale com o suporte.
        </p>
      )}
    </div>
  );
}
