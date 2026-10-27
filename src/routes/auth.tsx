import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { userId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) navigate({ to: "/perfil", replace: true });
  }, [userId, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
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
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
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
