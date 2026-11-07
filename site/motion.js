/*
 * KartUP waitlist page: scroll animations (GSAP + ScrollTrigger + Lenis, loaded after the page).
 * The page is fully usable without this file; it only adds motion. The hero entrance is pure CSS.
 * Starting states live in landing.css under html.ks-anim, which is set only here, when it starts.
 * Reduced motion: nothing runs, everything stays visible, no smooth scrolling.
 */
(function () {
  'use strict';
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger); // once, for the whole page
  document.documentElement.classList.add('ks-anim');

  // Smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync.
  if (window.Lenis) {
    var lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true });
    window.__ksLenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var q = function (sel) { return gsap.utils.toArray(sel); };
  var mm = gsap.matchMedia();
  mm.add({ mobile: '(max-width: 767px)', desktop: '(min-width: 768px)' }, function (ctx) {
    var mobile = !!ctx.conditions.mobile;

    // Speed lines rest while the hero is off screen.
    var lines = document.querySelector('.speed-lines');
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onToggle: function (self) { if (lines) lines.classList.toggle('paused', !self.isActive); } });

    // Reveals, batched so items entering together stagger.
    ScrollTrigger.batch(q('.rv'), {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) { gsap.to(batch, { y: 0, opacity: 1, duration: mobile ? 0.45 : 0.6, ease: 'power3.out', stagger: 0.08, overwrite: true }); },
    });

    // How it works: steps slide in, the race line draws itself while scrolling.
    gsap.to(q('.step'), { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '.steps', start: 'top 80%', once: true } });
    gsap.to(q('.track .draw'), { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 85%', end: mobile ? 'bottom 60%' : 'bottom 55%', scrub: mobile ? true : 0.4 } });

    // Ranks: the bar fills and each rank unlocks in turn (scrubbed with the scroll).
    var cards = q('.rank-slot');
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.rank-grid', start: 'top 80%', end: mobile ? 'bottom 70%' : 'bottom 60%', scrub: mobile ? true : 0.5 } });
    cards.forEach(function (card, i) {
      tl.to('.rank-fill', { scaleX: (i + 1) / cards.length, duration: 1, ease: 'none' })
        .to(card, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' }, '<0.5')
        .to(card.querySelector('.lock'), { opacity: 0, duration: 0.3 }, '<');
    });
  });

  // Fonts change text heights: measure again once they are in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
