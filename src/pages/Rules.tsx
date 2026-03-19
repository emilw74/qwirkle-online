import { cn } from '../utils/cn';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import type { Lang } from '../i18n/translations';

interface RulesProps {
  onBack: () => void;
}

const rulesContent: Record<Lang, {
  title: string;
  sections: { heading: string; content: string[] }[];
}> = {
  pl: {
    title: 'Zasady gry Qwirkle',
    sections: [
      {
        heading: 'Cel gry',
        content: [
          'Zdobądź jak najwięcej punktów, układając linie z kafelków o wspólnym kolorze lub kształcie.',
          'Gra kończy się, gdy jeden z graczy ułoży wszystkie swoje kafelki lub gdy żaden gracz nie może wykonać ruchu.',
        ],
      },
      {
        heading: 'Kafelki',
        content: [
          '108 kafelków: 6 kolorów × 6 kształtów × 3 kopie każdego.',
          'Kolory: czerwony, pomarańczowy, żółty, zielony, niebieski, fioletowy.',
          'Kształty: koło, gwiazdka, romb, kwadrat, trójkąt, krzyżyk.',
          'Każdy gracz zaczyna z 6 kafelkami na ręce.',
        ],
      },
      {
        heading: 'Zasady układania',
        content: [
          'W jednej turze możesz położyć 1 lub więcej kafelków w jednej linii (tym samym rzędzie lub kolumnie).',
          'Każda linia na planszy musi składać się z kafelków, które mają wspólny kolor LUB wspólny kształt.',
          'W jednej linii nie mogą się powtarzać identyczne kafelki (ten sam kolor I kształt).',
          'Każdy nowy kafelek musi przylegać do istniejącego kafelka na planszy (oprócz pierwszego ruchu).',
          'Pierwszy ruch musi przechodzić przez środek planszy.',
        ],
      },
      {
        heading: 'Punktacja',
        content: [
          'Za każdy położony kafelek dostajesz 1 punkt za każdy kafelek w linii, do której dołożyłeś (włącznie z nowym).',
          'Jeśli Twój kafelek tworzy lub rozszerza dwie linie (poziomą i pionową), punkty liczą się z obu linii.',
          'QWIRKLE: Ukończenie linii z 6 kafelkami (wszystkie kolory lub wszystkie kształty) daje 6 punktów bonus (łącznie 12 za tę linię).',
          'Gracz, który jako pierwszy pozbędzie się wszystkich kafelków, dostaje dodatkowe 6 punktów.',
        ],
      },
      {
        heading: 'Wymiana kafelków',
        content: [
          'Zamiast kłaść kafelki, możesz wymienić dowolną liczbę kafelków z worka.',
          'Wymiana kończy Twoją turę — nie dostajesz za nią punktów.',
          'Wymiana jest dostępna tylko jeśli w worku pozostały kafelki.',
        ],
      },
      {
        heading: 'Pasowanie',
        content: [
          'Jeśli nie możesz wykonać żadnego ruchu i nie chcesz wymieniać, możesz spasować.',
          'Jeśli wszyscy gracze spasują pod rząd, gra się kończy.',
        ],
      },
      {
        heading: 'Koniec gry',
        content: [
          'Gra kończy się gdy: gracz ułoży ostatni kafelek z ręki, lub wszyscy gracze spasują pod rząd.',
          'Wygrywa gracz z najwyższym wynikiem.',
        ],
      },
      {
        heading: 'Timer — czas na ruch',
        content: [
          'Przy tworzeniu pokoju można ustawić limit czasu na ruch (domyślnie 24 godziny).',
          'Jeśli gracz nie wykona ruchu w wyznaczonym czasie, następuje automatyczny pas.',
          'Boty nie są ograniczone timerem — wykonują ruch natychmiast.',
          'Jeśli nikt nie ma otwartej gry przez dłuższy czas, system automatycznie nadrabia wszystkie przeterminowane tury po otwarciu gry.',
        ],
      },
    ],
  },
  en: {
    title: 'Qwirkle Game Rules',
    sections: [
      {
        heading: 'Objective',
        content: [
          'Score the most points by creating lines of tiles that share a common color or shape.',
          'The game ends when a player places all their tiles or when no player can make a move.',
        ],
      },
      {
        heading: 'Tiles',
        content: [
          '108 tiles: 6 colors × 6 shapes × 3 copies of each.',
          'Colors: red, orange, yellow, green, blue, purple.',
          'Shapes: circle, star, diamond, square, triangle, cross.',
          'Each player starts with 6 tiles in hand.',
        ],
      },
      {
        heading: 'Placement Rules',
        content: [
          'On your turn, you may place 1 or more tiles in a single line (same row or column).',
          'Every line on the board must consist of tiles that share a common color OR a common shape.',
          'No duplicate tiles (same color AND shape) are allowed in one line.',
          'Each new tile must be adjacent to an existing tile on the board (except for the first move).',
          'The first move must pass through the center of the board.',
        ],
      },
      {
        heading: 'Scoring',
        content: [
          'For each tile placed, you score 1 point for every tile in the line you added to (including the new one).',
          'If your tile creates or extends two lines (horizontal and vertical), you score points from both.',
          'QWIRKLE: Completing a line of 6 tiles (all colors or all shapes) gives a 6-point bonus (12 total for that line).',
          'The first player to place all their tiles gets an extra 6 points.',
        ],
      },
      {
        heading: 'Swapping Tiles',
        content: [
          'Instead of placing tiles, you may swap any number of tiles from your hand with the bag.',
          'Swapping ends your turn — you score no points.',
          'Swapping is only available if tiles remain in the bag.',
        ],
      },
      {
        heading: 'Passing',
        content: [
          'If you cannot make a move and don\'t want to swap, you may pass.',
          'If all players pass in a row, the game ends.',
        ],
      },
      {
        heading: 'End of Game',
        content: [
          'The game ends when: a player places their last tile, or all players pass consecutively.',
          'The player with the highest score wins.',
        ],
      },
      {
        heading: 'Timer — Time per Move',
        content: [
          'When creating a room, you can set a time limit per move (default: 24 hours).',
          'If a player doesn\u2019t make a move within the time limit, an automatic pass is triggered.',
          'Bots are not restricted by the timer — they play instantly.',
          'If nobody has the game open for an extended period, the system automatically catches up all expired turns when the game is opened.',
        ],
      },
    ],
  },
};

// Visual example tiles for illustration
function ExampleTile({ color, shape }: { color: string; shape: string }) {
  const colorMap: Record<string, string> = {
    red: '#e63946',
    orange: '#f77f00',
    yellow: '#fcbf49',
    green: '#2db84d',
    blue: '#3a7bd5',
    purple: '#7b2cbf',
  };
  const shapeMap: Record<string, string> = {
    circle: '●',
    star: '★',
    diamond: '◆',
    square: '■',
    triangle: '▲',
    cross: '✚',
  };

  return (
    <div
      className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold shadow-sm"
      style={{ backgroundColor: colorMap[color] || '#888' }}
    >
      {shapeMap[shape] || '?'}
    </div>
  );
}

export function Rules({ onBack }: RulesProps) {
  const { t, lang } = useTranslation();
  const r = rulesContent[lang];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>

      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm space-y-6">
        <h2 className="font-display font-bold text-xl text-center">{r.title}</h2>

        {/* Visual example of tiles */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          <ExampleTile color="red" shape="circle" />
          <ExampleTile color="orange" shape="star" />
          <ExampleTile color="yellow" shape="diamond" />
          <ExampleTile color="green" shape="square" />
          <ExampleTile color="blue" shape="triangle" />
          <ExampleTile color="purple" shape="cross" />
        </div>

        {r.sections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </span>
              {section.heading}
            </h3>
            <div className="space-y-1.5 pl-8">
              {section.content.map((line, i) => (
                <p key={i} className={cn(
                  'text-sm leading-relaxed',
                  line.startsWith('QWIRKLE')
                    ? 'font-semibold text-primary'
                    : 'text-muted-foreground',
                )}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}

        {/* Scoring example */}
        <div className="rounded-xl bg-muted/30 dark:bg-muted/10 border border-border/50 p-4 space-y-3">
          <h4 className="font-display font-bold text-sm">
            {t('scoringExample')}
          </h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5">
                <ExampleTile color="red" shape="circle" />
                <ExampleTile color="red" shape="star" />
                <ExampleTile color="red" shape="diamond" />
              </div>
              <span>= 3 {t('pts')}</span>
            </div>
            <p className="text-xs">
              {lang === 'pl'
                ? 'Linia z 3 czerwonymi kafelkami (różne kształty) = 3 punkty'
                : 'A line of 3 red tiles (different shapes) = 3 points'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex gap-0.5">
                <ExampleTile color="red" shape="circle" />
                <ExampleTile color="orange" shape="circle" />
                <ExampleTile color="yellow" shape="circle" />
                <ExampleTile color="green" shape="circle" />
                <ExampleTile color="blue" shape="circle" />
                <ExampleTile color="purple" shape="circle" />
              </div>
              <span className="font-bold text-primary">= 12 {t('pts')} !</span>
            </div>
            <p className="text-xs">
              {lang === 'pl'
                ? 'QWIRKLE! Linia z 6 kołami (wszystkie kolory) = 6 + 6 bonus = 12 punktów'
                : 'QWIRKLE! A line of 6 circles (all colors) = 6 + 6 bonus = 12 points'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
