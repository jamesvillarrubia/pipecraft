/**
 * Frontend Domain
 *
 * This is placeholder code demonstrating a frontend application.
 * Used to test PipeCraft's domain detection and testing workflows.
 */

console.log('Frontend domain loaded')

// UI Component rendering
function renderComponent(name, props) {
  return {
    type: name,
    props: props || {},
    render: () => `<${name} />`
  }
}

// State management
function createStore(initialState) {
  let state = { ...initialState }
  return {
    getState: () => state,
    setState: newState => {
      state = { ...state, ...newState }
    }
  }
}

export { renderComponent, createStore }
