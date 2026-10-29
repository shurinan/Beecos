import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Barcode, Copy, ExternalLink, Lock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPaid, type Charge } from "@/lib/billing";

type Shown = Exclude<Charge, { method: "card" }>;

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado.`);
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
  }
}

function minutesLeft(expires: string | null): number | null {
  if (!expires) return null;
  const t = new Date(expires.replace(" ", "T")).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.round((t - Date.now()) / 60000));
}

/** Pix (QR e copia e cola) ou boleto (linha digitável) dentro do app, confirmando sozinho quando pagar. */
export function PayPanel({
  charge,
  price,
  onPaid,
  onBack,
}: {
  charge: Shown;
  price: string;
  onPaid: () => void;
  onBack: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const { data: paid } = useQuery({
    queryKey: ["charge-paid", charge.paymentId],
    queryFn: () => isPaid(charge.paymentId),
    refetchInterval: (q) => (q.state.data ? false : 3000),
  });
  useEffect(() => {
    if (paid) onPaid();
  }, [paid, onPaid]);

  const pix = charge.method === "pix";
  const left = pix ? minutesLeft(charge.pix.expires) : null;
  return (
    <section
      className="block-card space-y-4 p-4"
      aria-label={pix ? "Pagar com Pix" : "Pagar com boleto"}
    >
      <header className="flex items-center gap-2">
        {pix ? (
          <QrCode className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Barcode className="h-5 w-5" aria-hidden="true" />
        )}
        <h2 className="font-display text-xl">{pix ? "Pague com Pix" : "Pague com boleto"}</h2>
        <span className="ml-auto font-display text-lg">{price}</span>
      </header>

      {charge.method === "pix" ? (
        <>
          <div className="flex justify-center rounded-lg border-2 border-foreground bg-white p-3">
            <img
              src={`data:image/png;base64,${charge.pix.image}`}
              alt="QR Code do Pix"
              width={208}
              height={208}
              className="h-52 w-52"
            />
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Abra o app do seu banco e escolha pagar com Pix.</li>
            <li>Leia o QR Code ou use o “Pix copia e cola” abaixo.</li>
            <li>Confirme. Esta tela avisa quando o pagamento chegar.</li>
          </ol>
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Pix copia e cola</p>
            <p
              className="max-h-24 overflow-auto break-all rounded-md border-2 border-foreground/30 bg-muted p-2 font-mono text-xs"
              tabIndex={0}
            >
              {charge.pix.code}
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => void copy(charge.pix.code, "Código Pix")}
            >
              <Copy /> Copiar código Pix
            </Button>
          </div>
          {left !== null && (
            <p className="text-xs text-muted-foreground">
              {left > 0
                ? `O código vale por mais ${left} min.`
                : "O código expirou. Volte e gere outro."}
            </p>
          )}
        </>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Copie a linha digitável ou abra o boleto.</li>
            <li>Pague no app do banco, na lotérica ou no caixa.</li>
            <li>O boleto leva até 1 dia útil para confirmar. Avisamos quando chegar.</li>
          </ol>
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Linha digitável</p>
            <p
              className="break-all rounded-md border-2 border-foreground/30 bg-muted p-2 font-mono text-xs"
              tabIndex={0}
            >
              {charge.boleto.line}
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => void copy(charge.boleto.line, "Linha digitável")}
            >
              <Copy /> Copiar linha digitável
            </Button>
            <Button asChild type="button" variant="outline" className="w-full">
              <a href={charge.boleto.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Abrir boleto (PDF)
              </a>
            </Button>
          </div>
        </>
      )}

      <p role="status" className="flex items-center gap-2 rounded-md bg-accent p-2.5 text-sm">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-foreground" aria-hidden="true" />
        Aguardando o pagamento…
      </p>
      <Button type="button" variant="outline" className="w-full" onClick={onBack}>
        Escolher outra forma de pagar
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Conexão criptografada · pagamento pelo
        Asaas
      </p>
    </section>
  );
}
