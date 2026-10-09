# Bella Market Feed

Create a mobile-first marketplace web application named "velamarket" (벨라마켓) with a Xiaohongshu (RED / 小红书) style feed layout, full PWA capabilities, and strict Global & Mainland China (GFW-friendly) accessibility standards.



### 1. China & Global Accessibility / Performance Rules (CRITICAL):

- DO NOT use any Google services, Google Fonts, YouTube embeds, or third-party blocked CDNs (e.g., fonts.googleapis.com, cdn.jsdelivr.net from blocked nodes).

- Use local CJK system font stack for clean cross-border typography: 

  `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK KR", sans-serif;`

- Bundle all UI icons locally using bundled packages (e.g., Lucide-react) without fetching runtime external scripts.



### 2. Xiaohongshu (RED) Style 3-Column Masonry Feed Layout:

- Main Feed Display: Implement a 3-column staggered masonry grid (waterfall layout) for content items.

- Dynamic Content Cards:

  - Support variable aspect ratios for photos and video thumbnails organically without bad cropping.

  - Card components: Rounded corners, video duration badge (for video posts), title (2-line clamp), creator avatar + username, heart button with like count, and price tag if it's a product listing.

  - Minimalist, content-focused, aesthetic design similar to Xiaohongshu.



### 3. Mobile PWA & Standalone Full-Screen Configuration:

- Configure Web App Manifest (`manifest.json`) with `"display": "standalone"`.

- Include complete iOS Safari and Android Chrome meta tags (`apple-mobile-web-app-capable`, black-translucent status bar, viewport scale locking) so it opens in full-screen standalone mode when saved to the Home Screen.



### 4. History Stack & Back Button Handling (Prevent Unintended Site Exit):

- Use React Router for all views, tabs, search overlays, and modal popups.

- Implement proper browser history state management (`popstate` handlers / custom modal router) so pressing the mobile device's back button or swiping back closes active drawers/modals or goes back one page instead of exiting the web app.



### 5. Navigation & Core UI Components:

- Fixed Bottom Navigation Bar: Home (Feed), Search/Explore, Upload (+), Market, and My Page.

- Item Detail Drawer/Page: Tapping a card opens a smooth slide-up modal showing image/video carousel, description, seller profile, price, and comment section with a clear close/back button.

- Smooth transitions and mobile touch-friendly UI using Tailwind CSS and Framer Motion.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://testvela2.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/52f40f79-712d-4e56-ad82-cccb76a62224).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
