import "@testing-library/jest-dom";

// jsdom does not implement scrollIntoView; Radix UI's Select calls it when
// positioning the open listbox, which otherwise throws inside a passive
// effect and surfaces as an unhandled rejection in every test that opens one.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
