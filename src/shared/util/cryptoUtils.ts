import crypto from 'crypto';

// --- Crypto Configuration ---
// !!! IMPORTANT: Store this key securely, NEVER commit it to Git !!!
// Load from environment variables or a secure configuration source.
const ENCRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';
// Use a fixed IV derived from the key for simplicity.
// **Security Warning:** Using a unique IV per encryption stored with the
// ciphertext (e.g., `iv:ciphertext`) is strongly recommended for production.
const IV_LENGTH = 16;
const iv = crypto
	.createHash('sha256')
	.update(String(ENCRYPTION_KEY))
	.digest()
	.subarray(0, IV_LENGTH);

// Check key validity on startup/load
if (!ENCRYPTION_KEY || Buffer.byteLength(ENCRYPTION_KEY, 'utf-8') < 32) {
	console.warn(
		'!!! WARNING: SECRET_ENCRYPTION_KEY environment variable is missing or less than 32 bytes. Secrets will NOT be encrypted securely. Please set a strong 32-byte (or longer) key. !!!'
	);
	// Consider throwing an error in production environments
	throw new Error('SECRET_ENCRYPTION_KEY is required and must be at least 32 bytes.');
}

const isEncryptionEnabled = (): boolean => {
	// Only enable if the key seems valid
	return !!ENCRYPTION_KEY && Buffer.byteLength(ENCRYPTION_KEY, 'utf-8') >= 32;
};

export function encrypt(text: string): string {
	if (!isEncryptionEnabled()) {
		console.warn('Encryption skipped: SECRET_ENCRYPTION_KEY is not configured correctly.');
		return text; // Return plaintext if key is invalid
	}

	try {
		const keyBuffer = Buffer.alloc(32, ENCRYPTION_KEY, 'utf-8'); // Ensure 32 bytes
		const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
		let encrypted = cipher.update(text, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		// console.log("Encrypted:", encrypted) // Debugging
		return encrypted; // Return hex string
	} catch (error) {
		console.error('Encryption failed:', error);
		throw new Error('Encryption process failed.'); // Re-throw specific error
	}
}

export function decrypt(encryptedText: string): string {
	if (!isEncryptionEnabled()) {
		console.warn('Decryption skipped: SECRET_ENCRYPTION_KEY is not configured correctly.');
		return encryptedText; // Return original text if key is invalid (might be plaintext)
	}

	try {
		// Check if the input looks like hex - basic validation
		if (!/^[0-9a-fA-F]+$/.test(encryptedText)) {
			console.warn('Attempted to decrypt non-hex string. Returning as is.');
			return encryptedText; // Likely wasn't encrypted
		}

		const keyBuffer = Buffer.alloc(32, ENCRYPTION_KEY, 'utf-8'); // Ensure 32 bytes
		const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
		let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		// console.log("Decrypted:", decrypted) // Debugging
		return decrypted;
	} catch (error) {
		console.error('Decryption failed. Input might be corrupted or using the wrong key.', error);
		// Decide how to handle: return original? return null? throw?
		// Returning original might expose encrypted data if caller doesn't check.
		// Throwing is safer but requires robust error handling by the caller.
		throw new Error('Decryption process failed. Data may be corrupted or key is incorrect.');
	}
}
