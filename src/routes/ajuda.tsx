import { createFileRoute } from "@tanstack/react-router";
import { FAQ } from "@/lib/help";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda e perguntas frequentes — Beecos" },
      { name: "description", content: "Como usar o Beecos e respostas às dúvidas mais comuns." },
    ],
  }),
  component: Help,
});

function Help() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Ajuda e perguntas frequentes</h1>
      <p className="text-muted-foreground">
        Dica: deixe o mouse parado 2 segundos sobre um botão, ou segure o dedo nele por 2 segundos no
        celular, e uma caixinha explica para que ele serve.
      </p>
      <ul className="space-y-2">
        {FAQ.map((f) => (
          <li key={f.q}>
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
