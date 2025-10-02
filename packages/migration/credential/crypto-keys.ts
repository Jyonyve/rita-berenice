import { webcrypto } from 'node:crypto';

async function generateAndExportKeys() {
	const keyPair = await webcrypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
			hash: 'SHA-256',
		},
		true, // Can be extracted
		['encrypt', 'decrypt']
	);

	// Export the public key in JWK format (safe to share)
	const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);

	// Export the private key in JWK format (must be kept secret)
	const privateKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);

	console.log('--- PUBLIC KEY (safe to share) ---');
	console.log(JSON.stringify(publicKeyJwk));

	console.log('\n--- PRIVATE KEY (store as a Fly.io secret) ---');
	console.log(JSON.stringify(privateKeyJwk));
}

generateAndExportKeys();
