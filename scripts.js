/**
 * Visor GeoServer Profesional — ARTECLAB
 * scripts.js — Lógica principal del visor
 * Dependencia: OpenLayers 9 (CDN)
 */

// ============================================================
//  Estado global
// ============================================================
const STATE = {
  map: null,
  olLayers: {},       // id → ol/layer
  config: null,
  sidebarOpen: true
};

// ============================================================
//  Inicialización
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    STATE.config = await loadConfig();
    initMap();
    buildSidebar();
    initControls();
    initFooter();
  } catch (err) {
    console.error('Error al inicializar el visor:', err);
    showToast('Error al cargar la configuración', 'error');
  }
});

// ============================================================
//  Carga de configuración desde data.json
// ============================================================
async function loadConfig() {
  const res = await fetch('data.json');
  if (!res.ok) throw new Error('No se pudo cargar data.json');
  return res.json();
}

// ============================================================
//  Inicializar mapa OpenLayers
// ============================================================
function initMap() {
  const cfg = STATE.config.config;

  // Capas base
  const baseLayers = buildBaseLayers();

  // Capas WMS del data.json
  const wmsLayers = buildWmsLayers();

  STATE.map = new ol.Map({
    target: 'map',
    controls: [],
    layers: [...baseLayers, ...wmsLayers],
    view: new ol.View({
      center: ol.proj.fromLonLat(cfg.defaultCenter),
      zoom: cfg.defaultZoom,
      projection: 'EPSG:3857'
    })
  });

  // Evento de movimiento de ratón → coordenadas en footer
  STATE.map.on('pointermove', (evt) => {
    const lonLat = ol.proj.toLonLat(evt.coordinate);
    updateCoords(lonLat[0], lonLat[1]);
  });
}

// ---- Construcción de capas base ----
function buildBaseLayers() {
  const basemaps = STATE.config.basemaps;
  const layers = [];

  for (const bm of basemaps) {
    let layer;

    if (bm.type === 'OSM') {
      layer = new ol.layer.Tile({
        source: new ol.source.OSM(),
        visible: bm.visible,
        properties: { id: bm.id, isBasemap: true }
      });
    } else if (bm.type === 'XYZ') {
      layer = new ol.layer.Tile({
        source: new ol.source.XYZ({ url: bm.url }),
        visible: bm.visible,
        properties: { id: bm.id, isBasemap: true }
      });
    }

    if (layer) layers.push(layer);
  }

  return layers;
}

// ---- Construcción de capas WMS ----
function buildWmsLayers() {
  const layers = [];

  for (const layerCfg of STATE.config.layers) {
    const source = new ol.source.TileWMS({
      url: layerCfg.wmsUrl,
      params: {
        LAYERS: layerCfg.wmsLayer,
        FORMAT: 'image/png',
        TRANSPARENT: true,
        VERSION: '1.1.1'
      },
      serverType: 'geoserver',
      crossOrigin: 'anonymous'
    });

    const olLayer = new ol.layer.Tile({
      source: source,
      visible: layerCfg.visible,
      opacity: layerCfg.opacity ?? 0.85,
      properties: { id: layerCfg.id, isBasemap: false }
    });

    STATE.olLayers[layerCfg.id] = olLayer;
    layers.push(olLayer);
  }

  return layers;
}

// ============================================================
//  Construcción dinámica del sidebar
// ============================================================
function buildSidebar() {
  const cfg = STATE.config;

  // Botones de mapa base
  const basemapSelector = document.getElementById('basemap-selector');
  for (const bm of cfg.basemaps) {
    const btn = document.createElement('button');
    btn.className = 'basemap-btn' + (bm.visible ? ' active' : '');
    btn.textContent = bm.name;
    btn.dataset.id = bm.id;
    btn.addEventListener('click', () => switchBasemap(bm.id, btn));
    basemapSelector.appendChild(btn);
  }

  // Tarjetas de capas
  const container = document.getElementById('layers-container');
  for (const layer of cfg.layers) {
    container.appendChild(buildLayerCard(layer));
  }
}

// ---- Tarjeta de capa individual ----
function buildLayerCard(layer) {
  const card = document.createElement('div');
  card.className = 'layer-card' + (layer.visible ? ' active' : '');
  card.id = `card-${layer.id}`;

  // Indicador de color + nombre + toggle
  const toggleId = `toggle-${layer.id}`;
  card.innerHTML = `
    <div class="layer-card-header">
      <div class="layer-indicator" style="background-color:${layer.color};color:${layer.color}"></div>
      <span class="layer-name">${layer.name}</span>
      <label class="toggle-switch" title="Mostrar/ocultar capa">
        <input type="checkbox" id="${toggleId}" ${layer.visible ? 'checked' : ''}>
        <span class="toggle-track"></span>
      </label>
    </div>
    <p class="layer-description">${layer.description}</p>
    <div class="layer-opacity-row">
      <span class="opacity-label">Opacidad</span>
      <input type="range" class="opacity-slider" min="0" max="1" step="0.05"
        value="${layer.opacity ?? 0.85}" data-layer="${layer.id}">
      <span class="opacity-value" id="opacity-val-${layer.id}">${Math.round((layer.opacity ?? 0.85) * 100)}%</span>
    </div>
    <div class="layer-downloads">
      ${buildDownloadButtons(layer)}
    </div>
  `;

  // Evento toggle visibilidad
  const checkbox = card.querySelector(`#${toggleId}`);
  checkbox.addEventListener('change', () => {
    toggleLayer(layer.id, checkbox.checked, card);
  });

  // Evento opacidad
  const slider = card.querySelector('.opacity-slider');
  slider.addEventListener('input', () => {
    setLayerOpacity(layer.id, parseFloat(slider.value));
  });

  return card;
}

// ---- Botones de descarga WFS ----
function buildDownloadButtons(layer) {
  if (!layer.downloadEnabled) return '';

  const formats = [
    { fmt: 'SHAPE-ZIP', label: 'ZIP', icon: iconZip() },
    { fmt: 'application/json', label: 'GeoJSON', icon: iconJson() },
    { fmt: 'KML', label: 'KML', icon: iconKml() }
  ];

  return formats.map(f => `
    <button class="dl-btn"
      onclick="downloadLayer('${layer.id}', '${f.fmt}', this)"
      title="Descargar como ${f.label}">
      ${f.icon}
      ${f.label}
    </button>
  `).join('');
}

// ============================================================
//  Funciones de control de capas
// ============================================================
function toggleLayer(id, visible, card) {
  const olLayer = STATE.olLayers[id];
  if (!olLayer) return;
  olLayer.setVisible(visible);
  card.classList.toggle('active', visible);
}

function setLayerOpacity(id, value) {
  const olLayer = STATE.olLayers[id];
  if (!olLayer) return;
  olLayer.setOpacity(value);
  const label = document.getElementById(`opacity-val-${id}`);
  if (label) label.textContent = Math.round(value * 100) + '%';
}

function switchBasemap(id, clickedBtn) {
  // Actualizar botones
  document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
  clickedBtn.classList.add('active');

  // Cambiar visibilidad de capas base en el mapa
  STATE.map.getLayers().forEach(layer => {
    if (layer.get('isBasemap')) {
      layer.setVisible(layer.get('id') === id);
    }
  });
}

// ============================================================
//  Descarga WFS
// ============================================================
function downloadLayer(layerId, format, btn) {
  const layerCfg = STATE.config.layers.find(l => l.id === layerId);
  if (!layerCfg) return;

  const ext = format === 'SHAPE-ZIP' ? 'zip'
    : format === 'application/json' ? 'geojson'
    : 'kml';

  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName: layerCfg.wfsLayer,
    outputFormat: format,
    srsName: 'EPSG:4326'
  });

  const url = `${layerCfg.wfsUrl}?${params.toString()}`;
  const filename = `${layerCfg.id}.${ext}`;

  btn.classList.add('loading');
  showToast(`Descargando ${layerCfg.name} como ${ext.toUpperCase()}…`, 'info');

  // Crear enlace temporal de descarga
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    btn.classList.remove('loading');
    showToast(`Descarga iniciada: ${filename}`, 'success');
  }, 800);
}

// ============================================================
//  Controles del mapa (zoom, full extent, etc.)
// ============================================================
function initControls() {
  // Zoom in
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    const view = STATE.map.getView();
    view.animate({ zoom: view.getZoom() + 1, duration: 250 });
  });

  // Zoom out
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    const view = STATE.map.getView();
    view.animate({ zoom: view.getZoom() - 1, duration: 250 });
  });

  // Zoom a extensión de Bolivia
  document.getElementById('btn-full-extent').addEventListener('click', () => {
    const cfg = STATE.config.config;
    STATE.map.getView().animate({
      center: ol.proj.fromLonLat(cfg.defaultCenter),
      zoom: cfg.defaultZoom,
      duration: 450
    });
  });

  // Toggle sidebar
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    toggleSidebar();
  });

  // Overlay para móvil
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => toggleSidebar(false));
  }
}

function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const open = force !== undefined ? force : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('visible', open);
  } else {
    STATE.sidebarOpen = force !== undefined ? force : !STATE.sidebarOpen;
    sidebar.classList.toggle('collapsed', !STATE.sidebarOpen);
    // Re-render mapa al cambiar tamaño del contenedor
    setTimeout(() => STATE.map.updateSize(), 300);
  }
}

// ============================================================
//  Footer — coordenadas
// ============================================================
function initFooter() {
  updateCoords(
    STATE.config.config.defaultCenter[0],
    STATE.config.config.defaultCenter[1]
  );
}

function updateCoords(lon, lat) {
  const el = document.getElementById('footer-coords');
  if (!el) return;
  el.innerHTML = `Lon: <span>${lon.toFixed(5)}</span> &nbsp; Lat: <span>${lat.toFixed(5)}</span>`;
}

// ============================================================
//  Toast notifications
// ============================================================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? iconCheckCircle()
    : type === 'error' ? iconAlertCircle()
    : iconInfoCircle();

  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 220);
  }, 3000);
}

// ============================================================
//  Iconos SVG inline
// ============================================================
function iconZip() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
    <path d="M10 2v3h3M7 7v2M7 11v2M8 9h1M8 11h1"/>
  </svg>`;
}

function iconJson() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M2 5C2 4 3 3 4 4v2c0 1 1 1 1 2s-1 1-1 2v2c-1 1-2 0-2-1"/>
    <path d="M14 5c0-1-1-2-2-1v2c0 1-1 1-1 2s1 1 1 2v2c1 1 2 0 2-1"/>
    <line x1="7" y1="8" x2="9" y2="8"/>
  </svg>`;
}

function iconKml() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="8" cy="7" r="3"/>
    <path d="M8 10v4M5 13h6"/>
    <path d="M3 7a5 5 0 0110 0c0 4-5 8-5 8S3 11 3 7z"/>
  </svg>`;
}

function iconCheckCircle() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="#A5D6A7" stroke-width="1.5">
    <circle cx="8" cy="8" r="6.5"/>
    <path d="M5 8l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function iconAlertCircle() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="#EF9A9A" stroke-width="1.5">
    <circle cx="8" cy="8" r="6.5"/>
    <line x1="8" y1="5" x2="8" y2="9" stroke-linecap="round"/>
    <circle cx="8" cy="11.5" r="0.5" fill="#EF9A9A"/>
  </svg>`;
}

function iconInfoCircle() {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="#F4A021" stroke-width="1.5">
    <circle cx="8" cy="8" r="6.5"/>
    <line x1="8" y1="7" x2="8" y2="11" stroke-linecap="round"/>
    <circle cx="8" cy="5" r="0.5" fill="#F4A021"/>
  </svg>`;
}
