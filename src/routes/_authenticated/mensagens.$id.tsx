import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, FileText, Paperclip, Send, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatChannel } from "@/lib/chat-hooks";
import {
  BLOCKED_TEXT_MESSAGE,
  MAX_MESSAGE_LENGTH,
  attachmentPath,
  cleanFileName,
  formatFileSize,
  formatLastSeen,
  isBlockedTextError,
  isImageType,
  replySpeedLabel,
  validateAttachment,
} from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/mensagens/$id")({
  head: () => ({
    meta: [
      { title: "Chat — Beecos" },
      { name: "description", content: "Negocie direto com a outra pessoa." },
      { property: "og:title", content: "Chat — Beecos" },
      { property: "og:description", content: "Negocie direto com a outra pessoa." },
    ],
  }),
  component: Chat,
});

type Msg = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
};
const MSG_COLUMNS =
  "id, sender_id, content, created_at, attachment_path, attachment_name, attachment_type, attachment_size";

function Attachment({ msg }: { msg: Msg }) {
  const path = msg.attachment_path;
  const { data: url, isError } = useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("chat-files")
        .createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (!path) return null;
  const name = msg.attachment_name ?? "arquivo";
  if (isImageType(msg.attachment_type)) {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="max-h-60 w-full rounded-lg border-2 border-foreground object-cover"
        />
      </a>
    ) : (
      <div
        className="mb-1 h-32 w-48 animate-pulse rounded-lg border-2 border-foreground/40 bg-muted"
        aria-label="Carregando imagem"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!url}
      className="mb-1 flex items-center gap-2 rounded-lg border-2 border-foreground bg-background p-2"
    >
      <FileText className="h-6 w-6 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        <span className="block text-xs opacity-70">
          PDF · {formatFileSize(msg.attachment_size ?? 0)}
          {isError ? " · não foi possível abrir" : ""}
        </span>
      </span>
    </a>
  );
}

function Chat() {
  const { id } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [firstNewId, setFirstNewId] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const seen = useRef<Set<string> | null>(null); // mensagens que já estavam na tela: não animam
  const lastCount = useRef(0);

  const {
    data: conv,
    isLoading: convLoading,
    isError: convError,
    refetch: refetchConv,
  } = useQuery({
    queryKey: ["conv", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "user_a, user_b, posts(title, price), a:profiles!conversations_user_a_fkey(full_name), b:profiles!conversations_user_b_fkey(full_name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: msgs = [],
    isError: msgsError,
    isSuccess: msgsLoaded,
    refetch: refetchMsgs,
  } = useQuery({
    queryKey: ["msgs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(MSG_COLUMNS)
        .eq("conversation_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const other = conv ? (conv.user_a === userId ? conv.b : conv.a) : null;
  const otherId = conv ? (conv.user_a === userId ? conv.user_b : conv.user_a) : null;

  // as minhas escolhas de privacidade, o "visto por último" e a velocidade de resposta do outro
  const { data: mine } = useQuery({
    queryKey: ["presence-self", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("show_last_seen")
        .eq("user_id", userId)
        .maybeSingle();
      return { share: data?.show_last_seen ?? true };
    },
  });
  const { data: otherSeen } = useQuery({
    queryKey: ["presence", otherId],
    enabled: !!otherId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("last_seen_at")
        .eq("user_id", otherId!)
        .maybeSingle();
      return data?.last_seen_at ?? null;
    },
  });
  const { data: stats } = useQuery({
    queryKey: ["reply-stats", otherId],
    enabled: !!otherId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("reply_stats", { _user: otherId! });
      const r = data?.[0];
      return r ? { replies: Number(r.replies), median_seconds: Number(r.median_seconds) } : null;
    },
  });
  const { otherOnline, otherTyping, notifyTyping } = useChatChannel(
    id,
    userId,
    otherId,
    mine?.share ?? false,
  );
  const speed = replySpeedLabel(stats);

  // Marca como lida ao abrir e sempre que chega mensagem com a conversa à vista.
  // Antes de marcar, guarda onde estava a leitura para mostrar "Novas mensagens".
  const readAtLoaded = useRef(false);
  useEffect(() => {
    if (!msgsLoaded) return;
    let cancelled = false;
    (async () => {
      if (!readAtLoaded.current) {
        readAtLoaded.current = true;
        const { data } = await supabase
          .from("conversation_reads")
          .select("last_read_at")
          .eq("conversation_id", id)
          .eq("user_id", userId)
          .maybeSingle();
        const since = data?.last_read_at ?? "";
        const first = msgs.find((m) => m.sender_id !== userId && m.created_at > since);
        if (!cancelled) setFirstNewId(first?.id ?? null);
      }
      if (document.hidden || cancelled) return;
      const last = msgs[msgs.length - 1];
      if (last && last.sender_id !== userId) {
        await supabase.rpc("mark_conversation_read", { _conversation: id });
        qc.invalidateQueries({ queryKey: ["unread", userId] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [msgsLoaded, msgs, id, userId, qc]);

  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      void supabase.rpc("mark_conversation_read", { _conversation: id }).then(() => {
        qc.invalidateQueries({ queryKey: ["unread", userId] });
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [id, userId, qc]);

  useEffect(() => {
    const ch = supabase
      .channel(`msgs-${id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          qc.setQueryData<Msg[]>(["msgs", id], (old = []) =>
            old.some((x) => x.id === m.id) ? old : [...old, m],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  // O que já estava na tela quando abriu não anima; só o que chega depois.
  if (msgsLoaded && seen.current === null) seen.current = new Set(msgs.map((m) => m.id));

  // Desce até a última mensagem se eu enviei ou se já estava no fim; senão avisa que tem novidade.
  useEffect(() => {
    const grew = msgs.length > lastCount.current;
    const first = lastCount.current === 0;
    lastCount.current = msgs.length;
    if (!grew) return;
    const last = msgs[msgs.length - 1];
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 220;
    if (first || last?.sender_id === userId || nearBottom) {
      bottom.current?.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "end" });
      setShowJump(false);
    } else {
      setShowJump(true);
    }
  }, [msgs, userId]);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 220)
        setShowJump(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const problem = validateAttachment(f);
    if (problem) return void toast.error(problem);
    setFile(f);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if ((!content && !file) || sending) return;
    setSending(true);
    notifyTyping(false);
    let attachment: Pick<
      Msg,
      "attachment_path" | "attachment_name" | "attachment_type" | "attachment_size"
    > = {
      attachment_path: null,
      attachment_name: null,
      attachment_type: null,
      attachment_size: null,
    };
    if (file) {
      const path = attachmentPath(id, file.type);
      const up = await supabase.storage
        .from("chat-files")
        .upload(path, file, { contentType: file.type });
      if (up.error) {
        setSending(false);
        return void toast.error("Não foi possível enviar o arquivo");
      }
      attachment = {
        attachment_path: path,
        attachment_name: cleanFileName(file.name),
        attachment_type: file.type,
        attachment_size: file.size,
      };
    }
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: userId, content, ...attachment })
      .select(MSG_COLUMNS)
      .single();
    setSending(false);
    if (error) {
      toast.error(isBlockedTextError(error) ? BLOCKED_TEXT_MESSAGE : "Mensagem não enviada");
      return; // o texto e o anexo continuam no campo para a pessoa corrigir
    }
    setText("");
    setFile(null);
    qc.setQueryData<Msg[]>(["msgs", id], (old = []) =>
      old.some((x) => x.id === data.id) ? old : [...old, data as Msg],
    );
  }

  if (convError) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível carregar a conversa.</p>
        <Button onClick={() => refetchConv()}>Tentar de novo</Button>
      </div>
    );
  }

  if (!convLoading && !conv) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Conversa não encontrada.</p>
        <Link to="/mensagens" className="text-sm font-semibold underline">
          Voltar para mensagens
        </Link>
      </div>
    );
  }

  const status = otherTyping ? "digitando…" : otherOnline ? "online" : formatLastSeen(otherSeen);

  return (
    <div className="flex flex-col">
      <div className="block-card mb-3 flex items-center gap-3 p-3">
        <Link to="/mensagens" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          {otherId ? (
            <Link
              to="/perfil/$id"
              params={{ id: otherId }}
              search={{ post: undefined }}
              className="font-bold underline"
            >
              {other?.full_name || "Usuário"}
            </Link>
          ) : (
            <span className="font-bold">…</span>
          )}
          <p
            className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {status && (
              <span className={otherTyping || otherOnline ? "font-bold text-foreground" : ""}>
                {otherOnline && !otherTyping && <span aria-hidden="true">● </span>}
                {status}
              </span>
            )}
            {speed && (
              <span className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 font-bold text-secondary-foreground">
                <Zap className="h-3 w-3" /> {speed}
              </span>
            )}
          </p>
          {conv?.posts && (
            <p className="truncate text-xs text-muted-foreground">
              Sobre: {conv.posts.title}
              {conv.posts.price ? ` · ${conv.posts.price}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 pb-28">
        {msgsError && (
          <div className="space-y-2 py-8 text-center text-sm">
            <p>Não foi possível carregar as mensagens.</p>
            <Button variant="outline" onClick={() => refetchMsgs()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {!msgsError && msgs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Diga olá e combine o serviço e o valor.
          </p>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === userId;
          const isNew = seen.current !== null && !seen.current.has(m.id);
          return (
            <div key={m.id}>
              {m.id === firstNewId && (
                <div className="my-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                  <span className="h-px flex-1 bg-foreground/30" /> Novas mensagens{" "}
                  <span className="h-px flex-1 bg-foreground/30" />
                </div>
              )}
              <div className={"flex " + (mine ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl border-2 border-foreground px-3 py-2 text-sm " +
                    (mine ? "rounded-br-sm bg-primary " : "rounded-bl-sm bg-card ") +
                    (isNew ? "msg-in " + (mine ? "msg-in-mine" : "msg-in-theirs") : "")
                  }
                >
                  <Attachment msg={m} />
                  {m.content}
                  <div className="mt-0.5 text-right text-[10px] opacity-60">
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start" aria-hidden="true">
            <div className="msg-in msg-in-theirs flex gap-1 rounded-2xl rounded-bl-sm border-2 border-foreground bg-card px-3 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-dot h-2 w-2 rounded-full bg-foreground"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => {
            bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            setShowJump(false);
          }}
          className="badge-pop fixed bottom-[148px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-foreground bg-primary px-3 py-1.5 text-sm font-bold"
        >
          <ArrowDown className="h-4 w-4" /> Nova mensagem
        </button>
      )}

      <form
        onSubmit={send}
        className="fixed inset-x-0 bottom-[60px] z-10 mx-auto max-w-2xl border-t-2 border-foreground bg-background p-3"
      >
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-2 border-foreground p-2 text-sm">
            <FileText className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {cleanFileName(file.name)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
            <button type="button" aria-label="Remover anexo" onClick={() => setFile(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            aria-label="Escolher arquivo"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 border-2"
            aria-label="Anexar arquivo (até 2 MB)"
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip />
          </Button>
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              notifyTyping(e.target.value.length > 0);
            }}
            onBlur={() => notifyTyping(false)}
            placeholder="Escreva uma mensagem…"
            maxLength={MAX_MESSAGE_LENGTH}
            className="h-11 border-2"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Enviar"
            disabled={sending}
          >
            <Send />
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Imagens (JPG, PNG, WebP) ou PDF, até 2 MB.
        </p>
      </form>
    </div>
  );
}
