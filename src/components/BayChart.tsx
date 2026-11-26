import { useEffect, useRef } from 'react';
import type { Course } from '../economy/pilotage';

const southBank =
  'M-25 102 C37 95 48 123 62 153 S96 205 147 201 Q177 200 197 224 T264 252 L290 322 L-25 322Z';
const northBank =
  'M290 -20 Q326 15 369 8 T455 28 Q487 47 542 29 T735 43 L735 -20Z';
const sand =
  'M242 175 C260 152 296 138 340 124 S412 103 425 110 Q430 116 393 133 C337 150 286 180 255 184 Q237 187 242 175Z';
const outer = 'M105 179 C146 124 153 76 222 65 S388 78 458 65 S549 55 598 84';
const shortcut =
  'M105 179 C172 179 236 160 287 144 S381 114 441 103 S541 81 598 84';
export function BayChart({
  course,
  reading,
  stale,
}: {
  course: Course;
  reading: number | null;
  stale: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    const track = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    track.setAttribute('d', course === 'cut' ? shortcut : outer);
    const length = track.getTotalLength();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const started = performance.now();
    let frame = 0;
    function draw(time: number) {
      if (!canvas || !c) return;
      const width = canvas.clientWidth;
      if (!width) return;
      const scale = (Math.min(devicePixelRatio || 1, 2) * width) / 700;
      if (
        canvas.width !== Math.round(700 * scale) ||
        canvas.height !== Math.round(274 * scale)
      ) {
        canvas.width = Math.round(700 * scale);
        canvas.height = Math.round(274 * scale);
      }
      c.setTransform(scale, 0, 0, scale, 0, 0);
      c.fillStyle = '#d5e1d5';
      c.fillRect(0, 0, 700, 274);
      c.strokeStyle = '#8aaba333';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 14; x < 700; x += 48) {
        c.moveTo(x, 0);
        c.lineTo(x, 274);
      }
      for (let y = 12; y < 274; y += 48) {
        c.moveTo(0, y);
        c.lineTo(700, y);
      }
      c.stroke();
      const shade = (path: string, width: number, color: string) => {
        c.lineWidth = width;
        c.strokeStyle = color;
        c.stroke(new Path2D(path));
      };
      const fill = (path: string, color: string) => {
        c.fillStyle = color;
        c.fill(new Path2D(path));
      };
      for (const line of [southBank, northBank]) {
        for (const spread of [50, 34, 18]) shade(line, spread, '#86aa9d36');
        fill(line, '#dccba1');
        shade(line, 1.7, '#665e48');
      }
      shade(sand, 23, '#a4bda26b');
      shade(sand, 11, '#bcc39c');
      fill(sand, '#d4c79c');
      shade(sand, 1, '#a99970');
      // Draw the sounding station on the edge of the shoal, not in the deep fairway.
      const deep = course !== 'cut';
      c.setLineDash([6, 5]);
      shade(deep ? shortcut : outer, 1.8, '#77847b');
      c.setLineDash([]);
      shade(deep ? outer : shortcut, 3.8, '#234c52');
      if (course === 'survey') {
        c.setLineDash([3, 4]);
        shade('M353 71 Q374 91 348 120', 2.8, '#8d551c');
        c.setLineDash([]);
      }
      function pin(x: number, y: number, color: string) {
        c!.beginPath();
        c!.arc(x, y, 5, 0, 2 * Math.PI);
        c!.fillStyle = color;
        c!.fill();
        c!.lineWidth = 2;
        c!.strokeStyle = '#f3ecd7';
        c!.stroke();
      }
      pin(105, 179, '#244748');
      pin(598, 84, '#244748');
      pin(348, 120, stale ? '#7a6c56' : '#8d551c');
      c.font = 'bold 17px Georgia';
      c.fillStyle = '#253c38';
      c.fillText('Królewska Przystań', 22, 232);
      c.fillText('Reda', 576, 112);
      c.font = 'italic 15px Georgia';
      c.fillStyle = '#52583d';
      c.fillText('Ławica', 300, 173);
      c.font = '600 15px system-ui';
      c.fillStyle = '#624322';
      if (reading !== null)
        c.fillText(reading + ' cm' + (stale ? ' *' : ''), 358, 108);
      c.save();
      c.translate(644, 192);
      c.strokeStyle = '#596c61';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, 0, 13, 0, 2 * Math.PI);
      c.stroke();
      fill('M0 -20 L4 4 L0 1 L-4 4Z', '#334d45');
      c.fillStyle = '#334d45';
      c.font = '13px Georgia';
      c.textAlign = 'center';
      c.fillText('N', 0, -24);
      c.restore();
      const progress = reduced.matches
        ? 1
        : Math.min(1, (time - started) / 2400);
      if (progress < 1) {
        const at = track.getPointAtLength(length * progress);
        const next = track.getPointAtLength(
          Math.min(length, length * progress + 1),
        );
        c.save();
        c.translate(at.x, at.y);
        c.rotate(Math.atan2(next.y - at.y, next.x - at.x));
        fill('M9 0 Q3 -5 -6 -3 L-8 0 L-6 3 Q3 5 9 0Z', '#9c452e');
        c.restore();
        frame = requestAnimationFrame(draw);
      }
    }
    const redraw = () => {
      cancelAnimationFrame(frame);
      draw(performance.now());
    };
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    reduced.addEventListener('change', redraw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      reduced.removeEventListener('change', redraw);
    };
  }, [course, reading, stale]);
  return (
    <canvas
      className="pilot-map"
      ref={ref}
      aria-label="Schemat torów między Królewską Przystanią a redą, wokół ławicy i przez przesmyk"
      role="img"
    />
  );
}
