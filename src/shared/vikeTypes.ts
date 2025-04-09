import { ReactNode } from 'react';
import type { PageContext } from 'vike/types';

export interface ChildrenInterface {
	children: ReactNode;
}
export interface PageContextInterface extends ChildrenInterface {
	pageContext: PageContext;
}
