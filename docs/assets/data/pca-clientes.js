/* ==========================================================================
   Resultados del notebook notebooks/analisis_pca_clientes.ipynb
   Valores copiados de las salidas guardadas del notebook (Colab):
   - muestra: df.head() (celda 2)
   - correlacion: matriz de correlación con 2 decimales (celda 4)
   - varianza: tabla df_varianza.head(4) (celda 5)
   - cargas: loadings de CP1 y CP2 (celda 6)
   El archivo original Data.xlsx no está en el repositorio; para recalcular
   todo con los datos completos usa el Laboratorio PCA.
   ========================================================================== */
(function () {
  'use strict';

  DataP.data.pcaClientes = {
    titulo: 'Segmentación de clientes con PCA',
    notebook: 'notebooks/analisis_pca_clientes.ipynb',
    archivoDatos: 'Data.xlsx',
    observaciones: 50,

    variables: [
      { id: 'Edad', etiqueta: 'Edad', descripcion: 'Edad del cliente, en años.' },
      { id: 'Ingreso_Mensual', etiqueta: 'Ingreso mensual', descripcion: 'Ingreso mensual del cliente.' },
      { id: 'Frecuencia_Compra', etiqueta: 'Frecuencia de compra', descripcion: 'Número de compras en el periodo.' },
      { id: 'Monto_Promedio', etiqueta: 'Monto promedio', descripcion: 'Ticket promedio por compra.' },
      { id: 'Prod_Diferentes', etiqueta: 'Productos diferentes', descripcion: 'Cantidad de productos distintos comprados.' },
      { id: 'Uso_Promociones_%', etiqueta: 'Uso de promociones (%)', descripcion: 'Porcentaje de compras hechas con promoción.' },
      { id: 'Visitas_Web', etiqueta: 'Visitas web', descripcion: 'Visitas a la página web en el periodo.' },
      { id: 'Antiguedad_Años', etiqueta: 'Antigüedad (años)', descripcion: 'Años como cliente.' },
    ],

    // Primeras 5 filas del archivo (df.head()).
    muestra: {
      ids: [1, 2, 3, 4, 5],
      filas: [
        [25, 650, 6, 45, 8, 60, 12, 2],
        [42, 1200, 3, 120, 5, 20, 4, 6],
        [31, 900, 5, 80, 7, 40, 9, 4],
        [29, 750, 7, 55, 10, 70, 14, 3],
        [50, 1500, 2, 200, 4, 15, 3, 10],
      ],
    },

    // Matriz de correlación (mismo orden que "variables").
    correlacion: [
      [1.00, 0.99, -0.95, 0.96, -0.95, -0.96, -0.94, 0.98],
      [0.99, 1.00, -0.95, 0.96, -0.95, -0.96, -0.94, 0.99],
      [-0.95, -0.95, 1.00, -0.87, 0.98, 0.99, 0.99, -0.92],
      [0.96, 0.96, -0.87, 1.00, -0.88, -0.87, -0.85, 0.98],
      [-0.95, -0.95, 0.98, -0.88, 1.00, 0.98, 0.99, -0.92],
      [-0.96, -0.96, 0.99, -0.87, 0.98, 1.00, 0.99, -0.93],
      [-0.94, -0.94, 0.99, -0.85, 0.99, 0.99, 1.00, -0.91],
      [0.98, 0.99, -0.92, 0.98, -0.92, -0.93, -0.91, 1.00],
    ],

    // Resumen de varianza explicada (4 primeros componentes, como en el notebook).
    varianza: [
      { componente: 'CP 1', autovalor: 7.79, explicada: 95.44, acumulada: 95.44 },
      { componente: 'CP 2', autovalor: 0.29, explicada: 3.59, acumulada: 99.03 },
      { componente: 'CP 3', autovalor: 0.03, explicada: 0.36, acumulada: 99.39 },
      { componente: 'CP 4', autovalor: 0.01, explicada: 0.17, acumulada: 99.56 },
    ],

    // Cargas factoriales (loadings), mismo orden que "variables".
    cargas: {
      CP1: [0.357804, 0.358805, -0.354841, 0.341082, -0.354654, -0.355671, -0.351966, 0.353305],
      CP2: [0.179858, 0.194546, 0.315382, 0.598308, 0.305446, 0.289995, 0.405202, 0.361637],
    },

    figuraSegmentacion: 'assets/img/segmentacion-clientes.png',
  };
})();
