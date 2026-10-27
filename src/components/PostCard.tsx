import { Link } from "@tanstack/react-router";
import { MapPin, Banknote } from "lucide-react";
import { KIND_LABEL, timeAgo, initials, type PostKind } from "@/lib/data";
import { levelLabel, topSkill, type ProfileSkill } from "@/lib/skills";

export type PostWithAuthor = {
  id: string;
  kind: string;
  title: string;
  description: string;
  city: string;
  price: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string; profile_skills: ProfileSkill[] } | null;
};

export function PostCard({ post }: { post: PostWithAuthor }) {
  const kind = post.kind as PostKind;
  const top = topSkill(post.profiles?.profile_skills);
  return (
    <article className="block-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span
          className={
            kind === "job"
              ? "rounded bg-primary px-2 py-0.5 text-xs font-bold uppercase text-primary-foreground border border-foreground"
              : "rounded bg-secondary px-2 py-0.5 text-xs font-bold uppercase text-secondary-foreground"
          }
        >
          {KIND_LABEL[kind]}
        </span>
        <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
      </div>
      <h3 className="text-lg leading-tight">{post.title}</h3>
      {post.description && (
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{post.description}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
        {post.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {post.city}
          </span>
        )}
        {post.price && (
          <span className="flex items-center gap-1">
            <Banknote className="h-4 w-4" /> {post.price}
          </span>
        )}
      </div>
      <Link
        to="/perfil/$id"
        params={{ id: post.user_id }}
        search={{ post: post.id }}
        className="mt-3 flex items-center gap-2 border-t border-dashed border-foreground/30 pt-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
          {initials(post.profiles?.full_name ?? "")}
        </span>
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
    </article>
  );
}
