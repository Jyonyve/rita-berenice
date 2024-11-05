import { CommonMessage } from "domain/index";
import { useState } from "react";
import classes from "@assets/scss/Chat.scss";
import { Paper } from "@mui/material";

interface Props {
	messages?: CommonMessage[];
}
export const ChatContainer = (props: Props) => {
	//
	//state
	const [typingMessage, setTypingMessage] = useState("");

	return (
		<div className={classes.container}>
			<Paper className={classes.paper} zDepth={2}>
				<Paper id="style-1" className={classes.messagesBody}>
					<MessageLeft
						message="あめんぼあかいなあいうえお"
						timestamp="MM/DD 00:00"
						photoURL="https://lh3.googleusercontent.com/a-/AOh14Gi4vkKYlfrbJ0QLJTg_DLjcYyyK7fYoWRpz2r4s=s96-c"
						displayName=""
						avatarDisp={true}
					/>
					<MessageLeft
						message="xxxxxhttps://yahoo.co.jp xxxxxxxxxあめんぼあかいなあいうえおあいうえおかきくけこさぼあかいなあいうえおあいうえおかきくけこさぼあかいなあいうえおあいうえおかきくけこさいすせそ"
						timestamp="MM/DD 00:00"
						photoURL=""
						displayName="テスト"
						avatarDisp={false}
					/>
					<MessageRight
						message="messageRあめんぼあかいなあいうえおあめんぼあかいなあいうえおあめんぼあかいなあいうえお"
						timestamp="MM/DD 00:00"
						photoURL="https://lh3.googleusercontent.com/a-/AOh14Gi4vkKYlfrbJ0QLJTg_DLjcYyyK7fYoWRpz2r4s=s96-c"
						displayName="まさりぶ"
						avatarDisp={true}
					/>
					<MessageRight
						message="messageRあめんぼあかいなあいうえおあめんぼあかいなあいうえお"
						timestamp="MM/DD 00:00"
						photoURL="https://lh3.googleusercontent.com/a-/AOh14Gi4vkKYlfrbJ0QLJTg_DLjcYyyK7fYoWRpz2r4s=s96-c"
						displayName="まさりぶ"
						avatarDisp={false}
					/>
				</Paper>
				<TextInput />
			</Paper>
		</div>
	);
};
