/* ============================================
   Draggable Complication Cards
   Floating cards that can be dragged anywhere
   on screen. Click a complication to spawn one.
   ============================================ */

class DraggableCards {
    constructor(container) {
        this.container = container || document.body;
        this.cards = [];
        this.zIndex = 200;
        this.onCardClick = null; // callback(stepId, compIndex)
    }

    /* ---- Spawn a draggable card for a complication ---- */
    spawnCard(stepId, compIndex, x, y) {
        const step = SURGERY_STEPS[stepId];
        const comp = step.complications[compIndex];
        if (!comp) return;

        // Check if card already exists
        const existingId = `comp-card-${stepId}-${compIndex}`;
        const existing = document.getElementById(existingId);
        if (existing) {
            // Bring to front
            this.zIndex++;
            existing.style.zIndex = this.zIndex;
            existing.classList.add('card-pulse');
            setTimeout(() => existing.classList.remove('card-pulse'), 600);
            return;
        }

        const card = document.createElement('div');
        card.id = existingId;
        card.className = 'drag-card';
        card.style.zIndex = ++this.zIndex;
        card.style.left = `${x || 100 + Math.random() * 300}px`;
        card.style.top = `${y || 100 + Math.random() * 200}px`;

        const severityColor = {
            mild: '#ffa502',
            moderate: '#ff6b6b',
            severe: '#ff4757',
        };

        card.innerHTML = `
            <div class="drag-card-header" style="border-left: 4px solid ${severityColor[comp.severity] || '#ff4757'}">
                <div class="drag-card-title">
                    <div class="drag-card-severity" style="background:${severityColor[comp.severity]}"></div>
                    <h4>${comp.name}</h4>
                </div>
                <div class="drag-card-actions">
                    <button class="drag-card-btn drag-card-viz" title="Visualize on eye">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="drag-card-btn drag-card-close" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="drag-card-body">
                <div class="drag-card-meta">
                    <span class="drag-card-badge severity-${comp.severity}">${comp.severity.toUpperCase()}</span>
                    <span class="drag-card-badge freq">${comp.frequency}</span>
                </div>
                <p class="drag-card-desc">${comp.description}</p>
                <div class="drag-card-consequence">
                    <strong>Consequence:</strong> ${comp.consequence}
                </div>
            </div>
            <div class="drag-card-footer">
                <span>Step ${stepId + 1}: ${step.shortName}</span>
                <span class="drag-card-handle"><i class="fas fa-grip-horizontal"></i> Drag to move</span>
            </div>
        `;

        this.container.appendChild(card);
        this.cards.push(card);

        // Entrance animation
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        });

        // Make draggable
        this.makeDraggable(card);

        // Close button
        card.querySelector('.drag-card-close').addEventListener('click', (e) => {
            e.stopPropagation();
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.remove();
                this.cards = this.cards.filter(c => c !== card);
            }, 300);
        });

        // Visualize button
        card.querySelector('.drag-card-viz').addEventListener('click', (e) => {
            e.stopPropagation();
            card.classList.toggle('card-active');

            if (card.classList.contains('card-active')) {
                // Deactivate others
                this.cards.forEach(c => {
                    if (c !== card) c.classList.remove('card-active');
                });
                if (this.onCardClick) this.onCardClick(stepId, compIndex);
            } else {
                if (this.onCardClick) this.onCardClick(stepId, -1);
            }
        });

        // Bring to front on click
        card.addEventListener('mousedown', () => {
            this.zIndex++;
            card.style.zIndex = this.zIndex;
        });

        return card;
    }

    /* ---- Make an element draggable ---- */
    makeDraggable(el) {
        const header = el.querySelector('.drag-card-header');
        let isDragging = false;
        let startX, startY, origX, origY;

        const onDown = (e) => {
            // Only drag from header
            if (e.target.closest('.drag-card-btn')) return;
            isDragging = true;
            startX = e.clientX || e.touches?.[0]?.clientX;
            startY = e.clientY || e.touches?.[0]?.clientY;
            origX = el.offsetLeft;
            origY = el.offsetTop;
            el.classList.add('dragging');
            e.preventDefault();
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const cx = e.clientX || e.touches?.[0]?.clientX;
            const cy = e.clientY || e.touches?.[0]?.clientY;
            const dx = cx - startX;
            const dy = cy - startY;
            el.style.left = `${origX + dx}px`;
            el.style.top = `${origY + dy}px`;
        };

        const onUp = () => {
            isDragging = false;
            el.classList.remove('dragging');
        };

        header.addEventListener('mousedown', onDown);
        header.addEventListener('touchstart', onDown, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
    }

    /* ---- Remove all cards ---- */
    clearAll() {
        this.cards.forEach(c => c.remove());
        this.cards = [];
    }

    /* ---- Spawn all cards for a step ---- */
    spawnAllForStep(stepId) {
        this.clearAll();
        const step = SURGERY_STEPS[stepId];
        step.complications.forEach((_, i) => {
            this.spawnCard(stepId, i,
                window.innerWidth - 350 - Math.random() * 50,
                80 + i * 180 + Math.random() * 20
            );
        });
    }
}
