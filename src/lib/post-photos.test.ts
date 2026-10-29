import { describe, expect, it } from "vitest";
import { photoError, photosLeft, sortPhotos } from "./post-photos";

describe("fotos da vaga", () => {
  it("aceita só imagem e não aceita arquivo enorme", () => {
    expect(photoError({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(photoError({ type: "application/pdf", size: 1000 })).toMatch(/JPG/);
    expect(photoError({ type: "image/png", size: 20 * 1024 * 1024 })).toMatch(/grande/);
  });
  it("cabem no máximo 5", () => {
    expect(photosLeft(2, 1)).toBe(2);
    expect(photosLeft(4, 3)).toBe(0);
  });
  it("ordena pela posição", () => {
    expect(
      sortPhotos([
        { id: "b", path: "b", sort: 2 },
        { id: "a", path: "a", sort: 0 },
      ]).map((p) => p.id),
    ).toEqual(["a", "b"]);
    expect(sortPhotos(null)).toEqual([]);
  });
});
