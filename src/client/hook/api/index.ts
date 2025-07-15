// This file acts as a centralized "factory" for all API hooks.
// It determines whether to provide the REAL server-connected hooks or the MOCK static data hooks
// based on the `VITE_APP_MODE` environment variable.

const isStatic = import.meta.env.VITE_APP_MODE === 'static';

// --- 1. Import all REAL hooks with aliases ---
// We import the actual hook functions and rename them to avoid naming conflicts.
import { useCharacterApi as useRealCharacterApi } from './useCharacterApi.js';
import { useChatApi as useRealChatApi } from './useChatApi.js';
import { useLoreApi as useRealLoreApi } from './useLoreApi.js';
import { useOrchestrationApi as useRealOrchestrationApi } from './useOrchestrationApi.js';
import { useProfileApi as useRealProfileApi } from './useProfileApi.js';
import { useRecapApi as useRealRecapApi } from './useRecapApi.js';
import { useSessionApi as useRealSessionApi } from './useSessionApi.js';
import { useTempChatApi as useRealTempChatApi } from './useTempChatApi.js';
import { useTermApi as useRealTermApi } from './useTermApi.js';

// --- 2. Import all MOCK hooks using a single barrel file ---
// This assumes you have an index.js (or .ts) in `src/mock/hook/` that exports all mock hooks.
import * as MockHooks from '../../mock/hook/index.js';

// --- 3. Conditionally export the correct hook implementation ---
// Your components will import from this file, and based on the build mode,
// they will receive either the real hook or the mock hook.
export const useCharacterApi = isStatic ? MockHooks.useCharacterApiMock : useRealCharacterApi;
export const useChatApi = isStatic ? MockHooks.useChatApiMock : useRealChatApi;
export const useLoreApi = isStatic ? MockHooks.useLoreApiMock : useRealLoreApi;
export const useOrchestrationApi = isStatic
	? MockHooks.useOrchestrationApiMock
	: useRealOrchestrationApi;
export const useProfileApi = isStatic ? MockHooks.useProfileApiMock : useRealProfileApi;
export const useRecapApi = isStatic ? MockHooks.useRecapApiMock : useRealRecapApi;
export const useSessionApi = isStatic ? MockHooks.useSessionApiMock : useRealSessionApi;
export const useTempChatApi = isStatic ? MockHooks.useTempChatApiMock : useRealTempChatApi;
export const useTermApi = isStatic ? MockHooks.useTermApiMock : useRealTermApi;

// Note: usePersonaApi and useMemoryApi are intentionally excluded as requested.
