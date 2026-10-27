import { createFileRoute, Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — Beecos" },
      {
        name: "description",
        content: "Encontre vagas e profissionais da sua área, por setor e profissão, no Beecos.",
      },
    ],
  }),
  component: Community,
});

function Community() {
  const { data: catalog, isLoading, isError } = useCatalog();
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl">
          <Users className="h-6 w-6" aria-hidden="true" /> Comunidade
        </h1>
        <p className="text-muted-foreground">
          Escolha a sua área para ver as vagas e os profissionais dela. Grupos com mural e conversa
          entre colegas chegam em breve.
        </p>
      </header>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {isError && <p className="text-destructive">Não foi possível carregar as áreas.</p>}
      {catalog?.sectors.map((sector) => (
        <section key={sector.id} aria-labelledby={`setor-${sector.id}`} className="space-y-2">
          <h2 id={`setor-${sector.id}`} className="text-lg">
            {sector.name}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {sector.professions.map((p) => (
              <li key={p.id}>
                <Link
                  to="/vagas"
                  search={{ q: p.name, tipo: undefined }}
                  className="block rounded-full border-2 border-foreground px-3 py-1.5 text-sm font-semibold active:bg-primary active:text-primary-foreground"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
