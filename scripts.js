/**
 * Visor GeoServer Profesional — ARTECLAB
 * scripts.js v2.0
 * Dependencia: OpenLayers 9 (CDN)
 */

const STATE = {
  map: null, olLayers: {}, config: null, sidebarOpen: true,
  activeTool: null,
  drawInteraction: null, snapInteraction: null,
  selectInteraction: null, modifyInteraction: null,
  measureLayer: null, drawLayer: null, importLayer: null,
  drawFeatures: [], measureOverlays: [], featureCounter: 0
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    STATE.config = await loadConfig();
    initMap(); buildSidebar(); initControls();
    initFooter(); initToolbar(); initGetFeatureInfo(); initImportDrop();
  } catch (err) {
    console.error(err);
    showToast('Error al cargar la configuración', 'error');
  }
});

async function loadConfig() {
  const res = await fetch('data.json');
  if (!res.ok) throw new Error('No se pudo cargar data.json');
  return res.json();
}

function resolveUrl(url) {
  const proxy = STATE.config.config.corsProxy || '';
  return proxy ? proxy + encodeURIComponent(url) : url;
}

function resolveWmsUrl(lc) { return lc.wmsUrl; }
function resolveWfsUrl(lc) { return lc.wfsUrl; }

/* ============================================================ MAP */
function initMap() {
  const cfg = STATE.config.config;
  STATE.measureLayer = new ol.layer.Vector({ source: new ol.source.Vector(), style: measureStyle, zIndex: 90 });
  STATE.drawLayer    = new ol.layer.Vector({ source: new ol.source.Vector(), style: drawStyle,    zIndex: 91 });
  STATE.importLayer  = new ol.layer.Vector({ source: new ol.source.Vector(), style: importStyle,  zIndex: 92 });

  STATE.map = new ol.Map({
    target: 'map', controls: [],
    layers: [...buildBaseLayers(), ...buildWmsLayers(), STATE.measureLayer, STATE.drawLayer, STATE.importLayer],
    view: new ol.View({ center: ol.proj.fromLonLat(cfg.defaultCenter), zoom: cfg.defaultZoom })
  });
  STATE.map.on('pointermove', evt => {
    const ll = ol.proj.toLonLat(evt.coordinate);
    updateCoords(ll[0], ll[1]);
    document.getElementById('map').style.cursor = STATE.activeTool ? 'crosshair' : '';
  });
}

function buildBaseLayers() {
  return STATE.config.basemaps.map(bm => {
    if (bm.type === 'OSM') return new ol.layer.Tile({ source: new ol.source.OSM(), visible: bm.visible, properties: { id: bm.id, isBasemap: true } });
    return new ol.layer.Tile({ source: new ol.source.XYZ({ url: bm.url }), visible: bm.visible, properties: { id: bm.id, isBasemap: true } });
  });
}

function buildWmsLayers() {
  return STATE.config.layers.map(lc => {
    const source = new ol.source.TileWMS({
      url: resolveWmsUrl(lc),
      params: { LAYERS: lc.wmsLayer, FORMAT: 'image/png', TRANSPARENT: true, VERSION: '1.1.1' },
      serverType: 'geoserver'
    });
    const layer = new ol.layer.Tile({ source, visible: lc.visible, opacity: lc.opacity ?? 0.85, properties: { id: lc.id, isBasemap: false } });
    STATE.olLayers[lc.id] = layer;
    return layer;
  });
}

/* ============================================================ STYLES */
function measureStyle() {
  return new ol.style.Style({
    fill: new ol.style.Fill({ color: 'rgba(244,160,33,0.12)' }),
    stroke: new ol.style.Stroke({ color: '#F4A021', width: 2, lineDash: [6,4] }),
    image: new ol.style.Circle({ radius: 4, fill: new ol.style.Fill({ color: '#F4A021' }) })
  });
}
function drawStyle(feature) {
  const label = feature.get('label') || '';
  return new ol.style.Style({
    fill: new ol.style.Fill({ color: 'rgba(79,195,247,0.18)' }),
    stroke: new ol.style.Stroke({ color: '#4FC3F7', width: 2 }),
    image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: '#4FC3F7' }), stroke: new ol.style.Stroke({ color: '#fff', width: 1.5 }) }),
    text: label ? new ol.style.Text({ text: label, font: '12px Inter,sans-serif',
      fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: '#0a1628', width: 3 }), offsetY: -14 }) : null
  });
}
function importStyle() {
  return new ol.style.Style({
    fill: new ol.style.Fill({ color: 'rgba(165,214,167,0.25)' }),
    stroke: new ol.style.Stroke({ color: '#66BB6A', width: 2 }),
    image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: '#66BB6A' }), stroke: new ol.style.Stroke({ color: '#fff', width: 1.5 }) })
  });
}

/* ============================================================ SIDEBAR */
function buildSidebar() {
  const sel = document.getElementById('basemap-selector');
  STATE.config.basemaps.forEach(bm => {
    const btn = document.createElement('button');
    btn.className = 'basemap-btn' + (bm.visible ? ' active' : '');
    btn.textContent = bm.name;
    btn.addEventListener('click', () => switchBasemap(bm.id, btn));
    sel.appendChild(btn);
  });
  const cont = document.getElementById('layers-container');
  STATE.config.layers.forEach(l => cont.appendChild(buildLayerCard(l)));
}

function buildLayerCard(layer) {
  const card = document.createElement('div');
  card.className = 'layer-card' + (layer.visible ? ' active' : '');
  card.id = `card-${layer.id}`;
  const tid = `toggle-${layer.id}`;
  card.innerHTML = `
    <div class="layer-card-header">
      <div class="layer-indicator" style="background-color:${layer.color};color:${layer.color}"></div>
      <span class="layer-name">${layer.name}</span>
      <label class="toggle-switch"><input type="checkbox" id="${tid}" ${layer.visible?'checked':''}><span class="toggle-track"></span></label>
    </div>
    <p class="layer-description">${layer.description}</p>
    <div class="layer-opacity-row">
      <span class="opacity-label">Opacidad</span>
      <input type="range" class="opacity-slider" min="0" max="1" step="0.05" value="${layer.opacity??0.85}">
      <span class="opacity-value" id="opacity-val-${layer.id}">${Math.round((layer.opacity??0.85)*100)}%</span>
    </div>
    <div class="layer-downloads">${buildDlBtns(layer)}</div>`;
  card.querySelector(`#${tid}`).addEventListener('change', e => toggleLayer(layer.id, e.target.checked, card));
  card.querySelector('.opacity-slider').addEventListener('input', e => setLayerOpacity(layer.id, parseFloat(e.target.value)));
  return card;
}

function buildDlBtns(layer) {
  if (!layer.downloadEnabled) return '';
  return [
    {fmt:'SHAPE-ZIP', label:'ZIP', icon:iconZip()},
    {fmt:'application/json', label:'GeoJSON', icon:iconJson()},
    {fmt:'KML', label:'KML', icon:iconKml()}
  ].map(f=>`<button class="dl-btn" onclick="downloadLayer('${layer.id}','${f.fmt}',this)">${f.icon}${f.label}</button>`).join('');
}

function toggleLayer(id, visible, card) { STATE.olLayers[id]?.setVisible(visible); card.classList.toggle('active', visible); }
function setLayerOpacity(id, v) { STATE.olLayers[id]?.setOpacity(v); const el=document.getElementById(`opacity-val-${id}`); if(el) el.textContent=Math.round(v*100)+'%'; }
function switchBasemap(id, btn) {
  document.querySelectorAll('.basemap-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  STATE.map.getLayers().forEach(l=>{ if(l.get('isBasemap')) l.setVisible(l.get('id')===id); });
}

/* ============================================================ MAIN CONTROLS */
function initControls() {
  document.getElementById('btn-zoom-in').addEventListener('click', ()=>{ const v=STATE.map.getView(); v.animate({zoom:v.getZoom()+1,duration:250}); });
  document.getElementById('btn-zoom-out').addEventListener('click', ()=>{ const v=STATE.map.getView(); v.animate({zoom:v.getZoom()-1,duration:250}); });
  document.getElementById('btn-full-extent').addEventListener('click', ()=>{
    const c=STATE.config.config; STATE.map.getView().animate({center:ol.proj.fromLonLat(c.defaultCenter),zoom:c.defaultZoom,duration:450});
  });
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', ()=>toggleSidebar(false));
}
function toggleSidebar(force) {
  const s=document.getElementById('sidebar'), o=document.getElementById('sidebar-overlay'), mob=window.innerWidth<=768;
  if(mob){ const open=force!==undefined?force:!s.classList.contains('open'); s.classList.toggle('open',open); o?.classList.toggle('visible',open); }
  else { STATE.sidebarOpen=force!==undefined?force:!STATE.sidebarOpen; s.classList.toggle('collapsed',!STATE.sidebarOpen); setTimeout(()=>STATE.map.updateSize(),300); }
}

/* ============================================================ TOOLBAR */
function initToolbar() {
  document.querySelectorAll('.toolbar-section-header').forEach(hdr=>{
    hdr.addEventListener('click', ()=>{
      const body=hdr.nextElementSibling; const isOpen=!body.classList.contains('collapsed');
      body.classList.toggle('collapsed',isOpen);
      hdr.querySelector('.section-arrow').style.transform=isOpen?'rotate(-90deg)':'rotate(0deg)';
    });
  });
  document.getElementById('btn-measure-distance').addEventListener('click', ()=>activateTool('measure-distance'));
  document.getElementById('btn-measure-area').addEventListener('click',    ()=>activateTool('measure-area'));
  document.getElementById('btn-measure-clear').addEventListener('click',   clearMeasurements);
  document.getElementById('btn-draw-point').addEventListener('click',   ()=>activateTool('draw-point'));
  document.getElementById('btn-draw-line').addEventListener('click',    ()=>activateTool('draw-line'));
  document.getElementById('btn-draw-polygon').addEventListener('click', ()=>activateTool('draw-polygon'));
  document.getElementById('btn-draw-edit').addEventListener('click',    ()=>activateTool('edit'));
  document.getElementById('btn-draw-undo').addEventListener('click',    undoLastDraw);
  document.getElementById('btn-draw-clear').addEventListener('click',   clearDrawings);
  document.getElementById('btn-draw-export').addEventListener('click',  exportDrawings);
  document.getElementById('btn-draw-label').addEventListener('click',   labelSelectedFeature);
  document.getElementById('btn-import-file').addEventListener('click',  ()=>document.getElementById('import-file-input').click());
  document.getElementById('import-file-input').addEventListener('change', e=>importFile(e.target.files[0]));
  document.getElementById('btn-import-clear').addEventListener('click', clearImport);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') deactivateTool(); });
}

function activateTool(tool) {
  if(STATE.activeTool===tool){ deactivateTool(); return; }
  deactivateTool(); STATE.activeTool=tool;
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
  const map={'measure-distance':'btn-measure-distance','measure-area':'btn-measure-area','draw-point':'btn-draw-point','draw-line':'btn-draw-line','draw-polygon':'btn-draw-polygon','edit':'btn-draw-edit'};
  document.getElementById(map[tool])?.classList.add('active');
  if(tool==='measure-distance') startMeasure('LineString');
  else if(tool==='measure-area') startMeasure('Polygon');
  else if(tool==='draw-point') startDraw('Point');
  else if(tool==='draw-line') startDraw('LineString');
  else if(tool==='draw-polygon') startDraw('Polygon');
  else if(tool==='edit') startEdit();
  showToast(`Herramienta: ${toolLabel(tool)} · Esc para cancelar`, 'info');
}
function deactivateTool() {
  STATE.activeTool=null;
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
  removeInteractions(); clearMeasureSketch();
}
function removeInteractions() {
  ['drawInteraction','snapInteraction','selectInteraction','modifyInteraction'].forEach(k=>{
    if(STATE[k]){ STATE.map.removeInteraction(STATE[k]); STATE[k]=null; }
  });
}
function toolLabel(t){ return {'measure-distance':'Medir distancia','measure-area':'Medir área','draw-point':'Dibujar punto','draw-line':'Dibujar línea','draw-polygon':'Dibujar polígono','edit':'Editar vértices'}[t]||t; }

/* ---- Medición ---- */
let measureSketch=null, measureListener=null, measureTooltipEl=null, measureTooltipOverlay=null;

function startMeasure(geomType) {
  STATE.drawInteraction = new ol.interaction.Draw({ source: STATE.measureLayer.getSource(), type: geomType, style: measureStyle });
  createMeasureTooltip();
  STATE.drawInteraction.on('drawstart', evt=>{
    measureSketch=evt.feature;
    measureListener=measureSketch.getGeometry().on('change', e=>{
      const geom=e.target;
      const coord=geom.getType()==='Polygon'?geom.getInteriorPoint().getCoordinates():geom.getLastCoordinate();
      measureTooltipEl.innerHTML=formatMeasure(geom); measureTooltipOverlay.setPosition(coord);
    });
  });
  STATE.drawInteraction.on('drawend', evt=>{
    const geom=evt.feature.getGeometry();
    const el=document.createElement('div'); el.className='measure-tooltip measure-tooltip-static'; el.innerHTML=formatMeasure(geom);
    const ov=new ol.Overlay({element:el,offset:[0,-10],positioning:'bottom-center'}); STATE.map.addOverlay(ov);
    const coord=geom.getType()==='Polygon'?geom.getInteriorPoint().getCoordinates():geom.getLastCoordinate();
    ov.setPosition(coord); STATE.measureOverlays.push(ov);
    ol.Observable.unByKey(measureListener); clearMeasureSketch(); createMeasureTooltip();
  });
  STATE.map.addInteraction(STATE.drawInteraction);
}
function createMeasureTooltip() {
  if(measureTooltipOverlay) STATE.map.removeOverlay(measureTooltipOverlay);
  measureTooltipEl=document.createElement('div'); measureTooltipEl.className='measure-tooltip';
  measureTooltipOverlay=new ol.Overlay({element:measureTooltipEl,offset:[0,-15],positioning:'bottom-center'});
  STATE.map.addOverlay(measureTooltipOverlay);
}
function clearMeasureSketch() { if(measureTooltipOverlay){STATE.map.removeOverlay(measureTooltipOverlay);measureTooltipOverlay=null;} measureSketch=null; }
function clearMeasurements() {
  STATE.measureLayer.getSource().clear(); STATE.measureOverlays.forEach(o=>STATE.map.removeOverlay(o)); STATE.measureOverlays=[];
  clearMeasureSketch(); deactivateTool(); showToast('Mediciones eliminadas','info');
}
function formatMeasure(geom) {
  if(geom.getType()==='Polygon'){ const a=ol.sphere.getArea(geom); return a>1e6?`${(a/1e6).toFixed(2)} km²`:`${a.toFixed(0)} m²`; }
  const l=ol.sphere.getLength(geom); return l>1000?`${(l/1000).toFixed(2)} km`:`${l.toFixed(0)} m`;
}

/* ---- Dibujo ---- */
function startDraw(geomType) {
  STATE.drawInteraction=new ol.interaction.Draw({ source:STATE.drawLayer.getSource(), type:geomType, style:drawStyle });
  STATE.drawInteraction.on('drawend', evt=>{
    STATE.featureCounter++; evt.feature.setId(`f-${STATE.featureCounter}`);
    STATE.drawFeatures.push(evt.feature); showToast(`Feature dibujado (#${STATE.featureCounter})`,'success');
  });
  STATE.snapInteraction=new ol.interaction.Snap({source:STATE.drawLayer.getSource()});
  STATE.map.addInteraction(STATE.drawInteraction); STATE.map.addInteraction(STATE.snapInteraction);
}
function startEdit() {
  STATE.selectInteraction=new ol.interaction.Select({ layers:[STATE.drawLayer], style:new ol.style.Style({
    fill:new ol.style.Fill({color:'rgba(79,195,247,0.3)'}), stroke:new ol.style.Stroke({color:'#4FC3F7',width:2.5}),
    image:new ol.style.Circle({radius:6,fill:new ol.style.Fill({color:'#4FC3F7'})})
  })});
  STATE.modifyInteraction=new ol.interaction.Modify({features:STATE.selectInteraction.getFeatures()});
  STATE.snapInteraction=new ol.interaction.Snap({source:STATE.drawLayer.getSource()});
  STATE.map.addInteraction(STATE.selectInteraction); STATE.map.addInteraction(STATE.modifyInteraction); STATE.map.addInteraction(STATE.snapInteraction);
}
function undoLastDraw() {
  if(STATE.drawInteraction){ STATE.drawInteraction.removeLastPoint(); return; }
  const src=STATE.drawLayer.getSource(), feats=src.getFeatures();
  if(feats.length){ src.removeFeature(feats[feats.length-1]); STATE.drawFeatures.pop(); showToast('Última figura eliminada','info'); }
}
function clearDrawings() { STATE.drawLayer.getSource().clear(); STATE.drawFeatures=[]; deactivateTool(); showToast('Dibujos eliminados','info'); }
function exportDrawings() {
  const feats=STATE.drawLayer.getSource().getFeatures();
  if(!feats.length){ showToast('No hay dibujos para exportar','error'); return; }
  const json=new ol.format.GeoJSON().writeFeatures(feats,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
  downloadBlob(json,'dibujos.geojson','application/json'); showToast('Exportado como dibujos.geojson','success');
}
function labelSelectedFeature() {
  if(!STATE.selectInteraction){ showToast('Activa "Editar" primero','error'); return; }
  const sel=STATE.selectInteraction.getFeatures();
  if(!sel.getLength()){ showToast('Selecciona una figura primero','error'); return; }
  const label=prompt('Etiqueta:'); if(label!==null){ sel.item(0).set('label',label); STATE.drawLayer.changed(); showToast(`Etiqueta: "${label}"`,'success'); }
}

/* ---- Importar ---- */
function initImportDrop() {
  const el=document.getElementById('map');
  el.addEventListener('dragover', e=>{ e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', ()=>el.classList.remove('drag-over'));
  el.addEventListener('drop', e=>{ e.preventDefault(); el.classList.remove('drag-over'); const f=e.dataTransfer?.files[0]; if(f) importFile(f); });
}
function importFile(file) {
  if(!file) return;
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['geojson','json','kml'].includes(ext)){ showToast('Formato no soportado. Usa GeoJSON o KML','error'); return; }
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const feats = ext==='kml'
        ? new ol.format.KML({extractStyles:true}).readFeatures(e.target.result,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'})
        : new ol.format.GeoJSON().readFeatures(e.target.result,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
      const src=STATE.importLayer.getSource(); src.addFeatures(feats);
      STATE.map.getView().fit(src.getExtent(),{padding:[60,60,60,60],duration:600});
      showToast(`${feats.length} objetos importados desde ${file.name}`,'success');
      document.getElementById('import-file-input').value='';
    } catch(err){ showToast('Error al leer el archivo','error'); console.error(err); }
  };
  reader.readAsText(file);
}
function clearImport() { STATE.importLayer.getSource().clear(); showToast('Capa importada eliminada','info'); }

/* ============================================================ GetFeatureInfo */
function initGetFeatureInfo() {
  const popup=document.getElementById('popup');
  //const popupOverlay=new ol.Overlay({ element:popup, autoPan:{animation:{duration:250}} });
  const popupOverlay = new ol.Overlay({ element: popup, autoPan: false });
  STATE.map.addOverlay(popupOverlay);

  document.getElementById('popup-closer').addEventListener('click', ()=>{ popupOverlay.setPosition(undefined); popup.classList.remove('visible'); });

  STATE.map.on('singleclick', async evt=>{
    if(STATE.activeTool) return;
    popup.classList.remove('visible');
    const visLayers=STATE.config.layers.filter(lc=>STATE.olLayers[lc.id]?.getVisible());
    if(!visLayers.length) return;
    const view=STATE.map.getView(), res=view.getResolution(), proj=view.getProjection();
    document.getElementById('popup-content').innerHTML='<div class="popup-loading">Consultando...</div>';
    popupOverlay.setPosition(evt.coordinate); popup.classList.add('visible');
    let found=false;
    for(const lc of visLayers){
      try{
        const url=STATE.olLayers[lc.id].getSource().getFeatureInfoUrl(evt.coordinate,res,proj,{INFO_FORMAT:'application/json',FEATURE_COUNT:5});
        if(!url) continue;
        const r=await fetch(resolveUrl(url));
        if(!r.ok) continue;
        const data=await r.json();
        if(data.features?.length){ found=true; renderPopup(lc.name,data.features[0].properties); break; }
      } catch(e){ console.warn(`GFI falló ${lc.id}:`,e.message); }
    }
    if(!found){
      const ll=ol.proj.toLonLat(evt.coordinate);
      const names=visLayers.map(l=>`<li>${l.name}</li>`).join('');
      document.getElementById('popup-content').innerHTML=`
        <div class="popup-fallback">
          <div class="popup-coords"><span>Lon: ${ll[0].toFixed(5)}</span><span>Lat: ${ll[1].toFixed(5)}</span></div>
          <div class="popup-note">Capas visibles en este punto:</div>
          <ul class="popup-layers">${names}</ul>
          <div class="popup-hint">GetFeatureInfo requiere CORS habilitado en el servidor.</div>
        </div>`;
    }
  });
}

function renderPopup(layerName, props) {
  const rows=Object.entries(props).filter(([k,v])=>v!==null&&v!==''&&!k.startsWith('@'))
    .map(([k,v])=>`<tr><td class="prop-key">${k}</td><td class="prop-val">${v}</td></tr>`).join('');
  document.getElementById('popup-content').innerHTML=`
    <div class="popup-layer-name">${layerName}</div>
    ${rows?`<table class="prop-table">${rows}</table>`:'<div class="popup-empty">Sin atributos</div>'}`;
}

/* ============================================================ DESCARGAS */
function downloadLayer(layerId, format, btn) {
  const lc=STATE.config.layers.find(l=>l.id===layerId); if(!lc) return;
  const ext=format==='SHAPE-ZIP'?'zip':format==='application/json'?'geojson':'kml';
  const params=new URLSearchParams({service:'WFS',version:'1.0.0',request:'GetFeature',typeName:lc.wfsLayer,outputFormat:format,srsName:'EPSG:4326'});
  btn.classList.add('loading');
  showToast(`Descargando ${lc.name} (${ext.toUpperCase()})…`,'info');
  window.open(`${lc.wfsUrl}?${params}`,'_blank','noopener');
  setTimeout(()=>{ btn.classList.remove('loading'); showToast(`Descarga iniciada: ${lc.id}.${ext}`,'success'); },800);
}

/* ============================================================ FOOTER / UTILS */
function initFooter() { const c=STATE.config.config; updateCoords(c.defaultCenter[0],c.defaultCenter[1]); }
function updateCoords(lon, lat) { const el=document.getElementById('footer-coords'); if(el) el.innerHTML=`Lon: <span>${lon.toFixed(5)}</span> &nbsp; Lat: <span>${lat.toFixed(5)}</span>`; }
function downloadBlob(content, filename, mime) {
  const url=URL.createObjectURL(new Blob([content],{type:mime})), a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function showToast(msg, type='info') {
  const c=document.getElementById('toast-container'), t=document.createElement('div');
  t.className=`toast toast-${type}`;
  t.innerHTML=`<span class="toast-icon">${{success:iconCheckCircle(),error:iconAlertCircle(),info:iconInfoCircle()}[type]||iconInfoCircle()}</span><span>${msg}</span>`;
  c.appendChild(t); setTimeout(()=>{ t.classList.add('hide'); setTimeout(()=>t.remove(),220); },3500);
}

/* ============================================================ ICONS */
function iconZip(){return`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3M7 7v2M7 11v2M8 9h1M8 11h1"/></svg>`;}
function iconJson(){return`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5C2 4 3 3 4 4v2c0 1 1 1 1 2s-1 1-1 2v2c-1 1-2 0-2-1"/><path d="M14 5c0-1-1-2-2-1v2c0 1-1 1-1 2s1 1 1 2v2c1 1 2 0 2-1"/><line x1="7" y1="8" x2="9" y2="8"/></svg>`;}
function iconKml(){return`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a5 5 0 0110 0c0 4-5 8-5 8S3 11 3 7z"/><circle cx="8" cy="7" r="2"/></svg>`;}
function iconCheckCircle(){return`<svg viewBox="0 0 16 16" fill="none" stroke="#A5D6A7" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M5 8l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
function iconAlertCircle(){return`<svg viewBox="0 0 16 16" fill="none" stroke="#EF9A9A" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="9" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.5" fill="#EF9A9A"/></svg>`;}
function iconInfoCircle(){return`<svg viewBox="0 0 16 16" fill="none" stroke="#F4A021" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="7" x2="8" y2="11" stroke-linecap="round"/><circle cx="8" cy="5" r="0.5" fill="#F4A021"/></svg>`;}
