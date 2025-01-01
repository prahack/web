document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Target individual project boxes instead of rows
    const projectItems = document.querySelectorAll('#portfolio .col-six');
    projectItems.forEach((item, index) => {
        // Add slight delay to each item for a staggered animation
        item.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(item);
    });
});
