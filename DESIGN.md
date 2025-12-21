# Autohaus Frontend Design System

## Color Palette

The design uses a strict black and white color scheme:

- Text: Black (#000000)
- Background: White (#FFFFFF)
- Links: Black (#000000)
- Borders: Black (#000000)

No colors, gradients, or shades of gray are used in the design.

## Typography

### Font Family
- Primary: Geologica (variable font)
- Weights used:
  - Body text: 600
  - Headers (h1): 900
  - Headers (h2): regular weight from Geologica

### Font Sizes
- Body: clamp(1rem, 1.5vw, 2rem)
- h1: 200% of base
- h2: 150% of base
- h3: 120% of base
- Responsive sizing using clamp for fluid typography

## Layout

### Grid System
- Two-column layout for main content on desktop (min-width: 800px)
- Single column on mobile
- Max width: min(95vw, 2048px)
- Grid gap: 1rem, column gap: 3rem

### Spacing
- Standard margin: 2rem 0 for major elements
- Padding: 0.5rem base, scaled as needed

## Components

### Buttons
- Background: Black (--link-color)
- Text: White (--background-color)
- Letter spacing: 0.4em
- Min width: 280px
- Padding: 0.7em
- No border radius
- No border
- Hover: brightness(120%)
- Active: scale(0.99)

### Cards/Containers
- Bold borders: 0.5rem solid black
- No border radius
- No box shadows
- Background: white
- May use transform: rotate(1deg) for visual interest

### Forms
- Input fields:
  - Width: 100%
  - Height: 3em
  - Border: solid black
  - No border radius

### Navigation
- Clean, minimal
- Black text on white background
- No complex hover effects

## Visual Style

### Principles
- Bold, minimal, high-contrast
- No decorative elements
- No rounded corners
- No shadows
- No gradients
- No icons or symbols (text only)
- Geometric, slightly rotated elements for visual interest
- Strong typographic hierarchy

### Effects
- Slight rotation (transform: rotate(1deg)) for emphasis
- Brightness filters for hover states
- Scale transforms for active states

## Responsive Design

### Breakpoints
- Mobile: default
- Desktop: min-width 800px
- Max content width: min(95vw, 2048px)

### Media Queries
- Font size adjusts fluidly with clamp()
- Layout changes from single to two-column at 800px
- Navigation adapts for mobile (stacked layout)

## Admin Section Specifics

Admin pages should follow the same design principles:

- Remove all colors (blues, purples, reds, greens)
- Remove gradients
- Remove box shadows
- Remove border radius
- Use black and white only
- Remove decorative icons/symbols
- Use bold borders (0.5rem solid) for cards
- Maintain clean, minimal aesthetic
- Use rotation transforms for visual interest
- Follow same typography rules (Geologica, weight 600/900)
