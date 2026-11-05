# DataP

**Tu espacio de organización**: proyectos, tareas, calendario, notas, hábitos,
enfoque y análisis de datos en un solo lugar. Es la base de una super app de
organización y funciona como web o como app instalable en el móvil, sin servidor y
sin instalar nada.

## Qué incluye

| Sección | Qué hace |
|---|---|
| **Panel** | Resumen del día: tareas próximas (atrasadas primero), hábitos de hoy, temporizador de enfoque, avance de cada proyecto y notas recientes. |
| **Tareas** | Tablero *Por hacer / En curso / Hecho*. Arrastra entre columnas, filtra por proyecto o prioridad. Cada tarea admite subtareas, fecha límite y repetición. |
| **Calendario** | Mes completo con las tareas en su fecha. Arrastra una tarea a otro día (o desde *Sin fecha*) para reprogramarla; toca un día para añadir tareas en esa fecha. |
| **Notas** | Editor con guardado automático, vista previa con formato simple (`## título`, `- lista`, `**negrita**`, `- [ ] pendiente`, enlaces) y notas fijadas. |
| **Hábitos** | Marca cada día lo que quieres repetir. Racha actual, mejor racha, cumplimiento de 30 días y mapa de los últimos 6 meses. Puedes corregir los últimos 7 días. |
| **Enfoque** | Temporizador por bloques (25 min + descansos) unido a una tarea. Sigue contando aunque cambies de página, avisa al terminar y registra los minutos por tarea y por día. |
| **Proyectos** | Cada proyecto agrupa sus tareas, notas, enlaces y reportes, con su porcentaje de avance. |
| **Reporte · Segmentación de clientes** | Resultados del notebook PCA: correlación, varianza, cargas, segmentación e interpretación ejecutiva. |
| **Laboratorio PCA** | Sube un `.xlsx` o `.csv` y repite el análisis en el navegador (mismos resultados que scikit-learn). Descarga CSV o guarda el resumen como nota de un proyecto. |
| **Ajustes** | Tema claro/oscuro/sistema, exportar e importar respaldo, restablecer datos, guía de captura y atajos. |

Además:

- **Captura inteligente**: escribe la tarea como la dirías y DataP entiende el resto.
  `Llamar a Ana el viernes !alta #datap` crea «Llamar a Ana» para el viernes, prioridad
  alta, en el proyecto DataP. Entiende `hoy`, `mañana`, `el 15`, `15/12`,
  `24 de diciembre`, `en 3 días`, `la próxima semana`, `!alta`/`!media`/`!baja`,
  `#proyecto` y repeticiones como `cada día`, `cada lunes`, `entre semana` o `cada mes`.
- **Tareas que se repiten**: al completarla se crea la siguiente con su nueva fecha.
- **Buscador `Ctrl + K`** (`⌘ + K` en Mac, o `/`): ve a cualquier página, proyecto, tarea,
  nota o hábito, o escribe algo y créalo. **`N`** abre una tarea nueva.
- **Deshacer**: completar, mover, reprogramar o eliminar muestra un aviso con *Deshacer*.
- **App instalable y sin conexión** cuando se publica (GitHub Pages): menú del navegador ›
  *Añadir a pantalla de inicio*.

### ¿Dónde se guardan mis datos?

En **tu navegador** (localStorage), en ese dispositivo. No se envían a ningún servidor.
Para pasarlos a otro equipo o tener copia, usa *Ajustes › Exportar respaldo* (archivo
`.json`) y luego *Importar* en el otro navegador. Los respaldos de versiones anteriores
se pueden importar sin problema. Si borras los datos del sitio en el
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
        │   ├── store.js              ← Proyectos, tareas, notas, hábitos y enfoque
        │   ├── ui.js                 ← Diálogos, avisos, buscador, captura inteligente
        │   ├── focus.js              ← Temporizador de enfoque
        │   ├── lib/                  ← PCA, lectura de Excel/CSV, gráficos SVG
        │   └── modules/              ← Una página por archivo
        │       ├── inicio.js         ← Panel
        │       ├── tareas.js
        │       ├── calendario.js
        │       ├── notas.js
        │       ├── habitos.js
        │       ├── enfoque.js
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
