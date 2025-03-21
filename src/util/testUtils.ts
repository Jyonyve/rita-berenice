import { FakeListChatModel } from '@langchain/core/utils/testing';
import { HumanMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { AiApiRequest } from '@domain/aimodel';

const simulateOrderedResponses = async () => {
	const chat = new FakeListChatModel({ responses: ["I'll callback later.", "You 'console' them!"] });

	const firstMessage = new HumanMessage('You want to hear a JavaScript joke?');
	const secondMessage = new HumanMessage('How do you cheer up a JavaScript developer?');
	const firstResponse = await chat.invoke([firstMessage]);
	const secondResponse = await chat.invoke([secondMessage]);

	console.log({ firstResponse });
	console.log({ secondResponse });
};

const simulateStreamedResponses = async () => {
	const chat = new FakeListChatModel({ responses: ["I'll callback later.", "You 'console' them!"] });

	const stream = await chat
		.pipe(new StringOutputParser())
		.stream(`You want to hear a JavaScript joke?`);
	const chunks = [];
	for await (const chunk of stream) {
		chunks.push(chunk);
	}

	console.log(chunks.join(''));
};

const simulateDelayedResponses = async () => {
	const slowChat = new FakeListChatModel({
		responses: ['Because Oct 31 equals Dec 25', "You 'console' them!"],
		sleep: 1000,
	});

	const thirdMessage = new HumanMessage('Why do programmers always mix up Halloween and Christmas?');
	const slowResponse = await slowChat.invoke([thirdMessage]);
	console.log({ slowResponse });

	const slowStream = await slowChat
		.pipe(new StringOutputParser())
		.stream('How do you cheer up a JavaScript developer?');
	const slowChunks = [];
	for await (const chunk of slowStream) {
		slowChunks.push(chunk);
	}

	console.log(slowChunks.join(''));
};

// Example usage
const claudeSonnetRequest = (
	modelId: string = 'anthropic.claude-3-7-sonnet-20250219-v1:0'
): AiApiRequest => ({
	modelId,
	contentType: 'application/json',
	accept: 'application/json',
	body: {
		anthropic_version: 'bedrock-2023-05-31',
		max_tokens: 200,
		top_k: 250,
		stop_sequences: [],
		temperature: 1,
		top_p: 0.999,
		messages: [{ role: 'user', content: [{ type: 'text', text: 'hello world' }] }],
	},
});

const claudeHaikuRequest = (
	modelId: string = 'anthropic.claude-3-5-haiku-20241022-v1:0'
): AiApiRequest => ({
	modelId,
	contentType: 'application/json',
	accept: 'application/json',
	body: {
		anthropic_version: 'bedrock-2023-05-31',
		max_tokens: 200,
		top_k: 250,
		stop_sequences: [],
		temperature: 1,
		top_p: 0.999,
		messages: [{ role: 'user', content: [{ type: 'text', text: 'hello world' }] }],
	},
});

const amazonNovaRequest = (modelId: string = 'amazon.nova-pro-v1:0'): AiApiRequest => ({
	modelId,
	contentType: 'application/json',
	accept: 'application/json',
	body: {
		inferenceConfig: { max_new_tokens: 1000 },
		messages: [{ role: 'user', content: [{ text: 'this is where you place your input text' }] }],
	},
});

const requestExamples = { claudeHaikuRequest, claudeSonnetRequest, amazonNovaRequest };

const TestUtils = {
	simulateOrderedResponses,
	simulateStreamedResponses,
	simulateDelayedResponses,
	requestExamples,
};

export default TestUtils;
