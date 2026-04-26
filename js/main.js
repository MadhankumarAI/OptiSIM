/* ============================================
   Main Entry Point - OptiSim
   Cinematic surgical simulation.
   ============================================ */

(function () {
    'use strict';

    let scene, camera, renderer, controls, composer;
    let eyeModel, surgicalTools, animations, ui, dragCards;
    let operatingRoom, audioSystem, envMap;
    let clock = new THREE.Clock();
    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    let hoveredMesh = null;
    let tooltipEl = null;
    let isPaused = false;

    async function init() {
        ui = new UIController();
        ui.updateLoading(5, 'Setting up 3D scene...');

        setupScene();
        setupCinematicLighting();

        ui.updateLoading(10, 'Building operating room...');
        operatingRoom = new OperatingRoom(scene);

        setupPostProcessing();
        setupTooltip();

        ui.updateLoading(15, 'Loading eye model...');

        // Load 3D eye model
        eyeModel = new EyeModel(scene);
        await eyeModel.load((pct, msg) => ui.updateLoading(pct, msg));

        // Apply env map to eye model for reflections
        if (envMap && eyeModel.group) {
            eyeModel.group.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.envMap = envMap;
                    child.material.envMapIntensity = 0.5;
                    child.material.needsUpdate = true;
                }
            });
        }

        // Hide skin/eyelid so we can see the eyeball
        eyeModel.setPartOpacity('skin', 0.0);
        eyeModel.setPartVisibility('skin', false);
        eyeModel.setPartOpacity('eyelid', 0.12);
        eyeModel.setPartOpacity('lacrimal', 0.15);

        // Add tear film — glossy transparent sphere for wet glistening look
        addTearFilm();

        ui.updateLoading(92, 'Building surgical instruments...');
        surgicalTools = new SurgicalTools(scene);

        ui.updateLoading(94, 'Setting up audio...');
        audioSystem = new AudioSystem();

        ui.updateLoading(95, 'Initializing simulation...');
        animations = new SurgeryAnimations(eyeModel, surgicalTools, scene);

        ui.init();

        // Wire: step changes -> build sub-steps
        ui.onStepChange = (stepId) => {
            const subSteps = animations.buildSubSteps(stepId, camera, controls);
            if (dragCards) dragCards.clearAll();
            return subSteps;
        };

        ui.onSubStepChange = (subStepIndex) => {
            animations.playSubStep(subStepIndex);
            if (audioSystem && audioSystem.enabled) audioSystem.playToolContact();
        };

        // Draggable complication cards
        dragCards = new DraggableCards(document.body);
        dragCards.onCardClick = (stepId, compIndex) => {
            if (compIndex === -1) {
                animations.hideComplication();
                animations.playSubStep(ui.currentSubStep);
            } else {
                animations.showComplication(stepId, compIndex);
                if (audioSystem) audioSystem.playWarning();
            }
        };

        ui.onComplicationClick = (stepId, compIndex) => {
            if (compIndex === -1) {
                animations.hideComplication();
                animations.playSubStep(ui.currentSubStep);
            } else {
                animations.showComplication(stepId, compIndex);
                dragCards.spawnCard(stepId, compIndex);
                if (audioSystem) audioSystem.playWarning();
            }
        };

        document.getElementById('btn-toggle-complications').addEventListener('click', () => {
            if (dragCards.cards.length > 0) {
                dragCards.clearAll();
                animations.hideComplication();
            } else {
                dragCards.spawnAllForStep(ui.currentStep);
            }
        });

        document.getElementById('btn-reset-view').addEventListener('click', () => {
            resetCamera();
            const subSteps = animations.buildSubSteps(ui.currentStep, camera, controls);
            ui.subSteps = subSteps;
            ui.buildSubStepTimeline();
            if (subSteps.length > 0) ui.goToSubStep(0);
        });

        const pauseBtn = document.getElementById('btn-pause');
        if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

        const audioBtn = document.getElementById('btn-audio');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                if (!audioSystem.initialized) {
                    audioSystem.init().then(() => {
                        audioSystem.startAmbience();
                        audioBtn.classList.add('active');
                    });
                } else {
                    audioSystem.enabled = !audioSystem.enabled;
                    audioBtn.classList.toggle('active', audioSystem.enabled);
                    if (audioSystem.enabled) audioSystem.startAmbience();
                    else audioSystem.stopAmbience();
                }
            });
        }

        setupWebXR();

        ui.updateLoading(100, 'Ready!');
        setTimeout(() => ui.hideLoading(), 500);

        document.addEventListener('click', () => {
            if (audioSystem && !audioSystem.initialized) {
                audioSystem.init().then(() => audioSystem.startAmbience());
            }
        }, { once: true });

        renderer.setAnimationLoop(render);
    }

    function togglePause() {
        isPaused = !isPaused;
        const btn = document.getElementById('btn-pause');
        if (btn) {
            btn.querySelector('i').className = isPaused ? 'fas fa-play' : 'fas fa-pause';
            btn.title = isPaused ? 'Resume' : 'Pause';
        }
        if (isPaused) gsap.globalTimeline.pause();
        else gsap.globalTimeline.resume();
    }

    function setupScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e18);
        // NO fog — we want everything crisp and visible

        // Tighter FOV for intimate surgical close-up feel
        camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0.3, 4);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        document.getElementById('canvas-container').appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.rotateSpeed = 0.7;
        controls.zoomSpeed = 0.5;
        controls.minDistance = 1.5;
        controls.maxDistance = 10;
        controls.target.set(0, 0, 0);
        controls.update();

        window.addEventListener('resize', onResize);
        renderer.domElement.addEventListener('mousemove', onMouseMove);
        renderer.domElement.addEventListener('click', onMouseClick);

        // Generate a procedural environment cubemap for reflections
        envMap = generateEnvMap(renderer);
        if (envMap) scene.environment = envMap;
    }

    /* ---- Generate procedural environment cubemap ---- */
    function generateEnvMap(renderer) {
        try {
            const pmremGenerator = new THREE.PMREMGenerator(renderer);
            pmremGenerator.compileEquirectangularShader();

            // Simple lit scene for the env map
            const envScene = new THREE.Scene();
            envScene.background = new THREE.Color(0x1a2a3a);

            // Big emitting sphere (surgical lamp reflection)
            const lightSphere = new THREE.Mesh(
                new THREE.SphereGeometry(2, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0xfff5e6 })
            );
            lightSphere.position.set(0, 10, 5);
            envScene.add(lightSphere);

            // Cool blue side
            const blueSphere = new THREE.Mesh(
                new THREE.SphereGeometry(3, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0x4488bb })
            );
            blueSphere.position.set(-10, 3, 0);
            envScene.add(blueSphere);

            // Warm side
            const warmSphere = new THREE.Mesh(
                new THREE.SphereGeometry(2, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0xffddaa })
            );
            warmSphere.position.set(10, 2, 2);
            envScene.add(warmSphere);

            // Floor reflection
            const floorPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(50, 50),
                new THREE.MeshBasicMaterial({ color: 0x0c1520 })
            );
            floorPlane.rotation.x = -Math.PI / 2;
            floorPlane.position.y = -5;
            envScene.add(floorPlane);

            const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
            pmremGenerator.dispose();

            // Clean up
            envScene.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });

            return renderTarget.texture;
        } catch (e) {
            console.warn('Failed to generate env map:', e);
            return null;
        }
    }

    /* ---- "THE GOOD DOCTOR" CINEMATIC LIGHTING ---- */
    function setupCinematicLighting() {
        // Dimmer ambient — surgical scenes should be darker
        scene.add(new THREE.AmbientLight(0x1a2535, 0.22));

        // Subtle hemisphere
        scene.add(new THREE.HemisphereLight(0x4466aa, 0x442211, 0.12));

        // KEY: Warm surgical lamp (toned down)
        const keyLight = new THREE.DirectionalLight(0xffe8c8, 0.6);
        keyLight.position.set(0.3, 5, 2.5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.bias = -0.0005;
        scene.add(keyLight);

        // FILL: Cool blue (softer)
        const fillLight = new THREE.DirectionalLight(0x4477aa, 0.2);
        fillLight.position.set(-4, 1.5, 1);
        scene.add(fillLight);

        // RIM: Teal edge light (subtle)
        const rimLight = new THREE.DirectionalLight(0x00ccaa, 0.18);
        rimLight.position.set(0, 0, -4);
        scene.add(rimLight);

        // SPECULAR: Cornea highlight (gentler)
        const eyeSpecular = new THREE.PointLight(0xffffff, 0.35, 6, 2);
        eyeSpecular.position.set(0.5, 1.5, 3);
        scene.add(eyeSpecular);

        // SURGICAL SPOT: Operating light (toned down)
        const surgicalSpot = new THREE.SpotLight(0xffeedd, 0.7, 10, Math.PI / 7, 0.4, 1);
        surgicalSpot.position.set(0, 4, 2);
        surgicalSpot.target.position.set(0, 0, 0);
        surgicalSpot.castShadow = true;
        surgicalSpot.shadow.mapSize.set(1024, 1024);
        scene.add(surgicalSpot);
        scene.add(surgicalSpot.target);

        // ACCENT (gentler)
        const accentLight = new THREE.PointLight(0xffaa66, 0.08, 5, 2);
        accentLight.position.set(2, -0.5, 2);
        scene.add(accentLight);
    }

    function setupPostProcessing() {
        try {
            composer = new THREE.EffectComposer(renderer);
            composer.addPass(new THREE.RenderPass(scene, camera));

            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.25,  // strength — subtle glow only
                0.6,   // radius
                0.9    // threshold — only the brightest spots bloom
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
                if (audioSystem && audioSystem.enabled) audioSystem.playToolContact();
            }
        }
    }

    /* ---- Tear film: wet sheen over the whole eye ---- */
    function addTearFilm() {
        // Find the bounding sphere of the eye model to match size
        const box = new THREE.Box3().setFromObject(eyeModel.group);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);

        const tearGeo = new THREE.SphereGeometry(sphere.radius * 1.02, 64, 64);
        const tearMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.04,
            roughness: 0.0,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            envMapIntensity: 1.5,
            side: THREE.FrontSide,
            depthWrite: false,
        });
        if (envMap) tearMat.envMap = envMap;

        const tearFilm = new THREE.Mesh(tearGeo, tearMat);
        tearFilm.position.copy(sphere.center).sub(eyeModel.group.position);
        eyeModel.group.add(tearFilm);
    }

    function resetCamera() {
        gsap.to(camera.position, { x: 0, y: 0.3, z: 4, duration: 1.0, ease: "power2.inOut" });
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
                        } catch (e) { console.warn('VR session failed:', e); }
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

        if (isPaused) {
            if (composer) composer.render();
            else renderer.render(scene, camera);
            return;
        }

        controls.update();

        if (operatingRoom) operatingRoom.update(elapsed);
        if (animations) animations.updateParticles(delta);

        if (composer) composer.render();
        else renderer.render(scene, camera);
    }

    window.addEventListener('DOMContentLoaded', init);

})();
