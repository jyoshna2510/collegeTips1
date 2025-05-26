const gallery = document.getElementById('gallery');
const buttons = document.querySelectorAll('.filter-buttons button');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const modalCaption = document.getElementById('modal-caption');
const closeBtn = modal.querySelector('.close');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');

let allImages = []; // Stores all loaded images from JS modules
let currentIndex = 0;
let visibleImages = []; // Images currently displayed after filter/search

// For modal zoom and pan
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPan = { x: 0, y: 0 }; // Stores initial mouse position for panning

// Function to load all images from individual JS modules
async function loadAllImages() {
  try {
    const allModules = await Promise.all([
      import('./team.js'),
      import('./campaigns.js'),
      import('./fun.js'),
      import('./bts.js'),
      import('./face.js')
    ]);
    allImages = [
      ...allModules[0].teamImages,
      ...allModules[1].campaignsImages,
      ...allModules[2].funImages,
      ...allModules[3].btsImages,
      ...allModules[4].faceImages
    ];
  } catch (err) {
    console.error('Error loading all images:', err);
    allImages = [];
  }
}

// Function to apply current filter and search term to images
function applyFilterAndSearch() {
  const activeFilter = document.querySelector('.filter-buttons .active')?.getAttribute('data-filter') || 'all';
  const searchTerm = searchInput.value.toLowerCase();

  let filtered = allImages;

  // Apply category filter
  if (activeFilter !== 'all') {
    filtered = filtered.filter(img => img.category === activeFilter);
  }

  // Apply search term filter
  if (searchTerm) {
    filtered = filtered.filter(img =>
      img.alt.toLowerCase().includes(searchTerm) ||
      (img.caption && img.caption.toLowerCase().includes(searchTerm))
    );
  }
  
  // Re-index images after filtering/searching for navigation purposes
  visibleImages = filtered.map((img, index) => ({ ...img, displayIndex: index }));
  renderGallery(visibleImages);
}

// Function to render images into the gallery grid
function renderGallery(imageData) {
  gallery.innerHTML = ''; // Clear existing gallery content

  if (imageData.length === 0) {
    gallery.innerHTML = '<p style="text-align: center; color: #666; font-size: 1.2rem; padding: 50px;">No photos found matching your criteria. Try a different filter or search term.</p>';
    return;
  }

  imageData.forEach((img) => {
    const item = document.createElement('div');
    item.className = `item ${img.category}`; // Add category class for potential future styling
    item.innerHTML = `
      <div class="image-wrapper">
        <img src="${img.src}" alt="${img.alt}" data-index="${img.displayIndex}" />
        <div class="caption">${img.alt || img.caption || 'No caption'}</div>
      </div>
    `;
    gallery.appendChild(item);
  });

  // Re-attach event listeners to newly created image elements
  Array.from(document.querySelectorAll('.gallery .item img')).forEach(img => {
    img.addEventListener('click', onImageClick);
  });
}

// Handler for clicking on a gallery image thumbnail
function onImageClick(e) {
  const clickedImg = e.target;
  const index = parseInt(clickedImg.getAttribute('data-index'));
  if (!isNaN(index) && index < visibleImages.length) {
    openModal(index);
  }
}

// Function to open the fullscreen modal
function openModal(index) {
  const imgData = visibleImages[index];
  if (!imgData) return;

  currentIndex = index;
  modalImg.src = imgData.src;
  modalImg.alt = imgData.alt;
  modalCaption.textContent = imgData.alt || imgData.caption || 'No caption provided.';
  modal.style.display = 'flex'; // Show the modal

  // Reset zoom and pan for the new image in modal
  currentZoom = 1;
  panX = 0;
  panY = 0;
  applyModalTransform(); // Apply initial transform
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Function to close the fullscreen modal
function closeModal() {
  modal.style.display = 'none'; // Hide the modal
  // Reset zoom/pan states when modal closes
  currentZoom = 1;
  panX = 0;
  panY = 0;
  modalImg.style.transform = `scale(1) translate(0px, 0px)`; // Reset image transform
  isPanning = false; // Ensure panning state is reset
  modalImg.classList.remove('panning'); // Remove panning cursor class
  document.body.style.overflow = 'auto'; // Re-enable background scrolling
}

// Function to show the next image in fullscreen
function showNextImage() {
  if (visibleImages.length === 0) return;
  currentIndex = (currentIndex + 1) % visibleImages.length; // Loop back to start
  openModal(currentIndex); // Use openModal to load new image and reset zoom/pan
}

// Function to show the previous image in fullscreen
function showPrevImage() {
  if (visibleImages.length === 0) return;
  currentIndex = (currentIndex - 1 + visibleImages.length) % visibleImages.length; // Loop to end if at start
  openModal(currentIndex); // Use openModal to load new image and reset zoom/pan
}

// --- Zoom & Pan Functions for Modal Image ---
// Applies the current zoom and pan values to the modal image's transform
function applyModalTransform() {
  modalImg.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
}

// Handles zooming in or out on the modal image
function handleZoom(direction) {
  const zoomFactor = 0.2;
  const maxZoom = 3; // Maximum zoom level
  const minZoom = 1; // Minimum zoom level (original size)

  if (direction === 'in') {
    currentZoom = Math.min(currentZoom + zoomFactor, maxZoom);
  } else {
    currentZoom = Math.max(currentZoom - zoomFactor, minZoom);
  }

  // If zoomed out to original size, reset pan position
  if (currentZoom === minZoom) {
    panX = 0;
    panY = 0;
  }
  applyModalTransform(); // Apply the new zoom and pan
}

// Handles mouse down event for initiating pan
function handleMouseDown(e) {
  if (currentZoom > 1) { // Only allow panning if image is zoomed in
    isPanning = true;
    modalImg.classList.add('panning'); // Change cursor to grabbing
    startPan = {
      x: e.clientX - panX,
      y: e.clientY - panY
    };
    e.preventDefault(); // Prevent default browser drag behavior (e.g., dragging image itself)
  }
}

// Handles mouse move event for active panning
function handleMouseMove(e) {
  if (!isPanning) return;

  const newPanX = e.clientX - startPan.x;
  const newPanY = e.clientY - startPan.y;

  // Calculate boundaries to prevent panning the image completely off-screen
  // We need to consider the image's zoomed size relative to its container
  const imgWidth = modalImg.clientWidth * currentZoom;
  const imgHeight = modalImg.clientHeight * currentZoom;
  const containerWidth = modalImg.parentElement.clientWidth;
  const containerHeight = modalImg.parentElement.clientHeight;

  // Max pan distance from center, adjusted for current zoom
  const maxPanX = Math.max(0, (imgWidth - containerWidth) / 2);
  const maxPanY = Math.max(0, (imgHeight - containerHeight) / 2);

  // Clamp pan values within boundaries
  panX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
  panY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));

  applyModalTransform(); // Apply the new pan position
}

// Handles mouse up event for stopping pan
function handleMouseUp() {
  isPanning = false;
  modalImg.classList.remove('panning'); // Reset cursor
}


// --- Event Listeners ---

// Filter buttons
buttons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove 'active' class from previously active button
    document.querySelector('.filter-buttons .active')?.classList.remove('active');
    // Add 'active' class to the clicked button
    button.classList.add('active');
    applyFilterAndSearch(); // Re-filter and render gallery
  });
});

// Search input
searchInput.addEventListener('input', applyFilterAndSearch); // Trigger filter on every input change

// Modal controls
closeBtn.addEventListener('click', closeModal);
nextBtn.addEventListener('click', showNextImage);
prevBtn.addEventListener('click', showPrevImage);

// Zoom controls
zoomInBtn.addEventListener('click', () => handleZoom('in'));
zoomOutBtn.addEventListener('click', () => handleZoom('out'));

// Pan controls for modal image
modalImg.addEventListener('mousedown', handleMouseDown);
// Use modal itself for mousemove/mouseup to ensure events are captured even if mouse leaves image
modal.addEventListener('mousemove', handleMouseMove);
modal.addEventListener('mouseup', handleMouseUp);
modal.addEventListener('mouseleave', handleMouseUp); // Stop panning if mouse leaves modal area

// Close modal when clicking outside the content (on the overlay)
modal.addEventListener('click', e => {
  if (e.target === modal) {
    closeModal();
  }
});

// Initial load: Load all images and then render the gallery
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllImages(); // Load all images once at the start
  applyFilterAndSearch(); // Render initial gallery (all images)
});