// src/server/credential/credentialService.ts

import { CredentialMetadataResponse, CredentialValidationResponse } from '@rita-berenice/shared/api';
import { API_KEY_TYPES, type ApiKeyType, type ValidationResult, type UserApiKeys } from '@rita-berenice/shared/domain';
import { encryptValue, decryptValue } from '@rita-berenice/shared/util';
import { getCredentialEnv } from '../config/env.js';
import { getDatabase } from '../db/postgresClient.js';
import { credentials } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { flowLogger, serializeError } from '../util/jsonlLogger.js';

// ✅ API Response Types
interface OpenAIUsageResponse {
  total_usage?: number;
}

interface OpenRouterAuthResponse {
  data?: { usage?: number };
}

interface GoogleErrorResponse {
  error?: { message?: string };
}

export const credentialStore = {
  _validateOpenAI: async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (response.ok) {
        try {
          const usageResponse = await fetch(
            'https://api.openai.com/v1/usage?date=' + new Date().toISOString().split('T')[0],
            { headers: { Authorization: `Bearer ${apiKey}` } },
          );

          if (usageResponse.ok) {
            const usage = (await usageResponse.json()) as OpenAIUsageResponse;
            const creditInfo = usage.total_usage ? `Used: $${(usage.total_usage / 100).toFixed(2)}` : '';
            return { valid: true, platform: 'direct', provider: 'openai', creditInfo };
          }
        } catch (usageError) {
          // Usage API failed, but key is still valid
        }

        return { valid: true, platform: 'direct', provider: 'openai', creditInfo: '' };
      }

      const errorMessage = response.status === 401 ? 'Invalid or expired API key' : `API error: ${response.status}`;

      return { valid: false, platform: 'direct', provider: 'openai', errorMessage };
    } catch (error) {
      return {
        valid: false,
        platform: 'direct',
        provider: 'openai',
        errorMessage: 'Network error - could not validate',
      };
    }
  },

  _validateAnthropic: async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      if (response.status === 401) {
        return { valid: false, platform: 'direct', provider: 'anthropic', errorMessage: '' };
      }

      if (response.status === 429) {
        return {
          valid: false,
          platform: 'direct',
          provider: 'anthropic',
          errorMessage: 'Rate limited or no credits',
        };
      }

      return { valid: true, platform: 'direct', provider: 'anthropic', creditInfo: '' };
    } catch (error) {
      return {
        valid: false,
        platform: 'direct',
        provider: 'anthropic',
        errorMessage: 'Network error - could not validate',
      };
    }
  },

  _validateGoogle: async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);

      if (response.ok) {
        return { valid: true, platform: 'direct', provider: 'google', creditInfo: '' };
      }

      let errorMessage = `API error: ${response.status}`;
      if (response.status === 400 || response.status === 403) {
        try {
          const error = (await response.json()) as GoogleErrorResponse;
          errorMessage = error.error?.message || errorMessage;
        } catch {}
      }

      return { valid: false, platform: 'direct', provider: 'google', errorMessage };
    } catch (error) {
      return {
        valid: false,
        platform: 'direct',
        provider: 'google',
        errorMessage: 'Network error - could not validate',
      };
    }
  },

  _validateGroq: async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (response.ok) {
        return { valid: true, platform: 'direct', provider: 'groq', creditInfo: '' };
      }

      const errorMessage = response.status === 401 ? '' : `API error: ${response.status}`;

      return { valid: false, platform: 'direct', provider: 'groq', errorMessage };
    } catch (error) {
      return {
        valid: false,
        platform: 'direct',
        provider: 'groq',
        errorMessage: 'Network error - could not validate',
      };
    }
  },

  _validateOpenRouter: async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (response.ok) {
        const data = (await response.json()) as OpenRouterAuthResponse;
        const creditInfo = data.data?.usage ? `Credits: $${data.data.usage.toFixed(2)}` : '';

        return { valid: true, platform: 'openrouter', creditInfo };
      }

      const errorMessage = response.status === 401 ? '' : `API error: ${response.status}`;

      return { valid: false, platform: 'openrouter', errorMessage };
    } catch (error) {
      return {
        valid: false,
        platform: 'openrouter',
        errorMessage: 'Network error - could not validate',
      };
    }
  },

  /**
   * Creates or updates a user's encrypted API keys.
   */
  storeUserApiKeys: async (userId: string, apiKeys: UserApiKeys): Promise<void> => {
    try {
      const now = new Date().toISOString();
      const { SECRET_ENCRYPTION_KEY } = getCredentialEnv();

      const encryptedKeys: Record<string, string> = {};
      await Promise.all(
        Object.entries(apiKeys).map(async ([key, value]) => {
          if (value) {
            encryptedKeys[key] = await encryptValue(value, SECRET_ENCRYPTION_KEY);
          }
        }),
      );

      await getDatabase()
        .insert(credentials)
        .values({
          userId,
          encryptedData: JSON.stringify(encryptedKeys),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: credentials.userId,
          set: { encryptedData: JSON.stringify(encryptedKeys), updatedAt: now },
        });

      flowLogger.info('credentialStore', 'apiKeys.store.complete', { userId });
    } catch (error) {
      flowLogger.error('credentialStore', 'apiKeys.store.failed', {
        userId,
        ...serializeError(error),
      });
      throw error;
    }
  },

  /** Returns only which keys exist; encrypted or plaintext values never leave the server. */
  getUserApiKeyMetadata: async (userId: string): Promise<CredentialMetadataResponse> => {
    try {
      const [row] = await getDatabase()
        .select({ encryptedData: credentials.encryptedData })
        .from(credentials)
        .where(eq(credentials.userId, userId))
        .limit(1);
      if (!row) return { configuredKeyTypes: [] };

      const encryptedKeys = JSON.parse(row.encryptedData) as Record<string, unknown>;
      return {
        configuredKeyTypes: API_KEY_TYPES.filter(
          (keyType) => typeof encryptedKeys[keyType] === 'string' && encryptedKeys[keyType] !== '',
        ),
      };
    } catch (error) {
      flowLogger.error('credentialStore', 'apiKeyMetadata.retrieve.failed', {
        userId,
        ...serializeError(error),
      });
      return { configuredKeyTypes: [] };
    }
  },

  /** Server-only access to decrypted API keys. Never return this value from a route. */
  getDecryptedUserApiKeys: async (userId: string): Promise<UserApiKeys> => {
    try {
      const [row] = await getDatabase()
        .select({ encryptedData: credentials.encryptedData })
        .from(credentials)
        .where(eq(credentials.userId, userId))
        .limit(1);
      if (!row) {
        return {};
      }

      const { SECRET_ENCRYPTION_KEY } = getCredentialEnv();
      const encryptedKeys = JSON.parse(row.encryptedData) as Record<string, string>;
      const decryptedKeys: UserApiKeys = {};

      await Promise.all(
        Object.entries(encryptedKeys).map(async ([key, encryptedValue]) => {
          if (typeof encryptedValue === 'string') {
            try {
              decryptedKeys[key as keyof UserApiKeys] = await decryptValue(encryptedValue, SECRET_ENCRYPTION_KEY);
            } catch (decryptError) {
              flowLogger.error('credentialStore', 'apiKeys.decrypt.failed', {
                userId,
                keyType: key,
                ...serializeError(decryptError),
              });
            }
          }
        }),
      );
      return decryptedKeys;
    } catch (error) {
      flowLogger.error('credentialStore', 'apiKeys.retrieve.failed', {
        userId,
        ...serializeError(error),
      });
      return {};
    }
  },

  /**
   * Updates a single API key for a user.
   */
  updateUserApiKey: async (userId: string, keyType: ApiKeyType, keyValue: string): Promise<void> => {
    try {
      const existingKeys = await credentialStore.getDecryptedUserApiKeys(userId);
      const updatedKeys = { ...existingKeys, [keyType]: keyValue };
      await credentialStore.storeUserApiKeys(userId, updatedKeys);
    } catch (error) {
      flowLogger.error('credentialStore', 'apiKey.update.failed', {
        userId,
        keyType,
        ...serializeError(error),
      });
      throw error;
    }
  },

  /**
   * Initializes default API keys for a user from environment variables.
   */
  initializeDefaultApiKeys: async (userId: string): Promise<void> => {
    const defaultKeys: UserApiKeys = {
      openaiApiKey: '',
      anthropicApiKey: '',
      googleApiKey: '',
      openrouterApiKey: '',
      groqApiKey: '',
    };

    const validKeys = Object.fromEntries(Object.entries(defaultKeys).filter(([, value]) => value)) as UserApiKeys;

    if (Object.keys(validKeys).length > 0) {
      await credentialStore.storeUserApiKeys(userId, validKeys);
      flowLogger.info('credentialStore', 'apiKeys.defaultInitialized', { userId });
    }
  },

  validateApiKeys: async (apiKeys: UserApiKeys): Promise<CredentialValidationResponse> => {
    const validationResults: Record<string, ValidationResult> = {};

    const validationPromises = Object.entries(apiKeys).map(async ([keyType, keyValue]) => {
      if (!keyValue || keyValue.trim() === '') return;

      try {
        let result: ValidationResult;

        switch (keyType) {
          case 'openaiApiKey':
            result = await credentialStore._validateOpenAI(keyValue);
            break;
          case 'anthropicApiKey':
            result = await credentialStore._validateAnthropic(keyValue);
            break;
          case 'googleApiKey':
            result = await credentialStore._validateGoogle(keyValue);
            break;
          case 'groqApiKey':
            result = await credentialStore._validateGroq(keyValue);
            break;
          case 'openrouterApiKey':
            result = await credentialStore._validateOpenRouter(keyValue);
            break;
          default:
            result = { valid: false, platform: 'openrouter', errorMessage: 'Unknown key type' };
        }

        validationResults[keyType] = result;
      } catch (error) {
        validationResults[keyType] = {
          valid: false,
          platform: 'openrouter',
          errorMessage: 'Validation failed',
        };
      }
    });

    await Promise.all(validationPromises);

    return { validationResults };
  },
};
