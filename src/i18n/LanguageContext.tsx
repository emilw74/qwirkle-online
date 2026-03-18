import { createContext, useContext, useCallback } from 'react';
import { translations, Lang, TranslationKey } from './translations';
import { useGameStore } from '../hooks/useGameStore';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useGameStore(s => s.lang);
  const setLang = useGameStore(s => s.setLang);

  const t = useCallback(
    (key: TranslationKey): string => translations[key][lang],
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
  return ctx;
}
