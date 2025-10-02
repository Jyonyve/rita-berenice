// src/shared/util/cryptoUtils.ts

// Helper function to convert a Base64 string back to an ArrayBuffer (for the server)
const str2ab = (str: string): ArrayBuffer => {
	const buf = new ArrayBuffer(str.length);
	const bufView = new Uint8Array(buf);
	for (let i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
};

// Helper function to derive a key from your master secret.
const getDerivedKey = async (secret: string, salt: ArrayBuffer): Promise<CryptoKey> => {
	const crypto = globalThis.crypto.subtle; // Use globalThis for compatibility

	const keyMaterial = await crypto.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'PBKDF2' },
		false,
		['deriveKey']
	);

	return crypto.deriveKey(
		{ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);
};

/**
 * Encrypts plaintext. Call this function 'encryptValue'.
 * @param plaintext The string to encrypt (e.g., a user's password or API key).
 * @param secret The master secret key from an environment variable.
 * @returns A combined string "salt:iv:ciphertext" for transport and storage.
 */
export const encryptValue = async (plaintext: string, secret: string): Promise<string> => {
	const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
	const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

	const derivedKey = await getDerivedKey(secret, salt.buffer);

	const encryptedContent = await globalThis.crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		derivedKey,
		new TextEncoder().encode(plaintext)
	);

	const saltB64 = btoa(String.fromCharCode.apply(null, Array.from(salt)));
	const ivB64 = btoa(String.fromCharCode.apply(null, Array.from(iv)));
	const encryptedB64 = btoa(
		String.fromCharCode.apply(null, Array.from(new Uint8Array(encryptedContent)))
	);

	return `${saltB64}:${ivB64}:${encryptedB64}`;
};

/**
 * Decrypts the combined string. Call this function 'decryptValue'.
 * @param combined The "salt:iv:ciphertext" string.
 * @param secret The master secret key from an environment variable.
 * @returns The original plaintext string.
 */
export const decryptValue = async (combined: string, secret: string): Promise<string> => {
	const [saltB64, ivB64, encryptedB64] = combined.split(':');

	const salt = str2ab(atob(saltB64));
	const iv = str2ab(atob(ivB64));
	const encryptedContent = str2ab(atob(encryptedB64));

	const derivedKey = await getDerivedKey(secret, salt);

	const decryptedContent = await globalThis.crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		derivedKey,
		encryptedContent
	);

	return new TextDecoder().decode(decryptedContent);
};
