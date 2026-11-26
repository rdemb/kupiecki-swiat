import { useEffect, useRef, useState } from 'react';
import lines from '../economy/innGuide.json';

export function InnGuide({ cue, muted = false }: { cue: keyof typeof lines; muted?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = audio.current;
    setSpeaking(false);
    setFailed(false);
    return () => player?.pause();
  }, [cue]);
  useEffect(() => {
    if (muted) audio.current?.pause();
  }, [muted]);
  return (
    <details
      className="inn-guide"
      onToggle={(e) => {
        if (!e.currentTarget.open) audio.current?.pause();
      }}
    >
      <summary>Rada przewodnika</summary>
      <div>
        <p>{lines[cue]}</p>
        <button
          type="button"
          disabled={muted}
          onClick={async () => {
            const player = audio.current;
            if (!player) return;
            if (speaking) {
              player.pause();
              return;
            }
            setFailed(false);
            try {
              player.currentTime = 0;
              await player.play();
            } catch {
              setFailed(true);
            }
          }}
        >
          {muted ? 'Gra wyciszona' : speaking ? 'Zatrzymaj głos' : 'Posłuchaj'}
        </button>
        {failed && (
          <small role="status">Odtwarzanie jest niedostępne. Wskazówkę znajdziesz powyżej.</small>
        )}
        <audio
          ref={audio}
          src={(import.meta.env.BASE_URL || '/') + 'voices/' + cue + '.mp3'}
          preload="none"
          onPlay={() => setSpeaking(true)}
          onPause={() => setSpeaking(false)}
          onEnded={() => setSpeaking(false)}
        />
      </div>
    </details>
  );
}
