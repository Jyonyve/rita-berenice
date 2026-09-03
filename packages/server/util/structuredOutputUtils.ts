import { ZodType } from 'zod';

export class StructuredOutputValidationError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'StructuredOutputValidationError';
  }
}

const extractJsonCandidate = (rawOutput: string): string => {
  const trimmedOutput = rawOutput.trim();
  const fencedMatch = trimmedOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fencedMatch?.[1]?.trim() || trimmedOutput;
};

export const parseStructuredLlmOutput = <T>(rawOutput: string, schema: ZodType<T>): T => {
  if (!rawOutput.trim()) {
    throw new StructuredOutputValidationError('The model returned an empty structured output.', rawOutput);
  }

  const jsonCandidate = extractJsonCandidate(rawOutput);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonCandidate);
  } catch (error) {
    throw new StructuredOutputValidationError('The model returned malformed JSON.', rawOutput, {
      cause: error,
    });
  }

  const validationResult = schema.safeParse(parsedJson);
  if (!validationResult.success) {
    throw new StructuredOutputValidationError('The model response did not match the required schema.', rawOutput, {
      cause: validationResult.error,
    });
  }

  return validationResult.data;
};
