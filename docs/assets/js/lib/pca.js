/* ==========================================================================
   DataP · estadística: estandarización, correlación y PCA
   Reproduce el flujo del notebook (StandardScaler + sklearn PCA):
   - Estandarización con desviación poblacional (ddof = 0), como StandardScaler.
   - Autovalores de la covarianza de los datos estandarizados con n − 1,
     igual que PCA.explained_variance_.
   - Signo de cada componente: el coeficiente de mayor valor absoluto es
     positivo (convención de svd_flip en scikit-learn ≥ 1.5).
   ========================================================================== */
(function () {
  'use strict';

  function mean(values) {
    var s = 0;
    for (var i = 0; i < values.length; i++) s += values[i];
    return s / values.length;
  }

  /** Desviación estándar poblacional (ddof = 0). */
  function stdPop(values, mu) {
    var m = mu == null ? mean(values) : mu;
    var s = 0;
    for (var i = 0; i < values.length; i++) s += (values[i] - m) * (values[i] - m);
    return Math.sqrt(s / values.length);
  }

  /**
   * Estandariza una matriz n×p por columnas.
   * @returns {{Z:number[][], means:number[], stds:number[]}}
   */
  function standardize(X) {
    var n = X.length;
    var p = X[0].length;
    var means = [];
    var stds = [];
    for (var j = 0; j < p; j++) {
      var col = new Array(n);
      for (var i = 0; i < n; i++) col[i] = X[i][j];
      var mu = mean(col);
      means.push(mu);
      stds.push(stdPop(col, mu));
    }
    var Z = X.map(function (row) {
      return row.map(function (v, j) { return stds[j] > 0 ? (v - means[j]) / stds[j] : 0; });
    });
    return { Z: Z, means: means, stds: stds };
  }

  /** Matriz de correlación de Pearson a partir de datos estandarizados (ddof = 0). */
  function correlationFromZ(Z) {
    var n = Z.length;
    var p = Z[0].length;
    var R = [];
    for (var a = 0; a < p; a++) {
      R.push(new Array(p).fill(0));
    }
    for (var a2 = 0; a2 < p; a2++) {
      for (var b = a2; b < p; b++) {
        var s = 0;
        for (var i = 0; i < n; i++) s += Z[i][a2] * Z[i][b];
        var r = s / n;
        if (a2 === b) r = 1;
        R[a2][b] = r;
        R[b][a2] = r;
      }
    }
    return R;
  }

  /**
   * Autovalores y autovectores de una matriz simétrica (método de Jacobi cíclico).
   * @returns {{values:number[], vectors:number[][]}} vectors[k] es el autovector k.
   */
  function jacobiEigen(M) {
    var n = M.length;
    var a = M.map(function (row) { return row.slice(); });
    var V = [];
    for (var i = 0; i < n; i++) {
      V.push(new Array(n).fill(0));
      V[i][i] = 1;
    }

    for (var sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (var r = 0; r < n; r++) {
        for (var c = r + 1; c < n; c++) off += a[r][c] * a[r][c];
      }
      if (off < 1e-24) break;

      for (var p = 0; p < n - 1; p++) {
        for (var q = p + 1; q < n; q++) {
          var apq = a[p][q];
          if (Math.abs(apq) < 1e-300) continue;
          var theta = (a[q][q] - a[p][p]) / (2 * apq);
          var t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          var cs = 1 / Math.sqrt(t * t + 1);
          var sn = t * cs;
          var k, x, y;
          for (k = 0; k < n; k++) {
            x = a[k][p]; y = a[k][q];
            a[k][p] = cs * x - sn * y;
            a[k][q] = sn * x + cs * y;
          }
          for (k = 0; k < n; k++) {
            x = a[p][k]; y = a[q][k];
            a[p][k] = cs * x - sn * y;
            a[q][k] = sn * x + cs * y;
          }
          for (k = 0; k < n; k++) {
            x = V[k][p]; y = V[k][q];
            V[k][p] = cs * x - sn * y;
            V[k][q] = sn * x + cs * y;
          }
        }
      }
    }

    var values = [];
    var vectors = [];
    for (var e = 0; e < n; e++) {
      values.push(a[e][e]);
      var vec = new Array(n);
      for (var k2 = 0; k2 < n; k2++) vec[k2] = V[k2][e];
      vectors.push(vec);
    }
    return { values: values, vectors: vectors };
  }

  /**
   * Ejecuta el análisis completo.
   * @param {number[][]} X  matriz n×p (filas = observaciones, columnas = variables)
   * @returns {Object} resultados con correlación, varianza, cargas y puntuaciones
   */
  function run(X) {
    var n = X.length;
    var p = X[0].length;
    if (n < 3) throw new Error('Se necesitan al menos 3 filas con datos completos.');
    if (p < 2) throw new Error('Se necesitan al menos 2 variables numéricas.');

    var st = standardize(X);
    var R = correlationFromZ(st.Z);
    var eig = jacobiEigen(R);

    var order = eig.values
      .map(function (v, i) { return i; })
      .sort(function (i, j) { return eig.values[j] - eig.values[i]; });

    var nComp = Math.min(n, p);
    var factor = n / (n - 1); // corr (ddof 0) → covarianza muestral (n − 1)
    var totalVar = 0;
    var eigenvalues = [];
    var components = [];

    for (var c = 0; c < nComp; c++) {
      var idx = order[c];
      var lambda = Math.max(0, eig.values[idx]) * factor;
      var vec = eig.vectors[idx].slice();
      // Convención de signo: el coeficiente de mayor |valor| queda positivo.
      var maxAbs = 0;
      var maxIdx = 0;
      for (var j = 0; j < p; j++) {
        if (Math.abs(vec[j]) > maxAbs) { maxAbs = Math.abs(vec[j]); maxIdx = j; }
      }
      if (vec[maxIdx] < 0) vec = vec.map(function (v) { return -v; });
      eigenvalues.push(lambda);
      components.push(vec);
    }
    for (var t = 0; t < p; t++) totalVar += Math.max(0, eig.values[t]) * factor;

    var explained = eigenvalues.map(function (l) { return totalVar > 0 ? (l / totalVar) * 100 : 0; });
    var cumulative = [];
    explained.reduce(function (acc, v, i) { cumulative[i] = acc + v; return cumulative[i]; }, 0);

    var scores = st.Z.map(function (row) {
      return components.map(function (vec) {
        var s = 0;
        for (var j2 = 0; j2 < p; j2++) s += row[j2] * vec[j2];
        return s;
      });
    });

    var k80 = cumulative.findIndex(function (v) { return v >= 80; }) + 1;
    var kaiser = eigenvalues.filter(function (l) { return l > 1; }).length;

    return {
      n: n,
      p: p,
      means: st.means,
      stds: st.stds,
      Z: st.Z,
      correlation: R,
      eigenvalues: eigenvalues,
      explained: explained,
      cumulative: cumulative,
      components: components, // components[k][j] = carga de la variable j en el componente k
      scores: scores,         // scores[i][k]
      k80: k80 || nComp,
      kaiser: kaiser,
    };
  }

  DataP.lib.pca = {
    mean: mean,
    stdPop: stdPop,
    standardize: standardize,
    correlationFromZ: correlationFromZ,
    jacobiEigen: jacobiEigen,
    run: run,
  };
})();
