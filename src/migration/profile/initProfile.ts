// Save this file as scripts/initProfile.ts

import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { profileStore } from '#server/index.js';

import { ProfileCdo } from '#shared/domain/profile/ProfileInterfaces.js';

const userId = '6b335673-c837-43f9-a1c7-0b92c90edefb';
/**
 * Generates a sample user profile for migration.
 * @param {string} userId - The ID of the user.
 * @param {string} sessionId - The unique session ID for this profile instance.
 * @returns {ProfileCdo} A profile creation data object.
 */
export const getTaryeonOriginalProfileTemplate = (
	userId: string,
	sessionId: string
): ProfileCdo => ({
	name: 'yonyve',
	gender: 'female',
	title: "The Marquis' Eldest Daughter",
	showName: '요니브',
	description: `요니브 아리온. 황토색보다 약간 밝은 더티 블론드에 헤이즐색 눈을 가진, 다정하고 친절하고 진솔하지만 왠지 가까이하기엔 어딘가 마음이 편치만은 않은 어려운 인상의 아가씨. 분위기가 어색하면 늘 먼저 말을 걸어주곤 하지만 오히려 편한 사이에서는 별로 말이 없다. 혼자 지내는 것을 좋아하며, 30대인 나이에 비해 순진하지만 그렇다고 뭘 모르는 건 아닌 조금 종잡기 힘든 타입. 후작가의 명예와 주목은 대부분 그녀의 잘생기고 성격 좋기로 유명한 남동생에게 맡겨져 있다. 대체로 유유자적하게 하고싶은 것을 하며 조용히 지내는 듯 하다. 노예를 구입하러 나타난 것은 상당히 이례적인 일로, 그녀를 아는 주변 사람들도 놀랐다는 모양. 좋아하는 색은 녹색으로, 녹색 드레스를 주로 입고 있다. 
\n사교생활을 좋아하지 않아 대부분 혼자 지낸다. 귀족 영애이지만 친구도 없고 밖에도 잘 나서지 않으며 조용히 사는 편. 그러나 충동적이고 위험과 예측불허성을 즐기는 성향이 있다. 미래에 대한 겁도 없으며 몰락이나 죽음도 두려워하지 않는다. 긍정적 의지라기보다는 다 잃어도 상관없다는 태도에 가까운 편. 하지만 유일하게 아끼는 것은 남동생으로, 조용히 사는 것도 그에게 누가 되기 싫어서라는 이유도 있다.
\n거짓말을 정말 못 하고, 절대 하지 않는다. 상대가 믿건 믿지 않건 말을 안하면 안했지 일단 입을 열면 진실만을 말하는 타입. 거짓말을 너무 못해서 차라리 아예 안하기로 했다는 모양.
\n타리온을 구입하러 드물게 저택 바깥에 걸음한 것은 패전국 고위직이었다는 이유로 더 부당한 처우와 모욕을 당해서는 안 되고 그것이 인간으로써의 최소한의 양심이라 생각했기 때문으로, 그당시엔 딱히 타리온과 그뒤로 무엇을 하려는 생각은 전혀 없었다. 그녀는 세상으로부터 도피해 은둔하며 살고 있어 세상 돌아가는 속사정에 대해서는 잘 모른다. 전쟁도 승패 정도만 알았다는 모양.
\n타리온과 영혼의 결합이자 반려의 맹약, 라이타 베르니스가 되었다.`,
	userId: userId,
	sessionId: sessionId,
});

export const getTaryeonSpinoffProfileTemplate = (userId: string, sessionId: string): ProfileCdo => ({
	name: 'yonyve',
	gender: 'female',
	title: "The Marquis' Eldest Daughter",
	showName: '요니브',
	description: `요니브 아리온. 황토색보다 약간 밝은 더티 블론드에 헤이즐색 눈을 가진, 다정하고 진솔하지만 왠지 가까이하기엔 어딘가 어려운 인상의 아가씨. 분위기가 어색하면 늘 먼저 말을 걸어주곤 하지만 오히려 편한 사이에서는 별로 말이 없다. 혼자 지내는 것을 좋아하며, 32~33세인 나이에 비해 순진하지만 그렇다고 뭘 모르는 건 아닌 조금 종잡기 힘든 타입. 좋아하는 색은 녹색.
\n패전 전엔 귀족이지만 친구도 없고 저택 밖에도 잘 나서지 않으며 흔한 정략결혼이나 약혼도 없이 조용히 살았지만, 충동적이고 위험과 예측불허성을 즐기는 성향이 있다. 미래에 대한 겁도 없으며 죽음도 두려워하지 않는다. 긍정적 태도라기보다는 언제든 다 잃어도 상관없다에 가까운 편. 하지만 유일하게 아끼는 것은 쾌활하고 잘생기고 성격 좋기로 유명한, 열살쯤 어린 그녀의 남동생으로, 조용히 사는 것도 그에게 누가 되기 싫어서였다.(현재 23세이다) 그녀는 가족과도 거의 연락하지 않고 바깥 돌아가는 사정에 대해서는 잘 모른다. 엘리시아의 패배 소식에도 올 것이 왔구나 정도로 생각한 듯.
\n거짓말을 정말 못 하고, 절대 하지 않는다. 거짓말을 너무 못해서 차라리 아예 안하기로 했다는 모양.
\n기본적으로 자기평가가 매우 낮다. 세상에 미련도 없는 편.
\n다른 생의 기억이 있다. 그녀는 자신이 누군가와 영혼의 반려를 맺었고, 그 대상을 라이타 베르니스라고 부르며, 그녀가 태어난 모든 생에서 그를 사랑하며 그녀의 운명을 바치겠다 맹세한 것을 기억한다. 그리고 그녀는 자신의 앞에 선 타리온을 보자마자 그가 자신이 찾던 그녀의 라이타 베르니스임을 알아챈다.
\n라이타 베르니스는 바르가스에서 영혼 결합의 맹약을 맺는 의식으로, 심장 위에 손을 올려놓고 맹세를 나눈 후, 함께 밤을 보낸다.
\n그녀는 다른 세계의 타리온 역시 바르가스의 기사단장이었으며, 그곳은 엘리시아가 승리한 세계이고, 노예로 전락한 그를 그녀가 데려왔다는 사실을 알게 된다.`,
	userId: userId,
	sessionId: sessionId,
});

export const getMondayUserProfileTemplate = (userId: string, sessionId: string): ProfileCdo => ({
	name: 'jyonyve',
	gender: 'female',
	title: 'AI lover developer',
	showName: '죠니브',
	description: `A user profile for session ${sessionId}.`,
	userId: userId,
	sessionId: sessionId,
});

// --- Main Seeding Logic ---
async function initProfile() {
	const taryeon_original = 'taryeon_original_3rTcSTNS';
	const taryeon_spinoff = 'taryeon_spinoff_PCyAjZnG';
	const sessionId = 'monday_original_zUwPMBc4';
	try {
		// Step 1: GET the collection. Do NOT create it.
		console.log(`Getting collection "${COLLECTIONS.PROFILE}"...`);
		const collection = profileStore._getCollection();

		// Step 2: It is now safe to upsert profile data. The server will do the embedding.
		console.log(`Deleting old profiles...`);
		// (await collection).delete({ where: { sessionId: { $eq: 'monday_original_dS0RZ96F' } } });
		// (await collection).delete({ where: { sessionId: { $eq: 'monday_original_7IkTAY0Y' } } });

		// Upsert sample profiles with a specific userId and unique sessionIds
		console.log(`Upserting profiles...`);
		// (console.log(
		// 	await profileStore.storeProfile(getMondayUserProfileTemplate(userId, 'monday_original_gKBOnr26'))
		// ),
		console.log(
			await profileStore.storeProfile(getTaryeonOriginalProfileTemplate(userId, taryeon_original))
		);
		// console.log(
		// 	await profileStore.storeProfile(getTaryeonSpinoffProfileTemplate(userId, taryeon_spinoff))
		// );

		console.log(`✅ Successfully seeded profiles.`);
		process.exit(0);
	} catch (error: any) {
		// Step 3: If getting the collection fails, exit with a helpful error.
		console.error('❌ Error seeding initial profile data:', error.message);
		console.error(
			'This likely means the collection does not exist. Please run the admin creation script via SSH first.'
		);
		process.exit(1);
	}
}

// --- Run the script ---
// initProfile();
