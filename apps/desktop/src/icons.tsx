// Ícones line art próprios: grade de 20 px, traço 1.5, pontas arredondadas.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Hoje: sol nascendo sobre a linha. */
export const IconToday = (p: P) => (
  <Base {...p}>
    <path d="M3 14.5h14" />
    <path d="M6 14.5a4 4 0 0 1 8 0" />
    <path d="M10 5.5v2M4.6 8.6l1.2 1.2M15.4 8.6l-1.2 1.2" />
  </Base>
);

/** Roadmap: caminho com marcos. */
export const IconRoadmap = (p: P) => (
  <Base {...p}>
    <circle cx="5" cy="4.5" r="1.75" />
    <circle cx="15" cy="10" r="1.75" />
    <circle cx="5" cy="15.5" r="1.75" />
    <path d="M6.75 4.5h4.75a3.5 3.5 0 0 1 0 5.5H13.25M13.25 10H8.5a2.75 2.75 0 0 0 0 5.5H6.75" />
  </Base>
);

export const IconCalendar = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4" width="14" height="13" rx="2.5" />
    <path d="M3 8h14M7 2.5v3M13 2.5v3" />
    <path d="M7 11.5h.01M10 11.5h.01M13 11.5h.01M7 14h.01M10 14h.01" strokeWidth={2} />
  </Base>
);

/** Músicas: colcheia. */
export const IconMusic = (p: P) => (
  <Base {...p}>
    <circle cx="6" cy="15" r="2.25" />
    <circle cx="14.5" cy="13" r="2.25" />
    <path d="M8.25 15V5l8.5-2v10" />
    <path d="M8.25 8l8.5-2" />
  </Base>
);

/** Tocar junto: braço da guitarra com notas caindo. */
export const IconCompanion = (p: P) => (
  <Base {...p}>
    <path d="M4 17V3M8 17V3M12 17V3M16 17V3" opacity={0.45} />
    <rect x="6.25" y="5" width="3.5" height="2.5" rx="1" />
    <rect x="10.25" y="10" width="3.5" height="2.5" rx="1" />
    <path d="M2.5 15h15" />
  </Base>
);

/** Ferramentas: metrônomo. */
export const IconTools = (p: P) => (
  <Base {...p}>
    <path d="M7.6 3h4.8l3.1 14H4.5z" />
    <path d="M10 13.5l4-8" />
    <path d="M6 12.5h8" opacity={0.45} />
  </Base>
);

/** Ajustes: controles deslizantes. */
export const IconSettings = (p: P) => (
  <Base {...p}>
    <path d="M3.5 6h7M14.5 6h2M3.5 14h2M9.5 14h7" />
    <circle cx="12.5" cy="6" r="2" />
    <circle cx="7.5" cy="14" r="2" />
  </Base>
);

/** Laboratório: frasco. */
export const IconLab = (p: P) => (
  <Base {...p}>
    <path d="M8 2.75h4M8.75 2.75v4.5L4.2 15.1A1.5 1.5 0 0 0 5.5 17.25h9a1.5 1.5 0 0 0 1.3-2.15l-4.55-7.85v-4.5" />
    <path d="M6.2 12h7.6" />
  </Base>
);

export const IconPlay = (p: P) => (
  <Base {...p}>
    <path d="M6.5 4.3v11.4a.6.6 0 0 0 .9.5l9-5.7a.6.6 0 0 0 0-1L7.4 3.8a.6.6 0 0 0-.9.5z" />
  </Base>
);

export const IconStop = (p: P) => (
  <Base {...p}>
    <rect x="5" y="5" width="10" height="10" rx="2" />
  </Base>
);

export const IconMinus = (p: P) => (
  <Base {...p}>
    <path d="M5 10h10" />
  </Base>
);

export const IconPlus = (p: P) => (
  <Base {...p}>
    <path d="M5 10h10M10 5v10" />
  </Base>
);

/** Tap: dedo tocando. */
export const IconTap = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="2.5" />
    <path d="M10 3.5a6.5 6.5 0 0 1 6.5 6.5M3.5 10A6.5 6.5 0 0 1 10 3.5" opacity={0.45} />
  </Base>
);

export const IconWave = (p: P) => (
  <Base {...p}>
    <path d="M2.5 10h2l1.5-4 2.5 9 2.5-11 2.5 9 1.5-3h2.5" />
  </Base>
);

/** Acordes: diagrama com três dedos. */
export const IconChords = (p: P) => (
  <Base {...p}>
    <path d="M5 3.5h10M5 3.5v13M8.33 3.5v13M11.67 3.5v13M15 3.5v13M5 7.75h10M5 12h10" />
    <circle cx="8.33" cy="10" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="11.67" cy="5.6" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="15" cy="14.2" r="1.6" fill="currentColor" stroke="none" />
  </Base>
);
