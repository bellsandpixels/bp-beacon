// Pure updates over a walk's local state (WalkState), used by WalkSurfacePane for its optimistic writes AND for
// rolling one back when the adapter call fails. The pane shows the change at once, then saves it; if the save
// throws, the change is undone, so the pane never shows a mark or a flag the server does not have. (Found
// 2026-10-09: a walk whose start had failed kept showing "4 / 4 walked, 1 flagged" while every save threw, and
// the tester's flags never reached the portal.) Each update returns a new object; nothing is mutated.
/** Mark a surface walked (`on`) or not walked. */
export function withWalked(s, surfaceKey, on) {
    const walked = { ...s.walked };
    if (on)
        walked[surfaceKey] = true;
    else
        delete walked[surfaceKey];
    return { ...s, walked };
}
/** Set (or add) a flagged check's note. An empty note is still a flag: in progress, not yet counted. */
export function withDefect(s, checkRef, note) {
    return { ...s, defects: { ...s.defects, [checkRef]: note } };
}
/** Clear these flagged checks. */
export function withoutDefects(s, checkRefs) {
    if (!checkRefs.length)
        return s;
    const defects = { ...s.defects };
    for (const n of checkRefs)
        delete defects[n];
    return { ...s, defects };
}
/** Put flags back exactly as they were (the rollback of a clear). */
export function withDefects(s, entries) {
    if (!entries.length)
        return s;
    const defects = { ...s.defects };
    for (const [n, note] of entries)
        defects[n] = note;
    return { ...s, defects };
}
/** Whether a check is flagged (an own key, so a note of '' still counts as flagged). */
export function isFlagged(s, checkRef) {
    return Object.prototype.hasOwnProperty.call(s.defects, checkRef);
}
/** The message a failed start shows. Never empty: a blank error would read as no error at all. */
export function startFailureMessage(e) {
    const m = e instanceof Error ? e.message.trim() : '';
    return m || 'The walk could not be started.';
}
