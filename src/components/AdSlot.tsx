import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPlanUsage } from "@/lib/plans";
import { pickAd, safeHttpUrl, type Ad, type AdPlacement } from "@/lib/ads";

/**
 * Espaço de anúncio discreto: um cartão pequeno, tracejado e rotulado "Patrocinado".
 * Não ocupa lugar nenhum quando não há anúncio ativo, e usuários Premium não veem anúncios.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  const { userId } = useAuth();
  const [seed] = useState(() => Math.floor(Math.random() * 1000));

  const { data: usage } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId!),
    enabled: !!userId,
  });
  const { data: ads } = useQuery({
    queryKey: ["ads", placement],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("id, placement, sponsor, title, body, image_url, link_url")
        .eq("placement", placement)
        .limit(20);
      if (error) throw error;
      return data as Ad[];
    },
  });

  if (userId && !usage) return null; // espera saber se é Premium antes de mostrar
  if (usage?.premium) return null;
  const ad = pickAd(ads, seed);
  if (!ad) return null;
  const href = safeHttpUrl(ad.link_url)!;
  const image = safeHttpUrl(ad.image_url);

  return (
    <aside aria-label="Publicidade">
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="flex items-center gap-3 rounded-lg border border-dashed border-foreground/30 bg-muted/40 p-3"
      >
        {image && (
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-12 w-12 shrink-0 rounded-md border border-foreground/20 object-cover"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Patrocinado · {ad.sponsor}
          </span>
          <span className="block truncate text-sm font-semibold">{ad.title}</span>
          {ad.body && (
            <span className="block truncate text-xs text-muted-foreground">{ad.body}</span>
          )}
        </span>
      </a>
    </aside>
  );
}
