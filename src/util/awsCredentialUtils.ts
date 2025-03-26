import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { fromSSO } from '@aws-sdk/credential-provider-sso'; // Use SSO credentials provider

const BEDROCK_AWS_REGION = import.meta.env.VITE_BEDROCK_AWS_REGION || 'us-east-1';
const BEDROCK_AWS_PROFILE = import.meta.env.VITE_BEDROCK_AWS_PROFILE || '';
// Initialize the STS client
const stsClient = new STSClient({
	region: BEDROCK_AWS_REGION,
	credentials: fromSSO({ profile: BEDROCK_AWS_PROFILE }), // Use the SSO profile you configured
});

// Store AWS credentials (including Arn and Expiration)
let awsCredentials: (Credential & { Arn?: string; Expiration?: Date }) | null = null;

export const initializeAwsCredentials = async (): Promise<void> => {
	try {
		// Get the current identity (to check if the user is authenticated)
		const identity = await stsClient.send(new GetCallerIdentityCommand({}));
		console.log('Authenticated as:', identity.Arn);

		// Assume that SSO credentials will last for a certain period; adjust expiration accordingly
		const expirationTime = new Date();
		expirationTime.setHours(expirationTime.getHours() + 1); // Set expiration time to 1 hour from now

		awsCredentials = {
			Arn: identity.Arn,
			Expiration: expirationTime,
			...(await fromSSO({ profile: BEDROCK_AWS_PROFILE })()), // Use the credentials from the SSO profile
		};
	} catch (error) {
		console.error('Failed to authenticate:', error);
		throw new Error('Invalid AWS credentials');
	}
};

// Function to check if AWS credentials are expired
export const isAwsCredentialsExpired = (): boolean => {
	if (!awsCredentials || !awsCredentials.Expiration) return true;
	return new Date() >= awsCredentials.Expiration;
};

// Function to get AWS credentials (auto-refresh if expired)
export const getAwsCredentials = async (): Promise<
	Credential & { Arn?: string; Expiration?: Date }
> => {
	if (isAwsCredentialsExpired()) {
		console.log('AWS credentials expired. Re-authenticating...');
		await initializeAwsCredentials();
	}
	return awsCredentials!; // Return the current valid credentials
};
