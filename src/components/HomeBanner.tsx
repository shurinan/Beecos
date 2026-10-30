import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Banner da home com gente. As imagens ficam em public/banners/banner-N.svg (800x300, pessoa à
 * direita e espaço livre à esquerda para o texto). Para usar fotos, troque a imagem de cada slide
 * por um .jpg/.webp da mesma proporção.
 */
const SLIDES = [
  {
    image: "/banners/banner-1.svg",
    kicker: "Quem constrói",
    title: "Gente de confiança para a sua obra",
    text: "Pedreiros, pintores e ajudantes perto de você.",
  },
  {
    image: "/banners/banner-2.svg",
    kicker: "Dentro de casa",
    title: "Diaristas e cuidadores que você conhece pelo nome",
    text: "Veja perfil, fotos e avaliações antes de chamar.",
  },
  {
    image: "/banners/banner-3.svg",
    kicker: "Serviço feito",
    title: "Eletricista, encanador, montador: é só chamar",
    text: "Fale direto pelo chat, sem intermediário.",
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
        alt=""
        width={800}
        height={300}
        className="block h-auto min-h-36 w-full object-cover object-right"
      />
      <div className="absolute inset-y-0 left-0 flex w-[62%] flex-col justify-center gap-1 bg-gradient-to-r from-white/90 via-white/90 to-transparent p-4 text-[oklch(0.16_0.01_260)] sm:w-1/2 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[oklch(0.45_0.1_85)]">
          {slide.kicker}
        </p>
        <h2 className="font-display text-base leading-tight sm:text-2xl">{slide.title}</h2>
        <p className="hidden text-sm text-[oklch(0.42_0.02_260)] sm:block">{slide.text}</p>
        <Link
          to="/vagas"
          search={{ q: undefined, tipo: undefined }}
          className="mt-1 inline-flex w-fit items-center rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground"
        >
          Ver vagas
        </Link>
      </div>
      <div className="absolute bottom-2 right-3 flex gap-1.5">
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
