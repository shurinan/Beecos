import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  DESKTOP_STEPS,
  MOBILE_STEPS,
  markTourSeenLocally,
  placeTip,
  requestNewSkill,
  setTourActive,
  shouldAutoStart,
  type TourStep,
  useTourRequest,
} from "@/lib/tour";

type Rect = { top: number; left: number; width: number; height: number; bottom: number };

function findTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

/** Tutorial de boas-vindas: tela escura, um botão em destaque por vez e um balão explicando. */
export function WelcomeTour({ userId }: { userId: string }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const request = useTourRequest();
  // -1 = boas-vindas; 0..n-1 = passos; null = fechado
  const [step, setStep] = useState<number | null>(null);
  const [steps, setSteps] = useState<TourStep[]>(MOBILE_STEPS);
  const [rect, setRect] = useState<Rect | null>(null);
  const [view, setView] = useState({ width: 0, height: 0 });
  const primary = useRef<HTMLButtonElement>(null);
  const user = session?.user;
  const meta = user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
  const rawName =
    typeof meta?.full_name === "string"
      ? meta.full_name
      : typeof meta?.name === "string"
        ? meta.name
        : "";
  const firstName = rawName.trim().split(/\s+/)[0] ?? "";

  const open = useCallback((skipWelcome: boolean) => {
    setSteps(isDesktop() ? DESKTOP_STEPS : MOBILE_STEPS);
    window.scrollTo({ top: 0 });
    setStep(skipWelcome ? 0 : -1);
  }, []);

  // abre sozinho uma vez, quando nada mais estiver aberto por cima (ex.: aceite dos Termos)
  useEffect(() => {
    if (step !== null || !shouldAutoStart(user)) return;
    const t = window.setInterval(() => {
      const p = window.location.pathname;
      if (p.startsWith("/auth") || /^\/conversas\/[^/]+/.test(p)) return;
      if (document.querySelector("[role='dialog'], [role='alertdialog']")) return;
      window.clearInterval(t);
      open(false);
    }, 1500);
    return () => window.clearInterval(t);
  }, [user, step, open]);

  // "Ver o tutorial de novo"
  useEffect(() => {
    if (request > 0) open(false);
  }, [request, open]);

  const finish = useCallback(() => {
    setStep(null);
    setRect(null);
    markTourSeenLocally(userId);
    if ((user?.user_metadata as { tour_visto?: unknown } | undefined)?.tour_visto !== true) {
      void supabase.auth.updateUser({ data: { tour_visto: true } }).catch(() => undefined);
    }
  }, [userId, user]);

  useEffect(() => {
    setTourActive(step !== null);
  }, [step]);
  useEffect(() => () => setTourActive(false), []);

  const current = step !== null && step >= 0 ? steps[step] : undefined;

  // mede o botão da vez (e de novo ao girar a tela ou rolar)
  useLayoutEffect(() => {
    if (step === null) return;
    function measure() {
      setView({ width: window.innerWidth, height: window.innerHeight });
      if (!current?.target) {
        setRect(null);
        return;
      }
      const el = findTarget(current.target);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const t = window.setTimeout(measure, 250); // menu de baixo voltando ao lugar
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearTimeout(t);
    };
  }, [step, current]);

  // se o botão não existir nesta tela, pula para o próximo
  useEffect(() => {
    if (step === null || step < 0 || !current?.target) return;
    const t = window.setTimeout(() => {
      if (!findTarget(current.target!)) setStep((s) => (s === null ? s : s + 1));
    }, 400);
    return () => window.clearTimeout(t);
  }, [step, current]);

  useEffect(() => {
    if (step === null) return;
    primary.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, finish]);

  // conversa aberta no celular esconde os menus: fecha o tutorial sem marcar nada
  useEffect(() => {
    if (step !== null && /^\/conversas\/[^/]+/.test(path) && !isDesktop()) setStep(null);
  }, [path, step]);

  if (step === null) return null;

  const total = steps.length;
  const last = step === total - 1;
  const next = () => setStep((s) => (s === null ? s : s + 1));

  function addSkill() {
    finish();
    requestNewSkill();
    void navigate({ to: "/perfil", search: { secao: "perfil" } });
  }

  const card =
    "rounded-2xl border-2 border-[#12151B] bg-[#FBF8EE] text-[#12151B] shadow-[4px_4px_0_0_var(--primary)]";
  const btnMain =
    "rounded-xl border-2 border-[#12151B] bg-primary px-4 py-1.5 font-bold text-primary-foreground shadow-[2px_2px_0_0_#12151B] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none";
  const btnLink = "px-1 py-1.5 font-bold underline";

  // boas-vindas e "Pronto!": cartão no meio da tela
  if (step === -1 || !current?.target) {
    const welcome = step === -1;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(10,12,16,0.72)] p-5"
      >
        <div className={`${card} w-full max-w-sm p-5 text-center`}>
          <img src="/logo.svg" alt="" width={56} height={56} className="mx-auto size-14" />
          <h2 id="tour-title" className="mt-2 text-2xl">
            {welcome
              ? firstName
                ? `Bem-vindo ao Beecos, ${firstName}!`
                : "Bem-vindo ao Beecos!"
              : current?.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#33363d]">
            {welcome
              ? "Vou te mostrar onde fica cada coisa. Leva menos de 1 minuto."
              : current?.text}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button type="button" className={btnLink} onClick={finish}>
              {welcome ? "Pular" : "Depois"}
            </button>
            <button
              ref={primary}
              type="button"
              className={btnMain}
              onClick={welcome ? next : addSkill}
            >
              {welcome ? "Mostrar" : "Cadastrar minha habilidade"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tipWidth = Math.min(340, view.width - 24);
  const pos = rect ? placeTip(rect, view, tipWidth) : { top: view.height / 3, left: 12 };
  const pad = 6;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-[60]"
    >
      {/* segura os toques fora do balão */}
      <div className="absolute inset-0" aria-hidden="true" />
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: current.round ? 9999 : 14,
            boxShadow: "0 0 0 4px var(--primary), 0 0 0 9999px rgba(10,12,16,0.72)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(10,12,16,0.72)]" aria-hidden="true" />
      )}
      <div
        className={`${card} absolute p-4`}
        style={{ width: tipWidth, left: pos.left, top: pos.top, bottom: pos.bottom }}
      >
        <div className="mb-2 flex gap-1" aria-hidden="true">
          {steps.map((_, i) => (
            <i
              key={i}
              className={`h-[7px] rounded-full ${i === step ? "w-[18px] bg-[#12151B]" : "w-[7px] bg-[#d6d1c3]"}`}
            />
          ))}
        </div>
        <h2 id="tour-title" className="text-lg">
          {current.title}
        </h2>
        <p className="mb-3 mt-1 text-sm leading-snug text-[#33363d]">{current.text}</p>
        <div className="flex items-center gap-2">
          <span className="mr-auto text-xs font-bold text-[#6b6f78]">
            {step + 1} de {total}
          </span>
          <button type="button" className={btnLink} onClick={finish}>
            Pular
          </button>
          <button ref={primary} type="button" className={btnMain} onClick={next}>
            {last ? "Começar" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
