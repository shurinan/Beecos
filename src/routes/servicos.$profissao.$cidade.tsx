import { createFileRoute, Link } from "@tanstack/react-router";
import { ServiceListing } from "@/components/ServiceListing";
import { Button } from "@/components/ui/button";
import { loadServicePage, servicePageMeta } from "@/lib/service-pages";

/** Página pública de uma profissão numa cidade: /servicos/eletricista/itaquaquecetuba. */
export const Route = createFileRoute("/servicos/$profissao/$cidade")({
  staticData: { sitemap: false },
  loader: ({ params }) => loadServicePage(params.profissao, params.cidade),
  head: ({ loaderData, params }) => {
    const m = servicePageMeta(loaderData, params);
    return {
      meta: [
        { title: m.title },
        { name: "description", content: m.description },
        { property: "og:title", content: m.title },
        { property: "og:description", content: m.description },
        { property: "og:url", content: m.canonical },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(m.robots ? [{ name: "robots", content: m.robots }] : []),
      ],
      links: [{ rel: "canonical", href: m.canonical }],
    };
  },
  component: CityPage,
  errorComponent: ServicePageError,
  notFoundComponent: ServicePageError,
});

function CityPage() {
  return <ServiceListing data={Route.useLoaderData()} />;
}

function ServicePageError() {
  return (
    <div className="block-card mx-auto mt-4 max-w-md space-y-3 p-6 text-center">
      <h1 className="text-2xl">Esta página não carregou</h1>
      <p className="text-sm text-muted-foreground">Tente de novo em instantes.</p>
      <Button asChild>
        <Link to="/servicos">Ver serviços</Link>
      </Button>
    </div>
  );
}
