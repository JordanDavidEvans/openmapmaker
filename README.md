# Open Map Maker

A single-page Leaflet builder for creating embeddable maps (for custom HTML widgets on platforms like Duda, Squarespace, and Webflow). Drag and drop markers, circles, polygons, and rectangles, or use the built-in Leaflet Draw toolbar to sketch service areas and advanced map overlays. The page outputs a copy-paste embed snippet with the required scripts and styles.

## Features
- **Create presets:** Simple map maker (OSM tiles), Advanced map maker (topographic tiles), and Service area map (high-contrast tiles).
- **Draw toolkit:** Drag-and-drop palette plus Leaflet Draw controls for markers, circles, polygons, and rectangles.
- **Customization:** Accent color, default radius, fill opacity, stroke weight, center/zoom, and optional tooltip labels.
- **Embed ready:** Generates an HTML snippet that includes Leaflet assets and rebuilds all shapes without external dependencies beyond Leaflet.
- **Export helpers:** Copy to clipboard or download the generated HTML.

## Usage
1. Open `index.html` in a browser.
2. Choose a map style, center/zoom, and visual defaults on the left.
3. Drag tools from the palette onto the map or use the Leaflet Draw toolbar to add and edit shapes.
4. Copy or download the embed code from the bottom panel and paste it into your site.

The embed snippet regenerates the tile layer and every shape you place on the map, making it easy to reuse the configuration elsewhere.
