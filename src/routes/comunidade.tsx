import { createFileRoute, Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/comunidade")({
  head: () => ({
    meta: [
      { title: "Comunidade — Beecos" },
      { name: "description", content: "Grupos por profissão no Beecos. Em breve." },
    ],
  }),
  component: Community,
});

function Community() {
  return (
    <div className="block-card space-y-3 p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border-2 border-foreground bg-primary">
        <Users className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="text-2xl">Comunidade</h1>
      <p className="text-muted-foreground">
        Grupos por profissão, com vagas rápidas para quem é da área. Em breve.
      </p>
      <Link
        to="/vagas"
        search={{ q: undefined, tipo: undefined }}
        className="text-sm font-bold underline"
      >
        Ver as vagas
      </Link>
    </div>
  );
}
