import { ChatGroq } from "@langchain/groq";
import GroqLogo from "@assets/groq-logo.svg?react";
import { Button } from "@mui/material";
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
		<Button onClick={getResult}>
			<GroqLogo />
		</Button>
	);
};
