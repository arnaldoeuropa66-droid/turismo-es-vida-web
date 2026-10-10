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
    {
      titulo: "Retiro Vuelve a ti",
      tag: "Holístico",
      img: "/assets/img/retiro.jpg",
      alt: "Retiro holístico en reserva natural"
    },
    {
      titulo: "City Tour Sabores",
      tag: "Cultura",
      img: "/assets/img/sabores.jpg",
      alt: "Tour gastronómico por Cali"
    },
    {
      titulo: "Laguna de Sonso",
      tag: "Naturaleza",
      img: "/assets/img/laguna.jpg",
      alt: "Kayak y avistamiento en la Laguna de Sonso"
    },
    {
      titulo: "Tour de Salsa",
      tag: "Música",
      img: "/assets/img/salsa.jpg",
      alt: "Clase de salsa caleña"
    },
    {
      titulo: "Bosque de Niebla",
      tag: "Naturaleza",
      img: "/assets/img/bosque.jpg",
      alt: "Caminata en el Bosque de Niebla Km 18"
    },
    {
      titulo: "Celebraciones",
      tag: "Especiales",
      img: "/assets/img/celebraciones.jpg",
      alt: "Celebración personalizada"
    }
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
     3. MENÚ MÓVIL
     ============================================================ */
  const burger = document.querySelector('.header__burger');
  const nav = document.querySelector('.header__nav');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      const abierto = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', abierto ? 'false' : 'true');
      nav.style.display = abierto ? '' : 'flex';
      if (!abierto) {
        nav.style.position = 'absolute';
        nav.style.top = '100%';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.flexDirection = 'column';
        nav.style.background = 'var(--crema)';
        nav.style.padding = '24px';
        nav.style.gap = '18px';
        nav.style.borderBottom = '1px solid rgba(31,61,43,.1)';
      }
    });
  }

})();