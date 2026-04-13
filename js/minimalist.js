// Minimalist Portfolio JavaScript
// Modern interactions and animations

(function() {
    'use strict';

    // ===================================================================
    // Mobile Menu Toggle
    // ===================================================================
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            this.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking on a link
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            const isClickInsideNav = navMenu.contains(event.target);
            const isClickOnToggle = menuToggle.contains(event.target);
            
            if (!isClickInsideNav && !isClickOnToggle && navMenu.classList.contains('active')) {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }

    // ===================================================================
    // Header Scroll Effect
    // ===================================================================
    const header = document.getElementById('header');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });

    // ===================================================================
    // Smooth Scrolling for Navigation Links
    // ===================================================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just "#" or "#top"
            if (href === '#' || href === '#top') {
                e.preventDefault();
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                return;
            }

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const headerHeight = header.offsetHeight;
                const targetPosition = target.offsetTop - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ===================================================================
    // Active Navigation Link on Scroll
    // ===================================================================
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('nav a[href^="#"]');

    function updateActiveNav() {
        const scrollPosition = window.pageYOffset + 200;
        let currentSection = '';

        // Find which section is currently in view
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            if (scrollPosition >= sectionTop - 100) {
                currentSection = section.getAttribute('id');
            }
        });

        // Update active class - remove from all first, then add to current
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav);
    updateActiveNav();

    // ===================================================================
    // Back to Top Button
    // ===================================================================
    const goTopBtn = document.getElementById('go-top');

    if (goTopBtn) {
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 500) {
                goTopBtn.classList.add('visible');
            } else {
                goTopBtn.classList.remove('visible');
            }
        });
    }

    // ===================================================================
    // Scroll Animations (Intersection Observer)
    // ===================================================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll('.section').forEach(section => {
        observer.observe(section);
    });

    // Observe elements with animate-on-scroll class
    document.querySelectorAll('.animate-on-scroll').forEach(element => {
        observer.observe(element);
    });

    // ===================================================================
    // Preload Animation (if needed)
    // ===================================================================
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
    });

    // ===================================================================
    // Role Tags Animation in Hero
    // ===================================================================
    const roleTags = document.querySelectorAll('.role-tag');
    roleTags.forEach((tag, index) => {
        tag.style.animationDelay = `${0.6 + (index * 0.1)}s`;
    });

    // ===================================================================
    // Project Cards Hover Effect Enhancement
    // ===================================================================
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // ===================================================================
    // Timeline Items Stagger Animation
    // ===================================================================
    const timelineItems = document.querySelectorAll('.timeline-item');
    const timelineObserver = new IntersectionObserver(function(entries) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateX(0)';
                }, index * 100);
                timelineObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    timelineItems.forEach(item => {
        timelineObserver.observe(item);
    });

    // ===================================================================
    // Social Links Hover Effect
    // ===================================================================
    const socialLinks = document.querySelectorAll('.social-links a, .footer-social a');
    socialLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.1)';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // ===================================================================
    // Parallax Effect for Hero Section (disabled to prevent overlap)
    // ===================================================================
    // const hero = document.querySelector('.hero');
    // if (hero) {
    //     window.addEventListener('scroll', function() {
    //         const scrolled = window.pageYOffset;
    //         const parallaxSpeed = 0.5;
    //         
    //         if (scrolled < window.innerHeight) {
    //             hero.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
    //             hero.style.opacity = 1 - (scrolled / window.innerHeight) * 0.5;
    //         }
    //     });
    // }

    // ===================================================================
    // Contact Cards Animation
    // ===================================================================
    const contactCards = document.querySelectorAll('.contact-card');
    const contactObserver = new IntersectionObserver(function(entries) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 150);
                contactObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    contactCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'all 0.6s ease';
        contactObserver.observe(card);
    });

    // ===================================================================
    // Typing Effect for Hero Title (optional enhancement)
    // ===================================================================
    function typeWriter(element, text, speed = 100) {
        let i = 0;
        element.textContent = '';
        
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        
        type();
    }

    // Uncomment to enable typing effect
    // const heroTitle = document.querySelector('.hero h1');
    // if (heroTitle) {
    //     const originalText = heroTitle.textContent;
    //     window.addEventListener('load', function() {
    //         setTimeout(() => {
    //             typeWriter(heroTitle, originalText, 80);
    //         }, 500);
    //     });
    // }

    // ===================================================================
    // Performance: Debounce Scroll Events
    // ===================================================================
    function debounce(func, wait = 10, immediate = true) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    // Apply debounce to scroll-heavy functions
    window.addEventListener('scroll', debounce(updateActiveNav, 15));

    // ===================================================================
    // Dark Mode Toggle
    // ===================================================================
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    
    // Check for saved theme preference or default to light mode
    const currentTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-theme', currentTheme);
    
    // Theme toggle function
    function toggleTheme() {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Add a subtle animation to the toggle button
        themeToggle.style.transform = 'rotate(360deg) scale(1.1)';
        setTimeout(() => {
            themeToggle.style.transform = '';
        }, 400);
    }
    
    // Event listener for theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        
        // Keyboard accessibility
        themeToggle.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTheme();
            }
        });
    }
    
    // Detect system preference on first visit
    if (!localStorage.getItem('theme')) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            html.setAttribute('data-theme', newTheme);
        }
    });

    // ===================================================================
    // Toggle Projects Show More/Less
    // ===================================================================
    const toggleProjectsBtn = document.getElementById('toggleProjects');
    const hiddenProjects = document.querySelectorAll('.hidden-project');
    let projectsExpanded = false;

    if (toggleProjectsBtn) {
        toggleProjectsBtn.addEventListener('click', function() {
            const wasExpanded = projectsExpanded;
            projectsExpanded = !projectsExpanded;
            
            hiddenProjects.forEach(project => {
                if (projectsExpanded) {
                    project.classList.add('show');
                } else {
                    project.classList.remove('show');
                }
            });
            
            // Update button text and icon
            if (projectsExpanded) {
                this.innerHTML = 'Show Less Projects <i class="fas fa-chevron-up" style="margin-left: 0.5rem;"></i>';
            } else {
                this.innerHTML = 'Show More Projects <i class="fas fa-chevron-down" style="margin-left: 0.5rem;"></i>';
                
                // When collapsing, scroll to maintain position at the button
                setTimeout(() => {
                    const buttonPosition = this.getBoundingClientRect().top + window.pageYOffset;
                    const headerHeight = document.getElementById('header').offsetHeight;
                    window.scrollTo({
                        top: buttonPosition - headerHeight - 100,
                        behavior: 'smooth'
                    });
                }, 100);
            }
        });
    }

    // ===================================================================
    // Console Message
    // ===================================================================
    console.log('%c👋 Hello Developer!', 'font-size: 20px; font-weight: bold; color: #3498db;');
    console.log('%cInterested in the code? Check out the repo!', 'font-size: 14px; color: #5a6c7d;');
    console.log('%chttps://github.com/prahack', 'font-size: 14px; color: #3498db;');

})();
