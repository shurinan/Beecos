import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Automático (como o aparelho)", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

/** Botão do cabeçalho: escolhe entre seguir o aparelho, claro ou escuro. */
export function ThemeToggle() {
  const { pref, resolved, choose } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Tema do app"
        className="flex h-10 w-10 items-center justify-center rounded-md text-primary-foreground active:bg-foreground/10"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, label, icon: Opt }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => choose(value)}
            className="min-h-10 gap-2"
            aria-checked={pref === value}
          >
            <Opt className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {pref === value && <Check className="h-4 w-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
