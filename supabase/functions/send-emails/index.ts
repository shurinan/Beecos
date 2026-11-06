// Envia os e-mails que o banco colocou na fila (email_outbox). Chamada de minuto em minuto pelo pg_cron.
// Não recebe nada de quem chama: só envia o que já está na fila, então pode ser chamada sem login.
// Envio pelo conector Resend do Lovable (segredos LOVABLE_API_KEY e RESEND_API_KEY).
import { createClient } from "jsr:@supabase/supabase-js@2";

const FROM = Deno.env.get("EMAIL_FROM") ?? "Beecos <avisos@contato.beecos.com.br>";
const REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? "contato@beecos.com.br";
const APP = (Deno.env.get("APP_URL") ?? "https://beecos.lovable.app").replace(/\/$/, "");
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

type Row = {
  id: string;
  user_id: string;
  to_email: string;
  kind: string;
  essential: boolean;
  payload: Record<string, unknown>;
};
type Mail = {
  subject: string;
  pre: string;
  h: string;
  p: string[];
  box?: [string, string][];
  itens?: [string, string][];
  extra?: string;
  cta?: [string, string];
};

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const money = (v: unknown) =>
  typeof v === "number" ? "R$ " + v.toFixed(2).replace(".", ",") : String(v ?? "");
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const ini = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join("") || "•";

function build(r: Row): Mail | null {
  const d = r.payload as Record<string, any>;
  const vaga = d.vaga ? `“${d.vaga}”` : "o serviço";
  switch (r.kind) {
    case "welcome":
      return {
        subject: `Boas-vindas ao Beecos, ${d.nome}`,
        pre: "Sua conta está pronta. Veja por onde começar.",
        h: "Sua conta está pronta",
        p: ["Agora é só escolher por onde começar:"],
        itens: [
          ["1", "Complete o perfil: foto, habilidades e onde você atua."],
          ["2", "Publique uma vaga ou diga que está disponível."],
          ["3", "Converse direto pelo chat e combine tudo."],
        ],
        cta: ["Completar meu perfil", "/perfil"],
      };
    case "interest":
      return d.tipo === "available"
        ? {
            subject: `${d.quem} quer contratar você`,
            pre: `${d.vaga} · Converse para combinar.`,
            h: `${d.quem} quer contratar você`,
            p: [`${d.quem} viu o seu anúncio ${vaga} e quer conversar.`],
            cta: ["Abrir conversas", "/conversas"],
          }
        : {
            subject: `${d.quem} tem interesse na sua vaga`,
            pre: `${d.vaga} · Converse para combinar valor e horário.`,
            h: `${d.quem} tem interesse na sua vaga`,
            p: [`${d.quem} quer fazer o serviço. Converse para combinar valor e horário.`],
            box: [
              ["Vaga", String(d.vaga ?? "")],
              ...(d.valor ? [["Valor", String(d.valor)] as [string, string]] : []),
            ],
            cta: ["Abrir conversa", "/conversas"],
          };
    case "new_message": {
      const n = Number(d.n ?? 1);
      const de = String(d.de ?? "Alguém");
      const texto = String(d.texto ?? "");
      const link =
        typeof d.link === "string" && d.link.startsWith("/conversas") ? d.link : "/conversas";
      const title = n > 1 ? `${n} mensagens novas de ${de}` : `Nova mensagem de ${de}`;
      return {
        subject: title,
        pre: texto ? `“${texto}”` : "Abra a conversa para ver.",
        h: title,
        p: [
          texto ? `“${texto}”` : "Mandou um arquivo.",
          "Responda pelo Beecos para combinar tudo direto.",
        ],
        cta: ["Responder", link],
      };
    }
    case "unread_digest": {
      const n = Number(d.n ?? 0);
      const itens = ((d.itens as { de: string; texto: string }[]) ?? []).map(
        (i) => [ini(i.de), `${i.de} · “${i.texto}”`] as [string, string],
      );
      return {
        subject: `Você tem ${n} ${plural(n, "mensagem não lida", "mensagens não lidas")}`,
        pre: itens[0]?.[1] ?? "Tem gente esperando sua resposta.",
        h: `Você tem ${n} ${plural(n, "mensagem não lida", "mensagens não lidas")}`,
        p: ["Tem gente esperando sua resposta:"],
        itens,
        cta: ["Ver conversas", "/conversas"],
      };
    }
    case "chosen":
      return {
        subject: `Você foi a pessoa escolhida: ${d.vaga}`,
        pre: `${d.cliente} escolheu você. Aceite para confirmar.`,
        h: "Você foi a pessoa escolhida",
        p: [
          `${d.cliente} escolheu você para o serviço. Aceite para confirmar, ou recuse para liberar a vaga.`,
        ],
        box: [
          ["Serviço", String(d.vaga)],
          ...(d.valor ? [["Valor", String(d.valor)] as [string, string]] : []),
        ],
        cta: ["Aceitar ou recusar", "/conversas"],
      };
    case "accepted":
      return {
        subject: `${d.prestador} aceitou o serviço`,
        pre: `Combinado! ${d.vaga}.`,
        h: `Combinado! ${d.prestador} aceitou`,
        p: [
          "Quando o serviço terminar, qualquer um dos dois marca como concluído no chat. Aí vocês podem se avaliar.",
        ],
        box: [
          ["Serviço", String(d.vaga)],
          ["Com", String(d.prestador)],
        ],
        cta: ["Abrir conversa", "/conversas"],
      };
    case "declined":
      return {
        subject: `${d.prestador} recusou o serviço`,
        pre: "A vaga voltou a ficar disponível.",
        h: `${d.prestador} recusou o serviço`,
        p: [
          `A vaga ${vaga} voltou a ficar disponível. Escolha outra pessoa entre os interessados.`,
        ],
        cta: ["Ver minhas publicações", "/perfil?secao=publicacoes"],
      };
    case "completed":
      return {
        subject: `Como foi o serviço com ${d.outro}?`,
        pre: "Avalie e ajude outras pessoas a escolher.",
        h: "Como foi o serviço?",
        p: [
          `O serviço ${vaga} foi marcado como concluído. Sua avaliação ajuda outras pessoas a escolher.`,
        ],
        extra: "stars",
        cta: [`Avaliar ${String(d.outro ?? "").split(" ")[0]}`, "/conversas"],
      };
    case "job_digest": {
      const n = Number(d.n ?? 0);
      const itens = ((d.itens as { titulo: string; valor: string | null }[]) ?? []).map(
        (i) => ["•", i.valor ? `${i.titulo} · ${i.valor}` : i.titulo] as [string, string],
      );
      return {
        subject: `${n} ${plural(n, "vaga nova", "vagas novas")} da sua profissão perto de você`,
        pre: itens[0]?.[1] ?? "Vagas novas perto de você.",
        h: `${n} ${plural(n, "vaga nova", "vagas novas")} perto de você`,
        p: ["Publicadas nas últimas 24 horas, perto de onde você atua:"],
        itens,
        cta: ["Ver as vagas", "/avisos"],
      };
    }
    case "pay_pending": {
      const nome =
        d.produto === "urgent"
          ? "Selo Urgente"
          : d.produto === "annual"
            ? "Beecos Premium Anual"
            : "Beecos Premium";
      return {
        subject: `Sua cobrança de ${money(d.valor)} está esperando o pagamento`,
        pre: `${nome} · Pague com Pix, boleto ou cartão.`,
        h: "Sua cobrança está pronta",
        p: ["Pague pelo botão abaixo, com Pix, boleto ou cartão. Se já pagou, ignore este e-mail."],
        box: [
          ["Produto", nome],
          ["Valor", money(d.valor)],
        ],
        cta: d.link ? ["Pagar agora", String(d.link)] : ["Ver meu plano", "/perfil?secao=plano"],
      };
    }
    case "pay_confirmed":
      if (d.produto === "urgent")
        return {
          subject: "Selo Urgente ativado na sua vaga",
          pre: `${d.vaga ?? "Sua vaga"} · ${money(d.valor)}`,
          h: "O selo Urgente já está na sua vaga",
          p: [`A vaga ${vaga} agora aparece com o selo Urgente.`],
          box: [
            ["Valor", money(d.valor)],
            ["Pago em", String(d.pago)],
          ],
          cta: ["Ver minhas publicações", "/perfil?secao=publicacoes"],
        };
      return {
        subject:
          d.produto === "annual"
            ? "Pagamento confirmado: Beecos Premium Anual"
            : "Pagamento confirmado: Beecos Premium",
        pre: `${money(d.valor)} · Já está valendo.`,
        h: "Pagamento confirmado",
        p: [
          d.produto === "annual"
            ? "Você agora é Premium por 12 meses. O plano anual não renova sozinho: nada é cobrado de novo."
            : "Você agora é Premium. Já está valendo.",
        ],
        box: [
          ["Plano", d.produto === "annual" ? "Beecos Premium Anual" : "Beecos Premium (mensal)"],
          ["Valor", money(d.valor)],
          ["Pago em", String(d.pago)],
          ...(d.ate
            ? [
                [d.produto === "annual" ? "Vale até" : "Próxima cobrança", String(d.ate)] as [
                  string,
                  string,
                ],
              ]
            : []),
        ],
        extra: "desistir",
        cta: ["Ver meu plano", "/perfil?secao=plano"],
      };
    case "pay_overdue":
      return {
        subject: "Não recebemos o seu pagamento",
        pre: "Pague para continuar com os benefícios.",
        h: "Não recebemos o seu pagamento",
        p: ["A cobrança está em aberto. Pague para continuar com os benefícios do Premium."],
        box: [["Valor", money(d.valor)]],
        cta: d.link ? ["Pagar agora", String(d.link)] : ["Ver meu plano", "/perfil?secao=plano"],
      };
    case "premium_ending":
      return {
        subject: "Seu Premium termina em 7 dias",
        pre: `Termina em ${d.ate}.`,
        h: "Seu Premium termina em 7 dias",
        p: [
          d.anual
            ? `O plano anual não renova sozinho. Ele termina em ${d.ate}. Renove para continuar com vagas e conversas sem limite.`
            : `Você cancelou a assinatura, então o Premium termina em ${d.ate}. Se mudar de ideia, é só assinar de novo.`,
        ],
        cta: ["Renovar o Premium", "/plano"],
      };
    case "referral_reward":
      return {
        subject: "Você ganhou 1 mês de Premium",
        pre: "Obrigado por trazer prestadores para o Beecos.",
        h: "Você ganhou 1 mês de Premium!",
        p: [
          "5 prestadores entraram pelo seu link e completaram o cadastro. Obrigado por ajudar o Beecos a crescer.",
          d.tipo === "postpone"
            ? "Sua próxima cobrança foi adiada em 30 dias. Nada a fazer: já está valendo."
            : d.tipo === "free"
              ? `O Premium já está valendo${d.ate ? ` até ${d.ate}` : ""}. Depois volta ao plano grátis, sem cobrança.`
              : `Seu Premium ganhou mais 30 dias${d.ate ? `: agora vai até ${d.ate}` : ""}.`,
        ],
        cta: ["Ver Indique e ganhe", "/perfil?secao=indique"],
      };
    case "verif_approved":
      return {
        subject: "Sua conta foi verificada",
        pre: "Agora você tem o selo Verificado.",
        h: "Sua conta foi verificada",
        p: [
          "Agora você tem o selo Verificado no perfil. Quem contrata confia mais em perfis verificados. Os documentos já foram apagados.",
        ],
        extra: "selo",
        cta: ["Ver meu perfil", "/perfil"],
      };
    case "verif_rejected":
      return {
        subject: "Não conseguimos verificar sua conta",
        pre: d.motivo ? `Motivo: ${d.motivo}` : "Você pode tentar de novo.",
        h: "Não conseguimos verificar sua conta",
        p: ["Você pode tentar de novo quando quiser. Os documentos enviados já foram apagados."],
        box: d.motivo ? [["Motivo", String(d.motivo)]] : undefined,
        cta: ["Tentar de novo", "/perfil/verificacao"],
      };
  }
  return null;
}

const B = "border:2px solid #12151B";
function html(m: Mail, r: Row): string {
  const d = r.payload as Record<string, any>;
  const hello = r.kind === "welcome" ? `Oi, ${esc(d.nome)}!` : `Oi, ${esc(d.nome)}!`;
  let body = m.p
    .map((x) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">${esc(x)}</p>`)
    .join("");
  if (m.itens?.length)
    body += m.itens
      .map(
        ([a, b]) =>
          `<p style="margin:0 0 8px;font-size:14px"><b style="padding:2px 7px;${B};border-radius:12px;background:#F2CE4B;font-size:12px">${esc(a)}</b> ${esc(b)}</p>`,
      )
      .join("");
  if (m.box?.length)
    body +=
      `<table cellpadding="8" cellspacing="0" width="100%" style="${B};border-radius:8px;margin:8px 0 12px;font-size:14px">` +
      m.box
        .map(
          ([k, v]) =>
            `<tr><td style="color:#5B5F68;width:140px;border-top:1px solid #eee">${esc(k)}</td><td style="font-weight:bold;border-top:1px solid #eee">${esc(v)}</td></tr>`,
        )
        .join("") +
      "</table>";
  if (m.extra === "stars") body += `<p style="font-size:30px;color:#E0A800;margin:4px 0">★★★★★</p>`;
  if (m.extra === "desistir")
    body += `<p style="background:#FFF4C7;border-radius:8px;padding:8px 12px;font-size:13px;color:#5B5F68">Você pode desistir em até 7 dias e receber o valor de volta, em Meu perfil › Plano e pagamento.</p>`;
  if (m.extra === "selo")
    body += `<p><b style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:16px;background:#1160D8;color:#fff;text-align:center">B</b> <b>Selo Verificado</b></p>`;
  if (m.cta) {
    const href = m.cta[1].startsWith("http") ? m.cta[1] : APP + m.cta[1];
    body += `<p style="margin:14px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#F2CE4B;color:#12151B;${B};border-radius:10px;padding:10px 20px;font-weight:bold;text-decoration:none;box-shadow:3px 3px 0 #12151B">${esc(m.cta[0])}</a></p>`;
  }
  const foot = r.essential
    ? "Este é um e-mail sobre a sua conta e chega sempre."
    : `Não quer receber este tipo de e-mail? <a href="${APP}/avisos" style="color:#12151B">Parar de receber</a>`;
  return `<div style="display:none;max-height:0;overflow:hidden">${esc(m.pre)}</div><div style="font-family:Arial,sans-serif;background:#FBF8EE;padding:16px;color:#12151B"><div style="max-width:560px;margin:0 auto"><div style="background:#F2CE4B;${B};border-bottom:0;border-radius:10px 10px 0 0;padding:12px 16px"><b style="display:inline-block;${B};border-radius:5px;padding:0 5px;font-family:'Arial Black',Arial,sans-serif">B.</b> <b style="font-family:'Arial Black',Arial,sans-serif;font-size:21px">Beecos.</b></div><div style="background:#F2CE4B;border-left:2px solid #12151B;border-right:2px solid #12151B;border-top:8px dashed #12151B"></div><div style="background:#fff;${B};border-top:0;border-radius:0 0 10px 10px;padding:18px 20px"><p style="margin:0 0 4px;color:#5B5F68;font-size:14px">${hello}</p><h2 style="font-family:'Arial Black',Arial,sans-serif;font-size:20px;margin:0 0 10px">${esc(m.h)}</h2>${body}</div><p style="font-size:11px;color:#6b6f78;text-align:center;line-height:1.5;margin-top:12px">${foot}<br>Beecos · contato@beecos.com.br<br>O Beecos conecta pessoas: não emprega ninguém e não recebe o pagamento do serviço.</p></div></div>`;
}

function text(m: Mail): string {
  const lines = [m.h, "", ...m.p];
  for (const [a, b] of m.itens ?? []) lines.push(`${a} ${b}`);
  for (const [k, v] of m.box ?? []) lines.push(`${k}: ${v}`);
  if (m.cta)
    lines.push("", `${m.cta[0]}: ${m.cta[1].startsWith("http") ? m.cta[1] : APP + m.cta[1]}`);
  return lines.join("\n");
}

async function send(to: string, m: Mail, r: Row): Promise<{ id?: string; error?: string }> {
  const res = await fetch(`${GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`,
      "X-Connection-Api-Key": Deno.env.get("RESEND_API_KEY") ?? "",
    },
    body: JSON.stringify({
      from: FROM,
      reply_to: REPLY_TO,
      to: [to],
      subject: m.subject,
      html: html(m, r),
      text: text(m),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: `${res.status} ${JSON.stringify(data).slice(0, 300)}` };
  return { id: (data as { id?: string }).id ?? "" };
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response("configuração ausente", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db.rpc("claim_emails", { _limit: 40 });
  if (error) return new Response(`erro ao ler a fila: ${error.message}`, { status: 500 });
  let sent = 0;
  let failed = 0;
  for (const r of (data ?? []) as Row[]) {
    // cobrança gerada: se já foi paga (ou cancelada) nesse meio-tempo, não manda
    if (r.kind === "pay_pending" && r.payload.pagamento) {
      const { data: pay } = await db
        .from("payments")
        .select("status")
        .eq("asaas_payment_id", r.payload.pagamento)
        .maybeSingle();
      if (pay && pay.status !== "pending") {
        await db
          .from("email_outbox")
          .update({ sent_at: new Date().toISOString(), last_error: "pulado: já pago" })
          .eq("id", r.id);
        continue;
      }
    }
    const m = build(r);
    if (!m) {
      await db
        .from("email_outbox")
        .update({ last_error: `tipo desconhecido: ${r.kind}`, attempts: 99 })
        .eq("id", r.id);
      continue;
    }
    const out = await send(r.to_email, m, r);
    if (out.error) {
      failed++;
      await db.from("email_outbox").update({ last_error: out.error }).eq("id", r.id);
    } else {
      sent++;
      await db
        .from("email_outbox")
        .update({ sent_at: new Date().toISOString(), resend_id: out.id, last_error: null })
        .eq("id", r.id);
    }
  }
  return Response.json({ sent, failed });
});
