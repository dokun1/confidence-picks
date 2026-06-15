# Chat Sticky Composer Design

**Date:** 2026-06-15  
**Status:** Approved

## Problem

The compose bar (text field + Send button) in `ChatTab` sits in normal document flow. Once enough messages accumulate, the user must scroll to the bottom to type — the bar is not visible while reading the conversation.

## Goal

Pin the compose bar to the bottom of the viewport at all times when the Chat tab is active, so users can send a message without scrolling.

## Approach

Follow the pattern already established in `WorldCupPicksTab`, which uses a `sticky bottom-0` full-bleed bar. No new abstractions are introduced.

### ChatTab.tsx changes

1. **Spacer** — insert `<div className="h-20" aria-hidden="true" />` after the message list. This prevents the sticky bar from covering the last visible message.
2. **Sticky wrapper** — wrap the `<form>` and the inline error `<p>` in:
   ```
   sticky bottom-0 -mx-sm sm:-mx-lg border-t border-border
   bg-neutral-0/95 px-sm sm:px-lg py-sm
   shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.06)] backdrop-blur
   dark:bg-secondary-900/95
   ```
   The negative horizontal margins cancel the page gutters so the bar spans edge-to-edge, matching `WorldCupPicksTab`.
3. **Remove `mt-lg`** from the `<form>` — the wrapper's `py-sm` handles vertical spacing.

## Test Coverage

### Unit (`ChatTab.test.tsx`)

- Assert the compose wrapper div has both `sticky` and `bottom-0` classes.
- Assert the spacer `<div aria-hidden="true">` is present in the DOM.

### E2E (`group-chat-renders.spec.ts`)

- After clicking the Chat tab, assert the element wrapping the placeholder input has computed CSS `position: sticky` and `bottom: 0px`.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/pages/GroupDetails/ChatTab.tsx` | Add spacer + sticky wrapper, remove `mt-lg` |
| `frontend/src/pages/GroupDetails/ChatTab.test.tsx` | Two new assertions |
| `frontend/tests/e2e/group-chat-renders.spec.ts` | One new CSS assertion |
