import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { AdSlot } from "@/components/AdSlot";
import { FEED_AD_AFTER, shouldShowFeedAd } from "@/lib/ads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { PostKind } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Beecos — Vagas e trabalhadores na sua cidade" },
      { name: "description", content: "Veja vagas de trabalho braçal e profissionais disponíveis na sua cidade. Negocie direto pelo chat." },
      { property: "og:title", content: "Beecos — Vagas e trabalhadores na sua cidade" },
      { property: "og:description", content: "Veja vagas de trabalho braçal e profissionais disponíveis na sua cidade." },
    ],
  }),
  component: Index,
});

function Index() {
  const [kind, setKind] = useState<PostKind>("job");
  const [city, setCity] = useState("");
  const { userId } = useAuth();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts", kind, city.trim().toLowerCase()],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select("*, profiles(full_name, profile_skills(skill, level))")
        .eq("kind", kind)
        .order("created_at", { ascending: false })
        .limit(50);
      if (city.trim()) q = q.ilike("city", `%${city.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as PostWithAuthor[];
    },
  });

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl leading-none">
          Trabalho pesado,
          <br />
          <span className="bg-primary px-1">negócio direto.</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Ache um bico ou alguém pra ajudar. Combine o preço no chat.
        </p>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link to={userId ? "/painel" : "/auth"}>
            <Plus /> Publicar vaga ou disponibilidade
          </Link>
        </Button>
      </section>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border-2 border-foreground">
        {(["job", "available"] as PostKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={
              "py-2.5 text-sm font-bold " +
              (kind === k ? "bg-foreground text-background" : "bg-background text-foreground")
            }
          >
            {k === "job" ? "Vagas" : "Trabalhadores"}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Filtrar por cidade"
          className="h-11 border-2 pl-9"
        />
      </div>

      <div className="space-y-4">
        {isLoading && <p className="text-center text-muted-foreground">Carregando…</p>}
        {posts?.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-foreground/40 p-8 text-center text-muted-foreground">
            Nada por aqui ainda{city ? ` em "${city}"` : ""}. Seja o primeiro a publicar!
          </div>
        )}
        {posts?.map((p, i) => (
          <div key={p.id} className="space-y-4">
            <PostCard post={p} />
            {i === FEED_AD_AFTER - 1 && shouldShowFeedAd(posts.length) && <AdSlot placement="feed" />}
          </div>
        ))}
      </div>
    </div>
  );
}
