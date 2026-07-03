/**
 * Converts a camelCase or PascalCase string to kebab-case.
 * e.g., storeChatTurn -> store-chat-turn
 *       GetSummary    -> get-summary
 */
export function toKebabCase(str: string): string {
	if (!str) return '';
	return (
		str
			// Add hyphen before uppercase letters preceded by a lowercase letter or number
			.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
			// Add hyphen before uppercase letters preceded by another uppercase letter and followed by a lowercase letter (e.g., `DBUrl` -> `db-url`)
			.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
			.toLowerCase()
	);
}
