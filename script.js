document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const datePicker = document.getElementById('date-picker');
    const titleInput = document.getElementById('title-input');
    const mainTitle = document.getElementById('main-title');
    const counterContainer = document.getElementById('counter-container');
    const messageEl = document.getElementById('message');
    document.body.appendChild(messageEl); // Move to body to avoid backdrop-filter containing block issue
    const bgCanvas = document.getElementById('bg-canvas');
    const fwCanvas = document.getElementById('fireworks-canvas');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettingsBtn = document.getElementById('close-settings');

    const els = {
        years: document.getElementById('years'),
        days: document.getElementById('days'),
        hours: document.getElementById('hours'),
        minutes: document.getElementById('minutes'),
        seconds: document.getElementById('seconds')
    };

    let countdownInterval;
    let clockInterval;
    let animationFrameId;
    let threeRenderer, threeScene, threeCamera, explosionSystem;

    // --- Settings UI Logic ---
    settingsBtn.addEventListener('click', () => {
        settingsPanel.hidden = false;
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.hidden = true;
    });

    // --- Background Animation (Starfield) ---
    const bgCtx = bgCanvas.getContext('2d');
    let stars = [];
    const numStars = 300;
    let width, height;

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        bgCanvas.width = width;
        bgCanvas.height = height;
        fwCanvas.width = width;
        fwCanvas.height = height;

        if (threeRenderer) {
            threeRenderer.setSize(width, height);
            threeCamera.aspect = width / height;
            threeCamera.updateProjectionMatrix();
        }
    }

    class Star {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = (Math.random() - 0.5) * width;
            this.y = (Math.random() - 0.5) * height;
            this.z = Math.random() * width;
            this.pz = this.z;
        }
        update() {
            this.z -= 15; // Faster warp
            if (this.z <= 0) {
                this.reset();
                this.z = width;
                this.pz = this.z;
            }
        }
        draw() {
            const sx = (this.x / this.z) * width + width / 2;
            const sy = (this.y / this.z) * height + height / 2;
            const px = (this.x / this.pz) * width + width / 2;
            const py = (this.y / this.pz) * height + height / 2;
            this.pz = this.z;

            if (sx < 0 || sx > width || sy < 0 || sy > height) return;

            const r = (1 - this.z / width) * 2;
            const alpha = (1 - this.z / width);

            bgCtx.beginPath();
            bgCtx.moveTo(px, py);
            bgCtx.lineTo(sx, sy);
            bgCtx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
            bgCtx.lineWidth = r;
            bgCtx.stroke();
        }
    }

    function initStars() {
        stars = [];
        for (let i = 0; i < numStars; i++) stars.push(new Star());
    }

    function animateBackground() {
        bgCtx.fillStyle = 'rgba(5, 5, 10, 0.4)';
        bgCtx.fillRect(0, 0, width, height);
        stars.forEach(star => { star.update(); star.draw(); });
        animationFrameId = requestAnimationFrame(animateBackground);
    }

    window.addEventListener('resize', () => {
        resizeCanvas();
        initStars();
    });
    resizeCanvas();
    initStars();
    animateBackground();

    // --- Three.js Explosion (The "Big Bang") ---
    function initThreeJS() {
        threeScene = new THREE.Scene();
        threeCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        threeCamera.position.z = 50;

        threeRenderer = new THREE.WebGLRenderer({ canvas: fwCanvas, alpha: true, antialias: true });
        threeRenderer.setSize(width, height);
        threeRenderer.setPixelRatio(window.devicePixelRatio);
    }

    function triggerExplosion() {
        if (!threeRenderer) initThreeJS();

        // Clear previous
        while (threeScene.children.length > 0) {
            threeScene.remove(threeScene.children[0]);
        }

        const count = 8000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const initialPositions = new Float32Array(count * 3); // Store for implosion target

        // Initialize particles scattered far out
        for (let i = 0; i < count; i++) {
            const r = 100 + Math.random() * 100;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Target is center (0,0,0)
            initialPositions[i * 3] = positions[i * 3];
            initialPositions[i * 3 + 1] = positions[i * 3 + 1];
            initialPositions[i * 3 + 2] = positions[i * 3 + 2];

            const color = new THREE.Color();
            color.setHSL(Math.random() * 0.1 + 0.5, 1.0, 0.8); // Cyans/Blues/Whites
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.4,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.8
        });

        const points = new THREE.Points(geometry, material);
        threeScene.add(points);

        // Flash Light
        const light = new THREE.PointLight(0xffffff, 0, 1000);
        threeScene.add(light);

        const clock = new THREE.Clock();
        let phase = 'implode'; // implode -> flash -> explode
        let timeElapsed = 0;

        function animateSequence() {
            const delta = clock.getDelta();
            timeElapsed += delta;
            const positions = points.geometry.attributes.position.array;

            if (phase === 'implode') {
                // Suck particles in
                let arrived = 0;
                for (let i = 0; i < count; i++) {
                    const ix = i * 3;
                    // Move towards 0,0,0
                    positions[ix] -= positions[ix] * 2 * delta;
                    positions[ix + 1] -= positions[ix + 1] * 2 * delta;
                    positions[ix + 2] -= positions[ix + 2] * 2 * delta;

                    if (Math.abs(positions[ix]) < 0.5) arrived++;
                }

                if (arrived > count * 0.8 || timeElapsed > 1.5) {
                    phase = 'flash';
                    timeElapsed = 0;
                }
            } else if (phase === 'flash') {
                light.intensity = 50;
                material.size = 2;
                if (timeElapsed > 0.1) {
                    phase = 'explode';
                    // Set explosion velocities
                    for (let i = 0; i < count; i++) {
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(Math.random() * 2 - 1);
                        const speed = Math.random() * 50 + 20;

                        velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
                        velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
                        velocities[i * 3 + 2] = speed * Math.cos(phi);
                    }
                    light.intensity = 0;
                    material.size = 0.6;
                }
            } else if (phase === 'explode') {
                for (let i = 0; i < count; i++) {
                    positions[i * 3] += velocities[i * 3] * delta;
                    positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
                    positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;

                    // Drag
                    velocities[i * 3] *= 0.96;
                    velocities[i * 3 + 1] *= 0.96;
                    velocities[i * 3 + 2] *= 0.96;
                }
                points.rotation.y += 0.002;
            }

            points.geometry.attributes.position.needsUpdate = true;
            threeRenderer.render(threeScene, threeCamera);

            if (phase === 'explode' && timeElapsed > 10) return; // Stop after 10s of explosion
            requestAnimationFrame(animateSequence);
        }
        animateSequence();
    }


    // --- Core Logic ---

    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function setQueryParam(key, value) {
        const url = new URL(window.location);
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
        window.history.replaceState({}, '', url);
    }

    function updateTitle(text) {
        if (text) {
            mainTitle.textContent = text;
            mainTitle.setAttribute('data-text', text);
            document.title = `${text} - TickCounter`;
        } else {
            mainTitle.textContent = 'TickCounter';
            mainTitle.setAttribute('data-text', 'TickCounter');
            document.title = 'TickCounter';
        }
    }

    // Init Logic
    const savedDate = getQueryParam('date');
    const savedTitle = getQueryParam('title');

    if (savedTitle) {
        titleInput.value = savedTitle;
        updateTitle(savedTitle);
    }

    if (savedDate) {
        let targetDate;
        // Check for compact format YYYYMMDDHHMMSS (14 digits)
        if (/^\d{14}$/.test(savedDate)) {
            const year = savedDate.substring(0, 4);
            const month = savedDate.substring(4, 6);
            const day = savedDate.substring(6, 8);
            const hour = savedDate.substring(8, 10);
            const minute = savedDate.substring(10, 12);
            const second = savedDate.substring(12, 14);
            targetDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        } else {
            targetDate = new Date(savedDate);
        }

        if (!isNaN(targetDate.getTime())) {
            // Format for input: YYYY-MM-DDTHH:mm
            const isoString = new Date(targetDate.getTime() - (targetDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            datePicker.value = isoString;
            startCountdown(targetDate);
        } else {
            startClockMode();
        }
    } else {
        startClockMode();
    }

    // Event Listeners
    titleInput.addEventListener('input', (e) => {
        const val = e.target.value;
        updateTitle(val);
        setQueryParam('title', val);
    });

    datePicker.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) {
            setQueryParam('date', null);
            startClockMode();
            return;
        }
        const targetDate = new Date(val);

        // Format to YYYYMMDDHHMMSS
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const hours = String(targetDate.getHours()).padStart(2, '0');
        const minutes = String(targetDate.getMinutes()).padStart(2, '0');
        const seconds = String(targetDate.getSeconds()).padStart(2, '0');
        const compactDate = `${year}${month}${day}${hours}${minutes}${seconds}`;

        setQueryParam('date', compactDate);
        startCountdown(targetDate);
    });

    const messageText = document.getElementById('message-text');
    const newCountdownBtn = document.getElementById('new-countdown-btn');

    // Add listener for new button
    newCountdownBtn.addEventListener('click', () => {
        settingsPanel.hidden = false;
    });

    function startClockMode() {
        clearInterval(countdownInterval);
        counterContainer.hidden = false;
        counterContainer.style.display = ''; // Reset display

        // Reset message element completely
        messageEl.hidden = true;
        messageEl.style.display = '';
        messageEl.innerHTML = '';

        document.querySelector('header').hidden = false; // Show header
        els.years.parentElement.style.display = 'none'; // Hide years in clock mode
        els.days.parentElement.style.display = 'none'; // Hide days in clock mode

        function updateClock() {
            const now = new Date();
            els.hours.textContent = String(now.getHours()).padStart(2, '0');
            els.minutes.textContent = String(now.getMinutes()).padStart(2, '0');
            els.seconds.textContent = String(now.getSeconds()).padStart(2, '0');
        }
        updateClock();
        countdownInterval = setInterval(updateClock, 1000);
    }

    function startCountdown(targetDate) {
        clearInterval(countdownInterval);
        counterContainer.hidden = false;
        counterContainer.style.display = ''; // Reset display to default (flex)

        // Reset message element completely
        messageEl.hidden = true;
        messageEl.style.display = ''; // Remove inline flex
        messageEl.innerHTML = ''; // Clear content

        document.querySelector('header').hidden = false; // Show header

        // Reset Three.js if needed (simple reload for now or clear scene)
        if (threeScene) {
            while (threeScene.children.length > 0) {
                threeScene.remove(threeScene.children[0]);
            }
        }

        function update() {
            const now = new Date();
            const diff = targetDate - now;

            if (diff <= 0) {
                clearInterval(countdownInterval);
                counterContainer.hidden = true;
                counterContainer.style.display = 'none'; // Explicitly hide
                document.querySelector('header').hidden = true; // Hide header to prevent overlap

                messageEl.hidden = false;
                messageEl.style.display = 'flex'; // Force flex display
                messageEl.hidden = false;
                messageEl.style.display = 'flex'; // Force flex display
                messageEl.innerHTML = `
                    <div class="message-content" style="flex-shrink: 0; min-width: 300px; width: 90%; max-width: 800px; display: flex; flex-direction: column; align-items: center; gap: 2rem; background: black; border: 2px solid #00f3ff; border-radius: 20px; padding: 3rem;">
                        <div style="font-size: clamp(1.5rem, 4vw, 3rem); color: #00f3ff; text-shadow: 0 0 20px rgba(0, 243, 255, 0.8); margin-bottom: 1rem; text-align: center; width: 100%;">THE TIME IS</div>
                        <div style="font-size: clamp(3rem, 8vw, 6rem); color: #ffffff; text-shadow: 0 0 30px rgba(0, 243, 255, 1); line-height: 1; text-align: center; width: 100%;">NOW</div>
                        <button id="new-countdown-btn-dynamic" style="
                            margin-top: 2rem;
                            padding: 1rem 2rem;
                            background: #00f3ff;
                            color: black;
                            border: none;
                            border-radius: 50px;
                            font-family: 'Space Mono', monospace;
                            font-weight: bold;
                            cursor: pointer;
                            pointer-events: auto;
                            font-size: 1rem;
                            text-transform: uppercase;
                            letter-spacing: 0.1em;
                            box-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
                            width: auto;
                            min-width: 200px;
                        ">Create New Countdown</button>
                    </div>
                `;

                // Re-attach event listener to the new dynamic button
                setTimeout(() => {
                    const dynamicBtn = document.getElementById('new-countdown-btn-dynamic');
                    if (dynamicBtn) {
                        dynamicBtn.addEventListener('click', () => {
                            document.getElementById('settings-panel').hidden = false;
                        });
                    }
                }, 0);

                triggerExplosion();
                return;
            }

            const MS_PER_SECOND = 1000;
            const MS_PER_MINUTE = 60 * MS_PER_SECOND;
            const MS_PER_HOUR = 60 * MS_PER_MINUTE;
            const MS_PER_DAY = 24 * MS_PER_HOUR;
            const MS_PER_YEAR = 365.25 * MS_PER_DAY;

            let remaining = diff;

            const years = Math.floor(remaining / MS_PER_YEAR);
            remaining %= MS_PER_YEAR;

            const days = Math.floor(remaining / MS_PER_DAY);
            remaining %= MS_PER_DAY;

            const hours = Math.floor(remaining / MS_PER_HOUR);
            remaining %= MS_PER_HOUR;

            const minutes = Math.floor(remaining / MS_PER_MINUTE);
            remaining %= MS_PER_MINUTE;

            const seconds = Math.floor(remaining / MS_PER_SECOND);

            els.years.textContent = years;
            els.days.textContent = days;
            els.hours.textContent = String(hours).padStart(2, '0');
            els.minutes.textContent = String(minutes).padStart(2, '0');
            els.seconds.textContent = String(seconds).padStart(2, '0');

            els.years.parentElement.style.display = years > 0 ? 'flex' : 'none';
            els.days.parentElement.style.display = 'flex';
        }

        update();
        countdownInterval = setInterval(update, 1000);
    }
});
