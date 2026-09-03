import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '@rita-berenice/shared/domain';
import { getClientErrorMessage, installSessionInterceptors } from './clientApiHelpers.js';

const successResponse = (config: InternalAxiosRequestConfig) => ({
  data: { ok: true },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

test('session interceptors authenticate the first API request', async () => {
  const client = axios.create();
  let authorization: string | undefined;
  const removeInterceptors = installSessionInterceptors(
    client,
    {
      doesSessionExist: async () => true,
      getAccessToken: async () => 'initial-token',
      attemptRefreshingSession: async () => false,
    },
    () => undefined,
  );

  try {
    await client.get('/user/me', {
      adapter: async (config) => {
        authorization = config.headers.get('Authorization') as string | undefined;
        return successResponse(config);
      },
    });

    assert.equal(authorization, 'Bearer initial-token');
  } finally {
    removeInterceptors();
  }
});

test('session interceptors refresh once and retry a rejected first request', async () => {
  const client = axios.create();
  let requestCount = 0;
  let refreshCount = 0;
  const removeInterceptors = installSessionInterceptors(
    client,
    {
      doesSessionExist: async () => true,
      getAccessToken: async () => (refreshCount === 0 ? 'expired-token' : 'refreshed-token'),
      attemptRefreshingSession: async () => {
        refreshCount += 1;
        return true;
      },
    },
    () => undefined,
  );

  try {
    const response = await client.get('/user/me', {
      adapter: async (config) => {
        requestCount += 1;
        if (requestCount === 1) {
          throw new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, undefined, {
            data: {},
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            config,
          });
        }
        assert.equal(config.headers.get('Authorization'), 'Bearer refreshed-token');
        return successResponse(config);
      },
    });

    assert.deepEqual(response.data, { ok: true });
    assert.equal(requestCount, 2);
    assert.equal(refreshCount, 1);
  } finally {
    removeInterceptors();
  }
});

test('terminal session failures emit one toast without a general error duplicate', async (t) => {
  t.mock.method(console, 'error', () => undefined);
  const client = axios.create();
  const toasts: string[] = [];
  const removeInterceptors = installSessionInterceptors(
    client,
    {
      doesSessionExist: async () => true,
      getAccessToken: async () => 'expired-token',
      attemptRefreshingSession: async () => false,
    },
    () => (message) => toasts.push(message),
  );
  const adapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, undefined, {
      data: {},
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    });
  };

  try {
    await assert.rejects(client.get('/user/me', { adapter }));
    await assert.rejects(client.get('/user/me', { adapter }));

    assert.deepEqual(toasts, ['Your session has expired. Please log in again.']);
  } finally {
    removeInterceptors();
  }
});

test('client error messages never expose an internal API message', () => {
  const error = new ApiError(500, 'Database connection string was rejected.', 'Could not save the API key.');

  assert.equal(getClientErrorMessage(error, 'Save failed.'), 'Could not save the API key.');
});

test('client error messages use the supplied fallback for unexpected errors', () => {
  assert.equal(getClientErrorMessage(new Error('Sensitive implementation detail.'), 'Save failed.'), 'Save failed.');
});
