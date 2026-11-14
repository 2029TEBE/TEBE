'use client';
import { createContext, useContext, createElement } from 'react';
import { uiLabel } from '@/lib/ui-labels.mjs';
const LocaleContext = createContext('en-US');
export function UiLocaleProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
/** Only explicitly marked product copy is translated. Never pass customer fields. */
export function UiText({ text }: { text: string }) {
  const locale = useContext(LocaleContext);
  return <>{text.replace(/\S(?:[\s\S]*\S)?/, source => uiLabel(source, locale))}</>;
}

/** Translates only the explicitly marked literal attributes, preserving field values. */
export function UiField<T extends keyof React.JSX.IntrinsicElements>(
  { as, copy, ...props }: { as: T; copy: string[] } & React.JSX.IntrinsicElements[T],
) {
  const locale = useContext(LocaleContext);
  const attributes = { ...props } as Record<string, unknown>;
  for (const key of copy) {
    if (typeof attributes[key] === 'string') attributes[key] = uiLabel(attributes[key] as string, locale);
  }
  return createElement(as, attributes);
}
