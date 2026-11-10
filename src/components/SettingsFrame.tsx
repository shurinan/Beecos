import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SettingsMenu } from "@/components/SettingsMenu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Telas soltas que pertencem às Configurações (Notificações, Ajuda): no computador mantêm a
 * coluna lateral do perfil, para o menu não sumir ao clicar. No celular, só o conteúdo.
 */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["menu-me", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: p, error } = await supabase
        .from("profiles")
        .select("full_name, headline, avatar_path")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return p;
    },
  });
  if (!userId) return <>{children}</>;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
      <SettingsMenu
        current={null}
        name={data?.full_name ?? ""}
        headline={data?.headline ?? ""}
        avatarPath={data?.avatar_path}
        onSignOut={signOut}
      />
      <div className="min-w-0 lg:max-w-2xl">{children}</div>
    </div>
  );
}
