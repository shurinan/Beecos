// Apaga as fotos e PDFs do chat com mais de 48 horas, e os documentos da verificação de quem excluiu a conta. O texto da mensagem fica; a mensagem é marcada
// com attachment_expired_at para o app mostrar "arquivo expirado". Chamada de hora em hora pelo banco
// (pg_cron). Não recebe nada de quem chama: só apaga o que já venceu, então pode ser chamada sem login.
import { createClient } from "jsr:@supabase/supabase-js@2";

const HOURS = 48;
const BATCH = 200;

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response("configuração ausente", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - HOURS * 3600_000).toISOString();

  let removed = 0;
  for (let round = 0; round < 10; round++) {
    const { data: rows, error } = await db
      .from("messages")
      .select("id, attachment_path")
      .not("attachment_path", "is", null)
      .is("attachment_expired_at", null)
      .lt("created_at", cutoff)
      .limit(BATCH);
    if (error) return new Response(`erro ao listar: ${error.message}`, { status: 500 });
    if (!rows || rows.length === 0) break;
    const paths = rows.map((r) => r.attachment_path as string);
    const del = await db.storage.from("chat-files").remove(paths);
    if (del.error) return new Response(`erro ao apagar: ${del.error.message}`, { status: 500 });
    const upd = await db
      .from("messages")
      .update({ attachment_expired_at: new Date().toISOString() })
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (upd.error) return new Response(`erro ao marcar: ${upd.error.message}`, { status: 500 });
    removed += rows.length;
    if (rows.length < BATCH) break;
  }

  // Documentos da verificação de contas excluídas (fora da guarda por denúncia): apaga de vez.
  let identity = 0;
  for (let round = 0; round < 5; round++) {
    const { data: names, error } = await db.rpc("orphan_identity_files", { _limit: BATCH });
    if (error) return new Response(`erro ao listar documentos: ${error.message}`, { status: 500 });
    const list = (names ?? []) as string[];
    if (list.length === 0) break;
    const del = await db.storage.from("identity-docs").remove(list);
    if (del.error)
      return new Response(`erro ao apagar documentos: ${del.error.message}`, { status: 500 });
    identity += list.length;
    if (list.length < BATCH) break;
  }
  return Response.json({ removed, identity });
});
