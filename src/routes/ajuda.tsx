import { SettingsFrame } from "@/components/SettingsFrame";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { FAQ } from "@/lib/help";
import { useAuth } from "@/lib/auth";
import { startTour } from "@/lib/tour";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ajuda")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Ajuda e perguntas frequentes — Beecos" },
      { name: "description", content: "Como usar o Beecos e respostas às dúvidas mais comuns." },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <SettingsFrame>
      <Help />
    </SettingsFrame>
  );
}

function Help() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  const { userId } = useAuth();
  // um link como /ajuda#avaliacoes abre e mostra aquela pergunta
  useEffect(() => {
    if (!hash) return;
    const item = document.getElementById(hash);
    const details = item?.querySelector("details");
    if (details) details.open = true;
    item?.scrollIntoView({ block: "start" });
  }, [hash]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Ajuda e perguntas frequentes</h1>
      <p className="text-muted-foreground">
        Dica: deixe o mouse parado 2 segundos sobre um botão, ou segure o dedo nele por 2 segundos
        no celular, e uma caixinha explica para que ele serve.
      </p>
      {userId && (
        <Button type="button" variant="outline" onClick={() => startTour()}>
          Ver o tutorial de novo
        </Button>
      )}
      <ul className="space-y-2">
        {FAQ.map((f) => (
          <li key={f.q} id={f.id} className="scroll-mt-20">
            <details className="block-card p-3">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Não achou o que procurava? Use a lâmpada no topo da tela para mandar a sua dúvida como
        sugestão.
      </p>
    </div>
  );
}
