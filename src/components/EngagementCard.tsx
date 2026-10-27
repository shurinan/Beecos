import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, CheckCircle2, Clock, Handshake, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { usePostStats } from "@/lib/services-hooks";
import {
  STATUS_LABEL,
  availableActions,
  chooseLabel,
  isFilled,
  serviceErrorMessage,
  vacanciesLabel,
  type Engagement,
} from "@/lib/services";

export type EngagementPost = { id: string; kind: string; title: string; user_id: string };

/** Quem contrata nesta conversa: em vaga ("job") quem publicou; em oferta ("available") o interessado. */
export function clientOf(post: EngagementPost, participants: [string, string]): string {
  if (post.kind === "job") return post.user_id;
  return participants[0] === post.user_id ? participants[1] : participants[0];
}

/** Hook com as ações do serviço (escolher, aceitar, concluir, cancelar) e a atualização das telas. */
export function useEngagementActions(userId: string) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => PromiseLike<{ error: { message?: string } | null }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(serviceErrorMessage(error));
      qc.invalidateQueries({ queryKey: ["engagement"] });
      return false;
    }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["engagement"] });
    qc.invalidateQueries({ queryKey: ["engagements"] });
    qc.invalidateQueries({ queryKey: ["post-stats"] });
    qc.invalidateQueries({ queryKey: ["unread", userId] });
    return true;
  }

  return {
    busy,
    choose: (conversation: string, ok: string) =>
      run(() => supabase.rpc("choose_provider", { _conversation: conversation }), ok),
    respond: (id: string, accept: boolean) =>
      run(
        () => supabase.rpc("respond_engagement", { _id: id, _accept: accept }),
        accept ? "Serviço aceito" : "Serviço recusado",
      ),
    complete: (id: string) =>
      run(() => supabase.rpc("complete_engagement", { _id: id }), "Serviço concluído"),
    cancel: (id: string) =>
      run(() => supabase.rpc("cancel_engagement", { _id: id }), "Serviço cancelado"),
  };
}

export function useEngagement(conversationId: string) {
  return useQuery({
    queryKey: ["engagement", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engagements")
        .select("id, post_id, conversation_id, client_id, provider_id, status, cancelled_by")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (error) throw error;
      return data as Engagement | null;
    },
  });
}

/** Cartão do serviço no topo da conversa. */
export function EngagementCard({
  conversationId,
  userId,
  otherId,
  otherName,
  post,
  participants,
  providerReplied,
}: {
  conversationId: string;
  userId: string;
  otherId: string;
  otherName: string;
  post: EngagementPost;
  participants: [string, string];
  providerReplied: boolean;
}) {
  const { data: engagement } = useEngagement(conversationId);
  const slots = usePostStats([post.id])[post.id];
  const act = useEngagementActions(userId);

  const clientId = clientOf(post, participants);
  const iAmClient = userId === clientId;
  const name = otherName || "a pessoa";
  // numa vaga já cheia não dá para escolher outro (a escolha já feita do próprio serviço não conta)
  const vacanciesLeft =
    post.kind !== "job" || !isFilled(slots) || engagement?.status === "cancelled";
  const a = availableActions(engagement ?? null, userId, {
    iAmClient,
    providerReplied,
    hasPost: true,
    vacanciesLeft,
  });
  const status = engagement && engagement.status !== "cancelled" ? engagement.status : null;

  // sem serviço e sem nada a fazer: não ocupa espaço
  if (!engagement && !iAmClient) return null;

  return (
    <section className="block-card mb-3 space-y-2 p-3" aria-label="Serviço">
      <div className="flex items-center gap-2 text-sm font-bold">
        {status === "completed" ? (
          <BadgeCheck className="h-4 w-4" />
        ) : status === "accepted" ? (
          <Handshake className="h-4 w-4" />
        ) : status === "proposed" ? (
          <Clock className="h-4 w-4" />
        ) : engagement ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Handshake className="h-4 w-4" />
        )}
        <span className="min-w-0 flex-1 truncate">{post.title}</span>
        {engagement && (
          <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs uppercase text-secondary-foreground">
            {STATUS_LABEL[engagement.status]}
          </span>
        )}
      </div>

      {!engagement || engagement.status === "cancelled" ? (
        iAmClient ? (
          a.choose ? (
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmButton
                variant="default"
                loading={act.busy}
                title={`${chooseLabel(post.kind)}: ${name}?`}
                description={`${name} vai receber o aviso e precisa aceitar. Você poderá cancelar a escolha enquanto o serviço não for concluído.`}
                confirmLabel={post.kind === "available" ? "Contratar" : "Escolher"}
                onConfirm={() => act.choose(conversationId, `${name} foi escolhido(a)`)}
              >
                <CheckCircle2 /> {chooseLabel(post.kind)}
              </ConfirmButton>
              {post.kind === "job" && (
                <span className="text-xs text-muted-foreground">{vacanciesLabel(slots)}</span>
              )}
            </div>
          ) : !providerReplied ? (
            <p className="text-sm text-muted-foreground">
              Quando {name} responder, você poderá{" "}
              {post.kind === "available" ? "contratar" : "escolher"} aqui.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {vacanciesLabel(slots) ?? "Não é possível escolher agora."}
            </p>
          )
        ) : null
      ) : (
        <>
          {engagement.status === "proposed" && (
            <p className="text-sm">
              {a.accept
                ? "Você foi escolhido(a) para este serviço. Aceita?"
                : `Aguardando ${name} aceitar o serviço.`}
            </p>
          )}
          {engagement.status === "accepted" && (
            <p className="text-sm">
              Combinado! Quando o serviço terminar, qualquer um dos dois marca como concluído.
            </p>
          )}
          {engagement.status === "completed" && (
            <p className="text-sm">Serviço concluído. Agora vocês podem se avaliar.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {a.accept && (
              <Button size="sm" loading={act.busy} onClick={() => act.respond(engagement.id, true)}>
                <CheckCircle2 /> Aceitar
              </Button>
            )}
            {a.decline && (
              <ConfirmButton
                loading={act.busy}
                title="Recusar este serviço?"
                description="A vaga volta a ficar disponível para outra pessoa."
                confirmLabel="Recusar"
                onConfirm={() => act.respond(engagement.id, false)}
              >
                Recusar
              </ConfirmButton>
            )}
            {a.complete && (
              <ConfirmButton
                variant="default"
                loading={act.busy}
                title="Marcar como concluído?"
                description="Isso libera a avaliação entre vocês dois e não pode ser desfeito."
                confirmLabel="Concluir"
                onConfirm={() => act.complete(engagement.id)}
              >
                <BadgeCheck /> Marcar como concluído
              </ConfirmButton>
            )}
            {a.cancel && (
              <ConfirmButton
                loading={act.busy}
                title="Cancelar este serviço?"
                description={
                  engagement.status === "proposed" && iAmClient
                    ? "A escolha é desfeita e a vaga volta a ficar disponível."
                    : "O serviço é cancelado para os dois."
                }
                confirmLabel="Cancelar serviço"
                onConfirm={() => act.cancel(engagement.id)}
              >
                {engagement.status === "proposed" && iAmClient ? "Desfazer escolha" : "Cancelar"}
              </ConfirmButton>
            )}
            {a.review && (
              <Button asChild size="sm">
                <Link
                  to="/perfil/$id"
                  params={{ id: otherId }}
                  search={{ post: undefined }}
                  hash="avaliar"
                >
                  <Star /> Avaliar {name}
                </Link>
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
