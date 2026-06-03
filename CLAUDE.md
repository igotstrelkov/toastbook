# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier (writes in place)
```

No test runner is configured yet.

## Architecture

This is a **Next.js 16 / React 19** app. **AGENTS.md** warns that Next.js 16 has breaking changes from earlier versions — read `node_modules/next/dist/docs/` before writing routing or API code rather than relying on prior knowledge.

### Styling

Tailwind CSS v4 is used. Tailwind is configured entirely through `app/globals.css` (no `tailwind.config.*` file). Design tokens (colors, radius, fonts) are defined as CSS custom properties in that file and exposed to Tailwind via `@theme inline`. The dark-mode variant is `class`-based (`.dark` class on `<html>`).

### shadcn/ui

Components live in `components/ui/`. Add new ones with:
```bash
npx shadcn@latest add <component-name>
```
The style is `radix-nova`. All aliases resolve through `@/` (e.g. `@/components/ui/button`, `@/lib/utils`, `@/hooks`).

### Theme system

`components/theme-provider.tsx` wraps `next-themes` and wires a global `d` keypress hotkey to toggle dark/light mode. It is mounted at the root in `app/layout.tsx`. The `ThemeHotkey` inner component is intentionally not exported.

### Utility

`lib/utils.ts` exports `cn()` — a `clsx` + `tailwind-merge` helper. Use it for all conditional class merging; Prettier is configured to sort Tailwind classes in `cn()` and `cva()` calls automatically.

### Fonts

Two Google Fonts are loaded in `app/layout.tsx`: `Inter` as `--font-sans` (sans-serif body) and `Geist Mono` as `--font-mono`. Geist (the display font referenced in the original shadcn setup) is not used — `Inter` replaced it.

### Path aliases

`@/*` maps to the repo root. There is no `src/` directory.
