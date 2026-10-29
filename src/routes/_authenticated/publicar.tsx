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
import { KIND_ACTION } from "@/lib/data";

type Tipo = "contratar" | "trabalhar";

export const Route = createFileRoute("/_authenticated/publicar")({
  validateSearch: (q: Record<string, unknown>): { tipo: Tipo } => ({
    tipo: q["tipo"] === "trabalhar" ? "trabalhar" : "contratar",
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
  const { tipo } = Route.useSearch();
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
          err instanceof GeoError ? err.message : "Não foi possível buscar o CEP",
        );
      }
    }
    const { data: created, error } = await supabase
      .from("posts")
      .insert({ ...draftColumns(draft), kind: draft.kind, user_id: userId })
      .select("id, slug, professions(slug)")
      .single();
    if (error || !created) {
      setBusy(false);
      return void toast.error(
        error && isBlockedTextError(error)
          ? BLOCKED_TEXT_MESSAGE
          : ((error && limitMessage(error)) ?? "Não foi possível publicar. Tente de novo."),
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
      <Button type="submit" className="w-full" size="lg" loading={busy}>
        Publicar
      </Button>
    </form>
  );
}
