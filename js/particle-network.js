// Sci-fi particle network background
(function () {
    /**
     * @typedef {Object} Config
     * @property {number} particleDensity - Number of particles per pixel.
     * @property {number} connectionDist - Max distance to draw regular connections.
     * @property {number} mouseDist - Radius of mouse influence.
     * @property {number} sparkDist - Max distance for activated (sparkle) connections.
     * @property {number} attractorForce - Strength of mouse attraction.
     * @property {number} particleAttraction - Strength of mutual particle attraction.
     * @property {number} particleRepulsion - Strength of short-range particle repulsion.
     * @property {number} repulsionDistSq - Square of the distance where repulsion starts.
     * @property {number} migrationRate - Probability of a migration event per frame.
     * @property {number} migrationForce - Strength of migration pull.
     * @property {number} maxClusterSize - Maximum number of particles in a migrating cluster.
     * @property {number} timeStep - Time increment per frame.
     * @property {number} minSpeed - Base speed of particles.
     * @property {number} speedRange - Variation in speed based on layer.
     * @property {number} minParticleRadius - Minimum radius of a particle.
     * @property {number} radiusRange - Variation in radius based on layer.
     * @property {number} minOpacity - Minimum base opacity of a particle.
     * @property {number} opacityRange - Variation in opacity based on layer.
     * @property {number} minBaseAlpha - Minimum base transparency multiplier.
     * @property {number} baseAlphaRange - Range of random transparency multiplier.
     * @property {number} baseR - Base Red color component.
     * @property {number} baseG - Base Green color component.
     * @property {number} baseB - Base Blue color component.
     * @property {number} colorVariance - Random color variation range.
     * @property {number} lineWidthRegular - Line width for regular connections.
     * @property {number} lineWidthActive - Line width for active connections.
     * @property {number} bezierCurveRegular - Curvature for regular connections.
     * @property {number} bezierCurveActive - Curvature for active connections.
     * @property {number} bezierCurveMouse - Curvature for mouse connections.
     * @property {number} sparkleDecay - Decay rate of sparkle effect.
     * @property {number} friction - Global friction to prevent kinetic energy buildup.
     */
    const CONFIG = {
        particleDensity: 0.26,
        connectionDist: 200,
        mouseDist: 100,
        sparkDist: 250,
        attractorForce: 0.015,
        particleAttraction: 0.0001,
        particleRepulsion: 0.003,
        repulsionDistSq: 400,
        migrationRate: 0.002, // Probability of a migration event per frame
        migrationForce: 0.005,
        maxClusterSize: 10,
        timeStep: 0.015,
        minSpeed: 0.15,
        speedRange: 0.6,
        minParticleRadius: 0.5,
        radiusRange: 1.5,
        minOpacity: 0.3,
        opacityRange: 0.7,
        minBaseAlpha: 0.5,
        baseAlphaRange: 0.5,
        baseR: 100,
        baseG: 255,
        baseB: 218,
        colorVariance: 40,
        lineWidthRegular: 0.5,
        lineWidthActive: 0.8,
        bezierCurveRegular: 0.25,
        bezierCurveActive: 0.3,
        bezierCurveMouse: 0.2,
        sparkleDecay: 0.08,
        friction: 0.999
    };

    const canvas = document.getElementById('hero-canvas');
    const ctx = canvas.getContext('2d');
    let w, h, particles;
    let mouse = { x: null, y: null };
    let time = 0;

    // --- Particle ---

    /**
     * Represents a single particle in the network.
     * @constructor
     */
    function Particle() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.layer = Math.random();
        const speed = CONFIG.minSpeed + this.layer * CONFIG.speedRange;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.r = CONFIG.minParticleRadius + this.layer * CONFIG.radiusRange;
        this.opacity = CONFIG.minOpacity + this.layer * CONFIG.opacityRange;
        this.baseAlpha = CONFIG.minBaseAlpha + Math.random() * CONFIG.baseAlphaRange; // Random multiplier for overall transparency
        // Randomize brightness/color slightly around base color
        const colorVar = Math.floor(Math.random() * CONFIG.colorVariance) - (CONFIG.colorVariance / 2);
        this.rVal = CONFIG.baseR + colorVar;
        this.gVal = CONFIG.baseG; // Keep G high for teal
        this.bVal = CONFIG.baseB + colorVar;
        this.sparkle = 0;
        this.phase = Math.random() * Math.PI * 2;
    }

    // --- Helpers ---

    /**
     * Calculates control points for a quadratic Bezier curve between two particles.
     * @param {number} ax - X coordinate of start point.
     * @param {number} ay - Y coordinate of start point.
     * @param {number} bx - X coordinate of end point.
     * @param {number} by - Y coordinate of end point.
     * @param {number} phase1 - Animation phase of the first particle.
     * @param {number} phase2 - Animation phase of the second particle.
     * @param {number} timeMul - Multiplier for animation speed.
     * @param {number} curveMul - Multiplier for curve intensity.
     * @returns {Object} Control points {cp1x, cp1y, cp2x, cp2y}.
     */
    function bezierControlPoints(ax, ay, bx, by, phase1, phase2, timeMul, curveMul) {
        const OFFSET_FACTOR = 0.15;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const nx = -(ay - by);
        const ny = ax - bx;
        const nl = Math.sqrt(nx * nx + ny * ny) || 1;
        const dist = nl;
        const t1 = Math.sin(time * timeMul + phase1) * curveMul;
        const t2 = Math.cos(time * timeMul + phase2) * curveMul;
        return {
            cp1x: mx - (bx - ax) * OFFSET_FACTOR + (nx / nl) * dist * t1,
            cp1y: my - (by - ay) * OFFSET_FACTOR + (ny / nl) * dist * t1,
            cp2x: mx + (bx - ax) * OFFSET_FACTOR + (nx / nl) * dist * t2,
            cp2y: my + (by - ay) * OFFSET_FACTOR + (ny / nl) * dist * t2
        };
    }

    /**
     * Draws a Bezier curve between two points using given control points.
     * @param {number} ax - Start X.
     * @param {number} ay - Start Y.
     * @param {number} bx - End X.
     * @param {number} by - End Y.
     * @param {Object} cp - Control points.
     */
    function drawCurve(ax, ay, bx, by, cp) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, bx, by);
        ctx.stroke();
    }

    // --- Drawing passes ---

    /**
     * Draws connections between particles that are close enough to each other.
     */
    function drawConnections() {
        const REGULAR_ALPHA_INTENSITY = 0.3;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONFIG.connectionDist) {
                    const baseAlphaMultiplier = (particles[i].baseAlpha + particles[j].baseAlpha) * 0.5;
                    const alpha = (1 - dist / CONFIG.connectionDist) * REGULAR_ALPHA_INTENSITY * baseAlphaMultiplier;
                    const r = Math.floor((particles[i].rVal + particles[j].rVal) * 0.5);
                    const g = Math.floor((particles[i].gVal + particles[j].gVal) * 0.5);
                    const b = Math.floor((particles[i].bVal + particles[j].bVal) * 0.5);
                    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
                    ctx.lineWidth = CONFIG.lineWidthRegular;
                    const cp = bezierControlPoints(
                        particles[i].x, particles[i].y,
                        particles[j].x, particles[j].y,
                        particles[i].phase, particles[j].phase, 1, CONFIG.bezierCurveRegular
                    );
                    drawCurve(particles[i].x, particles[i].y, particles[j].x, particles[j].y, cp);
                }
            }
        }
    }

    /**
     * Draws highlighted connections between particles that are near the mouse cursor.
     * @param {number[]} activatedSet - Array of indices for particles near the mouse.
     */
    function drawActivatedConnections(activatedSet) {
        const ACTIVE_ALPHA_INTENSITY = 0.7;
        const MIN_DIST_FACTOR = 0.3;
        for (let a = 0; a < activatedSet.length; a++) {
            const pi = particles[activatedSet[a]];
            for (let b = a + 1; b < activatedSet.length; b++) {
                const pj = particles[activatedSet[b]];
                const dx = pi.x - pj.x;
                const dy = pj.y - pi.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONFIG.sparkDist && dist > CONFIG.connectionDist * MIN_DIST_FACTOR) {
                    const baseAlphaMultiplier = (pi.baseAlpha + pj.baseAlpha) * 0.5;
                    const intensity = (1 - dist / CONFIG.sparkDist);
                    const alpha = intensity * ACTIVE_ALPHA_INTENSITY * Math.min(pi.sparkle, pj.sparkle) * baseAlphaMultiplier;
                    const r = Math.floor((pi.rVal + pj.rVal) * 0.5);
                    const g = Math.floor((pi.gVal + pj.gVal) * 0.5);
                    const b = Math.floor((pi.bVal + pj.bVal) * 0.5);
                    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
                    ctx.lineWidth = CONFIG.lineWidthActive;
                    const cp = bezierControlPoints(
                        pi.x, pi.y, pj.x, pj.y,
                        pi.phase, pj.phase, 1.3, CONFIG.bezierCurveActive
                    );
                    drawCurve(pi.x, pi.y, pj.x, pj.y, cp);
                }
            }
        }
    }

    /**
     * Draws a connection between a particle and the mouse cursor if they are close enough.
     * @param {Object} p - The particle object.
     * @returns {boolean} True if a connection was drawn, false otherwise.
     */
    function drawMouseConnections(p) {
        const MOUSE_ALPHA_INTENSITY = 0.6;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.mouseDist) {
            const alpha = (1 - dist / CONFIG.mouseDist) * MOUSE_ALPHA_INTENSITY * p.baseAlpha;
            ctx.strokeStyle = `rgba(${p.rVal},${p.gVal},${p.bVal},${alpha})`;
            ctx.lineWidth = CONFIG.lineWidthActive;
            const cp = bezierControlPoints(
                p.x, p.y, mouse.x, mouse.y,
                p.phase, p.phase * 1.7, 1.5, CONFIG.bezierCurveMouse
            );
            drawCurve(p.x, p.y, mouse.x, mouse.y, cp);
            return true;
        }
        return false;
    }

    // --- Physics ---

    /**
     * Applies an attraction force to a particle towards the mouse cursor.
     * @param {Object} p - The particle object.
     */
    function applyAttractor(p) {
        const MIN_DIST = 1;
        if (mouse.x === null) return;
        const adx = mouse.x - p.x;
        const ady = mouse.y - p.y;
        const aDist = Math.sqrt(adx * adx + ady * ady);
        if (aDist < CONFIG.mouseDist && aDist > MIN_DIST) {
            const force = (1 - aDist / CONFIG.mouseDist) * CONFIG.attractorForce * p.layer;
            p.vx += (adx / aDist) * force;
            p.vy += (ady / aDist) * force;
        }
    }

    /**
     * Applies mutual attraction and repulsion forces between all pairs of particles.
     */
    function applyParticleAttraction() {
        const ATTRACTION_MIN_DIST_SQ = 900;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const pi = particles[i];
                const pj = particles[j];
                const dx = pj.x - pi.x;
                const dy = pj.y - pi.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < CONFIG.connectionDist * CONFIG.connectionDist) {
                    const dist = Math.sqrt(distSq);
                    let force = 0;

                    if (distSq < CONFIG.repulsionDistSq) {
                        // Short-range repulsion to prevent clustering
                        force = (1 - distSq / CONFIG.repulsionDistSq) * -CONFIG.particleRepulsion;
                    } else if (distSq > ATTRACTION_MIN_DIST_SQ) {
                        // Long-range attraction
                        force = (1 - dist / CONFIG.connectionDist) * CONFIG.particleAttraction * (pi.layer + pj.layer) * 0.5;
                    }

                    if (force !== 0) {
                        const ax = (dx / dist) * force;
                        const ay = (dy / dist) * force;

                        pi.vx += ax;
                        pi.vy += ay;
                        pj.vx -= ax;
                        pj.vy -= ay;
                    }
                }
            }
        }
    }

    /**
     * Periodically triggers and updates particle migration between clusters.
     */
    function applyMigration() {
        const CLUSTER_RADIUS_SQ = 100 * 100;
        const TARGET_MIN_DIST_SQ = 300 * 300;
        const ARRIVAL_DIST = 30;
        const MIGRATION_SPARKLE = 0.2;

        // Occasionally trigger a migration event
        if (Math.random() < CONFIG.migrationRate) {
            // Pick a random source particle
            const sourceIdx = Math.floor(Math.random() * particles.length);
            const source = particles[sourceIdx];

            // Find all particles connected to it (simple cluster definition)
            const cluster = [];
            const candidates = [];

            for (let i = 0; i < particles.length; i++) {
                const dx = particles[i].x - source.x;
                const dy = particles[i].y - source.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < CLUSTER_RADIUS_SQ) {
                    candidates.push({ particle: particles[i], distSq });
                }
            }

            // Limit cluster size: pick the closest ones
            candidates.sort((a, b) => a.distSq - b.distSq);
            const limitedCandidates = candidates.slice(0, CONFIG.maxClusterSize);
            limitedCandidates.forEach(c => cluster.push(c.particle));

            // Pick a target cluster (represented by a random particle far enough away)
            const potentialTargets = particles.filter(p => {
                const dx = p.x - source.x;
                const dy = p.y - source.y;
                return dx * dx + dy * dy > TARGET_MIN_DIST_SQ; // Far enough
            });

            if (potentialTargets.length > 0) {
                const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                // Assign target to the whole cluster, but only if they don't have one already
                cluster.forEach(p => {
                    if (!p.target) p.target = target;
                });
            }
        }

        // Apply forces for particles currently migrating
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.target) {
                const tdx = p.target.x - p.x;
                const tdy = p.target.y - p.y;
                const tDistSq = tdx * tdx + tdy * tdy;
                const tDist = Math.sqrt(tDistSq);

                if (tDist > ARRIVAL_DIST) {
                    const mForce = CONFIG.migrationForce * p.layer;
                    p.vx += (tdx / tDist) * mForce;
                    p.vy += (tdy / tDist) * mForce;

                    // Add a slight visual hint by increasing sparkle
                    p.sparkle = Math.max(p.sparkle, MIGRATION_SPARKLE);
                } else {
                    // Arrived at target cluster
                    p.target = null;
                }
            }
        }
    }

    /**
     * Limits the particle's velocity and applies friction.
     * @param {Object} p - The particle object.
     */
    function clampVelocity(p) {
        const maxSpeed = CONFIG.minSpeed + p.layer * CONFIG.speedRange;
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed) {
            p.vx = (p.vx / currentSpeed) * maxSpeed;
            p.vy = (p.vy / currentSpeed) * maxSpeed;
        }

        // Very slight friction to prevent energy accumulation
        p.vx *= CONFIG.friction;
        p.vy *= CONFIG.friction;
    }

    /**
     * Updates the particle's position and handles boundary collisions.
     * @param {Object} p - The particle object.
     */
    function moveParticle(p) {
        const BOUNCE_FACTOR = -1;
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off left/right walls
        if (p.x < 0) {
            p.x = 0;
            p.vx *= BOUNCE_FACTOR;
        } else if (p.x > w) {
            p.x = w;
            p.vx *= BOUNCE_FACTOR;
        }

        // Bounce off floor/ceiling
        if (p.y < 0) {
            p.y = 0;
            p.vy *= BOUNCE_FACTOR;
        } else if (p.y > h) {
            p.y = h;
            p.vy *= BOUNCE_FACTOR;
        }
    }

    // --- Main loop ---

    /**
     * Resizes the canvas and adjusts particle count based on screen size.
     */
    function resize() {
        const hero = document.getElementById('hero');
        w = canvas.width = hero.offsetWidth;
        h = canvas.height = hero.offsetHeight;

        if (particles) {
            const targetCount = Math.floor(w * CONFIG.particleDensity);
            while (particles.length < targetCount) particles.push(new Particle());
            if (particles.length > targetCount) particles.length = targetCount;

            particles.forEach(p => {
                if (p.x > w) p.x = Math.random() * w;
                if (p.y > h) p.y = Math.random() * h;
            });
        }
    }

    /**
     * Initializes the particle network.
     */
    function init() {
        particles = [];
        resize();
    }

    /**
     * Main animation loop.
     */
    function draw() {
        const SPARKLE_BASE = 0.8;
        const SPARKLE_RANGE = 0.2;

        time += CONFIG.timeStep;
        ctx.clearRect(0, 0, w, h);

        // 1. Regular connections
        drawConnections();

        // 2. Physics: particle attraction & migration
        applyParticleAttraction();
        applyMigration();

        // 3. Activated (sparkle) connections
        const activatedSet = [];
        if (mouse.x !== null) {
            for (let i = 0; i < particles.length; i++) {
                const dx = particles[i].x - mouse.x;
                const dy = particles[i].y - mouse.y;
                if (Math.sqrt(dx * dx + dy * dy) < CONFIG.mouseDist) {
                    activatedSet.push(i);
                }
            }
        }
        drawActivatedConnections(activatedSet);

        // 3. Per-particle: mouse lines, physics, draw dot
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            let activated = false;

            if (mouse.x !== null) {
                activated = drawMouseConnections(p);
            }

            p.sparkle += (activated ? 1 - p.sparkle : -p.sparkle) * CONFIG.sparkleDecay;

            applyAttractor(p);
            clampVelocity(p);
            moveParticle(p);

            const dotAlpha = p.opacity * (SPARKLE_BASE + p.sparkle * SPARKLE_RANGE) * p.baseAlpha;
            ctx.fillStyle = `rgba(${p.rVal},${p.gVal},${p.bVal},${dotAlpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    // --- Events ---

    document.getElementById('hero').addEventListener('mousemove', function (e) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    document.getElementById('hero').addEventListener('mouseleave', function () {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener('resize', resize);

    init();
    draw();
})();
