import { t } from '../i18n';
import { PAGE_SIZES, type PageSize } from '../store';

type Props = {
  /** Liczba wszystkich pozycji (po filtrach) */
  total: number;
  /** Bieżąca strona (od 1) */
  page: number;
  /** Pozycji na stronie; 0 = wszystkie */
  pageSize: PageSize;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
};

/** Numery stron do pokazania: pierwsza, ostatnia i okolice bieżącej; luki jako `null` (wielokropek). */
function pageItems(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const items: (number | null)[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1]! > 1) items.push(null);
    items.push(p);
  });
  return items;
}

/**
 * Paginacja: zakres pozycji, przyciski poprzednia/następna, numery stron i wybór liczby pozycji na stronie.
 * Nic nie pokazuje, gdy wszystkie pozycje mieszczą się na najmniejszej stronie.
 */
export function Pagination({ total, page, pageSize, onPage, onPageSize }: Props) {
  const smallest = Math.min(...PAGE_SIZES.filter((s) => s > 0));
  if (total <= smallest) return null;

  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const from = pageSize === 0 ? 1 : (page - 1) * pageSize + 1;
  const to = pageSize === 0 ? total : Math.min(total, page * pageSize);

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <span className="pagination-range" aria-live="polite">
        {t('pagination.range', { from, to, total })}
      </span>

      {pageCount > 1 && (
        <div className="pagination-pages">
          <button type="button" className="btn btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('pagination.prev')}>
            ‹
          </button>
          {pageItems(page, pageCount).map((item, i) =>
            item === null ? (
              <span key={`gap-${i}`} className="pagination-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={item === page ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
                onClick={() => onPage(item)}
                aria-label={t('pagination.page', { n: item })}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            ),
          )}
          <button type="button" className="btn btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label={t('pagination.next')}>
            ›
          </button>
        </div>
      )}

      <label className="sort-control">
        <span>{t('pagination.perPage')}</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value) as PageSize)} aria-label={t('pagination.perPageLabel')}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size === 0 ? t('common.all') : size}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
