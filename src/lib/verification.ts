import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type VerificationRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  created_at: string;
  reviewed_at: string | null;
};

export function verificationErrorMessage(err: unknown): string | null {
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (msg.includes("duplicate key") || msg.includes("one_pending"))
    return "Você já tem um pedido em análise.";
  if (msg.includes("JA_ANALISADA")) return "Este pedido já foi analisado.";
  if (msg.includes("PROPRIO_PEDIDO")) return "Você não pode analisar o seu próprio pedido.";
  if (msg.includes("MOTIVO_OBRIGATORIO")) return "Escreva o motivo da recusa.";
  if (msg.includes("SEM_PERMISSAO")) return "Você não tem permissão para isso.";
  return null;
}

/** Valida o arquivo antes de enviar; devolve a mensagem de erro ou null. */
export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Envie uma foto em JPG, PNG ou WebP.";
  if (file.size > MAX_UPLOAD_BYTES) return "A foto passou de 5 MB. Tire outra com menos zoom.";
  return null;
}

/** Último pedido de verificação da própria pessoa (ou null se nunca pediu). */
export function useMyVerification(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-verification", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("id, status, reason, created_at, reviewed_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] as VerificationRow | undefined) ?? null;
    },
  });
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Envia uma foto para o bucket privado, na pasta da própria pessoa. Devolve o caminho. */
export async function uploadIdentityFile(userId: string, file: File): Promise<string> {
  const bad = checkImageFile(file);
  if (bad) throw new Error(bad);
  const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error } = await supabase.storage
    .from("identity-docs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export type SubmitFiles = {
  front: File;
  back: File | null;
  selfie: File;
};

export async function submitVerification(userId: string, f: SubmitFiles) {
  const uploaded: string[] = [];
  try {
    const front = await uploadIdentityFile(userId, f.front);
    uploaded.push(front);
    const back = f.back ? await uploadIdentityFile(userId, f.back) : null;
    if (back) uploaded.push(back);
    const selfie = await uploadIdentityFile(userId, f.selfie);
    uploaded.push(selfie);
    const { error } = await supabase.from("identity_verifications").insert({
      user_id: userId,
      doc_front_path: front,
      doc_back_path: back,
      selfie_path: selfie,
    });
    if (error) throw error;
  } catch (e) {
    // não deixa arquivo solto se o pedido não foi criado
    if (uploaded.length) await supabase.storage.from("identity-docs").remove(uploaded);
    throw e;
  }
}

/** Apaga os arquivos de um pedido já analisado e registra que foram apagados. */
export async function purgeVerificationFiles(id: string, paths: string[]) {
  const { error } = await supabase.storage.from("identity-docs").remove(paths);
  if (error) throw error;
  const { error: e2 } = await supabase.rpc("mark_verification_files_deleted", { _id: id });
  if (e2) throw e2;
}
