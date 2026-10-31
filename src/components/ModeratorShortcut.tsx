import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flag, Lightbulb, ShieldCheck, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Atalho do perfil só para moderadores: denúncias e sugestões, com a contagem do que espera. */
export function ModeratorShortcut() {
  const { data: isMod } = useQuery({
    queryKey: ["is-moderator"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_moderator");
      if (error) throw error;
      return !!data;
    },
  });
  const { data: counts } = useQuery({
    queryKey: ["moderator-counts"],
    enabled: isMod === true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [reports, suggestions, verifs] = await Promise.all([
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase
          .from("suggestions")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase.rpc("pending_verifications_count"),
      ]);
      return {
        reports: reports.count ?? 0,
        suggestions: suggestions.count ?? 0,
        verifs: typeof verifs.data === "number" ? verifs.data : 0,
      };
    },
  });
  if (!isMod) return null;
  const item =
    "flex flex-1 items-center gap-2 rounded-lg border-2 border-foreground bg-card px-3 py-2.5 font-bold transition-[background-color,box-shadow] hover:bg-foreground/[0.07] hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)]";
  const badge = (n: number) =>
    n > 0 && (
      <span className="ml-auto rounded-full border-2 border-foreground bg-destructive px-1.5 text-xs text-destructive-foreground">
        {n}
      </span>
    );
  return (
    <section className="block-card space-y-3 bg-accent p-4" aria-label="Moderação">
      <h2 className="flex items-center gap-2 text-lg">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Moderação
      </h2>
      <div className="flex flex-wrap gap-2">
        <Link to="/moderacao" className={item}>
          <Flag className="h-4 w-4" aria-hidden="true" /> Denúncias {badge(counts?.reports ?? 0)}
        </Link>
        <Link to="/sugestoes" className={item}>
          <Lightbulb className="h-4 w-4" aria-hidden="true" /> Sugestões{" "}
          {badge(counts?.suggestions ?? 0)}
        </Link>
        <Link to="/verificacoes" className={item}>
          <UserCheck className="h-4 w-4" aria-hidden="true" /> Verificações{" "}
          {badge(counts?.verifs ?? 0)}
        </Link>
      </div>
    </section>
  );
}
