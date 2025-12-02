// Simple Map Builder using Leaflet + Leaflet.draw
// All data is stored client-side inside mapConfig and optionally localStorage

const tileProviders = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
  },
  toner: {
    url: 'https://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png',
    attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data &copy; OpenStreetMap contributors',
  },
};

const mapConfig = {
  meta: {
    title: 'Untitled map',
    description: '',
    center: { lat: 0, lng: 0 },
    zoom: 2,
    baseLayer: 'streets',
  },
  markers: [],
  polygons: [],
  polylines: [],
  circles: [],
  rectangles: [],
};

const mapLayers = new Map();
let map;
let drawControl;
let drawnItems;
let activeBaseLayer;

const ui = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initMap();
  attachEvents();
  loadFromStorage();
  renderLayerList();
  updateMetaInputs();
});

function cacheElements() {
  ui.mapTitle = document.getElementById('mapTitle');
  ui.mapDescription = document.getElementById('mapDescription');
  ui.centerLat = document.getElementById('centerLat');
  ui.centerLng = document.getElementById('centerLng');
  ui.zoom = document.getElementById('zoom');
  ui.baseLayer = document.getElementById('baseLayer');
  ui.layerList = document.getElementById('layerList');
  ui.modal = document.getElementById('modal');
  ui.layerForm = document.getElementById('layerForm');
  ui.modalTitle = document.getElementById('modalTitle');
  ui.closeModal = document.getElementById('closeModal');
  ui.embedModal = document.getElementById('embedModal');
  ui.embedOutput = document.getElementById('embedOutput');
  ui.closeEmbed = document.getElementById('closeEmbed');
  ui.copyEmbed = document.getElementById('copyEmbed');
  ui.loadMap = document.getElementById('loadMap');
  ui.saveMap = document.getElementById('saveMap');
  ui.generateEmbed = document.getElementById('generateEmbed');
  ui.newMap = document.getElementById('newMap');
}

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    worldCopyJump: true,
  }).setView([mapConfig.meta.center.lat, mapConfig.meta.center.lng], mapConfig.meta.zoom);

  activeBaseLayer = L.tileLayer(tileProviders[mapConfig.meta.baseLayer].url, {
    attribution: tileProviders[mapConfig.meta.baseLayer].attribution,
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  drawControl = new L.Control.Draw({
    edit: {
      featureGroup: drawnItems,
    },
    draw: {
      polygon: true,
      rectangle: true,
      circle: true,
      marker: true,
      polyline: true,
      circlemarker: false,
    },
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, (event) => {
    const layer = event.layer;
    const type = event.layerType;
    const id = uid(type);
    layer._configId = id;
    drawnItems.addLayer(layer);
    addLayerToConfig(type, layer, id);
    openLayerModal(type, id);
    persist();
  });

  map.on(L.Draw.Event.EDITED, (event) => {
    event.layers.eachLayer((layer) => {
      updateGeometryFromLayer(layer);
      persist();
    });
  });

  map.on(L.Draw.Event.DELETED, (event) => {
    event.layers.eachLayer((layer) => deleteLayerById(layer._configId));
    persist();
  });

  map.on('moveend zoomend', () => {
    mapConfig.meta.center = map.getCenter();
    mapConfig.meta.zoom = map.getZoom();
    updateMetaInputs();
    persist(false);
  });

  document.querySelectorAll('.floating-toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => activateDraw(btn.dataset.tool));
  });
}

function activateDraw(tool) {
  const drawMap = {
    marker: () => new L.Draw.Marker(map).enable(),
    polygon: () => new L.Draw.Polygon(map).enable(),
    rectangle: () => new L.Draw.Rectangle(map).enable(),
    circle: () => new L.Draw.Circle(map).enable(),
    polyline: () => new L.Draw.Polyline(map).enable(),
    edit: () => drawControl._toolbars.edit._modes.edit.handler.enable(),
  };
  if (drawMap[tool]) drawMap[tool]();
}

function attachEvents() {
  ui.mapTitle.addEventListener('input', () => {
    mapConfig.meta.title = ui.mapTitle.value;
    persist();
  });
  ui.mapDescription.addEventListener('input', () => {
    mapConfig.meta.description = ui.mapDescription.value;
    persist();
  });
  ui.centerLat.addEventListener('change', () => setMapViewFromInputs());
  ui.centerLng.addEventListener('change', () => setMapViewFromInputs());
  ui.zoom.addEventListener('change', () => setMapViewFromInputs());
  ui.baseLayer.addEventListener('change', () => switchBaseLayer(ui.baseLayer.value));

  ui.closeModal.addEventListener('click', closeModal);
  ui.closeEmbed.addEventListener('click', () => ui.embedModal.classList.add('hidden'));
  ui.copyEmbed.addEventListener('click', copyEmbed);
  ui.generateEmbed.addEventListener('click', () => {
    ui.embedOutput.value = generateEmbed(mapConfig);
    ui.embedModal.classList.remove('hidden');
  });

  ui.saveMap.addEventListener('click', saveToFile);
  ui.loadMap.addEventListener('change', importFromFile);
  ui.newMap.addEventListener('click', () => {
    if (!confirm('Start a fresh map? This clears current layers.')) return;
    resetMap();
  });
}

function updateMetaInputs() {
  ui.mapTitle.value = mapConfig.meta.title;
  ui.mapDescription.value = mapConfig.meta.description;
  ui.centerLat.value = mapConfig.meta.center.lat.toFixed(4);
  ui.centerLng.value = mapConfig.meta.center.lng.toFixed(4);
  ui.zoom.value = mapConfig.meta.zoom;
  ui.baseLayer.value = mapConfig.meta.baseLayer;
}

function setMapViewFromInputs() {
  const lat = parseFloat(ui.centerLat.value);
  const lng = parseFloat(ui.centerLng.value);
  const zoom = parseInt(ui.zoom.value, 10);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    map.setView([lat, lng], zoom || map.getZoom());
  }
}

function switchBaseLayer(key) {
  if (activeBaseLayer) map.removeLayer(activeBaseLayer);
  activeBaseLayer = L.tileLayer(tileProviders[key].url, {
    attribution: tileProviders[key].attribution,
  }).addTo(map);
  mapConfig.meta.baseLayer = key;
  persist();
}

function addLayerToConfig(type, layer, id) {
  const common = {
    id,
    title: `${capitalize(type)} ${mapLayers.size + 1}`,
    description: '',
    visible: true,
  };

  let data;
  if (type === 'marker') {
    const { lat, lng } = layer.getLatLng();
    data = { ...common, lat, lng, color: '#e11d48' };
    mapConfig.markers.push(data);
  }
  if (type === 'polygon') {
    const coordinates = layer.getLatLngs()[0].map(({ lat, lng }) => [lat, lng]);
    data = { ...common, coordinates, strokeColor: '#2563eb', fillColor: '#93c5fd', strokeWeight: 2, fillOpacity: 0.4 };
    mapConfig.polygons.push(data);
  }
  if (type === 'rectangle') {
    const bounds = layer.getBounds();
    data = {
      ...common,
      bounds: [
        [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
        [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
      ],
      strokeColor: '#0f172a',
      fillColor: '#a5b4fc',
      strokeWeight: 2,
      fillOpacity: 0.3,
    };
    mapConfig.rectangles.push(data);
  }
  if (type === 'circle') {
    const { lat, lng } = layer.getLatLng();
    data = {
      ...common,
      center: { lat, lng },
      radius: layer.getRadius(),
      strokeColor: '#0ea5e9',
      fillColor: '#67e8f9',
      strokeWeight: 2,
      fillOpacity: 0.25,
    };
    mapConfig.circles.push(data);
  }
  if (type === 'polyline') {
    const coordinates = layer.getLatLngs().map(({ lat, lng }) => [lat, lng]);
    data = { ...common, coordinates, color: '#22c55e', weight: 4, dashArray: '' };
    mapConfig.polylines.push(data);
  }

  mapLayers.set(id, { layer, type });
  applyConfigToLayer(data, layer, type);
  renderLayerList();
}

function applyConfigToLayer(config, layer, type) {
  layer._configId = config.id;
  if (type === 'marker') {
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="width:14px;height:14px;border-radius:999px;background:${config.color};box-shadow:0 0 0 6px ${hexToRgba(
        config.color,
        0.25,
      )}"></div>`,
      iconSize: [14, 14],
    });
    layer.setIcon(icon);
    layer.setLatLng([config.lat, config.lng]);
  }

  if (type === 'polygon') {
    layer.setStyle({
      color: config.strokeColor,
      weight: config.strokeWeight,
      fillColor: config.fillColor,
      fillOpacity: config.fillOpacity,
    });
    layer.setLatLngs([config.coordinates]);
  }

  if (type === 'rectangle') {
    layer.setStyle({
      color: config.strokeColor,
      weight: config.strokeWeight,
      fillColor: config.fillColor,
      fillOpacity: config.fillOpacity,
    });
    layer.setBounds(config.bounds);
  }

  if (type === 'circle') {
    layer.setStyle({
      color: config.strokeColor,
      weight: config.strokeWeight,
      fillColor: config.fillColor,
      fillOpacity: config.fillOpacity,
    });
    layer.setLatLng([config.center.lat, config.center.lng]);
    layer.setRadius(config.radius);
  }

  if (type === 'polyline') {
    layer.setStyle({
      color: config.color,
      weight: config.weight,
      dashArray: config.dashArray,
    });
    layer.setLatLngs(config.coordinates);
  }

  const popup = popupContent(config);
  layer.bindPopup(popup);
}

function popupContent(config) {
  const title = config.title || 'Untitled layer';
  const desc = config.description || '';
  return `<strong>${escapeHtml(title)}</strong><br/><span>${escapeHtml(desc)}</span>`;
}

function openLayerModal(type, id) {
  const config = getLayerConfig(type, id);
  if (!config) return;

  ui.layerForm.innerHTML = buildForm(type, config);
  ui.modalTitle.textContent = `Edit ${capitalize(type)}`;
  ui.modal.classList.remove('hidden');

  ui.layerForm.onsubmit = (e) => {
    e.preventDefault();
    saveForm(type, id, new FormData(ui.layerForm));
    closeModal();
  };
}

function buildForm(type, config) {
  const common = `
    <label>Title</label>
    <input name="title" value="${escapeAttr(config.title)}" required />
    <label>Description</label>
    <textarea name="description" rows="2">${escapeHtml(config.description)}</textarea>
  `;

  if (type === 'marker') {
    return `
      ${common}
      <label>Icon color</label>
      <input name="color" type="color" value="${config.color}" />
      <div class="modal-actions">
        <button type="submit" class="primary">Save</button>
      </div>
    `;
  }

  if (type === 'polygon' || type === 'rectangle' || type === 'circle') {
    const strokeColor = config.strokeColor || '#111827';
    return `
      ${common}
      <div class="grid two">
        <div>
          <label>Stroke color</label>
          <input name="strokeColor" type="color" value="${strokeColor}" />
        </div>
        <div>
          <label>Fill color</label>
          <input name="fillColor" type="color" value="${config.fillColor}" />
        </div>
      </div>
      <div class="grid two">
        <div>
          <label>Stroke weight</label>
          <input name="strokeWeight" type="number" min="1" max="12" value="${config.strokeWeight}" />
        </div>
        <div>
          <label>Fill opacity (0-1)</label>
          <input name="fillOpacity" type="number" min="0" max="1" step="0.05" value="${config.fillOpacity}" />
        </div>
      </div>
      ${type === 'circle' ? `<label>Radius (meters)</label><input name="radius" type="number" value="${config.radius}" />` : ''}
      <div class="modal-actions">
        <button type="submit" class="primary">Save</button>
      </div>
    `;
  }

  if (type === 'polyline') {
    return `
      ${common}
      <div class="grid two">
        <div>
          <label>Line color</label>
          <input name="color" type="color" value="${config.color}" />
        </div>
        <div>
          <label>Weight</label>
          <input name="weight" type="number" min="1" max="12" value="${config.weight}" />
        </div>
      </div>
      <label>Dash pattern (e.g. 6, 6)</label>
      <input name="dashArray" type="text" value="${config.dashArray}" />
      <div class="modal-actions">
        <button type="submit" class="primary">Save</button>
      </div>
    `;
  }
  return '';
}

function saveForm(type, id, formData) {
  const config = getLayerConfig(type, id);
  if (!config) return;
  config.title = formData.get('title');
  config.description = formData.get('description');

  if (type === 'marker') {
    config.color = formData.get('color');
  }

  if (type === 'polygon' || type === 'rectangle' || type === 'circle') {
    config.strokeColor = formData.get('strokeColor');
    config.fillColor = formData.get('fillColor');
    config.strokeWeight = Number(formData.get('strokeWeight')) || 1;
    config.fillOpacity = Number(formData.get('fillOpacity'));
    if (type === 'circle') {
      config.radius = Number(formData.get('radius')) || config.radius;
    }
  }

  if (type === 'polyline') {
    config.color = formData.get('color');
    config.weight = Number(formData.get('weight')) || config.weight;
    config.dashArray = formData.get('dashArray');
  }

  updateLayerFromConfig(id, type);
  renderLayerList();
  persist();
}

function updateLayerFromConfig(id, type) {
  const record = mapLayers.get(id);
  if (!record) return;
  const config = getLayerConfig(type, id);
  applyConfigToLayer(config, record.layer, type);
  record.layer.openPopup();
}

function getLayerConfig(type, id) {
  const collection = mapConfig[`${type}s`];
  return collection.find((item) => item.id === id);
}

function closeModal() {
  ui.modal.classList.add('hidden');
}

function renderLayerList() {
  const groups = [
    { key: 'markers', label: 'Points', icon: '•' },
    { key: 'polygons', label: 'Zones', icon: '⬠' },
    { key: 'rectangles', label: 'Rectangles', icon: '▭' },
    { key: 'circles', label: 'Circles', icon: '◉' },
    { key: 'polylines', label: 'Lines', icon: '⟍' },
  ];

  const items = groups
    .map((group) => mapConfig[group.key].map((layer) => ({ ...layer, type: group.key.slice(0, -1), icon: group.icon })))
    .flat();

  if (!items.length) {
    ui.layerList.classList.add('empty');
    ui.layerList.innerHTML = '<p>No layers yet. Add one from the toolbar.</p>';
    return;
  }

  ui.layerList.classList.remove('empty');
  ui.layerList.innerHTML = items
    .map(
      (item) => `
      <div class="layer-item" data-id="${item.id}" data-type="${item.type}">
        <div class="layer-icon">${item.icon}</div>
        <div class="layer-info">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.type)}</span>
        </div>
        <div class="layer-actions">
          <button data-action="toggle">${item.visible ? 'Hide' : 'Show'}</button>
          <button data-action="edit">Edit</button>
          <button data-action="delete" class="ghost">Delete</button>
        </div>
      </div>`
    )
    .join('');

  ui.layerList.querySelectorAll('.layer-item').forEach((item) => {
    item.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => handleLayerAction(item.dataset.type, item.dataset.id, btn.dataset.action));
    });
  });
}

function handleLayerAction(type, id, action) {
  const record = mapLayers.get(id);
  if (!record) return;
  const config = getLayerConfig(type, id);

  if (action === 'edit') {
    map.fitBounds(record.layer.getBounds ? record.layer.getBounds() : [record.layer.getLatLng()]);
    record.layer.openPopup();
    openLayerModal(type, id);
  }

  if (action === 'delete') {
    if (!confirm('Delete this layer?')) return;
    deleteLayerById(id);
  }

  if (action === 'toggle') {
    config.visible = !config.visible;
    if (config.visible) {
      drawnItems.addLayer(record.layer);
    } else {
      drawnItems.removeLayer(record.layer);
    }
    renderLayerList();
    persist();
  }
}

function deleteLayerById(id) {
  const record = mapLayers.get(id);
  if (!record) return;
  const collection = mapConfig[`${record.type}s`];
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) collection.splice(index, 1);
  drawnItems.removeLayer(record.layer);
  mapLayers.delete(id);
  renderLayerList();
  persist();
}

function updateGeometryFromLayer(layer) {
  const id = layer._configId;
  const record = mapLayers.get(id);
  if (!record) return;
  const type = record.type;
  const config = getLayerConfig(type, id);
  if (!config) return;

  if (type === 'marker') {
    const { lat, lng } = layer.getLatLng();
    config.lat = lat;
    config.lng = lng;
  }
  if (type === 'polygon' || type === 'rectangle') {
    const coords = layer.getLatLngs()[0].map(({ lat, lng }) => [lat, lng]);
    if (type === 'polygon') config.coordinates = coords;
    else config.bounds = coords;
  }
  if (type === 'circle') {
    const { lat, lng } = layer.getLatLng();
    config.center = { lat, lng };
    config.radius = layer.getRadius();
  }
  if (type === 'polyline') {
    config.coordinates = layer.getLatLngs().map(({ lat, lng }) => [lat, lng]);
  }
}

function resetMap() {
  drawnItems.clearLayers();
  mapLayers.clear();
  mapConfig.meta = { title: 'Untitled map', description: '', center: { lat: 0, lng: 0 }, zoom: 2, baseLayer: 'streets' };
  mapConfig.markers = [];
  mapConfig.polygons = [];
  mapConfig.polylines = [];
  mapConfig.circles = [];
  mapConfig.rectangles = [];
  updateMetaInputs();
  switchBaseLayer('streets');
  map.setView([0, 0], 2);
  renderLayerList();
  persist();
}

function generateEmbed(config) {
  const containerId = `map-${Date.now()}`;
  const serialized = JSON.stringify(config);
  return `<!-- Map Builder embed -->\n<div id="${containerId}" style="width:100%;height:420px;border:1px solid #e2e8f0;border-radius:12px;"></div>\n<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />\n<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>\n<script>(function(){\n  const mapConfig = ${serialized};\n  const map = L.map('${containerId}').setView([mapConfig.meta.center.lat, mapConfig.meta.center.lng], mapConfig.meta.zoom);\n  const providers=${JSON.stringify(tileProviders)};\n  const base=providers[mapConfig.meta.baseLayer]||providers.streets;\n  L.tileLayer(base.url,{attribution:base.attribution}).addTo(map);\n  const toLayer=(item,type)=>{\n    if(type==='marker') return L.marker([item.lat,item.lng],{icon:L.divIcon({className:'custom-marker',html:`<div style\\"width:14px;height:14px;border-radius:999px;background:${item.color};box-shadow:0 0 0 6px ${hexToRgbaEmbed(item.color,0.25)};\\"></div>`,iconSize:[14,14]})});\n    if(type==='polygon') return L.polygon(item.coordinates,{color:item.strokeColor,weight:item.strokeWeight,fillColor:item.fillColor,fillOpacity:item.fillOpacity});\n    if(type==='rectangle') return L.rectangle(item.bounds,{color:item.strokeColor,weight:item.strokeWeight,fillColor:item.fillColor,fillOpacity:item.fillOpacity});\n    if(type==='circle') return L.circle([item.center.lat,item.center.lng],{color:item.strokeColor,weight:item.strokeWeight,fillColor:item.fillColor,fillOpacity:item.fillOpacity,radius:item.radius});\n    if(type==='polyline') return L.polyline(item.coordinates,{color:item.color,weight:item.weight,dashArray:item.dashArray});\n  };\n  const addPopup=(layer,item)=>{const title=item.title||'Layer';const desc=item.description||'';layer.bindPopup(`<strong>${escapeHtmlEmbed(title)}</strong><br/><span>${escapeHtmlEmbed(desc)}</span>`);};\n  const layers=[['marker',mapConfig.markers],['polygon',mapConfig.polygons],['rectangle',mapConfig.rectangles],['circle',mapConfig.circles],['polyline',mapConfig.polylines]];\n  layers.forEach(([type,collection])=>collection.filter(l=>l.visible!==false).forEach((item)=>{const layer=toLayer(item,type);if(!layer) return;addPopup(layer,item);layer.addTo(map);}));\n  map.whenReady(()=>map.invalidateSize());\n  function escapeHtmlEmbed(str){return String(str).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}\n  function hexToRgbaEmbed(hex,a){const h=hex.replace('#','');const bigint=parseInt(h.length===3?h.split('').map((c)=>c+c).join(''):h,16);const r=(bigint>>16)&255;const g=(bigint>>8)&255;const b=bigint&255;return `rgba(${r},${g},${b},${a})`;}\n})();<\/script>`;
}

function copyEmbed() {
  navigator.clipboard.writeText(ui.embedOutput.value).then(() => {
    ui.copyEmbed.textContent = 'Copied!';
    setTimeout(() => (ui.copyEmbed.textContent = 'Copy to Clipboard'), 1200);
  });
}

function persist(updateStorage = true) {
  if (updateStorage) localStorage.setItem('map-builder-config', JSON.stringify(mapConfig));
}

function loadFromStorage() {
  const stored = localStorage.getItem('map-builder-config');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      loadConfig(data);
      return;
    } catch (e) {
      console.warn('Could not load from storage', e);
    }
  }
  map.setView([mapConfig.meta.center.lat, mapConfig.meta.center.lng], mapConfig.meta.zoom);
}

function loadConfig(data) {
  resetMap();
  Object.assign(mapConfig.meta, data.meta || {});
  mapConfig.markers = data.markers || [];
  mapConfig.polygons = data.polygons || [];
  mapConfig.polylines = data.polylines || [];
  mapConfig.circles = data.circles || [];
  mapConfig.rectangles = data.rectangles || [];
  updateMetaInputs();
  switchBaseLayer(mapConfig.meta.baseLayer || 'streets');
  map.setView([mapConfig.meta.center.lat, mapConfig.meta.center.lng], mapConfig.meta.zoom);
  rebuildLayersFromConfig();
  persist();
}

function rebuildLayersFromConfig() {
  const addCollection = (collection, type, factory) => {
    collection.forEach((config) => {
      const layer = factory(config);
      layer._configId = config.id;
      mapLayers.set(config.id, { layer, type });
      if (config.visible !== false) drawnItems.addLayer(layer);
      applyConfigToLayer(config, layer, type);
    });
  };

  addCollection(mapConfig.markers, 'marker', (cfg) => L.marker([cfg.lat, cfg.lng]));
  addCollection(mapConfig.polygons, 'polygon', (cfg) => L.polygon(cfg.coordinates));
  addCollection(mapConfig.rectangles, 'rectangle', (cfg) => L.rectangle(cfg.bounds));
  addCollection(mapConfig.circles, 'circle', (cfg) => L.circle([cfg.center.lat, cfg.center.lng], { radius: cfg.radius }));
  addCollection(mapConfig.polylines, 'polyline', (cfg) => L.polyline(cfg.coordinates));
  renderLayerList();
}

function saveToFile() {
  const blob = new Blob([JSON.stringify(mapConfig, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(mapConfig.meta.title || 'map').replace(/\s+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      loadConfig(data);
    } catch (err) {
      alert('Invalid map file.');
    }
  };
  reader.readAsText(file);
}

function hexToRgba(hex, alpha) {
  const stripped = hex.replace('#', '');
  const bigint = parseInt(stripped.length === 3 ? stripped.split('').map((c) => c + c).join('') : stripped, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str = '') {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
