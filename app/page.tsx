import MathGame from '@/components/game/math-game';
import GameGuide from '@/components/game/game-guide';
import { STRUCTURED_DATA } from '@/lib/site-content';

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, '\\u003c'),
        }}
      />
      <MathGame>
        <GameGuide />
      </MathGame>
    </>
  );
}
