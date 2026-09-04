import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";

/**
 * The 20-20-20 eye rest. Blocks the app for EXERCISE_SECONDS.
 *
 * "Hard block" here means hard for a student who is simply tempted to skip —
 * never hard for a student who needs the app. Three escape hatches exist by
 * design (§2.7 "fail open"):
 *
 *   1. the countdown finishes and the button enables;
 *   2. an emergency skip appears at ESCAPE_HATCH_SECONDS;
 *   3. an unconditional auto-dismiss at FAILSAFE_SECONDS, so a bug in the
 *      countdown can never trap a child inside a modal.
 *
 * The provider that renders this also sits behind an error boundary, and the
 * overlay is deliberately NOT portalled to document.body — a portal escapes
 * the boundary that exists to catch its faults.
 */

const EXERCISE_SECONDS = 20;
const ESCAPE_HATCH_SECONDS = 25;
const FAILSAFE_SECONDS = 60;

export default function EyeBreakOverlay({ onDone }: { onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(secs);
      if (secs >= FAILSAFE_SECONDS) doneRef.current();
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Pause playback so the student does not miss twenty seconds of a lesson,
  // and resume exactly what we paused on the way out.
  useEffect(() => {
    const paused: HTMLMediaElement[] = [];
    document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((el) => {
      if (!el.paused) {
        el.pause();
        paused.push(el);
      }
    });

    // Lessons are usually cross-origin iframes, so there is no element to
    // pause. YouTube embeds carry enablejsapi=1 (shared-ui/utils/youtube.ts)
    // and accept player commands over postMessage.
    //
    // Deliberately NOT resumed on the way out. We can pause a cross-origin
    // player but we cannot read its state, so "resume everything" would also
    // start videos the student had paused on purpose, and any second video
    // on the page. Pressing play again after an eye rest is one tap; having
    // a video start itself is a bug. Native <video>/<audio> above IS resumed,
    // because there we actually know what was playing.
    //
    // Google Drive exposes no such API: a Drive video keeps playing behind
    // the overlay. Known, accepted gap.
    document.querySelectorAll("iframe").forEach((f) => {
      let origin: string;
      try {
        origin = new URL(f.src, window.location.href).origin;
      } catch {
        return; // srcdoc / about:blank / malformed — nothing to talk to
      }
      if (!/^https:\/\/(www\.)?youtube(-nocookie)?\.com$/.test(origin)) return;
      try {
        f.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          origin
        );
      } catch {
        // Never let a best-effort courtesy take down the break itself.
      }
    });

    return () => {
      paused.forEach((el) => {
        void el.play().catch(() => {});
      });
    };
  }, []);

  // Trap focus and swallow Escape: the whole point is that this is not
  // dismissible by reflex. The failsafe above is the way out, not the keyboard.
  useEffect(() => {
    cardRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
      );
      if (!focusables?.length) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const remaining = Math.max(0, EXERCISE_SECONDS - elapsed);
  const ready = remaining === 0;
  const pct = Math.min(100, (elapsed / EXERCISE_SECONDS) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="eye-break-title"
      // Solid base colour first, blur only as progressive enhancement: cheap
      // Android tablets drop backdrop-filter entirely, which would otherwise
      // leave a see-through "block" that blocks nothing visually.
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-7 text-center shadow-2xl outline-none"
      >
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/40">
          {/* motion-safe only: a pulsing icon is exactly what someone with
              vestibular sensitivity has asked the OS to stop doing. */}
          <Eye className="h-8 w-8 text-teal-600 dark:text-teal-400 motion-safe:animate-pulse" />
        </span>

        <h2 id="eye-break-title" className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Time to rest your eyes
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          You've been studying for a while. Look at something about{" "}
          <strong className="font-semibold">20 feet away</strong> for 20 seconds — and stretch
          while you're at it.
        </p>

        <div
          className="mt-6 text-4xl font-bold tabular-nums text-teal-600 dark:text-teal-400"
          aria-live="polite"
          aria-atomic="true"
        >
          {remaining}
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-1.5 rounded-full bg-teal-500 transition-[width] duration-300 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        <button
          type="button"
          onClick={onDone}
          disabled={!ready}
          className="mt-6 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
        >
          {ready ? "Back to studying" : "Keep looking away…"}
        </button>

        {elapsed >= ESCAPE_HATCH_SECONDS && !ready && (
          <button
            type="button"
            onClick={onDone}
            className="mt-3 text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Skip this break
          </button>
        )}
      </div>
    </div>
  );
}
