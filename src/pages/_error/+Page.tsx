import { usePageContext } from '#root/src/renderer/usePageContext.tsx';
export { Page };

function Page() {
	const pageContext = usePageContext();
	let { is404, abortReason } = pageContext;
	if (!abortReason) {
		abortReason = is404 ? 'Page not found.' : 'Something went wrong.';
	}
	return (
		<Center>
			<p style={{ fontSize: '1.3em' }}>{abortReason}</p>
		</Center>
	);
}

function Center({ style, ...props }: any) {
	return (
		<div
			style={{
				height: 'calc(100vh - 100px)',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				...style,
			}}
			{...props}
		></div>
	);
}
