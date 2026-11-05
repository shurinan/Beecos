import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { Avatar } from "@/components/profile-bits";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getInviter, saveInvite } from "@/lib/referrals";
import { SITE_URL } from "@/lib/urls";

/** Link de convite do Indique e ganhe: beecos.com.br/c/usuario. */
export const Route = createFileRoute("/c/$usuario")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    try {
      return { inviter: await getInviter(params.usuario) };
    } catch {
      return { inviter: null };
    }
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.inviter?.first_name;
    const title = name ? `${name} te convidou para o Beecos` : "Convite para o Beecos";
    const description =
      "Vagas de serviço perto de você chegam no celular. Combine tudo direto no chat.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `${SITE_URL}/c/${params.usuario}` },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: Convite,
});

function Convite() {
  const { inviter } = Route.useLoaderData();
  const { usuario } = Route.useParams();
  const { userId } = useAuth();

  useEffect(() => {
    if (inviter) saveInvite(inviter.username || usuario);
  }, [inviter, usuario]);

  if (!inviter) {
    return (
      <div className="block-card mx-auto mt-4 max-w-md space-y-3 p-6 text-center">
        <h1 className="text-2xl">Convite não encontrado</h1>
        <p className="text-sm text-muted-foreground">
          Confira o link com quem te convidou. Você também pode criar a sua conta direto.
        </p>
        <Button asChild>
          <Link to="/auth">Criar minha conta</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-2 max-w-md space-y-4">
      <div className="flex items-center gap-3 rounded-xl border-2 border-foreground bg-foreground p-4 text-background">
        <Avatar name={inviter.full_name} path={inviter.avatar_path} size={48} />
        <div>
          <p className="font-bold">{inviter.full_name} te convidou</p>
          <p className="text-sm opacity-85">
            Crie sua conta e ajude {inviter.first_name} a ganhar o Premium.
          </p>
        </div>
      </div>
      <section className="block-card space-y-3 p-5">
        <h1 className="text-2xl leading-tight">Trabalha com serviço? As vagas vêm até você.</h1>
        <ul className="space-y-2 text-sm">
          {[
            "Vagas da sua profissão perto de você chegam no celular.",
            "Converse direto com quem contrata e combine valor e horário.",
            "Anuncie que está disponível e apareça na vitrine.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        {userId ? (
          <>
            <p className="rounded-lg border-2 border-foreground/30 p-3 text-sm">
              Você já tem conta no Beecos. O convite vale para quem ainda não tem.
            </p>
            <Button asChild className="w-full">
              <Link to="/">Ir para o início</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="lg" className="w-full">
              <Link to="/auth">Criar minha conta</Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Para a indicação contar: confirme o e-mail, cadastre 1 habilidade e verifique a sua
              identidade em Meu perfil.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
