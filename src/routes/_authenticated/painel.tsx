import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, MapPin, Pencil, Smartphone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABEL, type PostKind } from "@/lib/data";
import {
  MAX_SKILLS,
  SKILL_COLUMNS,
  sortSkills,
  type ProfileSkill,
  type SkillInput,
} from "@/lib/skills";
import { useAuth } from "@/lib/auth";
import { Avatar, SelfDeclared, SkillCard } from "@/components/profile-bits";
import { SkillDialog } from "@/components/SkillDialog";
import { EditProfileDialog, type ProfileFields } from "@/components/ProfileDialogs";
import { BLOCKED_TEXT_MESSAGE, isBlockedTextError } from "@/lib/chat";
import { addressLines, type ContactAddress } from "@/lib/contact";
import {
  FREE_CHATS_PER_MONTH,
  FREE_JOBS_PER_MONTH,
  PREMIUM_PRICE,
  getPlanUsage,
  limitMessage,
} from "@/lib/plans";

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
      const [p, phoneRows, addressRows, skillRows, posts] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("contact_phones")
          .select("number, kind")
          .eq("user_id", userId)
          .order("created_at"),
        supabase
          .from("contact_addresses")
          .select("kind, recipient, care_of, street, neighborhood, city, state, postal_code")
          .eq("user_id", userId)
          .eq("kind", "physical")
          .maybeSingle(),
        supabase.from("profile_skills").select(SKILL_COLUMNS).eq("user_id", userId),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      const error =
        p.error ?? phoneRows.error ?? addressRows.error ?? skillRows.error ?? posts.error;
      if (error) throw error;
      return {
        profile: p.data,
        phone:
          (phoneRows.data ?? []).find((x) => x.kind === "mobile")?.number ??
          phoneRows.data?.[0]?.number ??
          "",
        address: addressRows.data as Omit<ContactAddress, "id"> | null,
        skills: sortSkills((skillRows.data ?? []) as ProfileSkill[]),
        posts: posts.data ?? [],
      };
    },
  });
  const { data: usage } = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => getPlanUsage(userId),
  });

  const { session } = useAuth();
  const email = session?.user.email ?? "";
  const [dialog, setDialog] = useState<"profile" | null>(null);
  const [skillDialog, setSkillDialog] = useState<{ open: boolean; initial: ProfileSkill | null }>({
    open: false,
    initial: null,
  });
  const [post, setPost] = useState({
    kind: "job" as PostKind,
    title: "",
    description: "",
    city: "",
    price: "",
  });

  useEffect(() => {
    if (data?.profile) setPost((x) => ({ ...x, city: x.city || data.profile!.city }));
  }, [data?.profile]);

  const profileFields: ProfileFields = {
    full_name: data?.profile?.full_name ?? "",
    headline: data?.profile?.headline ?? "",
    city: data?.profile?.city ?? "",
    service_area: data?.profile?.service_area ?? "",
    certificate_note: data?.profile?.certificate_note ?? "",
    bio: data?.profile?.bio ?? "",
    available: data?.profile?.available ?? false,
  };

  async function saveProfile(values: ProfileFields): Promise<boolean> {
    const { error } = await supabase.from("profiles").upsert({ id: userId, ...values });
    if (error) {
      toast.error(
        isBlockedTextError(error) ? BLOCKED_TEXT_MESSAGE : "Não foi possível salvar o perfil",
      );
      return false;
    }
    toast.success("Perfil salvo");
    qc.invalidateQueries();
    return true;
  }

  async function saveSkill(skill: SkillInput): Promise<boolean> {
    const isNew = !(data?.skills ?? []).some((x) => x.skill === skill.skill);
    if (isNew && (data?.skills.length ?? 0) >= MAX_SKILLS) {
      toast.error(`Máximo de ${MAX_SKILLS} habilidades`);
      return false;
    }
    const { error } = await supabase
      .from("profile_skills")
      .upsert({ user_id: userId, ...skill }, { onConflict: "user_id,skill" });
    if (error) {
      toast.error(
        isBlockedTextError(error) ? BLOCKED_TEXT_MESSAGE : "Não foi possível salvar a habilidade",
      );
      return false;
    }
    toast.success(isNew ? "Habilidade adicionada" : "Habilidade atualizada");
    qc.invalidateQueries();
    return true;
  }

  async function deleteSkill(name: string) {
    const { error } = await supabase
      .from("profile_skills")
      .delete()
      .eq("user_id", userId)
      .eq("skill", name);
    if (error) {
      toast.error("Não foi possível remover a habilidade");
      return;
    }
    qc.invalidateQueries();
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("posts").insert({ ...post, user_id: userId });
    if (error) {
      toast.error(
        isBlockedTextError(error)
          ? BLOCKED_TEXT_MESSAGE
          : (limitMessage(error) ?? "Erro ao publicar"),
      );
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Visão geral</h1>
        <Link
          to="/perfil/$id"
          params={{ id: userId }}
          search={{ post: undefined }}
          className="text-sm font-semibold underline"
        >
          Ver como os outros veem
        </Link>
      </div>

      <section className="block-card p-5">
        <div className="flex items-start gap-4">
          <Avatar name={profileFields.full_name} path={data?.profile?.avatar_path} size={80} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl leading-tight">
              {profileFields.full_name || "Sem nome"}
            </h2>
            {profileFields.headline && <p className="font-semibold">{profileFields.headline}</p>}
            {profileFields.city && (
              <p className="text-sm text-muted-foreground">{profileFields.city}</p>
            )}
            {profileFields.available && (
              <p className="mt-2 inline-block rounded bg-secondary px-2 py-1 text-xs font-bold uppercase text-secondary-foreground">
                ● Disponível para trabalhar
              </p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog("profile")}>
            <Pencil /> Editar
          </Button>
        </div>
      </section>

      <section className="block-card space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Informações de contato</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/contato">
              <Pencil /> Editar
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Privadas: só você vê.</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" /> E-mail
            </dt>
            <dd className="break-all font-semibold">{email || "—"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" /> Telefone
            </dt>
            <dd className="font-semibold">{data?.phone || "Não informado"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> Endereço
            </dt>
            <dd className="font-semibold">
              {data?.address ? addressLines(data.address).slice(1).join(", ") : "Não informado"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="block-card space-y-3 p-5">
        <h2 className="text-xl">Habilidades e experiência</h2>
        <SelfDeclared />
        {data?.skills.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Você ainda não adicionou habilidades. Elas aparecem no seu perfil e ajudam quem contrata
            a te encontrar.
          </p>
        )}
        <div className="space-y-2">
          {data?.skills.map((sk) => (
            <SkillCard
              key={sk.skill}
              skill={sk}
              actions={
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${sk.skill}`}
                    className="p-1"
                    onClick={() => setSkillDialog({ open: true, initial: sk })}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${sk.skill}`}
                    className="p-1"
                    onClick={() => deleteSkill(sk.skill)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="text-sm font-bold underline"
          onClick={() => setSkillDialog({ open: true, initial: null })}
        >
          {data?.skills.length ? "Adicionar outra habilidade" : "Adicionar habilidade"}
        </button>
      </section>

      <EditProfileDialog
        open={dialog === "profile"}
        onOpenChange={(open) => setDialog(open ? "profile" : null)}
        initial={profileFields}
        onSave={saveProfile}
      />
      <SkillDialog
        open={skillDialog.open}
        onOpenChange={(open) => setSkillDialog((d) => ({ ...d, open }))}
        initial={skillDialog.initial}
        existing={(data?.skills ?? []).map((x) => x.skill)}
        onSave={saveSkill}
      />

      <section className="block-card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Seu plano</h2>
          <span
            className={
              "rounded px-2 py-1 text-xs font-bold uppercase " +
              (usage?.premium ? "bg-primary text-primary-foreground" : "bg-muted")
            }
          >
            {usage?.premium ? "Premium" : "Grátis"}
          </span>
        </div>
        {usage?.premium ? (
          <p>Vagas e conversas ilimitadas.</p>
        ) : (
          <>
            <p className="text-sm">
              Vagas este mês:{" "}
              <b>
                {usage?.jobs ?? 0}/{FREE_JOBS_PER_MONTH}
              </b>{" "}
              · Novas conversas:{" "}
              <b>
                {usage?.chats ?? 0}/{FREE_CHATS_PER_MONTH}
              </b>
            </p>
            <div className="rounded-lg border-2 border-foreground bg-accent p-3">
              <p className="font-display">Premium — {PREMIUM_PRICE}</p>
              <p className="text-sm">Publique vagas sem limite e converse com quem quiser.</p>
              <Button className="mt-2 w-full" onClick={() => toast("Pagamento em breve!")}>
                Quero ser Premium
              </Button>
            </div>
          </>
        )}
      </section>

      <form onSubmit={createPost} className="block-card space-y-3 p-5">
        <h2 className="text-xl">Nova publicação</h2>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border-2 border-foreground">
          {(["job", "available"] as PostKind[]).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setPost({ ...post, kind: k })}
              className={
                "py-2 text-sm font-bold " +
                (post.kind === k ? "bg-foreground text-background" : "bg-background")
              }
            >
              {k === "job" ? "Oferecer vaga" : "Estou disponível"}
            </button>
          ))}
        </div>
        <Input
          required
          placeholder={
            post.kind === "job"
              ? "Ex: Preciso de ajudante para mudança"
              : "Ex: Pedreiro disponível esta semana"
          }
          value={post.title}
          onChange={(e) => setPost({ ...post, title: e.target.value })}
        />
        <Textarea
          placeholder="Detalhes: o que precisa, quando, onde…"
          value={post.description}
          onChange={(e) => setPost({ ...post, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Cidade"
            value={post.city}
            onChange={(e) => setPost({ ...post, city: e.target.value })}
          />
          <Input
            placeholder="Valor (ex: R$150/dia)"
            value={post.price}
            onChange={(e) => setPost({ ...post, price: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Publicar
        </Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-xl">Minhas publicações</h2>
        {data?.posts.length === 0 && (
          <p className="text-muted-foreground">Você ainda não publicou nada.</p>
        )}
        {data?.posts.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-lg border-2 border-foreground p-3"
          >
            <span className="text-xs font-bold uppercase">{KIND_LABEL[p.kind as PostKind]}</span>
            <span className="flex-1 truncate font-semibold">{p.title}</span>
            <button aria-label="Excluir" onClick={() => deletePost(p.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      <Button variant="outline" className="w-full" onClick={signOut}>
        Sair
      </Button>
    </div>
  );
}
