// src/client/context/HoverContext.tsx

import React, { createContext, useContext } from 'react';

// 1. Create the context with a default value. This value is only used if a
//    component tries to use the context without a Provider above it in the tree.
export const HoverContext = createContext<boolean>(false);

// 2. Create the custom hook for consuming the context.
//    This hook finds the NEAREST HoverContext.Provider up the component tree.
export const useHoverState = () => {
  return useContext(HoverContext);
};
