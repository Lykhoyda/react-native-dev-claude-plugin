# S11: Multi-Step Task Creation Wizard — E2E Proof

**Date:** 2026-03-16
**Device:** iPhone 17 Pro (iOS 26.3, Simulator)
**Method:** CDP interactions + screenshots (flow designed by architect in Phase 4)

## Flow

| Step | Screenshot | Action | Verification |
|------|-----------|--------|--------------|
| 1 | 01-tasks-with-fab.jpg | Navigate to Tasks tab | FAB visible bottom-right, 3 tasks in list |
| 2 | 02-wizard-step1.jpg | Tap FAB → navigate to TaskWizard | Modal open, step 1 active (blue dot), title + description inputs |
| 3 | 03-validation-error.jpg | Tap Next with empty title | Red error: "Title must be at least 3 characters" |
| 4 | 04-wizard-step2.jpg | Enter title + description, tap Next | Step 2 active, priority pills (Med selected default), tag chips |
| 5 | 05-selections-active.jpg | Select High priority + Bug/Feature tags | High pill active with border, Bug/Feature chips blue |
| 6 | 06-wizard-step3.jpg | Tap Next | Review card: title, description, High badge, Bug+Feature tags |
| 7 | 07-task-created.jpg | Tap Create Task | Modal dismissed, task list shows "Build dashboard screen" at top |

## Key State Snapshots

- After step 7: `tasks.items[0] = { id: "4", title: "Build dashboard screen", description: "Analytics cards with chart widgets", priority: "high", tags: ["Bug", "Feature"], done: false, synced: false }`
- Task count: 4 (was 3), active count: 3 (was 2)
- Badge updated to 3

## Deviations from Plan

- Step 6 required an extra Next press — the first cdp_interact call for wizard-next-btn succeeded but the animation hadn't completed, so the step state was still 1. Second press advanced correctly.
- wizard-create-btn was not found on first attempt because step hadn't visually advanced yet. Retry after confirming step 2 succeeded.

## Files

- `01-tasks-with-fab.jpg` — Tasks screen with blue FAB button (bottom-right)
- `02-wizard-step1.jpg` — Wizard modal, Step 1: Title & Description form
- `03-validation-error.jpg` — Validation error on empty title
- `04-wizard-step2.jpg` — Step 2: Priority & Tags selection
- `05-selections-active.jpg` — High priority + Bug/Feature tags selected
- `06-wizard-step3.jpg` — Step 3: Review card with all selections
- `07-task-created.jpg` — Tasks screen with new task at top of list
