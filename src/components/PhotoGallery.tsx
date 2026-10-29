import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Fotos da vaga em grade; tocar numa foto abre ela grande, com setas para passar. */
export function PhotoGallery({ urls, title }: { urls: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const n = urls.length;
  const go = (d: number) => setOpen((i) => (i === null ? i : (i + d + n) % n));
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (n === 0) return null;
  return (
    <>
      <div
        className={
          "grid gap-1.5 " + (n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-3")
        }
      >
        {urls.map((u, i) => (
          <button
            key={u}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Ampliar foto ${i + 1} de ${n}`}
            className={
              "overflow-hidden rounded-md border-2 border-foreground bg-muted " +
              (n === 1 ? "aspect-video" : "aspect-square")
            }
          >
            <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl gap-2 border-0 bg-black p-2 text-white [&>button]:text-white">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Foto {open !== null ? open + 1 : 0} de {n}
          </DialogDescription>
          {open !== null && (
            <div className="relative">
              <img
                src={urls[open]}
                alt={`Foto ${open + 1} de ${n}: ${title}`}
                className="mx-auto max-h-[80vh] w-auto rounded"
              />
              {n > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    onClick={() => go(-1)}
                    className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60"
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    aria-label="Próxima foto"
                    onClick={() => go(1)}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60"
                  >
                    <ChevronRight />
                  </button>
                  <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 text-xs">
                    {open + 1} / {n}
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
