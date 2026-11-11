import { describe, expect, it } from "vitest";
import {
  articleText,
  autoExcerpt,
  cleanArticleHtml,
  isExternal,
  readingMinutes,
  safeHref,
} from "./blog-html";

const PREFIX = "https://proj.supabase.co/storage/v1/object/public/blog/";
const clean = (h: string) => cleanArticleHtml(h, { imagePrefixes: [PREFIX] });

describe("filtro do HTML dos artigos", () => {
  it("mantém a formatação do editor", () => {
    const html =
      "<h2>Título</h2><p>Um <strong>negrito</strong>, <em>itálico</em>, <u>sublinhado</u> e <s>riscado</s>.</p>" +
      "<ul><li><p>item</p></li></ul><ol><li>um</li></ol><blockquote><p>citação</p></blockquote><hr>" +
      '<div class="destaque"><p>Atenção!</p></div><pre><code>código</code></pre>';
    const out = clean(html);
    for (const tag of [
      "<h2>",
      "<strong>",
      "<em>",
      "<u>",
      "<s>",
      "<ul>",
      "<ol>",
      "<blockquote>",
      "<hr",
      "<pre>",
      "<code>",
    ]) {
      expect(out).toContain(tag);
    }
    expect(out).toContain('<div class="destaque">');
  });

  it.each([
    ["script", "<p>oi</p><script>alert(1)</script>"],
    ["script maiúsculo", "<SCRIPT>alert(1)</SCRIPT>"],
    ["onerror", '<img src="x" onerror="alert(1)">'],
    ["onclick", '<p onclick="alert(1)">clique</p>'],
    ["javascript: no link", '<a href="javascript:alert(1)">x</a>'],
    ["javascript: com espaço e maiúscula", '<a href=" JaVaScRiPt:alert(1)">x</a>'],
    ["javascript: codificado", '<a href="jav&#x61;script:alert(1)">x</a>'],
    ["data: no link", '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'],
    ["iframe", '<iframe src="https://evil.com"></iframe>'],
    ["svg com script", "<svg><script>alert(1)</script></svg>"],
    ["svg onload", '<svg onload="alert(1)"></svg>'],
    ["style com expressão", '<p style="background:url(javascript:alert(1))">x</p>'],
    ["form", '<form action="https://evil.com"><input name="senha"></form>'],
    ["object", '<object data="evil.swf"></object>'],
    ["meta refresh", '<meta http-equiv="refresh" content="0;url=https://evil.com">'],
    ["base", '<base href="https://evil.com/">'],
    ["comentário condicional", "<!--[if gte IE 4]><script>alert(1)</script><![endif]-->"],
    ["atributo quebrado", '<p title="x" onmouseover="alert(1)" a=">">x</p>'],
    [
      "tag aberta dentro de atributo",
      '<a href="https://ok.com/" title="<script>alert(1)</script>">x</a>',
    ],
  ])("bloqueia %s", (_name, html) => {
    const out = clean(html).toLowerCase();
    expect(out).not.toMatch(/<script|<iframe|<svg|<object|<form|<meta|<base|<input/);
    expect(out).not.toMatch(/\son[a-z]+\s*=/);
    expect(out).not.toContain("javascript:");
    expect(out).not.toMatch(/href="data:/);
    expect(out).not.toContain("style=");
  });

  it("remove o conteúdo de script e style, mas guarda o texto de tags desconhecidas", () => {
    expect(clean("<style>p{color:red}</style><span>texto</span>")).toBe("texto");
    expect(clean("<script>var a=1</script>fim")).toBe("fim");
  });

  it("imagem só do Beecos; as de fora somem inteiras", () => {
    const ok = clean(`<img src="${PREFIX}u1/foto.jpg" alt="Tomada">`);
    expect(ok).toContain(`src="${PREFIX}u1/foto.jpg"`);
    expect(ok).toContain('alt="Tomada"');
    expect(ok).toContain('loading="lazy"');
    expect(clean('<img src="https://rastreador.com/pixel.gif">')).toBe("");
    expect(clean('<img src="//evil.com/a.jpg">')).toBe("");
    expect(clean(`<img src="${PREFIX}a.jpg&quot; onerror=&quot;alert(1)">`)).not.toContain(
      "onerror",
    );
  });

  it("classe só a da caixa de destaque", () => {
    expect(clean('<div class="destaque">x</div>')).toBe('<div class="destaque">x</div>');
    expect(clean('<div class="fixed inset-0">x</div>')).toBe("<div>x</div>");
    expect(clean('<p class="text-red">x</p>')).toBe("<p>x</p>");
  });

  it("links de fora: nova aba e nofollow; links do Beecos: normais", () => {
    expect(clean('<a href="https://site.com/x">x</a>')).toBe(
      '<a href="https://site.com/x" target="_blank" rel="nofollow ugc noopener noreferrer">x</a>',
    );
    expect(clean('<a href="https://beecos.com.br/vagas">x</a>')).toBe(
      '<a href="https://beecos.com.br/vagas">x</a>',
    );
    expect(clean('<a href="/blog">x</a>')).toBe('<a href="/blog">x</a>');
    // o autor não escolhe target/rel (evita tirar o nofollow)
    expect(clean('<a href="https://site.com" rel="dofollow" target="_self">x</a>')).toBe(
      '<a href="https://site.com" target="_blank" rel="nofollow ugc noopener noreferrer">x</a>',
    );
  });

  it("aceita e-mail e telefone", () => {
    expect(clean('<a href="mailto:oi@beecos.com.br">e-mail</a>')).toContain(
      'href="mailto:oi@beecos.com.br"',
    );
    expect(clean('<a href="tel:+55 11 99999-0000">ligar</a>')).toContain(
      'href="tel:+55 11 99999-0000"',
    );
  });
});

describe("ajudantes", () => {
  it("safeHref", () => {
    expect(safeHref("https://a.com")).toBe("https://a.com");
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref("vbscript:x")).toBeNull();
    expect(safeHref("#parte-2")).toBe("#parte-2");
  });
  it("isExternal", () => {
    expect(isExternal("https://www.beecos.com.br/x")).toBe(false);
    expect(isExternal("https://beecos.com.br.evil.com/x")).toBe(true);
    expect(isExternal("/blog")).toBe(false);
  });
  it("texto, minutos e resumo", () => {
    expect(articleText("<p>Olá&nbsp;<b>mundo</b></p><p>de novo</p>")).toBe("Olá mundo de novo");
    expect(readingMinutes("<p>" + "palavra ".repeat(450) + "</p>")).toBe(2);
    expect(readingMinutes("<p>curto</p>")).toBe(1);
    const ex = autoExcerpt("<p>" + "texto longo ".repeat(40) + "</p>", 50);
    expect(ex.length).toBeLessThanOrEqual(51);
    expect(ex.endsWith("…")).toBe(true);
  });
});
