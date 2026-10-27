import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { postParams } from "@/lib/urls";

// Endereço antigo (/publicacao/<id>): leva para a lista de interessados com o endereço novo.
export const Route = createFileRoute("/_authenticated/publicacao/$id")({
  beforeLoad: async ({ params }) => {
    const { data } = await supabase
      .from("posts")
      .select("slug, professions(slug)")
      .eq("id", params.id)
      .maybeSingle();
    if (!data) throw redirect({ to: "/perfil", replace: true });
    throw redirect({
      to: "/vagas/$profissao/$codigo/interessados",
      params: postParams(data),
      replace: true,
    });
  },
});
