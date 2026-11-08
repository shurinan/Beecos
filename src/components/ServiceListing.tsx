import { Link } from "@tanstack/react-router";
import { Banknote, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServicePageData } from "@/lib/service-pages";

const KIND: Record<string, string> = { job: "Vaga", available: "Profissional disponível" };

/** Lista pública de uma profissão (e cidade): H1, texto curto e links para cada publicação. */
export function ServiceListing({ data }: { data: ServicePageData }) {
  const prof = data.profession;
  if (!prof) {
    return (
      <div className="block-card mx-auto mt-4 max-w-md space-y-3 p-6 text-center">
        <h1 className="text-2xl">Serviço não encontrado</h1>
        <p className="text-sm text-muted-foreground">Veja os outros serviços do Beecos.</p>
        <Button asChild>
          <Link to="/servicos">Ver serviços</Link>
        </Button>
      </div>
    );
  }
  const where = data.city ? ` em ${data.city.name}` : "";
  const lower = prof.name.toLowerCase();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl">
          {prof.name}
          {where}
        </h1>
        <p className="text-muted-foreground">
          Vagas e profissionais de {lower}
          {where} no Beecos. Veja as publicações abertas e combine preço e prazo direto pelo chat,
          sem intermediário.
        </p>
        <Button asChild>
          <Link to="/auth">Entrar ou criar conta</Link>
        </Button>
      </header>

      {data.posts.length === 0 ? (
        <div className="block-card space-y-2 p-6 text-center">
          <p className="font-semibold">
            Ainda não há publicações abertas de {lower}
            {where}.
          </p>
          <p className="text-sm text-muted-foreground">
            Crie sua conta grátis para publicar uma vaga ou oferecer seu trabalho.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.posts.map((p) => (
            <li key={p.slug}>
              <Link
                to="/v/$codigo"
                params={{ codigo: p.slug }}
                className="block-card block space-y-1 p-4"
              >
                <span className="text-xs font-bold uppercase text-muted-foreground">
                  {KIND[p.kind] ?? "Publicação"}
                </span>
                <h2 className="text-lg leading-tight">{p.title}</h2>
                <span className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {p.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {p.city}
                    </span>
                  )}
                  {p.price && (
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5" aria-hidden="true" /> {p.price}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(data.city || data.cities.length > 0) && (
        <nav aria-label="Outras cidades" className="space-y-2">
          <h2 className="text-xl">{prof.name} em outras cidades</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {data.city && (
              <Link
                to="/servicos/$profissao"
                params={{ profissao: prof.slug }}
                className="rounded-full border-2 border-foreground px-3 py-1 font-semibold"
              >
                Todas as cidades
              </Link>
            )}
            {data.cities.map((c) => (
              <Link
                key={c.slug}
                to="/servicos/$profissao/$cidade"
                params={{ profissao: prof.slug, cidade: c.slug }}
                className="rounded-full border-2 border-foreground px-3 py-1 font-semibold"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
