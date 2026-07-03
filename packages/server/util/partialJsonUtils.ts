const decodeJsonEscape = (value: string): string | null => {
	const escapes: Record<string, string> = {
		'"': '"',
		'\\': '\\',
		'/': '/',
		b: '\b',
		f: '\f',
		n: '\n',
		r: '\r',
		t: '\t',
	};
	return escapes[value] ?? null;
};

export const extractPartialJsonString = (json: string, key: string): string => {
	const keyMatch = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*"`).exec(
		json
	);
	if (!keyMatch) {
		return '';
	}

	let result = '';
	for (let index = keyMatch.index + keyMatch[0].length; index < json.length; index += 1) {
		const character = json[index];
		if (character === '"') {
			break;
		}
		if (character !== '\\') {
			result += character;
			continue;
		}

		const escapedCharacter = json[index + 1];
		if (!escapedCharacter) {
			break;
		}
		if (escapedCharacter === 'u') {
			const hex = json.slice(index + 2, index + 6);
			if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
				break;
			}
			result += String.fromCharCode(parseInt(hex, 16));
			index += 5;
			continue;
		}

		const decodedEscape = decodeJsonEscape(escapedCharacter);
		if (decodedEscape === null) {
			break;
		}
		result += decodedEscape;
		index += 1;
	}

	return result;
};

export class PartialJsonStringDecoder {
	private rawJson = '';
	private emittedValue = '';

	constructor(private readonly key: string) {}

	push(rawDelta: string): string {
		this.rawJson += rawDelta;
		const currentValue = extractPartialJsonString(this.rawJson, this.key);
		if (!currentValue.startsWith(this.emittedValue)) {
			return '';
		}

		const decodedDelta = currentValue.slice(this.emittedValue.length);
		this.emittedValue = currentValue;
		return decodedDelta;
	}
}
