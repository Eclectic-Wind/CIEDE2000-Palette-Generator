class ColorReducer {
  constructor() {
    this.palette = [];
    this.labCache = new Map();
    this.onProgress = null;
  }

  reduceColors(imageData, colorCount) {
    if (!(imageData instanceof ImageData)) {
      throw new Error("Invalid imageData: must be an instance of ImageData");
    }
    if (!Number.isInteger(colorCount) || colorCount < 2) {
      throw new Error("Invalid colorCount: must be an integer greater than 2");
    }

    const pixels = imageData.data;
    this.reportProgress("Analyzing Image", 0);
    const palette = this.buildPalette(pixels, colorCount);
    this.palette = palette;
    this.reportProgress("Applying Palette", 50);
    this.applyPalette(imageData, palette);
    return imageData;
  }

  buildPalette(pixels, colorCount) {
    this.reportProgress("Analyzing Colors", 10);
    const colorArray = new Uint32Array(pixels.length / 4);
    const colorMap = new Map();

    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      if (pixels[i + 3] === 0) continue; // Skip fully transparent pixels
      const color = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      colorArray[j] = color;
      colorMap.set(color, (colorMap.get(color) || 0) + 1);

      if (j % 10000 === 0) {
        this.reportProgress(
          "Analyzing Colors",
          10 + (j / (pixels.length / 4)) * 20
        );
      }
    }

    this.reportProgress("Clustering Colors", 30);
    const colors = Array.from(colorMap.entries()).map(([color, count]) => ({
      r: (color >> 16) & 255,
      g: (color >> 8) & 255,
      b: color & 255,
      count,
    }));

    return this.kMeansClustering(colors, colorCount);
  }

  getPalette() {
    return this.palette.map((color) => ({
      ...color,
      ...this.rgbToHsl(color.r, color.g, color.b),
    }));
  }

  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  kMeansClustering(colors, k, maxIterations = 30, convergenceThreshold = 0.1) {
    let centroids = this.initializeCentroids(colors, k);
    let iteration = 0;
    let hasConverged = false;

    while (iteration < maxIterations && !hasConverged) {
      const clusters = Array.from({ length: k }, () => []);
      for (const color of colors) {
        const nearestIndex = this.findNearestCentroidIndex(color, centroids);
        if (nearestIndex !== -1) {
          clusters[nearestIndex].push(color);
        }
      }

      const newCentroids = clusters
        .map((cluster) => this.calculateNewCentroid(cluster))
        .filter((c) => c !== null);

      hasConverged = this.centroidsConverged(
        centroids,
        newCentroids,
        convergenceThreshold
      );
      centroids = newCentroids;
      iteration++;

      this.reportProgress(
        "Clustering Colors",
        30 + (iteration / maxIterations) * 20
      );
    }

    return centroids;
  }

  findNearestCentroidIndex(color, centroids) {
    let minDist = Infinity,
      index = -1;
    for (let i = 0; i < centroids.length; i++) {
      if (!centroids[i]) continue;
      const dist = this.calculateColorDistance(color, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        index = i;
      }
    }
    return index;
  }

  calculateNewCentroid(cluster) {
    if (cluster.length === 0) return null;
    const sum = cluster.reduce(
      (acc, color) => ({
        r: acc.r + color.r * color.count,
        g: acc.g + color.g * color.count,
        b: acc.b + color.b * color.count,
        count: acc.count + color.count,
      }),
      { r: 0, g: 0, b: 0, count: 0 }
    );
    return sum.count > 0
      ? {
          r: Math.round(sum.r / sum.count),
          g: Math.round(sum.g / sum.count),
          b: Math.round(sum.b / sum.count),
        }
      : null;
  }

  centroidsConverged(oldCentroids, newCentroids, threshold) {
    return (
      oldCentroids.length === newCentroids.length &&
      oldCentroids.every(
        (oldC, i) =>
          oldC &&
          newCentroids[i] &&
          this.calculateColorDistance(oldC, newCentroids[i]) < threshold
      )
    );
  }

  applyPalette(imageData, palette) {
    const pixels = imageData.data;
    const colorCache = new Map();
    const totalPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue;
      const colorKey = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      if (!colorCache.has(colorKey)) {
        const closestColor = this.findClosestColor(
          { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] },
          palette
        );
        colorCache.set(colorKey, closestColor);
      }
      const { r, g, b } = colorCache.get(colorKey);
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;

      if (i % 40000 === 0) {
        this.reportProgress("Applying Palette", 50 + (i / pixels.length) * 50);
      }
    }

    this.reportProgress("Finalizing", 100);
  }

  reportProgress(stage, progress) {
    if (this.onProgress) {
      this.onProgress(stage, progress);
    }
  }

  findClosestColor(color, palette) {
    return palette.reduce((closest, curr) =>
      this.calculateColorDistance(color, curr) <
      this.calculateColorDistance(color, closest)
        ? curr
        : closest
    );
  }

  calculateColorDistance(c1, c2) {
    const lab1 = this.rgbToLab(c1.r, c1.g, c1.b);
    const lab2 = this.rgbToLab(c2.r, c2.g, c2.b);
    return this.deltaE2000(lab1, lab2);
  }

  rgbToLab(r, g, b) {
    const key = `${r},${g},${b}`;
    if (this.labCache.has(key)) {
      return this.labCache.get(key);
    }

    let r_ = r / 255;
    let g_ = g / 255;
    let b_ = b / 255;

    r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
    g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
    b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;

    const x = r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805;
    const y = r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722;
    const z = r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505;

    const X = x / 0.95047;
    const Y = y / 1.0;
    const Z = z / 1.08883;

    const fx = X > 0.008856 ? Math.pow(X, 1 / 3) : 7.787 * X + 16 / 116;
    const fy = Y > 0.008856 ? Math.pow(Y, 1 / 3) : 7.787 * Y + 16 / 116;
    const fz = Z > 0.008856 ? Math.pow(Z, 1 / 3) : 7.787 * Z + 16 / 116;

    const labColor = {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };

    this.labCache.set(key, labColor);
    return labColor;
  }

  deltaE2000(lab1, lab2) {
    const [L1, a1, b1] = [lab1.l, lab1.a, lab1.b];
    const [L2, a2, b2] = [lab2.l, lab2.a, lab2.b];

    const kL = 1,
      kC = 1,
      kH = 1;
    const deg2Rad = Math.PI / 180;

    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cb = (C1 + C2) / 2;

    const G =
      0.5 *
      (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;

    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);
    const Cbp = (C1p + C2p) / 2;

    let h1p = (Math.atan2(b1, a1p) * 180) / Math.PI;
    if (h1p < 0) h1p += 360;
    let h2p = (Math.atan2(b2, a2p) * 180) / Math.PI;
    if (h2p < 0) h2p += 360;

    const Hp =
      Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;

    const T =
      1 -
      0.17 * Math.cos(deg2Rad * (Hp - 30)) +
      0.24 * Math.cos(deg2Rad * (2 * Hp)) +
      0.32 * Math.cos(deg2Rad * (3 * Hp + 6)) -
      0.2 * Math.cos(deg2Rad * (4 * Hp - 63));

    let dHp = h2p - h1p;
    if (Math.abs(dHp) > 180) {
      if (h2p <= h1p) dHp += 360;
      else dHp -= 360;
    }

    const dLp = L2 - L1;
    const dCp = C2p - C1p;
    dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2Rad * (dHp / 2));

    const Sl =
      1 + (0.015 * Math.pow(L1 - 50, 2)) / Math.sqrt(20 + Math.pow(L1 - 50, 2));
    const Sc = 1 + 0.045 * Cbp;
    const Sh = 1 + 0.015 * Cbp * T;

    const dTheta = 30 * Math.exp(-Math.pow((Hp - 275) / 25, 2));
    const Rc =
      2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
    const Rt = -Rc * Math.sin(2 * deg2Rad * dTheta);

    const dE = Math.sqrt(
      Math.pow(dLp / (kL * Sl), 2) +
        Math.pow(dCp / (kC * Sc), 2) +
        Math.pow(dHp / (kH * Sh), 2) +
        Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
    );

    return dE;
  }

  initializeCentroids(colors, k) {
    const centroids = [];
    if (colors.length === 0) return centroids;

    centroids.push(colors[Math.floor(Math.random() * colors.length)]);

    for (let i = 1; i < k; i++) {
      const distances = colors.map((color) =>
        Math.min(
          ...centroids.map((centroid) =>
            centroid ? this.calculateColorDistance(color, centroid) : Infinity
          )
        )
      );

      const totalDist = distances.reduce((sum, dist) => sum + dist, 0);
      if (totalDist === 0) break;

      let r = Math.random() * totalDist;
      let j = 0;
      while (r > 0 && j < distances.length) {
        r -= distances[j];
        j++;
      }
      const nextCentroid = colors[j - 1];

      if (nextCentroid) centroids.push(nextCentroid);
    }

    return centroids;
  }
}

if (
  typeof WorkerGlobalScope !== "undefined" &&
  self instanceof WorkerGlobalScope
) {
  self.ColorReducer = ColorReducer;
}
