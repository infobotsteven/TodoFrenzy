import iconLight from '../assets/logo/odhacz-icon.svg';
import iconDark from '../assets/logo/odhacz-icon-inverse.svg';
import markLight from '../assets/logo/odhacz-mark-ink.svg';
import markDark from '../assets/logo/odhacz-mark-paper.svg';

/**
 * Logo w dwóch wersjach na motyw: obie są w drzewie, a CSS (`.on-light` / `.on-dark` wg `[data-theme]`) ukrywa nieaktywną -
 * dzięki temu przełączenie motywu działa bez ponownego renderowania i bez migania.
 * Ikona (kafelek): ciemny kafelek w jasnym motywie, limonkowy w ciemnym. Znak (bez kafelka): tuszowy na jasnym, papierowy na ciemnym.
 */
function ThemedImage({ light, dark, className }: { light: string; dark: string; className: string }) {
  return (
    <>
      <img src={light} alt="" className={`${className} on-light`} draggable={false} />
      <img src={dark} alt="" className={`${className} on-dark`} draggable={false} />
    </>
  );
}

/** Ikona aplikacji (kafelek ze znakiem) - w pasku u góry. */
export function LogoIcon() {
  return <ThemedImage light={iconLight} dark={iconDark} className="logo-icon" />;
}

/** Sam znak bez kafelka - na ekranie logowania. */
export function LogoMark() {
  return <ThemedImage light={markLight} dark={markDark} className="logo-mark" />;
}
