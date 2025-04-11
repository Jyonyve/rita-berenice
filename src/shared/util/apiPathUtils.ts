// src/shared/utils/apiPaths.ts

/**
 * Converts a camelCase or PascalCase string to kebab-case.
 * e.g., storeChatTurn -> store-chat-turn
 *       GetSummary    -> get-summary
 */
function toKebabCase(str: string): string {
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

/**
 * Generates an API URL pattern suitable for Express route definitions.
 * Includes parameter placeholders like /:paramName based on the method name convention.
 * Assumes parameters follow the method name in the URL structure.
 *
 * @param moduleName - The resource name (e.g., 'chroma', 'character', 'chat'). Should be singular.
 * @param methodName - The operation being performed (e.g., 'storeChatTurn', 'getSummary').
 * @param paramNames - Optional array of parameter names to append as placeholders (e.g., ['sessionId', 'sequence']).
 * @returns The API route pattern string (e.g., '/api/chroma/store-chat-turn/:sessionId').
 */
export function genRoutePattern(
	moduleName: string,
	methodName: string,
	paramNames: string[] = []
): string {
	const kebabMethod = toKebabCase(methodName);
	let path = `/api/${moduleName}/${kebabMethod}`; // Base path with module and method

	// Append parameter placeholders if any are specified
	if (paramNames.length > 0) {
		const paramPlaceholders = paramNames.map((name) => `:${name}`).join('/');
		path += `/${paramPlaceholders}`;
	}

	return path;
}

/**
 * Generates a concrete API URL path suitable for client-side API calls.
 * Inserts actual parameter values into the path.
 *
 * @param moduleName - The resource name (e.g., 'chroma', 'character', 'chat'). Should be singular.
 * @param methodName - The operation being performed (e.g., 'storeChatTurn', 'getSummary').
 * @param paramValues - Optional array of parameter values to insert into the path (e.g., ['session123', 5]). Values are URI encoded.
 * @returns The concrete API URL path string (e.g., '/api/chroma/store-chat-turn/session123'). Note: Base URL (domain) is added by apiClient.
 */
export function genApiUrl(
	moduleName: string,
	methodName: string,
	paramValues: (string | number)[] = []
): string {
	const kebabMethod = toKebabCase(methodName);
	let path = `/api/${moduleName}/${kebabMethod}`; // Base path

	// Append encoded parameter values if any are provided
	if (paramValues.length > 0) {
		const encodedValues = paramValues.map((val) => encodeURIComponent(String(val))).join('/');
		path += `/${encodedValues}`;
	}

	return path;
}
