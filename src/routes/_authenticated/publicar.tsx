import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, HardHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PostFormFields } from "@/components/PostFormFields";
import { EMPTY_DRAFT, draftColumns, draftError, type PostDraft } from "@/lib/post-form";
import { useCatalog } from "@/lib/catalog";
import { GeoError, formatCep, isValidCep, lookupCep, useWorkArea } from "@/lib/geo";
import { BLOCKED_TEXT_MESSAGE, isBlockedTextError } from "@/lib/chat";
import { getPlanUsage, limitMessage } from "@/lib/plans";
import { postParams } from "@/lib/urls";
import { syncPhotos } from "@/lib/post-photos";
import { KIND_ACTION } from "@/lib/data";
import {
  DEADLINES,
  channelErrorMessage,
  expiresAt,
  useMyChannels,
  type Deadline,
} from "@/lib/channels";

type Tipo = "contratar" | "trabalhar";

export const Route = createFileRoute("/_authenticated/publicar")({
  staticData: { sitemap: false },
  validateSearch: (q: Record<string, unknown>): { tipo: Tipo; canal?: string | undefined } => ({
    tipo: q["tipo"] === "trabalhar" ? "trabalhar" : "contratar",
    canal: typeof q["canal"] === "string" ? q["canal"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Publicar — Beecos" },
      {
        name: "description",
        content: "Publique o que você precisa ou o trabalho que você oferece.",
      },
    ],
  }),
  component: Publicar,
});

const OPTIONS = [
  {
    tipo: "contratar" as const,
    kind: "job" as const,
    Icon: Briefcase,
    hint: "Preciso de alguém para um serviço",
  },
  {
    tipo: "trabalhar" as const,
    kind: "available" as const,
    Icon: HardHat,
    hint: "Ofereço o meu trabalho",
  },
];

/** Tela só para publicar: a pessoa escolhe se quer contratar ou trabalhar e preenche. */
function Publicar() {
  const { userId } = Route.useRouteContext();
  const { tipo, canal } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: catalog } = useCatalog();
  const { data: workArea } = useWorkArea(userId);
  const { data: usage } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
  });
  const { data: myCity } = useQuery({
    queryKey: ["my-city", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("city")
        .eq("id", userId)
        .maybeSingle();
      return data?.city ?? "";
    },
  });
  const kind = tipo === "trabalhar" ? "available" : "job";
  const { data: allMyChannels } = useMyChannels(userId);
  // canal de quem perdeu o Premium fica inativo e não recebe vagas
  const myChannels = usage?.premium ? allMyChannels : [];
  const [channelId, setChannelId] = useState<string>(canal ?? "");
  const [days, setDays] = useState<Deadline>(30);
  const [daysTouched, setDaysTouched] = useState(false);
  const chosenChannel = myChannels?.find((c) => c.id === channelId);
  // o prazo padrão do canal vale até a pessoa escolher outro
  const effectiveDays: Deadline = (
    !daysTouched && chosenChannel
      ? (DEADLINES.find((d) => d.days === chosenChannel.default_days)?.days ?? 30)
      : days
  ) as Deadline;
  const [draft, setDraft] = useState<PostDraft>({ ...EMPTY_DRAFT, kind });
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft((d) => ({ ...d, kind })), [kind]);
  // começa com a cidade do perfil e o CEP de onde a pessoa atua (dá para trocar)
  useEffect(() => {
    if (myCity) setDraft((d) => ({ ...d, city: d.city || myCity }));
  }, [myCity]);
  useEffect(() => {
    if (workArea) setDraft((d) => ({ ...d, cep: d.cep || formatCep(workArea.postal_code) }));
  }, [workArea]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    const problem = draftError(draft);
    if (problem) return void toast.error(problem);
    setBusy(true);
    let place = draft.place;
    if (!place && isValidCep(draft.cep)) {
      try {
        place = await lookupCep(draft.cep);
      } catch (err) {
        setBusy(false);
        return void toast.error(
          err instanceof GeoError ? err.message : "Não foi possível buscar o CEP.",
        );
      }
    }
    const { data: created, error } = await supabase
      .from("posts")
      // slug é gerado pelo trigger posts_slug no banco; o valor vazio é substituído
      .insert({
        ...draftColumns(draft),
        kind: draft.kind,
        user_id: userId,
        slug: "",
        ...(draft.kind === "job"
          ? { expires_at: expiresAt(effectiveDays), channel_id: channelId || null }
          : {}),
      })
      .select("id, slug, professions(slug)")
      .single();
    if (error || !created) {
      setBusy(false);
      return void toast.error(
        error && isBlockedTextError(error)
          ? BLOCKED_TEXT_MESSAGE
          : ((error && (limitMessage(error) ?? channelErrorMessage(error))) ??
              "Não foi possível publicar. Tente de novo."),
      );
    }
    if (place) {
      const loc = await supabase
        .from("post_locations")
        .insert({ post_id: created.id, postal_code: place.cep, lat: place.lat, lng: place.lng });
      if (loc.error)
        toast.error(
          "Publicado, mas não foi possível guardar o CEP. Edite a publicação para tentar de novo.",
        );
    }
    if (draft.photos.added.length) {
      const failed = await syncPhotos({
        userId,
        postId: created.id,
        add: draft.photos.added,
        remove: [],
        startSort: 0,
      });
      if (failed)
        toast.error(
          `Publicado, mas ${failed} foto(s) não foram enviadas. Edite a vaga para tentar de novo.`,
        );
    }
    setBusy(false);
    toast.success("Publicado!");
    void qc.invalidateQueries();
    navigate({
      to: "/vagas/$profissao/$codigo",
      params: postParams({ slug: created.slug, professions: created.professions ?? null }),
    });
  }

  return (
    <form onSubmit={publish} className="space-y-4" noValidate>
      <h1 className="text-3xl">Publicar</h1>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="O que você quer?">
        {OPTIONS.map(({ tipo: t, kind: k, Icon, hint }) => {
          const on = tipo === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => navigate({ to: "/publicar", search: { tipo: t }, replace: true })}
              className={
                "flex flex-col items-start gap-1 rounded-lg border-2 border-foreground p-3 text-left transition-[background-color,box-shadow] " +
                (on ? "bg-foreground text-background" : "bg-card hover:bg-foreground/[0.07]")
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="font-bold">{KIND_ACTION[k]}</span>
              <span className={"text-xs " + (on ? "opacity-80" : "text-muted-foreground")}>
                {hint}
              </span>
            </button>
          );
        })}
      </div>
      <div className="block-card space-y-3 p-5">
        <PostFormFields
          draft={draft}
          onChange={setDraft}
          catalog={catalog}
          idPrefix="new-post"
          minVacancies={0}
          premium={!!usage?.premium}
        />
      </div>
      {kind === "job" && (
        <div className="block-card space-y-4 p-5">
          <fieldset className="space-y-2">
            <legend className="font-bold">Por quanto tempo a vaga fica aberta?</legend>
            <div className="flex flex-wrap gap-1.5">
              {DEADLINES.map((d) => (
                <button
                  key={d.days}
                  type="button"
                  aria-pressed={effectiveDays === d.days}
                  onClick={() => {
                    setDays(d.days);
                    setDaysTouched(true);
                  }}
                  className={
                    "rounded-full border-2 border-foreground px-3 py-1 text-sm font-semibold " +
                    (effectiveDays === d.days ? "bg-foreground text-background" : "")
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Depois desse prazo a vaga sai das listas e vai para as suas ofertas concluídas.
            </p>
          </fieldset>
          {myChannels && myChannels.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="pub-canal" className="font-bold">
                Publicar também em um canal
              </label>
              <select
                id="pub-canal"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full rounded-lg border-2 border-foreground bg-card p-2"
              >
                <option value="">Nenhum (só nas listas e na comunidade)</option>
                {myChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Quem segue o canal recebe aviso. A vaga também aparece na comunidade da profissão.
              </p>
            </div>
          )}
        </div>
      )}
      <Button type="submit" className="w-full" size="lg" loading={busy}>
        Publicar
      </Button>
    </form>
  );
}
