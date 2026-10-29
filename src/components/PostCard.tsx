import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PostActions } from "@/components/PostActions";
import { postCode } from "@/lib/post-code";
import { useAuth } from "@/lib/auth";
import { MapPin, Banknote, Crown } from "lucide-react";
import { COVER_BG, coverVars, FILLED_COVER, resolveCover, resolveIcon } from "@/lib/post-look";
import { Avatar } from "@/components/profile-bits";
import { KIND_LABEL, timeAgo, type PostKind } from "@/lib/data";
import { levelLabel, topSkill, type SkillBase } from "@/lib/skills";
import { catalogLabel } from "@/lib/catalog";
import { formatKm, type PostDistance } from "@/lib/geo";
import { isFilled, vacanciesLabel } from "@/lib/services";
import type { PostSlots } from "@/lib/services-hooks";
import { postParams, profileParam } from "@/lib/urls";

export type PostWithAuthor = {
  id: string;
  /** Endereço da vaga (/vagas/profissao/codigo). */
  slug?: string;
  kind: string;
  title: string;
  description: string;
  city: string;
  price: string;
  created_at: string;
  user_id: string;
  vacancies?: number;
  premium?: boolean;
  cover_color?: string | null;
  cover_icon?: string | null;
  urgent?: boolean;
  negotiable?: boolean;
  highlight?: boolean;
  professions?: { name: string; slug?: string | null } | null;
  services?: { name: string } | null;
  profiles: {
    full_name: string;
    slug?: string | null;
    avatar_path?: string | null;
    profile_skills: SkillBase[];
  } | null;
};

export function PostCard({
  post,
  slots,
  distance,
  full = false,
}: {
  /** Na página da vaga: mostra o texto inteiro, sem cortar com "…". */
  full?: boolean;
  post: PostWithAuthor;
  slots?: PostSlots | undefined;
  /** Distância até quem está vendo; só existe para quem informou onde atua. */
  distance?: PostDistance | undefined;
}) {
  const kind = post.kind as PostKind;
  const { userId } = useAuth();
  const top = topSkill(post.profiles?.profile_skills);
  const filled = kind === "job" && isFilled(slots);
  const vacancy =
    kind === "job"
      ? vacanciesLabel(slots ?? (post.vacancies ? { vacancies: post.vacancies, taken: 0 } : null))
      : null;
  const Icon = resolveIcon(post.cover_icon, post.professions?.name);
  const cover = filled
    ? FILLED_COVER
    : resolveCover(post.cover_color, post.professions?.slug ?? post.professions?.name);
  const highlighted = !!post.premium && !!post.highlight && !filled;
  const params = post.slug
    ? postParams({ slug: post.slug, professions: post.professions ?? null })
    : null;
  const expandable = !full && !!params;
  const [open, setOpen] = useState(false);
  const tag = "rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide";
  return (
    <>
      <article
        className={
          "block-card overflow-hidden " +
          (filled ? "opacity-75 " : "") +
          (highlighted ? "bg-primary/10" : "")
        }
      >
        <div
          className={
            "relative flex min-h-[76px] flex-wrap items-end gap-1.5 px-4 pb-3 pt-4 text-[#1B1D23] " +
            (filled ? "" : COVER_BG)
          }
          style={filled ? { background: cover } : coverVars(cover)}
        >
          <Icon
            className="absolute right-3 top-2.5 h-12 w-12 opacity-90"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span className={tag + " bg-[#1B1D23] text-[#F9C80E]"}>
            {post.professions?.name ?? KIND_LABEL[kind]}
          </span>
          {post.professions && kind !== "job" && (
            <span className={tag + " border border-[#1B1D23] bg-white/70"}>{KIND_LABEL[kind]}</span>
          )}
          {post.premium && (
            <span className={tag + " flex items-center gap-1 bg-white"}>
              <Crown className="h-3 w-3" aria-hidden="true" /> Premium
            </span>
          )}
          {post.urgent && !filled && (
            <span className={tag + " bg-destructive text-destructive-foreground"}>Urgente</span>
          )}
          {filled && <span className={tag + " bg-[#5a5d66] text-white"}>Preenchida</span>}
        </div>
        <div className="space-y-2.5 p-4">
          <h3 className="text-lg leading-tight">
            {expandable ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-left hover:underline"
              >
                {post.title}
              </button>
            ) : (
              post.title
            )}
          </h3>
          {post.professions && post.services && (
            <p className="text-sm font-semibold text-muted-foreground">
              {catalogLabel(post.professions, post.services)}
            </p>
          )}
          {post.description && (
            <p
              className={
                "text-sm text-muted-foreground " +
                (full ? "selectable whitespace-pre-wrap break-words" : "line-clamp-2")
              }
            >
              {post.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 text-sm font-semibold">
            {post.city && (
              <span className="flex items-center gap-1 rounded-full border-[1.5px] border-foreground bg-card px-2.5 py-0.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {post.city}
              </span>
            )}
            {distance && (
              <span className="rounded-full border-[1.5px] border-foreground bg-card px-2.5 py-0.5">
                a {formatKm(distance.km)} de você
                {distance.far && (
                  <span className="ml-1.5 rounded border border-foreground bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                    Pode ser longe
                  </span>
                )}
              </span>
            )}
            {(post.negotiable || post.price) && (
              <span className="flex items-center gap-1 rounded-full border-[1.5px] border-foreground bg-card px-2.5 py-0.5">
                <Banknote className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                {post.negotiable ? "Combinar valor" : post.price}
              </span>
            )}
          </div>
          {userId ? (
            <Link
              to="/perfil/$slug"
              params={{ slug: profileParam({ id: post.user_id, slug: post.profiles?.slug }) }}
              search={{ post: post.id }}
              className="flex items-center gap-2"
            >
              <Avatar
                name={post.profiles?.full_name ?? ""}
                path={post.profiles?.avatar_path}
                size={32}
              />
              <span className="min-w-0 text-sm font-semibold leading-tight">
                {post.profiles?.full_name || "Usuário"}
                {top && (
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {top.skill} · {levelLabel(top.level)}
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <Link to="/auth" className="block text-sm font-bold underline">
              Entre para ver quem publicou →
            </Link>
          )}
          <div className="flex items-center justify-between gap-3 border-t-[1.5px] border-dashed border-foreground/40 pt-2.5 text-sm">
            <span className="min-w-0 text-muted-foreground">
              {[vacancy, timeAgo(post.created_at)].filter(Boolean).join(" · ")}
            </span>
            {expandable && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="shrink-0 font-bold underline"
              >
                {kind === "job" ? "Ver vaga" : "Ver"}
              </button>
            )}
          </div>
        </div>
      </article>
      {expandable && (
        <PostDialog
          post={post}
          slots={slots}
          distance={distance}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

/** O popup da vaga: código, texto inteiro e as ações. Usado nos cards de Vagas e da Comunidade. */
export function PostDialog({
  post,
  slots,
  distance,
  open,
  onOpenChange,
}: {
  post: PostWithAuthor;
  slots?: PostSlots | undefined;
  distance?: PostDistance | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const params = post.slug
    ? postParams({ slug: post.slug, professions: post.professions ?? null })
    : null;
  const code = postCode(post.slug);
  const setOpen = onOpenChange;
  if (!params) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-lg [&>button]:text-background">
        <DialogTitle className="sr-only">{post.title}</DialogTitle>
        <DialogDescription className="sr-only">Detalhes da vaga</DialogDescription>
        <div className="space-y-3 rounded-lg bg-background p-3">
          {code && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border-2 border-foreground px-3 py-1 font-mono font-bold"
                aria-label={`Copiar o código ${code}`}
                onClick={() => {
                  navigator.clipboard?.writeText(code).then(
                    () => toast.success("Código copiado"),
                    () => toast.error("Não foi possível copiar"),
                  );
                }}
              >
                #{code} <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <Link
                to="/vagas/$profissao/$codigo"
                params={params}
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 font-bold underline"
              >
                Página da vaga <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
          <PostCard post={post} slots={slots} distance={distance} full />
          <PostActions post={post} onNavigate={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
