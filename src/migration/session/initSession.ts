// Save this file as scripts/initSession.ts

import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { chromaDbClient, flatSessionToDoc, sessionStore } from '#server/index.js';
import { SessionInfo, SessionMetadata } from '#shared/domain/index.js';
import { buildProfileId, METADATA_TYPES } from '#shared/index.js';

const getTarionOriginalSessionTemplate = (): SessionInfo => {
	return {
		sessionId: 'tarion_original_fhTob3vkzxHF6tJc',
		userId: '6b335673-c837-43f9-a1c7-0b92c90edefb',
		profileId: buildProfileId(
			'tarion_original_fhTob3vkzxHF6tJc',
			'6b335673-c837-43f9-a1c7-0b92c90edefb'
		),
		characterId: 'tarion_original',
		title: `타리온 x 요니브`,
		createdAt: '2025-06-22T13:05:15.294Z',
		updatedAt: '2025-06-22T13:08:29.044Z',
		messageCount: 806,
		status: 'active',
		type: METADATA_TYPES.SESSION,
		lastCharMessage:
			'*그녀의 말은 타리온의 심장에 불을 지피는 것과 같았다. 왕관. 한때 그가 목숨 바쳐 지키려 했던 주군의 상징. 그러나 지금 그의 앞에는 그 모든 것을 뛰어넘는 존재, 그의 유일한 여왕이 있었다. 타리온의 푸른 눈이 이글거리는 욕망과 짙은 감정으로 번들거렸다. 그는 허리를 더욱 깊고 세차게 박아 넣었다. 침대가 삐걱거리며 요란한 소리를 냈고, 살이 부딪히는 소리는 방 안의 공기를 더욱 뜨겁게 달구었다.*\n\n*그녀가 절정을 향해 달려가는 것을 온몸으로 느끼며, 타리온 역시 한계에 다다르고 있었다. 그녀의 몸이 활처럼 휘고 가늘게 떨리는 것을 보며, 그는 마지막 남은 이성의 끈을 놓아버렸다. 그녀의 허리를 단단히 붙잡아 자신의 움직임에 온전히 따르게 만들었다. 그의 이마와 등줄기를 따라 땀이 비 오듯 흘러내렸다.*\n\n그래… 전부 네 안에. 내 모든 것을 너에게 줄게.\n\n*그의 목소리는 쾌감으로 잔뜩 잠겨 으르렁거리는 소리에 가까웠다. 그녀의 안을 가득 채운 자신의 것이 터질 듯이 팽창하는 감각에 그의 허리가 경련하듯 튀었다. 그는 그녀의 귓가에 입술을 묻고 거친 숨을 몰아쉬며 속삭였다.*\n\n나도… 더는 못 참아, 요니브. 같이 가자. 내 여왕.\n\n*타리온은 마지막으로 허리를 강하게 쳐올렸다. 그와 동시에 그녀의 몸이 크게 경련하며 뜨거운 경련을 일으키는 것이 느껴졌다. 그 자극에 이끌려 그 역시 뜨거운 정액을 그녀의 가장 깊은 곳에 쏟아내기 시작했다. 끝없이 밀려드는 해방감과 함께 그의 온몸의 근육이 수축했다. 그는 그녀의 몸 위로 무너지듯 쓰러져, 그녀의 어깨에 얼굴을 묻었다. 그의 심장이 터질 것처럼 격렬하게 뛰고 있었다.*\n\n*한동안 방 안에는 두 사람의 거친 숨소리만이 가득했다. 땀으로 흠뻑 젖은 몸이 서로에게 달라붙어 끈적거렸다. 타리온은 그녀의 몸에서 빠져나오지 않은 채, 그녀를 품에 가득 안았다. 그녀의 눈가에서 흐르는 눈물을 발견한 그는 부드럽게 손을 뻗어 닦아주었다. 그리고 젖은 눈꺼풀 위로 입을 맞추었다.*\n\n내 전부야. 너는.\n\n*그는 그녀의 몸 구석구석에 자신의 흔적이 새겨진 것을 만족스럽게 바라보았다. 목덜미와 어깨, 가슴에 선명한 자국들이 마치 그가 쟁취한 영토를 표시하는 깃발처럼 보였다. 그는 그녀의 귓불을 잘근거리며 나른하게 속삭였다.*\n\n이제 넌 완전히 내 것이야. 누구도 널 내게서 빼앗아갈 수 없어.',
	};
};

const getTarionSpinoffSessionTemplate = (): SessionInfo => {
	return {
		sessionId: 'tarion_spinoff_Oin8t5Lxbc8glaU7',
		userId: '6b335673-c837-43f9-a1c7-0b92c90edefb',
		profileId: buildProfileId(
			'tarion_spinoff_Oin8t5Lxbc8glaU7',
			'6b335673-c837-43f9-a1c7-0b92c90edefb'
		),
		characterId: 'tarion_spinoff',
		title: `타리온 x 요니브`,
		createdAt: '2025-07-06T17:05:05.115Z',
		updatedAt: '2025-07-06T17:15:53.965Z',
		messageCount: 2702,
		status: 'active',
		type: METADATA_TYPES.SESSION,
		lastCharMessage:
			'*그가 부른 이름은 허공에 흩어졌지만, 그녀의 잠꼬대는 그의 심장에 직접 내려앉았다. ‘응…’. 그 나지막한 소리는 단순한 잠꼬대 이상이었다. 그것은 그의 존재에 대한 무조건적인 긍정이었고, 경계심이라곤 찾아볼 수 없는 완전한 신뢰의 증표였다. 한때 적국의 기사단장과 후작의 딸이었던 두 사람이, 이제는 서로의 숨소리만으로도 위안을 얻는 사이가 되었다. 그는 그녀의 뺨에 머물렀던 손을 거두지 않고, 엄지손가락으로 부드러운 살결을 아주 천천히 쓸었다. 어젯밤, 그는 그녀의 품에서 다시 태어났다. 그리고 그녀 역시, 그의 탄생과 함께 ‘코릴리’로 다시 태어났음을, 그는 이 작은 응답 하나로 직감할 수 있었다.*\n\n*그는 미동도 없이 한참 동안 그녀의 잠든 얼굴을 바라보았다. 오두막 안은 고요했다. 간밤의 모닥불은 재만 남기고 사그라들었지만, 창문으로 쏟아지는 아침 햇살이 방 안을 따스하게 데우고 있었다. 밖에서는 이름 모를 새들이 지저귀는 소리가 들려왔다. 지독한 도망자의 아침이라고는 믿기지 않을 만큼 평화로운 풍경이었다. 그는 이 순간이 영원처럼 느껴지길 바랐다. 추격대의 칼날도, 제국의 분노도, 과거의 죄업도 모두 잊게 만드는 완벽한 평온. 오직 그와 그의 코릴리만이 존재하는 세상.*\n\n*그는 조심스럽게 몸을 일으켰다. 그녀가 깨지 않도록, 담요가 그녀의 몸에서 흘러내리지 않도록 세심하게 덮어주었다. 맨몸으로 침대에서 내려선 그는, 구석에 아무렇게나 던져져 있던 자신의 셔츠를 집어 들었다. 그리곤 다시 그녀의 곁으로 돌아와, 침대 가장자리에 걸터앉았다. 그의 시선은 여전히 그녀에게 고정되어 있었다. 그는 셔츠를 입는 대신, 그녀의 어깨 위로 조심스럽게 셔츠를 덮어주었다. 차가운 아침 공기에 그녀의 맨살이 닿지 않도록. 어젯밤 그가 남긴 붉은 흔적들이 셔츠 아래로 숨었다.*\n\n*모든 것이 새로웠다. 어제까지만 해도 ‘타리온’이었던 자신은 이제 없다. 후작가의 영애였던 ‘요니브’도 이제 없다. 그들은 서로를 위해 기꺼이 과거의 자신을 없애고, 서로의 곁에서 다시 태어났다. 클로드와 코릴리로. 그는 검게 물든 자신의 머리카락 한 올을 손가락으로 매만졌다. 어색했지만, 이것이 이제 자신의 모습이었다. 그녀의 남자, 클로드 시아누스.*\n\n*그는 몸을 숙여 잠든 그녀의 이마에 아주 가볍게 입을 맞추었다. 깃털이 스치듯 부드러운 입맞춤이었다. 그리고 그녀의 귓가에, 잠을 깨우지 않을 만큼 작은 목소리로 속삭였다.*\n\n자고 있어, 내 아내.\n\n*그는 자리에서 일어나, 오두막의 낡은 문을 향해 걸어갔다. 문고리를 잡기 전, 그는 마지막으로 침대에 누운 그녀를 돌아보았다. 햇살 아래 잠든 그녀의 모습은 성스럽기까지 했다. 그는 희미하게 미소 지으며 조용히 문을 열고 밖으로 나갔다. 새로운 삶의 첫날을 시작하기 위해서였다. 그녀가 깨어났을 때, 그녀의 남편으로서 무언가 준비해두고 싶었다.*',
	};
};

// --- Main Seeding Logic ---
async function initSession() {
	try {
		// Step 1: GET the collection directly.
		console.log(`Getting collection "${COLLECTIONS.SESSION}"...`);
		const collection = await chromaDbClient.getSessionCollection();

		// const sessionInfo = getTarionOriginalSessionTemplate();
		const sessionInfo = getTarionSpinoffSessionTemplate();

		// Step 4: Prepare the record for ChromaDB.
		// The document is the text to be embedded for semantic search.
		// The metadata holds all the filterable data.
		const document = flatSessionToDoc(sessionInfo);
		const metadata: SessionMetadata = {
			sessionId: sessionInfo.sessionId,
			userId: sessionInfo.userId,
			profileId: sessionInfo.profileId,
			characterId: sessionInfo.characterId,
			title: sessionInfo.title,
			createdAt: sessionInfo.createdAt,
			updatedAt: sessionInfo.updatedAt,
			messageCount: sessionInfo.messageCount,
			status: sessionInfo.status,
			type: sessionInfo.type,
		};

		// Step 5: Upsert the record directly into the collection.
		console.log(`Upserting session with predefined ID: ${sessionInfo.sessionId}...`);
		await chromaDbClient.upsertRecord(collection, sessionInfo.sessionId, document, metadata);

		console.log(`✅ Successfully seeded initial session.`);
		process.exit(0);
	} catch (error: any) {
		// Step 6: If anything fails, exit with a helpful error.
		console.error('❌ Error seeding initial session data:', error.message);
		console.error(
			'This likely means the collection does not exist or the provided characterId/profileId is invalid. Please run the admin creation script and ensure dependency records exist.'
		);
		process.exit(1);
	}
}

// --- Run the script ---
initSession();
