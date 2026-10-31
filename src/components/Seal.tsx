import { useId } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CHECKS, TIER_TITLE, useBadge, type BadgeInfo, type Tier } from "@/lib/badges";

const B_PATH =
  "M722 519Q722 392 607 359V355Q738 325 738 183Q738 129 711.5 87.5Q685 46 639.0 23.0Q593 0 538 0H74V688H532Q584 688 627.5 666.5Q671 645 696.5 606.0Q722 567 722 519ZM295 420H447Q469 420 483.5 435.5Q498 451 498 474V484Q498 506 483.0 521.5Q468 537 447 537H295ZM295 160H463Q485 160 499.5 175.5Q514 191 514 214V224Q514 247 499.5 262.5Q485 278 463 278H295Z";

// Estrela de 12 pontas do selo dourado.
const STAR = Array.from({ length: 24 }, (_, i) => {
  const a = (Math.PI * i) / 12 - Math.PI / 2;
  const r = i % 2 === 0 ? 47 : 41;
  return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

const S = 0.062;
const B_W = 664 * S;
const B_H = 688 * S;
const B_X = 50 - B_W / 2 - 74 * S;
const B_Y = 50 + B_H / 2 - 2;

const COLORS: Record<Tier, [string, string, string]> = {
  verified: ["#4FA8FF", "#1160D8", "#1160D8"],
  premium: ["#C9D0D8", "#6C7681", "#6C7681"],
  both: ["#FFE27A", "#B07A00", "#E0A800"],
};

/** Selo: azul redondo (Verificado), prata redondo (Premium) ou dourado de 12 pontas (os dois). */
export function Seal({ tier, size = 18 }: { tier: Tier; size?: number }) {
  const id = useId();
  const [from, to, edge] = COLORS[tier];
  const dotX = 50 + B_W / 2 - 1;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      {tier === "both" ? (
        <polygon points={STAR} fill={`url(#${id})`} strokeLinejoin="round" />
      ) : (
        <circle cx="50" cy="50" r="46" fill={`url(#${id})`} />
      )}
      <g
        fill="#fff"
        stroke={tier === "premium" ? "#3b4550" : "none"}
        strokeWidth="30"
        paintOrder="stroke"
        transform={`translate(${B_X.toFixed(2)} ${B_Y.toFixed(2)}) scale(${S} ${-S})`}
      >
        <path d={B_PATH} />
      </g>
      <circle cx={dotX} cy={B_Y - 1} r="6.2" fill="#fff" stroke={edge} strokeWidth="2.6" />
    </svg>
  );
}

/** Contorno da foto: prata (Premium) ou dois anéis dourados (Premium e Verificado). */
export function ringStyle(tier: Tier | null): { boxShadow?: string; margin?: number } {
  if (tier === "premium")
    return { boxShadow: "0 0 0 2px var(--background), 0 0 0 5px #A7B0BA", margin: 5 };
  if (tier === "both")
    return {
      boxShadow:
        "0 0 0 2px var(--background), 0 0 0 4px #E0A800, 0 0 0 6px var(--background), 0 0 0 8px #E0A800",
      margin: 8,
    };
  return {};
}

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-foreground/10 py-2 last:border-0">
      <span
        aria-hidden="true"
        className={
          "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold " +
          (ok ? "bg-[#1160D8] text-white" : "bg-muted text-muted-foreground")
        }
      >
        {ok ? "✓" : "–"}
      </span>
      <span className={ok ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">
        {ok ? "conferido" : "não conferido"}
      </span>
    </li>
  );
}

export function SealDetails({ tier, info }: { tier: Tier; info: BadgeInfo }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        O que o Beecos conferiu nesta conta. Os dados em si não são mostrados a ninguém.
      </p>
      <ul>
        {CHECKS.map((c) => (
          <Row key={c.key} ok={info[c.key]} label={c.label} />
        ))}
      </ul>
      {(tier === "premium" || tier === "both") && (
        <p className="text-xs text-muted-foreground">Premium: assinante do plano Beecos.</p>
      )}
    </div>
  );
}

/** Selo ao lado do nome. Ao tocar, mostra quais verificações a pessoa tem. */
export function UserSeal({
  userId,
  size = 18,
}: {
  userId: string | null | undefined;
  size?: number;
}) {
  const { info, tier } = useBadge(userId);
  if (!tier || !info) return null;
  return (
    <Dialog>
      {/* o selo costuma ficar dentro de um link: o clique abre o painel e não navega */}
      <span
        className="inline-flex shrink-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`${TIER_TITLE[tier]}: ver o que foi conferido`}
            className="inline-flex shrink-0 rounded-full align-middle transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Seal tier={tier} size={size} />
          </button>
        </DialogTrigger>
      </span>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Seal tier={tier} size={28} /> {TIER_TITLE[tier]}
          </DialogTitle>
          <DialogDescription className="sr-only">Verificações desta conta</DialogDescription>
        </DialogHeader>
        <SealDetails tier={tier} info={info} />
      </DialogContent>
    </Dialog>
  );
}
