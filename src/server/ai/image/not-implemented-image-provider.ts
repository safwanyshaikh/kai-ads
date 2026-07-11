import {
  ImageProviderNotImplementedError,
  type ImageGenerationInput,
  type ImageGenerationOutput,
  type ImageGenerationProvider,
  type ImageGenerationUsage,
} from "./image-provider.interface";

export class NotImplementedImageProvider implements ImageGenerationProvider {
  readonly name = "not-implemented";

  async generate(
    _input: ImageGenerationInput,
  ): Promise<{ output: ImageGenerationOutput; usage: ImageGenerationUsage }> {
    throw new ImageProviderNotImplementedError();
  }
}
