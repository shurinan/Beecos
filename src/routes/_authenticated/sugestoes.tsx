import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/data";
import { confirmAction } from "@/lib/confirm";

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
  rewarded_at: string | null;
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
        .select("id, body, status, created_at, rewarded_at, profiles(full_name, slug)")
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

  async function reward(s: Row) {
    const who = s.profiles?.full_name?.split(" ")[0] || "esta pessoa";
    const ok = await confirmAction({
      title: `Tem certeza que deseja dar 15 dias de Premium para ${who}?`,
      description:
        "É o agradecimento pela sugestão. Sem cobrança; se já for Premium, os dias são somados. A pessoa recebe um aviso de agradecimento.",
      confirmLabel: "Dar 15 dias",
      danger: false,
    });
    if (!ok) return;
    const { error } = await supabase.rpc("reward_suggestion", { _suggestion: s.id });
    if (error) {
      toast.error(
        error.message.includes("JA_PREMIADA")
          ? "Esta sugestão já ganhou o agradecimento."
          : "Não foi possível dar o Premium. Tente de novo.",
      );
      return;
    }
    toast.success(`Pronto: ${who} ganhou 15 dias de Premium.`);
    await qc.invalidateQueries({ queryKey: ["suggestions"] });
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
            <div className="flex flex-wrap gap-2">
              {s.rewarded_at ? (
                <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-foreground bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                  <Gift className="h-3.5 w-3.5" aria-hidden="true" /> Ganhou 15 dias de Premium
                </span>
              ) : (
                <Button size="sm" onClick={() => void reward(s)}>
                  <Gift /> Dar 15 dias de Premium
                </Button>
              )}
              {s.status !== "read" && (
                <Button size="sm" variant="outline" onClick={() => void mark(s.id, "read")}>
                  Marcar como lida
                </Button>
              )}
              {s.status !== "done" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: "Tem certeza que deseja marcar esta ideia como feita?",
                      description: "Quem sugeriu recebe um aviso: “Sua ideia entrou no Beecos!”",
                      confirmLabel: "Marcar como feita",
                      danger: false,
                    });
                    if (ok) void mark(s.id, "done");
                  }}
                >
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
