import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

/**
 * Aviso no topo quando a conta está limitada: vigilância de 2 horas por denúncia (não diz quem
 * denunciou quem) ou suspensão pela equipe.
 */
export function HoldBanner() {
  const { userId } = useAuth();
  const { data: hold } = useQuery({
    queryKey: ["my-hold", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_hold");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  if (!hold?.until || new Date(hold.until).getTime() <= Date.now()) return null;
  const when = new Date(hold.until);
  const sameDay = when.toDateString() === new Date().toDateString();
  const label = sameDay
    ? `até as ${when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : `até ${when.toLocaleDateString("pt-BR")}`;
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-lg border-2 border-foreground bg-primary/20 p-3 text-sm"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      {hold.suspended ? (
        <p>
          <b>Conta suspensa {label}.</b>
          {hold.reason ? ` Motivo: ${hold.reason}.` : ""} Até lá, você não pode negociar, publicar
          vagas nem receber propostas. Dúvidas: {PRIVACY_CONTACT_EMAIL}.
        </p>
      ) : (
        <p>
          <b>Conta em vigilância {label}.</b> Há uma denúncia em análise envolvendo a sua conta. Até
          lá, você não pode negociar, publicar vagas nem receber propostas.
        </p>
      )}
    </div>
  );
}
