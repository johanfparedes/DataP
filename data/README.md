# data/

Carpeta para los archivos de entrada de los análisis.

El notebook `notebooks/analisis_pca_clientes.ipynb` usa **`Data.xlsx`**, que se
sube a Colab al ejecutarlo y no está guardado en el repositorio. Si quieres
versionarlo, colócalo aquí, pero solo si los datos no son sensibles.

## Formato de `Data.xlsx`

Una hoja, con una fila por cliente y estas columnas:

| Columna | Descripción |
|---|---|
| `ID` | Identificador del cliente (se usa como índice) |
| `Edad` | Edad, en años |
| `Ingreso_Mensual` | Ingreso mensual |
| `Frecuencia_Compra` | Número de compras en el periodo |
| `Monto_Promedio` | Ticket promedio por compra |
| `Prod_Diferentes` | Cantidad de productos distintos comprados |
| `Uso_Promociones_%` | Porcentaje de compras con promoción |
| `Visitas_Web` | Visitas a la página web |
| `Antiguedad_Años` | Años como cliente |

El **Laboratorio PCA** de la web (`docs/index.html` › Herramientas) acepta este
mismo formato, en `.xlsx` o `.csv`. Desde ahí también puedes descargar un CSV de
ejemplo con datos sintéticos que sirve como plantilla.
