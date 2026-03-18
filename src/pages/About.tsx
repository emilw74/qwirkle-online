import { ArrowLeft, Lightbulb, Code, ExternalLink } from 'lucide-react';

interface AboutProps {
  onBack: () => void;
}

export function About({ onBack }: AboutProps) {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        <ArrowLeft size={16} /> Wróć
      </button>

      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1">
            {['#e63946', '#f77f00', '#fcbf49', '#2db84d', '#3a7bd5', '#7b2cbf'].map((color, i) => (
              <div
                key={color}
                className="w-6 h-6 rounded-md"
                style={{
                  backgroundColor: color,
                  transform: `rotate(${(i - 2.5) * 5}deg)`,
                }}
              />
            ))}
          </div>
          <h2 className="font-display font-bold text-xl">Qwirkle Online</h2>
          <p className="text-xs text-muted-foreground">Wersja 1.0 · 2026</p>
        </div>

        {/* Credits */}
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border/50">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Lightbulb size={20} className="text-amber-500" />
            </div>
            <div>
              <div className="font-semibold text-sm">Koncepcja, projekt, testy</div>
              <div className="text-muted-foreground text-sm mt-0.5">Emil W</div>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border/50">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Code size={20} className="text-blue-500" />
            </div>
            <div>
              <div className="font-semibold text-sm">Kodowanie</div>
              <div className="text-muted-foreground text-sm mt-0.5">
                <a
                  href="https://www.perplexity.ai/computer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Perplexity Computer <ExternalLink size={11} />
                </a>
                {' / '}
                <a
                  href="https://www.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Claude Sonnet 4 <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Tech stack */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Technologie
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['React', 'TypeScript', 'Tailwind CSS', 'Firebase Auth', 'Firebase RTDB', 'Vite', 'Zustand', 'Netlify'].map(tech => (
              <span
                key={tech}
                className="px-2.5 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="pt-2 border-t border-border/50 space-y-2">
          <a
            href="https://github.com/emilw74/qwirkle-online"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Kod źródłowy na GitHub
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Disclaimer */}
        <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
          Qwirkle jest znakiem towarowym MindWare. Ta aplikacja jest niezależnym projektem hobbystycznym
          i nie jest powiązana z MindWare.
        </p>
      </div>
    </div>
  );
}
