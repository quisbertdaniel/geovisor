# 🌐 GeoVisor — Visor de Servicios OGC (WMS/WFS)

<div align="center">

![GeoVisor Banner](https://img.shields.io/badge/GeoVisor-WMS%20%2F%20WFS-F4A021?style=for-the-badge&logo=leaflet&logoColor=white)
![OpenLayers](https://img.shields.io/badge/OpenLayers-9.x-1F6B75?style=for-the-badge&logo=openlayers&logoColor=white)
![GeoServer](https://img.shields.io/badge/GeoServer-2.x-4A90D9?style=for-the-badge)
![License](https://img.shields.io/badge/Licencia-MIT-A5D6A7?style=for-the-badge)

**Visor web profesional de código abierto para servicios OGC. Diseñado como herramienta de aprendizaje y referencia práctica para cursos de GeoServer, PostGIS, Flutter y Webmapping.**

[**Ver demo en vivo →**](https://quisbertdaniel.github.io/geovisor/)

</div>

---

## ¿Qué es GeoVisor?

GeoVisor es un cliente web ligero y configurable para consumir y visualizar servicios geoespaciales estándar **WMS** (Web Map Service) y **WFS** (Web Feature Service) publicados desde GeoServer. No requiere backend propio, frameworks pesados ni proceso de build: se ejecuta directamente desde cualquier servidor web estático o incluso desde GitHub Pages.

El proyecto nació como material de apoyo para los **cursos de ARTECLAB**, pero está diseñado para ser reutilizado, adaptado y extendido por cualquier persona que trabaje con datos espaciales.

---

## ✨ Características

- **Panel de capas dinámico** — cargado desde `data.json`, sin tocar código
- **Activar/desactivar capas WMS** con toggle individual
- **Control de opacidad** por capa con slider en tiempo real
- **Cambio de mapa base** entre OpenStreetMap y Satelital (Esri)
- **Descarga directa por WFS** en tres formatos:
  - 📦 Shapefile comprimido (`.zip`)
  - 🗺 GeoJSON (`.geojson`)
  - 📍 KML (`.kml`)
- **Visualización de coordenadas** en tiempo real al mover el cursor
- **Controles de zoom** personalizados (acercar, alejar, volver a extensión inicial)
- **Notificaciones tipo toast** para feedback de acciones
- **Diseño responsive** — funciona en escritorio, tablet y móvil
- **Cero dependencias de backend** — HTML + CSS + JS puro

---

## 🎓 Para quién está hecho

Este visor es material de referencia abierta para estudiantes de los siguientes cursos:

| Curso | Cómo se usa este visor |
|---|---|
| **GeoServer Profesional** | Consumir capas WMS/WFS publicadas desde GeoServer, entender parámetros OGC |
| **PostGIS** | Visualizar capas espaciales almacenadas en PostgreSQL/PostGIS y servidas por GeoServer |
| **Webmapping** | Estudiar la arquitectura cliente-servidor, uso de OpenLayers, HTML/CSS/JS aplicado a SIG |
| **Flutter** | Referencia de endpoints WMS/WFS para integrar mapas en apps móviles con flutter_map |

> Puedes clonar este repositorio, apuntar `data.json` a tu propio GeoServer y tener un visor funcional en minutos.

---

## 🚀 Demo en vivo

> **[https://quisbertdaniel.github.io/geovisor/](https://quisbertdaniel.github.io/geovisor/)**

La demo está conectada a capas de ejemplo del territorio boliviano (departamentos, municipios, hidrografía, red vial y áreas protegidas).

---

## 📁 Estructura del proyecto

```
geovisor/
│
├── index.html       # Estructura HTML semántica del visor
├── style.css        # Estilos — tema Navy + Dorado, responsive
├── scripts.js       # Lógica del mapa: capas, descargas, controles
└── data.json        # ← ÚNICA configuración que necesitas editar
```

La separación es intencional: `data.json` actúa como el archivo de configuración central. Todo el comportamiento del visor se genera a partir de él sin modificar HTML ni JavaScript.

---

## ⚙️ Instalación y uso

### Opción 1 — Servidor local (recomendado para desarrollo)

```bash
# Clona el repositorio
git clone https://github.com/quisbertdaniel/geovisor.git
cd geovisor

# Inicia un servidor estático (Python 3)
python3 -m http.server 8090

# Abre en el navegador
# http://localhost:8090
```

También puedes usar la extensión **Live Server** de VS Code o cualquier servidor HTTP estático.

### Opción 2 — GitHub Pages

El visor puede desplegarse directamente desde la rama `main` o `gh-pages` de tu repositorio. Ve a **Settings → Pages → Source** y selecciona la rama raíz. En segundos estará disponible en `https://tu-usuario.github.io/geovisor/`.

### Opción 3 — Servidor web existente (Apache / Nginx / Tomcat)

Copia los 4 archivos a cualquier directorio publicado por tu servidor web. No se necesita configuración adicional.

---

## 🔧 Configuración — data.json

Toda la personalización del visor se realiza editando `data.json`. El archivo tiene tres secciones:

### `config` — ajustes generales

```json
"config": {
  "title": "Curso GeoServer Profesional",
  "geoserverUrl": "http://tu-servidor:8080/geoserver",
  "defaultCenter": [-65.0, -16.5],
  "defaultZoom": 6
}
```

| Campo | Descripción |
|---|---|
| `geoserverUrl` | URL base de tu instancia de GeoServer |
| `defaultCenter` | Coordenadas `[longitud, latitud]` del centro inicial |
| `defaultZoom` | Nivel de zoom inicial (1–18) |

### `basemaps` — mapas base

```json
"basemaps": [
  { "id": "osm",      "name": "OpenStreetMap", "type": "OSM", "visible": true },
  { "id": "satelital","name": "Satelital",      "type": "XYZ",
    "url": "https://server.arcgisonline.com/.../tile/{z}/{y}/{x}", "visible": false }
]
```

### `layers` — capas WMS/WFS

Agrega tantas capas como necesites. Cada entrada tiene esta estructura:

```json
{
  "id": "departamentos",
  "name": "Departamentos de Bolivia",
  "description": "División político-administrativa de primer nivel.",
  "type": "WMS",
  "wmsUrl": "http://localhost:8080/geoserver/bolivia/wms",
  "wfsUrl": "http://localhost:8080/geoserver/bolivia/wfs",
  "wmsLayer": "bolivia:departamentos",
  "wfsLayer": "bolivia:departamentos",
  "visible": true,
  "opacity": 0.85,
  "downloadEnabled": true,
  "color": "#F4A021"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Identificador único interno |
| `name` | string | Nombre visible en el panel de capas |
| `description` | string | Texto descriptivo mostrado en la tarjeta |
| `wmsUrl` | string | Endpoint WMS de GeoServer |
| `wfsUrl` | string | Endpoint WFS de GeoServer (para descargas) |
| `wmsLayer` | string | Nombre de capa WMS (`workspace:nombre`) |
| `wfsLayer` | string | Nombre de capa WFS (`workspace:nombre`) |
| `visible` | boolean | Visibilidad inicial al cargar el mapa |
| `opacity` | number | Opacidad inicial (0.0 – 1.0) |
| `downloadEnabled` | boolean | Muestra o no los botones de descarga |
| `color` | string | Color del indicador visual en la tarjeta (hex) |

---

## 🌐 Requisitos del servidor GeoServer

Para que el visor funcione correctamente, tu instancia de GeoServer debe tener habilitado **CORS** (Cross-Origin Resource Sharing). En Tomcat 11, edita el archivo `web.xml` de GeoServer y agrega el filtro correspondiente:

```xml
<filter>
  <filter-name>CorsFilter</filter-name>
  <filter-class>org.apache.catalina.filters.CorsFilter</filter-class>
  <init-param>
    <param-name>cors.allowed.origins</param-name>
    <param-value>*</param-value>
  </init-param>
</filter>
<filter-mapping>
  <filter-name>CorsFilter</filter-name>
  <url-pattern>/*</url-pattern>
</filter-mapping>
```

> ⚠️ En producción reemplaza `*` por el dominio específico de tu visor.

---

## 🛠 Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| [OpenLayers](https://openlayers.org/) | 9.x | Motor de mapa — WMS, WFS, controles |
| HTML5 + CSS3 | — | Estructura y estilos |
| JavaScript ES2020 | — | Lógica del visor (sin frameworks) |
| [Rajdhani + Inter](https://fonts.google.com/) | — | Tipografía (Google Fonts) |
| GeoServer | 2.x | Servidor de datos OGC |
| GitHub Pages | — | Hosting del demo |

---

## 📋 Roadmap

Funcionalidades planeadas para próximas versiones:

- [ ] Popup de atributos al hacer clic en una feature WMS/WFS
- [ ] Búsqueda de features por atributo (WFS `GetFeature` con filtros CQL)
- [ ] Soporte para capas WMTS
- [ ] Exportar mapa actual como imagen PNG
- [ ] Medición de distancias y áreas
- [ ] Geolocalización del usuario

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si eres estudiante de uno de los cursos y quieres mejorar el visor, puedes:

1. Hacer un fork del repositorio
2. Crear una rama descriptiva (`git checkout -b feature/popup-atributos`)
3. Hacer commit de tus cambios (`git commit -m 'Agrega popup de atributos WFS'`)
4. Abrir un Pull Request con una descripción clara de los cambios

---

## 📄 Licencia

Este proyecto está publicado bajo la licencia **MIT**. Puedes usarlo, modificarlo y distribuirlo libremente, incluso para fines comerciales, siempre que se mantenga el aviso de atribución.

```
MIT License — Copyright (c) 2025 Daniel Quisbert — ARTECLAB
```

---

## 👤 Autor

**Daniel Quisbert**
Instructor — ARTECLAB · GeoServer · PostGIS · Flutter · Webmapping

[![GitHub](https://img.shields.io/badge/GitHub-quisbertdaniel-181717?style=flat-square&logo=github)](https://github.com/quisbertdaniel)

---

<div align="center">
  <sub>Hecho con ❤️ para la comunidad GIS de habla hispana · ARTECLAB Bolivia</sub>
</div>
