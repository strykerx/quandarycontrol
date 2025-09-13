class ComponentRegistry {
  constructor() {
    this.components = new Map();
    this.themeAdapters = new WeakMap();
  }

  registerComponent(name, { componentClass, defaultTemplate }) {
    this.components.set(name, {
      Class: componentClass,
      instances: new Set(),
      defaultTemplate
    });
  }

  createComponent(name, element, options = {}) {
    const componentDef = this.components.get(name);
    if (!componentDef) throw new Error(`Component ${name} not registered`);

    // Create component instance
    const instance = new componentDef.Class(element, options);
    componentDef.instances.add(instance);

    // Apply theme adapter if exists
    const themeAdapter = this.themeAdapters.get(element);
    if (themeAdapter) {
      themeAdapter.applyToComponent(instance);
    }

    return instance;
  }

  registerThemeAdapter(element, adapter) {
    this.themeAdapters.set(element, adapter);
  }
}

// Export singleton instance
export const componentRegistry = new ComponentRegistry();