# DataP

Espacio para organizar proyectos y análisis de datos. Es el primer paso de una
**super app de organización**: por ahora reúne, en una sola web, el análisis PCA
de segmentación de clientes y una herramienta para repetirlo con datos nuevos.

## Qué hay en la web

| Sección | Qué hace |
|---|---|
| **Inicio** | Accesos a proyectos y herramientas, y mapa del repositorio. |
| **Proyectos › Segmentación de clientes** | Reporte del notebook: datos, matriz de correlación, varianza explicada, cargas factoriales, mapa de segmentación e interpretación ejecutiva. |
| **Herramientas › Laboratorio PCA** | Sube un `.xlsx` o `.csv` y recalcula todo el análisis en el navegador (correlación, PCA, cargas, mapa interactivo y conclusión automática). Permite descargar los resultados en CSV. Los datos no salen de tu equipo. |

## Estructura del repositorio

```
DataP/
├── README.md
├── notebooks/
│   └── analisis_pca_clientes.ipynb   ← Notebook de Colab (antes Untitled0.ipynb)
├── data/
│   └── README.md                     ← Formato esperado de Data.xlsx
└── docs/                             ← La web (GitHub Pages la publica desde aquí)
    ├── index.html
    └── assets/
        ├── css/styles.css            ← Estilos, tema claro/oscuro
        ├── js/app.js                 ← Núcleo: menú, rutas, tema, utilidades
        ├── js/lib/
        │   ├── pca.js                ← Estandarización, correlación y PCA
        │   ├── file-reader.js        ← Lectura de .xlsx y .csv sin librerías
        │   └── charts.js             ← Gráficos SVG con tooltips
        ├── js/modules/               ← Una página por archivo
        │   ├── inicio.js
        │   ├── analisis-pca.js
        │   └── laboratorio.js
        ├── data/pca-clientes.js      ← Resultados guardados del notebook
        └── img/                      ← Figuras exportadas del notebook
```

## Cómo abrir la web

No necesita instalar nada ni compilar.

- **En tu computadora:** abre `docs/index.html` con doble clic.
- **Con un servidor local** (opcional):
  ```bash
  cd docs
  python3 -m http.server 8000
  # abre http://localhost:8000
  ```
- **Publicarla en internet con GitHub Pages:** en el repositorio ve a
  *Settings › Pages*, elige *Deploy from a branch*, rama `main` y carpeta `/docs`.
  Quedará en `https://johanfparedes.github.io/DataP/`.

## Cómo agregar un módulo nuevo

Cada página es un módulo independiente que se registra solo en el menú.

1. Crea `docs/assets/js/modules/mi-modulo.js`:
   ```js
   (function () {
     DataP.registerModule({
       id: 'mi-modulo',            // ruta: #/mi-modulo
       title: 'Mi módulo',
       section: 'Proyectos',       // 'General' | 'Proyectos' | 'Herramientas'
       icon: 'grid',               // ver ICONS en app.js
       order: 20,
       summary: 'Descripción corta para la tarjeta de Inicio.',
       render: function (root) {
         root.innerHTML = '<h1>Mi módulo</h1>';
       },
     });
   })();
   ```
2. Añade `<script src="assets/js/modules/mi-modulo.js"></script>` al final de
   `docs/index.html`.

Para un proyecto nuevo de datos: guarda el notebook en `notebooks/`, copia sus
resultados a `docs/assets/data/` y crea su módulo de reporte.

## El notebook

`notebooks/analisis_pca_clientes.ipynb` carga `Data.xlsx` (50 clientes, 8 variables),
estandariza, calcula la matriz de correlación, aplica PCA, interpreta las cargas y
dibuja el mapa de segmentación. Se abre en Colab con el botón de la primera celda.
