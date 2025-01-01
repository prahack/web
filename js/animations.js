// Add animation delay to intro position spans
document.addEventListener('DOMContentLoaded', function() {
    // Add index to position spans for staggered animation
    document.querySelectorAll('.intro-position span').forEach((span, index) => {
        span.style.setProperty('--span-index', index);
    });

    // Add parallax effect only on desktop
    const intro = document.querySelector('#intro');
    let isMobile = window.matchMedia("(max-width: 768px)").matches;
    
    function handleParallax(e) {
        if (!isMobile) {
            const mouseX = e.clientX / window.innerWidth;
            const mouseY = e.clientY / window.innerHeight;
            
            const moveX = (mouseX - 0.5) * 20;
            const moveY = (mouseY - 0.5) * 20;
            
            intro.style.backgroundPosition = `${50 + moveX}% ${50 + moveY}%`;
        }
    }

    // Add parallax effect with throttling
    let ticking = false;
    document.addEventListener('mousemove', (e) => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleParallax(e);
                ticking = false;
            });
            ticking = true;
        }
    });

    // Update isMobile on resize
    window.addEventListener('resize', () => {
        isMobile = window.matchMedia("(max-width: 768px)").matches;
        if (isMobile) {
            intro.style.backgroundPosition = 'center';
        }
    });

    // Disable animations on mobile if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.style.setProperty('--animation-duration', '0s');
    }
});
