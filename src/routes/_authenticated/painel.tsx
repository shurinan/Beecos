import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KIND_LABEL, type PostKind } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Beecos" },
      { name: "description", content: "Edite seu perfil, habilidades e publicações." },
      { property: "og:title", content: "Meu perfil — Beecos" },
      { property: "og:description", content: "Edite seu perfil, habilidades e publicações." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["me", userId],
    queryFn: async () => {
      const [p, posts] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      return { profile: p.data, posts: posts.data ?? [] };
    },
  });

  const [form, setForm] = useState({ full_name: "", city: "", bio: "", phone: "", available: false });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [post, setPost] = useState({ kind: "job" as PostKind, title: "", description: "", city: "", price: "" });

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      setForm({ full_name: p.full_name, city: p.city, bio: p.bio, phone: p.phone, available: p.available });
      setSkills(p.skills);
      setPost((x) => ({ ...x, city: x.city || p.city }));
    }
  }, [data?.profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").upsert({ id: userId, ...form, skills });
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Perfil salvo");
    qc.invalidateQueries();
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setSkillInput("");
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("posts").insert({ ...post, user_id: userId });
    if (error) {
      toast.error("Erro ao publicar");
      return;
    }
    toast.success("Publicado!");
    setPost({ ...post, title: "", description: "", price: "" });
    qc.invalidateQueries();
  }

  async function deletePost(id: string) {
    await supabase.from("posts").delete().eq("id", id);
    qc.invalidateQueries();
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="block-card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Meu perfil</h1>
          <Link to="/perfil/$id" params={{ id: userId }} search={{ post: undefined }} className="text-sm font-semibold underline">
            Ver público
          </Link>
        </div>
        <div>
          <Label>Nome</Label>
          <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input placeholder="Ex: Campinas - SP" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <Label>Sobre você</Label>
          <Textarea placeholder="Experiência, horários, região que atende…" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div>
          <Label>Habilidades</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Pedreiro, Pintura, Mudança"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button type="button" variant="dark" onClick={addSkill}>Adicionar</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {skills.map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-full border-2 border-foreground bg-accent px-3 py-0.5 text-sm font-semibold">
                {s}
                <button type="button" aria-label={`Remover ${s}`} onClick={() => setSkills(skills.filter((x) => x !== s))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between rounded-lg border-2 border-foreground p-3">
          <span className="font-semibold">Estou disponível para trabalhar</span>
          <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
        </label>
        <Button type="submit" className="w-full" size="lg">Salvar perfil</Button>
      </form>

      <form onSubmit={createPost} className="block-card space-y-3 p-5">
        <h2 className="text-xl">Nova publicação</h2>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border-2 border-foreground">
          {(["job", "available"] as PostKind[]).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setPost({ ...post, kind: k })}
              className={"py-2 text-sm font-bold " + (post.kind === k ? "bg-foreground text-background" : "bg-background")}
            >
              {k === "job" ? "Oferecer vaga" : "Estou disponível"}
            </button>
          ))}
        </div>
        <Input
          required
          placeholder={post.kind === "job" ? "Ex: Preciso de ajudante para mudança" : "Ex: Pedreiro disponível esta semana"}
          value={post.title}
          onChange={(e) => setPost({ ...post, title: e.target.value })}
        />
        <Textarea placeholder="Detalhes: o que precisa, quando, onde…" value={post.description} onChange={(e) => setPost({ ...post, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Cidade" value={post.city} onChange={(e) => setPost({ ...post, city: e.target.value })} />
          <Input placeholder="Valor (ex: R$150/dia)" value={post.price} onChange={(e) => setPost({ ...post, price: e.target.value })} />
        </div>
        <Button type="submit" className="w-full" size="lg">Publicar</Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-xl">Minhas publicações</h2>
        {data?.posts.length === 0 && <p className="text-muted-foreground">Você ainda não publicou nada.</p>}
        {data?.posts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border-2 border-foreground p-3">
            <span className="text-xs font-bold uppercase">{KIND_LABEL[p.kind as PostKind]}</span>
            <span className="flex-1 truncate font-semibold">{p.title}</span>
            <button aria-label="Excluir" onClick={() => deletePost(p.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
    </div>
  );
}
