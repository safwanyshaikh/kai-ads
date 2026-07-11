import { describe, expect, it } from "vitest";
import { NotImplementedImageProvider } from "@/server/ai/image/not-implemented-image-provider";
import { ImageProviderNotImplementedError } from "@/server/ai/image/image-provider.interface";

describe("KAI Creative Engine — image provider architecture", () => {
  it("the not-implemented stand-in throws a specific error, never a fake image", async () => {
    const provider = new NotImplementedImageProvider();
    await expect(
      provider.generate({ prompt: "industrial construction site", widthPx: 1024, heightPx: 1024, quality: "medium" }),
    ).rejects.toThrow(ImageProviderNotImplementedError);
  });

  it("the error message never mentions the underlying provider by name (product-facing name is KAI Creative Engine)", async () => {
    const provider = new NotImplementedImageProvider();
    try {
      await provider.generate({ prompt: "x", widthPx: 1024, heightPx: 1024, quality: "low" });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message.toLowerCase()).not.toContain("gpt image");
      expect((error as Error).message).toContain("KAI Creative Engine");
    }
  });
});
