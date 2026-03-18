import { cn } from '../utils/cn';
import { useTranslation } from '../i18n/LanguageContext';

interface LanguageToggleProps {
  compact?: boolean;
}

export function LanguageToggle({ compact }: LanguageToggleProps) {
  const { lang, setLang } = useTranslation();

  return (
    <div className={cn(
      'flex items-center gap-0.5 bg-muted rounded-lg p-0.5',
      compact && 'scale-90 origin-right',
    )}>
      <button
        onClick={() => setLang('pl')}
        className={cn(
          'px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          lang === 'pl'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        🇵🇱 PL
      </button>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
          lang === 'en'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        🇬🇧 EN
      </button>
    </div>
  );
}
