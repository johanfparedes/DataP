# DataP

**Tu espacio de organización**: proyectos, tareas, notas y análisis de datos en un
solo lugar. Es la base de una super app de organización y funciona como web
o como app instalable en el móvil, sin servidor y sin instalar nada.

## Qué incluye

| Sección | Qué hace |
|---|---|
| **Panel** | Resumen del día: tareas próximas (atrasadas primero), avance de cada proyecto, notas recientes y accesos rápidos. |
| **Tareas** | Tablero *Por hacer / En curso / Hecho*. Arrastra entre columnas, añade con Enter, filtra por proyecto o prioridad, fechas límite y avisos de atraso. |
| **Notas** | Editor con guardado automático, vista previa con formato simple (`## título`, `- lista`, `**negrita**`, `- [ ] pendiente`, enlaces) y notas fijadas. |
| **Proyectos** | Cada proyecto agrupa sus tareas, notas, enlaces y reportes, con su porcentaje de avance. |
| **Reporte · Segmentación de clientes** | Resultados del notebook PCA: correlación, varianza, cargas, segmentación e interpretación ejecutiva. |
| **Laboratorio PCA** | Sube un `.xlsx` o `.csv` y repite el análisis en el navegador (mismos resultados que scikit-learn). Descarga CSV o guarda el resumen como nota de un proyecto. |
| **Ajustes** | Tema claro/oscuro/sistema, exportar e importar respaldo, restablecer datos, atajos. |

Además:

- **Buscador `Ctrl + K`** (`⌘ + K` en Mac, o `/`): ve a cualquier página, proyecto, tarea o
  nota, o escribe algo y créalo como tarea o nota.
- **Deshacer**: completar, mover o eliminar muestra un aviso con *Deshacer*.
- **App instalable y sin conexión** cuando se publica (GitHub Pages): menú del navegador ›
  *Añadir a pantalla de inicio*.

### ¿Dónde se guardan mis datos?

En **tu navegador** (localStorage), en ese dispositivo. No se envían a ningún servidor.
Para pasarlos a otro equipo o tener copia, usa *Ajustes › Exportar respaldo* (archivo
`.json`) y luego *Importar* en el otro navegador. Si borras los datos del sitio en el
navegador, se pierden: exporta un respaldo de vez en cuando.

## Cómo abrirla

- **En tu computadora:** abre `docs/index.html` con doble clic.
- **Con un servidor local** (necesario para probar la app instalable y sin conexión):
  ```bash
  cd docs
  python3 -m http.server 8000
  # abre http://localhost:8000
  ```
- **Publicarla con GitHub Pages:** en el repositorio ve a *Settings › Pages*, elige
  *Deploy from a branch*, rama `main` y carpeta `/docs`. Quedará en
  `https://johanfparedes.github.io/DataP/`.

## Estructura del repositorio

```
DataP/
├── README.md
├── notebooks/
│   └── analisis_pca_clientes.ipynb   ← Notebook de Colab
├── data/
│   └── README.md                     ← Formato esperado de Data.xlsx
└── docs/                             ← La web / app
    ├── index.html
    ├── manifest.webmanifest          ← App instalable
    ├── sw.js                         ← Funcionamiento sin conexión
    └── assets/
        ├── css/
        │   ├── styles.css            ← Base, tokens de color, tema claro/oscuro
        │   └── app.css               ← Tablero, notas, diálogos, buscador, avisos
        ├── js/
        │   ├── app.js                ← Núcleo: menú, rutas, tema, atajos
        │   ├── store.js              ← Proyectos, tareas y notas (guardado y respaldo)
        │   ├── ui.js                 ← Diálogos, avisos, buscador, formato de notas
        │   ├── lib/                  ← PCA, lectura de Excel/CSV, gráficos SVG
        │   └── modules/              ← Una página por archivo
        │       ├── inicio.js         ← Panel
        │       ├── tareas.js
        │       ├── notas.js
        │       ├── proyectos.js
        │       ├── analisis-pca.js   ← Reporte del notebook
        │       ├── laboratorio.js
        │       └── ajustes.js
        ├── data/pca-clientes.js      ← Resultados guardados del notebook
        ├── icons/                    ← Iconos de la app
        └── img/                      ← Figuras exportadas del notebook
```

## Cómo agregar un módulo nuevo

Cada página es un módulo que se registra solo en el menú y en el buscador.

1. Crea `docs/assets/js/modules/mi-modulo.js`:
   ```js
   (function () {
     DataP.registerModule({
       id: 'mi-modulo',            // ruta: #/mi-modulo
       title: 'Mi módulo',
       section: 'General',         // 'General' | 'Herramientas'
       icon: 'grid',               // ver ICONS en app.js
       order: 30,
       summary: 'Descripción corta (aparece en el buscador).',
       render: function (root) {
         root.innerHTML = '<h1>Mi módulo</h1>';
         // Para reaccionar a cambios de datos:
         // return DataP.store.subscribe(function () { /* volver a dibujar */ });
       },
     });
   })();
   ```
2. Añade `<script src="assets/js/modules/mi-modulo.js"></script>` al final de
   `docs/index.html` y su ruta a la lista `SHELL` de `docs/sw.js` (para que funcione
   sin conexión).

Para un proyecto de datos nuevo: guarda el notebook en `notebooks/`, copia sus
resultados a `docs/assets/data/`, crea su módulo de reporte y enlázalo desde el
proyecto (`report: 'id-del-modulo'`).

## El notebook

`notebooks/analisis_pca_clientes.ipynb` carga `Data.xlsx` (50 clientes, 8 variables),
estandariza, calcula la matriz de correlación, aplica PCA, interpreta las cargas y
dibuja el mapa de segmentación. Se abre en Colab con el botón de la primera celda.
