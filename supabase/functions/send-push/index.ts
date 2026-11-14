// Envia os avisos do sistema (Web Push) da fila push_outbox para os aparelhos autorizados.
// Chamada só pelo banco (na hora e, de reserva, a cada minuto), com o segredo interno de app_keys.
// Na primeira vez cria as chaves VAPID e guarda em app_keys (só o servidor lê a privada).
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/**
 * Texto escrito por usuários (mensagem do chat, nome) antes de sair do app por e-mail ou aviso:
 * tira caracteres de controle, troca qualquer coisa com cara de link por "[link removido]",
 * junta espaços e corta no tamanho máximo. O banco já bloqueia links no chat; isto é a segunda barreira.
 */
const LINKISH =
  /(https?:\/\/|ftp:\/\/|www\.)\S*|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|edu|gov|br|io|me|app|link|ly|gl|co|info|xyz|site|online|store|shop|tv|cc|gg|dev|page|click|top|biz|us|ai)\b\S*/gi;
export function safeUserText(s: unknown, max: number): string {
  const clean = String(s ?? "")
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(LINKISH, "[link removido]")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

const SUBJECT = "mailto:contato@beecos.com.br";

/** Só o próprio banco chama esta função: confere o segredo interno guardado em app_keys. */
async function fromDatabase(req: Request, db: ReturnType<typeof createClient>): Promise<boolean> {
  const sent = req.headers.get("x-internal-secret");
  if (!sent) return false;
  const { data } = await db.from("app_keys").select("value").eq("name", "internal_secret").maybeSingle();
  const expected = (data as { value?: string } | null)?.value;
  return !!expected && sent === expected;
}

Deno.serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response("configuração ausente", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  if (!(await fromDatabase(req, db))) return new Response("não autorizado", { status: 401 });

  // chaves do servidor
  const { data: keys } = await db
    .from("app_keys")
    .select("name, value")
    .in("name", ["vapid_public", "vapid_private"]);
  let pub = keys?.find((k) => k.name === "vapid_public")?.value;
  let priv = keys?.find((k) => k.name === "vapid_private")?.value;
  if (!pub || !priv) {
    const fresh = webpush.generateVAPIDKeys();
    // grava só se ainda não existir (duas chamadas ao mesmo tempo não trocam a chave)
    await db.from("app_keys").upsert(
      [
        { name: "vapid_public", value: fresh.publicKey },
        { name: "vapid_private", value: fresh.privateKey },
      ],
      { onConflict: "name", ignoreDuplicates: true },
    );
    const { data: again } = await db
      .from("app_keys")
      .select("name, value")
      .in("name", ["vapid_public", "vapid_private"]);
    pub = again?.find((k) => k.name === "vapid_public")?.value;
    priv = again?.find((k) => k.name === "vapid_private")?.value;
    if (!pub || !priv) return new Response("sem chaves", { status: 500 });
  }
  webpush.setVapidDetails(SUBJECT, pub, priv);

  const { data: jobs, error } = await db.rpc("claim_pushes", { _limit: 100 });
  if (error) return new Response(`erro ao ler a fila: ${error.message}`, { status: 500 });
  let sent = 0;
  let failed = 0;
  for (const j of (jobs ?? []) as {
    id: string;
    user_id: string;
    title: string;
    body: string;
    url: string;
    tag: string | null;
  }[]) {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", j.user_id);
    // só caminhos do próprio app; o texto escrito por usuários passa pela limpeza
    const path = typeof j.url === "string" && j.url.startsWith("/") && !j.url.startsWith("//") ? j.url : "/";
    const payload = JSON.stringify({
      title: safeUserText(j.title, 120) || "Beecos",
      body: safeUserText(j.body, 200),
      url: path,
      tag: j.tag,
    });
    let ok = 0;
    let lastErr = "";
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60, urgency: "high" },
        );
        ok++;
        await db
          .from("push_subscriptions")
          .update({ last_ok_at: new Date().toISOString() })
          .eq("endpoint", s.endpoint);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        lastErr = `${code ?? ""} ${(e as Error).message ?? e}`.slice(0, 300);
        // aparelho desautorizou ou trocou: apaga a inscrição velha
        if (code === 404 || code === 410)
          await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
    if (ok > 0 || (subs ?? []).length === 0) {
      sent++;
      await db
        .from("push_outbox")
        .update({ sent_at: new Date().toISOString(), last_error: null })
        .eq("id", j.id);
    } else {
      failed++;
      await db.from("push_outbox").update({ last_error: lastErr }).eq("id", j.id);
    }
  }
  return Response.json({ sent, failed });
});
