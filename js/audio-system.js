/* ============================================
   Spatial Audio System
   OR ambience, tool sounds, tissue interaction
   audio using Web Audio API with 3D positioning.
   ============================================ */

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = false;
        this.sounds = {};
        this.ambience = null;
        this.initialized = false;
    }

    async init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.6;
            this.masterGain.connect(this.ctx.destination);
            this.enabled = true;
            this.initialized = true;

            // Build synthesized sounds
            this.buildSounds();

            console.log('Audio system initialized');
        } catch (e) {
            console.warn('Web Audio not available:', e);
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(val) {
        if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, val));
    }

    /* ---- Synthesize sounds (no external files needed) ---- */
    buildSounds() {
        // All sounds are generated procedurally via Web Audio API oscillators/noise
    }

    /* ---- Ambient OR background ---- */
    startAmbience() {
        if (!this.enabled) return;
        this.resume();

        // Low-frequency ventilation hum
        const hum = this.ctx.createOscillator();
        hum.type = 'sine';
        hum.frequency.value = 60;
        const humGain = this.ctx.createGain();
        humGain.gain.value = 0.03;
        hum.connect(humGain).connect(this.masterGain);
        hum.start();

        // Soft filtered noise (air circulation)
        const noiseBuffer = this.createNoiseBuffer(2);
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 200;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.015;
        noise.connect(noiseFilter).connect(noiseGain).connect(this.masterGain);
        noise.start();

        // Periodic beep (heart monitor)
        this.startHeartMonitor();

        this.ambience = { hum, noise, humGain, noiseGain };
    }

    stopAmbience() {
        if (this.ambience) {
            try {
                this.ambience.hum.stop();
                this.ambience.noise.stop();
            } catch (e) {}
            this.ambience = null;
        }
        if (this._beepInterval) {
            clearInterval(this._beepInterval);
            this._beepInterval = null;
        }
    }

    startHeartMonitor() {
        this._beepInterval = setInterval(() => {
            if (!this.enabled) return;
            this.playBeep(880, 0.06, 0.02);
        }, 1000);
    }

    /* ---- Tool interaction sounds ---- */

    // Metal instrument contact
    playToolContact() {
        if (!this.enabled) return;
        this.resume();
        this.playTone(2200, 0.08, 0.03, 'sine');
        this.playTone(3400, 0.05, 0.02, 'sine');
    }

    // Incision / cutting
    playIncision() {
        if (!this.enabled) return;
        this.resume();
        // Short burst of high-frequency filtered noise
        const buf = this.createNoiseBuffer(0.15);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 4000;
        filter.Q.value = 2;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        src.connect(filter).connect(gain).connect(this.masterGain);
        src.start();
    }

    // Phaco ultrasound
    playPhacoUltrasound() {
        if (!this.enabled) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 40000 / 60; // Audible harmonic of ultrasound
        const gain = this.ctx.createGain();
        gain.gain.value = 0.04;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 5;
        osc.connect(filter).connect(gain).connect(this.masterGain);
        osc.start();

        // Return handle to stop later
        return {
            stop: () => {
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
                setTimeout(() => osc.stop(), 400);
            }
        };
    }

    // Suction / aspiration
    playAspiration() {
        if (!this.enabled) return;
        this.resume();
        const buf = this.createNoiseBuffer(3);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.03;
        src.connect(filter).connect(gain).connect(this.masterGain);
        src.start();
        return {
            stop: () => {
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
                setTimeout(() => src.stop(), 600);
            }
        };
    }

    // Fluid injection
    playFluidInject() {
        if (!this.enabled) return;
        this.resume();
        const buf = this.createNoiseBuffer(0.5);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        src.connect(filter).connect(gain).connect(this.masterGain);
        src.start();
    }

    // IOL snap into place
    playIOLSnap() {
        if (!this.enabled) return;
        this.resume();
        this.playTone(1200, 0.05, 0.04, 'sine');
        setTimeout(() => this.playTone(1800, 0.03, 0.03, 'sine'), 50);
    }

    // Tissue deformation / capsule tear
    playTissueTear() {
        if (!this.enabled) return;
        this.resume();
        const buf = this.createNoiseBuffer(0.3);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 1;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        src.connect(filter).connect(gain).connect(this.masterGain);
        src.start();
    }

    // Step completion chime
    playStepComplete() {
        if (!this.enabled) return;
        this.resume();
        this.playTone(523, 0.15, 0.04, 'sine');
        setTimeout(() => this.playTone(659, 0.15, 0.04, 'sine'), 100);
        setTimeout(() => this.playTone(784, 0.2, 0.04, 'sine'), 200);
    }

    // Complication warning
    playWarning() {
        if (!this.enabled) return;
        this.resume();
        this.playTone(440, 0.2, 0.05, 'square');
        setTimeout(() => this.playTone(440, 0.2, 0.05, 'square'), 300);
    }

    /* ---- Utility ---- */
    playBeep(freq, duration, volume) {
        if (!this.enabled) return;
        this.playTone(freq, duration, volume, 'sine');
    }

    playTone(freq, duration, volume, type = 'sine') {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain).connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration + 0.05);
    }

    createNoiseBuffer(duration) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }
}
