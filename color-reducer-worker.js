self.importScripts("colorReducer.js");

self.addEventListener("message", function (e) {
  const { imageData, colorCount } = e.data;
  const colorReducer = new ColorReducer();
  const reducedImageData = colorReducer.reduceColors(imageData, colorCount);
  const palette = colorReducer.getPalette();
  self.postMessage({ reducedImageData, palette }, [
    reducedImageData.data.buffer,
  ]);
});
