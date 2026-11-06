// Spec-Up plugin: adds each spec's `spec_refs` entries (from specs.json) to the
// reference corpus used by [[spec:NAME]], for specs not in the bundled specref data.
export default () => ({
  beforeRender({ spec, state }) {
    for (const entry of spec.spec_refs || []) {
      for (const [name, reference] of Object.entries(entry)) {
        state.specCorpus[name.toLowerCase()] = reference;
      }
    }
  }
});
