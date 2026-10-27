import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { TERMS_VERSION } from "@/lib/legal";
import {
  USERNAME_HELP,
  USERNAME_MAX,
  isValidUsernameFormat,
  normalizeUsername,
} from "@/lib/username";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Beecos" },
      { name: "description", content: "Entre ou crie sua conta no Beecos." },
      { property: "og:title", content: "Entrar — Beecos" },
      { property: "og:description", content: "Entre ou crie sua conta no Beecos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "free" | "taken">(
    "idle",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(false);
  const { userId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) navigate({ to: "/perfil", replace: true });
  }, [userId, navigate]);

  // Confere, ao digitar, se o nome de usuário está livre (a cada pausa de 400 ms).
  useEffect(() => {
    if (mode !== "up" || !isValidUsernameFormat(username)) {
      setUsernameState("idle");
      return;
    }
    setUsernameState("checking");
    let alive = true;
    const t = setTimeout(() => {
      supabase.rpc("username_available", { _name: username }).then(({ data, error }) => {
        if (alive) setUsernameState(error ? "idle" : data ? "free" : "taken");
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [mode, username]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "up") {
      if (!isValidUsernameFormat(username)) {
        toast.error(`Nome de usuário inválido. ${USERNAME_HELP}`);
        return;
      }
      if (!agree) {
        toast.error("Para criar a conta, aceite os Termos e a Política de privacidade.");
        return;
      }
      if (usernameState === "taken") {
        toast.error("Esse nome de usuário já está em uso. Escolha outro.");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name, username, terms_version: TERMS_VERSION } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Conta criada! Confira seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) toast.error("Não foi possível entrar com Google");
  }

  return (
    <div className="block-card mx-auto mt-4 max-w-md p-6">
      <h1 className="text-2xl">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {mode === "in" ? "Bem-vindo de volta." : "Leva menos de um minuto."}
      </p>
      <Button variant="outline" size="lg" className="w-full" onClick={google}>
        Continuar com Google
      </Button>
      <div className="my-4 text-center text-xs uppercase text-muted-foreground">ou</div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "up" && (
          <>
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="username">Nome de usuário</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <Input
                  id="username"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={USERNAME_MAX}
                  className="pl-7"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  aria-describedby="username-help"
                />
              </div>
              <p
                id="username-help"
                aria-live="polite"
                className={`mt-1 text-xs ${usernameState === "taken" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {usernameState === "checking" && "Conferindo…"}
                {usernameState === "free" && "Disponível."}
                {usernameState === "taken" && "Já está em uso."}
                {usernameState === "idle" && USERNAME_HELP}
                {" Ele vira o endereço do seu perfil."}
              </p>
            </div>
          </>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw">Senha</Label>
          <Input
            id="pw"
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {mode === "up" && (
          <div className="flex items-start gap-2">
            <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
            <Label htmlFor="agree" className="text-sm font-normal leading-snug">
              Li e aceito os{" "}
              <Link to="/termos" target="_blank" className="font-bold underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" target="_blank" className="font-bold underline">
                Política de privacidade
              </Link>
              .
            </Label>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      <button
        className="mt-4 w-full text-sm font-semibold underline"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "Não tem conta? Criar agora" : "Já tenho conta"}
      </button>
    </div>
  );
}
