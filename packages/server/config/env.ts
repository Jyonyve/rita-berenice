import z from 'zod';

const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

const portSchema = z.coerce.number().int().min(1).max(65535);

const optionalNonEmptyStringSchema = z.preprocess(
	(value) => (value === '' ? undefined : value),
	z.string().min(1).optional()
);

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
	SUPERTOKENS_CONNECTION_URI: z.string().url().default('http://localhost:3567'),
	SUPERTOKENS_API_KEY: z.string().optional(),
	AUTH_IDENTITY_NAMESPACE: z.string().trim().min(1).default('supertokens-dev'),
	VITE_APP_DOMAIN: z.string().optional(),
	VITE_API_DOMAIN: z.string().optional(),
	LOCAL_IMAGE_STORAGE_DIR: z.string().min(1).default('public/assets'),
	DASHBOARD_ADMIN_EMAILS: commaSeparatedListSchema,
	RITA_RAG_TRACE: booleanStringSchema.default(false),
});

const embeddingEnvSchema = z.object({
	OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for embeddings'),
	OPENAI_EMBEDDING_MODEL: z
		.enum(['text-embedding-3-small', 'text-embedding-3-large'])
		.default('text-embedding-3-small'),
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

const imageStorageEnvSchema = z
	.object({
		BUCKET_NAME: optionalNonEmptyStringSchema,
		AWS_ENDPOINT_URL_S3: optionalNonEmptyStringSchema,
		AWS_ACCESS_KEY_ID: optionalNonEmptyStringSchema,
		AWS_SECRET_ACCESS_KEY: optionalNonEmptyStringSchema,
		AWS_REGION: z.string().min(1).default('auto'),
	})
	.superRefine((value, context) => {
		const requiredKeys = [
			'BUCKET_NAME',
			'AWS_ENDPOINT_URL_S3',
			'AWS_ACCESS_KEY_ID',
			'AWS_SECRET_ACCESS_KEY',
		] as const;
		const configuredCount = requiredKeys.filter((key) => value[key] !== undefined).length;

		if (configuredCount > 0 && configuredCount < requiredKeys.length) {
			context.addIssue({
				code: 'custom',
				message: `Object image storage requires ${requiredKeys.join(', ')}`,
			});
		}
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
let cachedImageStorageEnv: z.infer<typeof imageStorageEnvSchema> | undefined;

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

export const getImageStorageEnv = () => {
	cachedImageStorageEnv ??= parseEnv(imageStorageEnvSchema, process.env);
	return cachedImageStorageEnv;
};
