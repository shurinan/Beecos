import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Seal } from "@/components/Seal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useBadge } from "@/lib/badges";
import {
  checkImageFile,
  submitVerification,
  useMyVerification,
  verificationErrorMessage,
} from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/perfil/verificacao")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "Verificar minha conta — Beecos" }, { name: "robots", content: "noindex" }],
  }),
  component: Verify,
});

function FilePick({
  label,
  hint,
  file,
  onPick,
  capture,
  optional,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
  capture?: "user" | "environment";
  optional?: boolean;
}) {
  const id = `f-${label.replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="font-bold">
        {label} {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        {...(capture ? { capture } : {})}
        className="block w-full rounded-lg border-2 border-dashed border-foreground p-3 text-sm file:mr-3 file:rounded-full file:border-2 file:border-foreground file:bg-primary file:px-3 file:py-1 file:font-bold"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) {
            const bad = checkImageFile(f);
            if (bad) {
              toast.error(bad);
              e.target.value = "";
              return;
            }
          }
          onPick(f);
        }}
      />
      {file && <p className="text-xs font-semibold">✓ {file.name}</p>}
    </div>
  );
}

function Verify() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { info } = useBadge(userId);
  const { data: last, isLoading } = useMyVerification(userId);
  const [step, setStep] = useState(0);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;

  if (info?.doc || last?.status === "pending")
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <h1 className="text-2xl">{info?.doc ? "Conta verificada" : "Em análise"}</h1>
        <p className="text-muted-foreground">
          {info?.doc
            ? "Sua identidade já foi conferida."
            : "Recebemos seus documentos. Avisamos quando terminar, em até 2 dias úteis."}
        </p>
        <Button asChild>
          <Link to="/perfil" search={{ secao: undefined }}>
            Voltar ao perfil
          </Link>
        </Button>
      </div>
    );

  async function send() {
    if (!front || !selfie) return;
    setBusy(true);
    try {
      await submitVerification(userId, { front, back, selfie });
      await qc.invalidateQueries({ queryKey: ["my-verification"] });
      toast.success("Enviado! Vamos analisar em até 2 dias úteis.");
      navigate({ to: "/perfil", search: { secao: undefined } });
    } catch (e) {
      toast.error(verificationErrorMessage(e) ?? "Não consegui enviar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2 text-center">
        <div className="flex justify-center">
          <Seal tier="verified" size={72} />
        </div>
        <h1 className="text-2xl">Ganhe o selo Verificado</h1>
        <p className="text-muted-foreground">É grátis e leva uns 3 minutos.</p>
      </header>

      <div className="flex gap-1.5" aria-label={`Passo ${step + 1} de 3`}>
        {[0, 1, 2].map((n) => (
          <span
            key={n}
            className={"h-1.5 flex-1 rounded-full " + (n <= step ? "bg-foreground" : "bg-muted")}
          />
        ))}
      </div>

      {step === 0 && (
        <section className="block-card space-y-4 p-5">
          <h2 className="text-lg">1. Documento de identidade</h2>
          <p className="text-sm text-muted-foreground">
            RG ou CNH. Boa luz, sem reflexo e com os quatro cantos visíveis.
          </p>
          <FilePick
            label="Frente do documento"
            hint="Foto nítida."
            file={front}
            onPick={setFront}
            capture="environment"
          />
          <FilePick
            label="Verso do documento"
            hint="Se o seu documento tem verso."
            file={back}
            onPick={setBack}
            capture="environment"
            optional
          />
          <Button className="w-full" disabled={!front} onClick={() => setStep(1)}>
            Continuar
          </Button>
        </section>
      )}

      {step === 1 && (
        <section className="block-card space-y-4 p-5">
          <h2 className="text-lg">2. Selfie</h2>
          <p className="text-sm text-muted-foreground">
            Rosto no centro, sem óculos escuros nem boné. Vamos comparar com o documento.
          </p>
          <FilePick
            label="Sua selfie"
            hint="Tire agora, de frente."
            file={selfie}
            onPick={setSelfie}
            capture="user"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Voltar
            </Button>
            <Button className="flex-1" disabled={!selfie} onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="block-card space-y-4 p-5">
          <h2 className="text-lg">3. Enviar para análise</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Seus arquivos ficam em área privada. Só a equipe de verificação vê.</li>
            <li>Eles são apagados assim que a análise termina, aprovada ou não.</li>
            <li>Guardamos só o resultado e a data. O selo nunca mostra seus dados.</li>
            <li>Usamos isso apenas para confirmar que você é você (LGPD, art. 7º).</li>
          </ul>
          <div className="flex items-start gap-2">
            <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
            <Label htmlFor="agree" className="text-sm leading-snug">
              Concordo em enviar meu documento e minha selfie para a verificação, como descrito na{" "}
              <Link to="/privacidade" className="font-bold underline">
                Política de privacidade
              </Link>
              .
            </Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
              Voltar
            </Button>
            <Button className="flex-1" disabled={!agree || busy} onClick={() => void send()}>
              {busy ? "Enviando…" : "Enviar para análise"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
