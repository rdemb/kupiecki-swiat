import type { ReactNode } from 'react';

// Keep the current game session on an ordinary click and allow sharing or opening a new tab.
export function PortLink({
  href,
  go,
  children,
}: {
  href: string;
  go: () => void;
  children: ReactNode;
}) {
  return (
    <a
      className="pilot-link"
      href={href}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        history.replaceState(history.state, '', href);
        go();
      }}
    >
      {children}
    </a>
  );
}
