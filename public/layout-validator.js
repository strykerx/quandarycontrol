/**
 * Layout Validator for Quandary Control System
 * Provides JSON Schema validation for layout configurations using AJV
 */

class LayoutValidator {
    constructor() {
        this.schema = this.getLayoutSchema();
        this.ajv = this.initializeAJV();
        this.validate = this.ajv.compile(this.schema);
        
        console.log('LayoutValidator initialized');
    }
    
    initializeAJV() {
        // Check if AJV is available, if not provide a simple fallback
        if (typeof ajv !== 'undefined') {
            return new ajv({ allErrors: true, verbose: true });
        } else {
            console.warn('AJV not available, using fallback validation');
            return this.createFallbackValidator();
        }
    }
    
    createFallbackValidator() {
        return {
            compile: (schema) => {
                return (data) => {
                    return this.fallbackValidate(data, schema);
                };
            }
        };
    }
    
    fallbackValidate(data, schema) {
        // Simple fallback validation for when AJV is not available
        const errors = [];
        
        // Basic structure validation
        if (!data || typeof data !== 'object') {
            errors.push('Layout configuration must be an object');
            return { valid: false, errors };
        }
        
        // Validate layouts object
        if (!data.layouts || typeof data.layouts !== 'object') {
            errors.push('Layout configuration must contain a "layouts" object');
            return { valid: false, errors };
        }
        
        // Validate each layout type
        const validTypes = ['default', 'mobile', 'compact'];
        for (const [layoutType, layoutConfig] of Object.entries(data.layouts)) {
            if (!validTypes.includes(layoutType)) {
                errors.push(`Invalid layout type: ${layoutType}`);
                continue;
            }
            
            if (!layoutConfig || typeof layoutConfig !== 'object') {
                errors.push(`Layout configuration for "${layoutType}" must be an object`);
                continue;
            }
            
            // Validate grid or flex configuration
            if (layoutConfig.grid) {
                if (!layoutConfig.grid.template) {
                    errors.push(`Grid layout for "${layoutType}" must have a template`);
                }
            } else if (layoutConfig.flex) {
                if (!layoutConfig.flex.direction) {
                    errors.push(`Flex layout for "${layoutType}" must have a direction`);
                }
            } else {
                errors.push(`Layout configuration for "${layoutType}" must have either grid or flex configuration`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    getLayoutSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            title: "Layout Configuration Schema",
            description: "Schema for validating layout configurations in Quandary Control",
            type: "object",
            required: ["layouts"],
            properties: {
                layouts: {
                    type: "object",
                    description: "Layout configurations for different screen sizes and types",
                    required: ["default"],
                    properties: {
                        default: {
                            type: "object",
                            description: "Default layout configuration",
                            oneOf: [
                                {
                                    title: "Grid Layout",
                                    type: "object",
                                    required: ["grid"],
                                    properties: {
                                        grid: {
                                            type: "object",
                                            required: ["template"],
                                            properties: {
                                                template: {
                                                    type: "string",
                                                    description: "CSS grid-template-columns value",
                                                    examples: ["1fr 2fr", "1fr 1fr 1fr", "2fr 1fr"],
                                                    pattern: "^([0-9]+fr|auto|minmax\\([^)]+\\)|repeat\\([^)]+\\))(\\s+([0-9]+fr|auto|minmax\\([^)]+\\)|repeat\\([^)]+\\)))*$"
                                                },
                                                gap: {
                                                    type: "string",
                                                    description: "CSS gap value",
                                                    examples: ["10px", "1rem", "0.5em"],
                                                    pattern: "^[0-9]+(px|rem|em|%)$"
                                                },
                                                areas: {
                                                    type: "array",
                                                    description: "CSS grid-template-areas configuration",
                                                    items: {
                                                        type: "string",
                                                        pattern: "^[a-zA-Z0-9_\\s]+$"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                {
                                    title: "Flex Layout",
                                    type: "object",
                                    required: ["flex"],
                                    properties: {
                                        flex: {
                                            type: "object",
                                            required: ["direction"],
                                            properties: {
                                                direction: {
                                                    type: "string",
                                                    enum: ["row", "column", "row-reverse", "column-reverse"],
                                                    description: "CSS flex-direction value"
                                                },
                                                wrap: {
                                                    type: "string",
                                                    enum: ["nowrap", "wrap", "wrap-reverse"],
                                                    description: "CSS flex-wrap value"
                                                },
                                                justify: {
                                                    type: "string",
                                                    enum: ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"],
                                                    description: "CSS justify-content value"
                                                },
                                                align: {
                                                    type: "string",
                                                    enum: ["stretch", "flex-start", "flex-end", "center", "baseline"],
                                                    description: "CSS align-items value"
                                                },
                                                gap: {
                                                    type: "string",
                                                    description: "CSS gap value",
                                                    examples: ["10px", "1rem", "0.5em"],
                                                    pattern: "^[0-9]+(px|rem|em|%)$"
                                                }
                                            }
                                        }
                                    }
                                }
                            ]
                        },
                        mobile: {
                            type: "object",
                            description: "Mobile-specific layout configuration",
                            oneOf: [
                                {
                                    title: "Mobile Grid Layout",
                                    type: "object",
                                    required: ["grid"],
                                    properties: {
                                        grid: {
                                            type: "object",
                                            required: ["template"],
                                            properties: {
                                                template: {
                                                    type: "string",
                                                    description: "CSS grid-template-columns value for mobile",
                                                    examples: ["1fr", "1fr 1fr"],
                                                    pattern: "^([0-9]+fr|auto|minmax\\([^)]+\\)|repeat\\([^)]+\\))(\\s+([0-9]+fr|auto|minmax\\([^)]+\\)|repeat\\([^)]+\\)))*$"
                                                },
                                                gap: {
                                                    type: "string",
                                                    description: "CSS gap value for mobile",
                                                    examples: ["8px", "0.5rem"],
                                                    pattern: "^[0-9]+(px|rem|em|%)$"
                                                }
                                            }
                                        }
                                    }
                                },
                                {
                                    title: "Mobile Flex Layout",
                                    type: "object",
                                    required: ["flex"],
                                    properties: {
                                        flex: {
                                            type: "object",
                                            required: ["direction"],
                                            properties: {
                                                direction: {
                                                    type: "string",
                                                    enum: ["row", "column", "row-reverse", "column-reverse"],
                                                    description: "CSS flex-direction value for mobile"
                                                },
                                                breakpoint: {
                                                    type: "string",
                                                    description: "CSS media query breakpoint",
                                                    examples: ["768px", "640px", "1024px"],
                                                    pattern: "^[0-9]+(px|rem|em)$"
                                                },
                                                gap: {
                                                    type: "string",
                                                    description: "CSS gap value for mobile",
                                                    examples: ["8px", "0.5rem"],
                                                    pattern: "^[0-9]+(px|rem|em|%)$"
                                                }
                                            }
                                        }
                                    }
                                }
                            ]
                        },
                        compact: {
                            type: "object",
                            description: "Compact layout configuration",
                            oneOf: [
                                {
                                    title: "Compact Grid Layout",
                                    type: "object",
                                    required: ["grid"],
                                    properties: {
                                        grid: {
                                            type: "object",
                                            required: ["template"],
                                            properties: {
                                                template: {
                                                    type: "string",
                                                    description: "CSS grid-template-columns value for compact layout",
                                                    examples: ["1fr"],
                                                    pattern: "^([0-9]+fr|auto|minmax\\([^)]+\\)|repeat\\([^)]+\\))(\\s+([0-9]+fr|auto|minmax\\([^)]+\\)|repeat\\([^)]+\\)))*$"
                                                },
                                                spacing: {
                                                    type: "string",
                                                    description: "Spacing between elements in compact layout",
                                                    examples: ["4px", "8px", "0.25rem"],
                                                    pattern: "^[0-9]+(px|rem|em|%)$"
                                                }
                                            }
                                        },
                                        hideNonEssential: {
                                            type: "boolean",
                                            description: "Whether to hide non-essential elements in compact layout",
                                            default: true
                                        }
                                    }
                                },
                                {
                                    title: "Compact Flex Layout",
                                    type: "object",
                                    required: ["flex"],
                                    properties: {
                                        flex: {
                                            type: "object",
                                            required: ["direction"],
                                            properties: {
                                                direction: {
                                                    type: "string",
                                                    enum: ["row", "column"],
                                                    description: "CSS flex-direction value for compact layout"
                                                },
                                                spacing: {
                                                    type: "string",
                                                    description: "Spacing between elements in compact layout",
                                                    examples: ["4px", "8px", "0.25rem"],
                                                    pattern: "^[0-9]+(px|rem|em|%)$"
                                                }
                                            }
                                        },
                                        hideNonEssential: {
                                            type: "boolean",
                                            description: "Whether to hide non-essential elements in compact layout",
                                            default: true
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    additionalProperties: false
                },
                breakpoints: {
                    type: "object",
                    description: "Custom breakpoint definitions",
                    properties: {
                        mobile: {
                            type: "string",
                            description: "Mobile breakpoint",
                            examples: ["768px", "640px"],
                            pattern: "^[0-9]+(px|rem|em)$"
                        },
                        tablet: {
                            type: "string",
                            description: "Tablet breakpoint",
                            examples: ["1024px", "768px"],
                            pattern: "^[0-9]+(px|rem|em)$"
                        },
                        desktop: {
                            type: "string",
                            description: "Desktop breakpoint",
                            examples: ["1200px", "1024px"],
                            pattern: "^[0-9]+(px|rem|em)$"
                        }
                    },
                    additionalProperties: {
                        type: "string",
                        pattern: "^[0-9]+(px|rem|em)$"
                    }
                },
                theme: {
                    type: "object",
                    description: "Theme-specific layout settings",
                    properties: {
                        colors: {
                            type: "object",
                            description: "Color overrides for layout elements",
                            additionalProperties: {
                                type: "string",
                                pattern: "^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$|^[a-zA-Z]+$"
                            }
                        },
                        spacing: {
                            type: "object",
                            description: "Spacing overrides",
                            properties: {
                                unit: {
                                    type: "string",
                                    enum: ["px", "rem", "em", "%"],
                                    description: "Default spacing unit"
                                },
                                scale: {
                                    type: "number",
                                    description: "Spacing scale factor",
                                    minimum: 0.1,
                                    maximum: 3
                                }
                            }
                        }
                    }
                }
            },
            additionalProperties: false
        };
    }
    
    validateLayout(layoutConfig) {
        try {
            // Parse the configuration if it's a string
            const config = typeof layoutConfig === 'string' ? JSON.parse(layoutConfig) : layoutConfig;
            
            // Validate against schema
            const valid = this.validate(config);
            
            if (valid) {
                return {
                    valid: true,
                    errors: [],
                    config
                };
            } else {
                // Format errors for better readability
                const errors = this.validate.errors.map(error => {
                    const path = error.instancePath || error.schemaPath;
                    return `${path}: ${error.message}`;
                });
                
                return {
                    valid: false,
                    errors,
                    config
                };
            }
        } catch (error) {
            return {
                valid: false,
                errors: [`Invalid JSON: ${error.message}`],
                config: null
            };
        }
    }
    
    getSchema() {
        return this.schema;
    }
    
    getExampleConfigurations() {
        return {
            default: {
                layouts: {
                    default: {
                        grid: {
                            template: "1fr 2fr",
                            gap: "10px"
                        }
                    },
                    mobile: {
                        grid: {
                            template: "1fr",
                            gap: "8px"
                        }
                    }
                }
            },
            mobile: {
                layouts: {
                    default: {
                        flex: {
                            direction: "column",
                            gap: "10px"
                        }
                    },
                    mobile: {
                        flex: {
                            direction: "column",
                            breakpoint: "768px",
                            gap: "8px"
                        }
                    }
                }
            },
            compact: {
                layouts: {
                    default: {
                        grid: {
                            template: "1fr",
                            spacing: "8px"
                        },
                        hideNonEssential: true
                    }
                }
            },
            custom: {
                layouts: {
                    default: {
                        grid: {
                            template: "200px 1fr 200px",
                            gap: "15px",
                            areas: ["header header header", "sidebar main aside", "footer footer footer"]
                        }
                    },
                    mobile: {
                        grid: {
                            template: "1fr",
                            gap: "10px"
                        }
                    }
                },
                breakpoints: {
                    mobile: "640px",
                    tablet: "1024px",
                    desktop: "1200px"
                }
            }
        };
    }
    
    validateAndFix(layoutConfig) {
        const result = this.validateLayout(layoutConfig);
        
        if (result.valid) {
            return result;
        }
        
        // Try to fix common issues
        try {
            const config = typeof layoutConfig === 'string' ? JSON.parse(layoutConfig) : layoutConfig;
            
            // Ensure layouts object exists
            if (!config.layouts) {
                config.layouts = {};
            }
            
            // Ensure default layout exists
            if (!config.layouts.default) {
                config.layouts.default = {
                    grid: {
                        template: "1fr 2fr",
                        gap: "10px"
                    }
                };
            }
            
            // Validate the fixed configuration
            const fixedResult = this.validateLayout(config);
            if (fixedResult.valid) {
                return {
                    valid: true,
                    errors: [],
                    config,
                    fixed: true
                };
            }
        } catch (error) {
            // If fixing fails, return original error
        }
        
        return result;
    }
}

// Create global instance
window.LayoutValidator = LayoutValidator;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.layoutValidator = new LayoutValidator();
    });
} else {
    window.layoutValidator = new LayoutValidator();
}

console.log('🎨 Layout Validator loaded');