import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/sugestoes")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Sugestões — Beecos" }, { name: "robots", content: "noindex" }] }),
  component: Suggestions,
});

type Row = {
  id: string;
  body: string;
  status: "new" | "read" | "done";
  created_at: string;
  profiles: { full_name: string; slug: string | null } | null;
};

const STATUS = { new: "Nova", read: "Lida", done: "Feita" } as const;

function Suggestions() {
  const qc = useQueryClient();
  const { data: isMod, isLoading: checking } = useQuery({
    queryKey: ["is-moderator"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_moderator");
      if (error) throw error;
      return !!data;
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: ["suggestions"],
    enabled: isMod === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("id, body, status, created_at, profiles(full_name, slug)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  async function mark(id: string, status: Row["status"]) {
    const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
    if (error) toast.error("Não foi possível salvar.");
    else await qc.invalidateQueries({ queryKey: ["suggestions"] });
  }

  if (checking) return <p className="text-muted-foreground">Carregando…</p>;
  if (!isMod) return <p className="text-muted-foreground">Esta página é só para a moderação.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Sugestões</h1>
      <p>
        <Link to="/moderacao" className="text-sm font-bold underline">
          Ir para as denúncias
        </Link>
      </p>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data?.length === 0 && <p className="text-muted-foreground">Nenhuma ideia por enquanto.</p>}
      <ul className="space-y-3">
        {data?.map((s) => (
          <li key={s.id} className="block-card space-y-2 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {s.profiles?.slug ? `@${s.profiles.slug}` : (s.profiles?.full_name ?? "—")} ·{" "}
                {timeAgo(s.created_at)}
              </span>
              <span className="font-bold">{STATUS[s.status]}</span>
            </div>
            <p className="selectable whitespace-pre-wrap">{s.body}</p>
            <div className="flex gap-2">
              {s.status !== "read" && (
                <Button size="sm" variant="outline" onClick={() => void mark(s.id, "read")}>
                  Marcar como lida
                </Button>
              )}
              {s.status !== "done" && (
                <Button size="sm" variant="outline" onClick={() => void mark(s.id, "done")}>
                  Feita
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
