/* ============================================
   Animations - REAL Surgical Interactions
   Tools physically cut, penetrate, break, and
   manipulate eye geometry with visible effects.
   ============================================ */

class SurgeryAnimations {
    constructor(eyeModel, surgicalTools, scene) {
        this.eye = eyeModel;
        this.tools = surgicalTools;
        this.scene = scene;
        this.activeTimeline = null;
        this.complicationTimeline = null;
        this.isShowingComplication = false;
        this.dynamicObjects = [];   // All temp geometry (wounds, debris, effects)
        this.currentSubStep = 0;
        this.subStepTimelines = [];
    }

    /* ---- Master: build sub-steps for a surgery step ---- */
    buildSubSteps(stepId, camera, controls) {
        this.cleanup();
        this.eye.resetToOriginal();
        this.eye.unhighlightAll();
        this.tools.hideAll();
        this.currentSubStep = 0;

        switch (stepId) {
            case 0: return this.buildPrepSubSteps(camera, controls);
            case 1: return this.buildIncisionSubSteps(camera, controls);
            case 2: return this.buildCapsulorhexisSubSteps(camera, controls);
            case 3: return this.buildPhacoSubSteps(camera, controls);
            case 4: return this.buildIOLSubSteps(camera, controls);
            case 5: return this.buildClosureSubSteps(camera, controls);
            default: return [];
        }
    }

    playSubStep(index) {
        if (index < 0 || index >= this.subStepTimelines.length) return;
        if (this.activeTimeline) this.activeTimeline.pause();
        this.currentSubStep = index;
        const sub = this.subStepTimelines[index];
        this.activeTimeline = sub.timeline;
        sub.timeline.restart();
    }

    cleanup() {
        if (this.activeTimeline) this.activeTimeline.kill();
        if (this.complicationTimeline) this.complicationTimeline.kill();
        this.subStepTimelines.forEach(s => s.timeline.kill());
        this.subStepTimelines = [];
        this.dynamicObjects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        this.dynamicObjects = [];
        this.tools.hideAll();
        this.isShowingComplication = false;
    }

    /* ---- Helper: animate camera smoothly ---- */
    cam(tl, camera, controls, pos, target, dur = 1.2, at = 0) {
        tl.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: "power2.inOut" }, at);
        tl.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease: "power2.inOut", onUpdate: () => controls.update() }, at);
    }

    /* ---- Create a glowing wound/cut on the eye ---- */
    createWound(x, y, z, width, height, rotation = 0) {
        const group = new THREE.Group();

        // Wound opening (dark slit)
        const slitGeo = new THREE.PlaneGeometry(width, height);
        const slitMat = new THREE.MeshBasicMaterial({
            color: 0x220000, side: THREE.DoubleSide, transparent: true, opacity: 0,
        });
        const slit = new THREE.Mesh(slitGeo, slitMat);
        group.add(slit);

        // Wound edges (red glow on both sides)
        for (let side = -1; side <= 1; side += 2) {
            const edgeGeo = new THREE.PlaneGeometry(width, height * 0.3);
            const edgeMat = new THREE.MeshBasicMaterial({
                color: 0xff2222, side: THREE.DoubleSide, transparent: true, opacity: 0,
            });
            const edge = new THREE.Mesh(edgeGeo, edgeMat);
            edge.position.y = side * height * 0.5;
            edge.userData.edgeMat = edgeMat;
            group.add(edge);
        }

        // Glow ring around wound
        const glowGeo = new THREE.RingGeometry(
            Math.max(width, height) * 0.5,
            Math.max(width, height) * 0.9,
            16
        );
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff4444, side: THREE.DoubleSide, transparent: true, opacity: 0,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.userData.glowMat = glowMat;
        group.add(glow);

        group.position.set(x, y, z);
        group.rotation.z = rotation;
        group.userData.slitMat = slitMat;
        group.userData.glowMat = glowMat;

        this.scene.add(group);
        this.dynamicObjects.push(group);
        return group;
    }

    /* ---- Animate wound opening ---- */
    animateWoundOpen(tl, wound, at = 0, dur = 0.8) {
        // Slit appears
        tl.to(wound.userData.slitMat, { opacity: 0.9, duration: dur * 0.4 }, at);
        // Edges glow red
        wound.children.forEach(child => {
            if (child.userData.edgeMat) {
                tl.to(child.userData.edgeMat, { opacity: 0.7, duration: dur * 0.6 }, at + dur * 0.2);
            }
        });
        // Glow pulses
        tl.to(wound.userData.glowMat, { opacity: 0.4, duration: dur * 0.5 }, at + dur * 0.3);
        tl.to(wound.userData.glowMat, { opacity: 0.15, duration: dur * 0.5 }, at + dur * 0.6);
        // Wound opens (scale y)
        tl.fromTo(wound.scale, { y: 0.1 }, { y: 1.0, duration: dur, ease: "power2.out" }, at);
    }

    /* ---- Create impact flash at tool contact point ---- */
    createContactFlash(x, y, z, color = 0x00ffaa) {
        const geo = new THREE.SphereGeometry(0.06, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.8,
        });
        const flash = new THREE.Mesh(geo, mat);
        flash.position.set(x, y, z);
        this.scene.add(flash);
        this.dynamicObjects.push(flash);
        return flash;
    }

    /* ---- Create spray/splash particles ---- */
    createSpray(origin, count = 25, color = 0xddccbb, spread = 0.5) {
        const group = new THREE.Group();

        for (let i = 0; i < count; i++) {
            const size = 0.005 + Math.random() * 0.012;
            const geo = new THREE.SphereGeometry(size, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: 0.8,
            });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(origin);

            // Random velocity
            particle.userData.vel = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread
            );
            group.add(particle);
        }

        group.userData.isSpray = true;
        group.userData.age = 0;
        this.scene.add(group);
        this.dynamicObjects.push(group);
        return group;
    }

    /* ---- Create lens fragments (for phaco) ---- */
    createLensFragments(count = 6) {
        const fragments = [];
        const colors = [0xc8b88a, 0xb5a67a, 0xd4c494, 0xaa9468];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const r = 0.12 + Math.random() * 0.08;

            // Irregular fragment shapes
            const shape = new THREE.Shape();
            const verts = 5 + Math.floor(Math.random() * 4);
            for (let v = 0; v < verts; v++) {
                const a = (v / verts) * Math.PI * 2;
                const rad = 0.04 + Math.random() * 0.06;
                if (v === 0) shape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
                else shape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
            }
            shape.closePath();

            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.015 + Math.random() * 0.02, bevelEnabled: false });
            const mat = new THREE.MeshPhysicalMaterial({
                color: colors[i % colors.length],
                transparent: true,
                opacity: 0.85,
                roughness: 0.5,
                clearcoat: 0.3,
            });

            const frag = new THREE.Mesh(geo, mat);
            frag.position.set(
                Math.cos(angle) * r,
                Math.sin(angle) * r,
                0.52
            );
            frag.rotation.z = Math.random() * Math.PI;

            this.scene.add(frag);
            this.dynamicObjects.push(frag);
            fragments.push(frag);
        }
        return fragments;
    }

    /* ---- Helper: position tool and animate entry ---- */
    toolEnter(tl, toolName, startPos, endPos, rotation, scale = 0.7, at = 0, dur = 1.5) {
        const tool = this.tools.getTool(toolName);
        tl.add(() => {
            this.tools.showTool(toolName);
            tool.position.set(startPos.x, startPos.y, startPos.z);
            tool.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
            tool.scale.setScalar(scale);
        }, at);
        tl.to(tool.position, { x: endPos.x, y: endPos.y, z: endPos.z, duration: dur, ease: "power2.out" }, at + 0.2);
        return tool;
    }

    /* ---- Helper: tool exit animation ---- */
    toolExit(tl, toolName, exitPos, at = 0, dur = 1.0) {
        const tool = this.tools.getTool(toolName);
        tl.to(tool.position, { x: exitPos.x, y: exitPos.y, z: exitPos.z, duration: dur, ease: "power2.in" }, at);
        tl.add(() => { tool.visible = false; }, at + dur);
    }

    /* ============================================
       STEP 0: PREP
       ============================================ */
    buildPrepSubSteps(camera, controls) {
        const steps = [];

        // Sub 0: Eye drops
        (() => {
            const tl = gsap.timeline({ paused: true });
            this.cam(tl, camera, controls, { x: 0, y: 1, z: 4.5 }, { x: 0, y: 0, z: 0 });

            const syringe = this.toolEnter(tl, 'syringe',
                { x: 0, y: 3, z: 2 }, { x: 0, y: 1.8, z: 1.5 },
                { x: 0.3 }, 0.7
            );

            // Drop falls onto cornea
            const drop = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 16, 16),
                new THREE.MeshPhysicalMaterial({ color: 0xd0e8ff, transparent: true, opacity: 0, transmission: 0.5, roughness: 0 })
            );
            this.scene.add(drop);
            this.dynamicObjects.push(drop);

            tl.add(() => { drop.position.set(0, 1.5, 1.5); drop.material.opacity = 0.8; }, 2.0);
            tl.to(drop.position, { y: 0.15, z: 1.15, duration: 0.5, ease: "power2.in" }, 2.0);

            // Splash on cornea surface
            tl.add(() => {
                const splash = this.createContactFlash(0, 0.1, 1.15, 0x88ccff);
                gsap.to(splash.scale, { x: 3, y: 3, z: 3, duration: 0.4 });
                gsap.to(splash.material, { opacity: 0, duration: 0.6 });
            }, 2.5);
            tl.to(drop.scale, { x: 2, y: 0.2, z: 2, duration: 0.3 }, 2.5);
            tl.to(drop.material, { opacity: 0, duration: 0.3 }, 2.6);

            // Cornea briefly shimmers (anesthetic spreading)
            const cornea = this.eye.getPart('cornea');
            cornea.forEach(m => {
                if (m.material) {
                    tl.to(m.material, { opacity: 0.3, duration: 0.5 }, 2.7);
                    tl.to(m.material, { opacity: 0.15, duration: 1.0 }, 3.2);
                }
            });

            this.toolExit(tl, 'syringe', { x: 0, y: 4, z: 2 }, 3.5);

            steps.push({ timeline: tl, label: "Apply Anesthetic Drops", description: "Topical anesthetic drops numb the corneal surface. Watch the drop fall and spread across the eye.", icon: "fa-eye-dropper" });
        })();

        // Sub 1: Lid speculum
        (() => {
            const tl = gsap.timeline({ paused: true });
            this.cam(tl, camera, controls, { x: 0, y: 0.5, z: 4.5 }, { x: 0, y: 0, z: 0 });

            const speculum = this.toolEnter(tl, 'speculum',
                { x: 2.5, y: 0, z: 2 }, { x: 0.3, y: 0, z: 1.8 },
                { z: Math.PI / 2 }, 1.2
            );

            // Speculum opens (scale y increases = arms spread)
            tl.to(speculum.scale, { y: 1.8, duration: 1.5, ease: "power2.out" }, 2.0);

            // Eyelids retract
            tl.add(() => {
                this.eye.setPartOpacity('eyelid', 0.15);
                this.eye.setPartOpacity('skin', 0.15);
            }, 2.5);

            // Eye is now fully exposed - highlight it
            tl.add(() => this.eye.highlightPart('cornea', 0x00d4aa), 3.0);

            steps.push({ timeline: tl, label: "Insert Lid Speculum", description: "Wire speculum spreads the eyelids apart, fully exposing the surgical field. The eye is now locked open.", icon: "fa-expand-alt" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 1: CORNEAL INCISION
       ============================================ */
    buildIncisionSubSteps(camera, controls) {
        const steps = [];
        const fade = () => { this.eye.setPartOpacity('eyelid', 0.1); this.eye.setPartOpacity('skin', 0.1); };

        // Sub 0: Keratome approaches & CUTS
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 2.5, y: 1, z: 3 }, { x: 0.3, y: 0, z: 0.5 });

            const keratome = this.toolEnter(tl, 'keratome',
                { x: 3.5, y: 0.5, z: 1.5 }, { x: 1.4, y: 0.05, z: 1.0 },
                { z: -Math.PI / 2 }, 0.8
            );

            // Keratome PUSHES INTO cornea — visible penetration
            tl.to(keratome.position, { x: 0.7, y: 0, z: 0.88, duration: 1.8, ease: "power1.inOut" }, 2.0);

            // CONTACT FLASH when blade touches
            tl.add(() => {
                const flash = this.createContactFlash(0.9, 0, 0.95, 0xff4444);
                gsap.to(flash.scale, { x: 2, y: 2, z: 2, duration: 0.3 });
                gsap.to(flash.material, { opacity: 0, duration: 0.5 });
            }, 2.5);

            // WOUND APPEARS on cornea
            const wound = this.createWound(0.5, 0, 0.9, 0.15, 0.05);
            this.animateWoundOpen(tl, wound, 2.8, 1.0);

            // Tissue spray at incision
            tl.add(() => {
                this.createSpray(new THREE.Vector3(0.6, 0, 0.92), 15, 0xffaaaa, 0.15);
            }, 2.8);

            // Cornea reacts — slight deformation
            this.eye.getPart('cornea').forEach(m => {
                if (m.material) {
                    tl.to(m.material, { opacity: 0.22, duration: 0.3 }, 2.8);
                    tl.to(m.material, { opacity: 0.12, duration: 0.5 }, 3.3);
                }
            });

            // Keratome pushes through to create tunnel
            tl.to(keratome.position, { x: 0.4, duration: 1.0, ease: "power1.in" }, 3.5);

            // Wound widens
            tl.to(wound.scale, { x: 1.5, duration: 0.8 }, 3.5);

            // Withdraw blade
            this.toolExit(tl, 'keratome', { x: 3.5, y: 0.5, z: 1.5 }, 4.8);

            steps.push({ timeline: tl, label: "Main Corneal Incision", description: "Keratome blade penetrates the cornea at the limbus creating a 2.4mm self-sealing tunnel. Watch the blade push through and the wound open.", icon: "fa-cut" });
        })();

        // Sub 1: Side-port cut
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: -1.5, y: 1.5, z: 3 }, { x: -0.2, y: 0, z: 0.5 });

            const blade = this.toolEnter(tl, 'sideport_blade',
                { x: -2.5, y: 1, z: 1.5 }, { x: -0.5, y: 0.2, z: 0.95 },
                { y: Math.PI / 3, z: -Math.PI / 2 }, 0.7
            );

            // Stab in
            tl.to(blade.position, { x: -0.25, y: 0.1, z: 0.88, duration: 0.6, ease: "power2.out" }, 2.0);

            // Contact flash
            tl.add(() => {
                const f = this.createContactFlash(-0.35, 0.15, 0.92, 0xff4444);
                gsap.to(f.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.3 });
                gsap.to(f.material, { opacity: 0, duration: 0.5 });
            }, 2.3);

            // Side wound
            const sideWound = this.createWound(-0.3, 0.15, 0.9, 0.06, 0.03, Math.PI / 4);
            this.animateWoundOpen(tl, sideWound, 2.3, 0.6);

            tl.add(() => this.createSpray(new THREE.Vector3(-0.3, 0.15, 0.92), 10, 0xffaaaa, 0.1), 2.4);

            this.toolExit(tl, 'sideport_blade', { x: -2.5, y: 1, z: 1.5 }, 3.0);

            steps.push({ timeline: tl, label: "Side-Port Incision", description: "A 1mm stab incision 90 degrees away. Provides access for the second instrument.", icon: "fa-slash" });
        })();

        // Sub 2: Inject viscoelastic (OVD fills chamber)
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 1.5, y: 0.8, z: 3.5 }, { x: 0.1, y: 0, z: 0.3 });

            const syringe = this.toolEnter(tl, 'syringe',
                { x: 2.5, y: 0.5, z: 1.5 }, { x: 0.6, y: 0, z: 0.88 },
                { x: 0.2, y: -0.3, z: -Math.PI / 2 }, 0.6
            );

            // Syringe tip enters wound
            tl.to(syringe.position, { x: 0.35, duration: 1.0, ease: "power1.inOut" }, 2.0);

            // Plunger pushes — fluid enters
            const plunger = syringe.getObjectByName('plunger');
            if (plunger) tl.to(plunger.position, { y: 0.5, duration: 2.5 }, 2.5);

            // VISIBLE: Anterior chamber FILLS — create expanding transparent sphere
            const orvGeo = new THREE.SphereGeometry(0.01, 24, 24);
            const orvMat = new THREE.MeshPhysicalMaterial({
                color: 0xd0e8ff, transparent: true, opacity: 0, transmission: 0.6, roughness: 0, thickness: 0.5,
            });
            const ovdBubble = new THREE.Mesh(orvGeo, orvMat);
            ovdBubble.position.set(0, 0, 0.7);
            this.scene.add(ovdBubble);
            this.dynamicObjects.push(ovdBubble);

            tl.to(orvMat, { opacity: 0.25, duration: 1.0 }, 2.8);
            tl.to(ovdBubble.scale, { x: 40, y: 40, z: 20, duration: 2.5, ease: "power1.out" }, 2.8);

            // Chamber deepens — anterior chamber part becomes visible
            this.eye.getPart('anterior_chamber').forEach(m => {
                if (m.material) tl.to(m.material, { opacity: 0.2, duration: 1.5 }, 3.0);
            });

            this.toolExit(tl, 'syringe', { x: 2.5, y: 0.5, z: 1.5 }, 5.5);

            steps.push({ timeline: tl, label: "Inject Viscoelastic (OVD)", description: "Gel-like viscoelastic fills the anterior chamber, inflating it to protect the cornea and create working space.", icon: "fa-syringe" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 2: CAPSULORHEXIS
       ============================================ */
    buildCapsulorhexisSubSteps(camera, controls) {
        const steps = [];
        const fade = () => {
            this.eye.setPartOpacity('eyelid', 0.05); this.eye.setPartOpacity('skin', 0.05);
            this.eye.setPartOpacity('cornea', 0.06); this.eye.setPartOpacity('sclera', 0.3);
        };

        // Sub 0: Stain capsule blue
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 0, y: 2.5, z: 3 }, { x: 0, y: 0, z: 0.3 });

            // Syringe injects blue dye
            const syringe = this.toolEnter(tl, 'syringe',
                { x: 2, y: 1, z: 1.5 }, { x: 0.4, y: 0, z: 0.75 },
                { x: 0.2, y: -0.3, z: -Math.PI / 2 }, 0.5
            );

            // Blue dye spreads across lens surface
            const dyeGeo = new THREE.CircleGeometry(0.01, 32);
            const dyeMat = new THREE.MeshBasicMaterial({
                color: 0x1a3db3, side: THREE.DoubleSide, transparent: true, opacity: 0,
            });
            const dye = new THREE.Mesh(dyeGeo, dyeMat);
            dye.position.set(0, 0, 0.63);
            this.scene.add(dye);
            this.dynamicObjects.push(dye);

            tl.to(dyeMat, { opacity: 0.6, duration: 1.0 }, 2.5);
            tl.to(dye.scale, { x: 35, y: 35, duration: 2.0, ease: "power1.out" }, 2.5);

            // Lens turns blue-ish
            this.eye.getPart('lens').forEach(m => {
                if (m.material?.color) tl.to(m.material.color, { r: 0.15, g: 0.25, b: 0.65, duration: 2.0 }, 2.5);
                if (m.material) tl.to(m.material, { opacity: 0.75, duration: 1.5 }, 2.5);
            });

            this.toolExit(tl, 'syringe', { x: 2, y: 1, z: 1.5 }, 4.5);

            steps.push({ timeline: tl, label: "Trypan Blue Staining", description: "Blue dye injected — watch it spread across the lens capsule, making the transparent membrane visible for the next step.", icon: "fa-tint" });
        })();

        // Sub 1: Cystotome PUNCTURES capsule
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            // Keep lens blue
            tl.add(() => {
                this.eye.getPart('lens').forEach(m => {
                    if (m.material?.color) m.material.color.set(0x2840b3);
                    if (m.material) m.material.opacity = 0.75;
                });
            }, 0);

            const cystotome = this.toolEnter(tl, 'cystotome',
                { x: 2, y: 0.5, z: 1.5 }, { x: 0.5, y: 0, z: 0.75 },
                { y: -0.5, z: -Math.PI / 2 }, 0.7
            );

            // STAB — quick jab into capsule
            tl.to(cystotome.position, { x: 0.15, y: -0.02, z: 0.63, duration: 0.25, ease: "power3.out" }, 2.3);

            // PUNCTURE FLASH
            tl.add(() => {
                const f = this.createContactFlash(0.15, 0, 0.65, 0xff2222);
                gsap.to(f.scale, { x: 2, y: 2, z: 2, duration: 0.2 });
                gsap.to(f.material, { opacity: 0, duration: 0.4 });
                this.createSpray(new THREE.Vector3(0.15, 0, 0.65), 8, 0x3355cc, 0.08);
            }, 2.4);

            // Puncture hole appears
            const holeGeo = new THREE.CircleGeometry(0.025, 16);
            const holeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a1a, side: THREE.DoubleSide, transparent: true, opacity: 0 });
            const hole = new THREE.Mesh(holeGeo, holeMat);
            hole.position.set(0.12, 0, 0.64);
            this.scene.add(hole);
            this.dynamicObjects.push(hole);
            tl.to(holeMat, { opacity: 0.9, duration: 0.3 }, 2.5);

            // Needle tip drags to initiate flap
            tl.to(cystotome.position, { x: 0.05, y: 0.08, duration: 0.8, ease: "power1.inOut" }, 2.8);

            this.toolExit(tl, 'cystotome', { x: 2, y: 0.5, z: 1.5 }, 3.8);

            steps.push({ timeline: tl, label: "Puncture Capsule", description: "Cystotome needle stabs through the anterior capsule — see the puncture hole appear and the initial tear begin.", icon: "fa-crosshairs" });
        })();

        // Sub 2: Forceps tear circular opening
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            tl.add(() => {
                this.eye.getPart('lens').forEach(m => {
                    if (m.material?.color) m.material.color.set(0x2840b3);
                    if (m.material) m.material.opacity = 0.75;
                });
            }, 0);

            const forceps = this.toolEnter(tl, 'forceps',
                { x: 2, y: 0.3, z: 1.2 }, { x: 0.3, y: 0, z: 0.68 },
                { y: -0.3 }, 0.5
            );

            // CREATE VISIBLE CIRCULAR TEAR — each dot appears as forceps move around
            const tearRadius = 0.22;
            const totalDots = 50;
            const tearDuration = 4.0;

            for (let i = 0; i < totalDots; i++) {
                const angle = (i / totalDots) * Math.PI * 2;

                // Tear dot (visible rip in capsule)
                const dot = new THREE.Mesh(
                    new THREE.CircleGeometry(0.01, 8),
                    new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide, transparent: true, opacity: 0 })
                );
                dot.position.set(Math.cos(angle) * tearRadius, Math.sin(angle) * tearRadius, 0.635);
                this.scene.add(dot);
                this.dynamicObjects.push(dot);

                const t = 2.0 + (i / totalDots) * tearDuration;
                tl.to(dot.material, { opacity: 0.9, duration: 0.1 }, t);

                // Move forceps tip along circle
                if (i % 5 === 0) {
                    tl.to(forceps.position, {
                        x: 0.1 + Math.cos(angle) * tearRadius * 0.5,
                        y: Math.sin(angle) * tearRadius * 0.5,
                        z: 0.66,
                        duration: tearDuration / 10,
                        ease: "none",
                    }, t);
                }

                // Mini sparks along tear
                if (i % 8 === 0) {
                    tl.add(() => {
                        const spark = this.createContactFlash(
                            Math.cos(angle) * tearRadius,
                            Math.sin(angle) * tearRadius,
                            0.65, 0xff4444
                        );
                        gsap.to(spark.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.2 });
                        gsap.to(spark.material, { opacity: 0, duration: 0.3 });
                    }, t);
                }
            }

            // Circular opening (dark center visible)
            const openingGeo = new THREE.CircleGeometry(tearRadius - 0.015, 48);
            const openingMat = new THREE.MeshBasicMaterial({
                color: 0x0a0a15, side: THREE.DoubleSide, transparent: true, opacity: 0,
            });
            const opening = new THREE.Mesh(openingGeo, openingMat);
            opening.position.set(0, 0, 0.633);
            this.scene.add(opening);
            this.dynamicObjects.push(opening);

            tl.to(openingMat, { opacity: 0.75, duration: 1.0 }, 5.5);

            // Glow ring around completed opening
            const glowRing = new THREE.Mesh(
                new THREE.RingGeometry(tearRadius - 0.02, tearRadius + 0.02, 48),
                new THREE.MeshBasicMaterial({ color: 0x00d4aa, side: THREE.DoubleSide, transparent: true, opacity: 0 })
            );
            glowRing.position.set(0, 0, 0.636);
            this.scene.add(glowRing);
            this.dynamicObjects.push(glowRing);
            tl.to(glowRing.material, { opacity: 0.5, duration: 0.5 }, 6.0);
            tl.to(glowRing.material, { opacity: 0.15, duration: 1.0 }, 6.5);

            this.toolExit(tl, 'forceps', { x: 2, y: 0.3, z: 1.2 }, 6.5);

            steps.push({ timeline: tl, label: "Tear Circular Opening", description: "Forceps grip the capsule flap and tear it in a perfect circle. Watch each point of the tear appear as the instrument moves around.", icon: "fa-circle-notch" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 3: PHACOEMULSIFICATION
       ============================================ */
    buildPhacoSubSteps(camera, controls) {
        const steps = [];
        const fade = () => {
            this.eye.setPartOpacity('eyelid', 0.05); this.eye.setPartOpacity('skin', 0.05);
            this.eye.setPartOpacity('cornea', 0.05); this.eye.setPartOpacity('sclera', 0.18);
        };

        // Sub 0: Hydrodissection
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 1, y: 1.5, z: 3.5 }, { x: 0, y: 0, z: 0.2 });

            const cannula = this.toolEnter(tl, 'cannula',
                { x: 2.5, y: 0.5, z: 1.2 }, { x: 0.4, y: 0, z: 0.68 },
                { y: -0.3, z: -Math.PI / 2 }, 0.7
            );

            // Fluid wave — lens jumps up
            const lens = this.eye.getPart('lens');
            tl.add(() => {
                const wave = this.createContactFlash(0.1, 0, 0.6, 0x88ccff);
                gsap.to(wave.scale, { x: 5, y: 5, z: 2, duration: 0.5 });
                gsap.to(wave.material, { opacity: 0, duration: 0.8 });
            }, 2.5);

            lens.forEach(m => {
                tl.to(m.position, { z: "+=0.1", duration: 0.4, ease: "power2.out" }, 2.5);
                tl.to(m.position, { z: "-=0.06", duration: 0.3, ease: "bounce.out" }, 2.9);
            });

            this.toolExit(tl, 'cannula', { x: 2.5, y: 0.5, z: 1.2 }, 3.5);

            steps.push({ timeline: tl, label: "Hydrodissection", description: "Fluid wave separates the lens from the capsule. Watch the lens physically bounce as the fluid jet hits underneath.", icon: "fa-water" });
        })();

        // Sub 1: Phaco sculpts grooves & BREAKS lens
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 0.5, y: 2.2, z: 2.8 }, { x: 0, y: 0, z: 0.15 });

            const phaco = this.toolEnter(tl, 'phaco_probe',
                { x: 2.5, y: 1, z: 1.5 }, { x: 0.5, y: 0.05, z: 0.65 },
                { x: Math.PI, z: Math.PI / 4 }, 0.5
            );

            // VISIBLE VIBRATION on probe
            tl.to(phaco.position, { x: "+=0.005", duration: 0.025, yoyo: true, repeat: 200, ease: "none" }, 2.0);

            // Vibe indicator glows
            const vibe = phaco.getObjectByName('vibe_indicator');
            if (vibe) tl.to(vibe.material, { opacity: 1, duration: 0.1, yoyo: true, repeat: 50 }, 2.0);

            // SCULPT GROOVE 1 (vertical line appearing on lens surface)
            const groove1 = new THREE.Mesh(
                new THREE.PlaneGeometry(0.005, 0.3),
                new THREE.MeshBasicMaterial({ color: 0x442200, side: THREE.DoubleSide, transparent: true, opacity: 0 })
            );
            groove1.position.set(0, 0, 0.56);
            this.scene.add(groove1);
            this.dynamicObjects.push(groove1);
            tl.to(groove1.material, { opacity: 0.9, duration: 1.5 }, 2.5);

            // Debris spraying as groove is cut
            tl.add(() => this.createSpray(new THREE.Vector3(0, 0.05, 0.58), 20, 0xc8b88a, 0.15), 2.8);
            tl.add(() => this.createSpray(new THREE.Vector3(0, -0.05, 0.58), 15, 0xc8b88a, 0.12), 3.3);

            // SCULPT GROOVE 2 (horizontal)
            const groove2 = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 0.005),
                new THREE.MeshBasicMaterial({ color: 0x442200, side: THREE.DoubleSide, transparent: true, opacity: 0 })
            );
            groove2.position.set(0, 0, 0.56);
            this.scene.add(groove2);
            this.dynamicObjects.push(groove2);
            tl.to(groove2.material, { opacity: 0.9, duration: 1.5 }, 4.0);

            tl.add(() => this.createSpray(new THREE.Vector3(0.05, 0, 0.58), 20, 0xc8b88a, 0.15), 4.5);

            // CRACK — lens splits into fragments
            tl.add(() => {
                // Flash at crack moment
                const crack = this.createContactFlash(0, 0, 0.56, 0xffaa00);
                gsap.to(crack.scale, { x: 4, y: 4, z: 4, duration: 0.3 });
                gsap.to(crack.material, { opacity: 0, duration: 0.5 });
            }, 5.5);

            // Original lens fades
            this.eye.getPart('lens').forEach(m => {
                if (m.material) tl.to(m.material, { opacity: 0.1, duration: 0.5 }, 5.5);
            });

            // FRAGMENTS APPEAR
            const fragments = this.createLensFragments(8);
            fragments.forEach((frag, i) => {
                frag.material.opacity = 0;
                const a = (i / fragments.length) * Math.PI * 2;
                // Fragments burst apart
                tl.to(frag.material, { opacity: 0.85, duration: 0.3 }, 5.6);
                tl.to(frag.position, {
                    x: frag.position.x + Math.cos(a) * 0.08,
                    y: frag.position.y + Math.sin(a) * 0.08,
                    duration: 0.4,
                    ease: "power2.out"
                }, 5.6);
            });

            steps.push({ timeline: tl, label: "Sculpt & Crack Nucleus", description: "Phaco probe vibrates at ultrasonic speed, carving grooves into the lens. Then CRACK — the lens splits into fragments. Watch the debris spray.", icon: "fa-bolt" });
        })();

        // Sub 2: Emulsify and aspirate fragments
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 0, y: 2, z: 3.2 }, { x: 0, y: 0, z: 0 });

            // Hide original lens, show fragments
            tl.add(() => this.eye.setPartVisibility('lens', false), 0);

            const fragments = this.createLensFragments(8);
            const phaco = this.toolEnter(tl, 'phaco_probe',
                { x: 2, y: 0.5, z: 1.2 }, { x: 0.4, y: 0, z: 0.6 },
                { x: Math.PI, z: Math.PI / 4 }, 0.5
            );

            // Vibrate probe
            tl.to(phaco.position, { x: "+=0.005", duration: 0.025, yoyo: true, repeat: 300, ease: "none" }, 2.0);

            // Each fragment gets SUCKED toward probe tip and dissolves
            fragments.forEach((frag, i) => {
                const delay = 2.0 + i * 0.7;

                // Fragment vibrates
                tl.to(frag.position, { x: "+=0.01", duration: 0.03, yoyo: true, repeat: 15, ease: "none" }, delay);

                // Fragment moves toward probe tip
                tl.to(frag.position, {
                    x: 0.35, y: 0, z: 0.62,
                    duration: 0.6,
                    ease: "power2.in",
                }, delay + 0.3);

                // Fragment shrinks (emulsified)
                tl.to(frag.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.5 }, delay + 0.5);
                tl.to(frag.material, { opacity: 0, duration: 0.4 }, delay + 0.6);

                // Spray at absorption
                tl.add(() => {
                    this.createSpray(new THREE.Vector3(0.35, 0, 0.62), 10, 0xddccaa, 0.08);
                }, delay + 0.5);
            });

            this.toolExit(tl, 'phaco_probe', { x: 2.5, y: 1, z: 1.5 }, 8.5);

            steps.push({ timeline: tl, label: "Emulsify & Aspirate", description: "Each lens fragment gets pulled to the probe tip by suction, vibrated into liquid by ultrasound, and sucked out. Watch them dissolve one by one.", icon: "fa-magnet" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 4: IOL IMPLANTATION
       ============================================ */
    buildIOLSubSteps(camera, controls) {
        const steps = [];
        const fade = () => {
            this.eye.setPartOpacity('eyelid', 0.05); this.eye.setPartOpacity('skin', 0.05);
            this.eye.setPartOpacity('cornea', 0.06); this.eye.setPartOpacity('sclera', 0.2);
            this.eye.setPartVisibility('lens', false);
        };

        // Sub 0: IOL injector enters and SQUEEZES IOL through incision
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 1.5, y: 1, z: 3 }, { x: 0, y: 0, z: 0.3 });

            const injector = this.toolEnter(tl, 'iol_injector',
                { x: 3.5, y: 0.5, z: 1.5 }, { x: 0.8, y: 0.05, z: 0.88 },
                { x: Math.PI, y: 0.2, z: Math.PI / 4 }, 0.45
            );

            // Push into incision
            tl.to(injector.position, { x: 0.35, y: 0, z: 0.75, duration: 1.5, ease: "power1.inOut" }, 2.0);

            // Plunger pushes
            const plunger = injector.getObjectByName('plunger');
            if (plunger) tl.to(plunger.position, { y: 0.2, duration: 2.5 }, 3.0);

            // IOL EMERGES — starts as tiny folded disc, unfurls
            const iol = this.eye.getPart('iol');
            tl.add(() => {
                iol.forEach(m => {
                    m.visible = true;
                    m.scale.set(0.02, 0.02, 0.02); // Folded tiny
                    m.position.set(0.3, 0, 0.55);
                });
            }, 4.0);

            // IOL squeezes out — grows from tiny to small
            iol.forEach(m => {
                tl.to(m.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 0.8, ease: "power2.out" }, 4.2);
                tl.to(m.position, { x: 0.2, duration: 0.8 }, 4.2);
            });

            // Flash as IOL exits cartridge
            tl.add(() => {
                const f = this.createContactFlash(0.25, 0, 0.55, 0x44aaff);
                gsap.to(f.scale, { x: 2, y: 2, z: 2, duration: 0.3 });
                gsap.to(f.material, { opacity: 0, duration: 0.5 });
            }, 4.3);

            // IOL UNFOLDS with elastic spring
            iol.forEach(m => {
                tl.to(m.scale, { x: 1, y: 1, z: 1, duration: 1.5, ease: "elastic.out(1, 0.3)" }, 5.0);
                tl.to(m.position, { x: 0.1, duration: 1.5 }, 5.0);
            });

            this.toolExit(tl, 'iol_injector', { x: 3.5, y: 0.5, z: 1.5 }, 5.5);

            steps.push({ timeline: tl, label: "Inject & Unfold IOL", description: "IOL injector pushes the folded artificial lens through the tiny incision. Watch it squeeze out and SPRING open inside the eye.", icon: "fa-compress-arrows-alt" });
        })();

        // Sub 1: Hook dials IOL into position
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.cam(tl, camera, controls, { x: 0, y: 2.2, z: 2.8 }, { x: 0, y: 0, z: 0.3 });

            // IOL starts off-center
            const iol = this.eye.getPart('iol');
            tl.add(() => {
                iol.forEach(m => { m.visible = true; m.scale.set(1,1,1); m.position.set(0.12, -0.05, 0.52); m.rotation.set(0, 0, 0.15); });
            }, 0);

            const hook = this.toolEnter(tl, 'sinskey_hook',
                { x: 2, y: 0.3, z: 1.2 }, { x: 0.3, y: -0.1, z: 0.62 },
                { y: -0.5, z: -Math.PI / 2 }, 0.6
            );

            // Hook pushes IOL — VISIBLE ROTATION into center
            iol.forEach(m => {
                // Hook contacts IOL and rotates it
                tl.to(m.rotation, { z: 0, duration: 1.5, ease: "power2.inOut" }, 2.5);
                tl.to(m.position, { x: 0, y: 0, z: 0.5, duration: 2.0, ease: "power2.inOut" }, 2.5);
            });

            // Hook tip follows the IOL edge
            tl.to(hook.position, { x: 0.1, y: 0.05, z: 0.58, duration: 1.5, ease: "power1.inOut" }, 2.5);
            tl.to(hook.position, { x: -0.05, y: 0, z: 0.55, duration: 1.0, ease: "power1.inOut" }, 4.0);

            // CENTERED flash
            tl.add(() => {
                const f = this.createContactFlash(0, 0, 0.52, 0x00ff88);
                gsap.to(f.scale, { x: 3, y: 3, z: 3, duration: 0.4 });
                gsap.to(f.material, { opacity: 0, duration: 0.6 });
            }, 4.5);

            this.toolExit(tl, 'sinskey_hook', { x: 2, y: 0.3, z: 1.2 }, 5.0);

            steps.push({ timeline: tl, label: "Center IOL with Hook", description: "Sinskey hook dials the IOL into the center of the capsular bag. Watch it rotate and lock into perfect position.", icon: "fa-bullseye" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 5: WOUND CLOSURE
       ============================================ */
    buildClosureSubSteps(camera, controls) {
        const steps = [];

        const setupDone = () => {
            this.eye.setPartOpacity('eyelid', 0.1); this.eye.setPartOpacity('skin', 0.1);
            this.eye.setPartVisibility('lens', false);
            this.eye.getPart('iol').forEach(m => { m.visible = true; m.scale.set(1,1,1); m.position.set(0,0,0.5); });
        };

        // Sub 0: Remove OVD
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(setupDone, 0);
            this.eye.setPartOpacity('cornea', 0.08);
            this.eye.setPartOpacity('sclera', 0.3);
            this.cam(tl, camera, controls, { x: 1, y: 1, z: 4 }, { x: 0, y: 0, z: 0.2 });

            const ia = this.toolEnter(tl, 'ia_handpiece',
                { x: 2.5, y: 0.5, z: 1.2 }, { x: 0.4, y: 0, z: 0.7 },
                { x: Math.PI, z: Math.PI / 4 }, 0.5
            );

            // Sweep and suck — visible OVD being removed
            const ovdCloud = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 16, 16),
                new THREE.MeshPhysicalMaterial({ color: 0xd0e8ff, transparent: true, opacity: 0.2, transmission: 0.5 })
            );
            ovdCloud.position.set(0, 0, 0.6);
            this.scene.add(ovdCloud);
            this.dynamicObjects.push(ovdCloud);

            // OVD shrinks as aspirated
            tl.to(ovdCloud.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 3.0, ease: "power1.in" }, 2.0);
            tl.to(ovdCloud.material, { opacity: 0, duration: 2.5 }, 2.5);

            // Suction particles moving toward probe
            for (let i = 0; i < 5; i++) {
                tl.add(() => {
                    this.createSpray(new THREE.Vector3(
                        (Math.random() - 0.5) * 0.3,
                        (Math.random() - 0.5) * 0.3,
                        0.6
                    ), 5, 0xaaccee, 0.05);
                }, 2.5 + i * 0.5);
            }

            this.toolExit(tl, 'ia_handpiece', { x: 2.5, y: 0.5, z: 1.2 }, 5.0);

            steps.push({ timeline: tl, label: "Aspirate Viscoelastic", description: "I/A probe sucks out remaining viscoelastic gel to prevent post-op pressure spike. Watch the gel cloud shrink and disappear.", icon: "fa-exchange-alt" });
        })();

        // Sub 1: Hydrate wound shut
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(setupDone, 0);
            this.cam(tl, camera, controls, { x: 1.5, y: 0.5, z: 3.5 }, { x: 0.3, y: 0, z: 0.5 });

            const cannula = this.toolEnter(tl, 'cannula',
                { x: 2.5, y: 0.3, z: 1.5 }, { x: 0.6, y: 0, z: 0.92 },
                { y: -0.2, z: -Math.PI / 2 }, 0.7
            );

            // Fluid enters wound edges
            tl.add(() => {
                const hydro = this.createContactFlash(0.5, 0, 0.9, 0x66bbff);
                gsap.to(hydro.scale, { x: 3, y: 3, z: 3, duration: 0.5 });
                gsap.to(hydro.material, { opacity: 0, duration: 1.0 });
            }, 2.5);

            // Cornea swells — wound SEALS (opacity increases)
            this.eye.getPart('cornea').forEach(m => {
                if (m.material) {
                    tl.to(m.material, { opacity: 0.2, duration: 0.8 }, 2.5);
                    tl.to(m.material, { opacity: 0.15, duration: 1.5 }, 3.5);
                }
            });

            // Green "sealed" confirmation flash
            tl.add(() => {
                const seal = this.createContactFlash(0.5, 0, 0.9, 0x00ff88);
                gsap.to(seal.scale, { x: 4, y: 4, z: 4, duration: 0.5 });
                gsap.to(seal.material, { opacity: 0, duration: 0.8 });
            }, 4.0);

            this.toolExit(tl, 'cannula', { x: 2.5, y: 0.3, z: 1.5 }, 4.5);

            steps.push({ timeline: tl, label: "Hydrate & Seal Wound", description: "BSS injected into the wound edges — corneal stroma swells and seals the incision watertight. See the green confirmation flash.", icon: "fa-tint" });
        })();

        // Sub 2: Final view
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(setupDone, 0);

            // Restore full eye
            tl.add(() => {
                this.eye.setPartOpacity('sclera', 1); this.eye.setPartOpacity('cornea', 0.15);
                this.eye.setPartOpacity('eyelid', 0.7); this.eye.setPartOpacity('skin', 0.7);
            }, 0.5);

            this.cam(tl, camera, controls, { x: 0, y: 0, z: 4.5 }, { x: 0, y: 0, z: 0 });

            // Triumphant slow rotation
            tl.to(this.eye.group.rotation, { y: Math.PI * 2, duration: 8, ease: "power1.inOut" }, 1.0);

            // IOL sparkle
            tl.add(() => {
                const sparkle = this.createContactFlash(0, 0, 0.55, 0x44aaff);
                gsap.to(sparkle.scale, { x: 6, y: 6, z: 6, duration: 1.0 });
                gsap.to(sparkle.material, { opacity: 0, duration: 1.5 });
            }, 2.0);

            steps.push({ timeline: tl, label: "Surgery Complete!", description: "The eye is sealed, the new IOL is centered and stable. The patient's cloudy vision will now be crystal clear.", icon: "fa-check-circle" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       COMPLICATION VISUALIZATIONS
       ============================================ */
    showComplication(stepId, compIndex) {
        if (this.complicationTimeline) this.complicationTimeline.kill();
        this.isShowingComplication = true;
        const comp = SURGERY_STEPS[stepId].complications[compIndex];
        if (!comp) return;
        const tl = gsap.timeline();
        this.complicationTimeline = tl;

        switch (comp.visualEffect) {
            case 'redness': this.compRedness(tl); break;
            case 'perforation': this.compPerforation(tl); break;
            case 'cornea_clouding': this.compCorneaClouding(tl); break;
            case 'leak': this.compLeak(tl); break;
            case 'iris_prolapse': this.compIrisProlapse(tl); break;
            case 'capsule_tear': this.compCapsuleTear(tl); break;
            case 'capsule_rupture': this.compCapsuleRupture(tl); break;
            case 'thermal_burn': this.compBurn(tl); break;
            case 'nucleus_drop': this.compNucleusDrop(tl); break;
            case 'zonule_break': this.compZonuleBreak(tl); break;
            case 'iol_shift': this.compIOLShift(tl); break;
            case 'pressure': this.compPressure(tl); break;
            case 'infection': this.compInfection(tl); break;
            default: this.compGeneric(tl); break;
        }
        return tl;
    }

    hideComplication() {
        if (this.complicationTimeline) this.complicationTimeline.kill();
        this.isShowingComplication = false;
    }

    compRedness(tl) {
        this.eye.getPart('sclera').forEach(m => { if (m.material?.color) tl.to(m.material.color, { r:1, g:0.5, b:0.5, duration:1.5 }, 0); });
        tl.add(() => this.eye.setPartOpacity('blood_vessel', 0.9), 0.5);
    }
    compPerforation(tl) {
        tl.add(() => {
            const f = this.createContactFlash(0.8, -0.3, 0.2, 0xff0000);
            gsap.to(f.scale, { x: 5, y: 5, z: 5, duration: 0.5 });
            this.createSpray(new THREE.Vector3(0.8, -0.3, 0.2), 30, 0xcc0000, 0.3);
        }, 0.3);
        this.eye.getPart('sclera').forEach(m => { if (m.material?.color) tl.to(m.material.color, { r:0.8, g:0.3, b:0.3, duration:0.5 }, 0); });
    }
    compCorneaClouding(tl) {
        this.eye.getPart('cornea').forEach(m => {
            if (m.material) { tl.to(m.material, { opacity:0.6, duration:1.5 }, 0); tl.to(m.material.color, { r:0.7, g:0.75, b:0.8, duration:1.5 }, 0); }
        });
    }
    compLeak(tl) {
        // Visible fluid leaking from wound
        for (let i = 0; i < 6; i++) {
            tl.add(() => {
                const leak = new THREE.Mesh(
                    new THREE.SphereGeometry(0.015, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 })
                );
                leak.position.set(0.5 + Math.random() * 0.05, Math.random() * 0.05, 0.92);
                this.scene.add(leak);
                this.dynamicObjects.push(leak);
                gsap.to(leak.position, { x: 0.7 + Math.random() * 0.3, y: -0.3, duration: 1.5, ease: "power2.in" });
                gsap.to(leak.material, { opacity: 0, duration: 1.5 });
            }, i * 0.4);
        }
    }
    compIrisProlapse(tl) {
        this.eye.getPart('iris').forEach(m => {
            tl.to(m.position, { x:0.18, z:"+=0.15", duration:1.5, ease:"power2.out" }, 0.3);
            tl.to(m.rotation, { y:0.25, duration:1.5 }, 0.3);
        });
        tl.add(() => this.createSpray(new THREE.Vector3(0.4, 0, 0.95), 12, 0x44aa66, 0.1), 1.0);
    }
    compCapsuleTear(tl) {
        this.eye.getPart('capsule').forEach(m => {
            tl.to(m.scale, { x:1.6, y:0.7, duration:0.5, ease:"power4.out" }, 0.3);
            if (m.material?.color) tl.to(m.material.color, { r:1, g:0.3, b:0.3, duration:0.5 }, 0.3);
            if (m.material) tl.to(m.material, { opacity:0.5, duration:0.5 }, 0.3);
        });
        tl.add(() => { const f = this.createContactFlash(0, 0.15, 0.55, 0xff0000); gsap.to(f.scale, {x:3,y:3,z:3, duration:0.3}); }, 0.4);
    }
    compCapsuleRupture(tl) {
        this.eye.getPart('capsule').forEach(m => {
            tl.to(m.scale, { x:0.4, y:2, z:0.3, duration:0.3, ease:"power4.out" }, 0.2);
        });
        tl.add(() => { this.createSpray(new THREE.Vector3(0, 0, 0.4), 25, 0xeeddcc, 0.3); }, 0.3);
        tl.to(this.eye.group.position, { y:0.03, duration:0.08, yoyo:true, repeat:6 }, 0.3);
    }
    compBurn(tl) {
        this.eye.getPart('cornea').forEach(m => {
            if (m.material) { tl.to(m.material.color, {r:0.9,g:0.65,b:0.4, duration:1}, 0); tl.to(m.material, {opacity:0.5, duration:1}, 0); }
        });
        tl.add(() => { this.createSpray(new THREE.Vector3(0.5, 0, 0.9), 15, 0xff8800, 0.1); }, 0.5);
    }
    compNucleusDrop(tl) {
        const frags = this.createLensFragments(4);
        frags.forEach((f, i) => {
            tl.to(f.position, { y: -2, z: -0.5, duration: 2, ease: "power2.in" }, 0.5 + i * 0.3);
            tl.to(f.scale, { x: 0.5, y: 0.5, z: 0.5, duration: 2 }, 0.5 + i * 0.3);
        });
    }
    compZonuleBreak(tl) {
        this.eye.getPart('zonules').forEach(m => { tl.to(m.scale, {x:1.8,y:1.8, duration:0.2, ease:"power4.out"}, 0.3); });
        this.eye.getPart('lens').forEach(m => {
            tl.to(m.position, {x:0.15, y:-0.12, duration:1}, 0.5);
            tl.to(m.rotation, {z:0.25, duration:1}, 0.5);
        });
        tl.add(() => { this.createSpray(new THREE.Vector3(0.3, 0, 0.5), 15, 0xddccaa, 0.15); }, 0.4);
    }
    compIOLShift(tl) {
        this.eye.getPart('iol').forEach(m => {
            m.visible = true;
            tl.to(m.position, {x:0.22, y:-0.12, duration:1.5}, 0.5);
            tl.to(m.rotation, {z:0.3, x:0.15, duration:1.5}, 0.5);
        });
    }
    compPressure(tl) {
        tl.to(this.eye.group.scale, {x:1.1, y:1.1, z:1.1, duration:2}, 0);
        this.eye.getPart('cornea').forEach(m => { if (m.material) tl.to(m.material, {opacity:0.45, duration:2}, 0); });
    }
    compInfection(tl) {
        this.eye.getPart('sclera').forEach(m => { if (m.material?.color) tl.to(m.material.color, {r:1,g:0.35,b:0.3, duration:2}, 0); });
        this.eye.getPart('cornea').forEach(m => { if (m.material) { tl.to(m.material, {opacity:0.55, duration:2}, 0); tl.to(m.material.color, {r:0.8,g:0.8,b:0.5, duration:2}, 0); }});
        tl.to(this.eye.group.scale, {x:1.05, y:1.05, z:1.05, duration:0.7, yoyo:true, repeat:-1}, 1);
    }
    compGeneric(tl) {
        this.eye.getPart('sclera').forEach(m => { if (m.material?.color) tl.to(m.material.color, {r:1,g:0.5,b:0.5, duration:0.3, yoyo:true, repeat:3}, 0); });
    }

    /* ---- Update spray particles each frame ---- */
    updateParticles(delta) {
        this.dynamicObjects.forEach(obj => {
            if (obj.userData?.isSpray) {
                obj.userData.age += delta;
                obj.children.forEach(p => {
                    if (p.userData.vel) {
                        p.position.add(p.userData.vel);
                        p.userData.vel.multiplyScalar(0.95); // drag
                        p.userData.vel.y -= 0.0005; // gravity
                    }
                    if (p.material) {
                        p.material.opacity = Math.max(0, 0.8 - obj.userData.age * 0.8);
                    }
                });
            }
        });
    }
}
