/**
 * Playbie Products Renderer
 * Loads products from products.json and renders to #productsGrid
 * Shows product images, variants, descriptions with Shopee purchase link
 */

(function() {
  'use strict';

  var products = [];
  var currentFilter = 'all';

  function init() {
    fetch('products.json')
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        products = data.products || [];
        renderProducts();
        initFilters();
        initSearch();
        initSort();
      })
      .catch(function(err) {
        console.warn('[Products] Failed to load products.json:', err);
      });
  }

  function renderProducts() {
    var grid = document.getElementById('productsGrid');
    if (!grid) return;

    var filtered = getFilteredProducts();

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="products-empty"><p>Tidak ada produk ditemukan.</p></div>';
      return;
    }

    var html = '';
    filtered.forEach(function(p) {
      html += createProductCard(p);
    });
    grid.innerHTML = html;

    // Attach click handlers
    grid.querySelectorAll('.product-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.btn-buy')) return;
        var id = this.getAttribute('data-id');
        var product = products.find(function(prod) { return prod.id === id; });
        if (product) showProductModal(product);
      });
    });

    // Attach buy button handlers
    grid.querySelectorAll('.btn-buy').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        var product = products.find(function(prod) { return prod.id === id; });
        if (product && product.shopeeLink) {
          window.open(product.shopeeLink, '_blank');
        }
      });
    });
  }

  function createProductCard(p) {
    var badge = '';
    if (p.badge) badge = '<span class="product-badge">' + p.badge + '</span>';
    
    var discount = '';
    if (p.originalPrice && p.originalPrice !== p.price) {
      discount = '<span class="product-discount">' + getDiscount(p.price, p.originalPrice) + '%</span>';
    }

    var ratingStars = '★'.repeat(Math.floor(p.rating || 5)) + (p.rating % 1 >= 0.5 ? '½' : '');
    var sold = p.sold ? '<span class="product-sold">' + p.sold + ' terjual</span>' : '';

    var colorCount = (p.variants && p.variants.colors) ? p.variants.colors.length : 0;
    var sizeCount = (p.variants && p.variants.sizes) ? p.variants.sizes.length : 0;
    var variantText = '';
    if (colorCount > 0) variantText += colorCount + ' warna';
    if (colorCount > 0 && sizeCount > 0) variantText += ' · ';
    if (sizeCount > 0) variantText += sizeCount + ' ukuran';

    return '<div class="product-card" data-id="' + p.id + '">' +
      '<div class="product-image-wrapper">' +
        '<img src="' + (p.image || 'assets/product-placeholder.jpg') + '" alt="' + p.name + '" loading="lazy" onerror="this.src=\'assets/product-placeholder.jpg\'">' +
        badge +
        discount +
        '<div class="product-overlay">' +
          '<button class="btn-quick-view" onclick="event.stopPropagation(); document.querySelector(\'[data-id=' + p.id + ']\').click();">Lihat Detail</button>' +
        '</div>' +
      '</div>' +
      '<div class="product-info">' +
        '<span class="product-category">' + (p.category || 'Playbie') + '</span>' +
        '<h3 class="product-name">' + p.name + '</h3>' +
        '<div class="product-rating">' +
          '<span class="stars">' + ratingStars + '</span> ' +
          '<span class="rating-num">' + p.rating + '</span> ' +
          sold +
        '</div>' +
        '<div class="product-price-row">' +
          '<span class="product-price">' + p.price + '</span>' +
          (p.originalPrice ? '<span class="product-original-price">' + p.originalPrice + '</span>' : '') +
        '</div>' +
        '<div class="product-variants-preview">' +
          '<span class="variant-text">' + variantText + '</span>' +
        '</div>' +
        '<button class="btn-buy" data-id="' + p.id + '">' +
          'Beli di Shopee ↗' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function getDiscount(sale, original) {
    var s = parseInt((sale || '0').replace(/[^0-9]/g, '')) || 0;
    var o = parseInt((original || '0').replace(/[^0-9]/g, '')) || 0;
    if (o <= 0) return 0;
    return Math.round((1 - s / o) * 100);
  }

  function showProductModal(p) {
    var modal = document.getElementById('productModal');
    if (!modal) {
      // Create modal dynamically
      createProductModal();
      modal = document.getElementById('productModal');
    }

    // Fill modal content
    var imgEl = document.getElementById('modalProductImg');
    if (imgEl) imgEl.src = p.image || 'assets/product-placeholder.jpg';
    if (imgEl) imgEl.onerror = function() { this.src = 'assets/product-placeholder.jpg'; };

    var nameEl = document.getElementById('modalProductName');
    if (nameEl) nameEl.textContent = p.name;

    var priceEl = document.getElementById('modalProductPrice');
    if (priceEl) priceEl.textContent = p.price;

    var descEl = document.getElementById('modalProductDesc');
    if (descEl) descEl.textContent = p.description || '';

    // Render variants
    var variantsEl = document.getElementById('modalProductVariants');
    if (variantsEl) {
      var html = '';
      
      if (p.variants && p.variants.colors && p.variants.colors.length > 0) {
        html += '<div class="modal-variant-group"><label>Pilihan Warna (' + p.variants.colors.length + '):</label>';
        html += '<div class="modal-variant-options">';
        p.variants.colors.forEach(function(c) {
          html += '<span class="modal-variant-chip">' + c + '</span>';
        });
        html += '</div></div>';
      }

      if (p.variants && p.variants.sizes && p.variants.sizes.length > 0) {
        html += '<div class="modal-variant-group"><label>Ukuran:</label>';
        html += '<div class="modal-variant-options">';
        p.variants.sizes.forEach(function(s) {
          html += '<span class="modal-variant-chip size-chip">' + s + '</span>';
        });
        html += '</div></div>';
      }

      if (p.variants && p.variants.types) {
        html += '<div class="modal-variant-group"><label>Tipe:</label>';
        html += '<div class="modal-variant-options">';
        p.variants.types.forEach(function(t) {
          html += '<span class="modal-variant-chip">' + t + '</span>';
        });
        html += '</div></div>';
      }

      variantsEl.innerHTML = html || '<p class="no-variants">Varian lihat di Shopee</p>';
    }

    // Render features
    var featuresEl = document.getElementById('modalProductFeatures');
    if (featuresEl && p.features) {
      featuresEl.innerHTML = '<div class="modal-features-list">' +
        p.features.map(function(f) { return '<span class="feature-tag">' + f + '</span>'; }).join('') +
        '</div>';
    }

    // Shopee button
    var shopeeBtn = document.getElementById('modalShopeeBtn');
    if (shopeeBtn && p.shopeeLink) {
      shopeeBtn.href = p.shopeeLink;
      shopeeBtn.target = '_blank';
    }

    // Rating/sold
    var metaEl = document.getElementById('modalProductMeta');
    if (metaEl) {
      metaEl.innerHTML = '<span>★ ' + p.rating + '</span> · <span>' + (p.sold || '0') + ' terjual</span>';
    }

    // Show modal
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  function createProductModal() {
    var modalHTML = 
      '<div id="productModal" class="product-modal-overlay" onclick="if(event.target===this)closeProductModal()">' +
        '<div class="product-modal-card">' +
          '<button class="modal-close-btn" onclick="closeProductModal()">✕</button>' +
          '<div class="modal-content">' +
            '<div class="modal-left">' +
              '<img id="modalProductImg" src="" alt="Product" class="modal-product-img">' +
            '</div>' +
            '<div class="modal-right">' +
              '<span class="modal-category" id="modalProductCategory"></span>' +
              '<h2 id="modalProductName" class="modal-product-name"></h2>' +
              '<div id="modalProductMeta" class="modal-product-meta"></div>' +
              '<div id="modalProductPrice" class="modal-product-price"></div>' +
              '<div id="modalProductVariants" class="modal-variants"></div>' +
              '<div id="modalProductFeatures" class="modal-features"></div>' +
              '<div class="modal-description">' +
                '<h4>Deskripsi</h4>' +
                '<p id="modalProductDesc"></p>' +
              '</div>' +
              '<a id="modalShopeeBtn" href="#" class="btn btn-primary btn-shopee-modal" target="_blank">' +
                'Beli di Shopee ↗' +
              '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  window.closeProductModal = function() {
    var modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  };

  function getFilteredProducts() {
    if (currentFilter === 'all') return products;
    
    var catMap = {
      'bumper': ['Bumper Bed', 'Bumper Box'],
      'playmat': ['Playmat', 'Play Mat'],
      'custom': ['Custom']
    };
    
    var keywords = catMap[currentFilter] || [];
    if (keywords.length === 0) return products;
    
    return products.filter(function(p) {
      var cat = (p.category || '').toLowerCase();
      var name = (p.name || '').toLowerCase();
      return keywords.some(function(k) { 
        return cat.indexOf(k.toLowerCase()) > -1 || name.indexOf(k.toLowerCase()) > -1; 
      });
    });
  }

  function initFilters() {
    var btns = document.querySelectorAll('.filter-btn');
    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        btns.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentFilter = this.getAttribute('data-category');
        renderProducts();
      });
    });
  }

  function initSearch() {
    var input = document.getElementById('catalogSearch');
    if (!input) return;
    input.addEventListener('input', function() {
      var q = this.value.toLowerCase();
      var cards = document.querySelectorAll('.product-card');
      cards.forEach(function(card) {
        var name = card.querySelector('.product-name').textContent.toLowerCase();
        var show = name.indexOf(q) > -1;
        card.style.display = show ? '' : 'none';
      });
    });
  }

  function initSort() {
    var select = document.getElementById('catalogSort');
    if (!select) return;
    select.addEventListener('change', function() {
      var val = this.value;
      if (val === 'default') {
        renderProducts();
        return;
      }
      
      var filtered = getFilteredProducts().slice();
      
      if (val === 'price-asc') {
        filtered.sort(function(a, b) { return parsePrice(a.price) - parsePrice(b.price); });
      } else if (val === 'price-desc') {
        filtered.sort(function(a, b) { return parsePrice(b.price) - parsePrice(a.price); });
      } else if (val === 'popular') {
        filtered.sort(function(a, b) { return parseSold(b.sold) - parseSold(a.sold); });
      }
      
      var grid = document.getElementById('productsGrid');
      var html = '';
      filtered.forEach(function(p) { html += createProductCard(p); });
      grid.innerHTML = html;
      
      // Re-attach handlers
      grid.querySelectorAll('.product-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.btn-buy')) return;
          var id = this.getAttribute('data-id');
          var product = products.find(function(prod) { return prod.id === id; });
          if (product) showProductModal(product);
        });
      });
      grid.querySelectorAll('.btn-buy').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var id = this.getAttribute('data-id');
          var product = products.find(function(prod) { return prod.id === id; });
          if (product && product.shopeeLink) window.open(product.shopeeLink, '_blank');
        });
      });
    });
  }

  function parsePrice(priceStr) {
    if (!priceStr) return 0;
    return parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
  }

  function parseSold(soldStr) {
    if (!soldStr) return 0;
    var num = parseInt(soldStr.replace(/[^0-9]/g, '')) || 0;
    if (soldStr.indexOf('RB') > -1) num *= 1000;
    if (soldStr.indexOf('JT') > -1) num *= 1000000;
    return num;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
