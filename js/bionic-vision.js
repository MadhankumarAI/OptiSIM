/* ============================================
   Bionic Vision Processing Engine
   Real-time camera → edge detection → contrast
   enhancement → object detection → neural encoding
   ============================================ */

class BionicVision {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.canvasRaw = document.getElementById('canvas-raw');
        this.canvasEdge = document.getElementById('canvas-edge');
        this.canvasEnhance = document.getElementById('canvas-enhance');
        this.canvasObjects = document.getElementById('canvas-objects');
        this.canvasNeural = document.getElementById('canvas-neural');

        this.ctxRaw = this.canvasRaw.getContext('2d');
        this.ctxEdge = this.canvasEdge.getContext('2d');
        this.ctxEnhance = this.canvasEnhance.getContext('2d');
        this.ctxObjects = this.canvasObjects.getContext('2d');
        this.ctxNeural = this.canvasNeural.getContext('2d');

        this.width = 320;
        this.height = 240;
        this.running = false;
        this.processing = true;
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.fps = 0;

        this.modes = ['edge', 'thermal', 'highcontrast', 'nightvision'];
        this.currentMode = 0;

        // Object detection simulation (simple color/motion based)
        this.prevFrame = null;
        this.detectedObjects = [];

        this.initCanvases();
    }

    initCanvases() {
        [this.canvasRaw, this.canvasEdge, this.canvasEnhance, this.canvasObjects, this.canvasNeural].forEach(c => {
            c.width = this.width;
            c.height = this.height;
        });
    }

    async startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            this.video.srcObject = stream;
            await this.video.play();

            this.width = Math.min(this.video.videoWidth || 320, 320);
            this.height = Math.min(this.video.videoHeight || 240, 240);
            this.initCanvases();

            const resEl = document.getElementById('stat-resolution');
            if (resEl) resEl.textContent = `${this.video.videoWidth || 640}×${this.video.videoHeight || 480}`;

            this.running = true;
            const btn = document.getElementById('btn-toggle-processing');
            if (btn) btn.disabled = false;
            const status = document.getElementById('processing-status');
            if (status) status.style.display = 'flex';

            if (typeof bionicEye3D !== 'undefined' && bionicEye3D) {
                bionicEye3D.setVideoSource(this.video);
            }

            this.processLoop();
            return true;
        } catch (e) {
            console.warn('Camera unavailable, starting demo mode. (Tip: use HTTPS for camera access)');
            this.startDemoMode();
            return false;
        }
    }

    startDemoMode() {
        this.running = true;
        this.demoMode = true;
        const btn = document.getElementById('btn-toggle-processing');
        if (btn) btn.disabled = false;
        const status = document.getElementById('processing-status');
        if (status) status.style.display = 'flex';
        this.processLoop();
    }

    processLoop() {
        if (!this.running) return;

        const now = performance.now();

        // FPS counter
        this.frameCount++;
        if (now - this.lastFpsTime > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
            const fpsEl = document.getElementById('fps-counter');
            if (fpsEl) fpsEl.textContent = this.fps;
            const latEl = document.getElementById('stat-latency');
            if (latEl) latEl.textContent = `${Math.round(1000 / Math.max(this.fps, 1))}ms`;
        }

        // Get raw frame
        const rawData = this.captureFrame();
        if (!rawData) {
            requestAnimationFrame(() => this.processLoop());
            return;
        }

        if (this.processing) {
            // Stage 2: Edge detection
            const edgeData = this.edgeDetection(rawData);
            this.ctxEdge.putImageData(edgeData, 0, 0);

            // Stage 3: Enhancement
            const enhancedData = this.enhance(rawData);
            this.ctxEnhance.putImageData(enhancedData, 0, 0);

            // Stage 4: Object detection
            this.detectObjects(rawData);
            this.drawObjectDetection(rawData);

            // Stage 5: Neural encoding
            this.drawNeuralEncoding(edgeData);

            // Animate pipeline stages
            this.animateStages();
        }

        // Update mode display
        const modeEl = document.getElementById('stat-mode');
        if (modeEl) modeEl.textContent =
            this.modes[this.currentMode].charAt(0).toUpperCase() + this.modes[this.currentMode].slice(1);

        requestAnimationFrame(() => this.processLoop());
    }

    captureFrame() {
        if (this.demoMode) {
            return this.generateDemoFrame();
        }

        if (this.video.readyState < 2) return null;

        this.ctxRaw.drawImage(this.video, 0, 0, this.width, this.height);
        return this.ctxRaw.getImageData(0, 0, this.width, this.height);
    }

    generateDemoFrame() {
        const t = performance.now() / 1000;
        const ctx = this.ctxRaw;
        const w = this.width;
        const h = this.height;

        // Simulated "room" scene
        // Floor
        const floorGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
        floorGrad.addColorStop(0, '#4a4a5a');
        floorGrad.addColorStop(1, '#2a2a35');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);

        // Wall
        const wallGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        wallGrad.addColorStop(0, '#6a7a8a');
        wallGrad.addColorStop(1, '#5a6a7a');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, 0, w, h * 0.5);

        // Ceiling light
        ctx.fillStyle = '#fff8e0';
        ctx.beginPath();
        ctx.ellipse(w / 2, 10, 40, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Moving person silhouette
        const px = w * 0.3 + Math.sin(t * 0.4) * 60;
        const py = h * 0.2;
        ctx.fillStyle = '#3a3a4a';
        // Head
        ctx.beginPath();
        ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillRect(px - 14, py + 18, 28, 55);
        // Legs
        ctx.fillRect(px - 12, py + 73, 10, 40);
        ctx.fillRect(px + 2, py + 73, 10, 40);

        // Table/object
        ctx.fillStyle = '#8a6a4a';
        ctx.fillRect(w * 0.6, h * 0.45, 80, 10);
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(w * 0.63, h * 0.55, 8, 40);
        ctx.fillRect(w * 0.73, h * 0.55, 8, 40);

        // Cup on table
        ctx.fillStyle = '#dd4444';
        ctx.fillRect(w * 0.66, h * 0.38, 16, 18);

        // Door
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(w * 0.85, h * 0.1, 35, h * 0.45);
        ctx.fillStyle = '#daa520';
        ctx.beginPath();
        ctx.arc(w * 0.88, h * 0.33, 3, 0, Math.PI * 2);
        ctx.fill();

        // Window with light
        const windowGlow = 0.7 + Math.sin(t * 0.8) * 0.15;
        ctx.fillStyle = `rgba(180, 220, 255, ${windowGlow})`;
        ctx.fillRect(w * 0.08, h * 0.08, 50, 40);
        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.08, h * 0.08, 50, 40);
        ctx.beginPath();
        ctx.moveTo(w * 0.08 + 25, h * 0.08);
        ctx.lineTo(w * 0.08 + 25, h * 0.08 + 40);
        ctx.moveTo(w * 0.08, h * 0.08 + 20);
        ctx.lineTo(w * 0.08 + 50, h * 0.08 + 20);
        ctx.stroke();

        // Cat on floor (moving)
        const catX = w * 0.45 + Math.sin(t * 0.3) * 30;
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.ellipse(catX, h * 0.82, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(catX - 10, h * 0.82 - 8);
        ctx.lineTo(catX - 6, h * 0.82 - 18);
        ctx.lineTo(catX - 2, h * 0.82 - 8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(catX + 2, h * 0.82 - 8);
        ctx.lineTo(catX + 6, h * 0.82 - 18);
        ctx.lineTo(catX + 10, h * 0.82 - 8);
        ctx.fill();
        // Tail
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(catX + 15, h * 0.82);
        ctx.quadraticCurveTo(catX + 30, h * 0.82 - 15 + Math.sin(t * 2) * 8, catX + 35, h * 0.82 - 5);
        ctx.stroke();

        return ctx.getImageData(0, 0, w, h);
    }

    /* ---- Stage 2: Sobel Edge Detection ---- */
    edgeDetection(imageData) {
        const src = imageData.data;
        const w = this.width;
        const h = this.height;
        const output = this.ctxEdge.createImageData(w, h);
        const dst = output.data;

        // Convert to grayscale first
        const gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            const idx = i * 4;
            gray[i] = src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
        }

        // Sobel kernels
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;

                // Gx
                const gx = -gray[(y-1)*w+(x-1)] + gray[(y-1)*w+(x+1)]
                          -2*gray[y*w+(x-1)]     + 2*gray[y*w+(x+1)]
                          -gray[(y+1)*w+(x-1)]   + gray[(y+1)*w+(x+1)];

                // Gy
                const gy = -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)]
                          +gray[(y+1)*w+(x-1)]  + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];

                let mag = Math.sqrt(gx * gx + gy * gy);
                mag = Math.min(255, mag * 1.5);

                const oi = idx * 4;
                const mode = this.modes[this.currentMode];

                if (mode === 'edge') {
                    // Cyan edges on dark background
                    dst[oi] = 0;
                    dst[oi + 1] = mag * 0.9;
                    dst[oi + 2] = mag;
                    dst[oi + 3] = 255;
                } else if (mode === 'thermal') {
                    // Thermal colormap
                    dst[oi] = Math.min(255, mag * 2);
                    dst[oi + 1] = Math.min(255, mag * 0.8);
                    dst[oi + 2] = Math.max(0, 128 - mag);
                    dst[oi + 3] = 255;
                } else if (mode === 'nightvision') {
                    // Green night vision
                    dst[oi] = mag * 0.1;
                    dst[oi + 1] = mag;
                    dst[oi + 2] = mag * 0.2;
                    dst[oi + 3] = 255;
                } else {
                    // High contrast white
                    dst[oi] = mag;
                    dst[oi + 1] = mag;
                    dst[oi + 2] = mag;
                    dst[oi + 3] = 255;
                }
            }
        }

        return output;
    }

    /* ---- Stage 3: Contrast Enhancement ---- */
    enhance(imageData) {
        const src = imageData.data;
        const w = this.width;
        const h = this.height;
        const output = this.ctxEnhance.createImageData(w, h);
        const dst = output.data;

        // Find min/max for histogram stretch
        let minVal = 255, maxVal = 0;
        for (let i = 0; i < src.length; i += 4) {
            const lum = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
            if (lum < minVal) minVal = lum;
            if (lum > maxVal) maxVal = lum;
        }

        const range = Math.max(maxVal - minVal, 1);
        const contrast = 1.8;
        const brightness = 10;

        for (let i = 0; i < src.length; i += 4) {
            // Histogram stretching + contrast boost
            for (let c = 0; c < 3; c++) {
                let val = src[i + c];
                // Stretch
                val = ((val - minVal) / range) * 255;
                // Contrast
                val = ((val - 128) * contrast) + 128 + brightness;
                // Sharpen (unsharp mask approximation)
                dst[i + c] = Math.max(0, Math.min(255, val));
            }
            dst[i + 3] = 255;
        }

        return output;
    }

    /* ---- Stage 4: Simple Object Detection ---- */
    detectObjects(imageData) {
        const src = imageData.data;
        const w = this.width;
        const h = this.height;
        this.detectedObjects = [];

        // Simple blob detection using brightness thresholding
        const gridSize = 40;
        for (let gy = 0; gy < h; gy += gridSize) {
            for (let gx = 0; gx < w; gx += gridSize) {
                let brightPixels = 0;
                let totalLum = 0;
                let avgR = 0, avgG = 0, avgB = 0;
                let count = 0;

                for (let dy = 0; dy < gridSize && gy + dy < h; dy++) {
                    for (let dx = 0; dx < gridSize && gx + dx < w; dx++) {
                        const i = ((gy + dy) * w + (gx + dx)) * 4;
                        const lum = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
                        totalLum += lum;
                        avgR += src[i]; avgG += src[i + 1]; avgB += src[i + 2];
                        count++;
                        if (lum > 150) brightPixels++;
                    }
                }

                const avgLum = totalLum / count;
                avgR /= count; avgG /= count; avgB /= count;

                // Classify based on color
                let label = null;
                if (avgLum > 180) label = 'Bright Surface';
                else if (avgR > avgG * 1.5 && avgR > avgB * 1.5 && avgLum > 60) label = 'Warm Object';
                else if (avgG > avgR * 1.3 && avgG > avgB * 1.2 && avgLum > 40) label = 'Vegetation';
                else if (avgB > avgR * 1.3 && avgB > avgG * 1.1 && avgLum > 40) label = 'Cool Surface';
                else if (brightPixels > count * 0.6) label = 'Light Source';
                else if (avgLum > 100 && Math.abs(avgR - avgG) < 30 && Math.abs(avgG - avgB) < 30) label = 'Neutral Surface';

                if (label && avgLum > 50) {
                    this.detectedObjects.push({
                        x: gx, y: gy,
                        w: Math.min(gridSize, w - gx),
                        h: Math.min(gridSize, h - gy),
                        label,
                        confidence: Math.min(0.99, 0.5 + (brightPixels / count) * 0.5),
                    });
                }
            }
        }

        const objEl = document.getElementById('stat-objects');
        if (objEl) objEl.textContent = this.detectedObjects.length;
    }

    drawObjectDetection(imageData) {
        // Draw the enhanced image as base
        this.ctxObjects.putImageData(imageData, 0, 0);

        // Overlay detection boxes
        this.ctxObjects.strokeStyle = '#00e5ff';
        this.ctxObjects.lineWidth = 1.5;
        this.ctxObjects.font = '9px Inter, sans-serif';

        this.detectedObjects.forEach(obj => {
            // Box
            this.ctxObjects.strokeRect(obj.x, obj.y, obj.w, obj.h);

            // Label background
            const textW = this.ctxObjects.measureText(obj.label).width + 8;
            this.ctxObjects.fillStyle = 'rgba(0, 229, 255, 0.7)';
            this.ctxObjects.fillRect(obj.x, obj.y - 12, textW, 12);

            // Label text
            this.ctxObjects.fillStyle = '#000';
            this.ctxObjects.fillText(obj.label, obj.x + 4, obj.y - 3);

            // Confidence
            this.ctxObjects.fillStyle = 'rgba(0, 229, 255, 0.5)';
            this.ctxObjects.fillText(
                `${Math.round(obj.confidence * 100)}%`,
                obj.x + obj.w - 25, obj.y + obj.h - 3
            );
        });
    }

    /* ---- Stage 5: Neural Encoding (Phosphene Grid) ---- */
    drawNeuralEncoding(edgeData) {
        const gridW = 60;
        const gridH = 45;
        const cellW = this.width / gridW;
        const cellH = this.height / gridH;
        const src = edgeData.data;
        const ctx = this.ctxNeural;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.width, this.height);

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                // Sample edge intensity at this grid point
                const sx = Math.floor(gx * cellW + cellW / 2);
                const sy = Math.floor(gy * cellH + cellH / 2);
                const si = (sy * this.width + sx) * 4;

                // Use green channel (edge intensity)
                const intensity = (src[si] + src[si + 1] + src[si + 2]) / 3;
                const normalized = intensity / 255;

                if (normalized > 0.05) {
                    // Draw phosphene dot
                    const radius = 1 + normalized * 2.5;
                    const alpha = 0.2 + normalized * 0.8;

                    // Outer glow
                    ctx.beginPath();
                    ctx.arc(gx * cellW + cellW / 2, gy * cellH + cellH / 2, radius * 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 229, 255, ${alpha * 0.15})`;
                    ctx.fill();

                    // Core phosphene
                    ctx.beginPath();
                    ctx.arc(gx * cellW + cellW / 2, gy * cellH + cellH / 2, radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(200, 240, 255, ${alpha})`;
                    ctx.fill();
                }
            }
        }

        // Scanning line effect
        const scanY = (performance.now() / 10) % this.height;
        ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
        ctx.fillRect(0, scanY, this.width, 3);
    }

    animateStages() {
        const stages = ['pv-raw', 'pv-edge', 'pv-enhance', 'pv-objects', 'pv-neural'];
        const arrows = document.querySelectorAll('.pv-arrow');

        const activeIdx = Math.floor((performance.now() / 500) % stages.length);
        stages.forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('active', i <= activeIdx);
        });
        arrows.forEach((arrow, i) => {
            arrow.classList.toggle('active', i < activeIdx);
        });
    }

    cycleMode() {
        this.currentMode = (this.currentMode + 1) % this.modes.length;
    }

    toggleProcessing() {
        this.processing = !this.processing;
    }

    stop() {
        this.running = false;
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(t => t.stop());
        }
    }
}

/* ---- Bionic Eye 3D Schematic (simple Three.js) ---- */
class BionicSchematic {
    constructor(container) {
        this.container = document.getElementById(container);
        if (!this.container) return;

        // Use canvas 2D for schematic instead of Three.js (no dependency)
        this.canvas = document.createElement('canvas');
        this.canvas.width = 600;
        this.canvas.height = 400;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.activeComponent = 'camera';
        this.animate();
        this.bindComponents();
    }

    bindComponents() {
        document.querySelectorAll('.component-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.component-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.activeComponent = card.dataset.component;
            });
        });
    }

    animate() {
        const t = performance.now() / 1000;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#030810';
        ctx.fillRect(0, 0, w, h);

        // Draw the bionic eye system schematic
        const cx = w / 2 - 40;
        const cy = h / 2;

        // ---- Spectacle frame (left side) ----
        ctx.strokeStyle = '#2a4a6a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, cy - 30);
        ctx.quadraticCurveTo(120, cy - 60, 180, cy - 30);
        ctx.quadraticCurveTo(200, cy, 180, cy + 30);
        ctx.quadraticCurveTo(120, cy + 60, 40, cy + 30);
        ctx.stroke();

        // Camera module (in spectacle)
        const camHighlight = this.activeComponent === 'camera';
        ctx.fillStyle = camHighlight ? '#00e5ff' : '#1a3a5a';
        ctx.strokeStyle = camHighlight ? '#00e5ff' : '#2a5a7a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(110, cy - 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Lens
        ctx.fillStyle = '#0a1a2a';
        ctx.beginPath();
        ctx.arc(110, cy - 15, 8, 0, Math.PI * 2);
        ctx.fill();
        // Label
        if (camHighlight) {
            ctx.fillStyle = '#00e5ff';
            ctx.font = '10px Inter';
            ctx.fillText('CAMERA', 90, cy - 38);
        }

        // ---- Processor (behind ear) ----
        const procHighlight = this.activeComponent === 'processor';
        ctx.fillStyle = procHighlight ? 'rgba(0,229,255,0.3)' : 'rgba(26,58,90,0.5)';
        ctx.strokeStyle = procHighlight ? '#00e5ff' : '#2a5a7a';
        ctx.lineWidth = 2;
        this.roundRect(ctx, 20, cy - 15, 50, 30, 6);
        ctx.fill();
        ctx.stroke();
        // Chip lines
        ctx.strokeStyle = procHighlight ? '#00e5ff' : '#3a6a8a';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(30, cy - 8 + i * 8);
            ctx.lineTo(60, cy - 8 + i * 8);
            ctx.stroke();
        }
        if (procHighlight) {
            ctx.fillStyle = '#00e5ff';
            ctx.font = '10px Inter';
            ctx.fillText('NPU', 30, cy - 22);
        }

        // ---- Wireless signal (from spectacle to eye) ----
        const txHighlight = this.activeComponent === 'transmitter';
        ctx.strokeStyle = txHighlight ? '#00e5ff' : 'rgba(0,229,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        for (let r = 0; r < 3; r++) {
            const phase = (t * 2 + r * 0.5) % 3;
            const alpha = Math.max(0, 1 - phase / 3);
            ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * (txHighlight ? 0.8 : 0.3)})`;
            ctx.beginPath();
            ctx.arc(200, cy, 15 + phase * 20, -0.8, 0.8);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // ---- Eye cross-section ----
        // Sclera
        ctx.fillStyle = '#e8ddd5';
        ctx.strokeStyle = '#aa9988';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(320, cy, 80, 70, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Choroid
        ctx.fillStyle = '#7a2a1a';
        ctx.beginPath();
        ctx.ellipse(320, cy, 72, 62, 0, 0, Math.PI * 2);
        ctx.fill();

        // Retina
        ctx.fillStyle = '#cc5544';
        ctx.beginPath();
        ctx.ellipse(320, cy, 65, 55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vitreous
        ctx.fillStyle = 'rgba(200, 230, 245, 0.3)';
        ctx.beginPath();
        ctx.ellipse(320, cy, 58, 48, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris
        ctx.fillStyle = '#3d8a65';
        ctx.beginPath();
        ctx.ellipse(380, cy, 20, 35, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(383, cy, 10, 18, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Cornea
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(395, cy, 12, 35, 0.2, -1.2, 1.2);
        ctx.stroke();

        // Lens
        ctx.fillStyle = 'rgba(220, 200, 150, 0.5)';
        ctx.beginPath();
        ctx.ellipse(370, cy, 12, 25, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // ---- Electrode Array (on retina) ----
        const elecHighlight = this.activeComponent === 'electrode';
        const elecColor = elecHighlight ? '#00e5ff' : '#4488aa';
        ctx.fillStyle = elecColor;
        const gridCx = 280;
        const gridCy = cy;
        for (let gy = -3; gy <= 3; gy++) {
            for (let gx = -3; gx <= 3; gx++) {
                const px = gridCx + gx * 6;
                const py = gridCy + gy * 6;
                const pulse = Math.sin(t * 4 + gx + gy) * 0.5 + 0.5;
                ctx.globalAlpha = 0.3 + pulse * 0.7;
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        if (elecHighlight) {
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(gridCx - 24, gridCy - 24, 48, 48);
            ctx.setLineDash([]);
            ctx.fillStyle = '#00e5ff';
            ctx.font = '10px Inter';
            ctx.fillText('60×60 ARRAY', gridCx - 25, gridCy - 30);
        }

        // ---- Optic Nerve ----
        ctx.strokeStyle = '#daa520';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(240, cy);
        ctx.quadraticCurveTo(200, cy - 10, 180, cy + 20);
        ctx.stroke();

        // ---- Brain (right side) ----
        ctx.fillStyle = '#cc8888';
        ctx.strokeStyle = '#aa6666';
        ctx.lineWidth = 2;
        // Simple brain silhouette
        ctx.beginPath();
        ctx.moveTo(480, cy - 60);
        ctx.bezierCurveTo(520, cy - 80, 570, cy - 60, 570, cy - 20);
        ctx.bezierCurveTo(580, cy + 10, 560, cy + 40, 530, cy + 50);
        ctx.bezierCurveTo(500, cy + 60, 460, cy + 50, 450, cy + 20);
        ctx.bezierCurveTo(440, cy - 10, 450, cy - 50, 480, cy - 60);
        ctx.fill();
        ctx.stroke();

        // Brain folds
        ctx.strokeStyle = '#aa6666';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const bx = 470 + i * 18;
            ctx.moveTo(bx, cy - 45 + i * 5);
            ctx.quadraticCurveTo(bx + 10, cy - 20, bx - 5, cy + 10 + i * 5);
            ctx.stroke();
        }

        // Visual cortex highlight
        ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(540, cy + 20, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00e5ff';
        ctx.font = '9px Inter';
        ctx.fillText('V1', 535, cy + 24);

        // ---- Signal flow arrows ----
        // Nerve to brain
        ctx.strokeStyle = `rgba(0, 229, 255, ${0.3 + Math.sin(t * 3) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(180, cy + 20);
        ctx.lineTo(140, cy + 30);
        ctx.lineTo(450, cy + 20);
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveling pulse dots on the nerve
        for (let p = 0; p < 4; p++) {
            const progress = ((t * 0.8 + p * 0.25) % 1);
            const px = 180 + (450 - 180) * progress;
            const py = cy + 20 + Math.sin(progress * Math.PI) * 10;
            ctx.fillStyle = `rgba(0, 229, 255, ${1 - progress})`;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // ---- Power module ----
        const pwrHighlight = this.activeComponent === 'power';
        ctx.fillStyle = pwrHighlight ? 'rgba(118, 255, 3, 0.3)' : 'rgba(50, 80, 50, 0.3)';
        ctx.strokeStyle = pwrHighlight ? '#76ff03' : '#4a6a4a';
        ctx.lineWidth = 1.5;
        this.roundRect(ctx, 15, cy + 35, 40, 18, 4);
        ctx.fill();
        ctx.stroke();
        // Battery level
        ctx.fillStyle = pwrHighlight ? '#76ff03' : '#4a8a4a';
        this.roundRect(ctx, 18, cy + 38, 30, 12, 2);
        ctx.fill();
        if (pwrHighlight) {
            ctx.fillStyle = '#76ff03';
            ctx.font = '9px Inter';
            ctx.fillText('BATTERY', 13, cy + 65);
        }

        requestAnimationFrame(() => this.animate());
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

/* ---- Perception Simulator ---- */
class PerceptionSimulator {
    constructor(bionicVision) {
        this.bv = bionicVision;
        this.percPhosphene = document.getElementById('perc-phosphene');
        this.percEnhanced = document.getElementById('perc-enhanced');
        this.percAI = document.getElementById('perc-ai');

        if (this.percPhosphene) {
            this.percPhosphene.width = 320;
            this.percPhosphene.height = 180;
            this.percEnhanced.width = 320;
            this.percEnhanced.height = 180;
            this.percAI.width = 320;
            this.percAI.height = 180;
        }

        this.animate();
    }

    animate() {
        if (!this.bv.running) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        const src = this.bv.ctxRaw.getImageData(0, 0, this.bv.width, this.bv.height);
        this.drawPhosphene(src, this.percPhosphene, 8);   // 8x8 grid = ~64 phosphenes
        this.drawPhosphene(src, this.percEnhanced, 60);    // 60x60 = 3600
        this.drawAIPerception(src, this.percAI);

        requestAnimationFrame(() => this.animate());
    }

    drawPhosphene(srcData, canvas, gridSize) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const src = srcData.data;
        const sw = this.bv.width;
        const sh = this.bv.height;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        const cellW = w / gridSize;
        const cellH = h / (gridSize * (sh / sw));
        const gridH = Math.floor(gridSize * (sh / sw));

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridSize; gx++) {
                // Sample source
                const sx = Math.floor((gx / gridSize) * sw);
                const sy = Math.floor((gy / gridH) * sh);
                const si = (sy * sw + sx) * 4;
                const lum = (src[si] * 0.299 + src[si + 1] * 0.587 + src[si + 2] * 0.114) / 255;

                if (lum > 0.1) {
                    const radius = Math.max(0.5, (cellW / 2) * lum * 0.9);
                    const px = gx * cellW + cellW / 2;
                    const py = gy * cellH + cellH / 2;

                    // Glow
                    ctx.fillStyle = `rgba(200, 240, 255, ${lum * 0.15})`;
                    ctx.beginPath();
                    ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
                    ctx.fill();

                    // Core
                    ctx.fillStyle = `rgba(220, 245, 255, ${0.3 + lum * 0.7})`;
                    ctx.beginPath();
                    ctx.arc(px, py, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    drawAIPerception(srcData, canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Draw enhanced phosphene base (60 grid)
        this.drawPhosphene(srcData, canvas, 60);

        // Overlay AI labels
        ctx.font = 'bold 11px Inter, sans-serif';
        this.bv.detectedObjects.forEach(obj => {
            const sx = (obj.x / this.bv.width) * w;
            const sy = (obj.y / this.bv.height) * h;
            const sw = (obj.w / this.bv.width) * w;
            const sh = (obj.h / this.bv.height) * h;

            // Highlight region
            ctx.strokeStyle = 'rgba(118, 255, 3, 0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, sw, sh);

            // Label
            ctx.fillStyle = 'rgba(118, 255, 3, 0.8)';
            ctx.fillText(obj.label, sx + 2, sy - 3);
        });
    }
}

/* ============================================
   Neural Impulse Graphs
   ============================================ */
class NeuralGraphs {
    constructor(vision) {
        this.vision = vision;
        this.graphCanvas = null;
        this.graphCtx = null;

        // Rolling data buffers
        this.firingRateHistory = new Array(120).fill(0);
        this.signalStrengthHistory = new Array(120).fill(0);
        this.electrodeActivityHistory = new Array(120).fill(0);

        // Use canvas already in the DOM
        this.graphCanvas = document.getElementById('graph-canvas');
        if (this.graphCanvas) {
            this.graphCanvas.width = this.graphCanvas.clientWidth || 300;
            this.graphCanvas.height = this.graphCanvas.clientHeight || 120;
            this.graphCtx = this.graphCanvas.getContext('2d');
        }
        this.animate();
    }

    update() {
        if (!this.vision.running || !this.vision.processing) return;

        // Calculate metrics from the current frame
        const edgeCanvas = this.vision.canvasEdge;
        const edgeCtx = this.vision.ctxEdge;
        const w = this.vision.width;
        const h = this.vision.height;

        let edgeData;
        try { edgeData = edgeCtx.getImageData(0, 0, w, h).data; } catch(e) { return; }

        // Firing rate = proportion of active edge pixels
        let activePixels = 0;
        let totalIntensity = 0;
        for (let i = 0; i < edgeData.length; i += 4) {
            const val = (edgeData[i] + edgeData[i+1] + edgeData[i+2]) / 3;
            if (val > 30) activePixels++;
            totalIntensity += val;
        }

        const totalPixels = (w * h);
        const firingRate = (activePixels / totalPixels) * 200; // Scale to Hz
        const signalStrength = (totalIntensity / (totalPixels * 255)) * 120; // Scale to mV
        const electrodeActivity = (activePixels / totalPixels) * 100; // Percentage

        // Push to history
        this.firingRateHistory.push(firingRate);
        this.firingRateHistory.shift();
        this.signalStrengthHistory.push(signalStrength);
        this.signalStrengthHistory.shift();
        this.electrodeActivityHistory.push(electrodeActivity);
        this.electrodeActivityHistory.shift();
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    draw() {
        const ctx = this.graphCtx;
        if (!ctx) return;
        const w = this.graphCanvas.width;
        const h = this.graphCanvas.height;

        // Background
        ctx.fillStyle = '#020408';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
        ctx.lineWidth = 0.5;
        for (let y = 0; y < h; y += 25) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        for (let x = 0; x < w; x += 20) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }

        // Draw each graph line
        this.drawLine(ctx, this.firingRateHistory, w, h, '#00e5ff', 200);
        this.drawLine(ctx, this.signalStrengthHistory, w, h, '#76ff03', 120);
        this.drawLine(ctx, this.electrodeActivityHistory, w, h, '#ff6e40', 100);

        // Current values text
        const fr = this.firingRateHistory[this.firingRateHistory.length - 1];
        const ss = this.signalStrengthHistory[this.signalStrengthHistory.length - 1];
        const ea = this.electrodeActivityHistory[this.electrodeActivityHistory.length - 1];

        ctx.font = 'bold 11px Inter, monospace';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`${fr.toFixed(0)} Hz`, 5, 14);
        ctx.fillStyle = '#76ff03';
        ctx.fillText(`${ss.toFixed(1)} mV`, 5, 28);
        ctx.fillStyle = '#ff6e40';
        ctx.fillText(`${ea.toFixed(0)}%`, 5, 42);
    }

    drawLine(ctx, data, w, h, color, maxVal) {
        const points = data.length;
        const stepX = w / points;

        // Glow
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
            const x = i * stepX;
            const y = h - (data[i] / maxVal) * (h * 0.85) - 10;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill under
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = color.replace(')', ', 0.05)').replace('rgb', 'rgba').replace('#', '');
        // Use hex to rgba
        const r = parseInt(color.slice(1,3), 16);
        const g = parseInt(color.slice(3,5), 16);
        const b = parseInt(color.slice(5,7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
        ctx.fill();
    }
}

/* ============================================
   Click-to-Expand Pipeline Stages
   ============================================ */
class StageExpander {
    constructor() {
        this.overlay = null;
        this.expanded = false;
        this.createOverlay();
        this.bindStages();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'stage-expand-overlay';
        this.overlay.style.cssText = `
            position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.92);
            display:none;align-items:center;justify-content:center;flex-direction:column;
            cursor:pointer;backdrop-filter:blur(10px);
        `;
        this.overlay.innerHTML = `
            <div id="expand-header" style="color:#00e5ff;font-size:1.1rem;font-weight:600;margin-bottom:12px;font-family:Inter,sans-serif;"></div>
            <canvas id="expand-canvas" style="max-width:90vw;max-height:75vh;border:1px solid rgba(0,229,255,0.3);border-radius:8px;background:#000;"></canvas>
            <div id="expand-info" style="color:#6a7a8c;font-size:0.8rem;margin-top:12px;max-width:600px;text-align:center;font-family:Inter,sans-serif;"></div>
            <div style="color:#3a4a5a;font-size:0.7rem;margin-top:20px;font-family:Inter,sans-serif;">Click anywhere to close</div>
        `;
        this.overlay.addEventListener('click', () => this.close());
        document.body.appendChild(this.overlay);
    }

    bindStages() {
        document.querySelectorAll('.pipeline-stage canvas, .pipeline-stage video').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const stage = el.closest('.pipeline-stage');
                const title = stage.querySelector('.pipeline-stage-header h4')?.textContent || '';
                const info = stage.querySelector('.pipeline-stage-info')?.textContent || '';
                this.expand(el, title, info);
            });
        });
    }

    expand(sourceEl, title, info) {
        const expandCanvas = document.getElementById('expand-canvas');
        const expandCtx = expandCanvas.getContext('2d');

        document.getElementById('expand-header').textContent = title;
        document.getElementById('expand-info').textContent = info;

        // Size the expanded canvas larger
        const maxW = Math.min(window.innerWidth * 0.85, 960);
        const maxH = Math.min(window.innerHeight * 0.7, 720);

        if (sourceEl.tagName === 'VIDEO') {
            expandCanvas.width = Math.min(sourceEl.videoWidth || 640, maxW);
            expandCanvas.height = Math.min(sourceEl.videoHeight || 480, maxH);
        } else {
            const aspect = sourceEl.width / sourceEl.height;
            expandCanvas.width = maxW;
            expandCanvas.height = maxW / aspect;
            if (expandCanvas.height > maxH) {
                expandCanvas.height = maxH;
                expandCanvas.width = maxH * aspect;
            }
        }

        this.overlay.style.display = 'flex';
        this.expanded = true;
        this.sourceEl = sourceEl;

        // Continuously copy source to expanded canvas
        const copyFrame = () => {
            if (!this.expanded) return;
            try {
                if (sourceEl.tagName === 'VIDEO') {
                    expandCtx.drawImage(sourceEl, 0, 0, expandCanvas.width, expandCanvas.height);
                } else {
                    expandCtx.drawImage(sourceEl, 0, 0, expandCanvas.width, expandCanvas.height);
                }
            } catch(e) {}
            requestAnimationFrame(copyFrame);
        };
        copyFrame();
    }

    close() {
        this.overlay.style.display = 'none';
        this.expanded = false;
    }
}

/* ---- Init is handled by bionic-eye.html inline script ---- */
