import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, MapPin, Pencil, Smartphone, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostStats } from "@/lib/services-hooks";
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
import { PostFormFields } from "@/components/PostFormFields";
import { PostEditDialog } from "@/components/PostEditDialog";
import { EMPTY_DRAFT, draftColumns, draftError, type PostDraft } from "@/lib/post-form";
import { useCatalog } from "@/lib/catalog";
import { WorkAreaDialog, type WorkAreaInput } from "@/components/WorkAreaDialog";
import { GeoError, formatCep, isValidCep, lookupCep, useWorkArea, type Place } from "@/lib/geo";
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
  const slots = usePostStats(data?.posts.map((p) => p.id));
  const { data: catalog } = useCatalog();
  const { data: workArea } = useWorkArea(userId);
  const [areaOpen, setAreaOpen] = useState(false);
  const [draft, setDraft] = useState<PostDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<{
    id: string;
    draft: PostDraft;
    minVacancies: number;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (data?.profile) setDraft((x) => ({ ...x, city: x.city || data.profile!.city }));
  }, [data?.profile]);

  // O CEP da vaga começa igual ao de onde a pessoa atua (ela pode trocar).
  useEffect(() => {
    if (workArea) setDraft((x) => ({ ...x, cep: x.cep || formatCep(workArea.postal_code) }));
  }, [workArea]);

  async function saveWorkArea(a: WorkAreaInput): Promise<boolean> {
    const { error } = await supabase.from("work_areas").upsert({
      user_id: userId,
      postal_code: a.cep,
      city: a.city,
      state: a.state,
      lat: a.lat,
      lng: a.lng,
      expanded_km: a.expanded_km,
    });
    if (error) {
      toast.error(
        error.message.includes("RAIO_PREMIUM")
          ? "O raio expandido é um recurso Premium"
          : "Não foi possível salvar onde você atua",
      );
      return false;
    }
    toast.success("Salvo");
    qc.invalidateQueries();
    return true;
  }

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
    const problem = draftError(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    let place = draft.place;
    if (!place && isValidCep(draft.cep)) {
      try {
        place = await lookupCep(draft.cep);
      } catch (err) {
        toast.error(err instanceof GeoError ? err.message : "Não foi possível buscar o CEP");
        return;
      }
    }
    const { data: created, error } = await supabase
      .from("posts")
      .insert({ ...draftColumns(draft), kind: draft.kind, user_id: userId })
      .select("id")
      .single();
    if (error || !created) {
      toast.error(
        error && isBlockedTextError(error)
          ? BLOCKED_TEXT_MESSAGE
          : ((error && limitMessage(error)) ?? "Erro ao publicar"),
      );
      return;
    }
    if (place) {
      const loc = await supabase.from("post_locations").insert({
        post_id: created.id,
        postal_code: place.cep,
        lat: place.lat,
        lng: place.lng,
      });
      if (loc.error) {
        toast.error(
          "Publicado, mas não foi possível guardar o CEP. Edite a vaga para tentar de novo.",
        );
      }
    }
    toast.success("Publicado!");
    setDraft({ ...EMPTY_DRAFT, kind: draft.kind, city: draft.city, cep: draft.cep });
    qc.invalidateQueries();
  }

  async function startEdit(p: NonNullable<typeof data>["posts"][number]) {
    const { data: loc } = await supabase
      .from("post_locations")
      .select("postal_code")
      .eq("post_id", p.id)
      .maybeSingle();
    setEditing({
      id: p.id,
      minVacancies: slots[p.id]?.taken ?? 0,
      draft: {
        kind: p.kind as PostKind,
        title: p.title,
        description: p.description,
        city: p.city,
        price: p.price,
        vacancies: p.vacancies,
        cep: loc ? formatCep(loc.postal_code) : "",
        place: null,
        pick: {
          professionId: p.profession_id,
          other: p.profession_id === null,
          serviceIds: p.service_id ? [p.service_id] : [],
        },
      },
    });
    setEditOpen(true);
  }

  async function saveEdit(next: PostDraft): Promise<boolean> {
    if (!editing) return false;
    const { error } = await supabase.from("posts").update(draftColumns(next)).eq("id", editing.id);
    if (error) {
      toast.error(
        isBlockedTextError(error)
          ? BLOCKED_TEXT_MESSAGE
          : error.message.includes("VAGAS_OCUPADAS")
            ? "Já há mais vagas ocupadas do que esse número"
            : "Não foi possível salvar as mudanças",
      );
      return false;
    }
    if (next.place) {
      const loc = await supabase.from("post_locations").upsert({
        post_id: editing.id,
        postal_code: next.place.cep,
        lat: next.place.lat,
        lng: next.place.lng,
      });
      if (loc.error) {
        toast.error("Salvo, mas não foi possível guardar o CEP");
        return true;
      }
    } else if (next.cep.trim() === "") {
      await supabase.from("post_locations").delete().eq("post_id", editing.id);
    }
    toast.success("Publicação atualizada");
    qc.invalidateQueries();
    return true;
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

      <section className="block-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <Avatar name={profileFields.full_name} path={data?.profile?.avatar_path} size={80} />
            <Link to="/contato" className="text-xs font-bold underline">
              {data?.profile?.avatar_path ? "Trocar foto" : "Adicionar foto"}
            </Link>
          </div>
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

      <section className="block-card space-y-2 p-5">
        <h2 className="text-xl">Onde você atua</h2>
        {workArea ? (
          <p className="text-sm">
            <span className="font-semibold">
              {workArea.city} - {workArea.state}
            </span>{" "}
            (CEP {formatCep(workArea.postal_code)}). Aviso de vagas até{" "}
            {20 + (usage?.premium ? workArea.expanded_km : 0)} km.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Informe o seu CEP para ver a distância das vagas e, em breve, receber aviso das que
            surgirem perto de você.
          </p>
        )}
        <button
          type="button"
          className="text-sm font-bold underline"
          onClick={() => setAreaOpen(true)}
        >
          {workArea ? "Alterar" : "Informar o CEP"}
        </button>
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
              services={(sk.service_ids ?? []).flatMap(
                (id) => catalog?.services.get(id)?.name ?? [],
              )}
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
      <PostEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={editing?.draft ?? null}
        catalog={catalog}
        minVacancies={editing?.minVacancies ?? 0}
        onSave={saveEdit}
      />
      <WorkAreaDialog
        open={areaOpen}
        onOpenChange={setAreaOpen}
        initial={workArea ?? null}
        premium={!!usage?.premium}
        suggestedCep={data?.address?.postal_code}
        onSave={saveWorkArea}
        onUpgrade={() => toast("Pagamento em breve!")}
      />
      <SkillDialog
        open={skillDialog.open}
        onOpenChange={(open) => setSkillDialog((d) => ({ ...d, open }))}
        initial={skillDialog.initial}
        catalog={catalog}
        existing={(data?.skills ?? []).map((x) => x.skill)}
        onSave={saveSkill}
      />

      <form onSubmit={createPost} className="block-card space-y-3 p-5">
        <h2 className="text-xl">Nova publicação</h2>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border-2 border-foreground">
          {(["job", "available"] as PostKind[]).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setDraft({ ...draft, kind: k })}
              className={
                "py-2 text-sm font-bold " +
                (draft.kind === k ? "bg-foreground text-background" : "bg-background")
              }
            >
              {k === "job" ? "Oferecer vaga" : "Estou disponível"}
            </button>
          ))}
        </div>
        <PostFormFields
          draft={draft}
          onChange={setDraft}
          catalog={catalog}
          idPrefix="new-post"
          minVacancies={0}
        />
        <Button type="submit" className="w-full" size="lg">
          Publicar
        </Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-xl">Minhas publicações</h2>
        {data?.posts.length === 0 && (
          <p className="text-muted-foreground">Você ainda não publicou nada.</p>
        )}
        {data?.posts.map((p) => {
          const st = slots[p.id];
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-foreground p-3"
            >
              <span className="text-xs font-bold uppercase">{KIND_LABEL[p.kind as PostKind]}</span>
              <span className="min-w-0 flex-1 basis-40 truncate font-semibold">{p.title}</span>
              {p.kind === "job" && st && (
                <span className="text-xs text-muted-foreground">
                  {st.taken} de {st.vacancies} {st.vacancies === 1 ? "vaga" : "vagas"}
                </span>
              )}
              <Button asChild size="sm" variant="outline">
                <Link to="/publicacao/$id" params={{ id: p.id }}>
                  <Users /> Interessados
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Editar ${p.title}`}
                onClick={() => startEdit(p)}
              >
                <Pencil /> Editar
              </Button>
              <button
                aria-label={`Excluir ${p.title}`}
                className="-m-2 p-2"
                onClick={() => deletePost(p.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </section>

      <Button variant="outline" className="w-full" onClick={signOut}>
        Sair
      </Button>
    </div>
  );
}
