import { RESPONSE_EDIT_CHARACTER_LIMIT } from '../config/constants.js';

/**
 * Returns true when `candidate` can be produced by deleting characters from `original`.
 * This deliberately follows the textarea's UTF-16 character counting so the client and
 * server enforce the same policy as HTML `maxLength`.
 */
export const isDeletionOnlyEdit = (original: string, candidate: string): boolean => {
  if (candidate.length > original.length) return false;

  let candidateIndex = 0;
  for (
    let originalIndex = 0;
    originalIndex < original.length && candidateIndex < candidate.length;
    originalIndex += 1
  ) {
    if (original[originalIndex] === candidate[candidateIndex]) candidateIndex += 1;
  }
  return candidateIndex === candidate.length;
};

/**
 * Existing generated/imported responses are authoritative and may exceed the ordinary edit
 * limit. While still over the limit they may only shrink; after reaching the limit they can be
 * edited normally without ever growing beyond it.
 */
export const isResponseEditAllowed = (
  original: string,
  candidate: string,
  limit: number = RESPONSE_EDIT_CHARACTER_LIMIT,
): boolean => candidate.length <= limit || (original.length > limit && isDeletionOnlyEdit(original, candidate));

/** Validates one interactive textarea transition, preventing insertion while it is over limit. */
export const isResponseEditChangeAllowed = (
  current: string,
  candidate: string,
  limit: number = RESPONSE_EDIT_CHARACTER_LIMIT,
): boolean => (current.length > limit ? isDeletionOnlyEdit(current, candidate) : candidate.length <= limit);
