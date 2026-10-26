import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type Msg = { id: string; sender_id: string; content: string; created_at: string };

function Chat() {
  const { id } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const { data: conv } = useQuery({
    queryKey: ["conv", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select(
          "user_a, user_b, posts(title, price), a:profiles!conversations_user_a_fkey(full_name), b:profiles!conversations_user_b_fkey(full_name)",
        )
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: msgs = [] } = useQuery({
    queryKey: ["msgs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("conversation_id", id)
        .order("created_at");
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`msgs-${id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: userId, content })
      .select("id, sender_id, content, created_at")
      .single();
    if (error) {
      setText(content);
      toast.error("Mensagem não enviada");
      return;
    }
    qc.setQueryData<Msg[]>(["msgs", id], (old = []) =>
      old.some((x) => x.id === data.id) ? old : [...old, data],
    );
  }

  const other = conv ? (conv.user_a === userId ? conv.b : conv.a) : null;
  const otherId = conv ? (conv.user_a === userId ? conv.user_b : conv.user_a) : null;

  return (
    <div className="flex flex-col">
      <div className="block-card mb-3 flex items-center gap-3 p-3">
        <Link to="/mensagens" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          {otherId ? (
            <Link to="/perfil/$id" params={{ id: otherId }} search={{ post: undefined }} className="font-bold underline">
              {other?.full_name || "Usuário"}
            </Link>
          ) : (
            <span className="font-bold">…</span>
          )}
          {conv?.posts && (
            <p className="truncate text-xs text-muted-foreground">
              Sobre: {conv.posts.title}
              {conv.posts.price ? ` · ${conv.posts.price}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 pb-20">
        {msgs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Diga olá e combine o serviço e o valor.
          </p>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
              <div
                className={
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl border-2 border-foreground px-3 py-2 text-sm " +
                  (mine ? "rounded-br-sm bg-primary" : "rounded-bl-sm bg-card")
                }
              >
                {m.content}
                <div className="mt-0.5 text-right text-[10px] opacity-60">
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={send}
        className="fixed inset-x-0 bottom-[60px] z-10 mx-auto flex max-w-2xl gap-2 border-t-2 border-foreground bg-background p-3"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          maxLength={2000}
          className="h-11 border-2"
        />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" aria-label="Enviar">
          <Send />
        </Button>
      </form>
    </div>
  );
}
