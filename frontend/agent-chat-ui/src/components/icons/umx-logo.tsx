import * as React from "react";

type LogoProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * UMX X-shaped core symbol.
 * 来源: ~/.claude/skills/umx-brand-guide/assets/logo/logo-symbol-X.svg
 * 用 currentColor 以适配深/浅主题切换。
 */
export function UmxSymbol({ size = 24, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    >
      <path
        d="M80 80H68.42L68.26 79.75C62.05 70.07 51.49 64.28 40 64.28C28.51 64.28 17.95 70.06 11.74 79.75L11.58 80H0V68.5L0.25 68.34C10.01 62.15 15.84 51.55 15.84 40C15.84 28.45 10.01 17.86 0.25 11.66L0 11.5V0H11.46L11.62 0.26C17.81 10.06 28.42 15.92 40 15.92C51.58 15.92 62.19 10.07 68.38 0.26L68.54 0H80V11.59L79.75 11.75C70.07 17.96 64.29 28.52 64.29 40C64.29 51.48 70.07 62.04 79.75 68.25L80 68.41V80ZM69.02 78.9H78.91V69.01C69.07 62.58 63.2 51.76 63.2 40C63.2 28.24 69.07 17.42 78.91 10.99V1.1H69.15C62.74 11.07 51.86 17.01 40.01 17.01C28.16 17.01 17.28 11.07 10.87 1.1H1.11V10.9C11.04 17.32 16.96 28.17 16.96 40C16.96 51.83 11.04 62.68 1.11 69.1V78.9H11C17.43 69.05 28.25 63.18 40.02 63.18C51.79 63.18 62.61 69.05 69.04 78.9H69.02Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function UmxWordmark({
  size = 56,
  ...props
}: LogoProps & { className?: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        textTransform: "uppercase",
        color: "currentColor",
      }}
      {...(props as React.HTMLAttributes<HTMLSpanElement>)}
    >
      UMX
    </span>
  );
}
