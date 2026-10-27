import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProfileFields = {
  full_name: string;
  headline: string;
  city: string;
  service_area: string;
  certificate_note: string;
  bio: string;
  available: boolean;
};

function Actions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <DialogFooter className="gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" loading={saving}>
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </DialogFooter>
  );
}

/** Menu "Editar perfil": o que aparece para todo mundo no cabeçalho e no perfil público. */
export function EditProfileDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ProfileFields;
  onSave: (values: ProfileFields) => Promise<boolean>;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError("");
      setSaving(false);
    }
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Escreva o seu nome");
      return;
    }
    setSaving(true);
    const ok = await onSave({
      ...form,
      full_name: form.full_name.trim(),
      headline: form.headline.trim(),
      city: form.city.trim(),
      service_area: form.service_area.trim(),
      certificate_note: form.certificate_note.trim(),
      bio: form.bio.trim(),
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>Estas informações aparecem no seu perfil público.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="pf-name">Nome</Label>
            <Input
              id="pf-name"
              maxLength={80}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            {error && (
              <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
                {error}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="pf-headline">Profissão ou título</Label>
            <Input
              id="pf-headline"
              maxLength={80}
              placeholder="Ex: Pedreiro e pintor"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pf-city">Cidade</Label>
            <Input
              id="pf-city"
              placeholder="Ex: Sorocaba - SP"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pf-area">Onde você atende</Label>
            <Input
              id="pf-area"
              maxLength={120}
              placeholder="Ex: Sorocaba e região"
              value={form.service_area}
              onChange={(e) => setForm({ ...form, service_area: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="pf-cert">Cursos e certificados</Label>
            <Input
              id="pf-cert"
              maxLength={200}
              placeholder="Ex: NR-10, curso SENAI de eletricista"
              value={form.certificate_note}
              onChange={(e) => setForm({ ...form, certificate_note: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Aparece no seu perfil como informado por você.
            </p>
          </div>
          <div>
            <Label htmlFor="pf-bio">Sobre você</Label>
            <Textarea
              id="pf-bio"
              placeholder="Experiência, horários, região que atende…"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <label className="flex items-center justify-between rounded-lg border-2 border-foreground p-3">
            <span className="font-semibold">Estou disponível para trabalhar</span>
            <Switch
              checked={form.available}
              onCheckedChange={(v) => setForm({ ...form, available: v })}
            />
          </label>
          <Actions saving={saving} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
