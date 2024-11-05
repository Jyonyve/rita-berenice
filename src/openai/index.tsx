import { ChatOpenAI } from "@langchain/openai";

export const OpenAi = () => {
	//
	const getResult = async () => {
		const llm = new ChatOpenAI({
			model: "gpt-3.5-turbo-0125",
			temperature: 0,
			apiKey: import.meta.env.VITE_OPENAI_API_KEY,
		});
		const res = await llm.invoke("Hello, world!");
		console.log(res);
		return res;
	};
	return (
		<>
			<button onClick={getResult}>{`click`}</button>
		</>
	);
};
