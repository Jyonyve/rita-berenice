import { ChatGroq } from "@langchain/groq";

export const Groq = () => {
	//
	const getResult = async () => {
		const llm = new ChatGroq({
			model: "mixtral-8x7b-32768",
			temperature: 0,
			apiKey: import.meta.env.VITE_GROQ_API_KEY,
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
