import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bike,
  Briefcase,
  Droplets,
  HardHat,
  HeartPulse,
  MessageCircle,
  Plus,
  Scissors,
  Sparkles,
  Star,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { TOPICS } from "@/lib/discovery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Beecos — Vagas e trabalhadores na sua cidade" },
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
  component: Index,
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
  {
    icon: Briefcase,
    title: "Vagas",
    text: "Gente precisando de ajuda hoje, perto de você.",
    link: { to: "/vagas", search: { q: undefined, tipo: undefined } },
  },
  {
    icon: Users,
    title: "Trabalhadores",
    text: "Profissionais disponíveis, com habilidades e nível.",
    link: { to: "/vagas", search: { q: undefined, tipo: "trabalhadores" } },
  },
  {
    icon: MessageCircle,
    title: "Chat direto",
    text: "Combine preço e horário sem intermediário.",
    link: { to: "/conversas" },
  },
  {
    icon: Star,
    title: "Avaliações",
    text: "Só quem concluiu um serviço pode avaliar.",
    link: { to: "/ajuda", hash: "avaliacoes" },
  },
] as const;

const STEPS = [
  { title: "Publique ou procure", text: "Conte o que precisa ou o que você sabe fazer." },
  { title: "Converse e escolha", text: "Quem contrata escolhe o prestador, e ele aceita." },
  { title: "Conclua e avalie", text: "Terminou o serviço, os dois se avaliam." },
] as const;

function Index() {
  const { userId } = useAuth();
  return (
    <div className="space-y-8">
      <section className="block-card overflow-hidden">
        <div className="p-5">
          <p className="mb-2 inline-block rounded border-2 border-foreground bg-accent px-2 py-0.5 text-xs font-bold uppercase">
            Oportunidades perto de você
          </p>
          <h1 className="text-4xl leading-[0.95]">
            Precisou? Achou.
            <br />
            <span className="bg-primary px-1">Combinou? Fechou.</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Encontre serviços, profissionais e oportunidades perto de você. Combine tudo direto pelo
            chat.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button asChild size="lg" className="w-full">
              <Link to="/publicar" search={{ tipo: "contratar" }}>
                <Plus /> Quero contratar
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link to="/publicar" search={{ tipo: "trabalhar" }}>
                Quero trabalhar
              </Link>
            </Button>
          </div>
        </div>
        <div className="hazard-stripe h-2.5" />
      </section>

      {
        <section className="space-y-3">
          <h2 className="text-xl">O que você encontra aqui</h2>
          <div className="grid grid-cols-2 gap-3">
            {FIND.map(({ icon: Icon, title, text, link }) => (
              <Link
                key={title}
                {...link}
                className="block-card group block space-y-1 p-3 transition-[background-color,box-shadow,transform] duration-150 hover:bg-foreground/[0.04] active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-foreground bg-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="flex items-center gap-1 text-base">
                  {title}
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </h3>
                <p className="text-sm leading-snug text-muted-foreground">{text}</p>
              </Link>
            ))}
          </div>
        </section>
      }

      {!userId && (
        <section className="space-y-3">
          <h2 className="text-xl">Como funciona</h2>
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground font-display text-background">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold leading-tight">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl">Procure por assunto</h2>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const Icon = TOPIC_ICON[t.icon];
            return (
              <Link
                key={t.label}
                to="/vagas"
                search={{ q: t.q, tipo: undefined }}
                className="flex min-h-10 items-center gap-1.5 rounded-full border-2 border-foreground bg-card px-3 text-sm font-bold transition-[background-color,box-shadow,transform] duration-150 hover:bg-foreground/[0.07] hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] active:scale-95"
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </Link>
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
    </div>
  );
}
