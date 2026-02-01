document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;
    const totalSlides = slides.length;
    const intervalTime = 6000; // 6 seconds per slide

    if (totalSlides === 0) return;

    function showSlide(index) {
        // Remove active class from all
        slides.forEach(slide => {
            slide.classList.remove('active');
            slide.classList.remove('prev'); // optional for more complex animations
        });

        // Add active to current
        slides[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % totalSlides;
        showSlide(currentSlide);
    }

    // Auto Advance
    let slideInterval = setInterval(nextSlide, intervalTime);

    // Optional: Pause on hover if we added controls later
    // const heroSection = document.querySelector('.hero-section');
    // heroSection.addEventListener('mouseenter', () => clearInterval(slideInterval));
    // heroSection.addEventListener('mouseleave', () => slideInterval = setInterval(nextSlide, intervalTime));
});