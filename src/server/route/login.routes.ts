import { Router, Request, Response, NextFunction } from 'express';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { webcrypto } from 'node:crypto';
import { asyncHandler, genRoutePattern, validateRequestData } from '../util/routeHelpers.js'; // Assuming routeHelpers are in this path

const router = Router();

// Your public key can be stored as a constant within this module.
const publicKeyJwk = {
	key_ops: ['encrypt'],
	ext: true,
	kty: 'RSA',
	n: 'wZ-SZp5T0wxwhSZuZJOD4lUDLLYcnA-NsvY7nOXs5ZvnDT4VsHEYpIPvhRJpzkNnDsMmuGjFt_02UKnB9OasxGqLwJBqFCX2xviMzGTX2CAhKawp6NLZCKN6RWAyPasCezgx2JKT-nkfdH3paKRP2SIHLXDep9fD0thQaZLA5nUteypISVQITW3-1zOysL3r92FooDBeMfOmM0zr807ICQQNDc0BOH_R7atkVoqBoH3fi3pEyhUDQEl0hbOwY950XQ0A0IS0t0lu6B-8WLb2jaNbkkfs4e1DaMR2kNH1y_1ZKuWma2IZsh6T-zU4RF-b1B-8sH-LxGEg4A-fpwgguQ',
	e: 'AQAB',
	alg: 'RSA-OAEP-256',
};

/**
 * GET /public-key
 * Retrieves the public key needed for client-side encryption.
 */
router.get(
	genRoutePattern('getPublicKey'),
	asyncHandler(async (req: Request, res: Response) => {
		console.log(`API HIT: GET /api/login/get-public-key`);
		res.status(200).json(publicKeyJwk);
	})
);

/**
 * POST /login-asymmetric
 * Handles the secure login flow with an asymmetrically encrypted payload.
 */
router.post(
	genRoutePattern('loginAsymmetric'),
	asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
		validateRequestData(req.body, 'body', ['encryptedData']);
		const { encryptedData } = req.body;

		console.log(`API HIT: POST /api/login/login-asymmetric`);

		try {
			// 1. Get private key from environment
			if (!process.env.PRIVATE_KEY) {
				throw new Error('Server configuration error: PRIVATE_KEY is not set.');
			}
			const privateKeyJwk = JSON.parse(process.env.PRIVATE_KEY);
			const privateKey = await webcrypto.subtle.importKey(
				'jwk',
				privateKeyJwk,
				{ name: 'RSA-OAEP', hash: 'SHA-256' },
				true,
				['decrypt']
			);

			// 2. Decrypt the payload
			const encryptedBytes = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
			const decryptedBuffer = await webcrypto.subtle.decrypt(
				{ name: 'RSA-OAEP' },
				privateKey,
				encryptedBytes
			);

			const decryptedString = new TextDecoder().decode(decryptedBuffer);
			const { email, password } = JSON.parse(decryptedString);

			// 3. Call SuperTokens' original signIn function
			const response = await EmailPassword.signIn('public', email, password);

			// 4. Send the SuperTokens response back to the client
			return res.status(200).json(response);
		} catch (err) {
			// Forward errors to SuperTokens' error handler or your custom error middleware
			next(err);
		}
	})
);

export default router;
