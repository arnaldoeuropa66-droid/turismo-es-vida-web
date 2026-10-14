/* ============================================================
   Turismo es Vida SAS — JS principal
   - Reel 3D de experiencias
   - Parallax del hero
   - Menú móvil
   ============================================================ */

(function(){
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esMovil = window.matchMedia('(max-width: 900px)').matches;

  /* ============================================================
     1. REEL 3D DE EXPERIENCIAS
     ============================================================ */
  const experiencias = [
  { titulo: "Retiro Vuelve a ti", tag: "Holístico",    img: "/assets/img/retiro.webp",       alt: "Retiro holístico en reserva natural" },
  { titulo: "City Tour Sabores",  tag: "Cultura",      img: "/assets/img/sabores.webp",      alt: "Tour gastronómico por Cali" },
  { titulo: "Laguna de Sonso",    tag: "Naturaleza",   img: "/assets/img/laguna.webp",       alt: "Kayak y avistamiento en la Laguna de Sonso" },
  { titulo: "Tour de Salsa",      tag: "Música",       img: "/assets/img/salsa.webp",        alt: "Clase de salsa caleña" },
  { titulo: "Bosque de Niebla",   tag: "Naturaleza",   img: "/assets/img/bosque.webp",       alt: "Caminata en el Bosque de Niebla Km 18" },
  { titulo: "Celebraciones",      tag: "Especiales",   img: "/assets/img/celebraciones.webp",alt: "Celebración personalizada" }
];

  const carrusel = document.getElementById('reelCarrusel');
  if (carrusel) {
    const total = experiencias.length;
    const radio = 320;
    let indice = 0;

    experiencias.forEach((exp, i) => {
      const card = document.createElement('article');
      card.className = 'reel__tarjeta';
      card.innerHTML =
        '<img src="' + exp.img + '" alt="' + exp.alt + '" loading="lazy" width="280" height="380">' +
        '<div class="reel__tarjeta__texto">' +
          '<span>' + exp.tag + '</span>' +
          '<h3>' + exp.titulo + '</h3>' +
        '</div>';
      card.addEventListener('click', () => { indice = i; rotar(); });
      carrusel.appendChild(card);
    });

    function rotar(){
      const tarjetas = carrusel.querySelectorAll('.reel__tarjeta');
      const angulo = 360 / total;
      tarjetas.forEach((card, i) => {
        const offset = (i - indice + total) % total;
        const a = offset * angulo;
        const rad = (a * Math.PI) / 180;
        const x = Math.sin(rad) * radio;
        const z = Math.cos(rad) * radio - radio;
        card.style.transform = 'translateX(' + x + 'px) translateZ(' + z + 'px) rotateY(' + (-a) + 'deg)';
        card.classList.toggle('activa', offset === 0);
        card.style.zIndex = total - offset;
      });
    }
    rotar();

    const btnNext = document.getElementById('reelNext');
    const btnPrev = document.getElementById('reelPrev');
    if (btnNext) btnNext.addEventListener('click', () => { indice = (indice + 1) % total; rotar(); });
    if (btnPrev) btnPrev.addEventListener('click', () => { indice = (indice - 1 + total) % total; rotar(); });

    /* Navegación con teclado */
    carrusel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { indice = (indice + 1) % total; rotar(); }
      if (e.key === 'ArrowLeft')  { indice = (indice - 1 + total) % total; rotar(); }
    });
  }

  /* ============================================================
     2. PARALLAX DEL HERO (solo si no hay reduced-motion)
     ============================================================ */
  if (!reduce && !esMovil) {
    const capas = document.querySelectorAll('.hero__capa');
    const contenido = document.querySelector('.hero__contenido');
    let ticking = false;

    function onScroll(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y <= window.innerHeight) {
          capas.forEach((capa, i) => {
            const factor = (i + 1) * 0.04;
            capa.style.transform += ' translateY(' + (y * factor) + 'px)';
          });
          if (contenido) {
            contenido.style.transform = 'translateY(' + (y * 0.25) + 'px) translateZ(60px)';
            contenido.style.opacity = 1 - y / (window.innerHeight * 0.9);
          }
        }
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

   /* ============================================================
     MENÚ MÓVIL
     ============================================================ */

  const burger = document.querySelector('.header__burger');
  const nav = document.querySelector('.header__nav');

  if (burger && nav) {
    // Crear el overlay si no existe
    let overlay = document.querySelector('.menu-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'menu-overlay';
      document.body.appendChild(overlay);
    }

    function abrirMenu() {
      nav.classList.add('abierto');
      burger.classList.add('abierto');
      burger.setAttribute('aria-expanded', 'true');
      overlay.classList.add('visible');
      document.body.classList.add('menu-abierto');
    }

    function cerrarMenu() {
      nav.classList.remove('abierto');
      burger.classList.remove('abierto');
      burger.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('visible');
      document.body.classList.remove('menu-abierto');
    }

    burger.addEventListener('click', () => {
      if (nav.classList.contains('abierto')) {
        cerrarMenu();
      } else {
        abrirMenu();
      }
    });

    overlay.addEventListener('click', cerrarMenu);

    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) cerrarMenu();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('abierto')) {
        cerrarMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && nav.classList.contains('abierto')) {
        cerrarMenu();
      }
    });
  }
  /* ============================================================
     4. ANIMACIONES AL SCROLL (IntersectionObserver)
     ============================================================ */

  // Elementos que queremos animar
 const elementosAnimar = [
  '.reel__titulo',
  '.reel__sub',
  '.timeline__item',
  '.medico__paso',
  '.seccion h2',
  '.subtitulo'
];

  // Añadir la clase .animar a todos los elementos
  elementosAnimar.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.classList.add('animar');
      // Delay escalonado: los primeros 4 elementos de cada grupo tienen delay
      if (i < 4) el.classList.add('animar--delay-' + (i + 1));
    });
  });

  // IntersectionObserver
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Dejar de observar una vez animado
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.animar').forEach(el => observer.observe(el));
  } else {
    // Fallback: si no hay soporte, mostrar todo
    document.querySelectorAll('.animar').forEach(el => el.classList.add('visible'));
  }

  /* ============================================================
     5. BOTÓN VOLVER ARRIBA
     ============================================================ */

  const btnVolverArriba = document.createElement('button');
  btnVolverArriba.className = 'volver-arriba';
  btnVolverArriba.setAttribute('aria-label', 'Volver arriba');
  btnVolverArriba.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
      '<path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  document.body.appendChild(btnVolverArriba);

  // Mostrar/ocultar según el scroll
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (window.scrollY > 600) {
        btnVolverArriba.classList.add('visible');
      } else {
        btnVolverArriba.classList.remove('visible');
      }
      ticking = false;
    });
  }, { passive: true });

  // Click: scroll suave al inicio
  btnVolverArriba.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
    /* ============================================================
     6. ANIMACIÓN DE LAS TRES PUERTAS (convergencia)
     ============================================================ */

  const puertas = document.querySelector('.puertas.animar-puertas');
  if (puertas && 'IntersectionObserver' in window) {
    const observerPuertas = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observerPuertas.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.25,
      rootMargin: '0px 0px -80px 0px'
    });
    observerPuertas.observe(puertas);
  } else if (puertas) {
    puertas.classList.add('visible');
  }
})();