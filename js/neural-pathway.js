/* ============================================
   Neural Pathway Visualization
   Animated signal transmission from bionic eye
   electrode array through optic nerve to brain.
   ============================================ */

class NeuralPathway {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.signals = [];
        this.nodes = [];

        this.buildNodes();
        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = 350;
        this.w = this.canvas.width;
        this.h = this.canvas.height;
    }

    buildNodes() {
        const w = this.w;
        const h = this.h;

        // Key pathway nodes
        this.nodes = [
            { x: w * 0.05, y: h * 0.5, r: 25, label: 'Electrode\nArray', color: '#00e5ff', type: 'source' },
            { x: w * 0.18, y: h * 0.35, r: 20, label: 'Ganglion\nCells', color: '#44cc88', type: 'relay' },
            { x: w * 0.35, y: h * 0.55, r: 18, label: 'Optic\nNerve', color: '#daa520', type: 'nerve' },
            { x: w * 0.50, y: h * 0.30, r: 16, label: 'Optic\nChiasm', color: '#cc6688', type: 'junction' },
            { x: w * 0.65, y: h * 0.55, r: 18, label: 'LGN\n(Thalamus)', color: '#aa66cc', type: 'relay' },
            { x: w * 0.80, y: h * 0.35, r: 22, label: 'Visual\nCortex V1', color: '#ff6644', type: 'destination' },
            { x: w * 0.93, y: h * 0.5, r: 28, label: 'Conscious\nPerception', color: '#76ff03', type: 'final' },
        ];

        // Build connection paths between nodes
        this.paths = [];
        for (let i = 0; i < this.nodes.length - 1; i++) {
            const a = this.nodes[i];
            const b = this.nodes[i + 1];
            const mid = {
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2 + (Math.random() - 0.5) * 40,
            };
            this.paths.push({ from: i, to: i + 1, mid });
        }
    }

    animate() {
        const t = performance.now() / 1000;
        const ctx = this.ctx;
        const w = this.w;
        const h = this.h;

        ctx.clearRect(0, 0, w, h);

        // Background
        const bg = ctx.createLinearGradient(0, 0, w, 0);
        bg.addColorStop(0, '#030810');
        bg.addColorStop(0.5, '#0a1020');
        bg.addColorStop(1, '#030810');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Draw branching nerve fibers (background detail)
        this.drawNerveFibers(ctx, t);

        // Draw connection paths
        this.paths.forEach((path, i) => {
            const a = this.nodes[path.from];
            const b = this.nodes[path.to];

            // Axon bundle (multiple parallel lines)
            for (let f = -2; f <= 2; f++) {
                const offset = f * 3;
                ctx.strokeStyle = `rgba(100, 140, 180, ${0.08 + Math.abs(f) * 0.02})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y + offset);
                ctx.quadraticCurveTo(path.mid.x, path.mid.y + offset, b.x, b.y + offset);
                ctx.stroke();
            }

            // Main connection
            ctx.strokeStyle = `rgba(0, 229, 255, 0.15)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo(path.mid.x, path.mid.y, b.x, b.y);
            ctx.stroke();
        });

        // Traveling signals (pulses along the path)
        for (let p = 0; p < 8; p++) {
            const progress = ((t * 0.6 + p * 0.125) % 1);
            const totalLength = this.nodes.length - 1;
            const segment = progress * totalLength;
            const segIdx = Math.floor(segment);
            const segFrac = segment - segIdx;

            if (segIdx < this.paths.length) {
                const path = this.paths[segIdx];
                const a = this.nodes[path.from];
                const b = this.nodes[path.to];

                // Quadratic bezier interpolation
                const t2 = segFrac;
                const px = (1 - t2) * (1 - t2) * a.x + 2 * (1 - t2) * t2 * path.mid.x + t2 * t2 * b.x;
                const py = (1 - t2) * (1 - t2) * a.y + 2 * (1 - t2) * t2 * path.mid.y + t2 * t2 * b.y;

                // Signal glow
                const signalAlpha = 0.6 + Math.sin(t * 8 + p) * 0.3;
                const signalSize = 4 + Math.sin(t * 6 + p * 2) * 2;

                // Outer glow
                const grad = ctx.createRadialGradient(px, py, 0, px, py, signalSize * 4);
                grad.addColorStop(0, `rgba(0, 229, 255, ${signalAlpha * 0.4})`);
                grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, signalSize * 4, 0, Math.PI * 2);
                ctx.fill();

                // Core
                ctx.fillStyle = `rgba(200, 240, 255, ${signalAlpha})`;
                ctx.beginPath();
                ctx.arc(px, py, signalSize, 0, Math.PI * 2);
                ctx.fill();

                // Trail
                for (let trail = 1; trail <= 5; trail++) {
                    const tt = Math.max(0, t2 - trail * 0.02);
                    const trailX = (1 - tt) * (1 - tt) * a.x + 2 * (1 - tt) * tt * path.mid.x + tt * tt * b.x;
                    const trailY = (1 - tt) * (1 - tt) * a.y + 2 * (1 - tt) * tt * path.mid.y + tt * tt * b.y;
                    ctx.fillStyle = `rgba(0, 229, 255, ${0.15 - trail * 0.025})`;
                    ctx.beginPath();
                    ctx.arc(trailX, trailY, signalSize * (1 - trail * 0.15), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Draw nodes
        this.nodes.forEach((node, i) => {
            const pulse = Math.sin(t * 3 + i * 0.8) * 0.2 + 0.8;

            // Outer glow
            const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 2);
            grad.addColorStop(0, node.color + '40');
            grad.addColorStop(1, node.color + '00');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r * 2, 0, Math.PI * 2);
            ctx.fill();

            // Node circle
            ctx.fillStyle = node.color + '30';
            ctx.strokeStyle = node.color;
            ctx.lineWidth = 2 * pulse;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Inner dot
            ctx.fillStyle = node.color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = node.color;
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            const lines = node.label.split('\n');
            lines.forEach((line, li) => {
                ctx.fillText(line, node.x, node.y + node.r + 15 + li * 13);
            });
        });

        // Info text
        ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.font = '11px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Signal propagation: ~120 m/s along myelinated axons | Total latency: ~50ms', 20, h - 15);

        requestAnimationFrame(() => this.animate());
    }

    drawNerveFibers(ctx, t) {
        // Background branching nerve fibers for visual richness
        ctx.strokeStyle = 'rgba(40, 60, 80, 0.15)';
        ctx.lineWidth = 0.5;

        for (let i = 0; i < 30; i++) {
            const startX = (i / 30) * this.w;
            const startY = this.h / 2 + Math.sin(i * 0.7 + t * 0.3) * 80;

            ctx.beginPath();
            ctx.moveTo(startX, startY);

            let cx = startX;
            let cy = startY;
            for (let j = 0; j < 8; j++) {
                cx += 15 + Math.random() * 10;
                cy += (Math.random() - 0.5) * 30;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new NeuralPathway('neural-canvas');
});
