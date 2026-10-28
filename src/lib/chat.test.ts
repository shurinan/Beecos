import { describe, expect, it } from "vitest";
import {
  attachmentPath,
  cleanFileName,
  formatFileSize,
  formatLastSeen,
  isBlockedTextError,
  replySpeedLabel,
  tabTitle,
  validateAttachment,
} from "./chat";

describe("attachments", () => {
  it("accepts images and pdf up to 2 MB", () => {
    expect(validateAttachment({ type: "application/pdf", size: 2 * 1024 * 1024 })).toBeNull();
    expect(validateAttachment({ type: "image/webp", size: 10 })).toBeNull();
  });
  it("rejects other types, empty and large files", () => {
    expect(validateAttachment({ type: "image/svg+xml", size: 10 })).toMatch(/imagem/);
    expect(validateAttachment({ type: "text/html", size: 10 })).toMatch(/imagem/);
    expect(validateAttachment({ type: "image/png", size: 0 })).toMatch(/vazio/);
    expect(validateAttachment({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/);
  });
  it("builds a path inside the conversation folder", () => {
    expect(attachmentPath("c1", "application/pdf", "x")).toBe("c1/x.pdf");
    expect(attachmentPath("c1", "image/jpeg", "x")).toBe("c1/x.jpg");
  });
  it("cleans file names", () => {
    expect(cleanFileName("C:\\fotos\\obra.png")).toBe("obra.png");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("  \u0000 ")).toBe("arquivo");
    const long = cleanFileName("a".repeat(300) + ".pdf");
    expect(long.length).toBe(120);
    expect(long.endsWith(".pdf")).toBe(true);
  });
  it("formats sizes", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1572864)).toBe("1,5 MB");
  });
});

describe("last seen", () => {
  const now = new Date("2026-10-26T18:00:00Z"); // 15:00 em São Paulo
  it("describes recent and older times", () => {
    expect(formatLastSeen("2026-10-26T17:59:30Z", now)).toBe("visto agora");
    expect(formatLastSeen("2026-10-26T17:55:00Z", now)).toBe("visto há 5 min");
    expect(formatLastSeen("2026-10-26T13:30:00Z", now)).toBe("visto hoje às 10:30");
    expect(formatLastSeen("2026-10-25T20:10:00Z", now)).toBe("visto ontem às 17:10");
    expect(formatLastSeen("2026-10-12T12:00:00Z", now)).toBe("visto em 12/10");
    expect(formatLastSeen(null, now)).toBe("");
    expect(formatLastSeen("lixo", now)).toBe("");
  });
});

describe("reply speed", () => {
  it("needs enough replies", () => {
    expect(replySpeedLabel({ replies: 2, median_seconds: 60 })).toBeNull();
    expect(replySpeedLabel(null)).toBeNull();
  });
  it("labels by median", () => {
    expect(replySpeedLabel({ replies: 5, median_seconds: 1200 })).toBe("Responde rápido");
    expect(replySpeedLabel({ replies: 5, median_seconds: 3 * 3600 })).toBe(
      "Responde em poucas horas",
    );
    expect(replySpeedLabel({ replies: 5, median_seconds: 20 * 3600 })).toBe(
      "Responde em até 1 dia",
    );
    expect(replySpeedLabel({ replies: 5, median_seconds: 3 * 86400 })).toBeNull();
  });
});

describe("misc", () => {
  it("recognises the moderation error", () => {
    expect(isBlockedTextError({ message: "TEXTO_BLOQUEADO" })).toBe(true);
    expect(isBlockedTextError({ message: "outro" })).toBe(false);
    expect(isBlockedTextError(null)).toBe(false);
  });
  it("puts the unread count in the tab title", () => {
    expect(tabTitle("Beecos", 0)).toBe("Beecos");
    expect(tabTitle("Beecos", 3)).toBe("(3) Beecos");
    expect(tabTitle("Beecos", 250)).toBe("(99+) Beecos");
  });
});

import { isNetworkError, receiptState } from "./chat";

describe("receiptState", () => {
  const sent = "2026-10-28T12:00:00Z";
  it("enviada quando ninguém viu", () => {
    expect(receiptState(sent, null, null)).toBe("sent");
    expect(receiptState(sent, "2026-10-28T11:59:00Z", "2026-10-28T11:00:00Z")).toBe("sent");
  });
  it("entregue quando a pessoa está online ou apareceu depois", () => {
    expect(receiptState(sent, null, null, true)).toBe("delivered");
    expect(receiptState(sent, null, "2026-10-28T12:00:30Z")).toBe("delivered");
  });
  it("lida quando abriu a conversa depois", () => {
    expect(receiptState(sent, "2026-10-28T12:01:00Z", null)).toBe("read");
  });
});

describe("isNetworkError", () => {
  it("reconhece queda de conexão", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkError({ message: "Load failed" })).toBe(true);
  });
  it("não confunde com recusa do servidor", () => {
    expect(isNetworkError({ message: "new row violates row-level security", code: "42501" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
