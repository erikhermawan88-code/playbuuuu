/**
 * Playbie Customizer - Color Swatch & Part Selection Handler
 * Fills the gap left by the missing app.js
 */

(function () {
  'use strict';

  // Wait for DOM + scripts to be ready
  function init() {
    initColorSwatches();
    initPartButtons();
    initSeriesSelector();
    initCartAndPromo();
  }

  // ---- COLOR SWATCH HANDLER ----
  function initColorSwatches() {
    var palette = document.getElementById('playbieColoursPalette');
    if (!palette) return;

    palette.querySelectorAll('.color-swatch-circle').forEach(function (swatch) {
      swatch.addEventListener('click', function () {
        var hex = this.getAttribute('data-color');
        var colorName = this.getAttribute('title') || hex;

        // Highlight swatch
        palette.querySelectorAll('.color-swatch-circle').forEach(function (s) {
          s.classList.remove('active');
          s.style.transform = 'none';
          s.style.boxShadow = 'none';
        });
        this.classList.add('active');
        this.style.transform = 'scale(1.15)';
        this.style.boxShadow = '0 0 8px rgba(0,0,0,0.3)';

        // Update display text
        var displayEl = document.getElementById('selectedColorNameDisplay');
        if (displayEl) displayEl.textContent = 'Warna Terpilih: ' + colorName;

        // Apply color to 3D model via playbie3D or fallback
        applyColorToModel(hex, colorName);
      });
    });

    // Init first swatch as active
    var firstSwatch = palette.querySelector('.color-swatch-circle');
    if (firstSwatch) {
      firstSwatch.classList.add('active');
      firstSwatch.style.transform = 'scale(1.15)';
      firstSwatch.style.boxShadow = '0 0 8px rgba(0,0,0,0.3)';
    }
  }

  // ---- APPLY COLOR TO 3D MODEL ----
  function applyColorToModel(hex, colorName) {
    // Method 1: via playbie3D viewer
    if (window.playbie3D && typeof window.playbie3D.setColorToSelectedPart === 'function') {
      window.playbie3D.setColorToSelectedPart(hex);
      return;
    }

    // Method 2: direct mesh update via playbie3D
    if (window.playbie3D && window.playbie3D.scene) {
      var viewer = window.playbie3D;
      var partName = viewer.selectedPart || 'leftWallOuter';
      var targetMesh = findMeshByPartName(viewer, partName);

      if (targetMesh && targetMesh.material) {
        var color = new THREE.Color(hex);
        if (Array.isArray(targetMesh.material)) {
          targetMesh.material.forEach(function (m) { m.color = color; });
        } else {
          targetMesh.material.color = color;
        }
      }
    }
  }

  function findMeshByPartName(viewer, partName) {
    var mapping = {
      'leftWallOuter': 'leftWallOuter',
      'leftWallInner': 'leftWallInner',
      'rightWallOuter': 'rightWallOuter',
      'rightWallInner': 'rightWallInner',
      'frontWallOuter': 'frontWallOuter',
      'frontWallInner': 'frontWallInner',
      'backWallOuter': 'backWallOuter',
      'backWallInner': 'backWallInner',
      'floorMat1': 'floorMat1',
      'floorMat2': 'floorMat2',
      'floorMat3': 'floorMat3'
    };

    var searchName = mapping[partName] || partName;
    var group = viewer.productGroup;

    if (group && group.children) {
      for (var i = 0; i < group.children.length; i++) {
        var child = group.children[i];
        if (child.name === searchName || child.userData.partName === searchName) {
          return child;
        }
      }
      // Fallback: return first mesh with matching part in name
      for (var j = 0; j < group.children.length; j++) {
        var c = group.children[j];
        if (c.type === 'Mesh' && c.name && c.name.toLowerCase().indexOf(searchName.toLowerCase()) !== -1) {
          return c;
        }
      }
    }
    return null;
  }

  // ---- PART BUTTON HANDLER (sync with viewer3d) ----
  function initPartButtons() {
    var partBtns = document.querySelectorAll('.part-btn');
    if (!partBtns.length) return;

    partBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var partName = this.getAttribute('data-part');

        // Toggle active class
        partBtns.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');

        // Sync to playbie3D viewer
        if (window.playbie3D) {
          window.playbie3D.selectedPart = partName;

          // Highlight color swatch matching current part color
          syncColorSwatchHighlight(partName);
        }
      });
    });

    // Auto-select first part
    if (partBtns[0]) {
      partBtns[0].click();
    }
  }

  function syncColorSwatchHighlight(partName) {
    if (!window.playbie3D || !window.playbie3D.colors) return;

    var currentColor = window.playbie3D.colors[partName];
    if (!currentColor) return;

    var palette = document.getElementById('playbieColoursPalette');
    if (!palette) return;

    palette.querySelectorAll('.color-swatch-circle').forEach(function (sw) {
      var swatchHex = sw.getAttribute('data-color');
      var isMatch = swatchHex.toLowerCase() === currentColor.toLowerCase();
      sw.classList.toggle('active', isMatch);
      sw.style.transform = isMatch ? 'scale(1.15)' : 'none';
      sw.style.boxShadow = isMatch ? '0 0 8px rgba(0,0,0,0.3)' : 'none';

      if (isMatch) {
        var displayEl = document.getElementById('selectedColorNameDisplay');
        if (displayEl) displayEl.textContent = 'Warna Terpilih: ' + (sw.getAttribute('title') || swatchHex);
      }
    });
  }

  // ---- SERIES SELECTOR ----
  function initSeriesSelector() {
    var seriesSelect = document.getElementById('seriesSelector');
    if (seriesSelect) {
      seriesSelect.addEventListener('change', function () {
        var series = this.value;
        var premiumPalette = document.getElementById('playbieColoursPalette');
        var animalPalette = document.getElementById('animalPalette');

        if (premiumPalette) premiumPalette.style.display = series === 'color' ? '' : 'none';
        if (animalPalette) animalPalette.style.display = series === 'animal' ? '' : 'none';

        if (window.playbie3D) {
          window.playbie3D.switchSeries(series);
        }
      });
    }
  }

  // ---- CART & PROMO ----
  function initCartAndPromo() {
    var promoInput = document.getElementById('promoInput');
    var promoBtn = document.querySelector('.promo-apply-btn, #promoApplyBtn');
    if (promoBtn) {
      promoBtn.addEventListener('click', function () {
        var code = promoInput ? promoInput.value.trim().toUpperCase() : '';
        if (code === 'PLAYBIE10') {
          showPromoSuccess('PLAYBIE10', '10%');
        } else if (code) {
          showPromoError('Kode promo tidak valid');
        }
      });
    }

    var addToCartBtn = document.getElementById('btnAddCustomToCart');
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', function () {
        if (window.playbie3D) {
          var design = window.playbie3D.getCurrentDesign();
          addToCart(design);
          showCartNotification();
        }
      });
    }
  }

  function showPromoSuccess(code, discount) {
    var el = document.getElementById('promoMessage') || createPromoEl();
    el.textContent = '✓ Kode ' + code + ' aktif! Diskon ' + discount;
    el.style.color = '#22c55e';
    el.style.display = 'block';
  }

  function showPromoError(msg) {
    var el = document.getElementById('promoMessage') || createPromoEl();
    el.textContent = '✗ ' + msg;
    el.style.color = '#ef4444';
    el.style.display = 'block';
  }

  function createPromoEl() {
    var el = document.createElement('div');
    el.id = 'promoMessage';
    el.style.cssText = 'padding:8px 12px;border-radius:6px;font-size:13px;margin-top:8px;';
    var input = document.getElementById('promoInput');
    if (input) input.parentNode.appendChild(el);
    return el;
  }

  function showCartNotification() {
    var badge = document.getElementById('cartBadgeCount');
    if (badge) {
      var count = parseInt(badge.textContent || '0') + 1;
      badge.textContent = count;
      badge.style.display = 'flex';
    }
    var notif = document.createElement('div');
    notif.textContent = '✓ Desain ditambahkan ke keranjang!';
    notif.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#22c55e;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;animation:fadeIn 0.3s';
    document.body.appendChild(notif);
    setTimeout(function () { notif.remove(); }, 3000);
  }

  function addToCart(design) {
    console.log('[app.js] Add to cart:', design);
  }

  // ---- BOOT ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure viewer3d.js has finished
    setTimeout(init, 200);
  }

})();
