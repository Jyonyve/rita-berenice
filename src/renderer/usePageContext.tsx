import React, { useContext } from 'react';
import type { PageContext } from 'vike/types';
import { PageContextInterface } from '@shared/vikeTypes';

const Context = React.createContext<PageContext>(undefined as any);

export const PageContextProvider = ({ pageContext, children }: PageContextInterface) => {
	return <Context.Provider value={pageContext}>{children}</Context.Provider>;
};

export const usePageContext = () => {
	const pageContext = useContext(Context);
	return pageContext;
};
