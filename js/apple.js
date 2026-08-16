/* ===================================================================
   Apple-inspired interaction layer
   Built against .claude/skills/apple-design/SKILL.md

   The through-line of the skill: motion starts from the current
   on-screen value, inherits the user's velocity, projects momentum
   forward, and can be grabbed and reversed at any instant. Springs are
   what make that possible, so everything a user can touch is driven by
   a spring rather than a CSS transition or keyframe.
   =================================================================== */

(function () {
    'use strict';

    var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduceMotion = reduceMotionQuery.matches;
    reduceMotionQuery.addEventListener('change', function (e) {
        reduceMotion = e.matches;
    });

    /* ===============================================================
       1. Spring engine — §4
       Parameterised the way Apple parameterises springs: a damping
       ratio (overshoot) and a response (how quickly it reaches the
       target, in seconds) — not mass/stiffness/damping, and not a
       duration, because a spring has no fixed duration.

       damping 1.0  -> critically damped, no bounce (the default)
       damping 0.8  -> a little overshoot, for momentum-carrying gestures
       =============================================================== */

    var ticking = new Set();
    var rafId = null;
    var lastFrame = 0;

    function frame(now) {
        var dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
        lastFrame = now;
        // A long frame (tab was backgrounded) must not launch the
        // integrator into space.
        if (dt > 1 / 20) dt = 1 / 20;

        ticking.forEach(function (spring) {
            spring.step(dt);
        });

        rafId = ticking.size ? requestAnimationFrame(frame) : null;
        if (!rafId) lastFrame = 0;
    }

    function schedule(spring) {
        ticking.add(spring);
        // §11 — requestAnimationFrame is the web's display-synced clock
        if (!rafId) {
            lastFrame = 0;
            rafId = requestAnimationFrame(frame);
        }
    }

    function Spring(options) {
        options = options || {};
        this.value = options.from || 0;
        this.target = this.value;
        this.velocity = 0;
        this.damping = options.damping === undefined ? 1 : options.damping;
        this.response = options.response === undefined ? 0.4 : options.response;
        this.restDistance = options.restDistance || 0.01;
        this.restVelocity = options.restVelocity || 0.1;
        this.onUpdate = options.onUpdate || null;
        this.onRest = options.onRest || null;
    }

    /* Retarget. This is the whole interruptibility story (§3): value and
       velocity are carried over, so a new target continues from the
       presentation value instead of jumping to a fresh start. An
       optional velocity blends the gesture's release speed in (§5). */
    Spring.prototype.to = function (target, options) {
        options = options || {};
        if (options.damping !== undefined) this.damping = options.damping;
        if (options.response !== undefined) this.response = options.response;
        if (options.velocity !== undefined) this.velocity = options.velocity;

        this.target = target;

        if (reduceMotion) {
            // §14 — no travel, but the end state still arrives
            this.value = target;
            this.velocity = 0;
            this.emit();
            this.settle();
            return this;
        }

        schedule(this);
        return this;
    };

    /* Jump with no animation — used when a gesture takes over. */
    Spring.prototype.set = function (value, velocity) {
        this.value = value;
        this.velocity = velocity || 0;
        this.target = value;
        ticking.delete(this);
        this.emit();
        return this;
    };

    /* Hand control to a gesture: stop integrating but keep the value. */
    Spring.prototype.stop = function () {
        ticking.delete(this);
        this.velocity = 0;
        return this;
    };

    Spring.prototype.emit = function () {
        if (this.onUpdate) this.onUpdate(this.value, this.velocity);
    };

    Spring.prototype.settle = function () {
        if (this.onRest) this.onRest(this.value);
    };

    Spring.prototype.step = function (dt) {
        var omega = (2 * Math.PI) / this.response;
        var k = omega * omega;
        var c = 2 * this.damping * omega;

        // Fixed sub-steps keep the integration stable regardless of the
        // display's refresh rate (120Hz laptops, 60Hz externals).
        var step = 1 / 240;
        var remaining = dt;

        while (remaining > 0) {
            var h = remaining < step ? remaining : step;
            var displacement = this.value - this.target;
            var acceleration = -k * displacement - c * this.velocity;
            this.velocity += acceleration * h;
            this.value += this.velocity * h;
            remaining -= h;
        }

        var atRest =
            Math.abs(this.value - this.target) < this.restDistance &&
            Math.abs(this.velocity) < this.restVelocity;

        if (atRest) {
            this.value = this.target;
            this.velocity = 0;
            ticking.delete(this);
            this.emit();
            this.settle();
        } else {
            this.emit();
        }
    };

    /* Apple's momentum projection (§6) — from the Designing Fluid
       Interfaces sample code. Not the textbook v^2/(2a): the resting
       point of exponential scroll deceleration. */
    function project(velocity, decelerationRate) {
        var d = decelerationRate === undefined ? 0.998 : decelerationRate;
        return ((velocity / 1000) * d) / (1 - d);
    }

    /* Progressive resistance past a boundary (§9). The further you drag,
       the less the surface follows — it never hard-stops. */
    function rubberband(overshoot, dimension, constant) {
        var c = constant === undefined ? 0.55 : constant;
        return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
    }

    /* A short position history is what makes release velocity honest —
       the last single pointermove is noise (§2). */
    function VelocityTracker() {
        this.samples = [];
    }

    VelocityTracker.prototype.add = function (value) {
        this.samples.push({ value: value, time: performance.now() });
        if (this.samples.length > 6) this.samples.shift();
    };

    VelocityTracker.prototype.velocity = function () {
        var samples = this.samples;
        if (samples.length < 2) return 0;

        var last = samples[samples.length - 1];
        var first = samples[0];
        // Ignore stale samples: a finger that paused before lifting has
        // released with zero velocity, whatever it did 300ms ago.
        for (var i = samples.length - 2; i >= 0; i--) {
            if (last.time - samples[i].time > 120) break;
            first = samples[i];
        }

        var dt = (last.time - first.time) / 1000;
        if (dt <= 0) return 0;
        return (last.value - first.value) / dt;
    };

    VelocityTracker.prototype.reset = function () {
        this.samples.length = 0;
    };

    function clamp(v, min, max) {
        return v < min ? min : v > max ? max : v;
    }

    /* Feedback earns its place only at commit points — §13 (utility). */
    function haptic(pattern) {
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch (e) { /* not fatal */ }
        }
    }

    /* ===============================================================
       2. Theme — eased, never an abrupt brightness jump (§14)
       =============================================================== */

    var root = document.documentElement;
    var themeToggle = document.getElementById('themeToggle');
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
        root.style.colorScheme = theme;
        if (themeMeta) {
            themeMeta.setAttribute('content', theme === 'dark' ? '#000000' : '#fbfbfd');
        }
    }

    applyTheme(localStorage.getItem('theme') || (systemDark.matches ? 'dark' : 'light'));

    systemDark.addEventListener('change', function (e) {
        // Only follow the system while the user hasn't made a choice —
        // their choice outranks ours (§16, agency).
        if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
    });

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('theme', next);
            themeToggle.setAttribute(
                'aria-label',
                next === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'
            );
        });
    }

    /* ===============================================================
       3. Scroll — spring-driven so it stays interruptible (§3)
       Native smooth scroll cannot be grabbed mid-flight; this can. Any
       real scroll input hands control straight back to the user.
       =============================================================== */

    var scrollSpring = new Spring({
        damping: 1,
        response: 0.55,
        restDistance: 0.5,
        restVelocity: 2,
        onUpdate: function (value) {
            window.scrollTo(0, value);
        }
    });

    var scrollAnimating = false;

    function releaseScroll() {
        if (scrollAnimating) {
            scrollSpring.stop();
            scrollAnimating = false;
        }
    }

    ['wheel', 'touchstart', 'pointerdown'].forEach(function (type) {
        window.addEventListener(type, releaseScroll, { passive: true });
    });

    window.addEventListener('keydown', function (e) {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].indexOf(e.key) > -1) {
            releaseScroll();
        }
    });

    function scrollToY(y) {
        var maxY = document.documentElement.scrollHeight - window.innerHeight;
        var targetY = clamp(y, 0, maxY);

        if (reduceMotion) {
            window.scrollTo(0, targetY);
            return;
        }

        // Start from the live scroll position, not from wherever the last
        // animation was headed — §3, always animate from the presentation
        // value.
        scrollSpring.value = window.scrollY || window.pageYOffset;
        scrollAnimating = true;
        scrollSpring.to(targetY, { velocity: 0 });
        scrollSpring.onRest = function () {
            scrollAnimating = false;
        };
    }

    var header = document.getElementById('header');

    function scrollToTarget(hash) {
        if (hash === '#' || hash === '#top') return scrollToY(0);
        var el = document.querySelector(hash);
        if (!el) return;
        var headerHeight = header ? header.offsetHeight : 0;
        var top = el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
        scrollToY(top - headerHeight - 8);
    }

    /* ===============================================================
       4. Header material + the section indicator
       =============================================================== */

    var sections = Array.prototype.slice.call(document.querySelectorAll('section[id]'));
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('nav a[href^="#"]'));
    var navList = document.getElementById('navMenu');
    var navPanel = document.getElementById('navPanel');
    var goTop = document.getElementById('go-top');

    /* The active-item pill is a single element that springs from one nav
       item to the next, so the indicator moves continuously rather than
       fading out here and in over there (§7, spatial consistency). */
    var indicator = null;
    var indicatorX = null;
    var indicatorW = null;
    var indicatorVisible = false;

    if (navList && window.matchMedia('(min-width: 861px)').matches) {
        indicator = document.createElement('span');
        indicator.className = 'nav-indicator';
        navList.parentNode.insertBefore(indicator, navList);

        var geom = { x: 0, y: 0, w: 0, h: 0 };

        function paintIndicator() {
            indicator.style.width = geom.w + 'px';
            indicator.style.height = geom.h + 'px';
            indicator.style.transform = 'translate3d(' + geom.x + 'px, ' + geom.y + 'px, 0)';
        }

        // X and width are independent springs (§3): a single spring over a
        // 2D distance desyncs the moment the two axes differ in velocity.
        indicatorX = new Spring({
            damping: 1,
            response: 0.35,
            onUpdate: function (v) {
                geom.x = v;
                paintIndicator();
            }
        });

        indicatorW = new Spring({
            damping: 1,
            response: 0.35,
            onUpdate: function (v) {
                geom.w = v;
                paintIndicator();
            }
        });
    }

    function moveIndicator(link, immediate) {
        if (!indicator || !link) return;

        var parentBox = indicator.parentNode.getBoundingClientRect();
        var box = link.getBoundingClientRect();
        var x = box.left - parentBox.left;

        geom.y = box.top - parentBox.top;
        geom.h = box.height;

        if (!indicatorVisible || immediate) {
            indicatorX.set(x);
            indicatorW.set(box.width);
            indicator.style.opacity = '1';
            indicatorVisible = true;
        } else {
            indicatorX.to(x);
            indicatorW.to(box.width);
        }
    }

    var activeLink = null;

    function syncOnScroll() {
        var y = window.scrollY || window.pageYOffset;

        if (header) header.classList.toggle('at-edge', y > 8);
        if (goTop) goTop.classList.toggle('visible', y > window.innerHeight * 0.6);

        // The section under the reading line, not under the very top edge
        var anchor = y + window.innerHeight * 0.35;
        var current = sections.length ? sections[0].id : '';

        for (var i = 0; i < sections.length; i++) {
            if (sections[i].offsetTop <= anchor) current = sections[i].id;
        }

        var next = null;
        for (var j = 0; j < navLinks.length; j++) {
            var isActive = navLinks[j].getAttribute('href') === '#' + current;
            navLinks[j].classList.toggle('active', isActive);
            if (isActive) {
                next = navLinks[j];
                navLinks[j].setAttribute('aria-current', 'true');
            } else {
                navLinks[j].removeAttribute('aria-current');
            }
        }

        if (next && next !== activeLink) {
            activeLink = next;
            moveIndicator(next);
        }
    }

    // rAF-coalesced rather than debounced: a debounce would add latency
    // to something the user is looking at while they scroll (§1).
    var scrollQueued = false;
    window.addEventListener(
        'scroll',
        function () {
            if (scrollQueued) return;
            scrollQueued = true;
            requestAnimationFrame(function () {
                scrollQueued = false;
                syncOnScroll();
            });
        },
        { passive: true }
    );

    window.addEventListener('resize', function () {
        if (activeLink) moveIndicator(activeLink, true);
    });

    syncOnScroll();
    if (activeLink) moveIndicator(activeLink, true);

    /* ===============================================================
       5. The nav sheet — the gesture showcase
       Open and dismiss travel the same path (§7), the sheet tracks the
       finger 1:1 (§2), resists past its bound (§9), projects momentum
       on release (§6), hands that velocity to the spring (§5), and can
       be grabbed again mid-flight at any point (§3).
       =============================================================== */

    var menuToggle = document.getElementById('menuToggle');
    var navScrim = document.getElementById('navScrim');

    if (menuToggle && navPanel && navList) {
        var sheetOpen = false;
        var sheetHeight = 0;
        var dragging = false;
        var pointerId = null;
        var dragStartY = 0;
        var dragStartOffset = 0;
        var tracker = new VelocityTracker();

        function measureSheet() {
            // Read the real height; a hard-coded guess would drift as
            // soon as the nav gains an item.
            var wasHidden = !navPanel.classList.contains('open');
            if (wasHidden) navPanel.classList.add('animating');
            sheetHeight = navList.offsetHeight + 24;
            if (wasHidden) navPanel.classList.remove('animating');
        }

        function paintSheet(y) {
            // Progress from closed (-height) to open (0). Opacity and
            // scale are derived from position, so they follow the finger
            // during a drag instead of only playing at the end (§1).
            var progress = clamp(1 + y / sheetHeight, 0, 1);
            navList.style.transform =
                'translate3d(0, ' + y + 'px, 0) scale(' + (0.94 + 0.06 * progress) + ')';
            navList.style.opacity = String(clamp(progress * 1.4, 0, 1));
            if (navScrim) navScrim.style.opacity = String(progress * 0.9);
        }

        var sheetSpring = new Spring({
            damping: 0.85,
            response: 0.34,
            restDistance: 0.3,
            restVelocity: 2,
            onUpdate: paintSheet,
            onRest: function (value) {
                if (value < -1) {
                    navPanel.classList.remove('open', 'animating');
                    if (navScrim) navScrim.classList.remove('engaged');
                    navList.style.transform = '';
                    navList.style.opacity = '';
                }
            }
        });

        function openSheet() {
            measureSheet();
            if (!sheetOpen) {
                // Entering from behind the toggle it was launched from
                sheetSpring.value = -sheetHeight;
                paintSheet(-sheetHeight);
            }
            sheetOpen = true;
            navPanel.classList.add('open', 'animating');
            menuToggle.classList.add('active');
            menuToggle.setAttribute('aria-expanded', 'true');
            if (navScrim) navScrim.classList.add('engaged');
            // Momentum-free entry: critically damped, no overshoot (§4)
            sheetSpring.to(0, { damping: 1, response: 0.36, velocity: 0 });
        }

        function closeSheet(velocity) {
            sheetOpen = false;
            menuToggle.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            // Dismisses back up the way it arrived, carrying whatever
            // speed the finger had (§5, §7)
            sheetSpring.to(-sheetHeight, {
                damping: 1,
                response: 0.3,
                velocity: velocity || 0
            });
        }

        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', 'navMenu');

        menuToggle.addEventListener('click', function () {
            if (sheetOpen) closeSheet(0);
            else openSheet();
        });

        if (navScrim) {
            navScrim.addEventListener('click', function () {
                if (sheetOpen) closeSheet(0);
            });
        }

        document.addEventListener('keydown', function (e) {
            // Never trap the user (§16, wayfinding)
            if (e.key === 'Escape' && sheetOpen) {
                closeSheet(0);
                menuToggle.focus();
            }
        });

        navList.addEventListener('pointerdown', function (e) {
            if (!sheetOpen || e.pointerType === 'mouse') return;

            dragging = true;
            pointerId = e.pointerId;

            // Capture so tracking survives the pointer leaving the sheet.
            // Guarded: a synthetic pointer has nothing to capture.
            try {
                navList.setPointerCapture(pointerId);
            } catch (err) { /* tracking still works without capture */ }

            // Take over from the animation at its live value — the sheet
            // must not snap anywhere the instant it is grabbed (§3)
            dragStartY = e.clientY;
            dragStartOffset = sheetSpring.value;
            sheetSpring.stop();

            tracker.reset();
            tracker.add(e.clientY);
        });

        navList.addEventListener('pointermove', function (e) {
            if (!dragging || e.pointerId !== pointerId) return;

            var delta = e.clientY - dragStartY;
            var next = dragStartOffset + delta;

            // Upward is the dismiss direction and tracks 1:1. Downward is
            // past the boundary, so it resists progressively (§9).
            if (next > 0) next = rubberband(next, sheetHeight);

            tracker.add(e.clientY);
            paintSheet(next);
            sheetSpring.value = next;
        });

        function endDrag(e) {
            if (!dragging || (e.pointerId !== undefined && e.pointerId !== pointerId)) return;
            dragging = false;

            var velocity = tracker.velocity();
            // Where the flick is *going*, not where the finger let go (§6)
            var projected = sheetSpring.value + project(velocity);
            var shouldClose = projected < -sheetHeight * 0.4 || velocity < -550;

            if (shouldClose) {
                haptic(6);
                closeSheet(velocity);
            } else {
                // Came back from a flick: a touch of bounce is earned here
                // because the gesture itself carried momentum (§4)
                sheetSpring.to(0, { damping: 0.8, response: 0.35, velocity: velocity });
            }
        }

        navList.addEventListener('pointerup', endDrag);
        navList.addEventListener('pointercancel', endDrag);

        Array.prototype.forEach.call(navList.querySelectorAll('a'), function (link) {
            link.addEventListener('click', function () {
                if (sheetOpen) closeSheet(0);
            });
        });

        window.addEventListener('resize', function () {
            if (!window.matchMedia('(max-width: 860px)').matches && sheetOpen) {
                closeSheet(0);
            } else if (sheetOpen) {
                measureSheet();
            }
        });
    }

    /* Anchor links route through the interruptible spring scroll */
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (anchor) {
        anchor.addEventListener('click', function (e) {
            var href = this.getAttribute('href');
            if (!href || href.length < 2) {
                if (href === '#') {
                    e.preventDefault();
                    scrollToY(0);
                }
                return;
            }
            if (href === '#top' || document.querySelector(href)) {
                e.preventDefault();
                scrollToTarget(href);
            }
        });
    });

    /* ===============================================================
       6. Surfaces — one composed transform per element
       Reveal offset, hover lift and press scale all write into a single
       state object and are rendered together. Two independent springs
       fighting over one `transform` string is how elements start
       teleporting.
       =============================================================== */

    function surface(el) {
        if (el.__surface) return el.__surface;

        var state = {
            revealY: 0,
            lift: 0,
            scale: 1,
            opacity: null
        };

        state.render = function () {
            var y = state.revealY + state.lift;
            el.style.transform =
                'translate3d(0, ' + y.toFixed(2) + 'px, 0) scale(' + state.scale.toFixed(4) + ')';
            if (state.opacity !== null) el.style.opacity = state.opacity.toFixed(3);
        };

        el.__surface = state;
        return state;
    }

    var revealDistance = 26;

    function reveal(el, delay) {
        var state = surface(el);
        state.revealY = revealDistance;
        state.opacity = 0;
        state.render();

        var spring = new Spring({
            damping: 1,
            response: 0.5,
            restDistance: 0.001,
            restVelocity: 0.01,
            onUpdate: function (p) {
                state.revealY = revealDistance * (1 - p);
                state.opacity = p;
                state.render();
            },
            onRest: function () {
                // Stop paying for a composite layer once it is parked, and
                // drop the attribute so the "not yet revealed" rule no
                // longer applies to a finished element.
                el.removeAttribute('data-reveal');
                el.style.willChange = 'auto';
                el.style.opacity = '';
                state.opacity = null;
                state.revealY = 0;
                state.render();
            }
        });

        var start = function () {
            spring.to(1);
        };

        if (delay && !reduceMotion) window.setTimeout(start, delay);
        else start();
    }

    var revealTargets = [];

    function collectReveals(selector, root) {
        Array.prototype.forEach.call((root || document).querySelectorAll(selector), function (el) {
            if (revealTargets.indexOf(el) === -1) revealTargets.push(el);
        });
    }

    collectReveals('.section-intro');
    collectReveals('.about-content > div');
    collectReveals('.timeline-item');
    collectReveals('.subhead');
    collectReveals('.project-card:not(.hidden-project)');
    collectReveals('.contact-card');
    collectReveals('.grid-actions');
    collectReveals('.footer-content > *');

    root.classList.add('js-reveal');

    revealTargets.forEach(function (el) {
        el.setAttribute('data-reveal', '');
        el.style.willChange = 'transform, opacity';
    });

    if ('IntersectionObserver' in window) {
        var revealObserver = new IntersectionObserver(
            function (entries) {
                // Stagger by document order within the batch, so a group
                // that scrolls into view together cascades instead of
                // popping as one block.
                var visible = entries.filter(function (entry) {
                    return entry.isIntersecting;
                });

                visible.forEach(function (entry, index) {
                    reveal(entry.target, Math.min(index, 6) * 55);
                    revealObserver.unobserve(entry.target);
                });
            },
            { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
        );

        revealTargets.forEach(function (el) {
            revealObserver.observe(el);
        });
    } else {
        revealTargets.forEach(function (el) {
            reveal(el, 0);
        });
    }

    /* Hero enters on load rather than on scroll — it is already in view */
    var heroItems = Array.prototype.slice.call(
        document.querySelectorAll('.hero-content > *')
    );

    heroItems.forEach(function (el, index) {
        el.setAttribute('data-reveal', '');
        el.style.willChange = 'transform, opacity';
        reveal(el, index * 70);
    });

    /* Hover lift and press response for card surfaces.
       §1 — the press reads on pointer-down; waiting for the click would
       feel dead. */
    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    Array.prototype.forEach.call(
        document.querySelectorAll('.project-card, .contact-card'),
        function (card) {
            var state = surface(card);

            var lift = new Spring({
                damping: 1,
                response: 0.4,
                onUpdate: function (v) {
                    state.lift = v;
                    state.render();
                }
            });

            var press = new Spring({
                damping: 1,
                response: 0.22,
                restDistance: 0.0005,
                restVelocity: 0.005,
                onUpdate: function (v) {
                    state.scale = v;
                    state.render();
                }
            });

            press.value = 1;
            press.target = 1;

            if (canHover) {
                card.addEventListener('pointerenter', function () {
                    lift.to(-6);
                });
                card.addEventListener('pointerleave', function () {
                    lift.to(0);
                    press.to(1);
                });
            }

            card.addEventListener('pointerdown', function () {
                press.to(0.985, { response: 0.16 });
            });

            ['pointerup', 'pointercancel'].forEach(function (type) {
                card.addEventListener(type, function () {
                    // A little bounce on release: the press stored energy
                    press.to(1, { damping: 0.8, response: 0.32 });
                });
            });
        }
    );

    /* ===============================================================
       7. Progressive disclosure — the common path first, the rest one
       level deeper (§16, simplicity)
       =============================================================== */

    var toggleProjects = document.getElementById('toggleProjects');
    var hiddenProjects = Array.prototype.slice.call(document.querySelectorAll('.hidden-project'));
    var projectsExpanded = false;

    if (toggleProjects && hiddenProjects.length) {
        toggleProjects.setAttribute('aria-expanded', 'false');

        toggleProjects.addEventListener('click', function () {
            projectsExpanded = !projectsExpanded;
            toggleProjects.setAttribute('aria-expanded', String(projectsExpanded));

            if (projectsExpanded) {
                hiddenProjects.forEach(function (card, index) {
                    card.classList.add('show');
                    card.style.willChange = 'transform, opacity';
                    reveal(card, Math.min(index, 6) * 45);
                });
                toggleProjects.innerHTML =
                    'Show fewer projects <i class="fas fa-chevron-up" aria-hidden="true"></i>';
            } else {
                var anchorTop =
                    toggleProjects.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);

                hiddenProjects.forEach(function (card) {
                    card.classList.remove('show');
                    card.style.transform = '';
                    card.style.opacity = '';
                });

                toggleProjects.innerHTML =
                    'Show more projects <i class="fas fa-chevron-down" aria-hidden="true"></i>';

                // Keep the button under the same finger it was pressed
                // with — collapsing content must not throw the reader
                // somewhere else on the page.
                var delta =
                    anchorTop - (toggleProjects.getBoundingClientRect().top + (window.scrollY || window.pageYOffset));
                if (Math.abs(delta) > 4) {
                    scrollToY((window.scrollY || window.pageYOffset) - delta);
                }
            }
        });
    }

    console.log(
        '%cBuilt with springs, not durations.',
        'font: 500 13px -apple-system, system-ui; color: #86868b;'
    );
    console.log(
        '%chttps://github.com/prahack',
        'font: 500 13px -apple-system, system-ui; color: #0071e3;'
    );
})();
