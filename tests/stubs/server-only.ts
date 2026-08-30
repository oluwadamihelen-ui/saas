// Test stub: the real `server-only` package throws when resolved via
// Node's default export condition (it expects a bundler to redirect it to
// an empty module inside server components). Tests run these modules
// directly under Node, so we alias the import to a no-op here instead.
export {};
