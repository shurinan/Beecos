import { Link } from "@tanstack/react-router";
import { Banknote, Camera, Clock, MapPin } from "lucide-react";
import { photoUrl, sortPhotos } from "@/lib/post-photos";
import { useState } from "react";
import { PostDialog, type PostWithAuthor } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/data";
import { formatKm, type PostDistance } from "@/lib/geo";
import { isFilled, vacanciesLabel } from "@/lib/services";
import type { PostSlots } from "@/lib/services-hooks";
import { postParams } from "@/lib/urls";

/** Card de vaga no feed de um grupo: situação, dados rápidos e as duas ações. */
export function CommunityPostCard({
  post,
  slots,
  distance,
  mine,
  onApply,
  busy,
}: {
  post: PostWithAuthor;
  slots: PostSlots | undefined;
  distance: PostDistance | undefined;
  mine: boolean;
  onApply: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const filled = isFilled(slots);
  const label = vacanciesLabel(slots ?? { vacancies: post.vacancies ?? 1, taken: 0 });
  const params = post.slug
    ? postParams({ slug: post.slug, professions: post.professions ?? null })
    : null;
  const author = post.profiles?.slug ? `@${post.profiles.slug}` : post.profiles?.full_name;
  return (
    <article className="block-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            "rounded px-2 py-0.5 text-xs font-bold " +
            (filled
              ? "bg-secondary text-secondary-foreground"
              : "border border-foreground bg-primary text-primary-foreground")
          }
        >
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
      </div>
      <h3 className="text-lg leading-tight">{post.title}</h3>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
        {post.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" aria-hidden="true" /> {post.city}
          </span>
        )}
        {distance && (
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" aria-hidden="true" /> a {formatKm(distance.km)} de você
            {distance.far && (
              <span className="ml-1 rounded border border-foreground bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                Pode ser longe
              </span>
            )}
          </span>
        )}
        {post.price && (
          <span className="flex items-center gap-1">
            <Banknote className="h-4 w-4" aria-hidden="true" /> {post.price}
          </span>
        )}
      </p>
      {(post.post_photos?.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <img
            src={photoUrl(sortPhotos(post.post_photos)[0]!.path)}
            alt=""
            loading="lazy"
            className="h-10 w-10 rounded-md border-2 border-foreground object-cover"
          />
          <Camera className="h-4 w-4" aria-hidden="true" />
          {post.post_photos!.length} {post.post_photos!.length === 1 ? "foto" : "fotos"}
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        {filled ? (
          <Button type="button" variant="outline" disabled>
            Encerrada
          </Button>
        ) : mine && params ? (
          <Button asChild variant="outline">
            <Link to="/vagas/$profissao/$codigo/interessados" params={params}>
              Ver interessados
            </Link>
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={onApply}>
            Tenho interesse
          </Button>
        )}
        {params ? (
          <Button
            type="button"
            variant="outline"
            aria-label={`Saiba mais: ${post.title}`}
            onClick={() => setOpen(true)}
          >
            Saiba mais
          </Button>
        ) : null}
      </div>
      {author && <p className="text-xs text-muted-foreground">{author}</p>}
      <PostDialog
        post={post}
        slots={slots}
        distance={distance}
        open={open}
        onOpenChange={setOpen}
      />
    </article>
  );
}
