document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.hero-slide');
    const controls = document.querySelectorAll('.slide-controls');
    let currentSlide = 0;
    const totalSlides = slides.length;
    const intervalTime = 6000; // 6 seconds per slide

    if (totalSlides === 0) return;

    function showSlide(index) {
        // Remove active class from all
        slides.forEach(slide => {
            slide.classList.remove('active');
            slide.classList.remove('prev'); 
        });
        controls.forEach(control => {
            control.classList.remove('active');
        });

        // Add active to current
        if (slides[index]) slides[index].classList.add('active');
        if (controls[index]) controls[index].classList.add('active');
    }

    // Expose to window for onclick handlers
    window.nextSlide = function() {
        currentSlide = (currentSlide + 1) % totalSlides;
        showSlide(currentSlide);
    }

    window.prevSlide = function() {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        showSlide(currentSlide);
    }

    // Auto Advance
    let slideInterval = setInterval(window.nextSlide, intervalTime);

    // Optional: Pause on hover
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        heroSection.addEventListener('mouseenter', () => clearInterval(slideInterval));
        heroSection.addEventListener('mouseleave', () => slideInterval = setInterval(window.nextSlide, intervalTime));
    }
});