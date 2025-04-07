import { usePageContext } from '#root/src/renderer/usePageContext.tsx';
import { CharacterComp } from '#root/src/client/component/CharacterComp.tsx';
function Page() {
	const pageContext = usePageContext();
	let { is404, abortReason } = pageContext;
	if (!abortReason) {
		abortReason = is404 ? 'Page not found.' : 'Something went wrong.';
	}
	return <CharacterComp />;
}
