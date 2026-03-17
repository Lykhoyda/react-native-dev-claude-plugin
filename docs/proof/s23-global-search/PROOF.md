# Global Search Screen — E2E Proof

**Date:** 2026-03-18
**Device:** iPhone 17 Pro (iOS 26.3, Simulator)
**Method:** CDP interactions + screenshots (flow designed by architect in Phase 4)

## Flow

| Step | Screenshot | Action | Verification |
|------|-----------|--------|--------------|
| 1 | 01-search-modal-open.jpg | Open search modal via home-search-btn | Modal presented, empty prompt visible, input focused |
| 2 | 02-search-results.jpg | Type "Review" in search | TASKS section header, "Review pull request" with yellow highlight, "1 results" count |
| 3 | 03-no-results.jpg | Type "zzzznotfound" | "No results" state displayed |
| 4 | 04-notification-result.jpg | Type "Welcome" | NOTIFICATIONS section header, "Welcome to the test app" with yellow highlight |

## Key State Snapshots

- Step 2: Tasks filtered by "Review" → 1 match from Redux tasks.items
- Step 3: No matches across all 3 data sources for "zzzznotfound"
- Step 4: Notifications filtered by "Welcome" → 1 match from Redux notifications.items

## CDP Tools Exercised

| Tool | Count | Purpose |
|------|-------|---------|
| cdp_status | 1 | Health check |
| cdp_reload | 7 | Full reloads during implementation + debugging |
| cdp_error_log | 3 | Baseline clear + regression checks |
| cdp_component_tree | 2 | Verify components |
| cdp_interact | 30+ | press, typeText for search flow testing |
| cdp_navigation_state | 2 | Route verification |
| cdp_evaluate | 2 | __NAV_REF__ testing |

## Deviations from Plan

Step 5 (tap result → navigate to TaskDetail) was removed from the final implementation. React Navigation does not support reliable nested tab navigation from a RootStack screen that is being dismissed. Multiple approaches tested:
- `goBack()` + `setTimeout` + `rootNav.navigate()`
- `goBack()` + `__NAV_REF__.navigate()`
- `beforeRemove` listener + `requestAnimationFrame`
- `InteractionManager.runAfterInteractions`
- `CommonActions.reset` with nested params
- `navigate` without `goBack` (stays on search screen)
- Various `presentation` modes: `modal`, `fullScreenModal`, `containedTransparentModal`, `slide_from_bottom`

**Root cause**: When a RootStack screen calls `goBack()`, the component unmounts, and any subsequent navigation calls from that component's closures are garbage collected. When calling `navigate('Tabs', { screen: 'TasksTab', ... })` from the root level, React Navigation pops to the existing Tabs screen but doesn't forward nested params to already-mounted tab navigators.

**Filed as**: B75 — nested tab navigation from dismissed RootStack screens

## Fixes Applied During This Story

| Fix | File | Finding |
|-----|------|---------|
| [RN-2.2] useCallback for onPress inside SearchResultItem | SearchResultItem.tsx | Inline arrow defeated memo() |
| [RN-2.1] useThemeColors() inside component, not as prop | SearchResultItem.tsx | colors object ref broke memoization |
| selectOnboardingComplete exported selector | settingsSlice.ts | Inline anonymous selector in RootNavigator |
| RootNavigator uses selectOnboardingComplete | RootNavigator.tsx | Consistent typed selector pattern |
| selectVisibleNotifications memoized with createSelector | notificationsSlice.ts | .filter() created new refs on every call |
| selectSnoozedCount memoized with createSelector | notificationsSlice.ts | Same issue |
| FAB accessibilityLabel + accessibilityRole | TasksScreen.tsx | Missing a11y on icon-only button |
| handleSync AbortController | TasksScreen.tsx | Post-unmount fetch race condition |

## Files

- `01-search-modal-open.jpg` — Empty search modal with input and prompt
- `02-search-results.jpg` — Task results for "Review" with yellow highlight
- `03-no-results.jpg` — No results state for "zzzznotfound"
- `04-notification-result.jpg` — Notification results for "Welcome" with yellow highlight
