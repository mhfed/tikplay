import { flushSync } from 'react-dom';

/** Runs `update` inside a View Transition when the browser supports it and
 * the user hasn't asked for reduced motion; otherwise applies it directly.
 * `flushSync` forces the state update to commit synchronously so the
 * browser's "after" snapshot reflects the new DOM before it animates —
 * without it, React's async batching would leave the transition capturing
 * two identical (pre-update) frames. */
export function withViewTransition(update: () => void) {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => void;
  };
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  if (reduceMotion || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
