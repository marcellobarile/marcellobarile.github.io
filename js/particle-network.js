// Sci-fi particle network background
(function () {
    const CONFIG = {
        particleDensity: 0.26,
        connectionDist: 200,
        mouseDist: 100,
        sparkDist: 250,
        attractorForce: 0.015,
        timeStep: 0.015
    };

    const canvas = document.getElementById('hero-canvas');
    const ctx = canvas.getContext('2d');
    let w, h, particles;
    let mouse = { x: null, y: null };
    let time = 0;

    // --- Particle ---

    function Particle() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.layer = Math.random();
        var speed = 0.15 + this.layer * 0.6;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.r = 0.5 + this.layer * 1.5;
        this.opacity = 0.3 + this.layer * 0.7;
        this.sparkle = 0;
        this.phase = Math.random() * Math.PI * 2;
    }

    // --- Helpers ---

    function bezierControlPoints(ax, ay, bx, by, phase1, phase2, timeMul, curveMul) {
        var mx = (ax + bx) / 2;
        var my = (ay + by) / 2;
        var nx = -(ay - by);
        var ny = ax - bx;
        var nl = Math.sqrt(nx * nx + ny * ny) || 1;
        var dist = nl;
        var t1 = Math.sin(time * timeMul + phase1) * curveMul;
        var t2 = Math.cos(time * timeMul + phase2) * curveMul;
        return {
            cp1x: mx - (bx - ax) * 0.15 + (nx / nl) * dist * t1,
            cp1y: my - (by - ay) * 0.15 + (ny / nl) * dist * t1,
            cp2x: mx + (bx - ax) * 0.15 + (nx / nl) * dist * t2,
            cp2y: my + (by - ay) * 0.15 + (ny / nl) * dist * t2
        };
    }

    function drawCurve(ax, ay, bx, by, cp) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, bx, by);
        ctx.stroke();
    }

    // --- Drawing passes ---

    function drawConnections() {
        for (var i = 0; i < particles.length; i++) {
            for (var j = i + 1; j < particles.length; j++) {
                var dx = particles[i].x - particles[j].x;
                var dy = particles[i].y - particles[j].y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONFIG.connectionDist) {
                    var alpha = (1 - dist / CONFIG.connectionDist) * 0.3;
                    ctx.strokeStyle = 'rgba(150,255,230,' + alpha + ')';
                    ctx.lineWidth = 0.5;
                    var cp = bezierControlPoints(
                        particles[i].x, particles[i].y,
                        particles[j].x, particles[j].y,
                        particles[i].phase, particles[j].phase, 1, 0.25
                    );
                    drawCurve(particles[i].x, particles[i].y, particles[j].x, particles[j].y, cp);
                }
            }
        }
    }

    function drawActivatedConnections(activatedSet) {
        for (var a = 0; a < activatedSet.length; a++) {
            var pi = particles[activatedSet[a]];
            for (var b = a + 1; b < activatedSet.length; b++) {
                var pj = particles[activatedSet[b]];
                var dx = pi.x - pj.x;
                var dy = pj.y - pi.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONFIG.sparkDist && dist > CONFIG.connectionDist * 0.3) {
                    var intensity = (1 - dist / CONFIG.sparkDist);
                    var alpha = intensity * 0.7 * Math.min(pi.sparkle, pj.sparkle);
                    ctx.strokeStyle = 'rgba(150,255,230,' + alpha + ')';
                    ctx.lineWidth = 0.8;
                    var cp = bezierControlPoints(
                        pi.x, pi.y, pj.x, pj.y,
                        pi.phase, pj.phase, 1.3, 0.3
                    );
                    drawCurve(pi.x, pi.y, pj.x, pj.y, cp);
                }
            }
        }
    }

    function drawMouseConnections(p) {
        var dx = p.x - mouse.x;
        var dy = p.y - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.mouseDist) {
            var alpha = (1 - dist / CONFIG.mouseDist) * 0.6;
            ctx.strokeStyle = 'rgba(100,255,218,' + alpha + ')';
            ctx.lineWidth = 0.8;
            var cp = bezierControlPoints(
                p.x, p.y, mouse.x, mouse.y,
                p.phase, p.phase * 1.7, 1.5, 0.2
            );
            drawCurve(p.x, p.y, mouse.x, mouse.y, cp);
            return true;
        }
        return false;
    }

    // --- Physics ---

    function applyAttractor(p) {
        if (mouse.x === null) return;
        var adx = mouse.x - p.x;
        var ady = mouse.y - p.y;
        var aDist = Math.sqrt(adx * adx + ady * ady);
        if (aDist < CONFIG.mouseDist && aDist > 1) {
            var force = (1 - aDist / CONFIG.mouseDist) * CONFIG.attractorForce * p.layer;
            p.vx += (adx / aDist) * force;
            p.vy += (ady / aDist) * force;
        }
    }

    function clampVelocity(p) {
        var maxSpeed = 0.15 + p.layer * 0.6;
        var currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed) {
            p.vx = (p.vx / currentSpeed) * maxSpeed;
            p.vy = (p.vy / currentSpeed) * maxSpeed;
        }
    }

    function moveParticle(p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
    }

    // --- Main loop ---

    function resize() {
        var hero = document.getElementById('hero');
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

    function init() {
        particles = [];
        resize();
    }

    function draw() {
        time += CONFIG.timeStep;
        ctx.clearRect(0, 0, w, h);

        // 1. Regular connections
        drawConnections();

        // 2. Activated (sparkle) connections
        var activatedSet = [];
        if (mouse.x !== null) {
            for (var i = 0; i < particles.length; i++) {
                var dx = particles[i].x - mouse.x;
                var dy = particles[i].y - mouse.y;
                if (Math.sqrt(dx * dx + dy * dy) < CONFIG.mouseDist) {
                    activatedSet.push(i);
                }
            }
        }
        drawActivatedConnections(activatedSet);

        // 3. Per-particle: mouse lines, physics, draw dot
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var activated = false;

            if (mouse.x !== null) {
                activated = drawMouseConnections(p);
            }

            p.sparkle += (activated ? 1 - p.sparkle : -p.sparkle) * 0.08;

            applyAttractor(p);
            clampVelocity(p);
            moveParticle(p);

            ctx.fillStyle = 'rgba(100,255,218,' + (p.opacity * (0.8 + p.sparkle * 0.2)) + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    // --- Events ---

    document.getElementById('hero').addEventListener('mousemove', function (e) {
        var rect = canvas.getBoundingClientRect();
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
