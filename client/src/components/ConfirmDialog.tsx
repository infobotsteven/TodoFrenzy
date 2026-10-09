import { useEffect, useRef } from 'react';
import { useConfirmStore } from '../confirm';
import { t } from '../i18n';
import { Modal } from './Modal';

/** Okno potwierdzenia (patrz `askConfirm`). Fokus startuje na „Anuluj”, żeby przypadkowy Enter niczego nie usunął. */
export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // natywne okno otwiera się w efekcie Modal (wcześniej niż ten), więc fokus można już ustawić; autoFocus z Reacta ruszyłby za wcześnie
  useEffect(() => {
    if (request) cancelRef.current?.focus();
  }, [request]);
  if (!request) return null;

  const settle = (ok: boolean) => {
    request.resolve(ok);
    useConfirmStore.setState({ request: null });
  };

  return (
    <Modal title={request.title} onClose={() => settle(false)} className="confirm-dialog">
      <p className="confirm-message">{request.message}</p>
      <div className="form-actions">
        <button type="button" className="btn" ref={cancelRef} onClick={() => settle(false)}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-danger-solid" onClick={() => settle(true)}>
          {request.confirmLabel ?? t('common.delete')}
        </button>
      </div>
    </Modal>
  );
}
