import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const OUTPUT_SUBDIRECTORY_NAME = 'result'; // Name of the subdirectory

/**
 * Fixes internal line breaks within a single paragraph's text content.
 * Multiple consecutive newlines (e.g., \n\n, \n\n\n) are replaced by a single \n.
 * @param textContent The text content of a paragraph.
 * @returns Text content with internal excessive newlines reduced to single newlines.
 */
function fixInternalLineBreaks(textContent: string): string {
	if (!textContent) {
		return '';
	}
	// Replace any sequence of two or more newline characters (and any whitespace between them)
	// with a single newline character of the type that started the sequence.
	return textContent.replace(/(\r\n|\r|\n)(\s*(\r\n|\r|\n))+/g, '$1');
}

/**
 * Parses an HTML string using Cheerio to extract and format text from <p> tags
 * with specific classes 'dialogMessage' or 'nonDialogMessage'.
 * Internal line breaks within each paragraph are also fixed.
 * @param htmlString The HTML content as a string.
 * @returns A formatted string with dialog messages and non-dialog messages (wrapped in asterisks),
 *          ready to be used as JSON content.
 */
function parseHtmlAndFixLineBreaks(htmlString: string): string {
	const $ = cheerio.load(htmlString);
	const result: string[] = [];

	$('p').each((index, element) => {
		const pElement = $(element);
		const rawText = pElement.text()?.trim() ?? ''; // Get raw text

		if (rawText) {
			// Process only if there's text
			// First, fix internal line breaks in the raw text
			const textWithFixedInternalBreaks = fixInternalLineBreaks(rawText);

			if (pElement.hasClass('dialogMessage')) {
				result.push(textWithFixedInternalBreaks);
			} else if (pElement.hasClass('nonDialogMessage')) {
				result.push(`*${textWithFixedInternalBreaks}*`);
			}
			// Other <p> tags without these classes are ignored
		}
	});

	// Join the processed paragraphs with '\n\n'
	return result.join('\n\n').replace('\n\t\t\t', ' ');
}

/**
 * Main function to execute the script.
 */
async function main() {
	const inputFilePathArg = process.argv[2];

	if (!inputFilePathArg) {
		console.error(`\nError: No input HTML file specified.`);
		console.error(`Please provide the path to your HTML file as a command line argument.`);
		console.error(`Example usage: tsx your-script-name.ts ./path/to/your/htmlfile.html`);
		process.exit(1);
	}

	const absoluteInputFilePath = path.resolve(inputFilePathArg);
	console.log(`Attempting to read input file: ${absoluteInputFilePath}`);

	try {
		const htmlFileContent = fs.readFileSync(absoluteInputFilePath, 'utf-8');

		// Parse the HTML and fix line breaks to get the final content string
		const finalContentString = parseHtmlAndFixLineBreaks(htmlFileContent);

		// Prepare the JSON object
		const jsonOutput = { content: finalContentString };

		// Determine output directory and file name
		const inputFileDir = path.dirname(absoluteInputFilePath);
		const outputDir = path.join(inputFileDir, OUTPUT_SUBDIRECTORY_NAME);

		const inputFileNameWithoutExt = path.parse(absoluteInputFilePath).name;
		// Change output file extension to .json
		const outputFileName = `${inputFileNameWithoutExt}.json`;
		const absoluteOutputFilePath = path.join(outputDir, outputFileName);

		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
			console.log(`Created output directory: ${outputDir}`);
		} else {
			console.log(`Output directory already exists: ${outputDir}`);
		}

		// Write the JSON object to the output file, pretty-printed with 2 spaces [4][5]
		fs.writeFileSync(absoluteOutputFilePath, JSON.stringify(jsonOutput, null, 2), 'utf-8');

		console.log('\n--- Parsed Content for JSON (Console Preview) ---');
		// Preview a bit of the content that went into the JSON
		console.log(
			finalContentString.substring(0, 500) + (finalContentString.length > 500 ? '...' : '')
		);
		console.log('--- End of Console Preview ---');
		console.log(`\nFormatted JSON content saved to: ${absoluteOutputFilePath}`);
	} catch (error) {
		if (error.code === 'ENOENT' && error.path === absoluteInputFilePath) {
			console.error(`\nError: Input file not found at path: ${absoluteInputFilePath}`);
		} else {
			console.error('\nAn error occurred during processing:', error);
		}
		process.exit(1);
	}
}

main();
