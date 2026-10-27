import { Link } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { accountErrorMessage } from "@/lib/legal";

/** "Privacidade e dados": baixar tudo o que o app guarda e excluir a conta (LGPD). */
export function PrivacyCard({
  userId,
  avatarPath,
  onDeleted,
}: {
  userId: string;
  avatarPath: string | null | undefined;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("export_my_data");
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `beecos-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não consegui gerar o arquivo. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      // a foto fica num armazenamento à parte: sai antes de a conta sumir
      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      toast.success("Conta excluída. Sentiremos a sua falta.");
      onDeleted();
    } catch (e) {
      toast.error(accountErrorMessage(e) ?? "Não consegui excluir a conta. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="block-card space-y-3 p-5" aria-label="Privacidade e dados" data-user={userId}>
      <h2 className="text-xl">Privacidade e dados</h2>
      <p className="text-sm text-muted-foreground">
        Os seus dados são seus. Baixe uma cópia ou exclua a conta quando quiser. Veja também os{" "}
        <Link to="/termos" className="font-bold underline">
          Termos
        </Link>{" "}
        e a{" "}
        <Link to="/privacidade" className="font-bold underline">
          Política de privacidade
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={download}>
          <Download /> Baixar meus dados
        </Button>
        <ConfirmButton
          title="Excluir a sua conta?"
          description="Isso apaga o seu perfil, as suas vagas, conversas, avaliações e avisos, e não dá para desfazer. As conversas também somem para a outra pessoa."
          confirmLabel="Excluir para sempre"
          variant="destructive"
          disabled={busy}
          onConfirm={remove}
        >
          <Trash2 /> Excluir minha conta
        </ConfirmButton>
      </div>
    </section>
  );
}
