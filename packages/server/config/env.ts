import z from 'zod';

const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

const portSchema = z.coerce.number().int().min(1).max(65535);

const commaSeparatedListSchema = z
	.string()
	.optional()
	.transform((value) =>
		value
			? value
					.split(',')
					.map((item) => item.trim())
					.filter(Boolean)
			: []
	);

const serverEnvSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	PORT: portSchema.default(3000),
	HOST: z.string().default('0.0.0.0'),
	BASE: z.string().default('/'),
	SUPERTOKENS_DOMAIN: z.string().url().default('http://localhost:3567'),
	SUPERTOKENS_API_KEY: z.string().optional(),
	VITE_APP_DOMAIN: z.string().optional(),
	VITE_API_DOMAIN: z.string().optional(),
	DASHBOARD_ADMIN_EMAILS: commaSeparatedListSchema,
});

const embeddingEnvSchema = z.object({
	OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for embeddings'),
});

const databaseEnvSchema = z.object({
	DATABASE_URL: z.string().url('DATABASE_URL must be a PostgreSQL URL'),
	DATABASE_SSL: booleanStringSchema.default(false),
	DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

const credentialEnvSchema = z.object({
	SECRET_ENCRYPTION_KEY: z
		.string()
		.min(1, 'SECRET_ENCRYPTION_KEY is required for credential storage'),
});

const loginEnvSchema = z.object({
	PRIVATE_KEY: z.string().min(1, 'PRIVATE_KEY is required for asymmetric login'),
});

const parseEnv = <T>(schema: z.ZodSchema<T>, env: NodeJS.ProcessEnv): T => {
	const result = schema.safeParse(env);
	if (result.success) {
		return result.data;
	}

	const details = result.error.issues
		.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
		.join('; ');
	throw new Error(`Invalid server environment: ${details}`);
};

let cachedServerEnv: z.infer<typeof serverEnvSchema> | undefined;
let cachedEmbeddingEnv: z.infer<typeof embeddingEnvSchema> | undefined;
let cachedDatabaseEnv: z.infer<typeof databaseEnvSchema> | undefined;
let cachedCredentialEnv: z.infer<typeof credentialEnvSchema> | undefined;

export const getServerEnv = () => {
	cachedServerEnv ??= parseEnv(serverEnvSchema, process.env);
	return cachedServerEnv;
};

export const getEmbeddingEnv = () => {
	cachedEmbeddingEnv ??= parseEnv(embeddingEnvSchema, process.env);
	return cachedEmbeddingEnv;
};

export const getDatabaseEnv = () => {
	cachedDatabaseEnv ??= parseEnv(databaseEnvSchema, process.env);
	return cachedDatabaseEnv;
};

export const getCredentialEnv = () => {
	cachedCredentialEnv ??= parseEnv(credentialEnvSchema, process.env);
	return cachedCredentialEnv;
};

export const getLoginEnv = () => parseEnv(loginEnvSchema, process.env);
