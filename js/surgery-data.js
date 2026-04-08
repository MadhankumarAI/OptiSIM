/* ============================================
   Surgery Data - Cataract (Phacoemulsification)
   Complete step definitions, complications,
   instruments, and camera positions.
   ============================================ */

const SURGERY_STEPS = [
    {
        id: 0,
        name: "Anesthesia & Preparation",
        shortName: "Prep",
        icon: "fa-syringe",
        duration: "5-10 min",
        description: "The eye is numbed using topical anesthetic drops (proparacaine or tetracaine). The area around the eye is cleaned with povidone-iodine antiseptic. A sterile drape is placed and a lid speculum holds the eyelids open.",
        details: [
            "Topical anesthetic drops applied to corneal surface",
            "Povidone-iodine 5% antiseptic applied to conjunctival sac",
            "Sterile ophthalmic drape positioned over the eye",
            "Wire lid speculum inserted to retract eyelids",
            "Operating microscope centered and focused on the eye"
        ],
        instruments: [
            { name: "Topical Anesthetic", icon: "fa-eye-dropper" },
            { name: "Povidone-Iodine", icon: "fa-flask" },
            { name: "Lid Speculum", icon: "fa-expand-alt" },
            { name: "Surgical Microscope", icon: "fa-microscope" }
        ],
        riskLevel: "low",
        cameraPosition: { x: 0, y: 0, z: 5 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        // Which eye parts to highlight/show
        highlightParts: ["sclera", "cornea", "eyelid"],
        animationType: "prep",
        complications: [
            {
                name: "Allergic Reaction",
                severity: "mild",
                frequency: "1 in 1,000",
                description: "Patient may develop allergic reaction to topical anesthetic or antiseptic. Signs include conjunctival swelling (chemosis) and redness.",
                consequence: "Surgery may need to be delayed. Alternative anesthetic used.",
                visualEffect: "redness"
            },
            {
                name: "Inadequate Anesthesia",
                severity: "mild",
                frequency: "1 in 200",
                description: "Patient experiences pain during procedure due to insufficient numbing. More common in patients with prior eye inflammation.",
                consequence: "Additional anesthetic drops or sub-Tenon's block may be needed.",
                visualEffect: "none"
            },
            {
                name: "Globe Perforation (Retrobulbar Block)",
                severity: "severe",
                frequency: "1 in 10,000",
                description: "If a needle-based anesthetic block is used instead of topical, the needle can inadvertently penetrate the eye wall (sclera), causing vitreous hemorrhage.",
                consequence: "Immediate surgical emergency. Surgery canceled. Risk of permanent vision loss.",
                visualEffect: "perforation"
            }
        ]
    },
    {
        id: 1,
        name: "Corneal Incision",
        shortName: "Incision",
        icon: "fa-cut",
        duration: "1-2 min",
        description: "A small (2.2-2.8mm) clear corneal incision is made at the limbus (junction of cornea and sclera) using a keratome blade. A secondary paracentesis (side port) incision is also created for instrument access.",
        details: [
            "Primary incision: 2.2-2.8mm clear corneal tunnel at temporal limbus",
            "Keratome blade creates a self-sealing tri-planar incision",
            "Side-port incision (1mm) created 60-90 degrees away",
            "Viscoelastic (OVD) injected to maintain anterior chamber depth",
            "Incision architecture is critical for self-sealing wound closure"
        ],
        instruments: [
            { name: "Keratome Blade", icon: "fa-cut" },
            { name: "Side-Port Blade", icon: "fa-slash" },
            { name: "Viscoelastic Syringe", icon: "fa-syringe" },
            { name: "Caliper", icon: "fa-ruler" }
        ],
        riskLevel: "medium",
        cameraPosition: { x: 2, y: 1, z: 4 },
        cameraTarget: { x: 0.3, y: 0, z: 0 },
        highlightParts: ["cornea", "limbus"],
        animationType: "incision",
        complications: [
            {
                name: "Descemet's Membrane Detachment",
                severity: "moderate",
                frequency: "1 in 500",
                description: "The innermost layer of the cornea (Descemet's membrane) separates from the corneal stroma during incision. Causes localized corneal edema.",
                consequence: "Persistent corneal swelling. May require air/SF6 gas injection to reattach. Rarely needs corneal transplant.",
                visualEffect: "cornea_clouding"
            },
            {
                name: "Wound Leak",
                severity: "moderate",
                frequency: "1 in 100",
                description: "The corneal incision fails to self-seal, allowing aqueous humor to leak. Tested with Seidel test (fluorescein dye).",
                consequence: "Shallow anterior chamber, risk of endophthalmitis. May need suturing.",
                visualEffect: "leak"
            },
            {
                name: "Iris Prolapse",
                severity: "moderate",
                frequency: "1 in 200",
                description: "Iris tissue herniates through the corneal incision, especially if incision is too large or patient has floppy iris syndrome (IFIS).",
                consequence: "Iris damage, irregular pupil. Must reposition iris and may need to enlarge incision.",
                visualEffect: "iris_prolapse"
            }
        ]
    },
    {
        id: 2,
        name: "Capsulorhexis",
        shortName: "Rhexis",
        icon: "fa-circle-notch",
        duration: "1-3 min",
        description: "A continuous curvilinear capsulorhexis (CCC) is performed — a circular opening is torn in the anterior lens capsule using a cystotome needle or forceps. This is considered the most critical step requiring the most surgical skill.",
        details: [
            "Anterior capsule is stained with trypan blue dye for visibility",
            "Cystotome needle punctures the central anterior capsule",
            "A circular flap is initiated and carefully torn in a continuous circle",
            "Target diameter: 5.0-5.5mm (slightly smaller than IOL optic)",
            "Must overlap the IOL optic 360 degrees for stability"
        ],
        instruments: [
            { name: "Cystotome Needle", icon: "fa-crosshairs" },
            { name: "Utrata Forceps", icon: "fa-hand-scissors" },
            { name: "Trypan Blue Dye", icon: "fa-tint" },
            { name: "Viscoelastic", icon: "fa-syringe" }
        ],
        riskLevel: "high",
        cameraPosition: { x: 0, y: 2, z: 3.5 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        highlightParts: ["capsule", "lens", "anterior_capsule"],
        animationType: "capsulorhexis",
        complications: [
            {
                name: "Radial Tear (Runaway Rhexis)",
                severity: "severe",
                frequency: "1 in 50",
                description: "The circular tear extends radially toward the equator of the lens capsule, potentially reaching the posterior capsule. Most feared complication of this step.",
                consequence: "Cannot safely perform phacoemulsification. May convert to extracapsular extraction. Risk of vitreous loss, lens fragment drop.",
                visualEffect: "capsule_tear"
            },
            {
                name: "Capsule Too Small",
                severity: "moderate",
                frequency: "1 in 100",
                description: "Capsulorhexis diameter is too small (<4mm), making lens removal difficult and IOL positioning problematic.",
                consequence: "Anterior capsule contraction syndrome. IOL may decenter. Can cause capsular phimosis requiring YAG laser later.",
                visualEffect: "small_opening"
            },
            {
                name: "Capsule Too Large",
                severity: "moderate",
                frequency: "1 in 100",
                description: "Capsulorhexis diameter exceeds 6mm. The opening does not overlap the IOL optic edge.",
                consequence: "IOL instability, decentration. Increased risk of posterior capsule opacification (secondary cataract).",
                visualEffect: "large_opening"
            }
        ]
    },
    {
        id: 3,
        name: "Phacoemulsification",
        shortName: "Phaco",
        icon: "fa-bolt",
        duration: "5-15 min",
        description: "An ultrasonic probe (phaco handpiece) is inserted through the corneal incision. It emits ultrasound waves that break the cloudy cataract lens nucleus into tiny fragments, which are simultaneously aspirated (sucked out) through the probe tip.",
        details: [
            "Phaco probe inserted through main corneal incision",
            "Hydrodissection: BSS injected under capsule to free lens cortex",
            "Nucleus is grooved and cracked into quadrants (divide & conquer)",
            "Each quadrant is emulsified with ultrasound energy and aspirated",
            "Cortical material is removed with irrigation/aspiration (I/A) handpiece",
            "Posterior capsule is carefully polished to prevent opacification"
        ],
        instruments: [
            { name: "Phaco Handpiece", icon: "fa-wave-square" },
            { name: "I/A Handpiece", icon: "fa-exchange-alt" },
            { name: "Chopper", icon: "fa-gavel" },
            { name: "BSS Irrigator", icon: "fa-tint" }
        ],
        riskLevel: "high",
        cameraPosition: { x: 1, y: 1.5, z: 3.5 },
        cameraTarget: { x: 0, y: 0, z: -0.2 },
        highlightParts: ["lens", "nucleus", "cortex"],
        animationType: "phaco",
        complications: [
            {
                name: "Posterior Capsule Rupture (PCR)",
                severity: "severe",
                frequency: "1 in 50 (beginner) to 1 in 200 (expert)",
                description: "The thin posterior capsule tears during phaco, allowing vitreous gel to enter the anterior chamber. THE most significant intraoperative complication.",
                consequence: "Vitreous loss requiring anterior vitrectomy. Lens fragments may drop into vitreous cavity needing pars plana vitrectomy. IOL may need to be sutured or placed in sulcus.",
                visualEffect: "capsule_rupture"
            },
            {
                name: "Corneal Burn (Wound Burn)",
                severity: "moderate",
                frequency: "1 in 200",
                description: "Excessive ultrasound energy generates heat at the corneal incision site, causing a thermal burn and wound shrinkage.",
                consequence: "Corneal opacification at incision site. Induced astigmatism. Wound may not self-seal. May need corneal repair.",
                visualEffect: "thermal_burn"
            },
            {
                name: "Dropped Nucleus",
                severity: "severe",
                frequency: "1 in 300",
                description: "Lens nucleus fragments fall through a ruptured posterior capsule into the vitreous cavity, beyond the surgeon's reach.",
                consequence: "Requires second surgery (pars plana vitrectomy) by a retinal specialist. Can cause inflammation, glaucoma, retinal detachment.",
                visualEffect: "nucleus_drop"
            },
            {
                name: "Zonular Dialysis",
                severity: "severe",
                frequency: "1 in 500",
                description: "The zonular fibers (suspensory ligaments holding the lens) break, causing lens instability or dislocation.",
                consequence: "Capsular tension ring may be needed. IOL fixation becomes complex. Risk of lens/IOL dropping into vitreous.",
                visualEffect: "zonule_break"
            }
        ]
    },
    {
        id: 4,
        name: "IOL Implantation",
        shortName: "IOL",
        icon: "fa-bullseye",
        duration: "2-5 min",
        description: "A foldable intraocular lens (IOL) is loaded into an injector cartridge and inserted through the small corneal incision. The IOL unfolds inside the capsular bag and is positioned centrally. This artificial lens replaces the natural lens that was removed.",
        details: [
            "Capsular bag filled with viscoelastic to create space",
            "Foldable acrylic IOL loaded into injector cartridge",
            "IOL injected through main incision into capsular bag",
            "Lens unfolds slowly — leading haptic positioned first",
            "Trailing haptic dialed into the bag with a Sinskey hook",
            "IOL centered on visual axis by adjusting haptic position"
        ],
        instruments: [
            { name: "IOL Injector", icon: "fa-syringe" },
            { name: "Sinskey Hook", icon: "fa-anchor" },
            { name: "Viscoelastic", icon: "fa-tint" },
            { name: "Lens Cartridge", icon: "fa-capsules" }
        ],
        riskLevel: "medium",
        cameraPosition: { x: -1, y: 2, z: 3 },
        cameraTarget: { x: 0, y: 0, z: -0.1 },
        highlightParts: ["capsule_bag", "iol"],
        animationType: "iol_implant",
        complications: [
            {
                name: "IOL Dislocation / Decentration",
                severity: "moderate",
                frequency: "1 in 100",
                description: "The IOL shifts from its intended central position, causing optical aberrations. Can occur if one haptic is outside the capsular bag or if capsule support is asymmetric.",
                consequence: "Glare, halos, reduced visual acuity. May need surgical repositioning or IOL exchange.",
                visualEffect: "iol_shift"
            },
            {
                name: "Wrong IOL Power",
                severity: "moderate",
                frequency: "1 in 200",
                description: "The implanted IOL has incorrect refractive power due to biometry measurement error, formula error, or wrong lens selection.",
                consequence: "Patient has unexpected refractive error. May need glasses, lens exchange surgery, or piggyback IOL.",
                visualEffect: "none"
            },
            {
                name: "Posterior Capsule Tear During Insertion",
                severity: "severe",
                frequency: "1 in 300",
                description: "The IOL or injector tip damages the posterior capsule during implantation, especially if the capsule was already weakened.",
                consequence: "Vitreous loss. IOL cannot be placed in the bag. May need sulcus placement, anterior chamber IOL, or scleral fixation.",
                visualEffect: "capsule_rupture"
            }
        ]
    },
    {
        id: 5,
        name: "Wound Closure & Completion",
        shortName: "Closure",
        icon: "fa-check-circle",
        duration: "2-3 min",
        description: "Viscoelastic is removed from the eye using the I/A handpiece. The corneal incision is hydrated with BSS to ensure a watertight self-seal. Antibiotic and anti-inflammatory drops are applied. The eye is checked for stability.",
        details: [
            "All viscoelastic (OVD) removed with I/A to prevent IOP spike",
            "Anterior chamber reformed with balanced salt solution (BSS)",
            "Corneal incision hydrated — stromal edges swell to self-seal",
            "Seidel test performed (fluorescein) to confirm no wound leak",
            "Intracameral antibiotic (cefuroxime/moxifloxacin) injected",
            "Topical steroid + antibiotic drops applied",
            "Lid speculum removed, eye shield placed"
        ],
        instruments: [
            { name: "I/A Handpiece", icon: "fa-exchange-alt" },
            { name: "BSS Cannula", icon: "fa-tint" },
            { name: "Fluorescein Dye", icon: "fa-highlighter" },
            { name: "Antibiotic Drops", icon: "fa-prescription-bottle" }
        ],
        riskLevel: "low",
        cameraPosition: { x: 0, y: 0.5, z: 4.5 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        highlightParts: ["cornea", "incision_site"],
        animationType: "closure",
        complications: [
            {
                name: "IOP Spike (Pressure Rise)",
                severity: "moderate",
                frequency: "1 in 20",
                description: "Intraocular pressure rises significantly in the hours after surgery, often due to retained viscoelastic or inflammation. Can reach 40-50 mmHg.",
                consequence: "Eye pain, corneal edema, potential optic nerve damage. Treated with pressure-lowering drops or anterior chamber paracentesis.",
                visualEffect: "pressure"
            },
            {
                name: "Wound Leak (Seidel Positive)",
                severity: "moderate",
                frequency: "1 in 100",
                description: "The corneal incision does not seal properly. Fluorescein dye streams from the wound (positive Seidel test).",
                consequence: "Risk of endophthalmitis (infection). Needs suturing or bandage contact lens. May need to return to OR.",
                visualEffect: "leak"
            },
            {
                name: "Endophthalmitis",
                severity: "severe",
                frequency: "1 in 1,000 to 1 in 3,000",
                description: "Devastating intraocular infection, usually appearing 2-7 days post-op. Bacteria enter through the surgical wound. Most feared post-operative complication.",
                consequence: "Severe vision loss possible. Emergency treatment with intravitreal antibiotics. May need vitrectomy. Can lose the eye in worst cases.",
                visualEffect: "infection"
            },
            {
                name: "Cystoid Macular Edema (CME)",
                severity: "moderate",
                frequency: "1 in 50",
                description: "Fluid accumulates in the macula (central retina) weeks after surgery due to inflammatory mediators. Most common cause of decreased vision after uncomplicated cataract surgery.",
                consequence: "Blurred central vision. Usually responds to anti-inflammatory drops (NSAIDs + steroids). Rarely needs intravitreal injection.",
                visualEffect: "none"
            }
        ]
    }
];

// Anatomy label data for 3D scene
const EYE_ANATOMY_LABELS = [
    { name: "Cornea", position: { x: 0, y: 0, z: 1.3 }, description: "Transparent front surface" },
    { name: "Iris", position: { x: 0, y: 0.4, z: 0.8 }, description: "Colored ring controlling pupil size" },
    { name: "Pupil", position: { x: 0, y: 0, z: 0.9 }, description: "Central opening in iris" },
    { name: "Lens", position: { x: 0, y: 0, z: 0.3 }, description: "Focuses light onto retina" },
    { name: "Anterior Chamber", position: { x: 0.4, y: 0.3, z: 1.0 }, description: "Fluid-filled space between cornea and iris" },
    { name: "Sclera", position: { x: 1.0, y: 0.3, z: -0.2 }, description: "White protective outer coat" },
    { name: "Retina", position: { x: -0.8, y: 0, z: -0.5 }, description: "Light-sensitive neural tissue" },
    { name: "Optic Nerve", position: { x: -0.2, y: 0, z: -1.5 }, description: "Transmits visual information to brain" },
    { name: "Vitreous Body", position: { x: 0.3, y: -0.3, z: -0.4 }, description: "Gel filling the eye" },
    { name: "Zonules", position: { x: 0.5, y: 0.2, z: 0.3 }, description: "Fibers suspending the lens" }
];

// Color scheme for eye parts
const EYE_PART_COLORS = {
    sclera: 0xf5f0eb,
    cornea: 0xc8e6f5,
    iris: 0x4a8c6f,
    pupil: 0x0a0a0a,
    lens: 0xfff5cc,
    lens_cloudy: 0xc8b88a,
    retina: 0xcc4444,
    choroid: 0x8b2500,
    vitreous: 0xe8f4f8,
    optic_nerve: 0xdaa520,
    zonules: 0xd4c5a9,
    capsule: 0xf0e8d0,
    iol: 0xe0f0ff,
    blood: 0xcc0000,
    aqueous: 0xd5eef8
};
