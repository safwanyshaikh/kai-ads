import {
  TextProviderNotImplementedError,
  type TextGenerationInput,
  type TextGenerationProvider,
  type TextGenerationUsage,
} from "./text-provider.interface";

export class NotImplementedTextProvider implements TextGenerationProvider {
  readonly name = "not-implemented";

  async generateText(
    _input: TextGenerationInput,
  ): Promise<{ text: string; usage: TextGenerationUsage }> {
    throw new TextProviderNotImplementedError();
  }
}
