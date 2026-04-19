# useAutosave

Shared autosave hook for game editor forms. Debounces saves and flashes a brief "Saved: 2:15pm" confirmation.

**Source:** `src/app/games/_gamecore/useAutosave.tsx`
**Export:** `import { useAutosave, SavedFlash } from "@/app/games/_gamecore";`

## API

### `useAutosave(debounceMs?: number)`

Returns:

| Field             | Type                                   | Description                                                                 |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `triggerAutosave` | `() => void`                           | Call on blur, image save, word change, etc. Debounces then calls `saveFnRef` |
| `saveFnRef`       | `MutableRefObject<() => Promise<void>>`| Assign your save function here each render                                  |
| `savedFlash`      | `string \| null`                       | Time string like `"2:15pm"` while visible, `null` when hidden               |
| `flashSaved`      | `() => void`                           | Manually trigger the flash (e.g. after a manual save button)                |

- **Debounce:** defaults to 1500ms. Rapid triggers reset the timer so only one save fires.
- **Concurrency guard:** if a save is in progress, the next trigger waits rather than overlapping.
- **Flash:** shows for 5 seconds in local 12-hour time, then auto-hides.
- **Cleanup:** all timers are cleared on unmount.

### `<SavedFlash time={string} />`

Small presentational component rendering the green pulsing "Saved: {time}" text. Render it conditionally when `savedFlash` is non-null.

## Usage

```tsx
import { useAutosave, SavedFlash } from "@/app/games/_gamecore";

function MyEditor() {
  const { triggerAutosave, saveFnRef, savedFlash, flashSaved } = useAutosave();

  // 1. Define your save function
  const saveDraft = useCallback(async () => {
    await updateDoc(docId, buildInput());
    flashSaved(); // flash on success
  }, [docId, buildInput, flashSaved]);

  // 2. Keep the ref current every render
  saveFnRef.current = saveDraft;

  // 3. Wire up triggers
  return (
    <>
      <input onBlur={triggerAutosave} />
      <button onClick={() => { doSomething(); triggerAutosave(); }}>
        Change Setting
      </button>

      {/* Manual save can also flash */}
      <button onClick={saveDraft}>Save Draft</button>

      {/* Flash indicator */}
      {savedFlash && <SavedFlash time={savedFlash} />}
    </>
  );
}
```

## Where it's used

- **HeistEditor** (`src/app/games/fyve/heists/HeistEditor.tsx`) — autosaves draft heists on input blur, image save, word add/remove, visibility change, bomb selection, and JSON populate.
