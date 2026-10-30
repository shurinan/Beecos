import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Banner da home. As fotos ficam em public/banners/banner-N.jpg (1200x600, proporção 2:1).
 * Para trocar, substitua o arquivo mantendo o nome e a proporção.
 */
const SLIDES = [
  {
    image: "/banners/banner-1.jpg",
    alt: "Pedreiro, pintor e eletricista sorrindo dentro de uma obra",
    kicker: "Quem constrói",
    title: "Gente de confiança para a sua obra",
    text: "Pedreiros, pintores, eletricistas e ajudantes perto de você.",
  },
  {
    image: "/banners/banner-2.jpg",
    alt: "Encanador consertando o sifão de uma pia de cozinha",
    kicker: "Serviço feito",
    title: "Encanador, eletricista, montador: é só chamar",
    text: "Fale direto pelo chat, sem intermediário.",
  },
  {
    image: "/banners/banner-3.jpg",
    alt: "Cuidadora e senhora sorrindo uma para a outra, de braços dados",
    kicker: "Dentro de casa",
    title: "Cuidadores e diaristas que você conhece pelo nome",
    text: "Veja perfil, fotos e avaliações antes de chamar.",
  },
] as const;

export function HomeBanner() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % SLIDES.length), 5000);
    return () => window.clearInterval(t);
  }, [paused]);

  const slide = SLIDES[i]!;
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="block-card relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <img
        key={slide.image}
        src={slide.image}
        alt={slide.alt}
        width={1200}
        height={600}
        className="block aspect-[2/1] w-full object-cover"
      />
      <div className="flex items-center justify-between gap-3 border-t-2 border-foreground bg-card p-3 sm:p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {slide.kicker}
          </p>
          <h2 className="font-display text-base leading-tight sm:text-xl">{slide.title}</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">{slide.text}</p>
        </div>
        <Link
          to="/vagas"
          search={{ q: undefined, tipo: undefined }}
          className="inline-flex shrink-0 items-center rounded-full border-2 border-foreground bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground"
        >
          Ver vagas
        </Link>
      </div>
      <div className="absolute right-3 top-3 flex gap-1.5">
        {SLIDES.map((s, n) => (
          <button
            key={s.image}
            type="button"
            aria-label={`Destaque ${n + 1}`}
            aria-current={n === i}
            onClick={() => setI(n)}
            className={`size-2.5 rounded-full border-2 border-foreground ${n === i ? "bg-foreground" : "bg-white/80"}`}
          />
        ))}
      </div>
    </section>
  );
}
