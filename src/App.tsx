import "./App.css";
import { OpenAi } from "./openai";
import { Groq } from "./groq";

function App() {
	//
	return (
		<>
			<div style={{ display: "flex", justifyContent: "center" }}>
				<OpenAi />
				<Groq />
			</div>
			<h1>LangChain Test</h1>
			<p className="read-the-docs">
				Click on the Vite and React logos to learn more
			</p>
			<OpenAi />
		</>
	);
}

export default App;
