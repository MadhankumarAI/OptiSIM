/* ============================================
   Operating Room Environment
   Realistic surgical setting with equipment,
   surgical lamp rig, walls, and ambient detail.
   ============================================ */

class OperatingRoom {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'operating_room';
        this.scene.add(this.group);

        this.lights = {};
        this.build();
    }

    build() {
        this.buildFloor();
        this.buildWalls();
        this.buildSurgicalLamp();
        this.buildOperatingTable();
        this.buildEquipmentCart();
        this.buildMonitor();
        this.buildIVStand();
        this.buildCeilingGrid();
    }

    /* ---- Floor ---- */
    buildFloor() {
        const geo = new THREE.PlaneGeometry(20, 20);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x1a2a3a,
            roughness: 0.3,
            metalness: 0.1,
            clearcoat: 0.6,
            clearcoatRoughness: 0.3,
        });
        const floor = new THREE.Mesh(geo, mat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -2.5;
        floor.receiveShadow = true;
        this.group.add(floor);

        // Reflective floor grid lines
        for (let i = -10; i <= 10; i += 2) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i, -2.49, -10),
                new THREE.Vector3(i, -2.49, 10),
            ]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x1e3a4f, transparent: true, opacity: 0.3 });
            this.group.add(new THREE.Line(lineGeo, lineMat));

            const lineGeo2 = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-10, -2.49, i),
                new THREE.Vector3(10, -2.49, i),
            ]);
            this.group.add(new THREE.Line(lineGeo2, lineMat));
        }
    }

    /* ---- Walls (subtle, dark) ---- */
    buildWalls() {
        const wallMat = new THREE.MeshPhysicalMaterial({
            color: 0x0e1a28,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.BackSide,
        });

        // Back wall
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), wallMat);
        backWall.position.set(0, 1.5, -8);
        this.group.add(backWall);

        // Side walls
        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), wallMat);
        leftWall.position.set(-8, 1.5, 0);
        leftWall.rotation.y = Math.PI / 2;
        this.group.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), wallMat);
        rightWall.position.set(8, 1.5, 0);
        rightWall.rotation.y = -Math.PI / 2;
        this.group.add(rightWall);
    }

    /* ---- Surgical Lamp (overhead articulated arm) ---- */
    buildSurgicalLamp() {
        const steelMat = new THREE.MeshPhysicalMaterial({
            color: 0xd0d8e0,
            metalness: 0.85,
            roughness: 0.15,
        });

        // Ceiling mount
        const mount = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16),
            steelMat
        );
        mount.position.set(0, 5, 1);
        this.group.add(mount);

        // Articulated arm
        const arm1 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8),
            steelMat
        );
        arm1.position.set(0, 4.3, 1);
        this.group.add(arm1);

        // Joint
        const joint = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 12, 12),
            steelMat
        );
        joint.position.set(0, 3.6, 1);
        this.group.add(joint);

        // Angled arm
        const arm2 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
            steelMat
        );
        arm2.position.set(0, 3.2, 1.5);
        arm2.rotation.x = 0.4;
        this.group.add(arm2);

        // Lamp head (circular surgical light)
        const lampHead = new THREE.Group();
        lampHead.position.set(0, 2.8, 2);

        // Outer ring
        const outerRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.4, 0.05, 12, 32),
            steelMat
        );
        outerRing.rotation.x = Math.PI / 2;
        lampHead.add(outerRing);

        // Light panel (emissive disc)
        const lightPanel = new THREE.Mesh(
            new THREE.CircleGeometry(0.38, 32),
            new THREE.MeshBasicMaterial({
                color: 0xfff8f0,
                transparent: true,
                opacity: 0.9,
            })
        );
        lightPanel.rotation.x = Math.PI / 2;
        lightPanel.position.y = -0.02;
        lampHead.add(lightPanel);

        // Handle bars
        for (let angle of [0, Math.PI]) {
            const handleBar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8),
                steelMat
            );
            handleBar.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
            handleBar.rotation.z = Math.PI / 2;
            lampHead.add(handleBar);
        }

        this.group.add(lampHead);

        // Actual light from lamp — main surgical illumination
        const surgicalLight = new THREE.SpotLight(0xfff5e6, 0.4, 12, Math.PI / 5, 0.6, 1);
        surgicalLight.position.set(0, 2.75, 2);
        surgicalLight.target.position.set(0, 0, 0);
        surgicalLight.castShadow = true;
        surgicalLight.shadow.mapSize.set(2048, 2048);
        surgicalLight.shadow.camera.near = 0.5;
        surgicalLight.shadow.camera.far = 10;
        surgicalLight.shadow.bias = -0.001;
        this.scene.add(surgicalLight);
        this.scene.add(surgicalLight.target);
        this.lights.surgical = surgicalLight;

        // Secondary focused microscope light
        const microLight = new THREE.SpotLight(0xffffff, 0.25, 8, Math.PI / 12, 0.3, 1);
        microLight.position.set(0, 3.5, 2.5);
        microLight.target.position.set(0, 0, 0);
        microLight.castShadow = true;
        microLight.shadow.mapSize.set(1024, 1024);
        this.scene.add(microLight);
        this.scene.add(microLight.target);
        this.lights.microscope = microLight;
    }

    /* ---- Operating Table ---- */
    buildOperatingTable() {
        const tableMat = new THREE.MeshPhysicalMaterial({
            color: 0x2a3a4a,
            roughness: 0.4,
            metalness: 0.3,
        });

        // Table top
        const top = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.08, 3),
            tableMat
        );
        top.position.set(0, -2.2, 0);
        top.receiveShadow = true;
        this.group.add(top);

        // Headrest
        const headrest = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.05, 0.5),
            new THREE.MeshPhysicalMaterial({ color: 0x1a2a3a, roughness: 0.6 })
        );
        headrest.position.set(0, -2.13, 0);
        this.group.add(headrest);

        // Table legs
        const legMat = new THREE.MeshPhysicalMaterial({ color: 0x3a4a5a, metalness: 0.7, roughness: 0.3 });
        const legPositions = [[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.8], [0.6, 0.8]];
        for (const [x, z] of legPositions) {
            const leg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
                legMat
            );
            leg.position.set(x, -2.38, z);
            this.group.add(leg);
        }
    }

    /* ---- Equipment Cart ---- */
    buildEquipmentCart() {
        const cartMat = new THREE.MeshPhysicalMaterial({
            color: 0x2a3545,
            roughness: 0.5,
            metalness: 0.4,
        });

        // Cart body
        const cart = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.0, 0.5),
            cartMat
        );
        cart.position.set(3, -1.7, 1);
        cart.castShadow = true;
        this.group.add(cart);

        // Wheels
        const wheelMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        for (const [dx, dz] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) {
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12),
                wheelMat
            );
            wheel.position.set(3 + dx, -2.25, 1 + dz);
            wheel.rotation.z = Math.PI / 2;
            this.group.add(wheel);
        }

        // Indicator light
        const indicator = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x00ff88 })
        );
        indicator.position.set(3, -1.15, 1.26);
        this.group.add(indicator);

        // Small green glow
        const glow = new THREE.PointLight(0x00ff88, 0.1, 1);
        glow.position.copy(indicator.position);
        this.group.add(glow);
    }

    /* ---- Monitor ---- */
    buildMonitor() {
        // Monitor frame
        const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a2a, roughness: 0.3, metalness: 0.5 });
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.8, 0.05),
            frameMat
        );
        frame.position.set(-3.5, 0.5, -2);
        frame.rotation.y = 0.4;
        this.group.add(frame);

        // Screen
        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(1.1, 0.7),
            new THREE.MeshBasicMaterial({
                color: 0x1a4080,
            })
        );
        screen.position.set(-3.5, 0.5, -1.97);
        screen.rotation.y = 0.4;
        this.group.add(screen);

        // Monitor stand
        const stand = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.05, 1.5, 8),
            frameMat
        );
        stand.position.set(-3.5, -0.35, -2.05);
        this.group.add(stand);

        // Subtle screen glow
        const screenLight = new THREE.PointLight(0x1a4080, 0.3, 3);
        screenLight.position.set(-3.3, 0.5, -1.5);
        this.group.add(screenLight);
    }

    /* ---- IV Stand ---- */
    buildIVStand() {
        const steelMat = new THREE.MeshPhysicalMaterial({ color: 0xc0c8d0, metalness: 0.8, roughness: 0.2 });

        // Pole
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 3, 8),
            steelMat
        );
        pole.position.set(2, 0, -2);
        this.group.add(pole);

        // Cross arms at top
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            const arm = new THREE.Mesh(
                new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6),
                steelMat
            );
            arm.position.set(
                2 + Math.cos(angle) * 0.15,
                1.45,
                -2 + Math.sin(angle) * 0.15
            );
            arm.rotation.z = Math.PI / 2;
            arm.rotation.y = angle;
            this.group.add(arm);
        }

        // IV bag (translucent)
        const bag = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.25, 0.06),
            new THREE.MeshPhysicalMaterial({
                color: 0xd0e8ff,
                transparent: true,
                opacity: 0.4,
                roughness: 0.1,
            })
        );
        bag.position.set(2.15, 1.2, -2);
        this.group.add(bag);

        // Tube from bag
        const tubeCurve = new THREE.CubicBezierCurve3(
            new THREE.Vector3(2.15, 1.05, -2),
            new THREE.Vector3(2.15, 0.5, -1.5),
            new THREE.Vector3(1, -0.5, -1),
            new THREE.Vector3(0.5, -1.5, 0)
        );
        const tube = new THREE.Mesh(
            new THREE.TubeGeometry(tubeCurve, 30, 0.008, 8, false),
            new THREE.MeshPhysicalMaterial({ color: 0xd0d8e0, transparent: true, opacity: 0.5, roughness: 0.3 })
        );
        this.group.add(tube);
    }

    /* ---- Ceiling grid ---- */
    buildCeilingGrid() {
        const ceilingMat = new THREE.MeshPhysicalMaterial({
            color: 0x0c1520,
            roughness: 0.9,
            side: THREE.BackSide,
        });
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            ceilingMat
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 5.5;
        this.group.add(ceiling);

        // Ceiling light panels (ambient fluorescent)
        for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
            const panel = new THREE.Mesh(
                new THREE.PlaneGeometry(1.2, 0.6),
                new THREE.MeshBasicMaterial({
                    color: 0x4a6a8a,
                    transparent: true,
                    opacity: 0.15,
                })
            );
            panel.rotation.x = Math.PI / 2;
            panel.position.set(x, 5.48, z);
            this.group.add(panel);
        }
    }

    /* ---- Pulse the surgical lamp (subtle breathing effect) ---- */
    update(elapsed) {
        if (this.lights.surgical) {
            this.lights.surgical.intensity = 0.4 + Math.sin(elapsed * 0.5) * 0.02;
        }
    }
}
