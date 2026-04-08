/* ============================================
   UI Controller
   Manages all DOM interactions, step navigation,
   sub-step timeline, panel updates.
   ============================================ */

class UIController {
    constructor() {
        this.currentStep = 0;
        this.currentSubStep = 0;
        this.subSteps = [];
        this.complicationsVisible = false;
        this.labelsVisible = true;
        this.onStepChange = null;       // callback(stepId) => returns subSteps
        this.onSubStepChange = null;    // callback(subStepIndex)
        this.onComplicationClick = null; // callback(stepId, compIndex)

        this.cacheElements();
    }

    cacheElements() {
        this.el = {
            loadingScreen: document.getElementById('loading-screen'),
            introScreen: document.getElementById('intro-screen'),
            simulationUI: document.getElementById('simulation-ui'),
            loadingBarFill: document.querySelector('.loading-bar-fill'),
            loadingText: document.querySelector('.loading-text'),
            stepsList: document.getElementById('steps-list'),
            stepDetail: document.getElementById('step-detail-content'),
            complicationsPanel: document.getElementById('complications-panel'),
            complicationsContent: document.getElementById('complications-content'),
            progressBar: document.getElementById('progress-bar'),
            progressSteps: document.getElementById('progress-steps'),
            subStepTimeline: document.getElementById('substep-timeline'),
            subStepInfo: document.getElementById('substep-info'),
            btnStart: document.getElementById('btn-start'),
            btnVR: document.getElementById('btn-vr'),
            btnPrev: document.getElementById('btn-prev'),
            btnNext: document.getElementById('btn-next'),
            btnSubPrev: document.getElementById('btn-sub-prev'),
            btnSubNext: document.getElementById('btn-sub-next'),
            btnSubReplay: document.getElementById('btn-sub-replay'),
            btnToggleComplications: document.getElementById('btn-toggle-complications'),
            btnToggleLabels: document.getElementById('btn-toggle-labels'),
            btnResetView: document.getElementById('btn-reset-view'),
            btnEnterVR: document.getElementById('btn-enter-vr'),
            btnCloseComplications: document.getElementById('btn-close-complications'),
            rightPanel: document.getElementById('right-panel'),
        };
    }

    /* ---- Initialize UI ---- */
    init() {
        this.buildStepsList();
        this.buildProgressBar();
        this.bindEvents();
    }

    /* ---- Loading Screen ---- */
    updateLoading(percent, text) {
        if (this.el.loadingBarFill) {
            this.el.loadingBarFill.style.width = `${percent}%`;
        }
        if (this.el.loadingText && text) {
            this.el.loadingText.textContent = text;
        }
    }

    hideLoading() {
        this.el.loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            this.el.loadingScreen.classList.add('hidden');
            this.el.introScreen.classList.remove('hidden');
        }, 600);
    }

    showSimulation() {
        this.el.introScreen.classList.add('hidden');
        this.el.simulationUI.classList.remove('hidden');
        this.goToStep(0);
    }

    /* ---- Build Steps List ---- */
    buildStepsList() {
        const container = this.el.stepsList;
        container.innerHTML = '';

        SURGERY_STEPS.forEach((step, i) => {
            const item = document.createElement('div');
            item.className = `step-item${i === 0 ? ' active' : ''}`;
            item.dataset.step = i;

            item.innerHTML = `
                <div class="step-number">${i + 1}</div>
                <div class="step-info">
                    <h4>${step.name}</h4>
                    <p>${step.duration} &mdash; Risk: ${step.riskLevel}</p>
                </div>
            `;

            item.addEventListener('click', () => this.goToStep(i));
            container.appendChild(item);
        });
    }

    /* ---- Build Progress Bar ---- */
    buildProgressBar() {
        const container = this.el.progressSteps;
        container.innerHTML = '';

        SURGERY_STEPS.forEach((step, i) => {
            const dot = document.createElement('div');
            dot.className = `progress-dot${i === 0 ? ' active' : ''}`;
            dot.dataset.step = i;

            dot.innerHTML = `
                <div class="progress-dot-circle"></div>
                <span class="progress-dot-label">${step.shortName}</span>
            `;

            dot.addEventListener('click', () => this.goToStep(i));
            container.appendChild(dot);
        });
    }

    /* ---- Step Navigation ---- */
    goToStep(stepId) {
        if (stepId < 0 || stepId >= SURGERY_STEPS.length) return;

        this.currentStep = stepId;
        this.currentSubStep = 0;

        // Update step list highlighting
        this.el.stepsList.querySelectorAll('.step-item').forEach((item, i) => {
            item.classList.remove('active');
            if (i < stepId) item.classList.add('completed');
            else item.classList.remove('completed');
            if (i === stepId) item.classList.add('active');
        });

        // Update progress bar
        const progressPct = (stepId / (SURGERY_STEPS.length - 1)) * 100;
        this.el.progressBar.style.width = `${progressPct}%`;

        this.el.progressSteps.querySelectorAll('.progress-dot').forEach((dot, i) => {
            dot.classList.remove('active', 'completed');
            if (i < stepId) dot.classList.add('completed');
            if (i === stepId) dot.classList.add('active');
        });

        // Update nav buttons
        this.el.btnPrev.disabled = stepId === 0;
        this.el.btnNext.disabled = stepId === SURGERY_STEPS.length - 1;

        // Update detail panel
        this.updateStepDetail(stepId);

        // Update complications
        this.updateComplications(stepId);
        this.hideComplications();

        // Fire callback — gets back sub-steps
        if (this.onStepChange) {
            this.subSteps = this.onStepChange(stepId) || [];
            this.buildSubStepTimeline();
            // Auto-play first sub-step
            if (this.subSteps.length > 0) {
                this.goToSubStep(0);
            }
        }
    }

    /* ---- Sub-Step Timeline ---- */
    buildSubStepTimeline() {
        const container = this.el.subStepTimeline;
        if (!container) return;
        container.innerHTML = '';

        this.subSteps.forEach((sub, i) => {
            const item = document.createElement('div');
            item.className = `substep-item${i === 0 ? ' active' : ''}`;
            item.dataset.substep = i;

            item.innerHTML = `
                <div class="substep-marker">
                    <div class="substep-dot"></div>
                    ${i < this.subSteps.length - 1 ? '<div class="substep-line"></div>' : ''}
                </div>
                <div class="substep-content">
                    <div class="substep-label">
                        <i class="fas ${sub.icon || 'fa-circle'}"></i>
                        <span>${sub.label}</span>
                    </div>
                </div>
            `;

            item.addEventListener('click', () => this.goToSubStep(i));
            container.appendChild(item);
        });

        this.updateSubStepButtons();
    }

    goToSubStep(index) {
        if (index < 0 || index >= this.subSteps.length) return;
        this.currentSubStep = index;

        // Update timeline UI
        if (this.el.subStepTimeline) {
            this.el.subStepTimeline.querySelectorAll('.substep-item').forEach((item, i) => {
                item.classList.remove('active', 'completed');
                if (i < index) item.classList.add('completed');
                if (i === index) item.classList.add('active');
            });
        }

        // Update info display
        if (this.el.subStepInfo) {
            const sub = this.subSteps[index];
            this.el.subStepInfo.innerHTML = `
                <div class="substep-info-content step-transition">
                    <div class="substep-info-header">
                        <i class="fas ${sub.icon || 'fa-circle'}"></i>
                        <h4>${sub.label}</h4>
                    </div>
                    <p>${sub.description}</p>
                </div>
            `;
        }

        this.updateSubStepButtons();

        // Fire animation callback
        if (this.onSubStepChange) {
            this.onSubStepChange(index);
        }
    }

    updateSubStepButtons() {
        if (this.el.btnSubPrev) {
            this.el.btnSubPrev.disabled = this.currentSubStep <= 0;
        }
        if (this.el.btnSubNext) {
            this.el.btnSubNext.disabled = this.currentSubStep >= this.subSteps.length - 1;
        }
    }

    /* ---- Step Detail Panel ---- */
    updateStepDetail(stepId) {
        const step = SURGERY_STEPS[stepId];
        const container = this.el.stepDetail;

        container.innerHTML = `
            <div class="step-transition">
                <div class="detail-section">
                    <h4><i class="fas fa-${step.icon}"></i> Overview</h4>
                    <p>${step.description}</p>
                </div>

                <div class="detail-section">
                    <h4><i class="fas fa-clock"></i> Duration</h4>
                    <p>${step.duration}</p>
                </div>

                <div class="detail-section">
                    <h4><i class="fas fa-tools"></i> Instruments</h4>
                    <div>
                        ${step.instruments.map(inst =>
                            `<span class="instrument-tag"><i class="fas ${inst.icon}"></i> ${inst.name}</span>`
                        ).join('')}
                    </div>
                </div>

                <div class="detail-section">
                    <h4><i class="fas fa-exclamation-circle"></i> Risk Level</h4>
                    <div class="risk-meter">
                        <div class="risk-bar">
                            <div class="risk-bar-fill ${step.riskLevel}"></div>
                        </div>
                        <span class="risk-label ${step.riskLevel}">${step.riskLevel.toUpperCase()}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h4><i class="fas fa-exclamation-triangle"></i> Complications (${step.complications.length})</h4>
                    <p class="hint-text">Press <kbd>C</kbd> or click <i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i> to visualize</p>
                </div>
            </div>
        `;
    }

    /* ---- Complications ---- */
    updateComplications(stepId) {
        const step = SURGERY_STEPS[stepId];
        const container = this.el.complicationsContent;

        container.innerHTML = step.complications.map((comp, i) => `
            <div class="complication-card" data-comp-index="${i}">
                <div class="complication-header">
                    <div class="complication-severity ${comp.severity}"></div>
                    <h4>${comp.name}</h4>
                </div>
                <p>${comp.description}</p>
                <p style="margin-top:6px;"><strong style="color:var(--warning);">Consequence:</strong> ${comp.consequence}</p>
                <span class="complication-freq">Frequency: ${comp.frequency}</span>
            </div>
        `).join('');

        // Bind clicks
        container.querySelectorAll('.complication-card').forEach(card => {
            card.addEventListener('click', () => {
                const index = parseInt(card.dataset.compIndex);
                const wasShowing = card.classList.contains('showing');

                container.querySelectorAll('.complication-card').forEach(c => c.classList.remove('showing'));

                if (!wasShowing) {
                    card.classList.add('showing');
                    if (this.onComplicationClick) this.onComplicationClick(this.currentStep, index);
                } else {
                    if (this.onComplicationClick) this.onComplicationClick(this.currentStep, -1);
                }
            });
        });
    }

    toggleComplications() {
        this.complicationsVisible = !this.complicationsVisible;
        if (this.complicationsVisible) {
            this.el.complicationsPanel.classList.remove('hidden');
            this.el.btnToggleComplications.classList.add('active');
        } else {
            this.hideComplications();
        }
    }

    hideComplications() {
        this.complicationsVisible = false;
        this.el.complicationsPanel.classList.add('hidden');
        this.el.btnToggleComplications.classList.remove('active');
    }

    /* ---- Bind Events ---- */
    bindEvents() {
        this.el.btnStart.addEventListener('click', () => this.showSimulation());

        this.el.btnPrev.addEventListener('click', () => this.goToStep(this.currentStep - 1));
        this.el.btnNext.addEventListener('click', () => this.goToStep(this.currentStep + 1));

        if (this.el.btnSubPrev) {
            this.el.btnSubPrev.addEventListener('click', () => this.goToSubStep(this.currentSubStep - 1));
        }
        if (this.el.btnSubNext) {
            this.el.btnSubNext.addEventListener('click', () => this.goToSubStep(this.currentSubStep + 1));
        }
        if (this.el.btnSubReplay) {
            this.el.btnSubReplay.addEventListener('click', () => this.goToSubStep(this.currentSubStep));
        }

        this.el.btnToggleComplications.addEventListener('click', () => this.toggleComplications());
        this.el.btnCloseComplications.addEventListener('click', () => this.hideComplications());

        this.el.btnToggleLabels.addEventListener('click', () => {
            this.labelsVisible = !this.labelsVisible;
            this.el.btnToggleLabels.classList.toggle('active', this.labelsVisible);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.el.simulationUI.classList.contains('hidden')) return;

            switch (e.key) {
                case 'ArrowRight':
                    this.goToSubStep(this.currentSubStep + 1);
                    break;
                case 'ArrowLeft':
                    this.goToSubStep(this.currentSubStep - 1);
                    break;
                case 'ArrowUp':
                    this.goToStep(this.currentStep - 1);
                    break;
                case 'ArrowDown':
                    this.goToStep(this.currentStep + 1);
                    break;
                case 'r':
                    this.goToSubStep(this.currentSubStep);
                    break;
                case 'c':
                    this.toggleComplications();
                    break;
                case ' ':
                    e.preventDefault();
                    // Space = advance sub-step, or next step if at end
                    if (this.currentSubStep < this.subSteps.length - 1) {
                        this.goToSubStep(this.currentSubStep + 1);
                    } else if (this.currentStep < SURGERY_STEPS.length - 1) {
                        this.goToStep(this.currentStep + 1);
                    }
                    break;
                case 'Escape':
                    this.hideComplications();
                    break;
            }
        });
    }

    /* ---- VR Button ---- */
    showVRButton() {
        if (this.el.btnVR) this.el.btnVR.style.display = '';
        if (this.el.btnEnterVR) this.el.btnEnterVR.style.display = '';
    }
}
