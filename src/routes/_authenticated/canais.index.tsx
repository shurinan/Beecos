import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Seal } from "@/components/Seal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useBadge } from "@/lib/badges";
import { useCatalog } from "@/lib/catalog";
import { type Channel, type ChannelNumbers, useChannels, useFollow } from "@/lib/channels";
import { initials } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/canais/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Canais — Beecos" },
      { name: "description", content: "Empresas que reúnem as vagas delas num lugar só." },
    ],
  }),
  component: Channels,
});

function ChannelRow({
  channel,
  numbers,
  professions,
  onFollow,
  busy,
  mine,
}: {
  channel: Channel;
  numbers: ChannelNumbers | undefined;
  professions: string[];
  onFollow: () => void;
  busy: boolean;
  mine: boolean;
}) {
  const { tier, info } = useBadge(channel.owner_id);
  const inactive = mine && !!info && !info.premium;
  return (
    <li className="block-card flex items-center gap-3 p-3">
      <Link
        to="/canais/$slug"
        params={{ slug: channel.slug }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-primary font-display"
        >
          {initials(channel.name)}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="truncate">{channel.name}</span>
            {tier && <Seal tier={tier} size={16} />}
            {inactive && (
              <span className="rounded border-[1.5px] border-foreground px-1.5 text-[10px] font-bold uppercase">
                Inativo
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {professions.length ? professions.join(" · ") : "Vários trabalhos"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {numbers
              ? `${numbers.followers} ${numbers.followers === 1 ? "seguidor" : "seguidores"} · ${numbers.open_jobs} ${numbers.open_jobs === 1 ? "vaga aberta" : "vagas abertas"}`
              : " "}
          </span>
        </span>
      </Link>
      <Button
        type="button"
        size="sm"
        variant={numbers?.following ? "outline" : "default"}
        disabled={busy}
        onClick={onFollow}
      >
        {numbers?.following ? "Seguindo" : "Seguir"}
      </Button>
    </li>
  );
}

function Channels() {
  const { userId } = useAuth();
  const { data: catalog } = useCatalog();
  const { data, isLoading } = useChannels();
  const { follow, unfollow } = useFollow(userId);
  const [q, setQ] = useState("");
  const [prof, setProf] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const channels = data?.channels ?? [];
  const numbers = data?.numbers;
  const profNames = (c: Channel) =>
    c.channel_professions
      .map((p) => catalog?.professions.get(p.profession_id)?.name)
      .filter((n): n is string => !!n);

  const usedProfessions = useMemo(() => {
    const ids = new Set<string>();
    for (const c of channels) for (const p of c.channel_professions) ids.add(p.profession_id);
    return [...ids]
      .map((id) => catalog?.professions.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [channels, catalog]);

  const term = q.trim().toLowerCase();
  const filtered = channels.filter(
    (c) =>
      (!prof || c.channel_professions.some((p) => p.profession_id === prof)) &&
      (!term || `${c.name} ${c.description}`.toLowerCase().includes(term)),
  );
  const following = filtered.filter((c) => numbers?.get(c.id)?.following);
  const others = filtered.filter((c) => !numbers?.get(c.id)?.following);

  async function toggle(c: Channel) {
    setBusy(c.id);
    try {
      if (numbers?.get(c.id)?.following) await unfollow(c.id);
      else await follow(c.id);
    } catch {
      toast.error("Não consegui atualizar. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  const row = (c: Channel) => (
    <ChannelRow
      key={c.id}
      channel={c}
      numbers={numbers?.get(c.id)}
      professions={profNames(c)}
      onFollow={() => void toggle(c)}
      busy={busy === c.id}
      mine={c.owner_id === userId}
    />
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl">
          <Megaphone className="h-6 w-6" aria-hidden="true" /> Canais
        </h1>
        <Button asChild size="sm" variant="outline">
          <Link to="/canais/novo">+ Criar canal</Link>
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">
        Empresas e contratantes que reúnem as vagas delas num lugar só. Siga para receber avisos.
        Quer ver as vagas por ofício?{" "}
        <Link
          to="/comunidade"
          search={{ grupo: undefined, ordem: undefined }}
          className="font-bold underline"
        >
          Abra a Comunidade
        </Link>
        .
      </p>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar canais"
          aria-label="Pesquisar canais"
          className="pl-9"
        />
      </div>

      {usedProfessions.length > 0 && (
        <nav aria-label="Filtrar por trabalho" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2 pb-1">
            {[{ id: null as string | null, name: "Todos" }, ...usedProfessions].map((p) => (
              <li key={p.id ?? "all"}>
                <button
                  type="button"
                  aria-pressed={prof === p.id}
                  onClick={() => setProf(p.id)}
                  className={
                    "whitespace-nowrap rounded-full border-2 border-foreground px-3 py-1.5 text-sm font-semibold " +
                    (prof === p.id ? "bg-foreground text-background" : "")
                  }
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}

      {following.length > 0 && (
        <section aria-labelledby="c-seg" className="space-y-2">
          <h2 id="c-seg" className="text-lg">
            Seguindo
          </h2>
          <ul className="space-y-2">{following.map(row)}</ul>
        </section>
      )}
      {others.length > 0 && (
        <section aria-labelledby="c-outros" className="space-y-2">
          <h2 id="c-outros" className="text-lg">
            Encontrar canais
          </h2>
          <ul className="space-y-2">{others.map(row)}</ul>
        </section>
      )}
      {!isLoading && filtered.length === 0 && (
        <p className="block-card p-5 text-center text-muted-foreground">
          {channels.length === 0
            ? "Ainda não há canais. Seja o primeiro a criar um."
            : "Nenhum canal com esse filtro."}
        </p>
      )}
    </div>
  );
}
