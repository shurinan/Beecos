import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/data";

/** "Ofertas concluídas": vagas que acabaram por prazo ou foram marcadas como concluídas. */
export function ClosedOffers({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["closed-offers", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("closed_offers", { _user: userId });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!data || data.length === 0) return null;
  const total = data[0]?.total ?? data.length;
  return (
    <section className="space-y-2" aria-labelledby="ofertas-concluidas">
      <h2 id="ofertas-concluidas" className="flex items-center gap-2 text-xl">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Ofertas concluídas ({total})
      </h2>
      <ul className="space-y-1.5">
        {data.map((o, i) => (
          <li
            key={`${o.title}-${i}`}
            className="flex flex-wrap items-center gap-x-3 rounded-lg border-2 border-foreground/40 p-2.5 text-sm"
          >
            <span className="min-w-0 flex-1 basis-40 truncate font-semibold">{o.title}</span>
            {o.profession && <span className="text-xs text-muted-foreground">{o.profession}</span>}
            <span className="text-xs text-muted-foreground">
              {o.concluded ? "Concluída" : "Prazo encerrado"} · {timeAgo(o.ended_at)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
