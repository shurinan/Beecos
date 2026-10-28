import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ModerationCase } from "@/components/ModerationCase";
import { REPORT_REASONS, resolveReport } from "@/lib/reports";
import { timeAgo } from "@/lib/data";
import { postParams, profileParam } from "@/lib/urls";

export const Route = createFileRoute("/_authenticated/moderacao")({
  head: () => ({ meta: [{ title: "Moderação — Beecos" }, { name: "robots", content: "noindex" }] }),
  component: Moderation,
});

type Row = {
  id: string;
  target_type: string;
  target_id: string;
  target_label: string;
  reason: string;
  details: string;
  created_at: string;
};

function Moderation() {
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
    queryKey: ["moderation-queue"],
    enabled: isMod === true,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("reports")
        .select("id, target_type, target_id, target_label, reason, details, created_at")
        .eq("status", "open")
        .order("created_at");
      if (error) throw error;
      const reports = (rows ?? []) as Row[];
      const postIds = reports.filter((r) => r.target_type === "post").map((r) => r.target_id);
      const profIds = reports.filter((r) => r.target_type === "profile").map((r) => r.target_id);
      const [posts, profs] = await Promise.all([
        postIds.length
          ? supabase
              .from("posts")
              .select("id, slug, hidden_at, professions(slug)")
              .in("id", postIds)
          : Promise.resolve({ data: [], error: null }),
        profIds.length
          ? supabase.from("profiles").select("id, slug").in("id", profIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (posts.error) throw posts.error;
      if (profs.error) throw profs.error;
      return { reports, posts: posts.data ?? [], profs: profs.data ?? [] };
    },
  });

  if (checking) return <p className="text-muted-foreground">Carregando…</p>;
  if (!isMod) return <p className="font-semibold">Página não encontrada.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Moderação</h1>
      <p className="text-sm text-muted-foreground">
        Denúncias abertas. Nada é removido sozinho: você decide cada caso. As duas contas ficam 2
        horas em vigilância; descartar a denúncia encerra a vigilância.
      </p>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data?.reports.length === 0 && <p>Nenhuma denúncia aberta.</p>}
      {data?.reports.map((r) => {
        const post = data.posts.find((p) => p.id === r.target_id);
        const prof = data.profs.find((p) => p.id === r.target_id);
        return (
          <ReportCard
            key={r.id}
            report={r}
            hidden={!!post?.hidden_at}
            link={
              post ? (
                <Link
                  to="/vagas/$profissao/$codigo"
                  params={postParams({ slug: post.slug, professions: post.professions })}
                  className="font-bold underline"
                >
                  Abrir a vaga
                </Link>
              ) : prof ? (
                <Link
                  to="/perfil/$slug"
                  params={{ slug: profileParam({ id: prof.id, slug: prof.slug }) }}
                  search={{ post: undefined }}
                  className="font-bold underline"
                >
                  Abrir o perfil
                </Link>
              ) : (
                <span className="text-muted-foreground">Conteúdo já removido</span>
              )
            }
            onDone={() => {
              void qc.invalidateQueries({ queryKey: ["moderation-queue"] });
            }}
          />
        );
      })}
    </div>
  );
}

function ReportCard({
  report,
  hidden,
  link,
  onDone,
}: {
  report: Row;
  hidden: boolean;
  link: React.ReactNode;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const reason = REPORT_REASONS.find((x) => x.value === report.reason)?.label ?? report.reason;
  async function act(action: "dismiss" | "hide_post" | "restore_post" | "done") {
    setBusy(true);
    try {
      await resolveReport(report.id, action, note);
      toast.success("Decisão registrada.");
      onDone();
    } catch {
      toast.error("Não consegui registrar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="block-card space-y-2 p-4">
      <p className="text-xs font-bold uppercase text-muted-foreground">
        {report.target_type === "post" ? "Publicação" : "Perfil"} · {timeAgo(report.created_at)}
        {hidden && " · oculta"}
      </p>
      <p className="font-semibold">{report.target_label || "(sem título)"}</p>
      <p className="text-sm">
        <b>Motivo:</b> {reason}
      </p>
      {report.details && <p className="text-sm">“{report.details}”</p>}
      <p className="text-sm">{link}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setCaseOpen(true)}>
        Abrir o caso (pessoas e conversa)
      </Button>
      {caseOpen && (
        <ModerationCase reportId={report.id} open={caseOpen} onOpenChange={setCaseOpen} />
      )}
      <Textarea
        aria-label="Observação da decisão"
        placeholder="Observação (opcional)"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => act("dismiss")}
        >
          Descartar
        </Button>
        {report.target_type === "post" &&
          (hidden ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => act("restore_post")}
            >
              Reexibir vaga
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => act("hide_post")}
            >
              Ocultar vaga
            </Button>
          ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => act("done")}
        >
          Tratada por outro meio
        </Button>
      </div>
    </article>
  );
}
