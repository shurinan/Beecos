import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TermsGate } from "@/components/TermsGate";
import { rememberDestination } from "@/lib/after-login";

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      // depois de entrar, volta para a tela que a pessoa tinha tocado
      rememberDestination(location.href);
      throw redirect({ to: "/auth" });
    }
    return { userId: data.user.id };
  },
  component: Layout,
});

function Layout() {
  const { userId } = Route.useRouteContext();
  return (
    <>
      <Outlet />
      <TermsGate userId={userId} />
    </>
  );
}
