const baseUrl = process.env.RITA_LOCAL_BASE_URL || 'http://localhost:3000';
const smokeEmail = process.env.RITA_SMOKE_EMAIL;
const smokePassword = process.env.RITA_SMOKE_PASSWORD;
const requireAuthSmoke = process.argv.includes('--auth');

const getSetCookies = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const cookie = headers.get('set-cookie');
  return cookie ? [cookie] : [];
};

const appendCookies = (jar, headers) => {
  for (const cookie of getSetCookies(headers)) {
    const [pair] = cookie.split(';');
    const [name] = pair.split('=');
    jar.set(name, pair);
  }
};

const toCookieHeader = (jar) => Array.from(jar.values()).join('; ');

const fetchText = async (path) => {
  const response = await fetch(new URL(path, baseUrl));
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  return body;
};

const parseJson = (path, body) => {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${path} did not return valid JSON: ${body.slice(0, 200)}`);
  }
};

const fetchJson = async (path, options = {}) => {
  const response = await fetch(new URL(path, baseUrl), options);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  return { response, json: parseJson(path, body) };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const checkAnonymousAuthProtection = async () => {
  const response = await fetch(new URL('/api/user/get-me', baseUrl));
  assert(response.status === 401, `/api/user/get-me should reject anonymous requests with 401, got ${response.status}`);
};

const signIn = async () => {
  const cookieJar = new Map();
  const { response, json } = await fetchJson('/api/auth/signin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', rid: 'emailpassword' },
    body: JSON.stringify({
      formFields: [
        { id: 'email', value: smokeEmail },
        { id: 'password', value: smokePassword },
      ],
    }),
  });

  assert(json.status === 'OK', `/api/auth/signin returned ${JSON.stringify(json)}`);
  appendCookies(cookieJar, response.headers);

  const antiCsrf = response.headers.get('anti-csrf');
  const accessToken =
    response.headers.get('st-access-token') || response.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return { cookieJar, antiCsrf, accessToken };
};

const withAuthHeaders = ({ cookieJar, antiCsrf, accessToken }) => ({
  cookie: toCookieHeader(cookieJar),
  ...(antiCsrf ? { 'anti-csrf': antiCsrf } : {}),
  ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
});

const checkAuthenticatedAppFlow = async () => {
  const session = await signIn();
  const authHeaders = withAuthHeaders(session);

  const { json: me } = await fetchJson('/api/user/get-me', { headers: authHeaders });
  const userId = me.userInfo?.userId;
  assert(typeof userId === 'string' && userId.length > 0, '/api/user/get-me returned no userId');

  const { json: sessions } = await fetchJson(`/api/session/get-sessions-by-user-id/${userId}`, {
    headers: authHeaders,
  });
  assert(Array.isArray(sessions.sessionInfos), 'session list did not return sessionInfos[]');

  await fetch(new URL('/api/auth/signout', baseUrl), {
    method: 'POST',
    headers: { ...authHeaders, rid: 'session' },
  }).catch(() => undefined);
};

const main = async () => {
  const checks = ['healthz', 'readyz', 'ssr-html'];

  const health = parseJson('/healthz', await fetchText('/healthz'));
  assert(health.status === 'ok', `/healthz status was ${JSON.stringify(health)}`);

  const ready = parseJson('/readyz', await fetchText('/readyz'));
  assert(ready.status === 'ready', `/readyz status was ${JSON.stringify(ready)}`);

  const html = await fetchText('/');
  assert(html.includes('<title>Rita-Berenice</title>'), 'SSR HTML did not include the app title');
  assert(html.includes('id="root"'), 'SSR HTML did not include the React root');
  assert(html.includes('window.__INITIAL_LANG__'), 'SSR HTML did not include server language data');

  await checkAnonymousAuthProtection();
  checks.push('auth-protection');

  if (requireAuthSmoke && (!smokeEmail || !smokePassword)) {
    throw new Error('Authenticated smoke requires RITA_SMOKE_EMAIL and RITA_SMOKE_PASSWORD in the shell environment.');
  }

  if (smokeEmail && smokePassword) {
    await checkAuthenticatedAppFlow();
    checks.push('auth-signin', 'user-get-me', 'session-list');
  }

  console.log(JSON.stringify({ status: 'ok', baseUrl, checks }));
};

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ status: 'error', baseUrl, message }));
  process.exitCode = 1;
}
