self.importScripts("colorReducer.js");

const colorReducer = new self.ColorReducer();

self.onmessage = function (e) {
  const { colors, centroid, iteration, threshold } = e.data;
  const cluster = [];

  for (let i = 0; i < colors.length; i++) {
    if (colorReducer.calculateColorDistance(colors[i], centroid) < threshold) {
      cluster.push(colors[i]);
    }

    // Send progress update back to the main thread
    if (i % 100 === 0) {
      self.postMessage({ progress: (i / colors.length) * (iteration + 1) });
    }
  }

  self.postMessage({ cluster });
};
