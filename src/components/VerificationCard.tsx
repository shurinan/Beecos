import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Seal } from "@/components/Seal";
import { Button } from "@/components/ui/button";
import { useBadge } from "@/lib/badges";
import { useMyVerification } from "@/lib/verification";

/** Cartão do perfil: convida a verificar a identidade e mostra em que pé está o pedido. */
export function VerificationCard({ userId }: { userId: string }) {
  const { info } = useBadge(userId);
  const { data: last, isLoading } = useMyVerification(userId);
  if (isLoading) return null;

  if (info?.doc)
    return (
      <section className="block-card flex items-center gap-3 p-4">
        <Seal tier={info.premium ? "both" : "verified"} size={36} />
        <div>
          <h2 className="text-lg">Conta verificada</h2>
          <p className="text-sm text-muted-foreground">Sua identidade foi conferida pela equipe.</p>
        </div>
      </section>
    );

  if (last?.status === "pending")
    return (
      <section className="block-card space-y-1 p-4">
        <h2 className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Verificação em análise
        </h2>
        <p className="text-sm text-muted-foreground">
          Recebemos seus documentos. Avisamos quando terminar, em até 2 dias úteis.
        </p>
      </section>
    );

  return (
    <section className="block-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-lg">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Ganhe o selo Verificado
      </h2>
      {last?.status === "rejected" && (
        <p className="rounded-lg border-2 border-destructive p-2 text-sm">
          Seu último pedido não foi aprovado{last.reason ? `: ${last.reason}` : "."} Você pode
          tentar de novo.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        É grátis. Quem contrata confia mais em perfis verificados.
      </p>
      <Button asChild size="sm">
        <Link to="/perfil/verificacao">Verificar minha conta</Link>
      </Button>
    </section>
  );
}
