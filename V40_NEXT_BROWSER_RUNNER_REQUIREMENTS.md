# v40 Next Browser Runner Requirements

Before every interaction step, the runner must assert the exact dedicated URL.

For each tool:
1. Navigate directly to the tool route.
2. Wait for `document.readyState === "complete"`.
3. Assert `location.pathname` equals the expected route.
4. Assert the tool root and upload selector exist in the same document.
5. Only then attach/upload the fixture.
6. After every popup/navigation-capable action, re-assert the route and root before querying again.
7. Capture console errors and page errors separately from expected validation dialogs.
8. Mark a workflow failure as a **tool failure** only when the runner can prove the failing selector lookup occurred on the expected route.

This prevents route/context failures from being misreported as production regressions.
