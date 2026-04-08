/* ============================================
   Main Entry Point - OptiSim
   Initializes Three.js scene, loads eye model,
   creates surgical tools, wires up interactive
   sub-step surgery simulation.
   ============================================ */

(function () {
    'use strict';

    let scene, camera, renderer, controls, composer;
    let eyeModel, surgicalTools, animations, ui, dragCards;
    let clock = new THREE.Clock();
    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    let hoveredMesh = null;
    let tooltipEl = null;

    async function init() {
        ui = new UIController();
        ui.updateLoading(5, 'Setting up 3D scene...');

        setupScene();
        setupLighting();
        setupPostProcessing();
        setupTooltip();

        ui.updateLoading(15, 'Loading eye model...');

        // Load 3D eye model (GLTF or procedural)
        eyeModel = new EyeModel(scene);
        await eyeModel.load((pct, msg) => ui.updateLoading(pct, msg));

        ui.updateLoading(92, 'Building surgical instruments...');

        // Build surgical tools
        surgicalTools = new SurgicalTools(scene);

        ui.updateLoading(95, 'Initializing simulation...');

        // Create animation controller
        animations = new SurgeryAnimations(eyeModel, surgicalTools, scene);

        // Initialize UI
        ui.init();

        // Wire: step changes -> build sub-steps
        ui.onStepChange = (stepId) => {
            const subSteps = animations.buildSubSteps(stepId, camera, controls);
            return subSteps;
        };

        // Wire: sub-step changes -> play animation
        ui.onSubStepChange = (subStepIndex) => {
            animations.playSubStep(subStepIndex);
        };

        // Draggable complication cards
        dragCards = new DraggableCards(document.body);
        dragCards.onCardClick = (stepId, compIndex) => {
            if (compIndex === -1) {
                animations.hideComplication();
                animations.playSubStep(ui.currentSubStep);
            } else {
                animations.showComplication(stepId, compIndex);
            }
        };

        // Wire: complication clicks -> spawn draggable card + show on eye
        ui.onComplicationClick = (stepId, compIndex) => {
            if (compIndex === -1) {
                animations.hideComplication();
                animations.playSubStep(ui.currentSubStep);
            } else {
                animations.showComplication(stepId, compIndex);
                // Also spawn a draggable card
                dragCards.spawnCard(stepId, compIndex);
            }
        };

        // Toggle complications button now spawns all cards for current step
        document.getElementById('btn-toggle-complications').addEventListener('click', () => {
            if (dragCards.cards.length > 0) {
                dragCards.clearAll();
                animations.hideComplication();
            } else {
                dragCards.spawnAllForStep(ui.currentStep);
            }
        });

        // Reset view button
        document.getElementById('btn-reset-view').addEventListener('click', () => {
            resetCamera();
            const subSteps = animations.buildSubSteps(ui.currentStep, camera, controls);
            ui.subSteps = subSteps;
            ui.buildSubStepTimeline();
            if (subSteps.length > 0) ui.goToSubStep(0);
        });

        // WebXR
        setupWebXR();

        ui.updateLoading(100, 'Ready!');
        setTimeout(() => ui.hideLoading(), 500);

        // Start render loop
        renderer.setAnimationLoop(render);
    }

    function setupScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x080c14);
        scene.fog = new THREE.FogExp2(0x080c14, 0.06);

        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, 5);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        document.getElementById('canvas-container').appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.rotateSpeed = 0.8;
        controls.zoomSpeed = 0.6;
        controls.minDistance = 1.5;
        controls.maxDistance = 12;
        controls.target.set(0, 0, 0);
        controls.update();

        window.addEventListener('resize', onResize);
        renderer.domElement.addEventListener('mousemove', onMouseMove);
        renderer.domElement.addEventListener('click', onMouseClick);
    }

    function setupLighting() {
        scene.add(new THREE.AmbientLight(0x404060, 0.6));

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(2, 5, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x8ec5fc, 0.4);
        fillLight.position.set(-3, 2, -2);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x00d4aa, 0.3);
        rimLight.position.set(0, -2, -5);
        scene.add(rimLight);

        const eyeLight = new THREE.PointLight(0xffffff, 0.5, 8);
        eyeLight.position.set(0, 1, 3);
        scene.add(eyeLight);

        const spotlight = new THREE.SpotLight(0xfff5e6, 0.8, 15, Math.PI / 6, 0.5, 1);
        spotlight.position.set(0, 4, 3);
        spotlight.target.position.set(0, 0, 0);
        spotlight.castShadow = true;
        scene.add(spotlight);
        scene.add(spotlight.target);

        addEnvironment();
    }

    function addEnvironment() {
        const platformGeo = new THREE.CylinderGeometry(4, 4, 0.05, 64);
        const platformMat = new THREE.MeshPhysicalMaterial({ color: 0x0c1220, roughness: 0.8, metalness: 0.2 });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.y = -2;
        platform.receiveShadow = true;
        scene.add(platform);

        const ringGeo = new THREE.RingGeometry(3.8, 4.0, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d4aa, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -1.97;
        scene.add(ring);

        // Floating particles
        const count = 150;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            size: 0.03,
            color: 0x00d4aa,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const particles = new THREE.Points(geo, mat);
        particles.userData.isParticles = true;
        scene.add(particles);
    }

    function setupPostProcessing() {
        try {
            composer = new THREE.EffectComposer(renderer);
            composer.addPass(new THREE.RenderPass(scene, camera));
            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.3, 0.4, 0.85
            );
            composer.addPass(bloomPass);
        } catch (e) {
            console.warn('Post-processing unavailable:', e);
            composer = null;
        }
    }

    function setupTooltip() {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tooltip-3d';
        tooltipEl.style.display = 'none';
        document.body.appendChild(tooltipEl);
    }

    function onMouseMove(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (!eyeModel || !eyeModel.loaded) return;

        raycaster.setFromCamera(mouse, camera);
        const meshes = eyeModel.getAllMeshes();
        const intersects = raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            const partName = hit.userData.anatomyPart || hit.parent?.userData?.anatomyPart;

            if (partName && partName !== hoveredMesh) {
                hoveredMesh = partName;
                const label = EYE_ANATOMY_LABELS.find(l =>
                    l.name.toLowerCase().replace(/\s/g, '_') === partName ||
                    l.name.toLowerCase() === partName
                );
                if (label) {
                    tooltipEl.innerHTML = `<h5>${label.name}</h5><p>${label.description}</p>`;
                    tooltipEl.style.display = 'block';
                }
                renderer.domElement.style.cursor = 'pointer';
            }
        } else {
            if (hoveredMesh) {
                hoveredMesh = null;
                tooltipEl.style.display = 'none';
            }
            renderer.domElement.style.cursor = 'grab';
        }

        if (tooltipEl.style.display !== 'none') {
            tooltipEl.style.left = `${event.clientX + 15}px`;
            tooltipEl.style.top = `${event.clientY + 15}px`;
        }
    }

    function onMouseClick(event) {
        if (!eyeModel || !eyeModel.loaded) return;

        raycaster.setFromCamera(mouse, camera);
        const meshes = eyeModel.getAllMeshes();
        const intersects = raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            const partName = hit.userData.anatomyPart || hit.parent?.userData?.anatomyPart;
            if (partName) {
                eyeModel.highlightPart(partName, 0x00ffcc);
                setTimeout(() => eyeModel.unhighlightPart(partName), 1500);
            }
        }
    }

    function resetCamera() {
        gsap.to(camera.position, { x: 0, y: 0, z: 5, duration: 1.0, ease: "power2.inOut" });
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.0, ease: "power2.inOut" });
    }

    function setupWebXR() {
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
                if (supported) {
                    renderer.xr.enabled = true;
                    ui.showVRButton();

                    const startVR = async () => {
                        try {
                            const session = await navigator.xr.requestSession('immersive-vr', {
                                optionalFeatures: ['local-floor', 'bounded-floor']
                            });
                            renderer.xr.setSession(session);
                            session.addEventListener('end', () => renderer.xr.setSession(null));
                        } catch (e) {
                            console.warn('VR session failed:', e);
                        }
                    };

                    document.getElementById('btn-vr')?.addEventListener('click', startVR);
                    document.getElementById('btn-enter-vr')?.addEventListener('click', startVR);
                }
            });
        }
    }

    function onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (composer) composer.setSize(w, h);
    }

    function render() {
        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        controls.update();

        // Rotate ambient particles
        scene.traverse(obj => {
            if (obj.userData.isParticles) obj.rotation.y = elapsed * 0.02;
        });

        // Update debris particles (phaco aspiration effect)
        if (animations) animations.updateParticles(delta);

        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }

    window.addEventListener('DOMContentLoaded', init);

})();
