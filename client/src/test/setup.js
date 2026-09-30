import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement scrollIntoView; several components call it on refs.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
