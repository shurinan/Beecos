import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showInterestError } from "@/lib/interest";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/ReportButton";
import type { PostWithAuthor } from "@/components/PostCard";
import { useAuth } from "@/lib/auth";
import { openConversation } from "@/lib/data";
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
  const qc = useQueryClient();
  // se a pessoa já está na fila de espera desta vaga (só ela enxerga o próprio lugar)
  const { data: waiting } = useQuery({
    queryKey: ["my-waiting", post.id, userId],
    enabled: !!userId && !mine && post.kind === "job",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_waitlist")
        .select("post_id")
        .eq("post_id", post.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

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
      showInterestError(e);
      void qc.invalidateQueries({ queryKey: ["my-waiting", post.id, userId] });
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
        <Button size="lg" className="w-full" onClick={talk} disabled={!!waiting}>
          <MessageCircle />{" "}
          {waiting
            ? "Você está na fila de espera"
            : post.kind === "job"
              ? "Tenho interesse"
              : "Conversar e negociar"}
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
