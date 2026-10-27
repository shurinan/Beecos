import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TermsGate } from "@/components/TermsGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
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
