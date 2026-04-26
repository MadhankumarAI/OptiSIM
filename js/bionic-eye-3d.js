/* ============================================
   Bionic Eye 3D Viewer
   Loads bionic_eye.glb, applies cybernetic
   materials, shows camera feed as the eye's
   lens/iris (the eye "sees" what camera sees).
   ============================================ */

class BionicEye3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.composer = null;
        this.model = null;
        this.meshes = [];
        this.clock = new THREE.Clock();
        this.activeComponent = null;

        this.videoTexture = null;
        this.videoElement = null;
        this.lensMesh = null;
        this.onLensClick = null; // Callback when lens is clicked
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.init();
        this.loadModel();
        this.bindComponentCards();
        this.bindLensClick();
    }

    init() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight || 400;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030810);

        this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
        this.camera.position.set(0, 0.5, 4);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.4;
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 1.5;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 8;

        this.setupLighting();
        this.setupEnvMap();
        this.setupPostProcessing();

        window.addEventListener('resize', () => this.onResize());
        this.renderer.setAnimationLoop(() => this.render());
    }

    setupLighting() {
        this.scene.add(new THREE.AmbientLight(0x1a2535, 0.5));
        this.scene.add(new THREE.HemisphereLight(0x4466aa, 0x221111, 0.3));

        const key = new THREE.DirectionalLight(0xffeedd, 0.9);
        key.position.set(3, 4, 2);
        key.castShadow = true;
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x4488cc, 0.4);
        fill.position.set(-3, 1, 2);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0x00e5ff, 0.35);
        rim.position.set(0, 0, -4);
        this.scene.add(rim);

        const spec = new THREE.PointLight(0xffffff, 0.5, 6, 2);
        spec.position.set(1, 2, 3);
        this.scene.add(spec);

        const under = new THREE.PointLight(0x00e5ff, 0.2, 5, 2);
        under.position.set(0, -2, 1);
        this.scene.add(under);
    }

    setupEnvMap() {
        try {
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            pmrem.compileEquirectangularShader();
            const envScene = new THREE.Scene();
            envScene.background = new THREE.Color(0x0a1525);
            envScene.add(new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff5e6 })));
            envScene.children[0].position.set(0, 8, 3);
            const blue = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), new THREE.MeshBasicMaterial({ color: 0x2266aa }));
            blue.position.set(-8, 2, 0);
            envScene.add(blue);
            const cyan = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ccdd }));
            cyan.position.set(6, 0, -3);
            envScene.add(cyan);
            const rt = pmrem.fromScene(envScene, 0.04);
            this.envMap = rt.texture;
            this.scene.environment = this.envMap;
            pmrem.dispose();
        } catch (e) {
            console.warn('Env map failed:', e);
        }
    }

    setupPostProcessing() {
        try {
            this.composer = new THREE.EffectComposer(this.renderer);
            this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
            this.composer.addPass(new THREE.UnrealBloomPass(
                new THREE.Vector2(this.container.clientWidth, this.container.clientHeight || 400),
                0.6, 0.8, 0.7
            ));
        } catch (e) { this.composer = null; }
    }

    /* ---- Set video source from camera (called by BionicVision) ---- */
    setVideoSource(videoEl) {
        this.videoElement = videoEl;
        this.videoTexture = new THREE.VideoTexture(videoEl);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
        this.videoTexture.encoding = THREE.sRGBEncoding;

        // Apply to the lens mesh if it exists
        if (this.lensMesh) {
            this.applyVideoToLens();
        }
        console.log('Camera feed connected to bionic eye lens');
    }

    applyVideoToLens() {
        if (!this.lensMesh || !this.videoTexture) return;

        this.lensMesh.material = new THREE.MeshPhysicalMaterial({
            map: this.videoTexture,
            roughness: 0.0,
            metalness: 0.05,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            envMapIntensity: 0.5,
            emissive: new THREE.Color(0x113355),
            emissiveIntensity: 0.2,
        });
        if (this.envMap) this.lensMesh.material.envMap = this.envMap;
        this.lensMesh.material.needsUpdate = true;
    }

    loadModel() {
        const loader = new THREE.GLTFLoader();
        const paths = ['assets/bionic_eye.glb', 'assets/bionic-eye/scene.glb'];

        const tryLoad = (idx) => {
            if (idx >= paths.length) {
                this.buildProceduralBionicEye();
                return;
            }
            loader.load(paths[idx],
                (gltf) => { this.model = gltf.scene; this.processModel(); },
                undefined,
                () => tryLoad(idx + 1)
            );
        };
        tryLoad(0);
    }

    processModel() {
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 2.5 / Math.max(size.x, size.y, size.z);
        this.model.scale.setScalar(scale);
        box.setFromObject(this.model);
        this.model.position.sub(box.getCenter(new THREE.Vector3()));

        let meshIdx = 0;
        this.model.traverse(child => {
            if (child.isMesh) {
                this.meshes.push(child);
                child.userData.meshIndex = meshIdx;
                child.castShadow = true;
                child.receiveShadow = true;
                meshIdx++;
            }
        });

        console.log(`Bionic eye: ${this.meshes.length} meshes loaded`);
        this.applyCyberneticMaterials();
        this.scene.add(this.model);
        this.addHoloRing();
        this.addParticles();
    }

    applyCyberneticMaterials() {
        const presets = [
            { name: 'frame', color: 0x2a3545, roughness: 0.2, metalness: 0.9, clearcoat: 0.8, envMapIntensity: 1.5 },
            { name: 'optic', color: 0x00aaff, roughness: 0.0, metalness: 0.1, clearcoat: 1.0, transparent: true, opacity: 0.4, envMapIntensity: 2.5, emissive: 0x003366, emissiveIntensity: 0.3, isLens: true },
            { name: 'mechanism', color: 0xd4a030, roughness: 0.15, metalness: 0.95, clearcoat: 0.6, envMapIntensity: 2.0 },
            { name: 'circuits', color: 0x1a4a2a, roughness: 0.5, metalness: 0.3, emissive: 0x00ff88, emissiveIntensity: 0.15 },
            { name: 'electrodes', color: 0x00ddff, roughness: 0.1, metalness: 0.7, emissive: 0x00aacc, emissiveIntensity: 0.4, clearcoat: 1.0, envMapIntensity: 2.0 },
            { name: 'wiring', color: 0xcc6633, roughness: 0.2, metalness: 0.85, clearcoat: 0.5, envMapIntensity: 1.5 },
            { name: 'shell', color: 0x1a1a2a, roughness: 0.08, metalness: 0.95, clearcoat: 1.0, envMapIntensity: 3.0 },
        ];

        this.meshes.forEach((mesh, i) => {
            const p = presets[i % presets.length];
            const mat = new THREE.MeshPhysicalMaterial({
                color: p.color,
                roughness: p.roughness,
                metalness: p.metalness,
                clearcoat: p.clearcoat || 0,
                clearcoatRoughness: 0.1,
                envMapIntensity: p.envMapIntensity || 1.0,
                transparent: p.transparent || false,
                opacity: p.opacity || 1.0,
            });
            if (p.emissive) {
                mat.emissive = new THREE.Color(p.emissive);
                mat.emissiveIntensity = p.emissiveIntensity || 0.1;
            }
            if (this.envMap) mat.envMap = this.envMap;
            mesh.material = mat;
            mesh.userData.originalMaterial = mat.clone();
            mesh.userData.componentName = p.name;

            // Mark the lens mesh — this is where camera feed goes
            if (p.isLens) {
                this.lensMesh = mesh;
                if (this.videoTexture) this.applyVideoToLens();
            }
        });
    }

    addHoloRing() {
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.4 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.008, 8, 128), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.userData.isHoloRing = true;
        this.scene.add(ring);

        const ring2 = ring.clone();
        ring2.rotation.x = Math.PI / 2 + 0.3;
        ring2.rotation.z = 0.5;
        ring2.material = ringMat.clone();
        ring2.material.opacity = 0.2;
        ring2.userData.isHoloRing = true;
        this.scene.add(ring2);

        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
            dot.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6);
            dot.userData.isHoloDot = true;
            dot.userData.baseAngle = a;
            this.scene.add(dot);
        }
    }

    addParticles() {
        const count = 100;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 8;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0x00e5ff, size: 0.02, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false,
        })));
    }

    buildProceduralBionicEye() {
        const group = new THREE.Group();
        const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64),
            new THREE.MeshPhysicalMaterial({ color: 0x1a1a2a, roughness: 0.08, metalness: 0.95, clearcoat: 1.0, envMapIntensity: 2.0 }));
        group.add(shell); this.meshes.push(shell);

        // Lens — camera feed will go here
        const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x00aaff, roughness: 0.0, metalness: 0.1, clearcoat: 1.0, transparent: true, opacity: 0.5,
            emissive: new THREE.Color(0x003366), emissiveIntensity: 0.3 });
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.45, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2.5), lensMat);
        lens.position.z = 0.7; lens.rotation.x = Math.PI;
        lens.userData.componentName = 'optic';
        group.add(lens); this.meshes.push(lens);
        this.lensMesh = lens;
        if (this.videoTexture) this.applyVideoToLens();

        for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 8),
                new THREE.MeshPhysicalMaterial({ color: 0x00ddff, emissive: new THREE.Color(0x00aacc), emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.1 }));
            dot.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.85);
            dot.rotation.x = Math.PI / 2;
            group.add(dot);
        }
        if (this.envMap) group.traverse(c => { if (c.isMesh && c.material) { c.material.envMap = this.envMap; c.material.needsUpdate = true; } });
        this.model = group; this.scene.add(group);
        this.addHoloRing(); this.addParticles();
    }

    highlightComponent(name) {
        this.activeComponent = name;
        const map = { 'camera': [0, 1], 'processor': [3], 'transmitter': [5], 'electrode': [4], 'power': [2] };
        this.meshes.forEach((mesh, i) => {
            const lit = map[name]?.includes(i);
            if (lit) {
                if (mesh.material.emissive) { mesh.material.emissive = new THREE.Color(0x00e5ff); mesh.material.emissiveIntensity = 0.5; }
            } else {
                if (mesh.userData.originalMaterial) {
                    const o = mesh.userData.originalMaterial;
                    if (mesh.material.emissive) { mesh.material.emissive.copy(o.emissive || new THREE.Color(0)); mesh.material.emissiveIntensity = o.emissiveIntensity || 0; }
                }
            }
            mesh.material.needsUpdate = true;
        });
    }

    resetHighlight() {
        this.activeComponent = null;
        this.meshes.forEach(mesh => {
            if (mesh.userData.originalMaterial) {
                // Don't reset lens if video is playing
                if (mesh === this.lensMesh && this.videoTexture) return;
                mesh.material = mesh.userData.originalMaterial.clone();
                if (this.envMap) mesh.material.envMap = this.envMap;
                mesh.material.needsUpdate = true;
            }
        });
    }

    bindComponentCards() {
        document.querySelectorAll('.component-card').forEach(card => {
            card.addEventListener('mouseenter', () => this.highlightComponent(card.dataset.component));
            card.addEventListener('mouseleave', () => this.resetHighlight());
            card.addEventListener('click', () => {
                document.querySelectorAll('.component-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.highlightComponent(card.dataset.component);
                this.controls.autoRotate = false;
                setTimeout(() => { this.controls.autoRotate = true; }, 5000);
            });
        });
    }

    bindLensClick() {
        this.renderer.domElement.addEventListener('click', (e) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.meshes, true);

            if (intersects.length > 0 && this.onLensClick) {
                this.onLensClick();
                // Stop auto-rotate briefly
                this.controls.autoRotate = false;
                setTimeout(() => { this.controls.autoRotate = true; }, 3000);
            }
        });

        // Hover cursor change
        this.renderer.domElement.addEventListener('mousemove', (e) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.meshes, true);
            this.renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';
        });
    }

    onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight || 400;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        if (this.composer) this.composer.setSize(w, h);
    }

    render() {
        const t = this.clock.getElapsedTime();
        this.controls.update();

        // Update video texture each frame
        if (this.videoTexture && this.videoElement && this.videoElement.readyState >= 2) {
            this.videoTexture.needsUpdate = true;
        }

        this.scene.traverse(obj => {
            if (obj.userData.isHoloRing) obj.rotation.z += 0.003;
            if (obj.userData.isHoloDot) {
                const a = obj.userData.baseAngle + t * 0.5;
                obj.position.x = Math.cos(a) * 1.6;
                obj.position.z = Math.sin(a) * 1.6;
            }
        });

        this.meshes.forEach((mesh, i) => {
            if (mesh.userData.componentName === 'electrodes' && mesh.material.emissive)
                mesh.material.emissiveIntensity = 0.3 + Math.sin(t * 4 + i) * 0.2;
            if (mesh.userData.componentName === 'circuits' && mesh.material.emissive)
                mesh.material.emissiveIntensity = 0.1 + Math.sin(t * 2 + i * 0.5) * 0.08;
        });

        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
}

// Global reference so BionicVision can access it
let bionicEye3D = null;
document.addEventListener('DOMContentLoaded', () => {
    bionicEye3D = new BionicEye3D('schematic-3d');
});
