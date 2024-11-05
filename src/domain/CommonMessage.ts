export interface CommonMessage {
	timeStamp: number;
	content: string;
	messageId: string;
	senderId: string;
}

export type OpenAiMessageType = Partial<CommonMessage>;
