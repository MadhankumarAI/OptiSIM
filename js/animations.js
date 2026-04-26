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

        // Compute anatomical anchors so animations land in the right spot
        this.computeAnchors();

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

    /* ---- Get lens radius from the loaded model (for sizing rings/grooves) ---- */
    getLensRadius() {
        const lensBox = this.eye.getPartBox('lens');
        if (!lensBox) return 0.22;
        const size = lensBox.getSize(new THREE.Vector3());
        return Math.min(size.x, size.y) * 0.4;
    }

    /* ---- Compute anatomical anchor positions from the loaded eye model ---- */
    computeAnchors() {
        const ec = this.eye.getEyeCenter();
        const cc = this.eye.getCorneaCenter();
        const lc = this.eye.getLensCenter();
        const lim = this.eye.getLimbusPosition('temporal');
        const lensFront = this.eye.getLensAnterior();

        // Optical axis direction (cornea -> back of eye)
        const opticalAxis = new THREE.Vector3().subVectors(cc, ec).normalize();
        // If lens is at center, fall back to z-forward
        if (opticalAxis.length() < 0.1) opticalAxis.set(0, 0, 1);

        // Approach direction: from temporal side, slightly above
        const approachDir = new THREE.Vector3(1, 0.3, 0.5).normalize();

        this.anchors = {
            eyeCenter: ec,
            corneaCenter: cc,
            lensCenter: lc,
            lensFront: lensFront,
            limbus: lim,
            opticalAxis,
            // Where tools start their approach
            approachStart: lim.clone().add(approachDir.clone().multiplyScalar(2.0)),
            // Where the tool tip rests AT the limbus (entering the eye)
            limbusEntry: lim.clone().add(approachDir.clone().multiplyScalar(0.05)),
            // Inside the anterior chamber (between cornea and lens)
            anteriorChamber: cc.clone().lerp(lc, 0.4),
            // On top of the lens capsule (where capsulorhexis happens)
            capsuleFront: lensFront,
            // Approach exit (away from eye)
            exitPoint: lim.clone().add(approachDir.clone().multiplyScalar(3.0)),
        };

        console.log('Surgical anchors:', {
            cornea: this.anchors.corneaCenter.toArray().map(n => n.toFixed(2)),
            lens: this.anchors.lensCenter.toArray().map(n => n.toFixed(2)),
            limbus: this.anchors.limbus.toArray().map(n => n.toFixed(2)),
        });
    }

    /* ---- Place an object at an anchor point (with optional offset) ---- */
    placeAt(anchorName, offset) {
        const a = this.anchors?.[anchorName];
        if (!a) return new THREE.Vector3();
        const result = a.clone();
        if (offset) result.add(new THREE.Vector3(offset.x || 0, offset.y || 0, offset.z || 0));
        return result;
    }

    /* ---- Helper: animate camera smoothly ---- */
    cam(tl, camera, controls, pos, target, dur = 1.2, at = 0) {
        tl.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: "power2.inOut" }, at);
        tl.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease: "power2.inOut", onUpdate: () => controls.update() }, at);
    }

    /* ---- Camera focused on the eye (uses anchors so it's always centered correctly) ---- */
    camFocus(tl, camera, controls, offset, dur = 1.2, at = 0) {
        if (!this.anchors) return;
        const target = this.anchors.corneaCenter.clone();
        const pos = target.clone().add(new THREE.Vector3(
            offset.x || 0, offset.y || 0.5, (offset.z || 3.5)
        ));
        this.cam(tl, camera, controls, pos, target, dur, at);
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
       STEP 1: CORNEAL INCISION (anchored to actual model)
       ============================================ */
    buildIncisionSubSteps(camera, controls) {
        const steps = [];
        const fade = () => { this.eye.setPartOpacity('eyelid', 0.1); this.eye.setPartOpacity('skin', 0.1); };
        const A = this.anchors; // anchored positions

        // Sub 0: Keratome approaches & CUTS at the limbus
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 1.5, y: 0.5, z: 3 });

            // Position keratome AT the actual limbus
            const start = A.approachStart;
            const entry = A.limbusEntry;
            const cutDeep = A.limbus.clone().add(new THREE.Vector3(0, 0, -0.05)); // push into cornea

            const keratome = this.toolEnter(tl, 'keratome',
                start, entry,
                { z: -Math.PI / 2 }, 0.8
            );

            // Push blade INTO cornea
            tl.to(keratome.position, { x: cutDeep.x, y: cutDeep.y, z: cutDeep.z,
                duration: 1.8, ease: "power1.inOut" }, 2.0);

            // CONTACT FLASH AT THE LIMBUS
            tl.add(() => {
                const flash = this.createContactFlash(A.limbus.x, A.limbus.y, A.limbus.z, 0xff4444);
                gsap.to(flash.scale, { x: 3, y: 3, z: 3, duration: 0.3 });
                gsap.to(flash.material, { opacity: 0, duration: 0.5 });
            }, 2.5);

            // WOUND ON THE CORNEA at the limbus position
            const wound = this.createWound(A.limbus.x, A.limbus.y, A.limbus.z + 0.02, 0.18, 0.06);
            wound.lookAt(A.eyeCenter); // orient wound toward eye center
            this.animateWoundOpen(tl, wound, 2.8, 1.0);

            // Tissue spray at incision position
            tl.add(() => {
                this.createSpray(A.limbus.clone().add(new THREE.Vector3(0, 0, 0.05)), 20, 0xff8888, 0.18);
            }, 2.8);

            // Cornea responds visually
            this.eye.getPart('cornea').forEach(m => {
                if (m.material) {
                    tl.to(m.material, { opacity: 0.22, duration: 0.3 }, 2.8);
                    tl.to(m.material, { opacity: 0.12, duration: 0.5 }, 3.3);
                }
            });

            // Withdraw blade
            this.toolExit(tl, 'keratome', A.exitPoint, 4.5);

            steps.push({ timeline: tl, label: "Main Corneal Incision", description: "Keratome blade enters at the temporal limbus (cornea-sclera junction) and creates a 2.4mm self-sealing tunnel. Watch the blade reach the limbus and the wound open exactly there.", icon: "fa-cut" });
        })();

        // Sub 1: Side-port cut at nasal limbus (opposite side)
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);

            // Nasal side = opposite of temporal
            const nasalLimbus = this.eye.getLimbusPosition('nasal');
            const cornea = A.corneaCenter;
            const camOffset = nasalLimbus.clone().sub(cornea).normalize().multiplyScalar(2.5);
            this.cam(tl, camera, controls,
                cornea.clone().add(camOffset).add(new THREE.Vector3(0, 0.5, 0.5)),
                cornea.clone(), 1.0);

            const approach = nasalLimbus.clone().add(new THREE.Vector3(-2, 0.5, 1));
            const entry = nasalLimbus.clone().add(new THREE.Vector3(-0.05, 0.05, 0.05));

            const blade = this.toolEnter(tl, 'sideport_blade',
                approach, entry,
                { y: Math.PI / 3, z: Math.PI / 2 }, 0.7
            );

            // Stab into nasal limbus
            tl.to(blade.position, { x: nasalLimbus.x, y: nasalLimbus.y, z: nasalLimbus.z,
                duration: 0.6, ease: "power2.out" }, 2.0);

            // Contact flash
            tl.add(() => {
                const f = this.createContactFlash(nasalLimbus.x, nasalLimbus.y, nasalLimbus.z + 0.03, 0xff4444);
                gsap.to(f.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.3 });
                gsap.to(f.material, { opacity: 0, duration: 0.5 });
            }, 2.3);

            // Side wound at the right place
            const sideWound = this.createWound(nasalLimbus.x, nasalLimbus.y, nasalLimbus.z + 0.02, 0.06, 0.03, Math.PI / 4);
            sideWound.lookAt(A.eyeCenter);
            this.animateWoundOpen(tl, sideWound, 2.3, 0.6);

            tl.add(() => this.createSpray(nasalLimbus.clone().add(new THREE.Vector3(0,0,0.05)), 12, 0xffaaaa, 0.1), 2.4);

            this.toolExit(tl, 'sideport_blade', approach, 3.0);

            steps.push({ timeline: tl, label: "Side-Port Incision", description: "A 1mm stab incision at the nasal limbus (opposite side). Provides access for the second instrument during phaco.", icon: "fa-slash" });
        })();

        // Sub 2: Inject viscoelastic into anterior chamber
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 1.5, y: 0.8, z: 3.5 });

            // Syringe approaches through main incision
            const start = A.approachStart;
            const tipInChamber = A.anteriorChamber;

            const syringe = this.toolEnter(tl, 'syringe',
                start, A.limbusEntry,
                { x: 0.2, y: -0.3, z: -Math.PI / 2 }, 0.6
            );

            tl.to(syringe.position, { x: tipInChamber.x, y: tipInChamber.y, z: tipInChamber.z,
                duration: 1.0, ease: "power1.inOut" }, 2.0);

            // Plunger pushes
            const plunger = syringe.getObjectByName('plunger');
            if (plunger) tl.to(plunger.position, { y: 0.5, duration: 2.5 }, 2.5);

            // Viscoelastic bubble FILLS the anterior chamber AT the right place
            const ovdGeo = new THREE.SphereGeometry(0.01, 24, 24);
            const ovdMat = new THREE.MeshPhysicalMaterial({
                color: 0xd0e8ff, transparent: true, opacity: 0,
                roughness: 0, metalness: 0,
            });
            const ovdBubble = new THREE.Mesh(ovdGeo, ovdMat);
            ovdBubble.position.copy(tipInChamber);
            this.scene.add(ovdBubble);
            this.dynamicObjects.push(ovdBubble);

            tl.to(ovdMat, { opacity: 0.35, duration: 1.0 }, 2.8);
            // Scale to fill the anterior chamber (size based on cornea-to-lens distance)
            const acDist = A.corneaCenter.distanceTo(A.lensCenter);
            const fillScale = (acDist / 0.01) * 0.4;
            tl.to(ovdBubble.scale, { x: fillScale, y: fillScale, z: fillScale * 0.7,
                duration: 2.5, ease: "power1.out" }, 2.8);

            // Anterior chamber part becomes visible too
            this.eye.getPart('anterior_chamber').forEach(m => {
                if (m.material) tl.to(m.material, { opacity: 0.25, duration: 1.5 }, 3.0);
            });

            this.toolExit(tl, 'syringe', A.exitPoint, 5.5);

            steps.push({ timeline: tl, label: "Inject Viscoelastic (OVD)", description: "Gel-like viscoelastic injected through the corneal wound. Watch it fill the anterior chamber (between cornea and iris), inflating it to protect the cornea and create working space.", icon: "fa-syringe" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 2: CAPSULORHEXIS (anchored to actual lens)
       ============================================ */
    buildCapsulorhexisSubSteps(camera, controls) {
        const steps = [];
        const A = this.anchors;
        const fade = () => {
            this.eye.setPartOpacity('eyelid', 0.05); this.eye.setPartOpacity('skin', 0.05);
            this.eye.setPartOpacity('cornea', 0.06); this.eye.setPartOpacity('sclera', 0.3);
        };

        // Lens size for sizing the tear ring properly
        const lensBox = this.eye.getPartBox('lens');
        const lensRadius = lensBox ? Math.min(lensBox.getSize(new THREE.Vector3()).x, lensBox.getSize(new THREE.Vector3()).y) * 0.35 : 0.22;

        // Sub 0: Stain capsule blue (dye lands ON the lens)
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 0, y: 2, z: 2.8 });

            const syringe = this.toolEnter(tl, 'syringe',
                A.approachStart, A.anteriorChamber,
                { x: 0.2, y: -0.3, z: -Math.PI / 2 }, 0.5
            );

            // Blue dye spreads across lens FRONT (capsule)
            const dyeGeo = new THREE.CircleGeometry(0.01, 32);
            const dyeMat = new THREE.MeshBasicMaterial({
                color: 0x1a3db3, side: THREE.DoubleSide, transparent: true, opacity: 0,
            });
            const dye = new THREE.Mesh(dyeGeo, dyeMat);
            dye.position.copy(A.lensFront);
            // Orient dye disc to face the camera/cornea
            dye.lookAt(A.corneaCenter);
            this.scene.add(dye);
            this.dynamicObjects.push(dye);

            tl.to(dyeMat, { opacity: 0.65, duration: 1.0 }, 2.5);
            tl.to(dye.scale, { x: lensRadius * 100, y: lensRadius * 100, duration: 2.0, ease: "power1.out" }, 2.5);

            // Lens itself turns blue
            this.eye.getPart('lens').forEach(m => {
                if (m.material?.color) tl.to(m.material.color, { r: 0.15, g: 0.25, b: 0.7, duration: 2.0 }, 2.5);
                if (m.material) tl.to(m.material, { opacity: 0.85, duration: 1.5 }, 2.5);
            });

            this.toolExit(tl, 'syringe', A.exitPoint, 4.5);

            steps.push({ timeline: tl, label: "Trypan Blue Staining", description: "Blue dye injected onto the lens capsule. Watch it spread across the front of the lens, making the transparent membrane visible for the circular tear.", icon: "fa-tint" });
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
                A.approachStart, A.anteriorChamber,
                { y: -0.5, z: -Math.PI / 2 }, 0.7
            );

            // STAB into the lens front (capsule)
            tl.to(cystotome.position, { x: A.lensFront.x, y: A.lensFront.y, z: A.lensFront.z,
                duration: 0.25, ease: "power3.out" }, 2.3);

            // PUNCTURE FLASH AT THE LENS
            tl.add(() => {
                const f = this.createContactFlash(A.lensFront.x, A.lensFront.y, A.lensFront.z, 0xff2222);
                gsap.to(f.scale, { x: 2.5, y: 2.5, z: 2.5, duration: 0.2 });
                gsap.to(f.material, { opacity: 0, duration: 0.4 });
                this.createSpray(A.lensFront.clone(), 10, 0x3355cc, 0.08);
            }, 2.4);

            // Puncture hole AT the lens front
            const holeGeo = new THREE.CircleGeometry(0.025, 16);
            const holeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a1a, side: THREE.DoubleSide, transparent: true, opacity: 0 });
            const hole = new THREE.Mesh(holeGeo, holeMat);
            hole.position.copy(A.lensFront);
            hole.lookAt(A.corneaCenter);
            this.scene.add(hole);
            this.dynamicObjects.push(hole);
            tl.to(holeMat, { opacity: 0.9, duration: 0.3 }, 2.5);

            // Needle drags slightly to initiate the flap
            tl.to(cystotome.position, {
                x: A.lensFront.x - 0.05,
                y: A.lensFront.y + 0.08,
                duration: 0.8, ease: "power1.inOut"
            }, 2.8);

            this.toolExit(tl, 'cystotome', A.exitPoint, 3.8);

            steps.push({ timeline: tl, label: "Puncture Capsule", description: "Cystotome needle stabs through the anterior lens capsule — the puncture appears exactly on the front surface of the lens.", icon: "fa-crosshairs" });
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
                A.approachStart, A.lensFront,
                { y: -0.3 }, 0.5
            );

            // Build orientation basis at lens front so the ring lays ON the lens
            const normal = new THREE.Vector3().subVectors(A.corneaCenter, A.lensCenter).normalize();
            const upTmp = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
            const right = new THREE.Vector3().crossVectors(normal, upTmp).normalize();
            const up = new THREE.Vector3().crossVectors(right, normal).normalize();
            const center = A.lensFront;

            const tearRadius = lensRadius;
            const totalDots = 50;
            const tearDuration = 4.0;

            for (let i = 0; i < totalDots; i++) {
                const angle = (i / totalDots) * Math.PI * 2;
                // Position each dot on the lens-front plane
                const offsetVec = right.clone().multiplyScalar(Math.cos(angle) * tearRadius)
                    .add(up.clone().multiplyScalar(Math.sin(angle) * tearRadius));
                const dotPos = center.clone().add(offsetVec);

                const dot = new THREE.Mesh(
                    new THREE.CircleGeometry(0.012, 8),
                    new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide, transparent: true, opacity: 0 })
                );
                dot.position.copy(dotPos);
                dot.lookAt(A.corneaCenter);
                this.scene.add(dot);
                this.dynamicObjects.push(dot);

                const t = 2.0 + (i / totalDots) * tearDuration;
                tl.to(dot.material, { opacity: 0.95, duration: 0.1 }, t);

                // Move forceps tip along the actual circle
                if (i % 5 === 0) {
                    tl.to(forceps.position, {
                        x: dotPos.x, y: dotPos.y, z: dotPos.z,
                        duration: tearDuration / 10, ease: "none",
                    }, t);
                }

                if (i % 8 === 0) {
                    tl.add(() => {
                        const spark = this.createContactFlash(dotPos.x, dotPos.y, dotPos.z, 0xff4444);
                        gsap.to(spark.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.2 });
                        gsap.to(spark.material, { opacity: 0, duration: 0.3 });
                    }, t);
                }
            }

            // Dark circular opening AT the lens front
            const openingGeo = new THREE.CircleGeometry(tearRadius - 0.015, 48);
            const openingMat = new THREE.MeshBasicMaterial({
                color: 0x0a0a15, side: THREE.DoubleSide, transparent: true, opacity: 0,
            });
            const opening = new THREE.Mesh(openingGeo, openingMat);
            opening.position.copy(center);
            opening.lookAt(A.corneaCenter);
            this.scene.add(opening);
            this.dynamicObjects.push(opening);
            tl.to(openingMat, { opacity: 0.85, duration: 1.0 }, 5.5);

            // Glowing ring around the opening (highlights the completed tear)
            const glowRing = new THREE.Mesh(
                new THREE.RingGeometry(tearRadius - 0.02, tearRadius + 0.02, 48),
                new THREE.MeshBasicMaterial({ color: 0x00d4aa, side: THREE.DoubleSide, transparent: true, opacity: 0 })
            );
            glowRing.position.copy(center);
            glowRing.lookAt(A.corneaCenter);
            this.scene.add(glowRing);
            this.dynamicObjects.push(glowRing);
            tl.to(glowRing.material, { opacity: 0.6, duration: 0.5 }, 6.0);
            tl.to(glowRing.material, { opacity: 0.2, duration: 1.0 }, 6.5);

            this.toolExit(tl, 'forceps', A.exitPoint, 6.5);

            steps.push({ timeline: tl, label: "Tear Circular Opening", description: "Forceps grip the capsule flap and tear it in a perfect circle. Watch each point of the tear appear as the instrument moves around.", icon: "fa-circle-notch" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 3: PHACOEMULSIFICATION (anchored)
       ============================================ */
    buildPhacoSubSteps(camera, controls) {
        const steps = [];
        const A = this.anchors;
        const fade = () => {
            this.eye.setPartOpacity('eyelid', 0.05); this.eye.setPartOpacity('skin', 0.05);
            this.eye.setPartOpacity('cornea', 0.05); this.eye.setPartOpacity('sclera', 0.18);
        };

        // Sub 0: Hydrodissection — fluid jet separates lens from capsule
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 1, y: 1.5, z: 3 });

            const cannula = this.toolEnter(tl, 'cannula',
                A.approachStart, A.lensFront,
                { y: -0.3, z: -Math.PI / 2 }, 0.7
            );

            // Fluid wave AT the lens position
            const lens = this.eye.getPart('lens');
            tl.add(() => {
                const wave = this.createContactFlash(A.lensFront.x, A.lensFront.y, A.lensFront.z, 0x88ccff);
                gsap.to(wave.scale, { x: 6, y: 6, z: 3, duration: 0.5 });
                gsap.to(wave.material, { opacity: 0, duration: 0.8 });
            }, 2.5);

            // Lens physically bounces
            const lensJumpDir = A.opticalAxis.clone().multiplyScalar(0.1);
            lens.forEach(m => {
                const orig = m.position.clone();
                tl.to(m.position, { x: orig.x + lensJumpDir.x, y: orig.y + lensJumpDir.y, z: orig.z + lensJumpDir.z,
                    duration: 0.4, ease: "power2.out" }, 2.5);
                tl.to(m.position, { x: orig.x, y: orig.y, z: orig.z, duration: 0.4, ease: "bounce.out" }, 2.9);
            });

            this.toolExit(tl, 'cannula', A.exitPoint, 3.5);

            steps.push({ timeline: tl, label: "Hydrodissection", description: "Fluid wave injected under the lens capsule. Watch the lens physically bounce at its actual position as the fluid jet separates it from the capsule.", icon: "fa-water" });
        })();

        // Sub 1: Phaco sculpts grooves AT the lens & BREAKS it
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 0.5, y: 2, z: 2.8 });

            const phaco = this.toolEnter(tl, 'phaco_probe',
                A.approachStart, A.lensFront,
                { x: Math.PI, z: Math.PI / 4 }, 0.5
            );

            // Position phaco tip on the lens
            tl.to(phaco.position, { x: A.lensCenter.x, y: A.lensCenter.y, z: A.lensCenter.z,
                duration: 0.5 }, 1.8);

            // Visible vibration
            tl.to(phaco.position, { x: "+=0.008", duration: 0.025, yoyo: true, repeat: 200, ease: "none" }, 2.0);

            const vibe = phaco.getObjectByName('vibe_indicator');
            if (vibe) tl.to(vibe.material, { opacity: 1, duration: 0.1, yoyo: true, repeat: 50 }, 2.0);

            // Build orientation basis at lens for groove orientation
            const normal = A.opticalAxis.clone();
            const upTmp = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
            const right = new THREE.Vector3().crossVectors(normal, upTmp).normalize();
            const up = new THREE.Vector3().crossVectors(right, normal).normalize();
            const grooveSize = this.getLensRadius() * 1.4;

            // GROOVE 1 (vertical) AT the lens
            const groove1 = new THREE.Mesh(
                new THREE.PlaneGeometry(0.008, grooveSize),
                new THREE.MeshBasicMaterial({ color: 0x442200, side: THREE.DoubleSide, transparent: true, opacity: 0 })
            );
            groove1.position.copy(A.lensFront);
            groove1.lookAt(A.corneaCenter);
            this.scene.add(groove1);
            this.dynamicObjects.push(groove1);
            tl.to(groove1.material, { opacity: 0.95, duration: 1.5 }, 2.5);

            // Debris spraying
            tl.add(() => this.createSpray(A.lensCenter.clone(), 25, 0xc8b88a, 0.18), 2.8);
            tl.add(() => this.createSpray(A.lensCenter.clone(), 18, 0xc8b88a, 0.15), 3.3);

            // GROOVE 2 (horizontal)
            const groove2 = new THREE.Mesh(
                new THREE.PlaneGeometry(grooveSize, 0.008),
                new THREE.MeshBasicMaterial({ color: 0x442200, side: THREE.DoubleSide, transparent: true, opacity: 0 })
            );
            groove2.position.copy(A.lensFront);
            groove2.lookAt(A.corneaCenter);
            this.scene.add(groove2);
            this.dynamicObjects.push(groove2);
            tl.to(groove2.material, { opacity: 0.95, duration: 1.5 }, 4.0);

            tl.add(() => this.createSpray(A.lensCenter.clone(), 22, 0xc8b88a, 0.16), 4.5);

            // CRACK — flash at lens center
            tl.add(() => {
                const crack = this.createContactFlash(A.lensCenter.x, A.lensCenter.y, A.lensCenter.z, 0xffaa00);
                gsap.to(crack.scale, { x: 5, y: 5, z: 5, duration: 0.3 });
                gsap.to(crack.material, { opacity: 0, duration: 0.5 });
            }, 5.5);

            // Lens fades
            this.eye.getPart('lens').forEach(m => {
                if (m.material) tl.to(m.material, { opacity: 0.1, duration: 0.5 }, 5.5);
            });

            // FRAGMENTS APPEAR AT THE LENS
            const fragments = this.createLensFragments(8);
            fragments.forEach((frag, i) => {
                frag.position.copy(A.lensCenter);
                frag.material.opacity = 0;
                const a = (i / fragments.length) * Math.PI * 2;
                const burstOffset = right.clone().multiplyScalar(Math.cos(a) * 0.08)
                    .add(up.clone().multiplyScalar(Math.sin(a) * 0.08));
                tl.to(frag.material, { opacity: 0.9, duration: 0.3 }, 5.6);
                tl.to(frag.position, {
                    x: A.lensCenter.x + burstOffset.x,
                    y: A.lensCenter.y + burstOffset.y,
                    z: A.lensCenter.z + burstOffset.z,
                    duration: 0.4, ease: "power2.out"
                }, 5.6);
            });

            steps.push({ timeline: tl, label: "Sculpt & Crack Nucleus", description: "Phaco probe vibrates at ultrasonic speed AT the lens, carving grooves directly into it. Then CRACK — the lens splits into fragments at its actual position.", icon: "fa-bolt" });
        })();

        // Sub 2: Emulsify and aspirate — fragments sucked toward probe tip
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 0, y: 2, z: 3 });

            tl.add(() => this.eye.setPartVisibility('lens', false), 0);

            const fragments = this.createLensFragments(8);
            // Fragments scattered around the lens center
            fragments.forEach((frag, i) => {
                const a = (i / fragments.length) * Math.PI * 2;
                frag.position.copy(A.lensCenter).add(new THREE.Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0));
            });

            const phaco = this.toolEnter(tl, 'phaco_probe',
                A.approachStart, A.lensCenter,
                { x: Math.PI, z: Math.PI / 4 }, 0.5
            );

            tl.to(phaco.position, { x: "+=0.008", duration: 0.025, yoyo: true, repeat: 300, ease: "none" }, 2.0);

            // Each fragment SUCKED toward probe tip (lens center)
            fragments.forEach((frag, i) => {
                const delay = 2.0 + i * 0.7;
                tl.to(frag.position, { x: "+=0.012", duration: 0.03, yoyo: true, repeat: 15, ease: "none" }, delay);
                tl.to(frag.position, {
                    x: A.lensCenter.x, y: A.lensCenter.y, z: A.lensCenter.z,
                    duration: 0.6, ease: "power2.in",
                }, delay + 0.3);
                tl.to(frag.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 0.5 }, delay + 0.5);
                tl.to(frag.material, { opacity: 0, duration: 0.4 }, delay + 0.6);
                tl.add(() => this.createSpray(A.lensCenter.clone(), 12, 0xddccaa, 0.1), delay + 0.5);
            });

            this.toolExit(tl, 'phaco_probe', A.exitPoint, 8.5);

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
        const A = this.anchors;
        const fade = () => {
            this.eye.setPartOpacity('eyelid', 0.05); this.eye.setPartOpacity('skin', 0.05);
            this.eye.setPartOpacity('cornea', 0.06); this.eye.setPartOpacity('sclera', 0.2);
            this.eye.setPartVisibility('lens', false);
        };

        // Sub 0: IOL injector enters through incision and squeezes IOL into capsule
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 1.5, y: 1, z: 3 });

            const injector = this.toolEnter(tl, 'iol_injector',
                A.approachStart, A.limbusEntry,
                { x: Math.PI, y: 0.2, z: Math.PI / 4 }, 0.45
            );

            // Push tip into anterior chamber, toward the empty capsular bag (lens position)
            tl.to(injector.position, { x: A.lensCenter.x, y: A.lensCenter.y, z: A.lensCenter.z + 0.05,
                duration: 1.5, ease: "power1.inOut" }, 2.0);

            const plunger = injector.getObjectByName('plunger');
            if (plunger) tl.to(plunger.position, { y: 0.2, duration: 2.5 }, 3.0);

            // IOL emerges AT the lens position (where the empty capsular bag is)
            const iol = this.eye.getPart('iol');
            tl.add(() => {
                iol.forEach(m => {
                    m.visible = true;
                    m.scale.set(0.02, 0.02, 0.02);
                    m.position.copy(A.lensCenter).add(new THREE.Vector3(0.05, 0, 0));
                });
            }, 4.0);

            // IOL squeezes out
            iol.forEach(m => {
                tl.to(m.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 0.8, ease: "power2.out" }, 4.2);
                tl.to(m.position, { x: A.lensCenter.x, duration: 0.8 }, 4.2);
            });

            // Flash at IOL position
            tl.add(() => {
                const f = this.createContactFlash(A.lensCenter.x, A.lensCenter.y, A.lensCenter.z, 0x44aaff);
                gsap.to(f.scale, { x: 2.5, y: 2.5, z: 2.5, duration: 0.3 });
                gsap.to(f.material, { opacity: 0, duration: 0.5 });
            }, 4.3);

            // IOL UNFOLDS with elastic spring AT lens position
            iol.forEach(m => {
                tl.to(m.scale, { x: 1, y: 1, z: 1, duration: 1.5, ease: "elastic.out(1, 0.3)" }, 5.0);
            });

            this.toolExit(tl, 'iol_injector', A.exitPoint, 5.5);

            steps.push({ timeline: tl, label: "Inject & Unfold IOL", description: "IOL injector enters through the corneal wound, advances to where the lens used to be, and the artificial IOL unfurls inside the empty capsular bag.", icon: "fa-compress-arrows-alt" });
        })();

        // Sub 1: Sinskey hook centers IOL on the visual axis
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(fade, 0);
            this.camFocus(tl, camera, controls, { x: 0, y: 2, z: 2.8 });

            const iol = this.eye.getPart('iol');
            // IOL starts slightly off-center
            const offCenter = A.lensCenter.clone().add(new THREE.Vector3(0.1, -0.05, 0.02));
            tl.add(() => {
                iol.forEach(m => {
                    m.visible = true; m.scale.set(1, 1, 1);
                    m.position.copy(offCenter);
                    m.rotation.set(0, 0, 0.15);
                });
            }, 0);

            const hook = this.toolEnter(tl, 'sinskey_hook',
                A.approachStart, offCenter,
                { y: -0.5, z: -Math.PI / 2 }, 0.6
            );

            // Hook dials IOL into the center (visual axis)
            iol.forEach(m => {
                tl.to(m.rotation, { z: 0, duration: 1.5, ease: "power2.inOut" }, 2.5);
                tl.to(m.position, { x: A.lensCenter.x, y: A.lensCenter.y, z: A.lensCenter.z,
                    duration: 2.0, ease: "power2.inOut" }, 2.5);
            });

            // Hook follows the IOL
            tl.to(hook.position, { x: A.lensCenter.x + 0.05, y: A.lensCenter.y + 0.05, z: A.lensCenter.z,
                duration: 1.5, ease: "power1.inOut" }, 2.5);

            // CENTERED flash at lens center
            tl.add(() => {
                const f = this.createContactFlash(A.lensCenter.x, A.lensCenter.y, A.lensCenter.z, 0x00ff88);
                gsap.to(f.scale, { x: 4, y: 4, z: 4, duration: 0.4 });
                gsap.to(f.material, { opacity: 0, duration: 0.6 });
            }, 4.5);

            this.toolExit(tl, 'sinskey_hook', A.exitPoint, 5.0);

            steps.push({ timeline: tl, label: "Center IOL on Visual Axis", description: "Sinskey hook dials the IOL into the geometric center of the lens position. The implant locks onto the visual axis — exactly where the natural lens used to focus light.", icon: "fa-bullseye" });
        })();

        this.subStepTimelines = steps;
        return steps;
    }

    /* ============================================
       STEP 5: WOUND CLOSURE
       ============================================ */
    buildClosureSubSteps(camera, controls) {
        const steps = [];
        const A = this.anchors;

        const setupDone = () => {
            this.eye.setPartOpacity('eyelid', 0.1); this.eye.setPartOpacity('skin', 0.1);
            this.eye.setPartVisibility('lens', false);
            this.eye.getPart('iol').forEach(m => {
                m.visible = true; m.scale.set(1, 1, 1);
                m.position.copy(A.lensCenter);
            });
        };

        // Sub 0: Aspirate OVD from anterior chamber
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(setupDone, 0);
            this.eye.setPartOpacity('cornea', 0.08);
            this.eye.setPartOpacity('sclera', 0.3);
            this.camFocus(tl, camera, controls, { x: 1, y: 1, z: 3.5 });

            const ia = this.toolEnter(tl, 'ia_handpiece',
                A.approachStart, A.anteriorChamber,
                { x: Math.PI, z: Math.PI / 4 }, 0.5
            );

            // OVD cloud at the anterior chamber
            const ovdCloud = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 16, 16),
                new THREE.MeshPhysicalMaterial({ color: 0xd0e8ff, transparent: true, opacity: 0.25 })
            );
            ovdCloud.position.copy(A.anteriorChamber);
            this.scene.add(ovdCloud);
            this.dynamicObjects.push(ovdCloud);

            // OVD shrinks as it's aspirated toward the probe
            tl.to(ovdCloud.scale, { x: 0.1, y: 0.1, z: 0.1, duration: 3.0, ease: "power1.in" }, 2.0);
            tl.to(ovdCloud.material, { opacity: 0, duration: 2.5 }, 2.5);

            // Suction particles around the chamber
            for (let i = 0; i < 5; i++) {
                tl.add(() => {
                    const r = 0.15;
                    this.createSpray(A.anteriorChamber.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * r, (Math.random() - 0.5) * r, (Math.random() - 0.5) * r
                    )), 6, 0xaaccee, 0.05);
                }, 2.5 + i * 0.5);
            }

            this.toolExit(tl, 'ia_handpiece', A.exitPoint, 5.0);

            steps.push({ timeline: tl, label: "Aspirate Viscoelastic", description: "I/A probe enters the anterior chamber and removes all remaining viscoelastic gel to prevent post-op pressure spike.", icon: "fa-exchange-alt" });
        })();

        // Sub 1: Hydrate corneal wound shut at the limbus
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(setupDone, 0);
            this.camFocus(tl, camera, controls, { x: 1.5, y: 0.3, z: 3.2 });

            const cannula = this.toolEnter(tl, 'cannula',
                A.approachStart, A.limbus,
                { y: -0.2, z: -Math.PI / 2 }, 0.7
            );

            // Hydration flash at the actual incision site (limbus)
            tl.add(() => {
                const hydro = this.createContactFlash(A.limbus.x, A.limbus.y, A.limbus.z + 0.03, 0x66bbff);
                gsap.to(hydro.scale, { x: 3.5, y: 3.5, z: 3.5, duration: 0.5 });
                gsap.to(hydro.material, { opacity: 0, duration: 1.0 });
            }, 2.5);

            // Cornea seals
            this.eye.getPart('cornea').forEach(m => {
                if (m.material) {
                    tl.to(m.material, { opacity: 0.22, duration: 0.8 }, 2.5);
                    tl.to(m.material, { opacity: 0.15, duration: 1.5 }, 3.5);
                }
            });

            // Green confirmation flash at the wound site
            tl.add(() => {
                const seal = this.createContactFlash(A.limbus.x, A.limbus.y, A.limbus.z + 0.03, 0x00ff88);
                gsap.to(seal.scale, { x: 5, y: 5, z: 5, duration: 0.5 });
                gsap.to(seal.material, { opacity: 0, duration: 0.8 });
            }, 4.0);

            this.toolExit(tl, 'cannula', A.exitPoint, 4.5);

            steps.push({ timeline: tl, label: "Hydrate & Seal Wound", description: "BSS injected into the wound edges at the temporal limbus. Corneal stroma swells and seals the incision watertight — green flash confirms the seal.", icon: "fa-tint" });
        })();

        // Sub 2: Final triumphant view
        (() => {
            const tl = gsap.timeline({ paused: true });
            tl.add(setupDone, 0);

            tl.add(() => {
                this.eye.setPartOpacity('sclera', 1); this.eye.setPartOpacity('cornea', 0.15);
                this.eye.setPartOpacity('eyelid', 0.7); this.eye.setPartOpacity('skin', 0.7);
            }, 0.5);

            this.camFocus(tl, camera, controls, { x: 0, y: 0, z: 4.5 });

            tl.to(this.eye.group.rotation, { y: Math.PI * 2, duration: 8, ease: "power1.inOut" }, 1.0);

            // IOL sparkle at the lens center
            tl.add(() => {
                const sparkle = this.createContactFlash(A.lensCenter.x, A.lensCenter.y, A.lensCenter.z, 0x44aaff);
                gsap.to(sparkle.scale, { x: 6, y: 6, z: 6, duration: 1.0 });
                gsap.to(sparkle.material, { opacity: 0, duration: 1.5 });
            }, 2.0);

            steps.push({ timeline: tl, label: "Surgery Complete!", description: "The eye is sealed, the new IOL is centered on the visual axis. The patient's cloudy vision will now be crystal clear.", icon: "fa-check-circle" });
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
