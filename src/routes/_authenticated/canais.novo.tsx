import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCatalog } from "@/lib/catalog";
import {
  DEADLINES,
  MAX_CHANNEL_PROFESSIONS,
  channelErrorMessage,
  type Deadline,
} from "@/lib/channels";
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
  const { data: catalog } = useCatalog();
  const { data: usage, isLoading } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState<Deadline>(7);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;

  if (!usage?.premium)
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <h1 className="text-2xl">Criar canal é Premium</h1>
        <p className="text-muted-foreground">
          Com o canal, a sua empresa reúne todas as vagas num lugar e avisa quem segue. Seguir e ver
          canais é grátis para todo mundo.
        </p>
        <Button asChild>
          <Link to="/plano">Conhecer o Premium</Link>
        </Button>
      </div>
    );

  function toggle(id: string) {
    setPicked((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= MAX_CHANNEL_PROFESSIONS
          ? (toast.error(`Escolha no máximo ${MAX_CHANNEL_PROFESSIONS} trabalhos.`), cur)
          : [...cur, id],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return void toast.error("Dê um nome ao canal (mínimo 3 letras).");
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("channels")
        .insert({ owner_id: userId, name, description: description.trim(), default_days: days })
        .select("id, slug")
        .single();
      if (error || !data) throw error ?? new Error("falhou");
      if (picked.length) {
        const { error: e2 } = await supabase
          .from("channel_professions")
          .insert(picked.map((profession_id) => ({ channel_id: data.id, profession_id })));
        if (e2) toast.error("Canal criado, mas não consegui salvar os trabalhos. Edite depois.");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["channels"] }),
        qc.invalidateQueries({ queryKey: ["my-channels"] }),
      ]);
      toast.success("Canal criado!");
      navigate({ to: "/canais/$slug", params: { slug: data.slug } });
    } catch (err) {
      toast.error(channelErrorMessage(err) ?? "Não foi possível criar o canal. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="text-2xl">Criar canal</h1>
      <div className="block-card space-y-4 p-5">
        <div className="space-y-1">
          <Label htmlFor="ch-name" className="font-bold">
            Nome
          </Label>
          <Input
            id="ch-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ch-desc" className="font-bold">
            Descrição
          </Label>
          <Textarea
            id="ch-desc"
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Obras residenciais em Campinas. Contratamos por obra."
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="font-bold">Quais trabalhos você procura?</legend>
          <p className="text-xs text-muted-foreground">
            Ajuda as pessoas a encontrarem seu canal. Até {MAX_CHANNEL_PROFESSIONS}.
          </p>
          {catalog?.sectors.map((s) => (
            <div key={s.id} className="space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">{s.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {s.professions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={picked.includes(p.id)}
                    onClick={() => toggle(p.id)}
                    className={
                      "rounded-full border-2 border-foreground px-3 py-1 text-sm font-semibold " +
                      (picked.includes(p.id) ? "bg-foreground text-background" : "")
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-bold">Prazo padrão das vagas</legend>
          <div className="flex flex-wrap gap-1.5">
            {DEADLINES.map((d) => (
              <button
                key={d.days}
                type="button"
                aria-pressed={days === d.days}
                onClick={() => setDays(d.days)}
                className={
                  "rounded-full border-2 border-foreground px-3 py-1 text-sm font-semibold " +
                  (days === d.days ? "bg-foreground text-background" : "")
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            A vaga só vai ao canal se você escolher publicar nele, e também aparece na comunidade do
            ofício. Você escolhe o prazo em cada vaga.
          </p>
        </fieldset>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={busy}>
        Criar canal
      </Button>
    </form>
  );
}
