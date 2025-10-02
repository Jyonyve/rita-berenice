// Save this file as scripts/initUser.ts

import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { userStore } from '#server/index.js';
import { METADATA_TYPES, GENDER_OPTION } from '#shared/config/constants.js';
import type { UserInfo } from '#shared/domain/user/UserInterfaces.js';
import { m } from 'node_modules/react-router/dist/development/index-react-server-client-BKpa2trA.js';

// 1) Paste the Supertokens response here (or load from env/file).
const locale = {
	status: 'OK',
	user: {
		id: '6b335673-c837-43f9-a1c7-0b92c90edefb',
		isPrimaryUser: false,
		tenantIds: ['public'],
		timeJoined: 1754373334303,
		emails: ['nthpopuptown@gmail.com'],
		phoneNumbers: [],
		thirdParty: [],
		webauthn: { credentialIds: [] },
		loginMethods: [
			{
				tenantIds: ['public'],
				recipeUserId: '6b335673-c837-43f9-a1c7-0b92c90edefb',
				verified: false,
				timeJoined: 1754373334303,
				recipeId: 'emailpassword',
				email: 'nthpopuptown@gmail.com',
			},
		],
	},
};

const me = {
	status: 'OK',
	user: {
		id: 'dbce0624-7eb1-4e0f-85d2-d25333996992',
		isPrimaryUser: false,
		tenantIds: ['public'],
		timeJoined: 1754373334303,
		emails: ['nthpopuptown@gmail.com'],
		phoneNumbers: [],
		thirdParty: [],
		webauthn: { credentialIds: [] },
		loginMethods: [
			{
				tenantIds: ['public'],
				recipeUserId: 'dbce0624-7eb1-4e0f-85d2-d25333996992',
				verified: false,
				timeJoined: 1754373334303,
				recipeId: 'emailpassword',
				email: 'nthpopuptown@gmail.com',
			},
		],
	},
};

const invertedtriangle = {
	status: 'OK',
	user: {
		id: '1c8b61e6-a42c-4287-bb47-9bbafe6f52e6',
		isPrimaryUser: false,
		tenantIds: ['public'],
		timeJoined: 1756370994772,
		emails: ['nvtdtrngl@gmail.com'],
		phoneNumbers: [],
		thirdParty: [],
		webauthn: { credentialIds: [] },
		loginMethods: [
			{
				tenantIds: ['public'],
				recipeUserId: '1c8b61e6-a42c-4287-bb47-9bbafe6f52e6',
				verified: false,
				timeJoined: 1756370994772,
				recipeId: 'emailpassword',
				email: 'nvtdtrngl@gmail.com',
			},
		],
	},
};

const ativmort = {
	status: 'OK',
	user: {
		id: '531fe3c4-8737-48e7-9dd3-86a3f8098499',
		isPrimaryUser: false,
		tenantIds: ['public'],
		timeJoined: 1756861166571,
		emails: ['ativmort@gmail.com'],
		phoneNumbers: [],
		thirdParty: [],
		webauthn: { credentialIds: [] },
		loginMethods: [
			{
				tenantIds: ['public'],
				recipeUserId: '531fe3c4-8737-48e7-9dd3-86a3f8098499',
				verified: false,
				timeJoined: 1756861166571,
				recipeId: 'emailpassword',
				email: 'ativmort@gmail.com',
			},
		],
	},
};

// 3) Main Seeding Logic
async function initUser() {
	try {
		console.log(`Getting collection "${COLLECTIONS.USER}"...`);
		// Touch the getter to ensure the collection exists and is reachable.

		console.log(`Upserting user...`);
		await userStore.storeUser({ email: locale.user.loginMethods[0].email, userId: locale.user.id });

		// await userStore.storeUser({ email: me.user.loginMethods[0].email, userId: me.user.id });
		// await userStore.storeUser({
		// 	email: ativmort.user.loginMethods[0].email,
		// 	userId: ativmort.user.id,
		// });
		// await userStore.storeUser({
		// 	email: invertedtriangle.user.loginMethods[0].email,
		// 	userId: invertedtriangle.user.id,
		// });

		process.exit(0);
	} catch (error: any) {
		console.error('❌ Error seeding initial user:', error?.message ?? error);
		console.error(
			'This likely means the USER collection does not exist. Run the admin creation script on the ChromaDB cluster first.'
		);
		process.exit(1);
	}
}

// 4) Execute
initUser();
