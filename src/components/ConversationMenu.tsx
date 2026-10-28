import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Bell,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Pin,
  PinOff,
  StickyNote,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isPinLimitError,
  MAX_NOTE,
  MAX_PINS,
  NO_PREF,
  pinLimitMessage,
  pinnedCount,
  TAGS,
  useConvPrefs,
  useSetPref,
  type PrefPatch,
} from "@/lib/conversation-prefs";
import { isImageType, formatFileSize } from "@/lib/chat";

/** Menu da conversa (⋮): favoritar, fixar, arquivar, etiqueta, recado, mídias e excluir. */
export function ConversationMenu({
  conversationId,
  userId,
  onDeleted,
  className = "",
}: {
  conversationId: string;
  userId: string;
  onDeleted?: () => void;
  className?: string;
}) {
  const prefs = useConvPrefs(userId);
  const pref = { ...NO_PREF, conversation_id: conversationId, ...prefs.get(conversationId) };
  const set = useSetPref(userId);
  const [noteOpen, setNoteOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function save(patch: PrefPatch, done?: string) {
    set.mutate(
      { id: conversationId, patch },
      {
        onSuccess: () => done && toast.success(done),
        onError: (e) =>
          toast.error(
            isPinLimitError(e as { message?: string })
              ? pinLimitMessage
              : "Não foi possível salvar. Tente de novo.",
          ),
      },
    );
  }

  function togglePin() {
    if (pref.pinned_at) return save({ pinned_at: null });
    if (pinnedCount(prefs) >= MAX_PINS) return void toast.error(pinLimitMessage);
    save({ pinned_at: new Date().toISOString() });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Opções da conversa"
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] hover:bg-foreground/[0.07] hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.18)] " +
              className
            }
          >
            <MoreVertical className="h-5 w-5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => save({ favorite: !pref.favorite })}>
            <Star className={"mr-2 h-4 w-4 " + (pref.favorite ? "fill-current" : "")} />
            {pref.favorite ? "Tirar dos favoritos" : "Favoritar"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={togglePin}>
            {pref.pinned_at ? (
              <PinOff className="mr-2 h-4 w-4" />
            ) : (
              <Pin className="mr-2 h-4 w-4" />
            )}
            {pref.pinned_at ? "Soltar do topo" : "Fixar no topo"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              save(
                { archived: !pref.archived },
                pref.archived ? "Conversa desarquivada" : "Conversa arquivada",
              )
            }
          >
            {pref.archived ? (
              <ArchiveRestore className="mr-2 h-4 w-4" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            {pref.archived ? "Desarquivar" : "Arquivar"}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tag className="mr-2 h-4 w-4" /> Etiqueta
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {TAGS.map((t) => (
                <DropdownMenuItem key={t.key} onSelect={() => save({ tag: t.key })}>
                  <span className={"mr-2 h-3 w-3 rounded-full border border-foreground " + t.cls} />
                  {t.label}
                  {pref.tag === t.key && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
              {pref.tag && (
                <DropdownMenuItem onSelect={() => save({ tag: null })}>
                  Sem etiqueta
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
            <StickyNote className="mr-2 h-4 w-4" />
            {pref.note || pref.remind_at ? "Editar recado" : "Recado ou lembrete"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMediaOpen(true)}>
            <ImageIcon className="mr-2 h-4 w-4" /> Mídias enviadas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Excluir conversa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NoteDialog
        key={`${noteOpen}`}
        open={noteOpen}
        onOpenChange={setNoteOpen}
        note={pref.note}
        remindAt={pref.remind_at}
        onSave={(patch) => {
          save(patch, "Recado salvo");
          setNoteOpen(false);
        }}
      />
      <MediaDialog
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        conversationId={conversationId}
        clearedAt={pref.cleared_at}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela some só para você. A outra pessoa continua vendo, e se ela escrever de novo a
              conversa volta, só com as mensagens novas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                save({
                  cleared_at: new Date().toISOString(),
                  pinned_at: null,
                  archived: false,
                  favorite: false,
                  tag: null,
                  note: null,
                  remind_at: null,
                });
                onDeleted?.();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  note,
  remindAt,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  note: string | null;
  remindAt: string | null;
  onSave: (patch: PrefPatch) => void;
}) {
  const [text, setText] = useState(note ?? "");
  const [date, setDate] = useState(remindAt ? remindAt.slice(0, 10) : "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recado ou lembrete</DialogTitle>
          <DialogDescription>Só você vê. A outra pessoa não é avisada de nada.</DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Recado"
          placeholder="Ex: combinar o valor, pedir foto do local…"
          value={text}
          maxLength={MAX_NOTE}
          rows={4}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="-mt-2 text-right text-xs text-muted-foreground">
          {text.length}/{MAX_NOTE}
        </p>
        <label className="block space-y-1 text-sm font-semibold">
          Lembrar em (opcional)
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-md border-2 border-foreground bg-background px-3 font-normal"
          />
        </label>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onSave({ note: null, remind_at: null })}
            disabled={!note && !remindAt}
          >
            Apagar
          </Button>
          <Button
            onClick={() =>
              onSave({
                note: text.trim() || null,
                remind_at: date ? new Date(`${date}T08:00:00`).toISOString() : null,
              })
            }
          >
            <Bell /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MediaRow = {
  id: string;
  created_at: string;
  attachment_path: string;
  attachment_name: string;
  attachment_type: string;
  attachment_size: number;
};

function MediaDialog({
  open,
  onOpenChange,
  conversationId,
  clearedAt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  clearedAt: string | null;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["conv-media", conversationId, clearedAt],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("messages")
        .select(
          "id, created_at, attachment_path, attachment_name, attachment_type, attachment_size",
        )
        .eq("conversation_id", conversationId)
        .not("attachment_path", "is", null)
        .order("created_at", { ascending: false });
      if (clearedAt) q = q.gt("created_at", clearedAt);
      const { data: rows, error } = await q;
      if (error) throw error;
      const list = (rows ?? []) as MediaRow[];
      if (list.length === 0) return [] as (MediaRow & { url: string | null })[];
      const signed = await supabase.storage.from("chat-files").createSignedUrls(
        list.map((r) => r.attachment_path),
        3600,
      );
      const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl] as const));
      return list.map((r) => ({ ...r, url: urls.get(r.attachment_path) ?? null }));
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mídias enviadas</DialogTitle>
          <DialogDescription>Fotos e PDFs trocados nesta conversa.</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {isError && <p>Não foi possível carregar as mídias.</p>}
        {data?.length === 0 && (
          <p className="rounded-lg border-2 border-dashed border-foreground/40 p-6 text-center text-muted-foreground">
            Nenhuma foto ou PDF por aqui ainda.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {data?.map((m) =>
            isImageType(m.attachment_type) ? (
              <a
                key={m.id}
                href={m.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden rounded-lg border-2 border-foreground bg-muted"
              >
                {m.url && (
                  <img
                    src={m.url}
                    alt={m.attachment_name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </a>
            ) : (
              <a
                key={m.id}
                href={m.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-foreground bg-background p-2 text-center"
              >
                <FileText className="h-7 w-7" aria-hidden="true" />
                <span className="line-clamp-2 break-all text-xs font-semibold">
                  {m.attachment_name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatFileSize(m.attachment_size)}
                </span>
              </a>
            ),
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
