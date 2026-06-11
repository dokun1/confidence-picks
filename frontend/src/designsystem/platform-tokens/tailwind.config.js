/** @type {import('tailwindcss').Config} */
export default {
  "content": [
    "./src/**/*.{html,js,ts,tsx}",
    "./src/designsystem/components/**/*.{ts,tsx}"
  ],
  "theme": {
    "extend": {
      "colors": {
        "primary": {
          "50": "#f5f3ff",
          "100": "#ede9fe",
          "200": "#ddd6fe",
          "300": "#c4b5fd",
          "400": "#a78bfa",
          "500": "#8b5cf6",
          "600": "#7c3aed",
          "700": "#6d28d9",
          "800": "#5b21b6",
          "900": "#4c1d95"
        },
        "secondary": {
          "50": "#f7f7fb",
          "100": "#eeeef6",
          "200": "#e0e0ee",
          "300": "#c9c8de",
          "400": "#9b99bf",
          "500": "#6f6d94",
          "600": "#524f73",
          "700": "#3c3a57",
          "800": "#28263b",
          "900": "#1a1828"
        },
        "success": {
          "50": "#effcf9",
          "100": "#d2f6ee",
          "200": "#a8ecdd",
          "300": "#6fdcc6",
          "400": "#34c4a8",
          "500": "#14a88e",
          "600": "#0c8772",
          "700": "#0e6b5c",
          "800": "#0f554a",
          "900": "#0d3f38"
        },
        "error": {
          "50": "#fef2f2",
          "100": "#fee2e2",
          "200": "#fecaca",
          "300": "#fca5a5",
          "400": "#f87171",
          "500": "#ef4444",
          "600": "#dc2626",
          "700": "#b91c1c",
          "800": "#991b1b",
          "900": "#7f1d1d"
        },
        "warning": {
          "50": "#fffbeb",
          "100": "#fef3c7",
          "200": "#fde68a",
          "300": "#fcd34d",
          "400": "#fbbf24",
          "500": "#f59e0b",
          "600": "#d97706",
          "700": "#b45309",
          "800": "#92400e",
          "900": "#78350f"
        },
        "neutral": {
          "0": "#ffffff",
          "50": "#f9fafb",
          "100": "#f3f4f6",
          "200": "#e5e7eb",
          "300": "#d1d5db",
          "400": "#9ca3af",
          "500": "#6b7280",
          "600": "#4b5563",
          "700": "#374151",
          "800": "#1f2937",
          "900": "#111827",
          "950": "#030712",
          "1000": "#000000"
        },
        "surface": {
          "DEFAULT": "var(--color-surface-primary)",
          "primary": "var(--color-surface-primary)",
          "secondary": "var(--color-surface-secondary)",
          "tertiary": "var(--color-surface-tertiary)",
          "inverse": "#1a1d21"
        },
        "border": {
          "DEFAULT": "var(--color-border)"
        },
        "content": {
          "DEFAULT": "var(--color-text-primary)",
          "muted": "var(--color-text-secondary)",
          "subtle": "var(--color-text-tertiary)"
        },
        "accent": {
          "DEFAULT": "var(--color-accent)",
          "strong": "var(--color-accent-strong)",
          "subtle": "var(--color-accent-subtle)",
          "fg": "var(--color-accent-fg)",
          "on-subtle": "var(--color-accent-on-subtle)"
        }
      },
      "spacing": {
        "none": "0px",
        "xxxs": "2px",
        "xxs": "4px",
        "xs": "8px",
        "sm": "12px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "xxl": "48px",
        "xxxl": "64px",
        "layout-section": "80px",
        "layout-container": "96px",
        "layout-page": "128px"
      },
      "fontFamily": {
        "heading": [
          "Nunito",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        "body": [
          "Nunito Sans",
          "Nunito",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        "mono": [
          "JetBrains Mono",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace"
        ]
      },
      "fontSize": {
        "xs": "12px",
        "sm": "14px",
        "base": "16px",
        "lg": "18px",
        "xl": "20px",
        "2xl": "24px",
        "3xl": "30px",
        "4xl": "36px",
        "5xl": "48px",
        "6xl": "60px"
      },
      "fontWeight": {
        "thin": "100",
        "extralight": "200",
        "light": "300",
        "normal": "400",
        "medium": "500",
        "semibold": "600",
        "bold": "700",
        "extrabold": "800",
        "black": "900"
      },
      "lineHeight": {
        "none": "1",
        "tight": "1.25",
        "snug": "1.375",
        "normal": "1.5",
        "relaxed": "1.625",
        "loose": "2"
      },
      "letterSpacing": {
        "tighter": "-0.05em",
        "tight": "-0.025em",
        "normal": "0em",
        "wide": "0.025em",
        "wider": "0.05em",
        "widest": "0.1em"
      },
      "transitionDuration": {
        "instant": "0ms",
        "fast": "150ms",
        "normal": "300ms",
        "slow": "500ms",
        "slower": "750ms",
        "slowest": "1000ms"
      },
      "transitionTimingFunction": {
        "linear": "linear",
        "ease": "ease",
        "ease-in": "ease-in",
        "ease-out": "ease-out",
        "ease-in-out": "ease-in-out",
        "bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)"
      },
      "borderRadius": {
        "none": "0px",
        "sm": "2px",
        "base": "4px",
        "md": "6px",
        "lg": "12px",
        "xl": "16px",
        "2xl": "20px",
        "3xl": "28px",
        "full": "9999px",
        "pill": "9999px"
      },
      "borderWidth": {
        "0": "0px",
        "1": "1px",
        "2": "2px",
        "4": "4px",
        "8": "8px"
      },
      "boxShadow": {
        "none": "none",
        "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "sm": "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        "base": "0 2px 6px -1px rgba(124, 58, 237, 0.12)",
        "md": "0 8px 20px -4px rgba(124, 58, 237, 0.16)",
        "lg": "0 16px 36px -8px rgba(124, 58, 237, 0.20)",
        "xl": "0 26px 56px -14px rgba(124, 58, 237, 0.26)",
        "inner": "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)"
      },
      "width": {
        "icon-xs": "12px",
        "icon-sm": "16px",
        "icon-md": "20px",
        "icon-lg": "24px",
        "icon-xl": "32px",
        "icon-xxl": "40px"
      },
      "height": {
        "icon-xs": "12px",
        "icon-sm": "16px",
        "icon-md": "20px",
        "icon-lg": "24px",
        "icon-xl": "32px",
        "icon-xxl": "40px"
      }
    }
  },
  "plugins": [
    "@tailwindcss/typography"
  ]
};