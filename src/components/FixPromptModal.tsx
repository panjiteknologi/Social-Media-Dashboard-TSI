import { useEffect, useId, useRef, useState } from 'react';

/** Shows the fixing prompt, ready to copy into Claude Code. */
export function FixPromptModal({
  prompt,
  taskCount,
  onClose,
}: {
  prompt: string;
  taskCount: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'blocked'>('idle');

  useEffect(() => {
    textRef.current?.focus();
    textRef.current?.setSelectionRange(0, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopy('copied');
    } catch {
      // The browser refused clipboard access: select the text so Ctrl+C works.
      textRef.current?.focus();
      textRef.current?.select();
      setCopy('blocked');
    }
  };

  return (
    <div className="drawer-scrim prompt-scrim" onClick={onClose}>
      <div
        className="prompt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="prompt-modal__head">
          <div>
            <div className="prompt-modal__title" id={titleId}>
              Prompt to fix SEO issues
            </div>
            <div className="prompt-modal__subtitle">
              {taskCount} open task{taskCount === 1 ? '' : 's'}. Paste it into Claude Code in the website repository.
            </div>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <textarea
          ref={textRef}
          className="prompt-modal__text"
          value={prompt}
          readOnly
          spellCheck={false}
          aria-label="Prompt"
        />

        <div className="prompt-modal__foot">
          <span className="prompt-modal__meta">{prompt.length.toLocaleString('en-US')} characters</span>
          {copy === 'copied' ? (
            <span className="settings-form__saved" role="status">
              Copied to the clipboard.
            </span>
          ) : null}
          {copy === 'blocked' ? (
            <span className="settings-form__error" role="alert">
              The browser blocked copying. The text is selected: press Ctrl+C.
            </span>
          ) : null}
          <button type="button" className="btn btn--ghost settings-form__button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn--primary settings-form__button" onClick={() => void copyPrompt()}>
            Copy prompt
          </button>
        </div>
      </div>
    </div>
  );
}
