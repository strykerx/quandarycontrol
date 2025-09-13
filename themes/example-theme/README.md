# Art Deco Gold Theme Documentation

## Theme Overview
The Art Deco Gold theme brings the elegance and glamour of the 1920s to your Quandary Control experience. This theme features a sophisticated black and gold color scheme with geometric patterns and period-appropriate typography.

## Design Philosophy
- **Era**: 1920s Art Deco movement
- **Aesthetic**: Geometric patterns, metallic accents, sharp angles
- **Color Palette**: Gold (#FFD700) on Black (#000000) with Dark Gold (#B8860B) accents
- **Typography**: 'Great Vibes' for headings, 'Cinzel Decorative' for body text

## Color Scheme
- **Primary**: #FFD700 (Gold) - Used for main accents, highlights, and interactive elements
- **Secondary**: #000000 (Black) - Background color for dramatic contrast
- **Accent**: #B8860B (Dark Gold) - Secondary accents, borders, and subtle details
- **Text**: #FFFDD0 (Cream) - High-contrast text color for readability

## Typography
### Headings
- **Font**: 'Great Vibes' (Google Fonts)
- **Style**: Elegant cursive script
- **Usage**: Timer display, section titles, decorative elements

### Body Text
- **Font**: 'Cinzel Decorative' (Google Fonts)
- **Style**: Stylized serif with art deco influences
- **Usage**: Chat messages, hints, variable labels, general content

## Design Elements

### Geometric Background Patterns
The theme features subtle geometric patterns created with CSS gradients:
- **Pattern Type**: Diagonal linear gradients forming diamond shapes
- **Opacity**: 0.1 (subtle, non-intrusive)
- **Color**: Gold with transparency
- **Purpose**: Creates authentic art deco atmosphere without overwhelming content

### Component Styling
Each component is carefully styled to maintain the art deco aesthetic:

#### Timer Component
- Large, dramatic display with metallic gold text
- Gradient background for depth
- Sharp angular borders (border-radius: 0)
- Text shadow for metallic effect
- Centered alignment with art deco letter spacing

#### Chat Component
- Gold border with semi-transparent black background
- Decorative phone symbol (✆) as period-appropriate ornament
- Messages with asymmetric corner styling
- Dark gold accent borders on individual messages

#### Hints Component
- Gold border with dark background
- Hint cards with subtle gold tint
- Diamond symbol (◆) decoration on cards
- Consistent sharp angular styling

#### Variables Component
- Clean display with gold borders
- Variable values highlighted in gold
- Separator lines in dark gold
- Flexible layout for different screen sizes

#### Media Component
- Gold-framed lightbox for images/videos
- Circular gold close button
- Semi-transparent overlay
- Responsive sizing for different media types

## Installation Instructions

### 1. Theme Files
Place the theme files in the following structure:
```
themes/
└── example-theme/
    ├── theme-config.json  # Theme configuration
    ├── style.css          # Main stylesheet
    └── README.md          # This documentation
```

### 2. Font Loading
Add the following to your main CSS file to load the required Google Fonts:
```css
@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cinzel+Decorative&display=swap');
```

### 3. Theme Activation
The theme will be automatically available in the Quandary Control theme selector once the files are in place.

## Customization Options

### Color Customization
You can customize the theme colors by modifying the `theme-config.json` file:

```json
"variables": {
  "primary-color": "#FFD700",      // Change main gold color
  "secondary-color": "#000000",    // Change background color
  "accent-color": "#B8860B",       // Change secondary gold
  "text-color": "#FFFDD0"          // Change text color
}
```

### Pattern Customization
Adjust the geometric background pattern visibility:
```json
"variables": {
  "pattern-opacity": "0.1",        // 0 = invisible, 1 = fully visible
  "pattern-color": "rgba(255,215,0,0.1)"  // Change pattern color
}
```

### Border Customization
Modify border styling:
```json
"variables": {
  "border-style": "2px solid #FFD700",  // Change border width/style/color
  "border-radius": "0"                   // 0 = sharp, higher = rounded
}
```

## Responsive Design
The theme includes responsive breakpoints for different screen sizes:

### Desktop (Default)
- Full-size components with generous spacing
- Large timer display (4rem)
- Decorative elements fully visible

### Tablet (768px and below)
- Reduced padding and margins
- Smaller timer display (2.5rem)
- Adjusted decorative element positioning

### Mobile (480px and below)
- Compact layout with minimal spacing
- Optimized touch targets
- Simplified decorative elements

## Accessibility Features

### High Contrast Mode
The theme automatically adapts for users who prefer high contrast:
- Pure white text (#FFFFFF)
- Brighter gold accents (#FFFF00)
- Reduced pattern opacity (0.05)
- Thicker borders (3px)

### Reduced Motion
For users who prefer less animation:
- All transitions disabled
- Animations removed
- Static decorative elements

### Keyboard Navigation
- Clear focus indicators (2px gold outline)
- Logical tab order
- Accessible component structure

### Print Optimization
- White background with black text
- Simplified borders
- Hidden decorative patterns
- Optimized for black and white printing

## Browser Compatibility

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Fallbacks
- Graceful degradation for older browsers
- Solid color fallbacks for CSS variables
- Standard fonts if Google Fonts fail to load
- Basic borders for unsupported CSS features

## Performance Considerations

### CSS Optimization
- Uses CSS variables for efficient theming
- Minimal use of expensive properties
- Optimized gradient patterns
- Efficient selector structure

### Loading Performance
- Single CSS file for all styles
- Google Fonts loaded asynchronously
- No external image dependencies
- Minimal JavaScript requirements

## Best Practices

### Design Consistency
- Maintain gold/black color scheme throughout
- Use sharp angles (border-radius: 0) for authentic deco look
- Apply consistent spacing and padding
- Use decorative elements sparingly

### Content Readability
- Ensure high contrast between text and background
- Use appropriate font sizes for different screen sizes
- Maintain clear visual hierarchy
- Test with different content lengths

### Performance
- Avoid excessive decorative elements
- Use CSS transforms instead of position changes
- Minimize use of expensive filters
- Test on lower-powered devices

## Testing Checklist

### Visual Testing
- [ ] Verify color accuracy across devices
- [ ] Check pattern rendering on different screens
- [ ] Test font loading and fallbacks
- [ ] Verify decorative element positioning

### Responsive Testing
- [ ] Desktop layout (1200px+)
- [ ] Tablet layout (768px - 1199px)
- [ ] Mobile layout (480px - 767px)
- [ ] Small mobile layout (below 480px)

### Accessibility Testing
- [ ] High contrast mode
- [ ] Reduced motion preferences
- [ ] Keyboard navigation
- [ ] Screen reader compatibility

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Performance Testing
- [ ] Load time testing
- [ ] Memory usage monitoring
- [ ] Animation smoothness
- [ ] Mobile performance

## Troubleshooting

### Common Issues

#### Fonts Not Loading
**Problem**: Art deco fonts not displaying
**Solution**: 
1. Check internet connection for Google Fonts
2. Verify font import in main CSS
3. Add font fallbacks in CSS

#### Patterns Not Visible
**Problem**: Geometric background patterns not showing
**Solution**:
1. Check pattern-opacity value (should be > 0)
2. Verify pattern-color has sufficient opacity
3. Check for overlapping elements

#### Colors Not Applying
**Problem**: Theme colors not displaying correctly
**Solution**:
1. Verify theme-config.json syntax
2. Check CSS variable usage
3. Ensure theme is properly selected

#### Responsive Issues
**Problem**: Layout breaking on mobile devices
**Solution**:
1. Check media query syntax
2. Verify viewport meta tag
3. Test with device emulation

### Getting Help
- Check the main Quandary Control documentation
- Review browser developer tools for errors
- Test with browser extensions disabled
- Verify all files are correctly placed

## Contributing
We welcome improvements and enhancements to the Art Deco Gold theme:

1. Fork the theme repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Version History
- **1.0.0**: Initial release with complete art deco styling
- Future versions will include:
  - Additional decorative elements
  - More pattern options
  - Enhanced accessibility features
  - Performance optimizations

## License
This theme is part of Quandary Control and follows the same license terms.