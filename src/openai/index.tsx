import { ChatOpenAI } from "@langchain/openai";
import { Button, Paper, TextField } from "@mui/material";
import OpenaiLogo from "@assets/openai-logo.svg?react";
import { useState } from "react";
import { ChatContainer } from "@util/index";

export const OpenAi = () => {
	// state
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [question, setQuestion] = useState<string>();

	const getAiResult = async () => {
		const llm = new ChatOpenAI({
			model: "gpt-3.5-turbo-0125",
			temperature: 0,
			apiKey: import.meta.env.VITE_OPENAI_API_KEY,
		});
		const res = await llm.invoke("Hello, world!");
		return res;
	};
	return (
		<>
			<div style={{ display: "flex", flexDirection: "column" }}>
				<div style={{ width: "200px" }}>
					<Button onClick={getAiResult}>
						<OpenaiLogo />
					</Button>
				</div>
				<div>
					<ChatContainer currentUserId={""} />
				</div>
			</div>
		</>
	);
};
