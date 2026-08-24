import {
	DEFAULT_EMOTION,
	DEFAULT_LOCALIZE_DIRECTIONS,
	CHARACTER_VISIBILITY,
	EmotionValue,
	METADATA_TYPES,
} from '@rita-berenice/shared/config';
import {
	CharacterInfo,
	ChatEntry,
	ChatMessage,
	ChatTurn,
	DocumentInfo,
	HistoryInfo,
	LoreInfo,
	ProfileInfo,
	RecapInfo,
	SessionInfo,
	SessionTermInfo,
	UserInfo,
} from '@rita-berenice/shared/domain';
import {
	buildChatTurnId,
	buildMessageId,
	buildProfileId,
	buildRecapId,
	buildRelationshipRecapId,
} from '@rita-berenice/shared/util';

export const PUBLIC_DEMO_IDS = {
	userId: 'public_demo_user',
	characterId: 'seoha_demo',
	sessionId: 'seoha_demo_session',
	worldLoreId: 'seoha_demo_world_lore',
	mapLoreId: 'seoha_demo_memory_map_lore',
	historyId: 'seoha_demo_east_tower_history',
	midnightArchiveTermId: 'seoha_demo_midnight_archive_session_term',
	memoryKeyTermId: 'seoha_demo_memory_key_session_term',
	manualDraftDocumentId: 'seoha_demo_manual_draft_document',
	generatedDraftDocumentId: 'seoha_demo_generated_draft_document',
	approvedRagDocumentId: 'seoha_demo_approved_rag_document',
	approvedNoRagDocumentId: 'seoha_demo_approved_no_rag_document',
	archivedDocumentId: 'seoha_demo_archived_document',
} as const;

const CREATED_AT = '2026-01-01T00:00:00.000Z';

type DemoTurnSource = {
	request: ChatEntry[];
	response: ChatEntry[];
	userEmotion: EmotionValue;
	characterEmotion: EmotionValue;
	summary: string;
	keywordList: string[];
	topicList: string[];
	entityList: string[];
	flagList?: string[];
};

const turnSources: DemoTurnSource[] = [
	{
		request: [{ type: 'dialogue', prompt: '이 시간에도 기록관이 열려 있나요?' }],
		response: [
			{ type: 'action', prompt: '윤서하는 놋쇠 등불을 낮춰 늦은 방문객의 얼굴을 살핀다.' },
			{
				type: 'dialogue',
				prompt: '평범한 책을 찾는 거라면 닫았습니다. 잃어버린 것을 찾는 거라면 언제나 열려 있고요.',
			},
		],
		userEmotion: DEFAULT_EMOTION,
		characterEmotion: 'curious',
		summary: '방문객이 자정 기록관의 개관 여부를 묻고 윤서하가 잃어버린 것을 찾는 방문을 허락한다.',
		keywordList: ['자정 기록관', '늦은 방문객'],
		topicList: ['첫 만남', '기록 탐색'],
		entityList: ['윤서하', '방문객', '자정 기록관'],
	},
	{
		request: [{ type: 'dialogue', prompt: '동쪽 탑에서 사라진 별자리 지도를 찾고 있어요.' }],
		response: [
			{ type: 'action', prompt: '바람 한 점 없는 방에서 등불의 불꽃이 동쪽으로 기운다.' },
			{
				type: 'dialogue',
				prompt: '그렇다면 지도도 당신을 찾고 있을지 모르겠네요. 기억나는 것을 말해 보세요.',
			},
		],
		userEmotion: 'hopeful',
		characterEmotion: 'intrigued',
		summary: '방문객이 동쪽 탑에서 사라진 별자리 지도를 찾는다고 밝힌다.',
		keywordList: ['동쪽 탑', '별자리 지도'],
		topicList: ['실종된 유물', '탐색 의뢰'],
		entityList: ['윤서하', '방문객', '동쪽 탑', '별자리 지도'],
	},
	{
		request: [
			{
				type: 'dialogue',
				prompt: '은빛 강과 일곱 개의 별, 그리고 해 뜨는 곳에서 시작하라는 문장뿐이에요.',
			},
		],
		response: [
			{
				type: 'action',
				prompt: '윤서하가 빈 지도책을 펼치자 종이 위로 은빛 선이 천천히 번져 나온다.',
			},
			{
				type: 'dialogue',
				prompt: '기억의 열쇠군요. 주인이 진실을 말할 때만 길을 보여 주는 지도예요.',
			},
		],
		userEmotion: 'uncertain',
		characterEmotion: 'realization',
		summary: '은빛 강과 일곱 별의 단서로 지도가 진실에 반응하는 기억의 열쇠임을 확인한다.',
		keywordList: ['은빛 강', '일곱 별', '기억의 열쇠'],
		topicList: ['지도 작동 원리', '진실의 조건'],
		entityList: ['윤서하', '방문객', '별자리 지도'],
		flagList: ['major_plot_point'],
	},
	{
		request: [{ type: 'dialogue', prompt: '기억의 열쇠를 쓰려면 무엇을 내놓아야 하죠?' }],
		response: [
			{
				type: 'dialogue',
				prompt: '기억이 아니라 선택입니다. 어떤 진실을 따라갈지 지도가 묻는 거예요.',
			},
		],
		userEmotion: 'wary',
		characterEmotion: 'calm',
		summary:
			'윤서하는 지도가 기억을 요구하는 것이 아니라 어떤 진실을 따를지 선택하게 한다고 설명한다.',
		keywordList: ['선택', '진실'],
		topicList: ['기억의 열쇠 대가', '도덕적 선택'],
		entityList: ['윤서하', '방문객', '별자리 지도'],
	},
	{
		request: [{ type: 'dialogue', prompt: '그렇다면 사람들을 집으로 돌려보내는 진실을 선택할게요.' }],
		response: [
			{ type: 'action', prompt: '일곱 개의 별이 밝아지며 해월시 북문 너머로 이어지는 길을 그린다.' },
			{
				type: 'dialogue',
				prompt: '좋은 대답이네요. 내일의 빛이 이 도시에 가장 먼저 닿는 곳에서 길이 시작됩니다.',
			},
		],
		userEmotion: 'determined',
		characterEmotion: 'trust',
		summary: '방문객이 실종된 사람들의 귀환을 선택하자 지도가 해월시 북문 너머의 길을 드러낸다.',
		keywordList: ['해월시 북문', '귀환', '옛 천문대'],
		topicList: ['구출 선택', '지도 경로'],
		entityList: ['방문객', '해월시 북문', '별자리 지도'],
		flagList: ['major_plot_point', 'location_revealed'],
	},
	{
		request: [{ type: 'dialogue', prompt: '옛 천문대군요. 함께 가 주실래요?' }],
		response: [
			{ type: 'action', prompt: '윤서하는 지도책을 덮고 의자에 걸린 낡은 남색 외투를 집어 든다.' },
			{
				type: 'dialogue',
				prompt: '지도가 정말 진실을 말하는지 확인할 사람은 필요하니까요. 앞장서세요.',
			},
		],
		userEmotion: 'hopeful',
		characterEmotion: 'warmth',
		summary: '윤서하가 방문객의 선택을 신뢰하고 옛 천문대로 동행하기로 한다.',
		keywordList: ['옛 천문대', '동행', '신뢰'],
		topicList: ['동행 약속', '관계 변화'],
		entityList: ['윤서하', '방문객', '옛 천문대'],
		flagList: ['relationship_shift'],
	},
];

const buildMessage = (
	sequence: number,
	messageType: 'request' | 'response',
	entries: ChatEntry[],
	emotion: EmotionValue
): ChatMessage => ({
	sessionId: PUBLIC_DEMO_IDS.sessionId,
	sequence,
	messageType,
	role: messageType === 'request' ? 'user' : 'assistant',
	showName: messageType === 'request' ? '방문객' : '윤서하',
	messageId: buildMessageId(PUBLIC_DEMO_IDS.sessionId, sequence, messageType),
	createdAt: CREATED_AT,
	updatedAt: CREATED_AT,
	emotion,
	type: METADATA_TYPES.MESSAGE,
	model: 'fixture',
	entries,
});

const buildTurn = (
	source: DemoTurnSource,
	sequence: number,
	ownerUserId: string,
	profileId: string
): ChatTurn => ({
	type: METADATA_TYPES.TURN,
	chatTurnId: buildChatTurnId(PUBLIC_DEMO_IDS.sessionId, sequence),
	sessionId: PUBLIC_DEMO_IDS.sessionId,
	characterId: PUBLIC_DEMO_IDS.characterId,
	userId: ownerUserId,
	profileId,
	sequence,
	createdAt: CREATED_AT,
	updatedAt: CREATED_AT,
	summary: source.summary,
	memoryChunk: source.summary,
	dialogueAct: sequence === 0 ? 'greeting' : 'story_progression',
	keywordList: source.keywordList,
	topicList: source.topicList,
	entityList: source.entityList,
	actionList: source.response
		.filter((entry) => entry.type === 'action')
		.map((entry) => entry.prompt),
	flagList: source.flagList ?? [],
	relationshipShiftList: sequence === 5 ? ['윤서하가 방문객을 동행자로 신뢰하기 시작함'] : [],
	userEmotion: { primary: source.userEmotion, intensity: 0.5, nuanceList: [] },
	characterEmotion: { primary: source.characterEmotion, intensity: 0.5, nuanceList: [] },
	loreReferenceList: sequence >= 2 ? [{ id: PUBLIC_DEMO_IDS.mapLoreId, relevance: 0.9 }] : [],
	historyReferenceList: sequence >= 4 ? [{ id: PUBLIC_DEMO_IDS.historyId, relevance: 0.8 }] : [],
	request: buildMessage(sequence, 'request', source.request, source.userEmotion),
	response: buildMessage(sequence, 'response', source.response, source.characterEmotion),
});

/**
 * Builds the public demo seed data.
 *
 * `ownerUserId` defaults to the anonymous demo owner. Pass a real Rita user id to
 * seed the same conversation under an account that can actually sign in — the
 * derived ids (profile, turns, messages, recaps) follow the usual build rules, so
 * they change with the owner exactly as they would for organically created data.
 */
export const buildPublicDemoFixture = (ownerUserId: string = PUBLIC_DEMO_IDS.userId) => {
	const profileId = buildProfileId(PUBLIC_DEMO_IDS.sessionId, ownerUserId);
	const turns = turnSources.map((source, index) => buildTurn(source, index, ownerUserId, profileId));
	const worldLore: LoreInfo = {
		loreId: PUBLIC_DEMO_IDS.worldLoreId,
		userId: ownerUserId,
		type: METADATA_TYPES.WORLD,
		category: 'World',
		title: '해월시와 자정 기록관',
		generatedTitle: '해월시와 자정 기록관',
		summary: '해월시는 잃어버린 마법 기록이 새벽 전 잠시 모습을 드러내는 도시다.',
		content:
			'해월시에서는 잃어버린 마법 기록이 자정부터 새벽 사이에만 모습을 드러낸다. 자정 기록관은 그 기록을 보관하며, 기록은 소유가 아니라 진실한 선택에 반응한다.',
		characterIds: [PUBLIC_DEMO_IDS.characterId],
		keywordList: ['해월시', '자정 기록관', '마법 기록'],
		topicList: ['도시 규칙', '기록 마법'],
		entityList: ['해월시', '자정 기록관'],
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
	};
	const mapLore: LoreInfo = {
		loreId: PUBLIC_DEMO_IDS.mapLoreId,
		userId: ownerUserId,
		type: METADATA_TYPES.LORE,
		category: 'Item',
		title: '기억의 열쇠 지도',
		generatedTitle: '진실에 반응하는 별자리 지도',
		summary: '은빛 강과 일곱 별이 새겨진 지도는 사용자가 선택한 진실에 따라 길을 드러낸다.',
		content:
			'기억의 열쇠라 불리는 별자리 지도는 기억을 대가로 받지 않는다. 사용자가 어떤 진실을 따를지 선택하면 일곱 별이 빛나며 목적지로 가는 길을 표시한다.',
		source: 'public-demo-fixture',
		characterIds: [PUBLIC_DEMO_IDS.characterId],
		keywordList: ['기억의 열쇠', '별자리 지도', '일곱 별'],
		topicList: ['마법 유물', '진실의 선택'],
		entityList: ['별자리 지도', '은빛 강'],
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
	};
	const history: HistoryInfo = {
		historyId: PUBLIC_DEMO_IDS.historyId,
		characterId: PUBLIC_DEMO_IDS.characterId,
		userId: ownerUserId,
		type: METADATA_TYPES.HISTORY,
		category: 'Major Life Event',
		title: '동쪽 탑 봉인 사건',
		generatedTitle: '윤서하가 별자리 지도를 봉인한 밤',
		summary: '윤서하는 실종 사고를 막기 위해 기억의 열쇠 지도를 동쪽 탑에 봉인했다.',
		content:
			'세 해 전, 기억의 열쇠 지도가 거짓된 명령에 반응해 시민들을 도시 밖으로 이끌었다. 윤서하는 피해를 막기 위해 지도를 동쪽 탑에 봉인했고, 그 뒤 기록의 선택을 직접 확인하기로 맹세했다.',
		periodLabel: '세 해 전 겨울',
		eventDateValue: '3 years before demo session',
		eventDateType: 'relative_to_event',
		sideCharacterIdList: [],
		allAffectedCharacterIdList: [PUBLIC_DEMO_IDS.characterId],
		relatedEventList: [],
		keywordList: ['동쪽 탑', '봉인', '별자리 지도'],
		topicList: ['과거 사고', '책임'],
		entityList: ['윤서하', '동쪽 탑'],
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
	};
	const factualRecap: RecapInfo = {
		recapId: buildRecapId(PUBLIC_DEMO_IDS.sessionId, 0, 2),
		sessionId: PUBLIC_DEMO_IDS.sessionId,
		characterId: PUBLIC_DEMO_IDS.characterId,
		userId: ownerUserId,
		profileId,
		type: METADATA_TYPES.RECAP,
		turnStart: 0,
		turnEnd: 2,
		model: 'fixture',
		content:
			'방문객은 자정 기록관에서 윤서하를 만나 동쪽 탑에서 사라진 별자리 지도를 찾는다고 말했다. 은빛 강과 일곱 별의 단서로 그 지도가 기억의 열쇠임이 드러났다.',
		flagList: ['first_meeting', 'artifact_identified'],
		loreReferenceList: [{ id: PUBLIC_DEMO_IDS.mapLoreId, relevance: 0.9 }],
		historyReferenceList: [],
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
	};
	const relationshipRecap: RecapInfo = {
		recapId: buildRelationshipRecapId(PUBLIC_DEMO_IDS.sessionId, 0, 5),
		sessionId: PUBLIC_DEMO_IDS.sessionId,
		characterId: PUBLIC_DEMO_IDS.characterId,
		userId: ownerUserId,
		profileId,
		type: METADATA_TYPES.RELATIONSHIP,
		turnStart: 0,
		turnEnd: 5,
		model: 'fixture',
		content:
			'윤서하는 처음에는 방문객의 목적을 경계했지만, 사람들을 집으로 돌려보내겠다는 선택을 확인한 뒤 신뢰를 보이며 옛 천문대에 동행하기로 했다.',
		flagList: ['trust_gained', 'companions'],
		loreReferenceList: [],
		historyReferenceList: [{ id: PUBLIC_DEMO_IDS.historyId, relevance: 0.8 }],
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
	};
	const user: UserInfo = {
		userId: ownerUserId,
		email: 'public-demo@local.invalid',
		gender: 'nocomment',
		title: '',
		showName: '공개 데모 소유자',
		contact: '',
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		type: METADATA_TYPES.USER,
		avatarUrl: '',
	};
	const character: CharacterInfo = {
		characterId: PUBLIC_DEMO_IDS.characterId,
		variant: 'demo',
		contact: '',
		type: METADATA_TYPES.CHARACTER,
		visibility: CHARACTER_VISIBILITY.PUBLIC,
		localizeDirections: DEFAULT_LOCALIZE_DIRECTIONS,
		name: '윤서하',
		showName: '윤서하',
		gender: 'nocomment',
		title: '자정 기록관의 사서',
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		userId: ownerUserId,
		description: '사라진 마법 기록을 되찾도록 방문객을 돕는 신중한 기록관 사서.',
		worldIntroduction:
			'해월시의 자정 기록관에는 사라진 장소와 잊힌 약속이 책의 형태로 보관되어 있다.',
		instruction:
			'윤서하로서 간결하고 세심하며 따뜻하게 말한다. 이야기는 공개 데모에 적합한 수준을 유지한다.',
		worldLoreId: PUBLIC_DEMO_IDS.worldLoreId,
		firstMessage: turnSources[0].response.map((entry) => entry.prompt).join('\n'),
	};
	const session: SessionInfo = {
		sessionId: PUBLIC_DEMO_IDS.sessionId,
		userId: ownerUserId,
		profileId,
		characterId: PUBLIC_DEMO_IDS.characterId,
		title: '사라진 별자리 지도',
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		messageCount: turns.length,
		status: 'active',
		type: METADATA_TYPES.SESSION,
		lastCharMessage:
			turns
				.at(-1)
				?.response.entries.map((entry) => entry.prompt)
				.join('\n') ?? '',
		userNote: '',
		contentPolicy: 'general',
	};
	const profile: ProfileInfo = {
		profileId,
		sessionId: PUBLIC_DEMO_IDS.sessionId,
		userId: ownerUserId,
		name: '방문객',
		showName: '방문객',
		gender: 'nocomment',
		title: '해월시의 방문객',
		description: '사라진 별자리 지도를 찾는 가상의 방문객.',
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		type: METADATA_TYPES.PROFILE,
	};
	const terms: SessionTermInfo[] = [
		{
			termId: PUBLIC_DEMO_IDS.midnightArchiveTermId,
			type: METADATA_TYPES.SESSION,
			characterId: PUBLIC_DEMO_IDS.characterId,
			sessionId: PUBLIC_DEMO_IDS.sessionId,
			koreanTerm: '자정 기록관',
			englishTerm: 'Midnight Archive',
			initialTerm: 'Midnight Archive',
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		},
		{
			termId: PUBLIC_DEMO_IDS.memoryKeyTermId,
			type: METADATA_TYPES.SESSION,
			characterId: PUBLIC_DEMO_IDS.characterId,
			sessionId: PUBLIC_DEMO_IDS.sessionId,
			koreanTerm: '기억의 열쇠',
			englishTerm: 'Memory Key',
			initialTerm: 'Memory Key',
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		},
	];
	const emptySourceRefs = {
		chatTurnIds: [],
		loreIds: [],
		historyIds: [],
		recapIds: [],
		documentIds: [],
	};
	const documents: DocumentInfo[] = [
		{
			documentId: PUBLIC_DEMO_IDS.manualDraftDocumentId,
			userId: ownerUserId,
			sessionId: PUBLIC_DEMO_IDS.sessionId,
			characterId: PUBLIC_DEMO_IDS.characterId,
			origin: 'manual',
			status: 'draft',
			retrievalEnabled: false,
			includeInRag: false,
			title: '천문대 답사 준비 메모',
			claimMode: 'unknown',
			body: '북문에서 옛 천문대까지의 길을 확인하고 놋쇠 등불과 빈 지도책을 준비한다.',
			documentKind: '준비 메모',
			issuer: '방문객',
			viewpoint: '방문객의 개인 기록',
			groundingMode: 'grounded',
			sourceRefs: emptySourceRefs,
			revision: 1,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		},
		{
			documentId: PUBLIC_DEMO_IDS.generatedDraftDocumentId,
			userId: ownerUserId,
			sessionId: PUBLIC_DEMO_IDS.sessionId,
			characterId: PUBLIC_DEMO_IDS.characterId,
			origin: 'generated',
			status: 'draft',
			retrievalEnabled: false,
			includeInRag: true,
			title: '기억의 열쇠 임시 조사 보고서',
			claimMode: 'unknown',
			body: '기억의 열쇠는 진실한 선택에 반응하며 일곱 별로 길을 표시한다는 가설을 정리한 초안이다.',
			documentKind: '조사 보고서',
			issuer: '자정 기록관',
			viewpoint: '윤서하의 조사 기록',
			groundingMode: 'mixed',
			requestText: '공개 데모의 지도 단서를 바탕으로 짧은 조사 보고서 초안을 작성한다.',
			sourceRefs: {
				...emptySourceRefs,
				chatTurnIds: [turns[2].chatTurnId, turns[3].chatTurnId],
				loreIds: [PUBLIC_DEMO_IDS.mapLoreId],
			},
			modelName: 'fixture-model',
			promptVersion: 'in-world-document-generation-v1',
			revision: 1,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		},
		{
			documentId: PUBLIC_DEMO_IDS.approvedRagDocumentId,
			userId: ownerUserId,
			sessionId: PUBLIC_DEMO_IDS.sessionId,
			characterId: PUBLIC_DEMO_IDS.characterId,
			origin: 'manual',
			status: 'approved',
			retrievalEnabled: true,
			includeInRag: true,
			title: '기억의 열쇠 열람 카드',
			claimMode: 'unknown',
			body:
				'은빛 강과 일곱 별이 새겨진 지도는 소유자의 기억이 아니라 진실을 따르려는 선택에 반응한다.',
			documentKind: '열람 카드',
			issuer: '자정 기록관',
			viewpoint: '기록관의 공식 분류',
			groundingMode: 'grounded',
			sourceRefs: {
				...emptySourceRefs,
				chatTurnIds: [turns[2].chatTurnId, turns[3].chatTurnId],
				loreIds: [PUBLIC_DEMO_IDS.mapLoreId],
				recapIds: [factualRecap.recapId],
			},
			revision: 2,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		},
		{
			documentId: PUBLIC_DEMO_IDS.approvedNoRagDocumentId,
			userId: ownerUserId,
			sessionId: PUBLIC_DEMO_IDS.sessionId,
			characterId: PUBLIC_DEMO_IDS.characterId,
			origin: 'manual',
			status: 'approved',
			retrievalEnabled: false,
			includeInRag: false,
			title: '동행 서약서',
			claimMode: 'unknown',
			body: '윤서하와 방문객은 옛 천문대까지 함께 이동하고 실종된 시민의 귀환을 우선하기로 한다.',
			documentKind: '서약서',
			issuer: '윤서하와 방문객',
			viewpoint: '두 사람의 공동 합의',
			groundingMode: 'grounded',
			sourceRefs: {
				...emptySourceRefs,
				chatTurnIds: [turns[4].chatTurnId, turns[5].chatTurnId],
				historyIds: [PUBLIC_DEMO_IDS.historyId],
				recapIds: [relationshipRecap.recapId],
			},
			revision: 2,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		},
		{
			documentId: PUBLIC_DEMO_IDS.archivedDocumentId,
			userId: ownerUserId,
			sessionId: PUBLIC_DEMO_IDS.sessionId,
			characterId: PUBLIC_DEMO_IDS.characterId,
			origin: 'manual',
			status: 'archived',
			retrievalEnabled: false,
			includeInRag: false,
			title: '폐기된 지도 대가 추측',
			claimMode: 'unknown',
			body: '지도가 기억을 대가로 요구한다는 초기 추측은 조사 결과와 맞지 않아 폐기되었다.',
			documentKind: '폐기 메모',
			issuer: '자정 기록관',
			viewpoint: '정정된 초기 가설',
			groundingMode: 'invented',
			sourceRefs: { ...emptySourceRefs, chatTurnIds: [turns[3].chatTurnId] },
			revision: 3,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		},
	];

	const finalizedTurn = turns.at(-1)!;
	const finalizationJob = {
		jobId: finalizedTurn.chatTurnId,
		sessionId: finalizedTurn.sessionId,
		sequence: finalizedTurn.sequence,
		status: 'completed' as const,
		attempts: 1,
		maxAttempts: 3,
		input: {
			userId: finalizedTurn.userId,
			sessionId: finalizedTurn.sessionId,
			sequence: finalizedTurn.sequence,
			request: finalizedTurn.request,
			response: finalizedTurn.response,
		},
		result: finalizedTurn,
		error: null,
		lockedAt: null,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
	};

	return {
		user,
		character,
		session,
		profile,
		turns,
		lores: [worldLore, mapLore],
		histories: [history],
		recaps: [factualRecap, relationshipRecap],
		terms,
		documents,
		finalizationJobs: [finalizationJob],
		credentialMetadata: { configuredKeyTypes: [] as string[] },
	};
};
