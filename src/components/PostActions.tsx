import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/ReportButton";
import type { PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { openConversation } from "@/lib/data";
import { limitMessage } from "@/lib/plans";
import { postParams, profileParam } from "@/lib/urls";

/** Os botões da vaga (tenho interesse, ver interessados, denunciar), na página e no popup. */
export function PostActions({
  post,
  onNavigate,
}: {
  post: PostWithAuthor;
  onNavigate?: () => void;
}) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const mine = userId === post.user_id;

  async function talk() {
    if (!userId) {
      onNavigate?.();
      return navigate({ to: "/auth" });
    }
    try {
      await openConversation(userId, post.user_id, post.id);
      onNavigate?.();
      navigate({
        to: "/conversas/$slug",
        params: { slug: profileParam({ id: post.user_id, slug: post.profiles?.slug }) },
      });
    } catch (e) {
      toast.error(limitMessage(e) ?? "Não foi possível abrir a conversa");
    }
  }

  return (
    <>
      {mine ? (
        post.slug && (
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link
              to="/vagas/$profissao/$codigo/interessados"
              params={postParams({ slug: post.slug, professions: post.professions ?? null })}
              onClick={onNavigate}
            >
              <Users /> Ver interessados
            </Link>
          </Button>
        )
      ) : (
        <Button size="lg" className="w-full" onClick={talk}>
          <MessageCircle /> {post.kind === "job" ? "Tenho interesse" : "Conversar e negociar"}
        </Button>
      )}
      {userId && !mine && (
        <div className="text-center">
          <ReportButton type="post" targetId={post.id} what="esta publicação" />
        </div>
      )}
    </>
  );
}
