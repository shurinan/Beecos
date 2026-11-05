import { Link } from "@tanstack/react-router";
import { Check, Copy, Gift, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/profile-bits";
import { Button } from "@/components/ui/button";
import {
  INVITE_GOAL,
  inviteLink,
  inviteMessage,
  inviteeStep,
  useReferralStatus,
  whatsappShareUrl,
} from "@/lib/referrals";

function fmt(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

/** Meu perfil › Indique e ganhe. */
export function ReferralCard({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = useReferralStatus(userId);

  if (isLoading) return <p className="py-6 text-center text-muted-foreground">Carregando…</p>;
  if (isError || !data)
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível carregar as suas indicações.</p>
        <Button onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );

  const counted = Math.min(data.counted, INVITE_GOAL);
  const missing = INVITE_GOAL - counted;
  const username = data.username;
  const waiting = data.next_at && new Date(data.next_at) > new Date();
  const last = data.rewards[0];

  async function copy() {
    if (!username) return;
    try {
      await navigator.clipboard.writeText(inviteMessage(username));
      toast.success("Link e mensagem copiados. É só colar onde quiser.");
    } catch {
      toast.error("Não foi possível copiar. Segure o dedo no link para copiar.");
    }
  }
  async function share() {
    if (!username) return;
    try {
      await navigator.share({ text: inviteMessage(username) });
    } catch {
      /* a pessoa fechou o compartilhar */
    }
  }
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-4">
      <section className="block-card space-y-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-foreground bg-primary text-primary-foreground">
            <Gift className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg leading-snug">
            Traga {INVITE_GOAL} prestadores, ganhe 1 mês de Premium
          </h2>
        </div>

        {last && waiting && (
          <p role="status" className="rounded-lg border-2 border-foreground bg-accent p-3 text-sm">
            <b>Você ganhou 1 mês de Premium em {fmt(last.granted_at)}!</b>{" "}
            {last.kind === "postpone"
              ? "A sua próxima cobrança foi adiada em 30 dias."
              : last.until
                ? `O Premium vale até ${fmt(last.until)}.`
                : ""}{" "}
            Os próximos indicados continuam contando: o próximo mês grátis pode sair a partir de{" "}
            {fmt(data.next_at)}.
          </p>
        )}

        <div className="flex gap-1.5" aria-label={`${counted} de ${INVITE_GOAL} prestadores`}>
          {Array.from({ length: INVITE_GOAL }, (_, i) => (
            <span
              key={i}
              className={`flex h-9 flex-1 items-center justify-center rounded-lg border-2 border-foreground text-sm font-bold ${i < counted ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {i < counted ? <Check className="h-5 w-5" strokeWidth={3} /> : i + 1}
            </span>
          ))}
        </div>
        <p className="text-sm">
          <b>
            {counted} de {INVITE_GOAL}
          </b>{" "}
          {missing > 0
            ? `prestadores contam. ${missing === 1 ? "Falta 1" : `Faltam ${missing}`}.`
            : waiting
              ? "prestadores contam. O próximo mês grátis sai assim que puder."
              : "prestadores contam."}
        </p>

        {username ? (
          <div className="space-y-2">
            <Button asChild className="w-full bg-[#25D366] text-[#0b2b16] hover:bg-[#1fbe5b]">
              <a href={whatsappShareUrl(username)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Convidar pelo WhatsApp
              </a>
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={copy}>
                <Copy /> Copiar link e mensagem
              </Button>
              {canShare && (
                <Button type="button" variant="outline" onClick={share} aria-label="Compartilhar">
                  <Share2 />
                </Button>
              )}
            </div>
            <p className="selectable break-all text-center text-xs text-muted-foreground">
              {inviteLink(username)}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-foreground/40 p-3 text-sm">
            Para ter o seu link, escolha um nome de usuário.{" "}
            <Link to="/perfil" search={{ secao: "perfil" }} className="font-bold underline">
              Escolher agora
            </Link>
          </div>
        )}
      </section>

      <section className="block-card space-y-2 p-5">
        <h2 className="text-lg">Seus convidados · {data.people.length}</h2>
        {data.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Quem criar a conta pelo seu link aparece aqui, com o que falta para contar.
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10">
            {data.people.map((p, i) => {
              const step = inviteeStep(p);
              return (
                <li key={`${p.joined_at}-${i}`} className="flex items-center gap-3 py-2">
                  <Avatar name={p.name} path={p.avatar_path} size={36} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span
                    className={`shrink-0 rounded-full border-[1.5px] border-foreground px-2 py-px text-xs font-bold ${step.done ? "bg-[oklch(0.9_0.08_150)] text-[oklch(0.25_0.06_150)]" : "bg-primary text-primary-foreground"}`}
                  >
                    {step.text}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          Conta quem criou a conta pelo seu link, confirmou o e-mail, cadastrou 1 habilidade e
          verificou a identidade. 1 mês grátis a cada {INVITE_GOAL}, um por vez: não acumula. Se
          você já paga o Premium mensal, a próxima cobrança é adiada em 30 dias.
        </p>
      </section>
    </div>
  );
}
