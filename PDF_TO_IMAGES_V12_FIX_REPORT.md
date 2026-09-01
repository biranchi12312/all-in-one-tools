# PDF to Images — V12 Fix Report

## Root cause fixed
The V11 runtime declared both a DOM reference and an async function with the same lexical identifier: `convertMore`.
ES module parsing therefore failed before runtime initialization. Because the module could not parse, the upload controls never received their event handlers, producing the page-level popup and console `SyntaxError: Identifier 'convertMore' has already been declared`.

## V12 correction
- DOM reference renamed to `convertMoreButton`.
- Reset handler renamed to `resetForMore`.
- Event binding now explicitly connects `convertMoreButton` to `resetForMore`.
- No duplicated identifier remains in the PDF to Images module.

## V76 workflow behavior retained and checked
- queued upload serialization through `addChain`
- partial acceptance with per-file validation
- PDF signature/readability inspection
- encrypted/password PDF rejection
- per-file, batch-size, file-count and page-count limits
- duplicate prevention
- file removal and Clear All confirmation lifecycle
- PNG/JPG selection and JPG quality control
- safe canvas dimension/pixel clamping
- sequential page conversion with UI yielding
- per-page progress
- individual download and ZIP download
- Convert More confirmation and full cleanup
- PDF thumbnail fallback and object URL cleanup

The V12 runtime keeps the newer independent/lazy architecture: PDF.js is requested only when the PDF workflow actually needs inspection, thumbnail rendering, or conversion.
