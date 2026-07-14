---
name: Neon Pulse
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cac8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849492'
  outline-variant: '#3a4a48'
  surface-tint: '#00ddd6'
  primary: '#cffffb'
  on-primary: '#003735'
  primary-container: '#00f2ea'
  on-primary-container: '#006a66'
  inverse-primary: '#006a66'
  secondary: '#ffb2b7'
  on-secondary: '#67001b'
  secondary-container: '#ff516a'
  on-secondary-container: '#5b0017'
  tertiary: '#fbf2ff'
  on-tertiary: '#40008c'
  tertiary-container: '#e3d1ff'
  on-tertiary-container: '#7900fe'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#29fcf3'
  primary-fixed-dim: '#00ddd6'
  on-primary-fixed: '#00201e'
  on-primary-fixed-variant: '#00504d'
  secondary-fixed: '#ffdadb'
  secondary-fixed-dim: '#ffb2b7'
  on-secondary-fixed: '#40000d'
  on-secondary-fixed-variant: '#92002a'
  tertiary-fixed: '#ebdcff'
  tertiary-fixed-dim: '#d4bbff'
  on-tertiary-fixed: '#260059'
  on-tertiary-fixed-variant: '#5c00c3'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '800'
    lineHeight: '1.2'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style

This design system is engineered for a high-energy, immersive music discovery experience. It targets a Gen-Z and digital-native audience who views music as a visual and social currency. The brand personality is electric, nocturnal, and rhythmic.

The aesthetic fuses **Glassmorphism** with **Futuristic Neomorphism**. Surfaces feel like dark, polished obsidian, while interactive elements emit a reactive glow. The UI doesn't just sit on the screen; it vibrates with the music through fluid, organic shapes and high-contrast "glitch" accents inspired by modern short-form video culture. The goal is to evoke a "late-night studio" vibe—private, professional, yet intensely creative.

## Colors

The palette is anchored in **Deep Obsidian Black (#0a0a0a)** to provide maximum contrast for neon accents. 

- **Primary (TikTok Cyan):** Used for active states, playback progress, and primary actions. It represents the "energy" of the system.
- **Secondary (TikTok Pink):** Reserved for high-emotion interactions like "Favoriting," recording, or urgent notifications.
- **Tertiary (Vivid Violet):** Used for gradients and background blurs to add depth and a futuristic "vaporwave" undertone.
- **Surface Strategy:** We use a tiered system of translucency. The base is solid black, while "cards" use a semi-transparent dark grey with a 20px background blur and a 1px inner border (rim light) to simulate glass.

## Typography

The typography system balances aggressive, wide headlines with ultra-clean technical body text.

- **Headlines:** Montserrat (ExtraBold/Black) is used to command attention. Letter spacing is tightened to create a dense, modern block-text feel.
- **Body:** Hanken Grotesk provides a sharp, contemporary readability that feels more "tech" than standard system fonts.
- **Labels/Data:** JetBrains Mono is used for timestamps, bitrates, and technical metadata to reinforce the futuristic, "code-adjacent" aesthetic.

## Layout & Spacing

The design system utilizes a **Fluid Grid** with a rhythmic 8px baseline.

- **Desktop:** A 12-column system. The player controls are housed in a fixed right-side "Cockpit" (380px wide), while the music feed and library scroll fluidly in the remaining space.
- **Mobile:** A single-column view where the player becomes a bottom-anchored persistent glass sheet.
- **Margins:** Generous 40px external margins on desktop to allow the background "glows" to breathe.
- **Visual Rhythm:** Elements are grouped using varied padding (16px for internal card elements, 32px for section separation) to mimic the peaks and valleys of a waveform.

## Elevation & Depth

Depth is achieved through **Luminous Layering** rather than traditional shadows.

1.  **Level 0 (Base):** Deep Obsidian Black (#0a0a0a).
2.  **Level 1 (Cards):** Translucent surface (#161616 at 45% opacity) with `backdrop-filter: blur(20px)`.
3.  **Level 2 (Active Elements):** Neumorphic "extruded" buttons. Instead of muddy shadows, use a Cyan light-source (top-left) and a Pink light-source (bottom-right) at very low opacities (10-15%) to create a 3D effect made of light.
4.  **Level 3 (Interactive Glow):** Elements like the active "Play" button or "Now Playing" vinyl record use a `box-shadow` with a massive spread (40px+) and 30% opacity of the primary color to simulate a neon aura.

## Shapes

The shape language is **Organic-Futuristic**. While the base containers use a standard 0.5rem (Rounded) corner to maintain structural integrity, interactive elements and decorative backgrounds use "Squircle" geometries.

Vinyl-inspired elements (track art, playback wheels) are always perfect circles. Progress bars and volume sliders use a pill-shape (fully rounded) to feel smooth and tactile.

## Components

- **Buttons:** Primary buttons use a solid Cyan-to-Violet gradient. Secondary buttons use a "Ghost" style with a 1px neon border.
- **Tactile Player Controls:** The main "Play/Pause" is a large, Neumorphic disc. The "Seeker" is a custom circular waveform visualizer that fills with color as the track progresses.
- **Glass Chips:** Genre and tag chips use a high-blur glass background with Cyan text.
- **List Items:** Track rows feature a hover state that activates a subtle Pink "rim light" border and expands the album art slightly.
- **Input Fields:** Search bars are ultra-minimal—just a bottom border in Cyan that glows when focused, with placeholder text in a dim, monospaced font.
- **The "Pulse" Visualizer:** A unique component that sits behind the track art, vibrating in sync with the low-end frequencies of the audio.