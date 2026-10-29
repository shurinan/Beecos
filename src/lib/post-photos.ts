import { supabase } from "@/integrations/supabase/client";

/** Fotos da vaga (Premium). */
export const MAX_PHOTOS = 5;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // o que a pessoa escolhe; depois reduzimos
const MAX_SIDE = 1600;

export type PostPhoto = { id: string; path: string; sort: number };

export function photoUrl(path: string): string {
  return supabase.storage.from("post-photos").getPublicUrl(path).data.publicUrl;
}

export function sortPhotos(list: PostPhoto[] | null | undefined): PostPhoto[] {
  return [...(list ?? [])].sort((a, b) => a.sort - b.sort);
}

/** Mensagem de erro para um arquivo escolhido, ou null se estiver bom. */
export function photoError(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Use uma foto JPG, PNG ou WEBP.";
  if (file.size > MAX_INPUT_BYTES) return "Essa foto é grande demais (máximo 15 MB).";
  return null;
}

/** Quantas fotos novas ainda cabem. */
export function photosLeft(kept: number, added: number): number {
  return Math.max(0, MAX_PHOTOS - kept - added);
}

/** Reduz para no máximo 1600 px no lado maior, em JPEG: a vaga carrega rápido e o arquivo fica leve. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("foto"))), "image/jpeg", 0.82),
  );
}

/** Envia as fotos novas e apaga as removidas. Devolve quantas falharam. */
export async function syncPhotos(opts: {
  userId: string;
  postId: string;
  add: File[];
  remove: PostPhoto[];
  startSort: number;
}): Promise<number> {
  let failed = 0;
  if (opts.remove.length) {
    const del = await supabase
      .from("post_photos")
      .delete()
      .in(
        "id",
        opts.remove.map((p) => p.id),
      );
    if (del.error) failed += opts.remove.length;
    else await supabase.storage.from("post-photos").remove(opts.remove.map((p) => p.path));
  }
  let sort = opts.startSort;
  for (const file of opts.add) {
    try {
      const blob = await shrinkPhoto(file);
      const path = `${opts.userId}/${opts.postId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage
        .from("post-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const row = await supabase.from("post_photos").insert({ post_id: opts.postId, path, sort });
      if (row.error) {
        await supabase.storage.from("post-photos").remove([path]);
        throw row.error;
      }
      sort++;
    } catch {
      failed++;
    }
  }
  return failed;
}

/** Ao excluir a vaga ou a conta: apaga os arquivos das fotos (a lista some junto com a vaga). */
export async function removePostPhotoFiles(paths: string[]) {
  if (paths.length) await supabase.storage.from("post-photos").remove(paths);
}

export async function removeAllMyPhotoFiles(userId: string) {
  const { data: folders } = await supabase.storage
    .from("post-photos")
    .list(userId, { limit: 1000 });
  const paths: string[] = [];
  for (const f of folders ?? []) {
    const { data: files } = await supabase.storage
      .from("post-photos")
      .list(`${userId}/${f.name}`, { limit: 100 });
    for (const x of files ?? []) paths.push(`${userId}/${f.name}/${x.name}`);
  }
  await removePostPhotoFiles(paths);
}
