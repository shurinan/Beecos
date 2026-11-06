import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PostEditDialog } from "@/components/PostEditDialog";
import { useCatalog } from "@/lib/catalog";
import { BLOCKED_TEXT_MESSAGE, isBlockedTextError } from "@/lib/chat";
import type { PostKind } from "@/lib/data";
import { formatCep } from "@/lib/geo";
import { getPlanUsage } from "@/lib/plans";
import { draftColumns, type PostDraft } from "@/lib/post-form";
import { sortPhotos, syncPhotos } from "@/lib/post-photos";
import { registerPostEditorHost } from "@/lib/post-editor";

type Editing = { id: string; draft: PostDraft; minVacancies: number };

/**
 * O editor da própria vaga ou anúncio, para o app inteiro: tocar na sua publicação
 * (Minhas vagas, Meu perfil, listas de vagas) abre aqui. Montado uma vez no AppShell.
 */
export function PostEditorHost({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: catalog } = useCatalog();
  const { data: usage } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
  });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      registerPostEditorHost(async (postId) => {
        const [post, loc, stats] = await Promise.all([
          supabase
            .from("posts")
            .select("*, post_photos(id, path, sort)")
            .eq("id", postId)
            .maybeSingle(),
          supabase.from("post_locations").select("postal_code").eq("post_id", postId).maybeSingle(),
          supabase.from("post_stats").select("taken").eq("post_id", postId).maybeSingle(),
        ]);
        const p = post.data;
        if (post.error || !p || p.user_id !== userId) {
          toast.error("Não foi possível abrir o editor. Tente de novo.");
          return;
        }
        setEditing({
          id: p.id,
          minVacancies: stats.data?.taken ?? 0,
          draft: {
            kind: p.kind as PostKind,
            title: p.title,
            description: p.description,
            city: p.city,
            price: p.price,
            vacancies: p.vacancies,
            cep: loc.data ? formatCep(loc.data.postal_code) : "",
            place: null,
            pick: {
              professionId: p.profession_id,
              other: p.profession_id === null,
              serviceIds: p.service_id ? [p.service_id] : [],
            },
            look: {
              coverColor: p.cover_color,
              icon: p.cover_icon,
              urgent: p.urgent,
              negotiable: p.negotiable,
              highlight: p.highlight,
            },
            photos: { kept: sortPhotos(p.post_photos), added: [], removed: [] },
          },
        });
        setOpen(true);
      }),
    [userId],
  );

  async function save(next: PostDraft): Promise<boolean> {
    if (!editing) return false;
    const { error } = await supabase.from("posts").update(draftColumns(next)).eq("id", editing.id);
    if (error) {
      toast.error(
        isBlockedTextError(error)
          ? BLOCKED_TEXT_MESSAGE
          : error.message.includes("VAGAS_OCUPADAS")
            ? "Já há mais vagas ocupadas do que esse número."
            : "Não foi possível salvar as mudanças.",
      );
      return false;
    }
    if (next.place) {
      const loc = await supabase.from("post_locations").upsert({
        post_id: editing.id,
        postal_code: next.place.cep,
        lat: next.place.lat,
        lng: next.place.lng,
      });
      if (loc.error) {
        toast.error("Salvo, mas não foi possível guardar o CEP.");
        return true;
      }
    } else if (next.cep.trim() === "") {
      await supabase.from("post_locations").delete().eq("post_id", editing.id);
    }
    if (next.photos.added.length || next.photos.removed.length) {
      const failed = await syncPhotos({
        userId,
        postId: editing.id,
        add: next.photos.added,
        remove: next.photos.removed,
        startSort: Math.max(-1, ...next.photos.kept.map((x) => x.sort)) + 1,
      });
      if (failed) toast.error(`Salvo, mas ${failed} foto(s) não foram enviadas. Tente de novo.`);
    }
    toast.success("Publicação atualizada");
    qc.invalidateQueries();
    return true;
  }

  return (
    <PostEditDialog
      key={editing?.id ?? "nenhuma"}
      open={open}
      onOpenChange={setOpen}
      initial={editing?.draft ?? null}
      catalog={catalog}
      minVacancies={editing?.minVacancies ?? 0}
      onSave={save}
      premium={!!usage?.premium}
    />
  );
}
