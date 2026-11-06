import { useState } from "react";
import { Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { postShareText, postShareUrl } from "@/lib/share";

/**
 * "Compartilhar" de uma vaga ou anúncio: no celular abre o compartilhar do aparelho (WhatsApp,
 * status, Instagram…); no computador, as opções WhatsApp e copiar link.
 */
export function ShareButton({
  post,
  mine,
}: {
  post: {
    slug?: string | null;
    kind: string;
    title: string;
    city?: string | null;
    price?: string | null;
  };
  mine: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!post.slug) return null;
  const p = { ...post, slug: post.slug };
  const text = postShareText(p, mine);
  const url = postShareUrl(p.slug);

  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return; // a pessoa fechou
      }
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link e mensagem copiados. É só colar onde quiser.");
      setOpen(false);
    } catch {
      toast.error("Não foi possível copiar. Segure o dedo no link para copiar.");
    }
  }

  return (
    <>
      <Button type="button" size="lg" variant="outline" className="w-full" onClick={share}>
        <Share2 />{" "}
        {mine
          ? post.kind === "job"
            ? "Compartilhar vaga"
            : "Compartilhar anúncio"
          : "Compartilhar"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="block-card w-[calc(100%-2rem)] max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>Compartilhar</DialogTitle>
            <DialogDescription>
              Qualquer pessoa abre o link, mesmo sem conta. Para conversar, ela entra no Beecos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button asChild className="w-full bg-[#25D366] text-[#0b2b16] hover:bg-[#1fbe5b]">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                <MessageCircle /> Enviar pelo WhatsApp
              </a>
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={copy}>
              <Copy /> Copiar link e mensagem
            </Button>
            <p className="selectable break-all text-center text-xs text-muted-foreground">{url}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
