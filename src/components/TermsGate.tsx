import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TERMS_VERSION, termsErrorMessage } from "@/lib/legal";

/**
 * Quem ainda não aceitou a versão atual dos Termos (conta antiga, login com Google ou termos novos)
 * vê este aviso por cima do app e só segue depois de aceitar.
 */
export function TermsGate({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: accepted } = useQuery({
    queryKey: ["terms", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("terms_version")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.terms_version === TERMS_VERSION;
    },
  });
  if (accepted !== false) return null;

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc("accept_terms", { _version: TERMS_VERSION });
    setBusy(false);
    if (error) {
      toast.error(termsErrorMessage(error) ?? "Não foi possível registrar. Tente de novo.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["terms", userId] });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <div className="block-card w-full max-w-md space-y-3 bg-background p-5">
        <h2 id="terms-title" className="text-xl">
          Antes de continuar
        </h2>
        <p className="text-sm">
          Leia os{" "}
          <Link to="/termos" target="_blank" className="font-bold underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link to="/privacidade" target="_blank" className="font-bold underline">
            Política de privacidade
          </Link>{" "}
          do Beecos.
        </p>
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms-agree"
            checked={agree}
            onCheckedChange={(v) => setAgree(v === true)}
          />
          <Label htmlFor="terms-agree" className="leading-snug">
            Li e aceito os Termos de uso e a Política de privacidade.
          </Label>
        </div>
        <div className="flex gap-2">
          <Button type="button" className="flex-1" disabled={!agree || busy} onClick={accept}>
            {busy ? "Salvando…" : "Aceitar e continuar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void supabase.auth.signOut()}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
