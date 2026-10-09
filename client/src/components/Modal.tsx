import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n';

type Props = { title: string; onClose: () => void; children: ReactNode; className?: string };

/** Okno modalne oparte o natywny <dialog> (Esc, focus trap i backdrop dostajemy za darmo). */
export function Modal({ title, onClose, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={className ? `modal ${className}` : 'modal'}
      onClose={onClose}
      // klik w tło (sam <dialog>, nie jego zawartość) zamyka okno
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="modal-body">
        <div className="modal-head">
          <h2 className="card-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={() => ref.current?.close()}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

