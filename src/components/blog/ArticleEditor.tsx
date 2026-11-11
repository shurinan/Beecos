import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Minus,
  PenLine,
  Quote,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { autoExcerpt, readingMinutes, articleText } from "@/lib/blog-html";
import {
  BLOG_TOPICS,
  blogImageUrl,
  type Draft,
  safeArticleHtml,
  uploadBlogImage,
} from "@/lib/blog";
import { photoError } from "@/lib/post-photos";

/** Caixa de destaque (amarela, com borda): para avisos e dicas importantes. */
const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "div.destaque" }];
  },
  renderHTML() {
    return ["div", { class: "destaque" }, 0];
  },
});

/** Deixa o HTML da aba HTML mais fácil de ler: uma linha por bloco. */
function prettyHtml(html: string): string {
  return html
    .replace(/(<\/(?:p|h2|h3|li|ul|ol|blockquote|div|pre|figure)>|<hr\s*\/?>)/g, "$1\n")
    .trim();
}

type Mode = "escrever" | "html";

export default function ArticleEditor({
  value,
  onChange,
  userId,
  showSignature = true,
}: {
  value: Draft;
  onChange: (d: Draft) => void;
  userId: string;
  /** a equipe ajustando o artigo de outra pessoa não mexe na assinatura */
  showSignature?: boolean;
}) {
  const latest = useRef(value);
  latest.current = value;
  const emit = (patch: Partial<Draft>) => onChange({ ...latest.current, ...patch });

  const [mode, setMode] = useState<Mode>("escrever");
  const [html, setHtml] = useState("");
  const [uploading, setUploading] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const editorRef = useRef<Editor | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function addImages(files: File[]) {
    const ed = editorRef.current;
    for (const file of files) {
      const err = photoError(file);
      if (err) {
        toast.error(err);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const { url } = await uploadBlogImage(userId, file);
        ed?.chain()
          .focus()
          .setImage({ src: url, alt: latest.current.title || "Foto do artigo" })
          .run();
      } catch {
        toast.error("Não foi possível enviar a foto. Tente de novo.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: null, target: null } },
      }),
      Image.configure({ inline: false }),
      Callout,
      Placeholder.configure({
        placeholder: "Comece a escrever aqui. Use os botões acima para títulos, listas e fotos.",
      }),
    ],
    content: safeArticleHtml(value.body_html),
    editorProps: {
      attributes: {
        class: "artigo-corpo min-h-[340px] px-4 py-3 outline-none",
        "aria-label": "Texto do artigo",
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length) return false;
        void addImages(files);
        return true;
      },
      handleDrop(_view, event, _slice, moved) {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        void addImages(files);
        return true;
      },
    },
    onUpdate({ editor: ed }) {
      emit({ body_html: ed.getHTML() });
    },
  });
  editorRef.current = editor;

  // estado dos botões (negrito ligado, título ligado…)
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            ul: e.isActive("bulletList"),
            ol: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            callout: e.isActive("callout"),
            link: e.isActive("link"),
            undo: e.can().undo(),
            redo: e.can().redo(),
          }
        : null,
  });

  function switchMode(next: Mode) {
    if (next === mode || !editor) return;
    if (next === "html") {
      setHtml(prettyHtml(editor.getHTML()));
    } else {
      editor.commands.setContent(safeArticleHtml(html), { emitUpdate: true });
    }
    setMode(next);
  }

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }

  async function pickCover(file: File | undefined) {
    if (!file) return;
    const err = photoError(file);
    if (err) {
      toast.error(err);
      return;
    }
    setUploading((n) => n + 1);
    try {
      const { path } = await uploadBlogImage(userId, file);
      emit({ cover_path: path });
    } catch {
      toast.error("Não foi possível enviar a capa. Tente de novo.");
    } finally {
      setUploading((n) => n - 1);
    }
  }

  const tools: {
    key: string;
    label: string;
    icon: typeof Bold;
    on?: boolean | undefined;
    disabled?: boolean | undefined;
    run: () => void;
  }[] = editor
    ? [
        {
          key: "h2",
          label: "Título",
          icon: Heading2,
          on: st?.h2,
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          key: "h3",
          label: "Subtítulo",
          icon: Heading3,
          on: st?.h3,
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          key: "b",
          label: "Negrito",
          icon: Bold,
          on: st?.bold,
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          key: "i",
          label: "Itálico",
          icon: Italic,
          on: st?.italic,
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          key: "ul",
          label: "Lista",
          icon: List,
          on: st?.ul,
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          key: "ol",
          label: "Lista 1-2-3",
          icon: ListOrdered,
          on: st?.ol,
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          key: "q",
          label: "Citação",
          icon: Quote,
          on: st?.quote,
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          key: "d",
          label: "Destaque",
          icon: Megaphone,
          on: st?.callout,
          run: () => editor.chain().focus().toggleWrap("callout").run(),
        },
        {
          key: "a",
          label: "Link",
          icon: Link2,
          on: st?.link,
          run: () => {
            setLinkUrl((editor.getAttributes("link")["href"] as string | undefined) ?? "");
            setLinkOpen((o) => !o);
          },
        },
        { key: "img", label: "Foto", icon: ImagePlus, run: () => photoInput.current?.click() },
        {
          key: "hr",
          label: "Linha",
          icon: Minus,
          run: () => editor.chain().focus().setHorizontalRule().run(),
        },
        {
          key: "u",
          label: "Desfazer",
          icon: Undo2,
          disabled: !st?.undo,
          run: () => editor.chain().focus().undo().run(),
        },
        {
          key: "r",
          label: "Refazer",
          icon: Redo2,
          disabled: !st?.redo,
          run: () => editor.chain().focus().redo().run(),
        },
      ]
    : [];

  const words = articleText(value.body_html).split(" ").filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* capa */}
      <div>
        {value.cover_path ? (
          <div className="relative">
            <img
              src={blogImageUrl(value.cover_path)}
              alt="Capa do artigo"
              className="aspect-[16/9] w-full rounded-xl border-2 border-foreground object-cover"
            />
            <div className="absolute bottom-2 right-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => coverInput.current?.click()}
              >
                Trocar capa
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => emit({ cover_path: null })}
              >
                <Trash2 /> Tirar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-foreground/40 px-4 py-6 text-center hover:bg-foreground/[0.04]"
          >
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            <span className="font-bold">Adicionar foto de capa</span>
            <span className="text-sm text-muted-foreground">
              Opcional. Aparece no topo e na prévia do WhatsApp.
            </span>
          </button>
        )}
        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            void pickCover(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-bold">Título</span>
        <Textarea
          value={value.title}
          maxLength={140}
          rows={2}
          placeholder="Ex.: 5 cuidados antes de trocar uma tomada"
          onChange={(e) => emit({ title: e.target.value.replace(/\n/g, " ") })}
          className="resize-none font-display text-2xl leading-tight md:text-2xl"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-bold">Assunto</span>
          <select
            value={value.topic ?? ""}
            onChange={(e) => emit({ topic: e.target.value || null })}
            className="h-11 w-full rounded-md border-2 border-foreground bg-card px-3 font-semibold"
          >
            <option value="">Escolha um assunto</option>
            {BLOG_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-bold">Resumo (opcional)</span>
          <Input
            value={value.excerpt}
            maxLength={300}
            placeholder={autoExcerpt(value.body_html, 80) || "Uma frase sobre o artigo"}
            onChange={(e) => emit({ excerpt: e.target.value })}
          />
        </label>
      </div>

      {/* texto */}
      <div className="overflow-clip rounded-xl border-2 border-foreground bg-card">
        <div className="sticky top-16 z-10 rounded-t-[10px] border-b-2 border-foreground bg-card">
          <div
            role="tablist"
            aria-label="Modo de escrita"
            className="flex border-b-2 border-foreground"
          >
            {(
              [
                { id: "escrever", label: "Escrever", icon: PenLine },
                { id: "html", label: "HTML", icon: Code2 },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={mode === t.id}
                onClick={() => switchMode(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-bold ${mode === t.id ? "bg-foreground text-primary dark:text-background" : "hover:bg-foreground/[0.06]"}`}
              >
                <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </button>
            ))}
          </div>
          {mode === "escrever" && (
            <div role="toolbar" aria-label="Formatação" className="flex flex-wrap gap-1 p-1.5">
              {tools.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  title={t.label}
                  aria-pressed={t.on ?? undefined}
                  disabled={t.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={t.run}
                  className={`flex min-w-[52px] flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[11px] font-bold leading-none disabled:opacity-35 ${t.on ? "bg-primary text-primary-foreground ring-2 ring-foreground" : "hover:bg-foreground/[0.07]"}`}
                >
                  <t.icon className="h-5 w-5" aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {mode === "escrever" && linkOpen && (
            <form
              className="flex gap-2 border-t-2 border-foreground p-2"
              onSubmit={(e) => {
                e.preventDefault();
                applyLink();
              }}
            >
              <Input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Cole o endereço (ex.: beecos.com.br/vagas)"
                aria-label="Endereço do link"
              />
              <Button type="submit" size="sm">
                {linkUrl.trim() ? "Aplicar" : "Tirar link"}
              </Button>
            </form>
          )}
        </div>

        {mode === "escrever" ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="space-y-2 p-3">
            <p className="text-sm text-muted-foreground">
              Para quem já sabe HTML. Vale texto, títulos (h2, h3), listas, citação, links, imagens
              enviadas pelo botão Foto e a caixa <code>&lt;div class="destaque"&gt;</code>. O resto
              (scripts, estilos, iframes) é removido ao voltar para Escrever.
            </p>
            <Textarea
              value={html}
              spellCheck={false}
              aria-label="Código HTML do artigo"
              onChange={(e) => {
                setHtml(e.target.value);
                emit({ body_html: e.target.value });
              }}
              className="min-h-[340px] font-mono text-sm"
            />
          </div>
        )}
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            void addImages(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <p
          className="border-t-2 border-foreground px-3 py-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {uploading > 0
            ? "Enviando foto…"
            : `${words} palavras · cerca de ${readingMinutes(value.body_html)} min de leitura`}
        </p>
      </div>

      {showSignature && (
        <label className="block-card flex items-start gap-3 p-4">
          <Switch
            checked={value.signature}
            onCheckedChange={(v) => emit({ signature: v })}
            aria-label="Mostrar minha assinatura no fim do artigo"
          />
          <span>
            <span className="block font-bold">Assinar o artigo</span>
            <span className="block text-sm text-muted-foreground">
              No fim do artigo aparece o seu perfil profissional (foto, profissão, cidade) com o
              botão “Chamar no Beecos”.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
