document.addEventListener("DOMContentLoaded", () => {
  const imageUpload = document.getElementById("imageUpload");
  const imagePreview = document.getElementById("imagePreview");
  const resultImage = document.getElementById("resultImage");
  const reduceColorsBtn = document.getElementById("reduceColors");
  const colorCountInput = document.getElementById("colorCount");
  const downloadLink = document.getElementById("downloadLink");
  const slider = document.getElementById("slider");
  const darkModeToggle = document.getElementById("darkModeToggle");
  const imageContainer = document.getElementById("imageContainer");
  const zoomIn = document.getElementById("zoomIn");
  const zoomOut = document.getElementById("zoomOut");
  const resetZoom = document.getElementById("resetZoom");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const paletteContainer = document.getElementById("paletteContainer");
  const sliderContainer = document.querySelector(".slider-container");
  const sliderLine = document.createElement("div");
  sliderLine.className = "slider-line";
  sliderContainer.appendChild(sliderLine);

  let worker;
  let scale = 1;
  let translateX = 0,
    translateY = 0;

  // Load dark mode preference
  if (localStorage.getItem("darkMode") === "false") {
    document.documentElement.classList.remove("dark");
    darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }

  function updateSlider() {
    const sliderPos = slider.value / 100;
    sliderLine.style.left = `${sliderPos * 100}%`;
    resultImage.style.clipPath = `inset(0 0 0 ${sliderPos * 100}%)`;
  }

  function updateImageTransform() {
    const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    imagePreview.style.transform = transform;
    resultImage.style.transform = transform;
  }

  function resetZoomAndPosition() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateImageTransform();
  }

  imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        imagePreview.src = event.target.result;
        resultImage.src = event.target.result;
        sliderContainer.style.display = "block";
        resetZoomAndPosition();
        slider.value = 50; // Reset slider to middle
        updateSlider();
      };
      reader.readAsDataURL(file);
    }
  });
  function displayPalette(palette) {
    if (!palette || !Array.isArray(palette)) {
      console.error("Invalid palette:", palette);
      return;
    }

    paletteContainer.innerHTML = "";

    // Sort the palette by hue
    palette.sort((a, b) => a.h - b.h);

    let currentHueGroup = null;
    let hueGroupContainer = null;

    palette.forEach((color, index) => {
      // Check if we need to start a new hue group
      if (index === 0 || Math.abs(color.h - palette[index - 1].h) > 30) {
        currentHueGroup = Math.floor(color.h / 30) * 30;
        hueGroupContainer = document.createElement("div");
        hueGroupContainer.className = "hue-group";
        paletteContainer.appendChild(hueGroupContainer);
      }

      const colorCube = document.createElement("div");
      colorCube.className = "color-cube";
      colorCube.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
      colorCube.title = `RGB(${color.r}, ${color.g}, ${
        color.b
      })\nHSL(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(
        color.l
      )}%)`;
      hueGroupContainer.appendChild(colorCube);
    });
  }

  reduceColorsBtn.addEventListener("click", () => {
    if (imagePreview.src.startsWith("data:image/svg+xml")) {
      alert("Please upload an image first.");
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const colorCount = parseInt(colorCountInput.value);

      loadingIndicator.style.display = "flex";

      if (!worker) {
        worker = new Worker("color-reducer-worker.js");
      }

      worker.onmessage = function (e) {
        const { reducedImageData, palette } = e.data;
        ctx.putImageData(reducedImageData, 0, 0);
        const reducedImageSrc = canvas.toDataURL("image/png");
        resultImage.src = reducedImageSrc;
        downloadLink.href = reducedImageSrc;
        downloadLink.download = "reduced_palette.png";
        downloadLink.style.display = "inline-block";
        loadingIndicator.style.display = "none";
        updateSlider();

        if (palette) {
          displayPalette(palette);
        } else {
          console.error("Palette not received from worker");
        }
      };

      worker.postMessage({ imageData, colorCount }, [imageData.data.buffer]);
    };
    img.src = imagePreview.src;
  });

  slider.addEventListener("input", updateSlider);

  let isDragging = false;
  let startX, startY;

  imageContainer.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".slider-container")) {
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateImageTransform();
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  zoomIn.addEventListener("click", () => {
    scale *= 1.2;
    updateImageTransform();
  });

  zoomOut.addEventListener("click", () => {
    scale /= 1.2;
    updateImageTransform();
  });

  resetZoom.addEventListener("click", resetZoomAndPosition);

  darkModeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const isDarkMode = document.documentElement.classList.contains("dark");
    localStorage.setItem("darkMode", isDarkMode);
    darkModeToggle.innerHTML = isDarkMode
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';
  });

  window.addEventListener("beforeunload", () => {
    if (worker) {
      worker.terminate();
    }
  });

  // Initial setup
  updateSlider();
});
