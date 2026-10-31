import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Aviso nas duas contas de uma denúncia: vigilância de 2 horas. Não diz quem denunciou quem. */
export function HoldBanner() {
  const { userId } = useAuth();
  const { data: until } = useQuery({
    queryKey: ["my-hold", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_hold_until");
      if (error) throw error;
      return data;
    },
  });
  if (!until || new Date(until).getTime() <= Date.now()) return null;
  const hour = new Date(until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-lg border-2 border-foreground bg-primary/20 p-3 text-sm"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p>
        <b>Conta em vigilância até as {hour}.</b> Há uma denúncia em análise envolvendo a sua conta.
        Até lá, você não pode negociar, publicar vagas nem receber propostas.
      </p>
    </div>
  );
}
