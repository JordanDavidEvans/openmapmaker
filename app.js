document.addEventListener('DOMContentLoaded', () => {
  const mapStyleSelect = document.getElementById('mapStyle');
  const centerLatInput = document.getElementById('centerLat');
  const centerLngInput = document.getElementById('centerLng');
  const zoomInput = document.getElementById('zoom');
  const accentInput = document.getElementById('accent');
  const radiusInput = document.getElementById('radius');
  const fillInput = document.getElementById('fill');
  const strokeInput = document.getElementById('stroke');
  const descriptionInput = document.getElementById('description');
  const embedOutput = document.getElementById('embed');
  const resetButton = document.getElementById('reset');
  const updateButton = document.getElementById('update');
  const copyButton = document.getElementById('copy');
  const downloadButton = document.getElementById('download');

  const tileLayers = {
    simple: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
    advanced: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution:
        'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    },
    service: {
      url: 'https://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png',
      attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data &copy; OpenStreetMap contributors',
    },
  };

  const initialLatLng = [parseFloat(centerLatInput.value), parseFloat(centerLngInput.value)];
  const initialZoom = parseInt(zoomInput.value, 10);

  const map = L.map('map', {
    zoomControl: true,
    scrollWheelZoom: true,
  }).setView(initialLatLng, initialZoom);

  let baseLayer = L.tileLayer(tileLayers.simple.url, { attribution: tileLayers.simple.attribution }).addTo(map);

  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    edit: {
      featureGroup: drawnItems,
    },
    draw: {
      polyline: false,
      polygon: true,
      rectangle: true,
      circle: true,
      marker: true,
      circlemarker: false,
    },
  });

  map.addControl(drawControl);

  const paletteItems = document.querySelectorAll('.palette-item');
  const mapElement = document.getElementById('map');

  paletteItems.forEach((item) => {
    item.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('shape', item.dataset.type);
    });
  });

  mapElement.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  mapElement.addEventListener('drop', (event) => {
    event.preventDefault();
    const shape = event.dataTransfer.getData('shape');
    if (!shape) return;
    const rect = mapElement.getBoundingClientRect();
    const point = L.point(event.clientX - rect.left, event.clientY - rect.top);
    const latlng = map.containerPointToLatLng(point);
    addShape(shape, latlng);
  });

  function addShape(shape, latlng) {
    const accent = accentInput.value;
    const radius = Number(radiusInput.value) || 500;
    const fillOpacity = Number(fillInput.value) || 0.35;
    const weight = Number(strokeInput.value) || 2;
    const tooltip = descriptionInput.value.trim();

    const sharedStyle = { color: accent, weight, fillColor: accent, fillOpacity };

    if (shape === 'marker') {
      const marker = L.marker(latlng, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div style="width:14px;height:14px;border-radius:999px;background:${accent};box-shadow:0 0 0 6px rgba(52,211,153,0.22);"></div>`,
          iconSize: [14, 14],
        }),
      });
      if (tooltip) marker.bindTooltip(tooltip, { permanent: false, direction: 'top' });
      marker.addTo(drawnItems);
    }

    if (shape === 'circle') {
      const circle = L.circle(latlng, { ...sharedStyle, radius });
      if (tooltip) circle.bindTooltip(tooltip, { permanent: false, direction: 'top' });
      circle.addTo(drawnItems);
    }

    if (shape === 'rectangle') {
      const bounds = [
        [latlng.lat + 0.01, latlng.lng - 0.01],
        [latlng.lat - 0.01, latlng.lng + 0.01],
      ];
      const rectangle = L.rectangle(bounds, sharedStyle);
      if (tooltip) rectangle.bindTooltip(tooltip, { permanent: false, direction: 'top' });
      rectangle.addTo(drawnItems);
    }

    if (shape === 'polygon') {
      const polygon = L.polygon(
        [
          [latlng.lat + 0.01, latlng.lng],
          [latlng.lat - 0.008, latlng.lng - 0.01],
          [latlng.lat - 0.01, latlng.lng + 0.012],
        ],
        sharedStyle,
      );
      if (tooltip) polygon.bindTooltip(tooltip, { permanent: false, direction: 'top' });
      polygon.addTo(drawnItems);
    }

    updateEmbedCode();
  }

  map.on(L.Draw.Event.CREATED, (event) => {
    const layer = event.layer;
    applyStyle(layer);
    drawnItems.addLayer(layer);
    updateEmbedCode();
  });

  map.on(L.Draw.Event.EDITED, updateEmbedCode);
  map.on(L.Draw.Event.DELETED, updateEmbedCode);
  map.on('zoomend moveend', () => {
    centerLatInput.value = map.getCenter().lat.toFixed(4);
    centerLngInput.value = map.getCenter().lng.toFixed(4);
    zoomInput.value = map.getZoom();
    updateEmbedCode();
  });

  function applyStyle(layer) {
    const accent = accentInput.value;
    const fillOpacity = Number(fillInput.value) || 0.35;
    const weight = Number(strokeInput.value) || 2;
    const tooltip = descriptionInput.value.trim();

    if (layer.setStyle) {
      layer.setStyle({ color: accent, fillColor: accent, weight, fillOpacity });
    }

    if (layer instanceof L.Circle) {
      layer.setRadius(Number(radiusInput.value) || layer.getRadius());
    }

    if (tooltip) {
      layer.bindTooltip(tooltip, { permanent: false, direction: 'top' });
    } else if (layer.unbindTooltip) {
      layer.unbindTooltip();
    }
  }

  function updateBaseLayer() {
    const selectedTiles = tileLayers[mapStyleSelect.value];
    if (baseLayer) {
      map.removeLayer(baseLayer);
    }
    baseLayer = L.tileLayer(selectedTiles.url, { attribution: selectedTiles.attribution }).addTo(map);
  }

  [mapStyleSelect, accentInput, radiusInput, fillInput, strokeInput, descriptionInput].forEach((input) => {
    input.addEventListener('change', () => {
      drawnItems.eachLayer((layer) => applyStyle(layer));
      if (input === mapStyleSelect) {
        updateBaseLayer();
      }
      updateEmbedCode();
    });
  });

  zoomInput.addEventListener('input', () => {
    const zoom = parseInt(zoomInput.value, 10);
    map.setZoom(zoom);
  });

  centerLatInput.addEventListener('change', () => {
    map.setView([parseFloat(centerLatInput.value), map.getCenter().lng], map.getZoom());
  });

  centerLngInput.addEventListener('change', () => {
    map.setView([map.getCenter().lat, parseFloat(centerLngInput.value)], map.getZoom());
  });

  resetButton.addEventListener('click', () => {
    drawnItems.clearLayers();
    descriptionInput.value = '';
    centerLatInput.value = '37.7749';
    centerLngInput.value = '-122.4194';
    zoomInput.value = '12';
    map.setView([37.7749, -122.4194], 12);
    updateBaseLayer();
    updateEmbedCode();
  });

  updateButton.addEventListener('click', updateEmbedCode);

  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(embedOutput.value).then(() => {
      copyButton.textContent = 'Copied!';
      setTimeout(() => (copyButton.textContent = 'Copy embed code'), 1200);
    });
  });

  downloadButton.addEventListener('click', () => {
    const blob = new Blob([embedOutput.value], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'map-embed.html';
    link.click();
    URL.revokeObjectURL(url);
  });

  function serializeLayer(layer) {
    const tooltip = layer.getTooltip ? layer.getTooltip()?.getContent?.() : undefined;
    if (layer instanceof L.Circle) {
      return {
        type: 'Circle',
        latlng: layer.getLatLng(),
        radius: layer.getRadius(),
        options: pickStyle(layer.options),
        tooltip,
      };
    }

    if (layer instanceof L.Rectangle) {
      return {
        type: 'Rectangle',
        latlngs: layer.getLatLngs()[0].map((point) => ({ lat: point.lat, lng: point.lng })),
        options: pickStyle(layer.options),
        tooltip,
      };
    }

    if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle)) {
      return {
        type: 'Polygon',
        latlngs: layer.getLatLngs()[0].map((point) => ({ lat: point.lat, lng: point.lng })),
        options: pickStyle(layer.options),
        tooltip,
      };
    }

    if (layer instanceof L.Marker) {
      return {
        type: 'Marker',
        latlng: layer.getLatLng(),
        options: { color: accentInput.value },
        tooltip,
      };
    }

    return null;
  }

  function pickStyle(options = {}) {
    return {
      color: options.color || accentInput.value,
      fillColor: options.fillColor || accentInput.value,
      fillOpacity: options.fillOpacity ?? Number(fillInput.value),
      weight: options.weight || Number(strokeInput.value),
    };
  }

  function updateEmbedCode() {
    const mapId = `openmap-${Date.now()}`;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const selectedTiles = tileLayers[mapStyleSelect.value];
    const layers = [];

    drawnItems.eachLayer((layer) => {
      const serialized = serializeLayer(layer);
      if (serialized) layers.push(serialized);
    });

    const escapedAttribution = selectedTiles.attribution.replace(/'/g, "\\'");
    const embed = `<!-- Open Map Maker embed -->\n<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />\n<div id="${mapId}" style="width:100%;height:420px;border-radius:12px;border:1px solid #e5e7eb;"></div>\n<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""><\/script>\n<script>(function(){\n  const map = L.map('${mapId}', { scrollWheelZoom: true }).setView([${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}], ${zoom});\n  L.tileLayer('${selectedTiles.url}', { attribution: '${escapedAttribution}' }).addTo(map);\n  const accent = '${accentInput.value}';\n  const layers = ${JSON.stringify(layers)};\n  layers.forEach((layer) => {\n    if (layer.type === 'Marker') {\n      const marker = L.marker(layer.latlng, { icon: L.divIcon({ className: 'custom-marker', html: `<div style\\"width:14px;height:14px;border-radius:999px;background:${accent};box-shadow:0 0 0 6px rgba(52,211,153,0.22);\\"></div>`, iconSize: [14, 14] }) }).addTo(map);\n      if (layer.tooltip) marker.bindTooltip(layer.tooltip, { direction: 'top' });\n    }\n    if (layer.type === 'Circle') {\n      const circle = L.circle(layer.latlng, { ...layer.options, color: layer.options.color || accent, fillColor: layer.options.fillColor || accent, radius: layer.radius }).addTo(map);\n      if (layer.tooltip) circle.bindTooltip(layer.tooltip, { direction: 'top' });\n    }\n    if (layer.type === 'Rectangle') {\n      const rectangle = L.rectangle(layer.latlngs, { ...layer.options, color: layer.options.color || accent, fillColor: layer.options.fillColor || accent }).addTo(map);\n      if (layer.tooltip) rectangle.bindTooltip(layer.tooltip, { direction: 'top' });\n    }\n    if (layer.type === 'Polygon') {\n      const polygon = L.polygon(layer.latlngs, { ...layer.options, color: layer.options.color || accent, fillColor: layer.options.fillColor || accent }).addTo(map);\n      if (layer.tooltip) polygon.bindTooltip(layer.tooltip, { direction: 'top' });\n    }\n  });\n  map.whenReady(() => map.invalidateSize());\n})();<\/script>`;

    embedOutput.value = embed;
  }

  map.whenReady(() => {
    map.invalidateSize();
    updateEmbedCode();
  });
});
