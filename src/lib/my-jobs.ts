import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * "Minhas vagas": o que eu publiquei para contratar, as vagas de outras pessoas em que demonstrei
 * interesse e os meus anúncios de "estou disponível".
 */

export type Tone = "yellow" | "green" | "blue" | "gray";
export type Badge = { text: string; tone: Tone };

export type MyPost = {
  id: string;
  kind: "job" | "available";
  title: string;
  price: string;
  city: string;
  slug: string;
  profession_id: string | null;
  professions: { slug: string | null } | null;
  closed_at: string | null;
  expires_at: string | null;
  hidden_at: string | null;
  created_at: string;
  /** Quantas pessoas falaram sobre esta publicação. */
  interested: number;
  /** Situação dos serviços combinados por ela. */
  engagements: string[];
  /** Nome de quem foi escolhido/combinou (o primeiro). */
  partner: string | null;
};

export type MyInterest = {
  post: Omit<MyPost, "interested" | "engagements" | "partner">;
  owner: { id: string; full_name: string; slug: string | null };
  closed: boolean;
  engagement: string | null;
  at: string;
};

const POST_COLS =
  "id, kind, title, price, city, slug, profession_id, closed_at, expires_at, hidden_at, created_at, user_id, professions(slug)";

/** A publicação ainda recebe interessados? */
export function isOpen(
  p: Pick<MyPost, "closed_at" | "expires_at" | "hidden_at">,
  now = new Date(),
): boolean {
  if (p.closed_at || p.hidden_at) return false;
  return !p.expires_at || new Date(p.expires_at) > now;
}

/** Etiquetas de uma vaga minha (aba Contratei) ou de um anúncio meu. */
export function postBadges(p: MyPost): Badge[] {
  const out: Badge[] = [];
  if (p.hidden_at) out.push({ text: "Oculta pela moderação", tone: "gray" });
  else if (p.closed_at) out.push({ text: "Concluída", tone: "gray" });
  else if (!isOpen(p)) out.push({ text: "Prazo encerrado", tone: "gray" });
  if (p.engagements.includes("accepted"))
    out.push({ text: p.partner ? `Combinado com ${p.partner}` : "Combinado", tone: "green" });
  else if (p.engagements.includes("proposed"))
    out.push({
      text: p.partner ? `Aguardando ${p.partner} aceitar` : "Aguardando aceitar",
      tone: "yellow",
    });
  if (p.interested > 0 && isOpen(p))
    out.push({
      text:
        p.kind === "job"
          ? `${p.interested} ${p.interested === 1 ? "interessado" : "interessados"}`
          : `${p.interested} ${p.interested === 1 ? "quer" : "querem"} contratar`,
      tone: p.kind === "job" ? "yellow" : "blue",
    });
  if (p.interested === 0 && isOpen(p) && !p.engagements.length)
    out.push({ text: "Ainda sem interessados", tone: "gray" });
  return out;
}

/** Etiqueta de uma vaga de outra pessoa em que demonstrei interesse. */
export function interestBadge(i: Pick<MyInterest, "closed" | "engagement" | "post">): Badge {
  switch (i.engagement) {
    case "proposed":
      return { text: "Você foi escolhido: aceite", tone: "yellow" };
    case "accepted":
      return { text: "Combinado", tone: "green" };
    case "completed":
      return { text: "Concluído", tone: "gray" };
    case "cancelled":
      return { text: "Não seguiu", tone: "gray" };
  }
  if (i.closed) return { text: "Negociação encerrada", tone: "gray" };
  if (!isOpen(i.post)) return { text: "Vaga encerrada", tone: "gray" };
  return { text: "Conversando", tone: "gray" };
}

/** Situação mais importante primeiro (escolhido > combinado > conversando > encerrado). */
export function interestRank(i: Pick<MyInterest, "closed" | "engagement" | "post">): number {
  if (i.engagement === "proposed") return 0;
  if (i.engagement === "accepted") return 1;
  if (!i.engagement && !i.closed && isOpen(i.post)) return 2;
  return 3;
}

type PostRow = Omit<MyPost, "interested" | "engagements" | "partner"> & { user_id: string };

export function useMyJobs(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const me = userId!;
      const [mine, links, engs] = await Promise.all([
        supabase
          .from("posts")
          .select(POST_COLS)
          .eq("user_id", me)
          .order("created_at", { ascending: false }),
        // os assuntos das minhas conversas (só participantes leem)
        supabase.from("conversation_posts").select("post_id, created_at, closed_at"),
        supabase
          .from("engagements")
          .select("post_id, status, client_id, provider_id, created_at")
          .or(`client_id.eq.${me},provider_id.eq.${me}`)
          .order("created_at", { ascending: false }),
      ]);
      const error = mine.error ?? links.error ?? engs.error;
      if (error) throw error;

      const myPosts = (mine.data ?? []) as unknown as PostRow[];
      const myIds = new Set(myPosts.map((p) => p.id));
      const linkRows = (links.data ?? []) as unknown as {
        post_id: string;
        created_at: string;
        closed_at: string | null;
      }[];
      const engRows = engs.data ?? [];

      // outras pessoas envolvidas nas minhas publicações (nome de quem combinou)
      const partnerIds = [
        ...new Set(
          engRows
            .filter((e) => e.post_id && myIds.has(e.post_id))
            .map((e) => (e.client_id === me ? e.provider_id : e.client_id)),
        ),
      ];
      const otherPostIds = [
        ...new Set(linkRows.map((l) => l.post_id).filter((id) => !myIds.has(id))),
      ];
      const [others, partners] = await Promise.all([
        otherPostIds.length
          ? supabase.from("posts").select(POST_COLS).in("id", otherPostIds)
          : Promise.resolve({ data: [], error: null }),
        partnerIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", partnerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (others.error) throw others.error;
      if (partners.error) throw partners.error;
      const nameOf = new Map(
        ((partners.data ?? []) as { id: string; full_name: string }[]).map((p) => [
          p.id,
          (p.full_name || "").split(" ")[0] || null,
        ]),
      );

      const posts: MyPost[] = myPosts.map((p) => {
        const pe = engRows.filter((e) => e.post_id === p.id && e.status !== "cancelled");
        const live = pe.find((e) => e.status === "accepted" || e.status === "proposed");
        return {
          ...p,
          interested: linkRows.filter((l) => l.post_id === p.id).length,
          engagements: pe.map((e) => e.status),
          partner: live
            ? (nameOf.get(live.client_id === me ? live.provider_id : live.client_id) ?? null)
            : null,
        };
      });

      const otherRows = (others.data ?? []) as unknown as PostRow[];
      const ownerIds = [...new Set(otherRows.map((p) => p.user_id))];
      const owners = ownerIds.length
        ? await supabase.from("profiles").select("id, full_name, slug").in("id", ownerIds)
        : { data: [], error: null };
      if (owners.error) throw owners.error;
      const ownerOf = new Map(((owners.data ?? []) as MyInterest["owner"][]).map((o) => [o.id, o]));

      // só vagas para trabalhar (as de "quero contratar" de outras pessoas)
      const interests: MyInterest[] = otherRows
        .filter((p) => p.kind === "job")
        .map((p) => {
          const link = linkRows.find((l) => l.post_id === p.id)!;
          const eng = engRows.find((e) => e.post_id === p.id && e.provider_id === me);
          return {
            post: p,
            owner: ownerOf.get(p.user_id) ?? { id: p.user_id, full_name: "", slug: null },
            closed: !!link.closed_at,
            engagement: eng?.status ?? null,
            at: link.created_at,
          };
        })
        .sort((a, b) => interestRank(a) - interestRank(b) || b.at.localeCompare(a.at));

      return {
        jobs: posts.filter((p) => p.kind === "job"),
        ads: posts.filter((p) => p.kind === "available"),
        interests,
      };
    },
  });
}
