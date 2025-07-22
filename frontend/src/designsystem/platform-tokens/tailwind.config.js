/** @type {import('tailwindcss').Config} */
export default {
  "content": [
    "./src/**/*.{html,js,svelte,ts}",
    "./src/designsystem/components/**/*.svelte"
  ],
  "theme": {
    "extend": {
      "colors": {
        "primary": {
          "50": "#f0f9ff",
          "100": "#e0f2fe",
          "200": "#bae6fd",
          "300": "#7dd3fc",
          "400": "#38bdf8",
          "500": "#0ea5e9",
          "600": "#0284c7",
          "700": "#0369a1",
          "800": "#075985",
          "900": "#0c4a6e"
        },
        "secondary": {
          "50": "#f8fafc",
          "100": "#f1f5f9",
          "200": "#e2e8f0",
          "300": "#cbd5e1",
          "400": "#94a3b8",
          "500": "#64748b",
          "600": "#475569",
          "700": "#334155",
          "800": "#1e293b",
          "900": "#0f172a"
        },
        "success": {
          "50": "#f0fdf4",
          "100": "#dcfce7",
          "200": "#bbf7d0",
          "300": "#86efac",
          "400": "#4ade80",
          "500": "#22c55e",
          "600": "#16a34a",
          "700": "#15803d",
          "800": "#166534",
          "900": "#14532d"
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
          "primary": "#fefefe",
          "secondary": "#fafbfc",
          "tertiary": "#f5f6f7",
          "inverse": "#1a1d21"
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
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        "body": [
          "Source Sans 3",
          "Inter",
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
        "lg": "8px",
        "xl": "12px",
        "2xl": "16px",
        "3xl": "24px",
        "full": "9999px"
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
        "base": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        "md": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        "lg": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        "xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
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