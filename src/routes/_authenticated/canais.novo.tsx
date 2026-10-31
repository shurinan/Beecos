import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { channelErrorMessage } from "@/lib/channels";
import { ChannelForm, EMPTY_CHANNEL, type ChannelValues } from "@/components/ChannelForm";
import { supabase } from "@/integrations/supabase/client";
import { getPlanUsage } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/canais/novo")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "Criar canal — Beecos" }, { name: "robots", content: "noindex" }],
  }),
  component: NewChannel,
});

function NewChannel() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: usage, isLoading } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
  });
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;

  if (!usage?.premium)
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <h1 className="text-2xl">Criar canal é Premium</h1>
        <p className="text-muted-foreground">
          Com o canal, a sua empresa reúne todas as vagas num lugar e avisa quem segue. Seguir e ver
          canais é grátis para todo mundo. Se o Premium acabar, o canal fica inativo até você
          renovar.
        </p>
        <Button asChild>
          <Link to="/plano">Conhecer o Premium</Link>
        </Button>
      </div>
    );

  async function submit(v: ChannelValues) {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("channels")
        .insert({
          owner_id: userId,
          name: v.name,
          description: v.description,
          default_days: v.days,
        })
        .select("id, slug")
        .single();
      if (error || !data) throw error ?? new Error("falhou");
      if (v.professionIds.length) {
        const { error: e2 } = await supabase
          .from("channel_professions")
          .insert(v.professionIds.map((profession_id) => ({ channel_id: data.id, profession_id })));
        if (e2) toast.error("Canal criado, mas não consegui salvar os trabalhos. Edite depois.");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["channels"] }),
        qc.invalidateQueries({ queryKey: ["my-channels"] }),
      ]);
      toast.success("Canal criado!");
      navigate({ to: "/canais/$slug", params: { slug: data.slug }, search: { ordem: undefined } });
    } catch (err) {
      toast.error(channelErrorMessage(err) ?? "Não foi possível criar o canal. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Criar canal</h1>
      <div className="block-card p-5">
        <ChannelForm
          initial={EMPTY_CHANNEL}
          submitLabel="Criar canal"
          busy={busy}
          onSubmit={(v) => void submit(v)}
        />
      </div>
    </div>
  );
}
