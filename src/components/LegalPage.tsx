import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { TERMS_UPDATED_LABEL } from "@/lib/legal";

/** Moldura das páginas jurídicas: título, data e leitura confortável. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="selectable space-y-4 [&_h2]:mt-4 [&_h2]:text-lg [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:space-y-1">
      <header>
        <h1 className="text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">Atualizado em {TERMS_UPDATED_LABEL}</p>
      </header>
      {children}
      <p className="pt-2 text-sm">
        <Link to="/termos" className="font-bold underline">
          Termos de uso
        </Link>{" "}
        ·{" "}
        <Link to="/privacidade" className="font-bold underline">
          Política de privacidade
        </Link>
      </p>
    </article>
  );
}
