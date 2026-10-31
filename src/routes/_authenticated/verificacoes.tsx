import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/data";
import { purgeVerificationFiles, verificationErrorMessage } from "@/lib/verification";

export const Route = createFileRoute("/_authenticated/verificacoes")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "Verificações — Beecos" }, { name: "robots", content: "noindex" }],
  }),
  component: Reviews,
});

type Row = {
  id: string;
  user_id: string;
  doc_front_path: string;
  doc_back_path: string | null;
  selfie_path: string;
  address_proof_path: string | null;
  created_at: string;
  profiles: { full_name: string; slug: string | null } | null;
};

const REASONS = [
  "Foto do documento ilegível",
  "Selfie não confere com o documento",
  "Documento incompleto ou vencido",
  "Não foi possível confirmar a identidade",
];

function Shot({ path, label }: { path: string; label: string }) {
  const { data: url } = useQuery({
    queryKey: ["verif-url", path],
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("identity-docs")
        .createSignedUrl(path, 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-bold">{label}</figcaption>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={label}
            className="max-h-64 w-full rounded-lg border-2 border-foreground object-contain"
          />
        </a>
      ) : (
        <div className="h-32 rounded-lg border-2 border-dashed border-foreground" />
      )}
    </figure>
  );
}

type Addr = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
};

/** Endereço cadastrado, para comparar com o comprovante. Cada consulta fica registrada. */
function RegisteredAddress({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["verif-address", id],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verification_address", { _id: id });
      if (error) throw error;
      return (data as Addr | null) ?? null;
    },
  });
  if (isLoading)
    return <p className="text-xs text-muted-foreground">Buscando endereço cadastrado…</p>;
  if (!data)
    return (
      <p className="text-sm font-semibold">
        A pessoa não cadastrou endereço: não dá para marcar o Endereço como conferido.
      </p>
    );
  const cep = `${data.postal_code.slice(0, 5)}-${data.postal_code.slice(5)}`;
  return (
    <p className="rounded-lg border-2 border-foreground bg-accent p-2 text-sm">
      <span className="block text-xs font-bold uppercase">Endereço cadastrado</span>
      {data.street}
      {data.neighborhood ? `, ${data.neighborhood}` : ""} · {data.city}-{data.state} · CEP {cep}
    </p>
  );
}

function Case({ row, onDone }: { row: Row; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [addressOk, setAddressOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data: paths, error } = await supabase.rpc("review_verification", {
        _id: row.id,
        _approve: approve,
        _reason: reason,
        _address: addressOk,
      });
      if (error) throw error;
      toast.success(approve ? "Verificação aprovada." : "Pedido recusado.");
      onDone();
      // apaga os arquivos na hora; se falhar, a tela tenta de novo na próxima abertura
      await purgeVerificationFiles(row.id, paths ?? []).catch(() => undefined);
      onDone();
    } catch (e) {
      toast.error(verificationErrorMessage(e) ?? "Não consegui registrar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="block-card space-y-3 p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-lg">{row.profiles?.full_name || "Usuário"}</h2>
        <span className="text-xs text-muted-foreground">{timeAgo(row.created_at)}</span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <Shot path={row.doc_front_path} label="Documento (frente)" />
        {row.doc_back_path && <Shot path={row.doc_back_path} label="Documento (verso)" />}
        <Shot path={row.selfie_path} label="Selfie" />
        {row.address_proof_path && (
          <Shot path={row.address_proof_path} label="Comprovante de endereço" />
        )}
      </div>
      {row.address_proof_path && <RegisteredAddress id={row.id} />}
      {row.address_proof_path && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`a-${row.id}`}
            checked={addressOk}
            onCheckedChange={(v) => setAddressOk(v === true)}
          />
          <Label htmlFor={`a-${row.id}`}>O endereço do comprovante confere com o cadastro</Label>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`r-${row.id}`} className="text-sm font-bold">
          Motivo (só se for recusar)
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border-2 border-foreground px-2 py-0.5 text-xs font-semibold"
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea
          id={`r-${row.id}`}
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => void decide(true)}>
          Aprovar
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={busy || !reason.trim()}
          onClick={() => void decide(false)}
        >
          Recusar
        </Button>
      </div>
    </article>
  );
}

function Reviews() {
  const qc = useQueryClient();
  const { data: isMod, isLoading: checking } = useQuery({
    queryKey: ["is-moderator"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_moderator");
      if (error) throw error;
      return !!data;
    },
  });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["verif-queue"],
    enabled: isMod === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verifications")
        .select(
          "id, user_id, doc_front_path, doc_back_path, selfie_path, address_proof_path, created_at, profiles!identity_verifications_user_id_fkey(full_name, slug)",
        )
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // limpeza de segurança: pedidos já decididos cujos arquivos ainda não foram apagados
  useEffect(() => {
    if (isMod !== true) return;
    void (async () => {
      const { data } = await supabase
        .from("identity_verifications")
        .select("id, doc_front_path, doc_back_path, selfie_path, address_proof_path")
        .neq("status", "pending")
        .is("files_deleted_at", null)
        .limit(20);
      for (const r of data ?? []) {
        const paths = [
          r.doc_front_path,
          r.doc_back_path,
          r.selfie_path,
          r.address_proof_path,
        ].filter((p): p is string => !!p);
        await purgeVerificationFiles(r.id, paths).catch(() => undefined);
      }
    })();
  }, [isMod]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["verif-queue"] });
    void qc.invalidateQueries({ queryKey: ["moderator-counts"] });
  };

  if (checking) return <p className="text-muted-foreground">Carregando…</p>;
  if (!isMod)
    return <p className="block-card p-5 text-center">Esta página é só para a moderação.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Verificações de identidade</h1>
      <p className="text-sm text-muted-foreground">
        Compare a selfie com o documento. Os arquivos são apagados assim que você decide.
      </p>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {rows?.length === 0 && (
        <p className="block-card p-5 text-center text-muted-foreground">Nenhum pedido esperando.</p>
      )}
      {rows?.map((r) => (
        <Case key={r.id} row={r} onDone={refresh} />
      ))}
    </div>
  );
}
