import * as xssModule from "xss";

// "xss" é CommonJS: no servidor o conteúdo vem em .default; no navegador, direto
type Xss = typeof xssModule;
const xss: Xss = (xssModule as unknown as { default?: Xss }).default ?? xssModule;
const { FilterXSS, escapeAttrValue } = xss;

/**
 * Filtro do HTML dos artigos do blog. Todo artigo passa por aqui antes de aparecer na tela
 * (e também ao salvar), venha do editor ou da aba HTML. Só sobra o que o editor sabe fazer:
 * texto, títulos, listas, citação, links, imagens do próprio Beecos e a caixa de destaque.
 * Nada de script, estilo, formulário, iframe ou eventos (onclick…).
 */

const SITE_HOSTS = ["beecos.com.br", "www.beecos.com.br"];

/** Link permitido: http(s), e-mail, telefone, caminho do próprio site ou âncora. */
export function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(v)) return v;
  if (/^mailto:[^\s"'<>]+$/i.test(v)) return v;
  if (/^tel:\+?[\d\s().-]{6,}$/i.test(v)) return v;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(v)) return v;
  if (/^#[\w-]+$/.test(v)) return v;
  return null;
}

/** Link para fora do Beecos (ganha nofollow, abre em outra aba). */
export function isExternal(href: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return !SITE_HOSTS.includes(new URL(href).hostname.toLowerCase());
  } catch {
    return true;
  }
}

/** Imagem permitida: só as enviadas pelo Beecos (pasta do blog) ou arquivos do próprio site. */
export function safeImageSrc(raw: string, imagePrefixes: readonly string[]): string | null {
  const v = raw.trim();
  if (imagePrefixes.some((p) => p && v.startsWith(p)) && !/["'<>\s]/.test(v)) return v;
  if (/^\/(?!\/)[\w\-./]+\.(?:jpe?g|png|webp|gif|svg)$/i.test(v) && !v.includes("..")) return v;
  return null;
}

const ATTR = (name: string, value: string) => `${name}="${escapeAttrValue(value)}"`;

export type CleanOptions = {
  /** Começo das URLs de imagem aceitas (a pasta pública "blog" do armazenamento). */
  imagePrefixes: readonly string[];
};

export function cleanArticleHtml(html: string, opts: CleanOptions): string {
  const filter = new FilterXSS({
    whiteList: {
      p: [],
      br: [],
      hr: [],
      h2: [],
      h3: [],
      strong: [],
      b: [],
      em: [],
      i: [],
      u: [],
      s: [],
      ul: [],
      ol: [],
      li: [],
      blockquote: [],
      code: [],
      pre: [],
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      figure: [],
      figcaption: [],
      div: ["class"],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "noscript",
      "template",
      "svg",
      "math",
      "textarea",
      "select",
      "button",
      "form",
      "head",
      "title",
    ],
    allowCommentTag: false,
    css: false,
    onTagAttr(tag, name, value) {
      if (tag === "a" && name === "href") {
        const v = safeHref(value);
        return v ? ATTR("href", v) : "";
      }
      if (tag === "a" && name === "title") return ATTR("title", value.slice(0, 200));
      if (tag === "img" && name === "src") {
        const v = safeImageSrc(value, opts.imagePrefixes);
        return v ? ATTR("src", v) : "";
      }
      if (tag === "img" && name === "alt") return ATTR("alt", value.slice(0, 300));
      if (tag === "img" && (name === "width" || name === "height")) {
        return /^\d{1,4}$/.test(value) ? ATTR(name, value) : "";
      }
      if (tag === "div" && name === "class") {
        return value.trim() === "destaque" ? 'class="destaque"' : "";
      }
      return undefined;
    },
    // atributo fora da lista: some
    onIgnoreTagAttr() {
      return "";
    },
  });

  let out = filter.process(html ?? "");
  // imagem sem endereço aceito: sai inteira
  out = out.replace(/<img(?![^>]*\ssrc=")[^>]*>/gi, "");
  // imagens carregam só quando aparecem na tela
  out = out.replace(/<img\s/gi, '<img loading="lazy" decoding="async" ');
  // links para fora: nova aba e nofollow (o Google não conta como indicação do Beecos)
  out = out.replace(/<a\s([^>]*)>/gi, (_m, attrs: string) => {
    const href = /href="([^"]*)"/.exec(attrs)?.[1];
    if (!href) return `<a ${attrs}>`;
    const ext = isExternal(href.replace(/&amp;/g, "&"));
    return ext
      ? `<a ${attrs} target="_blank" rel="nofollow ugc noopener noreferrer">`
      : `<a ${attrs}>`;
  });
  return out;
}

/** Só o texto (para resumo, contagem de palavras e prévias). */
export function articleText(html: string): string {
  return (html ?? "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Minutos de leitura (200 palavras por minuto, no mínimo 1). */
export function readingMinutes(html: string): number {
  const words = articleText(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Resumo automático: o começo do texto, cortado numa palavra inteira. */
export function autoExcerpt(html: string, max = 200): string {
  const t = articleText(html);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trimEnd() + "…";
}
