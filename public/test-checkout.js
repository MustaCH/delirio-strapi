(() => {
  const productsEl = document.getElementById('products');
  const statusEl = document.getElementById('status');
  const refreshBtn = document.getElementById('refresh');
  const saveClientBtn = document.getElementById('save-client');
  const resetClientBtn = document.getElementById('reset-client');
  const clientInfoEl = document.getElementById('client-info');

  const API_BASE = window.location.origin;
  const api = {
    productos: `${API_BASE}/api/productos?pagination[pageSize]=50`,
    clientePublic: `${API_BASE}/api/clientes/public`,
    checkout: `${API_BASE}/api/ordenes/checkout`,
  };

  let clienteId = null;

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#f87171' : '#94a3b8';
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      console.error('Respuesta no JSON', { url, status: res.status, text });
      throw new Error(`No se pudo parsear la respuesta de ${url}: ${text?.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg = json?.error?.message || res.statusText || 'Error';
      console.error('Error HTTP', { url, status: res.status, body: json });
      throw new Error(msg);
    }
    return json;
  }

  async function loadProducts() {
    setStatus('Cargando productos...');
    productsEl.innerHTML = '';
    refreshBtn.classList.add('loading');
    try {
      const data = await fetchJSON(api.productos);
      const productos = data?.data || [];
      if (!productos.length) {
        productsEl.innerHTML = '<div class="muted">No hay productos publicados</div>';
        setStatus('');
        return;
      }
      for (const p of productos) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="pill">ID: ${p.id}</div>
          <div style="font-size:18px;font-weight:700">${p.name ?? '(sin nombre)'}</div>
          <div class="muted">Precio: ${p.price ?? '-'}</div>
          <div class="muted">Stock: ${p.stock ?? '-'}</div>
          <label>Cantidad</label>
          <input type="number" min="1" value="1" data-qty />
          <button data-buy>Comprar</button>
          <div class="danger" data-error></div>
        `;
        const buyBtn = card.querySelector('[data-buy]');
        const qtyInput = card.querySelector('[data-qty]');
        const errEl = card.querySelector('[data-error]');
        buyBtn.onclick = async () => {
          errEl.textContent = '';
          buyBtn.classList.add('loading');
          try {
            const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
            await doCheckout(p.id, qty);
          } catch (e) {
            errEl.textContent = e.message ?? String(e);
          } finally {
            buyBtn.classList.remove('loading');
          }
        };
        productsEl.appendChild(card);
      }
      setStatus('');
    } catch (e) {
      setStatus(e.message ?? String(e), true);
    } finally {
      refreshBtn.classList.remove('loading');
    }
  }

  async function doCheckout(productId, quantity) {
    const cliente = {
      name: document.getElementById('name').value.trim(),
      lastname: document.getElementById('lastname').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
    };

    setStatus('Guardando cliente...');
    if (!clienteId) {
      const created = await fetchJSON(api.clientePublic, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      });
      clienteId = created?.id;
      clientInfoEl.textContent = clienteId
        ? `Cliente guardado: ${cliente.email} (id ${clienteId})`
        : '';
    }

    setStatus('Creando orden y preferencia en Mercado Pago...');
    const payload = {
      clienteId,
      cliente,
      items: [{ productId, quantity }],
    };
    const res = await fetchJSON(api.checkout, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res?.init_point) {
      setStatus(`Redirigiendo a Checkout Pro (orden ${res.orderId})`);
      window.location.href = res.init_point;
    } else {
      throw new Error('No se recibió init_point');
    }
  }

  async function saveClientOnly() {
    const cliente = {
      name: document.getElementById('name').value.trim(),
      lastname: document.getElementById('lastname').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
    };
    setStatus('Guardando cliente...');
    try {
      const created = await fetchJSON(api.clientePublic, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cliente),
      });
      clienteId = created?.id;
      clientInfoEl.textContent = clienteId
        ? `Cliente guardado: ${cliente.email} (id ${clienteId})`
        : '';
      setStatus('Cliente guardado, listo para comprar.');
      localStorage.setItem('testCheckoutClienteId', clienteId ?? '');
      localStorage.setItem('testCheckoutClienteEmail', cliente.email ?? '');
    } catch (e) {
      setStatus(e.message ?? String(e), true);
    }
  }

  function resetClient() {
    clienteId = null;
    clientInfoEl.textContent = 'Cliente no guardado';
    localStorage.removeItem('testCheckoutClienteId');
    localStorage.removeItem('testCheckoutClienteEmail');
    setStatus('Cliente reseteado.');
  }

  function restoreClient() {
    const storedId = localStorage.getItem('testCheckoutClienteId');
    const storedEmail = localStorage.getItem('testCheckoutClienteEmail');
    if (storedId) {
      clienteId = Number(storedId);
      clientInfoEl.textContent = `Cliente guardado: ${storedEmail ?? ''} (id ${storedId})`;
    } else {
      clientInfoEl.textContent = 'Cliente no guardado';
    }
  }

  refreshBtn.onclick = loadProducts;
  saveClientBtn.onclick = saveClientOnly;
  resetClientBtn.onclick = resetClient;
  restoreClient();
  loadProducts();
})();
