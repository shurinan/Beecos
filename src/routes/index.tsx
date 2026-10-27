import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bike,
  Briefcase,
  Crown,
  Droplets,
  HardHat,
  HeartPulse,
  MessageCircle,
  Plus,
  Scissors,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithAuthor } from "@/components/PostCard";
import { usePostStats } from "@/lib/services-hooks";
import { AdSlot } from "@/components/AdSlot";
import { FEED_AD_AFTER, shouldShowFeedAd } from "@/lib/ads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { PostKind } from "@/lib/data";
import {
  EMPTY_FILTERS,
  RATING_OPTIONS,
  TOPICS,
  activeFilterCount,
  searchArgs,
  useDebounced,
  type FeedFilters,
} from "@/lib/discovery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Beecos — Vagas e trabalhadores na sua cidade" },
      {
        name: "description",
        content:
          "Veja vagas de trabalho braçal e profissionais disponíveis na sua cidade. Negocie direto pelo chat.",
      },
      { property: "og:title", content: "Beecos — Vagas e trabalhadores na sua cidade" },
      {
        property: "og:description",
        content: "Veja vagas de trabalho braçal e profissionais disponíveis na sua cidade.",
      },
    ],
  }),
  component: Index,
});

const TOPIC_ICON = {
  hardhat: HardHat,
  zap: Zap,
  droplets: Droplets,
  sparkles: Sparkles,
  truck: Truck,
  heart: HeartPulse,
  scissors: Scissors,
  bike: Bike,
} as const;

const FIND = [
  { icon: Briefcase, title: "Vagas", text: "Gente precisando de ajuda hoje, perto de você." },
  {
    icon: Users,
    title: "Trabalhadores",
    text: "Profissionais disponíveis, com habilidades e nível.",
  },
  { icon: MessageCircle, title: "Chat direto", text: "Combine preço e horário sem intermediário." },
  { icon: Star, title: "Avaliações", text: "Só quem concluiu um serviço pode avaliar." },
] as const;

const STEPS = [
  { title: "Publique ou procure", text: "Conte o que precisa ou o que você sabe fazer." },
  { title: "Converse e escolha", text: "Quem contrata escolhe o prestador, e ele aceita." },
  { title: "Conclua e avalie", text: "Terminou o serviço, os dois se avaliam." },
] as const;

function Index() {
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);
  const { userId, ready } = useAuth();
  const set = <K extends keyof FeedFilters>(k: K, v: FeedFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const typed = useDebounced(filters);
  const args = searchArgs(typed);
  const activeCount = activeFilterCount(filters);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed", args, !!userId],
    enabled: ready,
    queryFn: async () => {
      // 1) o banco filtra e ordena (premium primeiro); 2) busca os dados dos anúncios
      const found = await supabase.rpc("search_post_ids", args);
      if (found.error) throw found.error;
      const order = found.data ?? [];
      if (order.length === 0) return [] as PostWithAuthor[];
      const { data, error } = await supabase
        .from("posts")
        // quem não está logado não lê perfis (só quem tem conta), então não pede o autor
        .select(
          userId
            ? "*, professions(name), services(name), profiles(full_name, avatar_path, profile_skills(skill, level))"
            : "*, professions(name), services(name)",
        )
        .in(
          "id",
          order.map((o) => o.id),
        );
      if (error) throw error;
      const byId = new Map((data as unknown as PostWithAuthor[]).map((p) => [p.id, p] as const));
      const result: PostWithAuthor[] = [];
      for (const o of order) {
        const p = byId.get(o.id);
        if (p) result.push({ ...p, premium: o.premium });
      }
      return result;
    },
  });

  const slots = usePostStats(posts?.map((p) => p.id));

  function pickTopic(q: string) {
    setFilters((f) => ({ ...f, q }));
    document.getElementById("feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const hasSearch = filters.q.trim() !== "" || activeCount > 0;

  return (
    <div className="space-y-8">
      <section className="block-card overflow-hidden">
        <div className="p-5">
          <p className="mb-2 inline-block rounded border-2 border-foreground bg-accent px-2 py-0.5 text-xs font-bold uppercase">
            Bicos perto de você
          </p>
          <h1 className="text-4xl leading-[0.95]">
            Trabalho pesado,
            <br />
            <span className="bg-primary px-1">negócio direto.</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Ache um bico ou alguém pra ajudar. Combine o preço no chat, escolha quem vai fazer e
            avalie no final.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button asChild size="lg" className="w-full">
              <Link to={userId ? "/painel" : "/auth"}>
                <Plus /> Preciso de alguém
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full">
              <a href="#feed">Procuro um bico</a>
            </Button>
          </div>
        </div>
        <div className="hazard-stripe h-2.5" />
      </section>

      {!userId && (
        <section className="space-y-3">
          <h2 className="text-xl">O que você encontra aqui</h2>
          <div className="grid grid-cols-2 gap-3">
            {FIND.map(({ icon: Icon, title, text }) => (
              <div key={title} className="block-card space-y-1 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-foreground bg-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-base">{title}</h3>
                <p className="text-sm leading-snug text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!userId && (
        <section className="space-y-3">
          <h2 className="text-xl">Como funciona</h2>
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground font-display text-background">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold leading-tight">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl">Procure por assunto</h2>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const Icon = TOPIC_ICON[t.icon];
            const on = filters.q.trim().toLowerCase() === t.q;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => pickTopic(on ? "" : t.q)}
                aria-pressed={on}
                className={
                  "flex min-h-10 items-center gap-1.5 rounded-full border-2 border-foreground px-3 text-sm font-bold " +
                  (on ? "bg-foreground text-background" : "bg-card")
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="block-card flex items-start gap-3 bg-accent p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-foreground bg-primary">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-display">
              Comunidades por profissão
              <span className="rounded bg-foreground px-1.5 py-0.5 font-sans text-xs font-bold uppercase text-background">
                Em breve
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Grupos de optometristas, enfermeiros, eletricistas e outros, com vagas rápidas para
              quem é da área.
            </p>
          </div>
        </div>
      </section>

      <section id="feed" className="scroll-mt-20 space-y-4">
        <h2 className="text-xl">Vagas e trabalhadores</h2>

        <div className="grid grid-cols-2 overflow-hidden rounded-lg border-2 border-foreground">
          {(["job", "available"] as PostKind[]).map((k) => (
            <button
              key={k}
              onClick={() => set("kind", k)}
              className={
                "min-h-11 py-2.5 text-sm font-bold " +
                (filters.kind === k
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground")
              }
            >
              {k === "job" ? "Vagas" : "Trabalhadores"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Buscar: pedreiro, limpeza…"
              aria-label="Buscar"
              className="h-11 border-2 pl-9"
            />
          </div>
          <Button
            type="button"
            variant={open || activeCount > 0 ? "default" : "outline"}
            className="h-11 shrink-0"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <SlidersHorizontal /> Filtros
            {activeCount > 0 && (
              <span className="rounded-full bg-foreground px-1.5 text-xs text-background">
                {activeCount}
              </span>
            )}
          </Button>
        </div>

        {open && (
          <div className="block-card space-y-3 p-4">
            <label className="block space-y-1 text-sm font-semibold">
              Cidade
              <Input
                value={filters.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Ex: Osasco"
                className="h-11 border-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm font-semibold">
                Preço mínimo (R$)
                <Input
                  inputMode="decimal"
                  value={filters.minPrice}
                  onChange={(e) => set("minPrice", e.target.value)}
                  placeholder="0"
                  className="h-11 border-2"
                />
              </label>
              <label className="block space-y-1 text-sm font-semibold">
                Preço máximo (R$)
                <Input
                  inputMode="decimal"
                  value={filters.maxPrice}
                  onChange={(e) => set("maxPrice", e.target.value)}
                  placeholder="Sem limite"
                  className="h-11 border-2"
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm font-semibold">
              Avaliação de quem publicou
              <select
                value={filters.minRating}
                onChange={(e) => set("minRating", e.target.value)}
                className="h-11 w-full rounded-md border-2 border-foreground bg-background px-3 font-normal"
              >
                {RATING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={filters.onlyPremium}
                onChange={(e) => set("onlyPremium", e.target.checked)}
                className="h-5 w-5 accent-[var(--primary)]"
              />
              <Crown className="h-4 w-4" aria-hidden="true" /> Só perfis Premium
            </label>
            <p className="text-xs text-muted-foreground">
              Anúncios sem preço combinado ("a combinar") não aparecem quando você filtra por preço.
            </p>
            {hasSearch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilters((f) => ({ ...EMPTY_FILTERS, kind: f.kind }))}
              >
                <X /> Limpar busca e filtros
              </Button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {isLoading && <p className="text-center text-muted-foreground">Carregando…</p>}
          {posts?.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-foreground/40 p-8 text-center text-muted-foreground">
              {hasSearch
                ? "Nada encontrado com esses filtros. Tente tirar algum."
                : "Nada por aqui ainda. Seja o primeiro a publicar!"}
            </div>
          )}
          {posts?.map((p, i) => (
            <div key={p.id} className="space-y-4">
              <PostCard post={p} slots={slots[p.id]} />
              {i === FEED_AD_AFTER - 1 && shouldShowFeedAd(posts.length) && (
                <AdSlot placement="feed" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
