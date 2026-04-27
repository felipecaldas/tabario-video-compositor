import React, { createContext, useContext } from 'react';
import { EditStyle } from '../src/styles/schema';
import { StyleRegistry, DEFAULT_STYLE_ID } from '../src/styles/registry';

const DEFAULT_STYLE = StyleRegistry.resolve(DEFAULT_STYLE_ID);

const StyleContext = createContext<EditStyle>(DEFAULT_STYLE);

export function StyleProvider({
  style,
  children,
}: {
  style: EditStyle;
  children: React.ReactNode;
}) {
  return <StyleContext.Provider value={style}>{children}</StyleContext.Provider>;
}

export function useStyle(): EditStyle {
  return useContext(StyleContext);
}
