// ===== NAV SCROLL HIGHLIGHT =====
const sections = document.querySelectorAll('.section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 200) current = s.id;
  });
  navLinks.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
});

// ===== SKILL TREE TOGGLE =====
document.querySelectorAll('.skill-folder-header').forEach(h => {
  h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
});

// ===== SCENARIO TABS =====
document.querySelectorAll('.scenario-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const group = tab.closest('.section');
    group.querySelectorAll('.scenario-tab').forEach(t => t.classList.remove('active'));
    group.querySelectorAll('.scenario-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = group.querySelector('#' + tab.dataset.target);
    if (target) {
      target.classList.add('active');
      // re-trigger animations
      target.querySelectorAll('.flow-step').forEach(s => {
        s.style.animation = 'none';
        s.offsetHeight;
        s.style.animation = '';
      });
    }
  });
});

// ===== CHECKLIST =====
document.querySelectorAll('.check-item').forEach(item => {
  item.addEventListener('click', () => {
    item.classList.toggle('checked');
    const cb = item.querySelector('.checkbox');
    cb.textContent = item.classList.contains('checked') ? '✓' : '';
  });
});

// ===== SCROLL REVEAL =====
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.card, .timeline-item, .arch-box, .deploy-service, .disclosure-step').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.visible, .card, .timeline-item, .arch-box, .deploy-service, .disclosure-step').forEach(el => {
    // initial check
  });
});
// Add visible class styles dynamically
const style = document.createElement('style');
style.textContent = '.visible { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(style);
