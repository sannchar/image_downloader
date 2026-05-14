document.addEventListener('DOMContentLoaded', () => {
    const inputUrl = document.getElementById('imageUrlInput');
    const imagePreview = document.getElementById('imagePreview');
    const placeholderText = document.getElementById('placeholderText');
    const previewContainer = document.getElementById('previewContainer');
    const formatSelect = document.getElementById('formatSelect');
    const downloadBtn = document.getElementById('downloadBtn');
    const canvas = document.getElementById('conversionCanvas');
    const ctx = canvas.getContext('2d');

    let currentImageObj = null;
    let debounceTimer;

    inputUrl.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const url = e.target.value.trim();
        
        if (!url) {
            resetPreview();
            return;
        }

        debounceTimer = setTimeout(() => {
            loadImage(url);
        }, 500); // Wait user to finish typing/pasting
    });

    // Add paste event listener for handling direct image pasting
    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    handlePastedFile(file);
                    inputUrl.value = ''; // Clear text if any
                    e.preventDefault();
                    return;
                }
            }
        }
    });

    function handlePastedFile(file) {
        placeholderText.textContent = "Загрузка...";
        placeholderText.style.opacity = 1;
        imagePreview.classList.remove('loaded');
        downloadBtn.disabled = true;

        const url = URL.createObjectURL(file);
        const img = new Image();
        
        img.onload = () => {
            currentImageObj = img;
            imagePreview.src = img.src;
            imagePreview.style.display = 'block';
            setTimeout(() => {
                imagePreview.classList.add('loaded');
            }, 10);
            placeholderText.style.opacity = 0;
            previewContainer.classList.add('has-image');
            downloadBtn.disabled = false;
        };

        img.onerror = () => {
            placeholderText.innerHTML = "Ошибка загрузки из буфера обмена";
            resetPreview(true);
        };

        img.src = url;
    }

    async function loadImage(url) {
        // Show loading state
        placeholderText.textContent = "Загрузка...";
        placeholderText.style.opacity = 1;
        imagePreview.classList.remove('loaded');
        downloadBtn.disabled = true;

        try {
            // Using a CORS proxy to bypass canvas tainting and fetch restrictions
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
            
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            img.onload = () => {
                currentImageObj = img;
                imagePreview.src = img.src;
                imagePreview.style.display = 'block';
                // Small delay to allow CSS display change to take effect before opacity transition
                setTimeout(() => {
                    imagePreview.classList.add('loaded');
                }, 10);
                placeholderText.style.opacity = 0;
                previewContainer.classList.add('has-image');
                downloadBtn.disabled = false;
            };

            img.onerror = () => {
                placeholderText.innerHTML = "Не удалось загрузить изображение.<br><span style='font-size: 0.8rem; opacity: 0.7;'>Убедитесь, что это прямая ссылка на картинку (например, оканчивается на .jpg или .png), а не на страницу сайта.</span>";
                resetPreview(true);
            };

            img.src = proxyUrl;

        } catch (error) {
            console.error("Error loading image:", error);
            placeholderText.textContent = "Ошибка загрузки";
            resetPreview(true);
        }
    }

    function resetPreview(keepError = false) {
        currentImageObj = null;
        imagePreview.classList.remove('loaded');
        setTimeout(() => {
            if(!currentImageObj) imagePreview.style.display = 'none';
        }, 500); // Wait for transition
        imagePreview.src = '';
        previewContainer.classList.remove('has-image');
        downloadBtn.disabled = true;
        
        if (!keepError) {
            placeholderText.innerHTML = "Превью появится здесь";
            placeholderText.style.opacity = 1;
        }
    }

    downloadBtn.addEventListener('click', () => {
        if (!currentImageObj) return;

        // Draw image to canvas for conversion
        canvas.width = currentImageObj.width;
        canvas.height = currentImageObj.height;
        
        // Clear canvas before drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImageObj, 0, 0);

        const mimeType = formatSelect.value;
        const extension = mimeType.split('/')[1]; // png, jpeg, webp
        
        // Create download link using blob
        try {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert("Произошла ошибка при создании файла.");
                    return;
                }

                let ext = extension === 'jpeg' ? 'jpg' : extension;
                const timestamp = new Date().getTime();
                const defaultFilename = `image_${timestamp}.${ext}`;

                // Modern File System Access API (works beautifully even on file:/// in Chrome/Edge)
                if (window.showSaveFilePicker) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: defaultFilename,
                            types: [{
                                description: 'Image File',
                                accept: { [mimeType]: [`.${ext}`] },
                            }],
                        });
                        const writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        return; // Successfully saved
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error("SaveFilePicker error:", err);
                        } else {
                            return; // User just clicked Cancel
                        }
                    }
                }

                // Fallback for browsers that don't support showSaveFilePicker
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.setAttribute('download', defaultFilename);
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    if (document.body.contains(a)) {
                        document.body.removeChild(a);
                    }
                    URL.revokeObjectURL(url);
                }, 60000);
            }, mimeType, 0.9);
        } catch (e) {
            console.error("Error converting image:", e);
            alert("Произошла ошибка при конвертации. Возможно, изображение защищено строгим CORS.");
        }
    });
});
