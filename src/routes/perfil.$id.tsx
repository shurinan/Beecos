import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { initials, openConversation } from "@/lib/data";
import { limitMessage } from "@/lib/plans";

export const Route = createFileRoute("/perfil/$id")({
  validateSearch: (s: Record<string, unknown>) => ({
    post: typeof s["post"] === "string" ? (s["post"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Perfil — Beecos" },
      { name: "description", content: "Veja as habilidades e publicações deste trabalhador no Beecos." },
      { property: "og:title", content: "Perfil — Beecos" },
      { property: "og:description", content: "Veja as habilidades e publicações deste trabalhador no Beecos." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const { post } = Route.useSearch();
  const { userId } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const [p, posts] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("posts")
          .select("*, profiles(full_name, skills)")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
      ]);
      return { profile: p.data, posts: (posts.data ?? []) as PostWithAuthor[] };
    },
  });

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
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground bg-primary font-display text-xl">
            {initials(pr.full_name)}
          </span>
          <div>
            <h1 className="text-2xl leading-tight">{pr.full_name || "Usuário"}</h1>
            {pr.city && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {pr.city}
              </p>
            )}
          </div>
        </div>
        {pr.available && (
          <p className="mt-3 inline-block rounded bg-secondary px-2 py-1 text-xs font-bold uppercase text-secondary-foreground">
            ● Disponível para trabalhar
          </p>
        )}
        {pr.bio && <p className="mt-3">{pr.bio}</p>}
        {pr.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pr.skills.map((s) => (
              <span key={s} className="rounded-full border-2 border-foreground px-3 py-0.5 text-sm font-semibold">
                {s}
              </span>
            ))}
          </div>
        )}
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
      <h2 className="text-xl">Publicações</h2>
      {data.posts.length === 0 && <p className="text-muted-foreground">Nenhuma publicação.</p>}
      {data.posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
