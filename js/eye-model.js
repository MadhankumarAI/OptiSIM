/* ============================================
   Eye Model - GLTF Loader + Procedural Fallback
   Loads downloaded models or builds a detailed
   procedural eye with separable parts.
   ============================================ */

class EyeModel {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.parts = {};          // Named mesh references
        this.originalState = {};   // Store original transforms for reset
        this.labels = [];
        this.loaded = false;
        this.modelSource = null;   // 'gltf' or 'procedural'

        this.scene.add(this.group);
    }

    /* ---- Try loading GLTF models, fallback to procedural ---- */
    async load(onProgress) {
        const modelPaths = [
            // User's downloaded models (actual file names)
            'assets/anatomy_of_the_eye.glb',
            'assets/realistic_human_eye.glb',
            'assets/eye-glb/source/OJO GLB.glb',
            // Common alternative paths
            'assets/eye-model/scene.gltf',
            'assets/eye-model/scene.glb',
            'assets/anatomy-of-the-eye/scene.gltf',
            'assets/anatomy-of-the-eye/scene.glb',
            'assets/realistic-human-eye/scene.gltf',
            'assets/realistic-human-eye/scene.glb',
            'assets/eye-glb/scene.gltf',
            'assets/eye-glb/scene.glb',
            'assets/eye.glb',
            'assets/eye.gltf',
            'assets/scene.gltf',
            'assets/scene.glb',
        ];

        if (onProgress) onProgress(10, 'Searching for 3D models...');

        for (const path of modelPaths) {
            try {
                if (onProgress) onProgress(20, `Trying ${path}...`);
                await this.loadGLTF(path, onProgress);
                this.modelSource = 'gltf';
                console.log(`Loaded GLTF model from: ${path}`);
                if (onProgress) onProgress(90, 'Model loaded!');
                this.loaded = true;
                this.saveOriginalState();
                return true;
            } catch (e) {
                // Model not found at this path, continue
            }
        }

        // No GLTF found — build procedural
        console.log('No GLTF model found, building procedural eye...');
        if (onProgress) onProgress(30, 'Building procedural eye model...');
        this.buildProceduralEye();
        this.modelSource = 'procedural';
        if (onProgress) onProgress(90, 'Procedural model ready!');
        this.loaded = true;
        this.saveOriginalState();
        return true;
    }

    /* ---- GLTF Loader ---- */
    loadGLTF(path, onProgress) {
        return new Promise((resolve, reject) => {
            // Use Three.js GLTFLoader via CDN (loaded in HTML)
            if (typeof THREE.GLTFLoader === 'undefined') {
                // Dynamically create a basic loader
                this.createBasicGLTFLoader();
            }

            const loader = new THREE.GLTFLoader();

            loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;

                    // Auto-detect and catalog parts
                    this.catalogGLTFParts(model);

                    // Normalize model size
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 3 / maxDim; // Normalize to ~3 units
                    model.scale.setScalar(scale);

                    // Center the model
                    box.setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center);

                    this.group.add(model);
                    this.gltfScene = model;

                    resolve(model);
                },
                (xhr) => {
                    if (onProgress && xhr.total) {
                        const pct = 20 + (xhr.loaded / xhr.total) * 60;
                        onProgress(pct, 'Loading 3D model...');
                    }
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    /* ---- Catalog GLTF parts by name ---- */
    catalogGLTFParts(model) {
        const nameMap = {
            // Exact names from anatomy_of_the_eye.glb (UMCG model)
            'cornea': ['cornea', 'Cornea', 'CORNEA', 'Cornea1', 'cornée'],
            'sclera': ['sclera', 'Sclera', 'SCLERA', 'sclérotique', 'white'],
            'iris': ['iris', 'Iris', 'IRIS', 'Bones10'],  // UMCG iris = Bones10
            'pupil': ['pupil', 'Pupil', 'PUPIL'],
            'lens': ['lens', 'Lens', 'LENS', 'crystallin', 'cristallin'],
            'retina': ['retina', 'Retina', 'RETINA', 'Optic_part_of_right_retina', 'rétine'],
            'choroid': ['choroid', 'Choroid', 'CHOROID', 'choroïde'],
            'vitreous': ['vitreous', 'Vitreous', 'vitré', 'vitreous_body', 'Glasvocht', 'glasvocht', 'humor'],
            'optic_nerve': ['optic_nerve', 'optic', 'nerve', 'Optic', 'Right_optic_nerve'],
            'zonules': ['zonule', 'Zonule', 'zonular', 'suspensory'],
            'capsule': ['capsule', 'Capsule', 'CAPSULE'],
            'anterior_chamber': ['anterior', 'Anterior_chamber', 'aqueous'],
            'posterior_chamber': ['posterior', 'Posterior_chamber'],
            'ciliary': ['ciliary', 'Ciliary', 'straalvormig_lichaam', 'straalvormig'],
            'conjunctiva': ['conjunctiva', 'Conjunctiva'],
            'skin': ['skin', 'Skin'],
            'eyelid': ['eyelid', 'lid', 'Eyelid', 'Tarsal_plate', 'tarsal'],
            'blood_vessel': ['vessel', 'blood', 'artery', 'vein', 'Retinal_veins', 'Retinal_arteries'],
            'lacrimal': ['lacrimal', 'Lacrimal', 'caniculus'],
            'muscle': ['muscle', 'Muscle', 'rectus', 'oblique'],
        };

        model.traverse((child) => {
            if (child.isMesh) {
                const name = (child.name || '').toLowerCase();

                // Try to match to known anatomy parts
                for (const [partKey, keywords] of Object.entries(nameMap)) {
                    for (const keyword of keywords) {
                        if (name.includes(keyword.toLowerCase())) {
                            if (!this.parts[partKey]) {
                                this.parts[partKey] = [];
                            }
                            this.parts[partKey].push(child);
                            child.userData.anatomyPart = partKey;
                            break;
                        }
                    }
                }

                // Make all parts interactive
                child.userData.isEyePart = true;

                // Store original material for highlighting
                if (child.material) {
                    child.userData.originalMaterial = child.material.clone();
                }
            }
        });

        console.log('Cataloged eye parts:', Object.keys(this.parts));
    }

    /* ---- Procedural Eye Model (Fallback) ---- */
    buildProceduralEye() {
        // Sclera (white outer shell)
        this.parts.sclera = [this.createSclera()];

        // Cornea (transparent front dome)
        this.parts.cornea = [this.createCornea()];

        // Iris (colored ring)
        this.parts.iris = [this.createIris()];

        // Pupil (black center)
        this.parts.pupil = [this.createPupil()];

        // Lens (behind iris)
        this.parts.lens = [this.createLens()];

        // Anterior capsule (thin membrane around lens)
        this.parts.capsule = [this.createCapsule()];

        // Retina (inner lining at back)
        this.parts.retina = [this.createRetina()];

        // Choroid (vascular layer)
        this.parts.choroid = [this.createChoroid()];

        // Vitreous body (gel interior)
        this.parts.vitreous = [this.createVitreous()];

        // Optic nerve
        this.parts.optic_nerve = [this.createOpticNerve()];

        // Zonular fibers
        this.parts.zonules = [this.createZonules()];

        // IOL (starts hidden, shown during implantation)
        this.parts.iol = [this.createIOL()];
        this.parts.iol[0].visible = false;

        // Blood vessels on sclera
        this.parts.blood_vessel = [this.createBloodVessels()];

        // Ciliary body
        this.parts.ciliary = [this.createCiliaryBody()];

        // Add all to group
        for (const partArray of Object.values(this.parts)) {
            for (const mesh of partArray) {
                this.group.add(mesh);
            }
        }
    }

    createSclera() {
        const geo = new THREE.SphereGeometry(1.2, 64, 64);
        const mat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.sclera,
            roughness: 0.6,
            metalness: 0.0,
            clearcoat: 0.3,
            clearcoatRoughness: 0.4,
            sheen: 0.5,
            sheenColor: new THREE.Color(0xffe8e0),
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'sclera';
        mesh.userData = { isEyePart: true, anatomyPart: 'sclera', originalMaterial: mat.clone() };

        // Flatten slightly at front for cornea attachment
        mesh.scale.z = 0.95;
        return mesh;
    }

    createCornea() {
        // Cornea is a transparent dome protruding from front
        const geo = new THREE.SphereGeometry(0.5, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2.5);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
            roughness: 0.0,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            transmission: 0.9,
            thickness: 0.1,
            ior: 1.376, // Real cornea IOR
            envMapIntensity: 1.5,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'cornea';
        mesh.userData = { isEyePart: true, anatomyPart: 'cornea', originalMaterial: mat.clone() };
        mesh.position.z = 0.85;
        mesh.rotation.x = Math.PI;
        return mesh;
    }

    createIris() {
        // Ring shape for iris
        const outerRadius = 0.45;
        const innerRadius = 0.15;
        const shape = new THREE.Shape();
        shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
        shape.holes.push(hole);

        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });

        // Create iris texture procedurally
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Iris pattern
        const centerX = 256, centerY = 256;
        const gradient = ctx.createRadialGradient(centerX, centerY, 40, centerX, centerY, 220);
        gradient.addColorStop(0, '#2a5e3f');
        gradient.addColorStop(0.3, '#4a8c6f');
        gradient.addColorStop(0.6, '#3d7a5c');
        gradient.addColorStop(0.8, '#5a9c7f');
        gradient.addColorStop(1, '#2d5a42');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        // Radial fibers
        ctx.strokeStyle = 'rgba(100, 180, 130, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 120; i++) {
            const angle = (i / 120) * Math.PI * 2;
            const innerR = 50 + Math.random() * 20;
            const outerR = 180 + Math.random() * 40;
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
            ctx.lineTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
            ctx.stroke();
        }

        // Collarette ring
        ctx.strokeStyle = 'rgba(200, 220, 200, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);

        const mat = new THREE.MeshPhysicalMaterial({
            map: texture,
            color: EYE_PART_COLORS.iris,
            roughness: 0.7,
            metalness: 0.1,
            clearcoat: 0.2,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'iris';
        mesh.userData = { isEyePart: true, anatomyPart: 'iris', originalMaterial: mat.clone() };
        mesh.position.z = 0.8;
        return mesh;
    }

    createPupil() {
        const geo = new THREE.CircleGeometry(0.15, 64);
        const mat = new THREE.MeshBasicMaterial({
            color: EYE_PART_COLORS.pupil,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'pupil';
        mesh.userData = { isEyePart: true, anatomyPart: 'pupil', originalMaterial: mat.clone() };
        mesh.position.z = 0.82;
        return mesh;
    }

    createLens() {
        // Biconvex lens shape using Lathe geometry
        const points = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const angle = t * Math.PI;
            const x = Math.sin(angle) * 0.38;
            const y = (Math.cos(angle) * 0.18);
            points.push(new THREE.Vector2(x, y));
        }
        const geo = new THREE.LatheGeometry(points, 64);
        const mat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.lens_cloudy, // Cataract = cloudy
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.0,
            clearcoat: 0.5,
            transmission: 0.4,
            thickness: 0.3,
            ior: 1.42, // Real lens IOR
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'lens';
        mesh.userData = { isEyePart: true, anatomyPart: 'lens', originalMaterial: mat.clone() };
        mesh.position.z = 0.5;
        mesh.rotation.x = Math.PI / 2;
        return mesh;
    }

    createCapsule() {
        // Thin transparent shell around lens
        const geo = new THREE.SphereGeometry(0.42, 48, 48);
        const mat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.capsule,
            transparent: true,
            opacity: 0.12,
            roughness: 0.2,
            metalness: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'capsule';
        mesh.userData = { isEyePart: true, anatomyPart: 'capsule', originalMaterial: mat.clone() };
        mesh.position.z = 0.5;
        mesh.scale.set(1, 1, 0.55);
        return mesh;
    }

    createRetina() {
        // Inner back hemisphere
        const geo = new THREE.SphereGeometry(1.1, 48, 48, 0, Math.PI * 2, Math.PI / 2.5, Math.PI);
        const mat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.retina,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.BackSide,
            emissive: 0x330000,
            emissiveIntensity: 0.15,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'retina';
        mesh.userData = { isEyePart: true, anatomyPart: 'retina', originalMaterial: mat.clone() };
        mesh.scale.z = 0.95;
        return mesh;
    }

    createChoroid() {
        const geo = new THREE.SphereGeometry(1.15, 48, 48, 0, Math.PI * 2, Math.PI / 3, Math.PI * 0.6);
        const mat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.choroid,
            roughness: 0.9,
            metalness: 0,
            side: THREE.BackSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'choroid';
        mesh.userData = { isEyePart: true, anatomyPart: 'choroid', originalMaterial: mat.clone() };
        mesh.scale.z = 0.95;
        return mesh;
    }

    createVitreous() {
        const geo = new THREE.SphereGeometry(1.05, 32, 32);
        const mat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.vitreous,
            transparent: true,
            opacity: 0.06,
            roughness: 0.0,
            metalness: 0.0,
            transmission: 0.95,
            thickness: 2.0,
            side: THREE.BackSide,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'vitreous';
        mesh.userData = { isEyePart: true, anatomyPart: 'vitreous', originalMaterial: mat.clone() };
        return mesh;
    }

    createOpticNerve() {
        // Cylinder extending from back of eye
        const geo = new THREE.CylinderGeometry(0.15, 0.12, 1.0, 32);
        const mat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.optic_nerve,
            roughness: 0.6,
            metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'optic_nerve';
        mesh.userData = { isEyePart: true, anatomyPart: 'optic_nerve', originalMaterial: mat.clone() };
        mesh.position.set(0, 0, -1.6);
        mesh.rotation.x = Math.PI / 2;
        return mesh;
    }

    createZonules() {
        // Thin fibers connecting ciliary body to lens
        const group = new THREE.Group();
        group.name = 'zonules';
        const mat = new THREE.MeshBasicMaterial({
            color: EYE_PART_COLORS.zonules,
            transparent: true,
            opacity: 0.5,
        });

        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const innerR = 0.38;
            const outerR = 0.6;
            const geo = new THREE.CylinderGeometry(0.005, 0.005, outerR - innerR, 4);

            const fiber = new THREE.Mesh(geo, mat);
            fiber.position.x = Math.cos(angle) * ((innerR + outerR) / 2);
            fiber.position.y = Math.sin(angle) * ((innerR + outerR) / 2);
            fiber.position.z = 0.5;
            fiber.lookAt(new THREE.Vector3(
                Math.cos(angle) * outerR * 1.5,
                Math.sin(angle) * outerR * 1.5,
                0.5
            ));
            group.add(fiber);
        }

        group.userData = { isEyePart: true, anatomyPart: 'zonules' };
        return group;
    }

    createIOL() {
        // Artificial intraocular lens — disc with haptics
        const group = new THREE.Group();
        group.name = 'iol';

        // Optic (central disc)
        const opticGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 64);
        const opticMat = new THREE.MeshPhysicalMaterial({
            color: EYE_PART_COLORS.iol,
            transparent: true,
            opacity: 0.35,
            roughness: 0.0,
            metalness: 0.1,
            clearcoat: 1.0,
            transmission: 0.8,
            thickness: 0.05,
            ior: 1.55,
        });
        const optic = new THREE.Mesh(opticGeo, opticMat);
        optic.rotation.x = Math.PI / 2;
        group.add(optic);

        // Haptics (C-shaped arms)
        const hapticMat = new THREE.MeshBasicMaterial({
            color: 0x8ecae6,
            transparent: true,
            opacity: 0.6,
        });

        for (let side = -1; side <= 1; side += 2) {
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(side * 0.28, 0, 0),
                new THREE.Vector3(side * 0.45, 0.15 * side, 0),
                new THREE.Vector3(side * 0.5, -0.1 * side, 0),
                new THREE.Vector3(side * 0.42, -0.25 * side, 0)
            );
            const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.008, 8, false);
            const haptic = new THREE.Mesh(tubeGeo, hapticMat);
            group.add(haptic);
        }

        group.position.z = 0.5;
        group.userData = { isEyePart: true, anatomyPart: 'iol' };
        return group;
    }

    createBloodVessels() {
        const group = new THREE.Group();
        group.name = 'blood_vessel';

        const vesselMat = new THREE.MeshBasicMaterial({
            color: 0xcc3333,
            transparent: true,
            opacity: 0.4,
        });

        // Create branching vessels on sclera surface
        for (let i = 0; i < 8; i++) {
            const startAngle = (i / 8) * Math.PI * 2;
            const points = [];
            let currentAngle = startAngle;
            let currentPhi = Math.PI / 3;

            for (let j = 0; j < 8; j++) {
                const r = 1.21;
                currentAngle += (Math.random() - 0.5) * 0.15;
                currentPhi += 0.08 + Math.random() * 0.05;
                points.push(new THREE.Vector3(
                    r * Math.sin(currentPhi) * Math.cos(currentAngle),
                    r * Math.sin(currentPhi) * Math.sin(currentAngle),
                    r * Math.cos(currentPhi)
                ));
            }

            const curve = new THREE.CatmullRomCurve3(points);
            const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.008 - i * 0.0005, 6, false);
            const vessel = new THREE.Mesh(tubeGeo, vesselMat);
            group.add(vessel);
        }

        group.userData = { isEyePart: true, anatomyPart: 'blood_vessel' };
        return group;
    }

    createCiliaryBody() {
        const geo = new THREE.TorusGeometry(0.55, 0.06, 16, 48);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x8b6b5a,
            roughness: 0.7,
            metalness: 0.0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'ciliary';
        mesh.userData = { isEyePart: true, anatomyPart: 'ciliary', originalMaterial: mat.clone() };
        mesh.position.z = 0.55;
        return mesh;
    }

    /* ---- Utility Methods ---- */

    saveOriginalState() {
        const saveTransform = (obj) => {
            if (obj.isMesh || obj.isGroup) {
                this.originalState[obj.uuid] = {
                    position: obj.position.clone(),
                    rotation: obj.rotation.clone(),
                    scale: obj.scale.clone(),
                    visible: obj.visible,
                    opacity: obj.material ? obj.material.opacity : undefined,
                };
            }
        };

        for (const partArray of Object.values(this.parts)) {
            for (const mesh of partArray) {
                saveTransform(mesh);
                if (mesh.isGroup) {
                    mesh.traverse(child => saveTransform(child));
                }
            }
        }
    }

    resetToOriginal() {
        const restoreTransform = (obj) => {
            const saved = this.originalState[obj.uuid];
            if (saved) {
                obj.position.copy(saved.position);
                obj.rotation.copy(saved.rotation);
                obj.scale.copy(saved.scale);
                obj.visible = saved.visible;
                if (obj.material && saved.opacity !== undefined) {
                    obj.material.opacity = saved.opacity;
                }
            }
        };

        for (const partArray of Object.values(this.parts)) {
            for (const mesh of partArray) {
                restoreTransform(mesh);
                if (mesh.isGroup) {
                    mesh.traverse(child => restoreTransform(child));
                }

                // Restore original material
                if (mesh.userData && mesh.userData.originalMaterial) {
                    mesh.material = mesh.userData.originalMaterial.clone();
                }
            }
        }
    }

    /* ---- Part Manipulation ---- */

    getPart(name) {
        return this.parts[name] || [];
    }

    setPartVisibility(name, visible) {
        const parts = this.getPart(name);
        parts.forEach(p => { p.visible = visible; });
    }

    setPartOpacity(name, opacity) {
        const parts = this.getPart(name);
        parts.forEach(p => {
            if (p.material) {
                p.material.transparent = true;
                p.material.opacity = opacity;
                p.material.needsUpdate = true;
            }
            if (p.isGroup) {
                p.traverse(child => {
                    if (child.material) {
                        child.material.transparent = true;
                        child.material.opacity = opacity;
                        child.material.needsUpdate = true;
                    }
                });
            }
        });
    }

    highlightPart(name, color) {
        const highlightColor = color || 0x00d4aa;
        const parts = this.getPart(name);
        parts.forEach(p => {
            if (p.material && p.material.emissive) {
                p.material.emissive = new THREE.Color(highlightColor);
                p.material.emissiveIntensity = 0.3;
            }
        });
    }

    unhighlightPart(name) {
        const parts = this.getPart(name);
        parts.forEach(p => {
            if (p.material && p.material.emissive) {
                p.material.emissive = new THREE.Color(0x000000);
                p.material.emissiveIntensity = 0;
            }
        });
    }

    unhighlightAll() {
        for (const name of Object.keys(this.parts)) {
            this.unhighlightPart(name);
        }
    }

    /* ---- Cross-section / Exploded View ---- */
    setExplodedView(amount) {
        // Move parts outward from center
        for (const [name, parts] of Object.entries(this.parts)) {
            const saved = this.originalState[parts[0]?.uuid];
            if (!saved) continue;

            parts.forEach(p => {
                const dir = saved.position.clone().normalize();
                if (dir.length() < 0.1) dir.set(0, 0, 1);
                p.position.copy(saved.position.clone().add(dir.multiplyScalar(amount)));
            });
        }
    }

    /* ---- Get all meshes for raycasting ---- */
    getAllMeshes() {
        const meshes = [];
        this.group.traverse(child => {
            if (child.isMesh) meshes.push(child);
        });
        return meshes;
    }

    dispose() {
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
}
