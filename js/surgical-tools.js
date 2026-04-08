/* ============================================
   Surgical Tools - 3D instrument models
   Real tools that appear and interact with
   the eye model during each procedure step.
   ============================================ */

class SurgicalTools {
    constructor(scene) {
        this.scene = scene;
        this.tools = {};
        this.activeTool = null;
        this.buildAllTools();
    }

    buildAllTools() {
        this.tools.keratome = this.buildKeratome();
        this.tools.sideport_blade = this.buildSideportBlade();
        this.tools.cystotome = this.buildCystotome();
        this.tools.forceps = this.buildForceps();
        this.tools.phaco_probe = this.buildPhacoProbe();
        this.tools.ia_handpiece = this.buildIAHandpiece();
        this.tools.iol_injector = this.buildIOLInjector();
        this.tools.sinskey_hook = this.buildSinskeyHook();
        this.tools.syringe = this.buildSyringe();
        this.tools.speculum = this.buildSpeculum();
        this.tools.cannula = this.buildCannula();

        // Hide all tools initially
        for (const tool of Object.values(this.tools)) {
            tool.visible = false;
            this.scene.add(tool);
        }
    }

    showTool(name) {
        this.hideAll();
        if (this.tools[name]) {
            this.tools[name].visible = true;
            this.activeTool = this.tools[name];
        }
        return this.tools[name];
    }

    hideAll() {
        for (const tool of Object.values(this.tools)) {
            tool.visible = false;
        }
        this.activeTool = null;
    }

    getTool(name) {
        return this.tools[name];
    }

    /* ---- Shared materials ---- */
    get steelMat() {
        return new THREE.MeshPhysicalMaterial({
            color: 0xc0c8d0,
            metalness: 0.9,
            roughness: 0.15,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.5,
        });
    }

    get handleMat() {
        return new THREE.MeshPhysicalMaterial({
            color: 0x3a4a5c,
            metalness: 0.7,
            roughness: 0.3,
        });
    }

    get bladeMat() {
        return new THREE.MeshPhysicalMaterial({
            color: 0xe8eef5,
            metalness: 1.0,
            roughness: 0.05,
            clearcoat: 1.0,
        });
    }

    get plasticMat() {
        return new THREE.MeshPhysicalMaterial({
            color: 0x4a90d9,
            metalness: 0.0,
            roughness: 0.4,
            clearcoat: 0.3,
        });
    }

    get tubeMat() {
        return new THREE.MeshPhysicalMaterial({
            color: 0xd0d8e0,
            metalness: 0.3,
            roughness: 0.5,
            transparent: true,
            opacity: 0.85,
        });
    }

    /* ---- Keratome (corneal incision blade) ---- */
    buildKeratome() {
        const group = new THREE.Group();
        group.name = 'keratome';

        // Handle
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.03, 1.8, 16),
            this.handleMat
        );
        handle.position.y = 0.9;
        group.add(handle);

        // Blade - diamond/trapezoidal shape
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, 0);
        bladeShape.lineTo(0.06, 0.03);
        bladeShape.lineTo(0.15, 0);
        bladeShape.lineTo(0.06, -0.03);
        bladeShape.closePath();

        const blade = new THREE.Mesh(
            new THREE.ExtrudeGeometry(bladeShape, { depth: 0.003, bevelEnabled: false }),
            this.bladeMat
        );
        blade.position.set(-0.02, -0.01, -0.0015);
        group.add(blade);

        // Blade tip glow
        const tipGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.008, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x00d4aa, transparent: true, opacity: 0.6 })
        );
        tipGlow.position.set(0.13, 0, 0);
        group.add(tipGlow);

        return group;
    }

    /* ---- Side-port blade ---- */
    buildSideportBlade() {
        const group = new THREE.Group();
        group.name = 'sideport_blade';

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.025, 1.5, 12),
            this.handleMat
        );
        handle.position.y = 0.75;
        group.add(handle);

        // Thin pointed blade
        const bladeGeo = new THREE.ConeGeometry(0.015, 0.12, 4);
        const blade = new THREE.Mesh(bladeGeo, this.bladeMat);
        blade.rotation.z = -Math.PI / 2;
        blade.position.set(0.06, 0, 0);
        group.add(blade);

        return group;
    }

    /* ---- Cystotome needle (capsulorhexis) ---- */
    buildCystotome() {
        const group = new THREE.Group();
        group.name = 'cystotome';

        // Syringe body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 1.4, 16),
            this.plasticMat
        );
        body.position.y = 0.7;
        group.add(body);

        // Bent needle tip
        const needleCurve = new THREE.CubicBezierCurve3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.05, 0, 0),
            new THREE.Vector3(0.1, -0.02, 0),
            new THREE.Vector3(0.12, -0.05, 0)
        );
        const needle = new THREE.Mesh(
            new THREE.TubeGeometry(needleCurve, 20, 0.004, 8, false),
            this.steelMat
        );
        group.add(needle);

        // Bent tip point
        const tipPoint = new THREE.Mesh(
            new THREE.ConeGeometry(0.006, 0.02, 6),
            this.bladeMat
        );
        tipPoint.position.set(0.12, -0.06, 0);
        group.add(tipPoint);

        return group;
    }

    /* ---- Utrata forceps (capsulorhexis) ---- */
    buildForceps() {
        const group = new THREE.Group();
        group.name = 'forceps';

        // Two prongs
        for (let side = -1; side <= 1; side += 2) {
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(0, side * 0.02, 0),
                new THREE.Vector3(0.5, side * 0.015, 0),
                new THREE.Vector3(1.0, side * 0.005, 0),
                new THREE.Vector3(1.2, side * 0.002, 0)
            );
            const prong = new THREE.Mesh(
                new THREE.TubeGeometry(curve, 30, 0.006, 8, false),
                this.steelMat
            );
            group.add(prong);

            // Small grip teeth at tip
            const tooth = new THREE.Mesh(
                new THREE.BoxGeometry(0.015, 0.003, 0.008),
                this.steelMat
            );
            tooth.position.set(1.2, side * 0.002, 0);
            group.add(tooth);
        }

        // Handle rings
        for (let i = 0; i < 2; i++) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.04, 0.008, 8, 16),
                this.handleMat
            );
            ring.position.set(-0.1, (i === 0 ? 0.06 : -0.06), 0);
            group.add(ring);
        }

        group.scale.set(0.8, 0.8, 0.8);
        return group;
    }

    /* ---- Phacoemulsification probe ---- */
    buildPhacoProbe() {
        const group = new THREE.Group();
        group.name = 'phaco_probe';

        // Main handpiece body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.035, 1.6, 16),
            this.handleMat
        );
        body.position.y = 0.8;
        group.add(body);

        // Silicone sleeve (around tip)
        const sleeve = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.015, 0.25, 12),
            this.tubeMat
        );
        sleeve.position.y = -0.05;
        group.add(sleeve);

        // Titanium needle tip
        const tip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.003, 0.15, 8),
            this.steelMat
        );
        tip.position.y = -0.18;
        group.add(tip);

        // Aspiration port (small hole at tip end)
        const port = new THREE.Mesh(
            new THREE.RingGeometry(0.001, 0.004, 8),
            new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
        );
        port.position.y = -0.255;
        port.rotation.x = Math.PI / 2;
        group.add(port);

        // Tubing coming from back
        const tubeCurve = new THREE.CubicBezierCurve3(
            new THREE.Vector3(0, 1.6, 0),
            new THREE.Vector3(0.2, 1.8, 0),
            new THREE.Vector3(0.4, 2.0, -0.1),
            new THREE.Vector3(0.5, 2.2, -0.2)
        );
        const tubing = new THREE.Mesh(
            new THREE.TubeGeometry(tubeCurve, 20, 0.012, 8, false),
            this.tubeMat
        );
        group.add(tubing);

        // Ultrasound vibration indicator (glowing ring)
        const vibeRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.012, 0.003, 8, 16),
            new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.8 })
        );
        vibeRing.position.y = -0.1;
        vibeRing.rotation.x = Math.PI / 2;
        vibeRing.name = 'vibe_indicator';
        group.add(vibeRing);

        return group;
    }

    /* ---- Irrigation/Aspiration handpiece ---- */
    buildIAHandpiece() {
        const group = new THREE.Group();
        group.name = 'ia_handpiece';

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.03, 1.4, 16),
            this.handleMat
        );
        body.position.y = 0.7;
        group.add(body);

        // Silicone tip with port
        const tip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.008, 0.2, 12),
            this.tubeMat
        );
        tip.position.y = -0.05;
        group.add(tip);

        // Side aspiration port
        const portGeo = new THREE.BoxGeometry(0.008, 0.02, 0.004);
        const port = new THREE.Mesh(portGeo, new THREE.MeshBasicMaterial({ color: 0x222222 }));
        port.position.set(0.012, -0.1, 0);
        group.add(port);

        // Dual tubing
        for (let side = -1; side <= 1; side += 2) {
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(side * 0.02, 1.4, 0),
                new THREE.Vector3(side * 0.1, 1.6, 0),
                new THREE.Vector3(side * 0.15, 1.9, -0.1),
                new THREE.Vector3(side * 0.2, 2.1, -0.2)
            );
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(curve, 15, 0.008, 8, false),
                this.tubeMat
            );
            group.add(tube);
        }

        return group;
    }

    /* ---- IOL Injector ---- */
    buildIOLInjector() {
        const group = new THREE.Group();
        group.name = 'iol_injector';

        // Main barrel
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.04, 2.0, 16),
            this.plasticMat
        );
        barrel.position.y = 1.0;
        group.add(barrel);

        // Plunger handle
        const plunger = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16),
            new THREE.MeshPhysicalMaterial({ color: 0x3a7ad9, roughness: 0.3 })
        );
        plunger.position.y = 2.05;
        plunger.name = 'plunger';
        group.add(plunger);

        // Cartridge tip (where IOL exits)
        const cartridge = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.01, 0.3, 12),
            new THREE.MeshPhysicalMaterial({
                color: 0xe0e8f0,
                transparent: true,
                opacity: 0.7,
                roughness: 0.1,
            })
        );
        cartridge.position.y = -0.1;
        group.add(cartridge);

        // IOL visible inside cartridge
        const iolInside = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.02, 16),
            new THREE.MeshPhysicalMaterial({
                color: 0xc0e0ff,
                transparent: true,
                opacity: 0.5,
                clearcoat: 1.0,
            })
        );
        iolInside.position.y = -0.05;
        iolInside.name = 'iol_inside';
        group.add(iolInside);

        return group;
    }

    /* ---- Sinskey Hook ---- */
    buildSinskeyHook() {
        const group = new THREE.Group();
        group.name = 'sinskey_hook';

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.025, 1.5, 12),
            this.handleMat
        );
        handle.position.y = 0.75;
        group.add(handle);

        // Hook curve
        const hookCurve = new THREE.CubicBezierCurve3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.06, -0.02, 0),
            new THREE.Vector3(0.08, -0.06, 0),
            new THREE.Vector3(0.05, -0.08, 0)
        );
        const hook = new THREE.Mesh(
            new THREE.TubeGeometry(hookCurve, 20, 0.004, 8, false),
            this.steelMat
        );
        group.add(hook);

        return group;
    }

    /* ---- Syringe (for viscoelastic/anesthetic) ---- */
    buildSyringe() {
        const group = new THREE.Group();
        group.name = 'syringe';

        // Barrel
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 1.2, 16),
            new THREE.MeshPhysicalMaterial({
                color: 0xe8f0f8,
                transparent: true,
                opacity: 0.6,
                roughness: 0.1,
            })
        );
        barrel.position.y = 0.6;
        group.add(barrel);

        // Fluid inside
        const fluid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.032, 0.8, 16),
            new THREE.MeshPhysicalMaterial({
                color: 0xd0e8ff,
                transparent: true,
                opacity: 0.4,
                roughness: 0.0,
            })
        );
        fluid.position.y = 0.4;
        fluid.name = 'fluid';
        group.add(fluid);

        // Plunger
        const plunger = new THREE.Mesh(
            new THREE.CylinderGeometry(0.033, 0.033, 0.05, 16),
            this.handleMat
        );
        plunger.position.y = 1.22;
        plunger.name = 'plunger';
        group.add(plunger);

        // Needle
        const needle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.003, 0.002, 0.2, 8),
            this.steelMat
        );
        needle.position.y = -0.1;
        group.add(needle);

        return group;
    }

    /* ---- Lid Speculum ---- */
    buildSpeculum() {
        const group = new THREE.Group();
        group.name = 'speculum';

        // Two wire arms
        for (let side = -1; side <= 1; side += 2) {
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0.3, side * 0.15, 0),
                new THREE.Vector3(0.5, side * 0.4, 0.05),
                new THREE.Vector3(0.4, side * 0.55, 0.1)
            );
            const arm = new THREE.Mesh(
                new THREE.TubeGeometry(curve, 25, 0.008, 8, false),
                this.steelMat
            );
            group.add(arm);

            // Curved retractor blades at end
            const bladeCurve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(0.4, side * 0.55, 0.1),
                new THREE.Vector3(0.35, side * 0.6, 0.15),
                new THREE.Vector3(0.25, side * 0.6, 0.2),
                new THREE.Vector3(0.2, side * 0.55, 0.2)
            );
            const blade = new THREE.Mesh(
                new THREE.TubeGeometry(bladeCurve, 15, 0.012, 8, false),
                this.steelMat
            );
            group.add(blade);
        }

        // Screw mechanism at base
        const screw = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.06, 12),
            this.handleMat
        );
        screw.rotation.z = Math.PI / 2;
        group.add(screw);

        return group;
    }

    /* ---- BSS Cannula ---- */
    buildCannula() {
        const group = new THREE.Group();
        group.name = 'cannula';

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.8, 12),
            this.plasticMat
        );
        handle.position.y = 0.4;
        group.add(handle);

        // Thin cannula tube
        const tube = new THREE.Mesh(
            new THREE.CylinderGeometry(0.005, 0.004, 0.4, 8),
            this.steelMat
        );
        tube.position.y = -0.15;
        group.add(tube);

        return group;
    }
}
