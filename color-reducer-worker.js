self.importScripts("colorReducer.js");

self.addEventListener("message", function (e) {
  const { imageData, colorCount } = e.data;
  const colorReducer = new ColorReducer();

  colorReducer.onProgress = (stage, progress) => {
    self.postMessage({ type: "progress", stage, progress });
  };

  try {
    const reducedImageData = colorReducer.reduceColors(imageData, colorCount);
    const palette = colorReducer.getPalette();
    self.postMessage({ type: "result", reducedImageData, palette }, [
      reducedImageData.data.buffer,
    ]);
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
});
