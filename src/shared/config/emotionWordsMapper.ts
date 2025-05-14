// src/shared/emotionWordsMapper.ts (Example path)

/**
 * Defines the mapping from image number index to associated emotion keywords.
 * Key: Image number (as referenced in filenames like ..._N.webp)
 * Value: Array of lowercase emotion keywords associated with that image.
 * IMPORTANT: Ensure keyword 'default' and/or 'neutral' maps to DEFAULT_IMAGE_NUMBER.
 *
 * Quick Reference - Number to Emotion Group (English):
 * 0: Default / Neutral / Calm
 * 1: Positive / Happy / Joyful
 * 2: Anger / Frustration
 * 3: Sadness / Worry / Grief
 * 4: Fear / Surprise / Shock
 * 5: Thinking / Confusion / Curiosity
 * 6: Affection / Love / Shyness
 * 7: Excitement / Eagerness
 * 8: Disgust / Contempt
 * 9: Pride / Confidence
 * 10: Shame / Guilt
 * 11: Awe / Wonder
 * 12: Boredom / Apathy
 * 13: Romance / Limerence
 *
 * 빠른 참조 - 숫자별 감정 그룹 (한국어):
 * 0: 기본 / 중립 / 차분함
 * 1: 긍정 / 행복 / 즐거움
 * 2: 분노 / 좌절
 * 3: 슬픔 / 걱정 / 비탄
 * 4: 공포 / 놀람 / 충격
 * 5: 생각 / 혼란 / 호기심
 * 6: 애정 / 사랑 / 수줍음
 * 7: 흥분 / 열정
 * 8: 혐오 / 경멸
 * 9: 자부심 / 자신감
 * 10: 수치심 / 죄책감
 * 11: 경외 / 경탄
 * 12: 지루함 / 무관심
 * 13: 로맨스 / 설렘
 */
export const numberToEmotionWordsMap = {
	// 0: Represents default, neutral, calm, or standard states. (기본 / 중립 / 차분함)
	0: [
		'default', // 기본
		'neutral', // 중립
		'normal', // 정상
		'standard', // 표준
		'calm', // 차분함
		'content', // 만족한
		'relaxed', // 편안한
		'at ease', // 마음 편한
		'peaceful', // 평화로운
		'satisfied', // 만족스러운
		'serene', // 고요한
		'composed', // 침착한
		'mellow', // 부드러운
		'placid', // 잔잔한, 차분한
		'tranquil', // 평온한
		'rested', // 푹 쉰
		// 'unconcerned', // 무관심한, 태평한
		'indifferent', // 무관심한
		'stoical', // 금욕적인, 냉정한
		'lethargic', // 무기력한
		'listless', // 무기력한, 마음 내키지 않는
		'subdued', // 차분해진, 가라앉은
		'pensive', // 생각에 잠긴, 수심 어린
		'unemotional', // 감정을 드러내지 않는
		'impassive', // 무표정한, 냉정한
		'dispassionate', // 감정에 좌우되지 않는, 공정한
		'even-tempered', // 온화한, 차분한 성격의
		'observant', // 관찰하는
		'still', // 고요한, 정지한
		'quiet', // 조용한
		// 'reflective', // 사색적인
		'mild', // 온화한
		'accepting', // 수용적인
		'patient', // 인내심 있는
		'sedate', // 차분한, 진정된
		'collected', // 침착한
		'undisturbed', // 방해받지 않은
		'untroubled', // 걱정 없는
	],

	// 1: Represents positive emotions such as joy, happiness, and elation. (긍정 / 행복 / 즐거움)
	1: [
		'happy', // 행복
		'glad', // 기쁜
		'pleased', // 기쁜, 만족한
		'joy', // 즐거움, 기쁨
		'joyful', // 매우 기쁜
		'cheerful', // 쾌활한, 발랄한
		'amused', // 재미있어하는
		'delighted', // 아주 기뻐하는
		'upbeat', // 낙천적인, 활기찬
		'bliss', // 더없는 행복
		'ecstatic', // 황홀해하는
		'elated', // 의기양양한, 매우 기뻐하는
		'euphoria', // (극도의) 행복감
		'exhilarated', // 아주 신나는, 들뜨는
		'glee', // 큰 기쁨, 환희
		'jubilation', // 환호, 매우 기뻐함
		'merry', // 명랑한, 즐거운
		'fulfilled', // 성취감을 느끼는
		'overjoyed', // 매우 기뻐하는
		'thrilled', // (흥분해서) 아주 신이 난
		'lighthearted', // 마음 편한, 명랑한
		'carefree', // 근심 없는, 속 편한
		'mirthful', // 유쾌한, 즐거운
		'rapturous', // 황홀해하는, 열광적인
		'gleeful', // 신이 난, 즐거운
		'perky', // 활기찬, 생기 넘치는
		'jovial', // 아주 쾌활한
		'blithe', // 태평스러운, 쾌활한
		'chipper', // 활기찬, 기운찬
		'buoyant', // 자신감에 넘치는,부력이 있는 (기분)
		'exuberant', // 열광적인, 활기 넘치는
		'sunny', // 명랑한, 쾌활한 (성격/기분)
		'festive', // 축제의, 흥겨운
		'thankful', // 고마워하는, 감사하는
		'blessed', // 축복받은, 더없이 행복한
		'fortunate', // 운이 좋은
		'relieved', // 안도하는
		'appreciative', // 고마워하는
		'hopeful', // 희망에 찬
		'optimism', // 낙관주의, 낙천주의
		'inspired', // 영감을 받은, 고무된
		'gratitude', // 감사, 고마움
		'grateful', // 고마워하는, 감사하는
		'radiant', // (행복감/건강 등으로) 빛나는, 환한
		'sparkling', // 반짝이는, 생기 넘치는
		'jubilant', // 매우 기뻐하는, 환희에 찬
		'exultant', // 크게 기뻐하는, 의기양양한
	],

	// 2: Represents anger and related negative emotions like frustration and irritation. (분노 / 좌절)
	2: [
		'angry', // 화난
		'mad', // (몹시) 화가 난
		'furious', // 몹시 화가 난, 격노한
		'irate', // 노한, 격앙된
		'annoyed', // 짜증이 난, 약이 오른
		'irritated', // 짜증이 난, 화가 난
		'frustration', // 좌절(감)
		'rage', // 격분, 격노
		'outraged', // 격분한
		'resentful', // 분개하는
		'bitter', // 쓰라린, 격렬한 (감정)
		'disapproval', // 못마땅함, 반감
		'hostile', // 적대적인
		'aggressive', // 공격적인
		'agitated', // (마음이) 뒤흔들린, 동요된
		'exasperation', // 격분, 분노
		'fury', // (격렬한) 분노, 격분
		'hatred', // 증오, 혐오
		'loathing', // 혐오(감)
		'offended', // 기분이 상한, 불쾌한
		'scorn', // 경멸, 멸시
		'spite', // 악의, 앙심
		'vengeful', // 복수심에 불타는
		'wrathful', // 격노한, 분노에 찬
		'grouchy', // 불평이 많은, 잘 투덜거리는
		'grumpy', // 성격이 나쁜, 까다로운
		'impatient', // 성급한, 안달하는 (patient의 반대)
		'testy', // 짜증을 잘 내는
		'defiant', // 반항적인, 저항하는
		'indignant', // 분개한, 분해 하는
		'vexed', // 성가신, 짜증나는
		'enraged', // 격분한
		'infuriated', // 극도로 화나게 만들다
		'displeased', // 불쾌한, 못마땅한
		'provoked', // (화를) 도발당한, 자극받은
		'sullen', // 시무룩한, 뚱한
		'petulant', // 심술을 부리는, 사소한 일에 잘 토라지는
		'cranky', // 짜증을 내는
		'irritable', // 짜증을 (잘) 내는, 화가 난
		'incensed', // 몹시 화난, 격분한
		'livid', // 격노한, 새파랗게 질린
		'fuming', // (화가 나서) 김이 오르는, 씩씩거리는
		'seething', // (분노로) 속이 끓어오르는
		'vindictive', // 앙심을 품은, 보복하려는
		'explosive', // 폭발적인 (성격)
		'miffed', // 약간 화가 난, 발끈한
		'peeved', // 짜증이 난, 화가 난
	],

	// 3: Represents sadness and related negative emotions like grief and worry. (슬픔 / 걱정 / 비탄)
	3: [
		'sad', // 슬픈
		'unhappy', // 불행한, 슬픈
		'sorrowful', // (매우) 슬픈, 비탄에 잠긴
		'depressed', // 우울한, 의기소침한
		'gloomy', // 우울한, 침울한
		'glum', // 침울한, 뚱한
		'melancholy', // (장기적이고 설명하기 힘든) 우울감, 비애
		'despair', // 절망(감)
		'hopeless', // 희망이 없는, 절망적인
		'heartbroken', // 비통해하는, 상심한
		'worried', // 걱정하는, 염려하는
		'anxious', // 불안해하는, 염려하는
		'nervous', // 초조한, 불안한
		'concerned', // 걱정하는, 염려하는
		'apprehensive', // 걱정되는, 불안한
		'blue', // 우울한 (기분)
		'dejected', // 낙담한, 기가 죽은
		'despondent', // 낙담한, 실의에 빠진
		'disappointed', // 실망한
		'discouraged', // 낙담한, 용기를 잃은
		'distressed', // (정신적으로) 괴로운, 고통스러운
		'forlorn', // 쓸쓸해 보이는, 황량한
		'lonely', // 외로운
		'misery', // (정신적·육체적으로 심한) 고통, 빈곤
		'pessimism', // 비관주의
		'regret', // 후회(하다)
		'remorse', // 회한, 후회
		'somber', // 어두침침한, 침울한
		'sulky', // 뚱한, 설키는
		'weary', // (몹시) 지친, 피곤한 (정신적으로)
		'woe', // 비통, 비애
		'anguish', // (극심한) 괴로움, 비통
		'suffering', // 고통, 괴로움
		'heavy-hearted', // 마음이 무거운, 슬픈
		'crestfallen', // 풀이 죽은, 의기소침한
		'downcast', // 풀이 죽은, 고개를 숙인
		'troubled', // 걱정스러운, 불안한
		'mournful', // 애절한, 슬픔에 잠긴
		'doleful', // 애절한, 슬픈
		'grief-stricken', // 비탄에 잠긴
		'disconsolate', // 암담한, 절망적인 (위로할 수 없을 정도로 슬픈)
		'lachrymose', // 눈물이 많은, 잘 우는
		'weepy', // 잘 우는, 눈물을 글썽이는
		'low-spirited', // 기운 없는, 풀 죽은
		'heartsick', // 상심한, 몹시 슬퍼하는
	],

	// 4: Represents fear and surprise, including shock and amazement. (공포 / 놀람 / 충격)
	4: [
		'fear', // 공포, 두려움
		'scared', // 무서워하는, 겁먹은
		'afraid', // 두려워하는, 무서워하는
		'terrified', // (몹시) 무서워하는, 겁먹은
		'panicked', // 공황 상태에 빠진
		'horror', // 공포(감), 경악
		'surprise', // 놀람, 뜻밖의 일
		'startled', // 깜짝 놀란
		'astonished', // 깜짝 놀란
		'shocked', // (정신적) 충격을 받은
		'alarmed', // 불안해하는, 깜짝 놀란
		'dread', // (끔찍한) 공포
		'frightened', // 겁먹은, 무서워하는
		'hysteria', // 히스테리, 극도의 흥분
		'intimidated', // (시키는 대로 하도록) 겁을 먹은, 위축된
		'jumpy', // 조마조마한, 신경이 날카로운
		'overwhelmed', // 압도된 (감정적으로)
		'petrified', // 극도로 무서워하는, 겁에 질린
		'shaken', // (충격·공포 등으로) 동요하는, 떨리는
		'speechless', // (너무 놀라) 말문이 막힌
		'stunned', // (놀람·충격으로) 망연자실한, 어리벙벙한
		'suspicion', // 의심, 혐의
		'tense', // 긴장한, 신경이 날카로운
		'uneasy', // (마음이) 불안한, 불편한
		'unnerved', // 불안하게 만들다, 기력을 잃게 하다
		'wary', // 경계하는, 조심하는
		'timid', // 소심한, 용기가 없는
		'dumbfounded', // (너무 놀라서) 말을 못 하는
		'flabbergasted', // (너무 놀라) 어안이 벙벙한
		'frozen', // (공포·놀람으로) 얼어붙은
		'trepidation', // (앞일에 대한 굉장한) 두려움, 공포
		'appalled', // 간담이 서늘한, 셔츠 입은
		'aghast', // (두려움이나 공포에 질려) 경악한, 겁에 질린
		'terror-stricken', // 공포에 질린
		'aflutter', // (흥분·초조함으로) 안절부절못하는, 가슴이 두근거리는
		'disquieted', // 불안한, 동요된
		'perturbed', // (마음이) 심란한, 동요된
		'daunted', // 겁먹은, 기가 죽은
		'timorous', // 겁이 많은, 소심한
		'spooked', // 겁먹은 (특히 유령 등에)
		'bewildered', // (너무 놀라) 어리둥절해진, 당혹한 (혼란보다는 놀람에 가까운)
		'jolted', // (갑자기 놀라거나 충격받아) 흔들린, 정신이 번쩍 든
	],

	// 5: Represents thinking, confusion, and curiosity, including doubt. (생각 / 혼란 / 호기심)
	5: [
		'thinking', // 생각 중
		'pondering', // 숙고하는
		'considering', // 고려하는
		'curious', // 호기심 많은, 궁금한
		'questioning', // 질문하는, 의문을 갖는
		'confused', // 혼란스러운
		'puzzled', // 어리둥절한, 당혹스러운
		'uncertain', // 불확실한
		'doubtful', // 의심스러운
		'skeptical', // 회의적인
		'realization', // 깨달음, 자각
		'ambivalent', // 양면 가치의, 태도가 불확실한
		'baffled', // 완전히 당황하게 만들다, 어리둥절하게 하다
		// 'bewildered' is in cat 4 (shock/surprise leaning), here for cognitive confusion
		'dazed', // (충격·피로 등으로) 멍한, 아찔한
		'disoriented', // 방향 감각을 잃은, 혼란스러운
		'hesitation', // 망설임, 주저
		'hesitant', // 망설이는, 주저하는
		'incredulous', // 믿기 어려운, 의심 많은
		'interest', // 관심, 흥미
		'intrigued', // 아주 흥미로워하는
		'perplexed', // (무엇을 이해할 수 없어) 당혹한
		'quizzical', // 묻는 듯한, 의아해하는, 약간 놀란 듯한
		'speculative', // 추측에 근거한, 사색적인
		'wondering', // 궁금해하는, 이상하게 생각하는
		'analytical', // 분석적인
		'contemplative', // 사색적인, 명상적인
		'deliberating', // 숙고하는, 신중히 생각하는
		'examining', // 조사하는, 검토하는
		'inquisitive', // 꼬치꼬치 캐묻는, 탐구심이 많은
		'investigating', // 조사하는, 수사하는
		'meditative', // 명상적인, 명상에 잠긴
		'musing', // 사색하는, 골똘히 생각하는
		'reflective', // 사색적인 (also in Cat 0 for calm reflection, here for active thought)
		'studying', // 연구하는, 공부하는
		'abstracted', // (딴 생각에 빠져) 멍한
		'preoccupied', // (다른 생각·걱정에) 사로잡힌, 몰두한
		'engrossed', // 몰두한
		'ruminating', // 심사숙고하는, 반추하는
		'daydreaming', // 공상에 잠긴
		'grasping', // 이해하려는, 파악하려는
		'discovering', // 발견하는
		'exploring', // 탐험하는, 탐구하는
	],

	// 6: Represents affection, love, and shyness, including care and empathy. (애정 / 사랑 / 수줍음)
	6: [
		'love', // 사랑
		'affectionate', // 다정한, 애정 어린
		'caring', // 배려하는, 보살피는
		'fond', // (…을) 좋아하는, 다정한
		'loving', // 사랑하는, 애정 어린
		'shy', // 수줍어하는, 부끄럼을 타는
		'bashful', // 수줍음을 타는
		'embarrassed', // (사회적으로) 쑥스러운, 어색한, 당황스러운
		'blushing', // 얼굴을 붉히는
		'flustered', // (특히 너무 많은 일로) 허둥지둥하게 만들다, 당황한
		// 'adoration', // 흠모, 경배
		'compassion', // 연민, 동정심
		'empathy', // 공감, 감정 이입
		'kindness', // 친절함
		'tenderness', // 다정함, 부드러움
		'warmth', // 따뜻함, 온정
		// 'devotion', // 헌신, 전념 (사람에 대한)
		'trust', // 신뢰, 믿음
		'admiration', // 감탄, 칭찬
		'benevolence', // 자비심, 선행
		'cherish', // 소중히 여기다, 아끼다
		'comfort', // 위안, 안락
		'connection', // 유대감, 관계
		'endearment', // 애정 표현, 귀여움
		'friendliness', // 다정함, 우호적임
		'gentle', // 부드러운, 온화한
		'intimacy', // 친밀함
		'kinship', // 친족 관계, 유대감
		'platonic', // 플라토닉한, 정신적인 사랑의
		'protectiveness', // 보호하려는 마음
		'sweet', // 다정한, 사랑스러운
		'sympathy', // 동정(심), 연민, 공감
		'unity', // 일체감, 결속
		'attachment', // 애착
		'tenderminded', // 마음이 여린, 다정한
		'solicitude', // 배려, 염려 (애정에서 비롯된)
		'rapport', // (친밀한) 관계
		'considerate', // 사려 깊은
		'receptive', // 수용적인 (마음을 여는)
		'approachable', // 다가가기 쉬운, 친근한
		'graceful', // 우아한 (행동/태도에서 비롯된 호감)
	],

	// 7: Represents excitement, eagerness, and enthusiasm, including desire. (흥분 / 열정)
	7: [
		'excited', // 신이 난
		'eager', // 열망하는
		'enthusiastic', // 열정적인
		'energetic', // 활기 넘치는
		'desire', // 욕구, 갈망 (흥분과 연결된)
		'anticipation', // 기대(감)
		'arousal', // 각성, 흥분
		'driven', // 의욕적인, 추진력 있는
		'fervent', // 열렬한
		'fiery', // 불같은, 열정적인
		'impassioned', // 열정적인, 간절한
		'keen', // 열심인, 예리한 (열정)
		'motivated', // 동기 부여된
		'vibrant', // 활기찬, 생생한
		'zeal', // 열의, 열성
		'zestful', // 열정적인, 흥미를 가진
		'playful', // 장난기 있는, 재미있어 하는
		'animated', // 활기찬, 생기 있는
		'expectant', // 기대에 찬
		'ardent', // 열렬한, 열심인
		'avid', // 열심인, 열렬한
		'buzzing', // (흥분·활기 등으로) 웅성거리는, 활기찬
		'dynamic', // 역동적인, 활발한
		'fervor', // 열정, 열렬함
		'giddy', // (너무 좋아서) 아찔한, 들뜬
		'gung-ho', // 매우 열성적인
		'hyper', // (비정상적으로) 활동적인, 흥분한
		'impatience', // 조급함, 참을 수 없음 (열망으로 인해)
		'intense', // 강렬한 (감정)
		'lively', // 활기찬, 생기 넘치는
		'pumped', // (몹시) 흥분한, 기대에 찬
		'ravenous', // 몹시 굶주린 (갈망의 표현)
		'ready', // 준비된 (무언가를 하고 싶어)
		'restless', // (지루하거나 걱정되어) 가만히 못 있는, 들뜬
		'amped', // (속어) 몹시 흥분한
		'charged', // (감정·분위기가) 격앙된, 긴장된
		'agog', // (흥분하여) (~하고 싶어) 못 견디는, 들뜬
		'ebullient', // 열광적인, 의기양양한
		'fervid', // 열렬한, 강렬한
		'flushed', // (흥분·당황 등으로) 얼굴이 빨개진
		'frisky', // 활기찬, 기운 넘치는 (놀고 싶어 하는)
		'impetuous', // 충동적인, 성급한 (열정에서 비롯된)
		'passionate', // 열정적인
		'raring', // (~하고 싶어) 못 견디는, 열망하는
		'stimulated', // 자극받은, 흥미를 느낀
		'stirred', // (감정이) 동요된, 마음이 움직인
		'zealous', // 열성적인
	],

	// 8: Represents disgust, contempt, and revulsion, including dislike. (혐오 / 경멸)
	8: [
		'disgust', // 혐오(감)
		'disgusted', // 혐오감을 느끼는
		'repulsed', // 역겨움을 느끼는
		'sickened', // (역겨워서) 메스꺼운, 진력이 난
		'contempt', // 경멸, 멸시
		'scornful', // 경멸[멸시]하는
		'disdainful', // 업신여기는, 무시하는
		'abhorrence', // 혐오
		'aversion', // 아주 싫어함, 혐오감
		'critical', // 비판적인, 비난하는 (경멸적 뉘앙스)
		'cynical', // 냉소적인
		'derision', // 조롱, 조소
		'dislike', // 싫어함, 반감 (강한 경우)
		'distaste', // 불쾌감, 혐오감
		'judgmental', // 비판[비난]을 잘하는 (경멸적 뉘앙스)
		'nauseated', // 메스꺼운, 욕지기나는
		'rejection', // 거부, 거절 (경멸을 담아)
		'revulsion', // 혐오감, 역겨움
		'sarcastic', // 비꼬는, 풍자적인
		'antipathy', // (강한) 반감, 혐오
		'condescending', // 거들먹거리는, 잘난 체하는
		'disdain', // 경멸(감), 무시
		'displeasure', // 불쾌감, 불만 (강한 혐오로 이어질 때)
		'haughty', // 거만한, 오만한
		'insolent', // 오만불손한, 무례한
		'mocking', // 조롱하는, 비웃는
		'patronizing', // 생색내는 듯한, 깔보는 듯한
		'queasy', // (속이) 메스꺼운, 불편한 (역겨움으로)
		'repugnance', // (강한) 혐오감, 반감
		'sneering', // 비웃는, 조롱하는
		'sour', // 시큰둥한, 기분이 언짢은 (경멸적 태도)
		'uppity', // 건방진, 거만한
		'abominating', // 혐오하는, 증오하는
		'contemptuous', // 경멸하는, 업신여기는
		'derisive', // 조롱[조소]하는
		'detestation', // 몹시 싫어함, 혐오
		'disparaging', // 얕보는, 험담하는
		'fastidious', // 꼼꼼한, 까다로운 (타협 없는 기준에서 오는 혐오감)
		'invidious', // 부당한, 남의 시기/분노를 살 만한 (경멸 유발)
		'odium', // 증오, 악평 (광범위한 혐오)
		'opprobrium', // (맹)비난, 불명예 (경멸의 대상)
		'rebuffing', // 퇴짜 놓는, 거절하는 (경멸적으로)
		'repellent', // 역겨운, 혐오감을 주는
		'reprehending', // 질책하는, 비난하는 (경멸을 담아)
		'ridiculing', // 비웃는, 조롱하는
		'sardonic', // 냉소적인, 비웃는
		'scathing', // (비판이) 통렬한, 가차 없는
		'scoffing', // 비웃는, 조소하는
		'supercilious', // 거만한, 남을 얕보는
		'surly', // 퉁명스러운, 무례한 (경멸을 담을 수 있음)
		'vilifying', // 비방하는, 헐뜯는
		'grossed out', // 몹시 역겨워하는
	],
	// 9: Represents pride, confidence, and smugness. (자부심 / 자신감)
	9: [
		'pride', // 자부심, 자랑스러움
		'confident', // 자신감 있는
		'assured', // 자신감 있는, 확신에 찬
		'smug', // 의기양양한, 우쭐해하는
		'triumphant', // 크게 성공한, 의기양양한
		'arrogant', // 오만한 (지나친 자신감)
		'boastful', // 뽐내는, 자랑하는
		'cocky', // (비격식) 자만심에 찬
		'hubris', // 자만심, 오만 (문예체)
		'self-assured', // 자기 확신에 찬
		'superior', // 우월감을 느끼는, 우수한
		'victorious', // 승리한, 성공한
		'assertive', // 적극적인, 확신에 찬
		'bold', // 대담한, 용감한
		'brave', // 용감한
		'courageous', // 용감한
		'daring', // 대담한, 위험을 무릅쓰는
		'determined', // 단호한, 결연한
		'dignified', // 위엄 있는, 품위 있는
		'empowered', // 권한을 부여받은, 자신감을 갖게 된
		'fearless', // 두려움을 모르는, 용감무쌍한
		// 'graceful' is in cat 6, here refers to confident poise
		'heroic', // 영웅적인, 용감한
		'honorable', // 존경할 만한, 명예로운
		'independent', // 독립적인, 자립적인
		'majestic', // 장엄한, 위풍당당한
		'poised', // 침착한, 균형 잡힌
		'powerful', // 강력한, 영향력 있는
		'regal', // 제왕 같은, 위풍당당한
		'resolute', // 단호한, 굳게 결심한
		'self-reliant', // 자립적인
		'self-respect', // 자존감, 자존심
		'stately', // 위풍당당한, 품격 있는
		'strong', // 강한 (정신적으로)
		'unflappable', // (곤경에서도) 흔들림 없는, 침착한
		'valiant', // 용맹한, 씩씩한
		'audacious', // 대담한, 겁 없는
		'authoritative', // 권위 있는, 위압적인
		'commanding', // 위풍당당한, 지휘하는
		'dauntless', // 불굴의, 대담한
		'exalted', // 고귀한, 지위가 높은, 의기양양한
		'gallant', // 용감한, 당당한
		'grand', // 웅장한, 당당한
		'imperious', // 오만한, 고압적인
		'indomitable', // 불굴의, 꿋꿋한
		'self-possessed', // 침착한, 냉정을 잃지 않는
		'spirited', // 기백 있는, 활기찬 (cat 1, 7 for joy/excitement, here for confident energy)
		'stalwart', // 충실한, 굳건한
		'unyielding', // 굽히지 않는, 단호한
		'vainglorious', // 자만심이 강한, 허영심 강한
		'venturesome', // 모험을 좋아하는, 대담한
	],

	// 10: Represents shame, guilt, and humiliation. (수치심 / 죄책감)
	10: [
		'ashamed', // 부끄러워하는, 창피한
		'guilt', // 죄책감
		'humiliation', // 굴욕, 창피
		// 'embarrassment' is in cat 6 for social awkwardness, here for deeper shame
		'mortified', // 몹시 당황한, 굴욕감을 느끼는
		'regretful', // 후회하는
		'remorseful', // 깊이 후회하는, 양심의 가책을 받는
		'self-conscious', // 남의 시선을 의식하는 (부정적 의미로)
		'sheepish', // (잘못을 저질러) 멋쩍은, 당황한
		'worthless', // 가치 없는 (자신에 대해)
		'abashed', // 창피한, 무안한
		'apologetic', // 미안해하는, 사과하는
		'contrite', // 깊이 뉘우치는
		'demeaned', // 품위를 손상당한, 비하된
		'disgraced', // 망신당한, 불명예스러운
		'hangdog', // 풀 죽은, 죄 지은 듯한
		'humbled', // 겸허해진 (실수나 잘못으로 인해)
		'inferior', // 열등감을 느끼는
		'insecure', // 불안정한, 자신이 없는 (실수/죄책감에서 비롯)
		'meek', // 온순한, 유순한 (자신감 부족, 죄책감 연관)
		'penitent', // 참회하는, 뉘우치는
		'self-blame', // 자책
		'self-critical', // 자기 비판적인 (부정적)
		'self-deprecating', // 자기 비하적인
		'shamefaced', // 부끄러운 표정의, 창피해하는
		'submissive', // 순종적인, 복종적인 (죄책감/수치심으로 인해)
		'vulnerable', // 취약한 (죄책감/수치심으로 인해 약해진 상태)
		'chagrined', // 원통한, 분한 (실망이나 창피함으로)
		'compunction', // 양심의 가책
		'culpable', // 과실이 있는, 비난받을 만한
		'defamed', // 명예를 훼손당한
		'degraded', // 지위[품위]가 떨어진, 비하된
		'discomfited', // (계획·목표 달성에) 실패하여 당황한, 좌절된
		'ignominious', // 불명예스러운, 수치스러운
		'obsequious', // 아부하는, 비굴한 (죄책감/두려움에서 비롯될 수 있음)
		'reproachful', // 비난[책망]하는 듯한 (자신이나 타인에게)
		'rueful', // 후회하는, 슬픈 듯한
		'scandalized', // (충격적인 일에) 격분한, 모욕감을 느낀
		'self-reproach', // 자기 질책
		'tainted', // 더럽혀진, 오염된 (명예 등)
		'unworthy', // (~할) 가치가 없는, 자격이 없는
		// 'crestfallen', // 풀이 죽은 (실망/수치심으로 Cat 3에도 있지만 뉘앙스 다름)
	],

	// 11: Represents Awe and Wonder. (경외 / 경탄)
	11: [
		'awe', // 경외감
		'wonder', // 경이로움, 놀라움 (긍정적)
		'amazement', // (크나큰) 놀라움, 경탄
		'astonishment', // (믿기 어려울 정도의) 놀라움, 경탄 (Cat 4 for shock, here for profound wonder)
		'reverence', // 숭고함, 경외(심)
		'inspiration', // 영감 (경외감에서 비롯된)
		'marvel', // 경이(로운 사람·것), 경탄하다
		'fascination', // 매혹, 매료
		'intrigue', // 강한 흥미, 호기심 (경이로움에 대한)
		'enchantment', // 황홀감, 마법에 걸린 듯한 상태
		'respect', // 존경(심) (경외감의 일부)
		// 'admiration', // 감탄, 숭배 (Cat 6 for affection, here for profound respect/wonder)
		'transcendence', // 초월, 초월적임
		'sublime', // 숭고한, 장엄한
		'grandeur', // 장엄함, 위엄
		'majesty', // 장엄함, 위풍당당함 (Cat 9 for pride, here for awe-inspiring quality)
		'veneration', // 존경, 숭배
		'rapture', // 황홀(감), 환희 (Cat 1 for joy, here for overwhelming wonder)
		'spellbound', // 마법에 걸린 듯한, 넋을 잃은
		'mesmerized', // 매혹된, 최면에 걸린 듯한
		// 'captivated', // 마음을 사로잡힌
		'awestruck', // 경외감에 휩싸인
		'dumbstruck', // (놀라서) 말문이 막힌 (Cat 4 for shock, here for awe)
		'overawed', // (경외감으로) 압도된
		'profound', // (감정·경험 등이) 깊은, 심오한
		'ethereal', // 천상의, 영적인 (아름다움)
		'numinous', // 신비로운, 초자연적인 (경외감 유발)
		'miraculous', // 기적적인
		'breathtaking', // (너무 아름답거나 놀라워서) 숨이 막힐 듯한
		'uplifted', // (기분·정신이) 고양된, 희망에 찬
		'visionary', // 환영의, 예지력 있는 (경이로운 통찰)
		'cosmic', // 우주의, 장대한 (경외감을 주는 규모)
		'beatific', // 더없이 행복해 보이는, 기쁨이 넘치는 (종교적 경외감)
		'reverent', // 숭배하는, 경건한
		'solemnity', // 장엄, 엄숙 (경외감을 동반)
	],

	// 12: Represents Boredom and Apathy. (지루함 / 무관심)
	12: [
		'boredom', // 지루함, 따분함
		'apathy', // 무관심, 냉담
		'indifference', // 무관심 (Cat 0 for neutral, here for lack of interest)
		'ennui', // 권태감, 따분함
		'lethargy', // 무기력(증) (Cat 0 for neutral, here for lack of drive)
		'listlessness', // 무기력함, 마음 내키지 않음 (Cat 0 for neutral, here for active disinterest)
		'uninterested', // 무관심한, 흥미 없는
		'monotony', // 단조로움, 지루함
		'tedium', // 지루함, 권태
		'dullness', // 따분함, 재미없음
		'passivity', // 수동성, 소극적임
		'unconcern', // 무관심, 냉담 (Cat 0 for neutral, here for lack of care)
		'disinterest', // 무관심, 흥미 없음
		'stagnation', // 침체, 정체
		'blasé', // (이미 익숙해서) 심드렁한, 무관심한
		'detached', // 거리를 두는, 무심한
		'disengaged', // 관계를 끊은, 흥미를 잃은
		'spiritless', // 기운 없는, 활기 없는
		'weariness', // 피로, 권태 (Cat 3 for sadness, here for boredom-induced fatigue)
		'jaded', // (과로나 과도한 경험으로) 지친, 물린
		'languor', // 나른함, 무기력
		'melancholic', // 우울한 (Cat 3 for sadness, here for apathy-related low mood)
		'nonchalant', // 무관심한, 태연한
		'passive', // 수동적인, 소극적인
		'phlegmatic', // 침착한, 냉정한 (Cat 0 for calm, here for unresponsive/apathetic)
		'resignation', // 체념 (Cat 0 for calm acceptance, here for giving up from boredom/apathy)
		'sluggish', // 둔한, 활력 없는
		'torpor', // 무기력, 활기 없음
		'uninspired', // 영감 없는, 재미없는
		'vacant', // (표정 등이) 멍한, 생각 없는
		'world-weary', // 세상사에 지친, 염세적인
		'apathetic', // 무감각한, 냉담한
		'humdrum', // 단조로운, 따분한
		'insipid', // 재미없는, 맛없는 (비유적)
		'lackadaisical', // 부주의한, 태만한, 활기 없는
		'mechanical', // 기계적인, 감정 없는
		'mundane', // 평범한, 재미없는
		'tepid', // 미지근한, 열의 없는
		'unresponsive', // 무반응의, 냉담한
	],

	// 13: Represents Romance and Limerence. (로맨스 / 설렘)
	13: [
		'romance', // 로맨스, 연애
		'limerence', // (강렬한) 연애 감정, 설렘 (특히 초기)
		'infatuation', // (일시적인) 열정, 심취 (Cat 6 for general affection, here specifically romantic)
		'passion', // 열정 (Cat 6 for general, Cat 7 for excitement, here for romantic intensity)
		'adoration', // 흠모, 열애 (Cat 6 for general, here specifically romantic)
		'affection', // 애정 (Cat 6 for general, here specifically romantic)
		'attraction', // (성적) 매력, 끌림
		'yearning', // 갈망, 동경 (Cat 6 for general, here for romantic partner)
		'longing', // 갈망, 열망 (Cat 6 for general, here for romantic partner)
		// 'desire', // (성적) 욕구, 갈망 (Cat 7 for general, here for romantic partner)
		// 'tenderness', // 다정함, 부드러움 (Cat 6 for general, here in romantic context)
		'sentimentality', // 감상, 정감 (로맨틱한)
		'courtship', // 구애
		'flirtation', // 희롱, 추파, 가벼운 연애
		'ardor', // 열정, 열렬함 (로맨틱한)
		'devotion', // 헌신 (Cat 6 for general, here to a romantic partner)
		'smitten', // (~에게) 홀딱 반한
		'enamored', // (~에게) 반한, 매혹된
		'besotted', // (~에게) 푹 빠진, 정신을 못 차리는
		'captivated', // (매력에) 사로잡힌 (Cat 11 for awe, here for romantic charm)
		'charmed', // 매료된, 황홀한
		'doting', // 맹목적으로 사랑하는, 애지중지하는
		'lovesick', // 상사병에 걸린
		'pining', // (애타게) 그리워하다, 갈망하다
		'woo', // 구애하다
		'sweetheart', // 연인, 애인 (감정 표현)
		'crush', // (일시적으로) 홀딱 반함
		'moonstruck', // (사랑에 빠져) 넋이 나간, 황홀해하는
		'heartthrob', // (주로 여성들이) 선망하는 남자, 심장이 두근거림
		'swooning', // 황홀해하는, 기절할 듯한 (사랑으로)
		'dreamy', // 꿈꾸는 듯한, 황홀한 (로맨틱한 상상)
		'serenading', // 세레나데를 부르는 (구애의 표현)
		'amorous', // 연애의, 호색적인
		'flirtatious', // 바람기 있는, 장난스러운 (연애)
		'intimate', // 친밀한 (연인 관계)
		'kissing', // 키스하는
		'hugging', // 포옹하는
		'cuddling', // 껴안는
		'seductive', // 유혹적인
	],
} as const;

// Default portrait number
export type EmotionKey = keyof typeof numberToEmotionWordsMap;
export const DEFAULT_IMAGE_NUMBER: EmotionKey = 0 as const;
export const DEFAULT_EMOTION = 'default' as const;
export const validEmotionKeyNumbers: Readonly<Set<EmotionKey>> = new Set(
	Object.keys(numberToEmotionWordsMap).map((k) => Number(k) as EmotionKey)
);

// The PortraitMap stores loaded image URLs, keyed by their valid EmotionKey (image number).
// It's Partial because not every EmotionKey defined in numberToEmotionWordsMap
// will necessarily have a corresponding image file available.
export type PortraitMap = Partial<Record<EmotionKey, string>>;
/**
 * Flattened set of all unique emotion keywords (lowercase) for fast lookup.
 */
export const allEmotionKeywords: Readonly<Set<string>> = new Set(
	Object.values(numberToEmotionWordsMap)
		.flat()
		.map((w) => w.toLowerCase())
);

/**
 * Array version of all emotion keywords (if you need an array).
 */
export const allEmotionKeywordsList: readonly string[] = Array.from(allEmotionKeywords);
