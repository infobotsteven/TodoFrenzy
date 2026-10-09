import { create } from 'zustand';

export type ConfirmOptions = {
  title: string;
  message: string;
  /** Napis na przycisku potwierdzenia (domyślnie „Usuń”) */
  confirmLabel?: string;
};

type ConfirmState = {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
};

export const useConfirmStore = create<ConfirmState>(() => ({ request: null }));

/**
 * Okno potwierdzenia w stylu aplikacji (zamiast `window.confirm`). Zwraca `true` po potwierdzeniu, `false` po anulowaniu,
 * Esc albo kliknięciu w tło. Renderuje je `ConfirmDialog` zamontowany w `App`.
 * Użycie: `if (await askConfirm({ title: 'Usunąć listę?', message: '…' })) { … }`
 */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  // druga prośba, zanim pierwsza została rozstrzygnięta, anuluje pierwszą
  useConfirmStore.getState().request?.resolve(false);
  return new Promise((resolve) => {
    useConfirmStore.setState({ request: { ...options, resolve } });
  });
}
