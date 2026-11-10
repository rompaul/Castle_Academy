import type { ReactNode, SVGProps } from "react";

/**
 * V51-009 — 任务 UI 统一 SVG 图标族（DDR-0001 §4：emoji 永久图标替换为圆角几何、一致描边）。
 * 世界内 hover 文案里的 emoji 属文案，不在本图标族范围内。
 */
export type IconName =
  | "mission" | "water" | "check" | "lock" | "hint" | "close" | "pin"
  | "chevron" | "star" | "user" | "arrow" | "build" | "plus" | "play";

const PATHS: Record<IconName, ReactNode> = {
  mission: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  water: <path d="M12 3c3.2 3.6 5.5 6.4 5.5 9.2A5.5 5.5 0 0 1 12 18a5.5 5.5 0 0 1-5.5-5.8C6.5 9.4 8.8 6.6 12 3z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  lock: <><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  hint: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.7h5.2c.1-.6.4-1.2 1-1.7A6 6 0 0 0 12 3z" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pin: <><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5z" /><path d="M12 14v6" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  arrow: <><path d="M4 12h15" /><path d="M14 7l5 5-5 5" /></>,
  build: <><rect x="4" y="9" width="12" height="11" rx="2" /><path d="M16 12h3l2 3-3 3h-2" /><path d="M7 9V6h6v3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8 5l11 7-11 7V5z" />
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
