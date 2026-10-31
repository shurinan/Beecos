import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PHONE_KINDS,
  PHONE_KIND_LABEL,
  PHONE_METHODS,
  PHONE_METHOD_LABEL,
  UFS,
  formatCep,
  isValidBirthDate,
  isValidCep,
  isValidPhone,
  digits,
  type AddressInput,
  type ContactAddress,
  type ContactPhone,
  type PhoneInput,
  type PhoneKind,
  type PhoneMethod,
  type AddressKind,
} from "@/lib/contact";

function Err({ children }: { children?: string | undefined }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
      {children}
    </p>
  );
}

function Footer({
  saving,
  onCancel,
  label = "Salvar",
}: {
  saving: boolean;
  onCancel: () => void;
  label?: string;
}) {
  return (
    <DialogFooter className="gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" loading={saving}>
        {saving ? "Salvando…" : label}
      </Button>
    </DialogFooter>
  );
}

/** Estado comum: reinicia o formulário toda vez que o diálogo abre. */
function useDialogForm<T, K extends string>(open: boolean, initial: T) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(initial);
      setErrors({});
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { form, setForm, errors, setErrors, saving, setSaving };
}

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Adicionar ou editar um telefone, com os meios de contato aceitos. */
export function PhoneDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: DialogProps & { initial: ContactPhone | null; onSave: (v: PhoneInput) => Promise<boolean> }) {
  const empty: PhoneInput = { kind: "mobile", number: "", methods: ["call"], shared: true };
  const start: PhoneInput = initial
    ? {
        kind: initial.kind,
        number: initial.number,
        methods: initial.methods,
        shared: initial.shared,
      }
    : empty;
  const { form, setForm, errors, setErrors, saving, setSaving } = useDialogForm<
    PhoneInput,
    "number" | "methods"
  >(open, start);

  function toggle(m: PhoneMethod) {
    const has = form.methods.includes(m);
    setForm({ ...form, methods: has ? form.methods.filter((x) => x !== m) : [...form.methods, m] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<"number" | "methods", string>> = {};
    if (!isValidPhone(form.number)) errs.number = "Digite um telefone válido, com DDD.";
    if (form.methods.length === 0) errs.methods = "Marque pelo menos uma forma de contato.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const ok = await onSave({
      kind: form.kind,
      number: form.number.trim(),
      methods: form.methods,
      shared: form.shared,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar telefone" : "Adicionar telefone"}</DialogTitle>
          <DialogDescription>Privado: só você vê.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="ph-kind">Tipo</Label>
            <select
              id="ph-kind"
              className="h-10 w-full rounded-md border-2 border-foreground bg-background px-3"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as PhoneKind })}
            >
              {PHONE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PHONE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="ph-number">Número</Label>
            <Input
              id="ph-number"
              type="tel"
              inputMode="tel"
              maxLength={30}
              placeholder="(11) 90000-0000"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
            <Err>{errors.number}</Err>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Aceita contato por</legend>
            <div className="flex flex-wrap gap-2">
              {PHONE_METHODS.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 rounded-lg border-2 border-foreground px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={form.methods.includes(m)}
                    onChange={() => toggle(m)}
                  />
                  {PHONE_METHOD_LABEL[m]}
                </label>
              ))}
            </div>
            <Err>{errors.methods}</Err>
          </fieldset>
          <label className="flex items-start gap-2 rounded-lg border-2 border-foreground p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.shared}
              onChange={(e) => setForm({ ...form, shared: e.target.checked })}
            />
            <span>
              <span className="block font-semibold">Mostrar para quem conversa comigo</span>
              <span className="text-muted-foreground">
                Só aparece para quem já trocou mensagens com você. Dá para desmarcar quando quiser.
              </span>
            </span>
          </label>
          <Footer saving={saving} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Endereço físico ou postal (um de cada por pessoa). */
export function AddressDialog({
  open,
  onOpenChange,
  kind,
  initial,
  onSave,
}: DialogProps & {
  kind: AddressKind;
  initial: ContactAddress | null;
  onSave: (v: AddressInput) => Promise<boolean>;
}) {
  const empty: AddressInput = {
    kind,
    recipient: "",
    care_of: "",
    street: "",
    neighborhood: "",
    city: "",
    state: "",
    postal_code: "",
  };
  const start: AddressInput = initial ? { ...initial } : empty;
  const { form, setForm, errors, setErrors, saving, setSaving } = useDialogForm<
    AddressInput,
    "recipient" | "street" | "city" | "state" | "postal_code"
  >(open, start);
  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<"recipient" | "street" | "city" | "state" | "postal_code", string>> =
      {};
    if (!form.recipient.trim()) errs.recipient = "Escreva o destinatário.";
    if (!form.street.trim()) errs.street = "Escreva a rua e o número.";
    if (!form.city.trim()) errs.city = "Escreva a cidade.";
    if (!form.state) errs.state = "Escolha o estado.";
    if (!isValidCep(form.postal_code)) errs.postal_code = "O CEP tem 8 números.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const ok = await onSave({
      kind,
      recipient: form.recipient.trim(),
      care_of: form.care_of.trim(),
      street: form.street.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      state: form.state,
      postal_code: digits(form.postal_code),
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind === "physical" ? "Endereço físico" : "Endereço postal"}</DialogTitle>
          <DialogDescription>
            {kind === "physical"
              ? "Onde você mora ou trabalha."
              : "Onde você recebe correspondência."}{" "}
            Privado: só você vê.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="ad-recipient">Destinatário</Label>
            <Input
              id="ad-recipient"
              maxLength={80}
              value={form.recipient}
              onChange={set("recipient")}
            />
            <Err>{errors.recipient}</Err>
          </div>
          <div>
            <Label htmlFor="ad-careof">Aos cuidados de</Label>
            <Input id="ad-careof" maxLength={80} value={form.care_of} onChange={set("care_of")} />
          </div>
          <div>
            <Label htmlFor="ad-street">Rua e número</Label>
            <Input id="ad-street" maxLength={120} value={form.street} onChange={set("street")} />
            <Err>{errors.street}</Err>
          </div>
          <div>
            <Label htmlFor="ad-hood">Bairro</Label>
            <Input
              id="ad-hood"
              maxLength={60}
              value={form.neighborhood}
              onChange={set("neighborhood")}
            />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div>
              <Label htmlFor="ad-city">Cidade</Label>
              <Input id="ad-city" maxLength={60} value={form.city} onChange={set("city")} />
              <Err>{errors.city}</Err>
            </div>
            <div>
              <Label htmlFor="ad-state">Estado</Label>
              <select
                id="ad-state"
                className="h-10 w-full rounded-md border-2 border-foreground bg-background px-2"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              >
                <option value="">UF</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <Err>{errors.state}</Err>
            </div>
          </div>
          <div>
            <Label htmlFor="ad-cep">CEP</Label>
            <Input
              id="ad-cep"
              inputMode="numeric"
              placeholder="00000-000"
              value={formatCep(form.postal_code)}
              onChange={(e) =>
                setForm({ ...form, postal_code: digits(e.target.value).slice(0, 8) })
              }
            />
            <Err>{errors.postal_code}</Err>
          </div>
          <Footer saving={saving} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type PersonalFields = {
  last_name: string;
  first_name: string;
  other_names: string;
  name_suffix: string;
  preferred_name: string;
  birth_date: string;
};

/** Nome completo em partes, nome preferido (o que aparece no perfil público) e nascimento. */
export function PersonalDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: DialogProps & { initial: PersonalFields; onSave: (v: PersonalFields) => Promise<boolean> }) {
  const { form, setForm, errors, setErrors, saving, setSaving } = useDialogForm<
    PersonalFields,
    "preferred_name" | "birth_date"
  >(open, initial);
  const set = (k: keyof PersonalFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<"preferred_name" | "birth_date", string>> = {};
    if (!form.preferred_name.trim()) errs.preferred_name = "Escreva como quer ser chamado.";
    if (form.birth_date && !isValidBirthDate(form.birth_date))
      errs.birth_date = "Data de nascimento inválida.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const ok = await onSave({
      last_name: form.last_name.trim(),
      first_name: form.first_name.trim(),
      other_names: form.other_names.trim(),
      name_suffix: form.name_suffix.trim(),
      preferred_name: form.preferred_name.trim(),
      birth_date: form.birth_date,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informações pessoais</DialogTitle>
          <DialogDescription>
            O nome completo e a data de nascimento são privados. Só o nome preferido aparece para os
            outros.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="pe-first">Primeiro nome</Label>
            <Input
              id="pe-first"
              maxLength={60}
              value={form.first_name}
              onChange={set("first_name")}
            />
          </div>
          <div>
            <Label htmlFor="pe-other">Outros nomes</Label>
            <Input
              id="pe-other"
              maxLength={100}
              value={form.other_names}
              onChange={set("other_names")}
            />
          </div>
          <div>
            <Label htmlFor="pe-last">Último sobrenome</Label>
            <Input id="pe-last" maxLength={60} value={form.last_name} onChange={set("last_name")} />
          </div>
          <div>
            <Label htmlFor="pe-suffix">Sufixo</Label>
            <Input
              id="pe-suffix"
              maxLength={20}
              placeholder="Ex: Júnior"
              value={form.name_suffix}
              onChange={set("name_suffix")}
            />
          </div>
          <div>
            <Label htmlFor="pe-pref">Nome preferido</Label>
            <Input
              id="pe-pref"
              maxLength={80}
              value={form.preferred_name}
              onChange={set("preferred_name")}
            />
            <Err>{errors.preferred_name}</Err>
          </div>
          <div>
            <Label htmlFor="pe-birth">Data de nascimento</Label>
            <Input id="pe-birth" type="date" value={form.birth_date} onChange={set("birth_date")} />
            <Err>{errors.birth_date}</Err>
          </div>
          <Footer saving={saving} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Trocar o e-mail da conta: o Supabase manda um link de confirmação para o novo endereço. */
export function EmailDialog({
  open,
  onOpenChange,
  current,
  onSave,
}: DialogProps & { current: string; onSave: (email: string) => Promise<boolean> }) {
  const { form, setForm, errors, setErrors, saving, setSaving } = useDialogForm<
    { email: string },
    "email"
  >(open, { email: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const email = form.email.trim();
    const errs: Partial<Record<"email", string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Digite um e-mail válido.";
    else if (email.toLowerCase() === current.toLowerCase())
      errs.email = "Esse já é o e-mail da conta.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const ok = await onSave(email);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar e-mail</DialogTitle>
          <DialogDescription>
            Vamos enviar um link de confirmação para o novo e-mail. Até confirmar, você continua
            entrando com {current}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="em-new">Novo e-mail</Label>
            <Input
              id="em-new"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ email: e.target.value })}
            />
            <Err>{errors.email}</Err>
          </div>
          <Footer saving={saving} onCancel={() => onOpenChange(false)} label="Enviar confirmação" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
