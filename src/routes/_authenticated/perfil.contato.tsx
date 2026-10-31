import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/profile-bits";
import {
  AddressDialog,
  EmailDialog,
  PersonalDialog,
  PhoneDialog,
  type PersonalFields,
} from "@/components/ContactDialogs";
import {
  ADDRESS_KINDS,
  ADDRESS_KIND_LABEL,
  CONSENT_TEXT,
  CONSENT_VERSION,
  MAX_PHONES,
  PHONE_KIND_LABEL,
  addressLines,
  ageFromBirthDate,
  avatarPath,
  formatBirthDate,
  formatMethods,
  joinFullName,
  phoneLimitMessage,
  validateAvatarFile,
  type AddressInput,
  type AddressKind,
  type ContactAddress,
  type ContactPhone,
  type PhoneInput,
} from "@/lib/contact";
import { formatLongDate } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/perfil/contato")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Informações de contato — Beecos" },
      { name: "description", content: "Seus dados pessoais e de contato. Privados: só você vê." },
    ],
  }),
  component: Contato,
});

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="block-card space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} className="p-1" onClick={onClick}>
      {children}
    </button>
  );
}

function Contato() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const { session } = useAuth();
  const email = session?.user.email ?? "";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isError, refetch } = useQuery({
    queryKey: ["contact", userId],
    queryFn: async () => {
      const [p, priv, phones, addresses] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_path").eq("id", userId).maybeSingle(),
        supabase.from("profile_private").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("contact_phones")
          .select("id, kind, number, methods, shared")
          .eq("user_id", userId)
          .order("created_at"),
        supabase
          .from("contact_addresses")
          .select("id, kind, recipient, care_of, street, neighborhood, city, state, postal_code")
          .eq("user_id", userId),
      ]);
      const error = p.error ?? priv.error ?? phones.error ?? addresses.error;
      if (error) throw error;
      return {
        fullName: p.data?.full_name ?? "",
        avatarPath: p.data?.avatar_path ?? null,
        priv: priv.data,
        phones: (phones.data ?? []) as ContactPhone[],
        addresses: (addresses.data ?? []) as ContactAddress[],
      };
    },
  });

  const { data: presence } = useQuery({
    queryKey: ["presence-self", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("show_last_seen")
        .eq("user_id", userId)
        .maybeSingle();
      return { share: data?.show_last_seen ?? true };
    },
  });
  const showSeen = presence?.share ?? true;
  async function toggleShowSeen(next: boolean) {
    const { error } = await supabase.rpc("set_show_last_seen", { _show: next });
    if (error) return void toast.error("Não foi possível salvar a opção.");
    qc.invalidateQueries({ queryKey: ["presence-self", userId] });
  }

  const [personalOpen, setPersonalOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [phoneDialog, setPhoneDialog] = useState<{ open: boolean; initial: ContactPhone | null }>({
    open: false,
    initial: null,
  });
  const [addressDialog, setAddressDialog] = useState<{ open: boolean; kind: AddressKind }>({
    open: false,
    kind: "physical",
  });

  const refresh = () => qc.invalidateQueries();

  async function savePersonal(v: PersonalFields): Promise<boolean> {
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ full_name: v.preferred_name }).eq("id", userId),
      supabase.from("profile_private").upsert({
        user_id: userId,
        last_name: v.last_name,
        first_name: v.first_name,
        other_names: v.other_names,
        name_suffix: v.name_suffix,
        birth_date: v.birth_date || null,
        updated_at: new Date().toISOString(),
      }),
    ]);
    if (a.error || b.error) {
      toast.error("Não foi possível salvar as informações pessoais.");
      return false;
    }
    toast.success("Informações salvas");
    refresh();
    return true;
  }

  async function setConsent(on: boolean) {
    const { error } = await supabase.from("profile_private").upsert({
      user_id: userId,
      consent_at: on ? new Date().toISOString() : null,
      consent_version: on ? CONSENT_VERSION : "",
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast.error("Não foi possível atualizar a autorização.");
      return;
    }
    toast.success(on ? "Autorização registrada" : "Autorização retirada");
    refresh();
  }

  async function saveEmail(next: string): Promise<boolean> {
    const { error } = await supabase.auth.updateUser({ email: next });
    if (error) {
      toast.error("Não foi possível trocar o e-mail.");
      return false;
    }
    toast.success("Enviamos um link de confirmação para o novo e-mail");
    return true;
  }

  async function savePhone(v: PhoneInput): Promise<boolean> {
    const initial = phoneDialog.initial;
    const { error } = initial
      ? await supabase.from("contact_phones").update(v).eq("id", initial.id)
      : await supabase.from("contact_phones").insert({ ...v, user_id: userId });
    if (error) {
      toast.error(
        phoneLimitMessage(error) ??
          (error.code === "23505"
            ? "Você já cadastrou esse número."
            : "Não foi possível salvar o telefone."),
      );
      return false;
    }
    toast.success(initial ? "Telefone atualizado" : "Telefone adicionado");
    refresh();
    return true;
  }

  async function deletePhone(id: string) {
    const { error } = await supabase.from("contact_phones").delete().eq("id", id);
    if (error) return void toast.error("Não foi possível excluir o telefone.");
    refresh();
  }

  async function saveAddress(v: AddressInput): Promise<boolean> {
    const { error } = await supabase
      .from("contact_addresses")
      .upsert({ ...v, user_id: userId }, { onConflict: "user_id,kind" });
    if (error) {
      toast.error("Não foi possível salvar o endereço.");
      return false;
    }
    toast.success("Endereço salvo");
    refresh();
    return true;
  }

  async function deleteAddress(id: string) {
    const { error } = await supabase.from("contact_addresses").delete().eq("id", id);
    if (error) return void toast.error("Não foi possível excluir o endereço.");
    refresh();
  }

  async function uploadAvatar(file: File) {
    const problem = validateAvatarFile(file);
    if (problem) return void toast.error(problem);
    setUploading(true);
    const old = data?.avatarPath ?? null;
    const path = avatarPath(userId, file.type);
    const up = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type });
    if (up.error) {
      setUploading(false);
      return void toast.error("Não foi possível enviar a foto.");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", userId);
    if (error) {
      await supabase.storage.from("avatars").remove([path]);
      setUploading(false);
      return void toast.error("Não foi possível salvar a foto.");
    }
    if (old) await supabase.storage.from("avatars").remove([old]);
    setUploading(false);
    toast.success("Foto atualizada");
    refresh();
  }

  async function removeAvatar() {
    const old = data?.avatarPath;
    if (!old) return;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_path: null })
      .eq("id", userId);
    if (error) return void toast.error("Não foi possível remover a foto.");
    await supabase.storage.from("avatars").remove([old]);
    refresh();
  }

  if (isError) {
    return (
      <div className="block-card space-y-3 p-5 text-center">
        <p className="font-semibold">Não foi possível carregar suas informações.</p>
        <Button onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }

  const priv = data?.priv;
  const personal: PersonalFields = {
    last_name: priv?.last_name ?? "",
    first_name: priv?.first_name ?? "",
    other_names: priv?.other_names ?? "",
    name_suffix: priv?.name_suffix ?? "",
    preferred_name: data?.fullName ?? "",
    birth_date: priv?.birth_date ?? "",
  };
  const fullName = joinFullName(personal);
  const age = personal.birth_date ? ageFromBirthDate(personal.birth_date) : null;
  const phones = data?.phones ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/perfil"
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold underline"
        >
          <ArrowLeft className="h-4 w-4" /> Visão geral
        </Link>
        <h1 className="text-3xl">Informações de contato</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Privadas: só você vê. No perfil público
          aparecem só a foto e o nome preferido. Os telefones que você marcar aparecem para quem já
          conversou com você.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo é opcional.{" "}
          <Link to="/privacidade" className="font-bold underline">
            Política de privacidade
          </Link>
        </p>
      </div>

      <Section title="Privacidade no chat">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="block font-semibold">
              Mostrar quando estive online e quando estou digitando
            </span>
            <span className="text-muted-foreground">
              Só quem já conversou com você vê. Se desligar, você também deixa de ver isso dos
              outros.
            </span>
          </span>
          <Switch
            checked={showSeen}
            onCheckedChange={toggleShowSeen}
            aria-label="Mostrar quando estive online"
          />
        </label>
      </Section>

      <Section title="Foto de perfil">
        <div className="flex items-center gap-4">
          <Avatar name={data?.fullName ?? ""} path={data?.avatarPath} size={96} />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Uma foto do rosto, de frente e sem óculos escuros. JPG, PNG ou WebP, até 2 MB. Aparece
              no seu perfil público.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Escolher foto"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadAvatar(f);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Camera />{" "}
                {uploading ? "Enviando…" : data?.avatarPath ? "Trocar foto" : "Enviar foto"}
              </Button>
              {data?.avatarPath && (
                <Button type="button" variant="outline" size="sm" onClick={removeAvatar}>
                  <Trash2 /> Remover
                </Button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Informações pessoais"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setPersonalOpen(true)}>
            <Pencil /> Editar
          </Button>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Nome completo</dt>
            <dd className="font-semibold">{fullName || "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Nome preferido</dt>
            <dd className="font-semibold">{personal.preferred_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Data de nascimento</dt>
            <dd className="font-semibold">
              {personal.birth_date
                ? `${formatBirthDate(personal.birth_date)}${age !== null ? ` (${age} anos)` : ""}`
                : "Não informada"}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Autorização de uso dos dados">
        <p className="text-sm">{CONSENT_TEXT}</p>
        {priv?.consent_at ? (
          <>
            <p className="font-semibold">Autorizado em {formatLongDate(priv.consent_at)}</p>
            <button
              type="button"
              className="text-sm font-bold underline"
              onClick={() => setConsent(false)}
            >
              Retirar autorização
            </button>
          </>
        ) : (
          <>
            <p className="font-semibold">Ainda não autorizado</p>
            <Button type="button" size="sm" onClick={() => setConsent(true)}>
              Autorizar
            </Button>
          </>
        )}
      </Section>

      <Section
        title="E-mail"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setEmailOpen(true)}>
            <Pencil /> Trocar
          </Button>
        }
      >
        <p className="flex items-center gap-2 break-all font-semibold">
          <Mail className="h-4 w-4 shrink-0" /> {email || "—"}
        </p>
        <p className="text-xs text-muted-foreground">É o e-mail que você usa para entrar.</p>
      </Section>

      <Section
        title="Telefones"
        action={
          phones.length < MAX_PHONES && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPhoneDialog({ open: true, initial: null })}
            >
              <Plus /> Adicionar
            </Button>
          )
        }
      >
        {phones.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum telefone cadastrado.</p>
        )}
        <ul className="space-y-2">
          {phones.map((ph) => (
            <li
              key={ph.id}
              className="flex items-start justify-between gap-2 rounded-lg border-2 border-foreground p-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Phone className="h-4 w-4" /> {ph.number}
                </p>
                <p className="text-sm text-muted-foreground">
                  {PHONE_KIND_LABEL[ph.kind]} · {formatMethods(ph.methods)} ·{" "}
                  {ph.shared ? "visível para quem conversa com você" : "só você vê"}
                </p>
              </div>
              <span className="flex shrink-0 gap-1">
                <IconButton
                  label={`Editar ${ph.number}`}
                  onClick={() => setPhoneDialog({ open: true, initial: ph })}
                >
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label={`Excluir ${ph.number}`} onClick={() => deletePhone(ph.id)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {ADDRESS_KINDS.map((kind) => {
        const addr = data?.addresses.find((a) => a.kind === kind);
        return (
          <Section
            key={kind}
            title={ADDRESS_KIND_LABEL[kind]}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddressDialog({ open: true, kind })}
              >
                {addr ? <Pencil /> : <Plus />} {addr ? "Editar" : "Adicionar"}
              </Button>
            }
          >
            {addr ? (
              <div className="flex items-start justify-between gap-2">
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="font-semibold">
                    {addressLines(addr).map((l, i) => (
                      <span key={i} className="block">
                        {l}
                      </span>
                    ))}
                  </span>
                </p>
                <IconButton
                  label={`Excluir ${ADDRESS_KIND_LABEL[kind].toLowerCase()}`}
                  onClick={() => deleteAddress(addr.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
            )}
          </Section>
        );
      })}

      <PersonalDialog
        open={personalOpen}
        onOpenChange={setPersonalOpen}
        initial={personal}
        onSave={savePersonal}
      />
      <EmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        current={email}
        onSave={saveEmail}
      />
      <PhoneDialog
        open={phoneDialog.open}
        onOpenChange={(open) => setPhoneDialog((d) => ({ ...d, open }))}
        initial={phoneDialog.initial}
        onSave={savePhone}
      />
      <AddressDialog
        key={addressDialog.kind}
        open={addressDialog.open}
        onOpenChange={(open) => setAddressDialog((d) => ({ ...d, open }))}
        kind={addressDialog.kind}
        initial={data?.addresses.find((a) => a.kind === addressDialog.kind) ?? null}
        onSave={saveAddress}
      />
    </div>
  );
}
