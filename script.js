document.addEventListener("DOMContentLoaded", () => {
  // DOM element references
  const elements = {
    imageUpload: document.getElementById("imageUpload"),
    imagePreview: document.getElementById("imagePreview"),
    resultImage: document.getElementById("resultImage"),
    reduceColorsBtn: document.getElementById("reduceColors"),
    colorCountInput: document.getElementById("colorCount"),
    downloadLink: document.getElementById("downloadLink"),
    slider: document.getElementById("slider"),
    darkModeToggle: document.getElementById("darkModeToggle"),
    imageContainer: document.getElementById("imageContainer"),
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
    resetZoom: document.getElementById("resetZoom"),
    loadingIndicator: document.getElementById("loadingIndicator"),
    paletteContainer: document.getElementById("paletteContainer"),
    sliderContainer: document.querySelector(".slider-container"),
    hueSensitivitySlider: document.getElementById("hueSensitivity"),
    sensitivityValue: document.getElementById("sensitivityValue"),
  };

  // State variables
  let worker;
  let scale = 1;
  let translateX = 0,
    translateY = 0;
  let HUE_THRESHOLD = 30;
  let lastGeneratedPalette = [];
  let isDragging = false;
  let startX, startY;

  // Initialize slider line for image comparison
  const sliderLine = document.createElement("div");
  sliderLine.className = "slider-line";
  elements.sliderContainer.appendChild(sliderLine);

  // initialize progress bar
  elements.progressBar = document.getElementById("progressBar");
  elements.progressMessage = document.getElementById("progressMessage");

  // Load dark mode preference from local storage
  initDarkMode();

  // Event listeners for user interactions
  elements.imageUpload.addEventListener("change", handleImageUpload);
  elements.reduceColorsBtn.addEventListener("click", handleReduceColors);
  elements.slider.addEventListener("input", updateSlider);
  elements.imageContainer.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  elements.zoomIn.addEventListener("click", () => zoom(1.2));
  elements.zoomOut.addEventListener("click", () => zoom(1 / 1.2));
  elements.resetZoom.addEventListener("click", resetZoomAndPosition);
  elements.darkModeToggle.addEventListener("click", toggleDarkMode);
  elements.hueSensitivitySlider.addEventListener("input", updateHueSensitivity);

  // Function to initialize dark mode based on user preference
  function initDarkMode() {
    if (localStorage.getItem("darkMode") === "false") {
      document.documentElement.classList.remove("dark");
      elements.darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      elements.darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }

  // Update the slider position and clip the result image
  function updateSlider() {
    const sliderPos = elements.slider.value / 100;
    sliderLine.style.left = `${sliderPos * 100}%`;
    elements.resultImage.style.clipPath = `inset(0 0 0 ${sliderPos * 100}%)`;
  }

  // Update the transform of both preview and result images
  function updateImageTransform() {
    const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    elements.imagePreview.style.transform = transform;
    elements.resultImage.style.transform = transform;
  }

  // Reset zoom and position of the images
  function resetZoomAndPosition() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateImageTransform();
  }

  // Handle image upload and display
  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        elements.imagePreview.src = event.target.result;
        elements.resultImage.src = event.target.result;
        elements.sliderContainer.style.display = "block";
        resetZoomAndPosition();
        elements.slider.value = 50; // Reset slider to middle
        updateSlider();
      };
      reader.readAsDataURL(file);
    }
  }

  // Update hue sensitivity and redisplay palette if available
  function updateHueSensitivity() {
    HUE_THRESHOLD = parseInt(this.value);
    elements.sensitivityValue.textContent = HUE_THRESHOLD;
    if (elements.paletteContainer.children.length > 0) {
      displayPalette(lastGeneratedPalette);
    }
  }

  // Improved hue grouping algorithm using sliding window approach
  function improvedHueGrouping(palette, threshold) {
    const hueDistance = (h1, h2) =>
      Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));

    palette.sort((a, b) => a.h - b.h);

    const groups = [];
    let currentGroup = [palette[0]];
    let groupStartHue = palette[0].h;

    for (let i = 1; i < palette.length; i++) {
      const currentHue = palette[i].h;
      const distToStart = hueDistance(currentHue, groupStartHue);
      const distToPrev = hueDistance(currentHue, palette[i - 1].h);

      if (distToStart > threshold && distToPrev > threshold / 2) {
        groups.push(currentGroup);
        currentGroup = [palette[i]];
        groupStartHue = currentHue;
      } else {
        currentGroup.push(palette[i]);
      }
    }
    groups.push(currentGroup);

    return groups;
  }

  // Display the color palette grouped by hue
  function displayPalette(palette) {
    if (!elements.paletteContainer) {
      console.error("Palette container not found in the DOM");
      return;
    }

    if (!palette || !Array.isArray(palette)) {
      console.error("Invalid palette:", palette);
      return;
    }

    elements.paletteContainer.innerHTML = "";

    const groups = improvedHueGrouping(palette, HUE_THRESHOLD);

    groups.forEach((group) => {
      const hueGroupContainer = document.createElement("div");
      hueGroupContainer.className = "hue-group";

      // Sort colors within the group from dark to light
      group.sort((a, b) => b.l - a.l);

      group.forEach((color) => {
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

      elements.paletteContainer.appendChild(hueGroupContainer);
    });
  }

  // Handle color reduction process
  function handleReduceColors() {
    if (elements.imagePreview.src.startsWith("data:image/svg+xml")) {
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

      const colorCount = parseInt(elements.colorCountInput.value);

      elements.loadingIndicator.style.display = "flex";
      updateProgress("Starting", 0);

      if (!worker) {
        worker = new Worker("color-reducer-worker.js");
      }

      worker.onmessage = function (e) {
        if (e.data.type === "progress") {
          updateProgress(e.data.stage, e.data.progress);
        } else if (e.data.type === "result") {
          const { reducedImageData, palette } = e.data;
          ctx.putImageData(reducedImageData, 0, 0);
          const reducedImageSrc = canvas.toDataURL("image/png");
          elements.resultImage.src = reducedImageSrc;
          elements.downloadLink.href = reducedImageSrc;
          elements.downloadLink.download = "reduced_palette.png";
          elements.downloadLink.style.display = "inline-block";
          elements.loadingIndicator.style.display = "none";
          updateSlider();

          if (palette) {
            lastGeneratedPalette = palette;
            displayPalette(palette);
          } else {
            console.error("Palette not received from worker");
          }
        } else if (e.data.type === "error") {
          console.error("Error in worker:", e.data.message);
          alert(
            "An error occurred while processing the image. Please try again."
          );
          elements.loadingIndicator.style.display = "none";
        }
      };

      worker.onerror = function (error) {
        console.error("Error in worker:", error);
        alert(
          "An error occurred while processing the image. Please try again."
        );
        elements.loadingIndicator.style.display = "none";
      };

      worker.postMessage({ imageData, colorCount }, [imageData.data.buffer]);
    };
    img.src = elements.imagePreview.src;
  }

  function updateProgress(stage, progress) {
    elements.progressBar.style.width = `${progress}%`;
    elements.progressMessage.textContent = `${stage}: ${progress.toFixed(2)}%`;
  }

  // Handle mouse down event for image dragging
  function handleMouseDown(e) {
    if (!e.target.closest(".slider-container")) {
      isDragging = true;
      elements.imageContainer.style.cursor = "grabbing";
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
    }
  }

  // Handle mouse move event for image dragging
  function handleMouseMove(e) {
    if (isDragging) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateImageTransform();
    }
  }

  // Handle mouse up event to stop image dragging
  function handleMouseUp() {
    isDragging = false;
    elements.imageContainer.style.cursor = "grab";
  }

  // Zoom in or out on the image
  function zoom(factor) {
    scale *= factor;
    updateImageTransform();
  }

  // Toggle dark mode and save preference
  function toggleDarkMode() {
    document.documentElement.classList.toggle("dark");
    const isDarkMode = document.documentElement.classList.contains("dark");
    localStorage.setItem("darkMode", isDarkMode);
    elements.darkModeToggle.innerHTML = isDarkMode
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';
  }

  // Cleanup worker on page unload
  window.addEventListener("beforeunload", () => {
    if (worker) {
      worker.terminate();
    }
  });

  // Initial setup
  updateSlider();
});
