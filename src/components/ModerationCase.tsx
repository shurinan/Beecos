import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { attachmentExpired } from "@/lib/chat";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Person = { id: string; full_name: string; slug: string | null; created_at: string } | null;
type Msg = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
};
type CaseData = {
  reporter: Person;
  reported: Person;
  reports_against: number;
  holds: { user_id: string; role: string; ends_at: string; lifted_at: string | null }[];
  target_post: { title?: string; description?: string; hidden_at?: string | null } | null;
  target_removed: boolean;
  reported_posts: {
    id: string;
    slug: string;
    title: string;
    hidden_at: string | null;
    created_at: string;
  }[];
  deleted_posts: { title: string; description: string; deleted_at: string }[];
  conversation_id: string | null;
  messages: Msg[];
  deleted_messages: {
    sender_id: string;
    content: string;
    created_at: string;
    deleted_at: string;
  }[];
};

const fmt = (d: string) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Painel do caso: só o necessário para avaliar (a publicação, as duas pessoas e a conversa entre elas). */
export function ModerationCase({
  reportId,
  open,
  onOpenChange,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["moderator-case", reportId],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("moderator_case", { _report: reportId });
      if (error) throw error;
      return data as unknown as CaseData;
    },
  });
  const { data: badFaith } = useQuery({
    queryKey: ["reporter-bad-faith", reportId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("reporter_bad_faith", { _report: reportId });
      if (error) throw error;
      return data ?? 0;
    },
  });
  const name = (id: string) =>
    id === data?.reporter?.id ? "Quem denunciou" : id === data?.reported?.id ? "Denunciado" : "?";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Caso da denúncia</DialogTitle>
          <DialogDescription>
            Cada abertura deste painel fica registrada com o seu nome e a hora.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {isError && <p>Não foi possível abrir o caso.</p>}
        {data && (
          <div className="space-y-4 text-sm">
            <section className="space-y-1">
              <h3 className="font-bold">Pessoas</h3>
              <p>
                <b>Quem denunciou:</b> {data.reporter?.full_name || "—"} (
                {data.reporter?.slug || "sem nome de usuário"}), conta de{" "}
                {data.reporter ? fmt(data.reporter.created_at) : "—"}
              </p>
              <p>
                <b>Denunciado:</b> {data.reported?.full_name || "—"} (
                {data.reported?.slug || "sem nome de usuário"}), conta de{" "}
                {data.reported ? fmt(data.reported.created_at) : "—"}
              </p>
              <p>
                Denúncias já feitas contra o denunciado: <b>{data.reports_against}</b>
              </p>
              <p>
                Denúncias de quem denunciou já descartadas por má-fé: <b>{badFaith ?? 0}</b>
                {(badFaith ?? 0) >= 2 && " · perdeu o direito de denunciar por 90 dias"}
              </p>
              {data.holds.map((h, i) => (
                <p key={i} className="text-muted-foreground">
                  Vigilância ({h.role === "reporter" ? "quem denunciou" : "denunciado"}): até{" "}
                  {fmt(h.ends_at)}
                  {h.lifted_at ? " · encerrada" : ""}
                </p>
              ))}
            </section>

            <section className="space-y-1">
              <h3 className="font-bold">Publicação denunciada</h3>
              {data.target_post ? (
                <>
                  <p className="font-semibold">
                    {data.target_post.title}
                    {data.target_removed && " · apagada pelo autor (cópia guardada)"}
                    {data.target_post.hidden_at && " · oculta"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{data.target_post.description}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Denúncia sobre o perfil.</p>
              )}
            </section>

            <section className="space-y-1">
              <h3 className="font-bold">Outras publicações do denunciado</h3>
              {data.reported_posts.length === 0 && (
                <p className="text-muted-foreground">Nenhuma.</p>
              )}
              {data.reported_posts.map((p) => (
                <p key={p.id}>
                  {p.title}{" "}
                  <span className="text-muted-foreground">
                    · {fmt(p.created_at)}
                    {p.hidden_at ? " · oculta" : ""}
                  </span>
                </p>
              ))}
              {data.deleted_posts.length > 0 && (
                <h4 className="pt-1 font-semibold">Apagadas (cópia guardada)</h4>
              )}
              {data.deleted_posts.map((p, i) => (
                <p key={i}>
                  {p.title}{" "}
                  <span className="text-muted-foreground">· apagada em {fmt(p.deleted_at)}</span>
                </p>
              ))}
            </section>

            <section className="space-y-2">
              <h3 className="font-bold">Conversa entre as duas pessoas</h3>
              {!data.conversation_id && (
                <p className="text-muted-foreground">Elas não conversaram.</p>
              )}
              {data.messages.map((m) => (
                <div key={m.id} className="rounded-lg border-2 border-foreground/30 p-2">
                  <p className="text-xs text-muted-foreground">
                    {name(m.sender_id)} · {fmt(m.created_at)}
                  </p>
                  {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                  {m.attachment_path &&
                    (attachmentExpired(m) ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.attachment_name ?? "Arquivo"}: expirado (os anexos ficam 48 horas)
                      </p>
                    ) : (
                      <CaseFile msg={m} />
                    ))}
                </div>
              ))}
              {data.deleted_messages.length > 0 && (
                <h4 className="font-semibold">Mensagens apagadas (cópia guardada)</h4>
              )}
              {data.deleted_messages.map((m, i) => (
                <div key={i} className="rounded-lg border-2 border-dashed border-foreground/40 p-2">
                  <p className="text-xs text-muted-foreground">
                    {name(m.sender_id)} · {fmt(m.created_at)} · apagada em {fmt(m.deleted_at)}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              ))}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CaseFile({ msg }: { msg: Msg }) {
  const { data: url } = useQuery({
    queryKey: ["case-file", msg.attachment_path],
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("chat-files")
        .createSignedUrl(msg.attachment_path!, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return (
    <Button asChild variant="outline" size="sm" className="mt-1">
      <a href={url} target="_blank" rel="noopener noreferrer" aria-disabled={!url}>
        <FileText /> {msg.attachment_name ?? "arquivo"}
      </a>
    </Button>
  );
}
