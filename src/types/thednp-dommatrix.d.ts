// @thednp/dommatrix ships no usable type declarations (its own .d.ts is
// an empty `export {}`). See src/server/ai/pdf-dommatrix-polyfill.ts for
// why this package is used.
declare module "@thednp/dommatrix" {
  const DOMMatrixPolyfill: new (init?: unknown) => object;
  export default DOMMatrixPolyfill;
}
