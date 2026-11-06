import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Pencil, Plus } from "lucide-react";
import { openPostEditor } from "@/lib/post-editor";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/lib/catalog";
import {
  type Badge,
  interestBadge,
  isOpen,
  type MyInterest,
  type MyPost,
  postBadges,
  useMyJobs,
} from "@/lib/my-jobs";
import { postParams, profileParam } from "@/lib/urls";

type Aba = "contratei" | "trabalhar";

export const Route = createFileRoute("/_authenticated/minhas-vagas")({
  staticData: { sitemap: false },
  validateSearch: (q: Record<string, unknown>): { aba: Aba } => ({
    aba: q["aba"] === "trabalhar" ? "trabalhar" : "contratei",
  }),
  head: () => ({
    meta: [
      { title: "Minhas vagas — Beecos" },
      {
        name: "description",
        content: "As vagas que você publicou, as que quer trabalhar e os seus anúncios.",
      },
    ],
  }),
  component: MinhasVagas,
});

const TONE: Record<Badge["tone"], string> = {
  yellow: "bg-primary text-primary-foreground",
  green: "bg-[oklch(0.9_0.08_150)] text-[oklch(0.25_0.06_150)]",
  blue: "bg-[oklch(0.9_0.05_255)] text-[oklch(0.28_0.08_255)]",
  gray: "bg-muted text-foreground",
};

function Pill({ b }: { b: Badge }) {
  return (
    <span
      className={`inline-block rounded-full border-[1.5px] border-foreground px-2 py-px text-xs font-bold ${TONE[b.tone]}`}
    >
      {b.text}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function CardShell({
  title,
  meta,
  badges,
  edit = false,
}: {
  title: string;
  meta: string;
  badges: Badge[];
  /** Publicação minha: tocar abre o editor (lápis no lugar da setinha). */
  edit?: boolean;
}) {
  return (
    <span className="block-card flex items-center gap-3 p-3 transition-transform active:translate-x-0.5 active:translate-y-0.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">{meta}</span>
        {badges.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {badges.map((b) => (
              <Pill key={b.text} b={b} />
            ))}
          </span>
        )}
      </span>
      {edit ? (
        <span className="flex flex-none flex-col items-center text-xs font-bold">
          <Pencil className="h-5 w-5" aria-hidden="true" />
          Editar
        </span>
      ) : (
        <ChevronRight className="h-5 w-5 flex-none" aria-hidden="true" />
      )}
    </span>
  );
}

function metaLine(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" · ");
}

function MyPostCard({ p, profession }: { p: MyPost; profession: string | undefined }) {
  return (
    <li className="space-y-1">
      <button
        type="button"
        onClick={() => openPostEditor(p.id)}
        aria-label={`Editar ${p.title}`}
        className="block w-full text-left"
      >
        <CardShell
          title={p.title}
          meta={metaLine([
            profession,
            p.city,
            p.kind === "available" ? "Disponível" : p.price || "a combinar",
          ])}
          badges={postBadges(p)}
          edit
        />
      </button>
      <div className="flex justify-end gap-4 px-1 text-sm font-bold">
        <Link
          to="/vagas/$profissao/$codigo/interessados"
          params={postParams(p)}
          className="underline"
        >
          Ver interessados{p.interested > 0 ? ` (${p.interested})` : ""}
        </Link>
        <Link to="/vagas/$profissao/$codigo" params={postParams(p)} className="underline">
          Ver como os outros veem
        </Link>
      </div>
    </li>
  );
}

function InterestCard({ i, profession }: { i: MyInterest; profession: string | undefined }) {
  const owner = i.owner.full_name || "Quem publicou";
  return (
    <li>
      <Link
        to="/conversas/$slug"
        params={{ slug: profileParam({ id: i.owner.id, slug: i.owner.slug }) }}
        className="block"
      >
        <CardShell
          title={i.post.title}
          meta={metaLine([owner, profession, i.post.city, i.post.price || "a combinar"])}
          badges={[interestBadge(i)]}
        />
      </Link>
    </li>
  );
}

function Empty({ text, cta, onCta }: { text: string; cta: string; onCta: () => void }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-foreground/40 p-4 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button type="button" size="sm" className="mt-3" onClick={onCta}>
        <Plus /> {cta}
      </Button>
    </div>
  );
}

function MinhasVagas() {
  const { userId } = Route.useRouteContext();
  const { aba } = Route.useSearch();
  const navigate = useNavigate();
  const { data: catalog } = useCatalog();
  const { data, isLoading, isError, refetch } = useMyJobs(userId);
  const prof = (id: string | null) => (id ? catalog?.professions.get(id)?.name : undefined);
  const publish = (tipo: "contratar" | "trabalhar") =>
    void navigate({ to: "/publicar", search: { tipo } });

  const tabs: { id: Aba; label: string; hint: string }[] = [
    { id: "contratei", label: "Contratei", hint: "vagas que ofereci" },
    { id: "trabalhar", label: "Quero trabalhar", hint: "meus interesses" },
  ];

  const openJobs = data?.jobs.filter((p) => isOpen(p)) ?? [];
  const doneJobs = data?.jobs.filter((p) => !isOpen(p)) ?? [];

  return (
    <div className="space-y-3">
      <h1 className="text-3xl">Minhas vagas</h1>
      <div
        role="tablist"
        aria-label="Minhas vagas"
        className="flex overflow-hidden rounded-xl border-2 border-foreground bg-card"
      >
        {tabs.map((t) => {
          const on = aba === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() =>
                void navigate({ to: "/minhas-vagas", search: { aba: t.id }, replace: true })
              }
              className={`flex-1 px-2 py-2 text-center font-bold leading-tight ${on ? "bg-foreground text-primary dark:text-background" : ""}`}
            >
              {t.label}
              <span className="block text-xs font-semibold opacity-75">{t.hint}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <p className="py-8 text-center text-muted-foreground">Carregando…</p>}
      {isError && (
        <div className="block-card space-y-3 p-5 text-center">
          <p className="font-semibold">Não foi possível carregar as suas vagas.</p>
          <Button onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      )}

      {data && aba === "contratei" && (
        <div role="tabpanel">
          {data.jobs.length === 0 ? (
            <div className="mt-4">
              <Empty
                text="Você ainda não publicou nenhuma vaga."
                cta="Contratar um profissional"
                onCta={() => publish("contratar")}
              />
            </div>
          ) : (
            <>
              {openJobs.length > 0 && <Label>Abertas · {openJobs.length}</Label>}
              <ul className="space-y-2.5">
                {openJobs.map((p) => (
                  <MyPostCard key={p.id} p={p} profession={prof(p.profession_id)} />
                ))}
              </ul>
              {doneJobs.length > 0 && <Label>Encerradas · {doneJobs.length}</Label>}
              <ul className="space-y-2.5">
                {doneJobs.map((p) => (
                  <MyPostCard key={p.id} p={p} profession={prof(p.profession_id)} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {data && aba === "trabalhar" && (
        <div role="tabpanel">
          <Label>Vagas em que tenho interesse · {data.interests.length}</Label>
          {data.interests.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-foreground/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Quando você tocar em “Tenho interesse” numa vaga, ela aparece aqui.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/vagas" search={{ q: undefined, tipo: undefined }}>
                  Procurar vagas
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {data.interests.map((i) => (
                <InterestCard key={i.post.id} i={i} profession={prof(i.post.profession_id)} />
              ))}
            </ul>
          )}
          <Label>Meus anúncios de serviço · {data.ads.length}</Label>
          {data.ads.length === 0 ? (
            <Empty
              text="Anuncie que você está disponível: o anúncio fica na vitrine para quem quer contratar."
              cta="Oferecer um serviço"
              onCta={() => publish("trabalhar")}
            />
          ) : (
            <ul className="space-y-2.5">
              {data.ads.map((p) => (
                <MyPostCard key={p.id} p={p} profession={prof(p.profession_id)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
