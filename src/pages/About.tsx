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

        {/* Disclaimer */}
        <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
          Qwirkle jest znakiem towarowym MindWare. Ta aplikacja jest niezależnym projektem hobbystycznym
          i nie jest powiązana z MindWare.
        </p>
      </div>
    </div>
  );
}
