import { createContext, useContext, type JSX, type ReactNode } from 'react';
import {
  useUltravox,
  type UseUltravoxOptions,
  type UseUltravoxReturn,
} from './useUltravox';

const UltravoxContext = createContext<UseUltravoxReturn | null>(null);

export interface UltravoxProviderProps extends UseUltravoxOptions {
  children: ReactNode;
}

/**
 * Provider component for sharing Ultravox session across the component tree
 */
export function UltravoxProvider({
  children,
  ...options
}: UltravoxProviderProps): JSX.Element {
  const ultravox = useUltravox(options);

  return (
    <UltravoxContext.Provider value={ultravox}>
      {children}
    </UltravoxContext.Provider>
  );
}

/**
 * Hook to access the shared Ultravox session from UltravoxProvider
 */
export function useUltravoxContext(): UseUltravoxReturn {
  const context = useContext(UltravoxContext);
  if (!context) {
    throw new Error(
      'useUltravoxContext must be used within an UltravoxProvider'
    );
  }
  return context;
}
