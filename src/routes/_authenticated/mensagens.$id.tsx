import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { profileParam } from "@/lib/urls";

// Endereço antigo (/mensagens/<id da conversa>): leva para /conversas/<nome da pessoa>.
export const Route = createFileRoute("/_authenticated/mensagens/$id")({
  beforeLoad: async ({ params, context }) => {
    const { data } = await supabase
      .from("conversations")
      .select(
        "user_a, user_b, a:profiles!conversations_user_a_fkey(slug), b:profiles!conversations_user_b_fkey(slug)",
      )
      .eq("id", params.id)
      .maybeSingle();
    if (!data) throw redirect({ to: "/conversas", replace: true });
    const mineIsA = data.user_a === context.userId;
    const other = mineIsA ? data.b : data.a;
    const otherId = mineIsA ? data.user_b : data.user_a;
    throw redirect({
      to: "/conversas/$slug",
      params: { slug: profileParam({ id: otherId, slug: other?.slug }) },
      replace: true,
    });
  },
});
