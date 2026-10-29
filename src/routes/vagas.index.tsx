import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { usePostDistances, useWorkArea } from "@/lib/geo";
import { usePostStats } from "@/lib/services-hooks";
import { AdSlot } from "@/components/AdSlot";
import { FEED_AD_AFTER, shouldShowFeedAd } from "@/lib/ads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { parsePostCode } from "@/lib/post-code";
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

export const Route = createFileRoute("/vagas/")({
  validateSearch: (q: Record<string, unknown>) => ({
    q: typeof q["q"] === "string" ? (q["q"] as string) : undefined,
    tipo: q["tipo"] === "trabalhadores" ? ("trabalhadores" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Vagas e trabalhadores — Beecos" },
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
  component: Vagas,
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

function Vagas() {
  const search = Route.useSearch();
  const [filters, setFilters] = useState<FeedFilters>(() => ({
    ...EMPTY_FILTERS,
    q: search.q ?? "",
    kind: search.tipo === "trabalhadores" ? "available" : EMPTY_FILTERS.kind,
  }));
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
            ? "*, professions(name, slug), services(name), profiles!posts_user_id_fkey(full_name, slug, avatar_path, profile_skills(skill, level))"
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

  // quem digita o código de uma vaga (A3F9C1, #a3f9c1 ou o link) a encontra direto
  const code = parsePostCode(typed.q);
  const { data: byCode } = useQuery({
    queryKey: ["post-by-code", code, !!userId],
    enabled: ready && code !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          userId
            ? "*, professions(name, slug), services(name), profiles!posts_user_id_fkey(full_name, slug, avatar_path, profile_skills(skill, level))"
            : "*, professions(name, slug), services(name)",
        )
        .like("slug", `%-${code}`)
        .is("hidden_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PostWithAuthor | null;
    },
  });
  const shown = useMemo(() => {
    if (!posts) return posts;
    if (!code || !byCode) return posts;
    return [byCode, ...posts.filter((p) => p.id !== byCode.id)];
  }, [posts, byCode, code]);

  const slots = usePostStats(shown?.map((p) => p.id));
  const distances = usePostDistances(userId, shown?.map((p) => p.id) ?? []);
  const { data: workArea, isSuccess: areaLoaded } = useWorkArea(userId);

  function pickTopic(q: string) {
    setFilters((f) => ({ ...f, q }));
    document.getElementById("feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const hasSearch = filters.q.trim() !== "" || activeCount > 0;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl">Vagas e trabalhadores</h1>

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
                  "flex min-h-10 items-center gap-1.5 rounded-full border-2 border-foreground px-3 text-sm font-bold transition-[background-color,box-shadow,transform] duration-150 hover:bg-foreground/[0.07] hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] active:scale-95 " +
                  (on ? "bg-foreground text-background" : "bg-card")
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </div>

        <Link
          to="/comunidade"
          search={{ grupo: undefined }}
          className="block-card flex items-start gap-3 bg-accent p-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-foreground bg-primary">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-display">
              Comunidades por profissão
            </p>
            <p className="text-sm text-muted-foreground">
              Grupos de optometristas, enfermeiros, eletricistas e outros, com vagas rápidas para
              quem é da área.
            </p>
          </div>
        </Link>
      </section>

      <section id="feed" className="scroll-mt-20 space-y-4">
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
              {k === "job" ? "Vagas em aberto" : "Trabalhadores disponíveis"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Buscar: pedreiro, limpeza ou código da vaga"
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

        {userId && areaLoaded && !workArea && (
          <Link
            to="/perfil"
            className="block-card flex items-center justify-between gap-3 p-3 text-sm font-semibold"
          >
            Informe o seu CEP para ver a distância das vagas
            <span className="font-bold underline">Informar →</span>
          </Link>
        )}

        <div className="space-y-4">
          {isLoading && <p className="text-center text-muted-foreground">Carregando…</p>}
          {shown?.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-foreground/40 p-8 text-center text-muted-foreground">
              {hasSearch
                ? "Nada encontrado com esses filtros. Tente tirar algum."
                : "Nada por aqui ainda. Seja o primeiro a publicar!"}
            </div>
          )}
          {shown?.map((p, i) => (
            <div key={p.id} className="space-y-4">
              <PostCard
                post={p}
                slots={slots[p.id]}
                distance={distances.get(p.id)}
              />
              {i === FEED_AD_AFTER - 1 && shouldShowFeedAd(shown.length) && (
                <AdSlot placement="feed" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
