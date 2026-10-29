import { usernameErrorMessage } from "@/lib/username";
import { postGaps } from "@/lib/post-gaps";
import { PrivacyCard } from "@/components/PrivacyCard";
import { postParams, profileParam } from "@/lib/urls";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, MapPin, Pencil, Plus, Smartphone, Trash2, Users } from "lucide-react";
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
import { ConfirmButton } from "@/components/ConfirmButton";
import { cancelSubscription } from "@/lib/billing";
import { ModeratorShortcut } from "@/components/ModeratorShortcut";
import { PostEditDialog } from "@/components/PostEditDialog";
import { draftColumns, type PostDraft } from "@/lib/post-form";
import { removePostPhotoFiles, sortPhotos, syncPhotos } from "@/lib/post-photos";
import { useCatalog } from "@/lib/catalog";
import { WorkAreaDialog, type WorkAreaInput } from "@/components/WorkAreaDialog";
import { formatCep, useWorkArea } from "@/lib/geo";
import { EditProfileDialog, type ProfileFields } from "@/components/ProfileDialogs";
import { BLOCKED_TEXT_MESSAGE, isBlockedTextError } from "@/lib/chat";
import { addressLines, type ContactAddress } from "@/lib/contact";
import {
  FREE_CHATS_PER_MONTH,
  FREE_JOBS_PER_MONTH,
  PREMIUM_PRICE,
  getPlanUsage,
} from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/perfil/")({
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
          .select("*, professions(slug), post_photos(id, path, sort)")
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
  const { data: located } = useQuery({
    queryKey: ["my-post-locations", userId, data?.posts.map((p) => p.id).join(",")],
    enabled: !!data && data.posts.length > 0,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("post_locations")
        .select("post_id")
        .in(
          "post_id",
          (data?.posts ?? []).map((p) => p.id),
        );
      if (error) throw error;
      return new Set((rows ?? []).map((r) => r.post_id));
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
  const [editing, setEditing] = useState<{
    id: string;
    draft: PostDraft;
    minVacancies: number;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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
    username: data?.profile?.slug ?? "",
    full_name: data?.profile?.full_name ?? "",
    headline: data?.profile?.headline ?? "",
    city: data?.profile?.city ?? "",
    service_area: data?.profile?.service_area ?? "",
    certificate_note: data?.profile?.certificate_note ?? "",
    bio: data?.profile?.bio ?? "",
    available: data?.profile?.available ?? false,
  };

  async function checkUsername(name: string): Promise<boolean> {
    const { data: free, error } = await supabase.rpc("username_available", { _name: name });
    if (error) throw error;
    return free === true;
  }

  async function saveProfile(values: ProfileFields): Promise<boolean> {
    const { username, ...rest } = values;
    // o nome de usuário só segue quando mudou (e nunca vazio: uma vez escolhido, não se apaga)
    const slug = username && username !== (data?.profile?.slug ?? "") ? { slug: username } : {};
    const { error } = await supabase.from("profiles").upsert({ id: userId, ...rest, ...slug });
    if (error) {
      toast.error(
        usernameErrorMessage(error) ??
          (isBlockedTextError(error) ? BLOCKED_TEXT_MESSAGE : "Não foi possível salvar o perfil"),
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
        look: {
          coverColor: p.cover_color,
          icon: p.cover_icon,
          urgent: p.urgent,
          negotiable: p.negotiable,
          highlight: p.highlight,
        },
        photos: { kept: sortPhotos(p.post_photos), added: [], removed: [] },
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
    if (next.photos.added.length || next.photos.removed.length) {
      const failed = await syncPhotos({
        userId,
        postId: editing.id,
        add: next.photos.added,
        remove: next.photos.removed,
        startSort: Math.max(-1, ...next.photos.kept.map((x) => x.sort)) + 1,
      });
      if (failed) toast.error(`Salvo, mas ${failed} foto(s) não foram enviadas. Tente de novo.`);
    }
    toast.success("Publicação atualizada");
    qc.invalidateQueries();
    return true;
  }

  async function deletePost(id: string) {
    const photoPaths = (data?.posts.find((x) => x.id === id)?.post_photos ?? []).map((x) => x.path);
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (!error) await removePostPhotoFiles(photoPaths);
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
          to="/perfil/$slug"
          params={{ slug: profileParam({ id: userId, slug: data?.profile?.slug }) }}
          search={{ post: undefined }}
          className="text-sm font-semibold underline"
        >
          Ver como os outros veem
        </Link>
      </div>

      <ModeratorShortcut />

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
          <div className="space-y-2">
            <p>Vagas e conversas ilimitadas.</p>
            <p className="text-sm text-muted-foreground">
              {usage.activeUntil
                ? `Premium até ${new Date(usage.activeUntil).toLocaleDateString("pt-BR")}.`
                : "Premium sem data para terminar."}
            </p>
            {usage.cancelRequestedAt ? (
              <p role="status" className="rounded border-2 border-foreground/30 p-2 text-sm">
                Cancelamento pedido em{" "}
                {new Date(usage.cancelRequestedAt).toLocaleDateString("pt-BR")}. O Premium continua
                até o fim do período pago e não renova.
              </p>
            ) : (
              <ConfirmButton
                variant="outline"
                size="sm"
                title="Cancelar a assinatura Premium?"
                description="O Premium continua até o fim do período já pago e não renova. Se você assinou há menos de 7 dias, o valor pago é devolvido."
                confirmLabel="Cancelar assinatura"
                onConfirm={async () => {
                  const r = await cancelSubscription();
                  if ("error" in r) return void toast.error(r.error);
                  toast.success(
                    r.refunded
                      ? "Assinatura cancelada. O valor será devolvido pelo Asaas."
                      : "Cancelamento pedido.",
                  );
                  void qc.invalidateQueries({ queryKey: ["plan", userId] });
                }}
              >
                Cancelar assinatura
              </ConfirmButton>
            )}
          </div>
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
              <Link to="/plano" className="mt-2 block text-center text-sm font-bold underline">
                Comparar Grátis × Premium
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="block-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <Avatar name={profileFields.full_name} path={data?.profile?.avatar_path} size={80} />
            <Link to="/perfil/contato" className="text-xs font-bold underline">
              {data?.profile?.avatar_path ? "Trocar foto" : "Adicionar foto"}
            </Link>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl leading-tight">
              {profileFields.username ? `@${profileFields.username}` : "Escolha seu @usuário"}
            </h2>
            <p className="truncate font-semibold">{profileFields.full_name || "Sem nome"}</p>
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
            <Link to="/perfil/contato">
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
        checkUsername={checkUsername}
      />
      <PostEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={editing?.draft ?? null}
        catalog={catalog}
        minVacancies={editing?.minVacancies ?? 0}
        onSave={saveEdit}
        premium={!!usage?.premium}
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

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Minhas publicações</h2>
          <Button asChild size="sm">
            <Link to="/publicar" search={{ tipo: "contratar" }}>
              <Plus /> Nova publicação
            </Link>
          </Button>
        </div>
        {data?.posts.length === 0 && (
          <p className="text-muted-foreground">Você ainda não publicou nada.</p>
        )}
        {data?.posts.map((p) => {
          const st = slots[p.id];
          const gaps = located
            ? postGaps({
                kind: p.kind,
                profession_id: p.profession_id,
                description: p.description,
                hasLocation: located.has(p.id),
              })
            : [];
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
              {gaps.length > 0 && (
                <p
                  role="note"
                  className="basis-full rounded border border-destructive/60 bg-destructive/10 px-2 py-1 text-xs"
                >
                  <b>Faltam informações:</b> {gaps.join("; ")}. Toque em Editar para completar.
                </p>
              )}
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/vagas/$profissao/$codigo/interessados"
                  params={postParams({ slug: p.slug, professions: p.professions })}
                >
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

      <PrivacyCard
        userId={userId}
        avatarPath={data?.profile?.avatar_path}
        onDeleted={() => {
          qc.clear();
          navigate({ to: "/auth", replace: true });
        }}
      />

      <Button variant="outline" className="w-full" onClick={signOut}>
        Sair
      </Button>
    </div>
  );
}
