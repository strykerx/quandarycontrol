import { componentRegistry } from './components/core/component-registry.js';

class ThemeManager {
  constructor() {
    this.currentTheme = null;
    this.themeRoot = document.documentElement;
    this.styleElement = document.createElement('style');
    document.head.appendChild(this.styleElement);
  }

  async loadTheme(themeName) {
    const themeConfig = await this.loadThemeConfig(themeName);
    await this.validateTheme(themeConfig);
    
    // Clear previous theme
    this.styleElement.textContent = '';
    this.themeRoot.className = '';
    
    // Apply new theme
    this.currentTheme = themeName;
    this.themeRoot.classList.add(`theme-${themeName}`);
    this.applyThemeStyles(themeConfig);
    this.registerThemeComponents(themeConfig);
  }

  async loadThemeConfig(themeName) {
    const response = await fetch(`/themes/${themeName}/theme-config.json`);
    if (!response.ok) throw new Error('Theme config not found');
    return response.json();
  }

  async validateTheme(config) {
    const requiredFields = ['name', 'version', 'components', 'styles'];
    const requiredComponentProps = ['selector', 'template'];
    
    if (!requiredFields.every(f => f in config)) {
      throw new Error('Invalid theme configuration');
    }
    
    for (const [component, props] of Object.entries(config.components)) {
      if (!requiredComponentProps.every(p => p in props)) {
        throw new Error(`Invalid config for ${component}`);
      }
    }
  }

  applyThemeStyles(config) {
    let css = `/* ${config.name} v${config.version} */\n`;
    
    // Base styles
    if (config.styles?.base) {
      css += `:root {\n${Object.entries(config.styles.base)
        .map(([prop, val]) => `  --${prop}: ${val};`).join('\n')}\n}\n`;
    }
    
    // Component styles
    for (const [component, { styles }] of Object.entries(config.components)) {
      css += `[data-component="${component}"] { ${styles} }\n`;
    }
    
    this.styleElement.textContent = css;
  }

  registerThemeComponents(config) {
    for (const [component, { selector, template }] of Object.entries(config.components)) {
      componentRegistry.registerThemeAdapter(component, {
        selector,
        template,
        applyToComponent(instance) {
          instance.element.setAttribute('data-theme-component', component);
          instance.element.innerHTML = template;
        }
      });
    }
  }
}

export const themeManager = new ThemeManager();