import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KIND_LABEL, type PostKind } from "@/lib/data";
import { MAX_SKILLS, SKILL_LEVELS, clampLevel, normalizeSkill, type ProfileSkill } from "@/lib/skills";
import { LevelDots } from "@/components/profile-bits";
import { FREE_CHATS_PER_MONTH, FREE_JOBS_PER_MONTH, PREMIUM_PRICE, getPlanUsage, limitMessage } from "@/lib/plans";

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

  const { data, isError, refetch } = useQuery({
    queryKey: ["me", userId],
    queryFn: async () => {
      const [p, priv, skillRows, posts] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("profile_private").select("phone, birth_date").eq("user_id", userId).maybeSingle(),
        supabase.from("profile_skills").select("skill, level").eq("user_id", userId),
        supabase.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      const error = p.error ?? priv.error ?? skillRows.error ?? posts.error;
      if (error) throw error;
      return {
        profile: p.data,
        phone: priv.data?.phone ?? "",
        birthDate: priv.data?.birth_date ?? "",
        skills: (skillRows.data ?? []) as ProfileSkill[],
        posts: posts.data ?? [],
      };
    },
  });
  const { data: usage } = useQuery({ queryKey: ["plan", userId], queryFn: () => getPlanUsage(userId) });

  const [form, setForm] = useState({
    full_name: "",
    city: "",
    headline: "",
    bio: "",
    experience_years: "",
    service_area: "",
    certificate_note: "",
    available: false,
  });
  const [priv, setPriv] = useState({ phone: "", birth_date: "" });
  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [newLevel, setNewLevel] = useState(1);
  const [post, setPost] = useState({ kind: "job" as PostKind, title: "", description: "", city: "", price: "" });

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      setForm({
        full_name: p.full_name,
        city: p.city,
        headline: p.headline,
        bio: p.bio,
        experience_years: p.experience_years == null ? "" : String(p.experience_years),
        service_area: p.service_area,
        certificate_note: p.certificate_note,
        available: p.available,
      });
      setPriv({ phone: data.phone, birth_date: data.birthDate });
      setSkills(data.skills);
      setPost((x) => ({ ...x, city: x.city || p.city }));
    }
  }, [data]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const years = form.experience_years.trim() === "" ? null : Number(form.experience_years);
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 60)) {
      toast.error("Anos de experiência: use um número de 0 a 60");
      return;
    }
    if (priv.birth_date && (priv.birth_date < "1900-01-01" || priv.birth_date > new Date().toISOString().slice(0, 10))) {
      toast.error("Data de nascimento inválida");
      return;
    }
    const removed = (data?.skills ?? []).map((s) => s.skill).filter((name) => !skills.some((s) => s.skill === name));
    const [pub, pv] = await Promise.all([
      supabase.from("profiles").upsert({
        id: userId,
        ...form,
        full_name: form.full_name.trim(),
        headline: form.headline.trim(),
        service_area: form.service_area.trim(),
        certificate_note: form.certificate_note.trim(),
        experience_years: years,
      }),
      supabase.from("profile_private").upsert({
        user_id: userId,
        phone: priv.phone.trim(),
        birth_date: priv.birth_date || null,
        updated_at: new Date().toISOString(),
      }),
    ]);
    let skillError: unknown = null;
    if (!pub.error && !pv.error) {
      if (removed.length > 0) {
        const del = await supabase.from("profile_skills").delete().eq("user_id", userId).in("skill", removed);
        skillError = del.error;
      }
      if (!skillError && skills.length > 0) {
        const up = await supabase
          .from("profile_skills")
          .upsert(skills.map((s) => ({ user_id: userId, skill: s.skill, level: s.level })), { onConflict: "user_id,skill" });
        skillError = up.error;
      }
    }
    if (pub.error || pv.error || skillError) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Perfil salvo");
    qc.invalidateQueries();
  }

  function addSkill() {
    const name = skillInput.trim().slice(0, 40);
    if (!name) return;
    if (skills.some((s) => normalizeSkill(s.skill) === normalizeSkill(name))) {
      toast.error("Você já adicionou essa habilidade");
    } else if (skills.length >= MAX_SKILLS) {
      toast.error(`Máximo de ${MAX_SKILLS} habilidades`);
    } else {
      setSkills([...skills, { skill: name, level: newLevel }]);
    }
    setSkillInput("");
  }

  function setSkillLevel(name: string, level: number) {
    setSkills(skills.map((s) => (s.skill === name ? { ...s, level: clampLevel(level) } : s)));
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("posts").insert({ ...post, user_id: userId });
    if (error) {
      toast.error(limitMessage(error) ?? "Erro ao publicar");
      return;
    }
    toast.success("Publicado!");
    setPost({ ...post, title: "", description: "", price: "" });
    qc.invalidateQueries();
  }

  async function deletePost(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir a publicação");
      return;
    }
    qc.invalidateQueries();
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isError) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível carregar seu perfil.</p>
        <Button onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="block-card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Seu plano</h2>
          <span className={"rounded px-2 py-1 text-xs font-bold uppercase " + (usage?.premium ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {usage?.premium ? "Premium" : "Grátis"}
          </span>
        </div>
        {usage?.premium ? (
          <p>Vagas e conversas ilimitadas.</p>
        ) : (
          <>
            <p className="text-sm">
              Vagas este mês: <b>{usage?.jobs ?? 0}/{FREE_JOBS_PER_MONTH}</b> · Novas conversas: <b>{usage?.chats ?? 0}/{FREE_CHATS_PER_MONTH}</b>
            </p>
            <div className="rounded-lg border-2 border-foreground bg-accent p-3">
              <p className="font-display">Premium — {PREMIUM_PRICE}</p>
              <p className="text-sm">Publique vagas sem limite e converse com quem quiser.</p>
              <Button className="mt-2 w-full" onClick={() => toast("Pagamento em breve!")}>Quero ser Premium</Button>
            </div>
          </>
        )}
      </section>
      <form onSubmit={saveProfile} className="block-card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Meu perfil</h1>
          <Link to="/perfil/$id" params={{ id: userId }} search={{ post: undefined }} className="text-sm font-semibold underline">
            Ver público
          </Link>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-1 flex items-center gap-1 text-sm font-bold uppercase">
            <Lock className="h-4 w-4" /> Dados pessoais <span className="font-normal normal-case text-muted-foreground">(privados, só você vê)</span>
          </legend>
          <div>
            <Label>Telefone</Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              value={priv.phone}
              onChange={(e) => setPriv({ ...priv, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input type="date" value={priv.birth_date} onChange={(e) => setPriv({ ...priv, birth_date: e.target.value })} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-bold uppercase">
            Perfil profissional <span className="font-normal normal-case text-muted-foreground">(público)</span>
          </legend>
          <div>
            <Label>Nome</Label>
            <Input required maxLength={80} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Profissão ou título</Label>
            <Input
              maxLength={80}
              placeholder="Ex: Pedreiro e pintor"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Cidade</Label>
              <Input placeholder="Ex: Campinas - SP" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Anos de experiência</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                placeholder="Ex: 8"
                value={form.experience_years}
                onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Onde você atende</Label>
            <Input
              maxLength={120}
              placeholder="Ex: Campinas e região, Valinhos"
              value={form.service_area}
              onChange={(e) => setForm({ ...form, service_area: e.target.value })}
            />
          </div>
          <div>
            <Label>Cursos e certificados</Label>
            <Input
              maxLength={200}
              placeholder="Ex: NR-10, curso SENAI de eletricista"
              value={form.certificate_note}
              onChange={(e) => setForm({ ...form, certificate_note: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">Aparece no seu perfil como informado por você.</p>
          </div>
          <div>
            <Label>Sobre você</Label>
            <Textarea placeholder="Experiência, horários, região que atende…" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-bold uppercase">Habilidades e nível</legend>
          <div className="flex gap-2">
            <Input
              maxLength={40}
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
            <select
              aria-label="Nível da nova habilidade"
              className="h-10 rounded-md border-2 border-foreground bg-background px-2 text-sm font-semibold"
              value={newLevel}
              onChange={(e) => setNewLevel(Number(e.target.value))}
            >
              {SKILL_LEVELS.map((l) => (
                <option key={l.level} value={l.level}>
                  {l.level} · {l.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="dark" onClick={addSkill}>Adicionar</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Nível 1 é "sei fazer"; nível 5 é "profissional certificado". Seja honesto: quem contrata vê o nível e pode avaliar o seu trabalho.
          </p>
          <ul className="space-y-2">
            {skills.map((s) => (
              <li key={s.skill} className="flex items-center gap-2 rounded-lg border-2 border-foreground p-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.skill}</span>
                  <LevelDots level={s.level} />
                </span>
                <select
                  aria-label={`Nível de ${s.skill}`}
                  className="h-10 rounded-md border-2 border-foreground bg-background px-2 text-sm font-semibold"
                  value={s.level}
                  onChange={(e) => setSkillLevel(s.skill, Number(e.target.value))}
                >
                  {SKILL_LEVELS.map((l) => (
                    <option key={l.level} value={l.level}>
                      {l.level} · {l.label}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label={`Remover ${s.skill}`} onClick={() => setSkills(skills.filter((x) => x.skill !== s.skill))}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

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
