import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { MapPin, Banknote, Crown } from "lucide-react";
import { Avatar } from "@/components/profile-bits";
import { KIND_LABEL, timeAgo, type PostKind } from "@/lib/data";
import { levelLabel, topSkill, type SkillBase } from "@/lib/skills";
import { catalogLabel } from "@/lib/catalog";
import { formatKm, type PostDistance } from "@/lib/geo";
import { isFilled, vacanciesLabel } from "@/lib/services";
import type { PostSlots } from "@/lib/services-hooks";

export type PostWithAuthor = {
  id: string;
  kind: string;
  title: string;
  description: string;
  city: string;
  price: string;
  created_at: string;
  user_id: string;
  vacancies?: number;
  premium?: boolean;
  professions?: { name: string } | null;
  services?: { name: string } | null;
  profiles: { full_name: string; avatar_path?: string | null; profile_skills: SkillBase[] } | null;
};

export function PostCard({
  post,
  slots,
  distance,
}: {
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
  return (
    <article className={"block-card p-4 " + (post.premium ? "bg-accent" : "")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span
            className={
              kind === "job"
                ? "rounded bg-primary px-2 py-0.5 text-xs font-bold uppercase text-primary-foreground border border-foreground"
                : "rounded bg-secondary px-2 py-0.5 text-xs font-bold uppercase text-secondary-foreground"
            }
          >
            {KIND_LABEL[kind]}
          </span>
          {post.premium && (
            <span className="flex items-center gap-1 rounded border border-foreground bg-foreground px-2 py-0.5 text-xs font-bold uppercase text-background">
              <Crown className="h-3 w-3" aria-hidden="true" /> Premium
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {vacancy && (
            <span
              className={
                "rounded px-1.5 py-0.5 font-bold " +
                (filled
                  ? "bg-muted text-foreground line-through decoration-2"
                  : "bg-secondary text-secondary-foreground")
              }
            >
              {vacancy}
            </span>
          )}
          {timeAgo(post.created_at)}
        </span>
      </div>
      <h3 className="text-lg leading-tight">{post.title}</h3>
      {post.professions && (
        <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
          {catalogLabel(post.professions, post.services)}
        </p>
      )}
      {post.description && (
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{post.description}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
        {post.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {post.city}
          </span>
        )}
        {distance && (
          <span className="flex items-center gap-1">
            a {formatKm(distance.km)} de você
            {distance.far && (
              <span className="ml-1 rounded border border-foreground bg-secondary px-1.5 py-0.5 text-xs font-bold text-secondary-foreground">
                Pode ser longe
              </span>
            )}
          </span>
        )}
        {post.price && (
          <span className="flex items-center gap-1">
            <Banknote className="h-4 w-4" /> {post.price}
          </span>
        )}
      </div>
      {userId ? (
        <Link
          to="/perfil/$id"
          params={{ id: post.user_id }}
          search={{ post: post.id }}
          className="mt-3 flex items-center gap-2 border-t border-dashed border-foreground/30 pt-3"
        >
          <Avatar
            name={post.profiles?.full_name ?? ""}
            path={post.profiles?.avatar_path}
            size={36}
          />
          <span className="min-w-0 text-sm font-semibold">
            {post.profiles?.full_name || "Usuário"}
            {top && (
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {top.skill} · {levelLabel(top.level)}
              </span>
            )}
          </span>
          <span className="ml-auto text-sm font-bold underline">Ver e conversar →</span>
        </Link>
      ) : (
        <Link
          to="/auth"
          className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-foreground/30 pt-3 text-sm font-bold underline"
        >
          Entre para ver quem publicou e conversar →
        </Link>
      )}
    </article>
  );
}
