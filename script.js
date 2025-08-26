document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES DE CATEGORIAS ---
    const CATEGORIES_FOR_MODAL_OPTIONS = ['Adicionais', 'Acompanhamentos', 'Bebidas', 'Molhos'];
    const CATEGORIES_TO_HIDE_FROM_TABS = ['Adicionais', 'Molhos'];
    const CATEGORIES_FOR_DIRECT_ADD = ['Acompanhamentos', 'Bebidas', 'Adicionais', 'Molhos'];
    const EXTRA_CATEGORIES = ['Adicionais', 'Molhos'];
    const MAIN_ITEM_CATEGORIES = ['The Hamburgers', 'Combos'];


    // --- REFERÊNCIAS DO DOM ---
    const menuContainer = document.getElementById('menu-container');
    const categoryTabsContainer = document.getElementById('category-tabs-container');
    const cartContainer = document.getElementById('cart-container');
    const cartItemsContainer = document.getElementById('cart-items');
    const mobileCartButton = document.getElementById('mobile-cart-button');
    const closeCartButton = document.getElementById('close-cart-btn');
    const modalBackdrop = document.getElementById('modal-backdrop');
    
    const productModal = document.getElementById('product-modal');
    
    const checkoutModal = document.getElementById('checkout-modal');
    const checkoutButton = document.getElementById('checkout-button');
    const checkoutCloseButton = document.getElementById('checkout-close-btn');
    const confirmOrderButton = document.getElementById('confirm-order-btn');
    const checkoutForm = document.getElementById('checkout-form');
    const paymentMethodSelect = document.getElementById('payment-method');
    const trocoGroup = document.getElementById('troco-group');
    
    const deliveryTypeRadios = document.querySelectorAll('input[name="delivery-type"]');
    const addressFields = document.getElementById('address-fields');
    const pickupTimeGroup = document.getElementById('pickup-time-group');
    const bairroSelect = document.getElementById('bairro');
    const ruaInput = document.getElementById('rua');
    const pickupTimeInput = document.getElementById('pickup-time');
    const couponInput = document.getElementById('coupon-code'); // Referência para o campo de cupom

    // --- VARIÁVEIS DE ESTADO ---
    let cart = [];
    let fullMenu = [];
    let itemsByCategory = {};
    let deliveryFees = [];
    let currentModalItem = {};

    // --- FUNÇÕES DE INICIALIZAÇÃO E CACHE ---
    async function initializeApp() {
        await fetchAndSetupMenu();
        loadCartFromCache();
        updateCartDisplay();
        setupTabDragging();
    }

    function saveCartToCache() {
        const simplifiedCart = cart.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            extraIds: item.extras.map(e => e.id)
        }));
        localStorage.setItem('savedCart', JSON.stringify(simplifiedCart));
    }

    function loadCartFromCache() {
        const simplifiedCart = JSON.parse(localStorage.getItem('savedCart'));
        if (simplifiedCart && Array.isArray(simplifiedCart)) {
            const reconstructedCart = simplifiedCart.map(simpleItem => {
                const product = fullMenu.find(p => p.id === simpleItem.productId);
                if (!product) return null;

                const extras = simpleItem.extraIds.map(extraId => fullMenu.find(p => p.id === extraId)).filter(Boolean);
                
                const extraIdsString = extras.map(e => e.id).sort().join('-');
                const cartItemId = `${product.id}-${extraIdsString}`;

                return { cartItemId, product, extras, quantity: simpleItem.quantity };
            }).filter(Boolean);

            cart = reconstructedCart;
        }
    }

    // --- FUNÇÕES DO MODAL DE OPÇÕES ---
    function openOptionsModal(item) {
        currentModalItem = { product: item, quantity: 1, extras: [] };
        productModal.querySelector('#modal-product-name').textContent = item.nome;
        productModal.querySelector('#modal-product-description').textContent = item.descricao;
        
        const optionsContainer = productModal.querySelector('#modal-options-container');
        optionsContainer.innerHTML = '';
        let hasOptions = false;

        const canHaveExtras = MAIN_ITEM_CATEGORIES.includes(item.categoria);

        CATEGORIES_FOR_MODAL_OPTIONS.forEach(catName => {
            if (catName === 'Adicionais' && !canHaveExtras) {
                return; 
            }

            const options = itemsByCategory[catName] || [];
            if (options.length > 0) {
                hasOptions = true;
                const spoiler = document.createElement('details');
                spoiler.className = 'combo-spoiler';
                spoiler.innerHTML = `<summary>${catName}</summary>`;
                options.forEach(option => {
                    const imageUrlWithCacheBuster = `${option.imageUrl}?v=${new Date().getTime()}`;
                    spoiler.innerHTML += `
                        <div class="combo-item" data-id="${option.id}" data-price="${option.preco}">
                            <img class="combo-item-img" src="${imageUrlWithCacheBuster}" alt="${option.nome}" onerror="this.style.display='none'">
                            <div class="combo-item-details">
                                <div class="combo-item-name">${option.nome}</div>
                                <div class="combo-item-price">+ R$ ${option.preco.toFixed(2)}</div>
                            </div>
                            <div class="quantity-control"><button class="quantity-btn combo-quantity-btn" data-action="decrease" disabled>-</button><span class="combo-quantity">0</span><button class="quantity-btn combo-quantity-btn" data-action="increase">+</button></div>
                        </div>`;
                });
                optionsContainer.appendChild(spoiler);
            }
        });
        productModal.querySelector('#modal-options-section').style.display = hasOptions ? 'block' : 'none';
        productModal.querySelector('#modal-quantity').textContent = '1';
        updateModalPrice();
        productModal.classList.add('visible');
        modalBackdrop.classList.add('visible');
    }

    function closeOptionsModal() {
        productModal.classList.remove('visible');
        if (!cartContainer.classList.contains('mobile-visible') && !checkoutModal.classList.contains('visible')) {
            modalBackdrop.classList.remove('visible');
        }
    }

    function updateModalPrice() {
        let totalPrice = currentModalItem.product.preco;
        productModal.querySelectorAll('.combo-item').forEach(comboEl => {
            const quantity = parseInt(comboEl.querySelector('.combo-quantity').textContent);
            if (quantity > 0) {
                const price = parseFloat(comboEl.dataset.price);
                totalPrice += price * quantity;
            }
        });
        totalPrice *= currentModalItem.quantity;
        productModal.querySelector('#modal-total-price').textContent = `R$ ${totalPrice.toFixed(2)}`;
    }

    // --- FUNÇÕES DO CARDÁPIO ---
    function renderMenuItems(categoryName) {
        menuContainer.innerHTML = '';
        menuContainer.style.display = 'grid'; 
        const itemsToRender = itemsByCategory[categoryName] || [];
        itemsToRender.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'menu-item';
            itemElement.dataset.id = item.id;
            const imageUrlWithCacheBuster = `${item.imageUrl}?v=${new Date().getTime()}`;
            itemElement.innerHTML = `
                <img src="${imageUrlWithCacheBuster}" alt="${item.nome}" onerror="this.style.display='none'">
                <div class="item-details"><h3>${item.nome}</h3><p class="description">${item.descricao}</p><p class="price">R$ ${item.preco.toFixed(2)}</p></div>`;
            menuContainer.appendChild(itemElement);
        });
    }

    async function fetchAndSetupMenu() {
        try {
            const response = await fetch(`assets/cardapio.json?v=${new Date().getTime()}`);
            const cardapio = await response.json();
            fullMenu = cardapio;
            itemsByCategory = cardapio.reduce((acc, item) => {
                const category = item.categoria || 'Outros';
                if (!acc[category]) acc[category] = [];
                acc[category].push(item);
                return acc;
            }, {});
            const allCategories = [...new Set(cardapio.map(item => item.categoria))];
            const visibleCategories = allCategories.filter(cat => !CATEGORIES_TO_HIDE_FROM_TABS.includes(cat));
            
            categoryTabsContainer.innerHTML = '';
            visibleCategories.forEach(categoryName => {
                const tabButton = document.createElement('button');
                tabButton.className = 'category-tab';
                tabButton.textContent = categoryName;
                tabButton.addEventListener('click', () => {
                    document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
                    tabButton.classList.add('active');
                    renderMenuItems(categoryName);
                });
                categoryTabsContainer.appendChild(tabButton);
            });

            const historyTab = document.createElement('button');
            historyTab.className = 'category-tab history-tab';
            historyTab.textContent = 'Meus Pedidos';
            historyTab.addEventListener('click', () => {
                document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
                historyTab.classList.add('active');
                renderOrderHistory();
            });
            categoryTabsContainer.appendChild(historyTab);

            if (visibleCategories.length > 0) {
                categoryTabsContainer.querySelector('.category-tab:not(.history-tab)').click();
            } else {
                historyTab.click();
            }
        } catch (error) {
            menuContainer.innerHTML = `<p class="error">Erro ao carregar o cardápio. Verifique o arquivo assets/cardapio.json.</p>`;
            console.error(error);
        }
    }

    // --- FUNÇÕES DO CARRINHO ---
    function addToCartFromModal() {
        const mainProduct = currentModalItem.product;
        const mainProductQuantity = currentModalItem.quantity;

        const adicionaisExtras = [];
        const otherItemsToAdd = [];

        productModal.querySelectorAll('.combo-item').forEach(comboEl => {
            const quantity = parseInt(comboEl.querySelector('.combo-quantity').textContent);
            if (quantity > 0) {
                const comboId = parseInt(comboEl.dataset.id);
                const comboItem = fullMenu.find(item => item.id === comboId);
                if (comboItem) {
                    if (EXTRA_CATEGORIES.includes(comboItem.categoria)) {
                        for (let i = 0; i < quantity; i++) adicionaisExtras.push(comboItem);
                    } else {
                        otherItemsToAdd.push({ item: comboItem, quantity: quantity });
                    }
                }
            }
        });

        const extraIds = adicionaisExtras.map(e => e.id).sort().join('-');
        const cartItemId = `${mainProduct.id}-${extraIds}`;
        
        const existingMainItem = cart.find(item => item.cartItemId === cartItemId);
        if (existingMainItem) {
            existingMainItem.quantity += mainProductQuantity;
        } else {
            cart.push({
                cartItemId: cartItemId,
                product: mainProduct,
                extras: adicionaisExtras,
                quantity: mainProductQuantity
            });
        }

        otherItemsToAdd.forEach(other => {
            addToCartDirectly(other.item, other.quantity);
        });

        updateCartDisplay();
        closeOptionsModal();
    }

    function addToCartDirectly(item, quantity = 1) {
        const cartItemId = `${item.id}-noextras`;
        const existingItem = cart.find(i => i.cartItemId === cartItemId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ cartItemId, product: item, extras: [], quantity: quantity });
        }
        updateCartDisplay();
    }

    function removeFromCart(cartItemId) {
        cart = cart.filter(item => item.cartItemId !== cartItemId);
        updateCartDisplay();
    }

    function updateCartDisplay() {
        const mobileCartCount = document.getElementById('mobile-cart-count');
        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        const deliveryFeeEl = document.getElementById('delivery-fee');
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">O seu carrinho está vazio.</p>';
            mobileCartCount.textContent = '0';
            checkoutButton.disabled = true;
            subtotalEl.textContent = 'R$ 0,00';
            totalEl.textContent = 'R$ 0,00';
            deliveryFeeEl.textContent = 'R$ 0,00';
        } else {
            cartItemsContainer.innerHTML = '';
            let subtotal = 0;
            let totalItems = 0;
            cart.forEach(item => {
                let itemBasePrice = item.product.preco;
                let extrasPrice = 0;
                let extrasText = '';
                if (item.extras.length > 0) {
                    const groupedExtras = item.extras.reduce((acc, extra) => {
                        acc[extra.nome] = (acc[extra.nome] || 0) + 1;
                        return acc;
                    }, {});
                    for (const extraName in groupedExtras) {
                        const quantity = groupedExtras[extraName];
                        const extra = fullMenu.find(e => e.nome === extraName);
                        if (extra) {
                            extrasText += `<li class="cart-extra-item">+ ${quantity}x ${extraName}</li>`;
                            extrasPrice += extra.preco * quantity;
                        }
                    }
                }
                
                const itemTotalPrice = (itemBasePrice + extrasPrice) * item.quantity;
                subtotal += itemTotalPrice;
                totalItems += item.quantity;
                const cartItemElement = document.createElement('div');
                cartItemElement.className = 'cart-item';
                cartItemElement.innerHTML = `
                    <div class="cart-item-info"><p class="cart-item-title">${item.quantity}x ${item.product.nome}</p><ul>${extrasText}</ul></div>
                    <div class="cart-item-details"><span class="cart-item-price">R$ ${itemTotalPrice.toFixed(2)}</span><button class="remove-from-cart-btn" data-cart-item-id="${item.cartItemId}">&times;</button></div>`;
                cartItemsContainer.appendChild(cartItemElement);
            });
            
            const deliveryFee = parseFloat(deliveryFeeEl.textContent.replace('R$ ', '').replace(',', '.')) || 0;
            subtotalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
            totalEl.textContent = `R$ ${(subtotal + deliveryFee).toFixed(2)}`;
            mobileCartCount.textContent = totalItems;
            checkoutButton.disabled = false;
        }
        saveCartToCache();
    }

    // --- FUNÇÕES DE CHECKOUT ---
    function openCheckoutModal() {
        populateNeighborhoods();
        loadUserInfoFromCache();
        toggleDeliveryTypeFields();
        toggleTrocoField();
        checkoutModal.classList.add('visible');
        modalBackdrop.classList.add('visible');
    }

    function closeCheckoutModal() {
        checkoutModal.classList.remove('visible');
        if (!cartContainer.classList.contains('mobile-visible') && !productModal.classList.contains('visible')) {
            modalBackdrop.classList.remove('visible');
        }
    }

    async function populateNeighborhoods() {
        if (deliveryFees.length === 0) {
            try {
                const response = await fetch(`assets/taxas.json?v=${new Date().getTime()}`);
                deliveryFees = await response.json();
            } catch (error) {
                console.warn("Arquivo assets/taxas.json não encontrado.");
                deliveryFees = [];
            }
        }
        const currentSelection = bairroSelect.value;
        bairroSelect.innerHTML = '<option value="">Selecione o seu bairro...</option>';
        deliveryFees.forEach(fee => {
            bairroSelect.innerHTML += `<option value="${fee.bairro}">${fee.bairro} - R$ ${fee.taxa.toFixed(2)}</option>`;
        });
        bairroSelect.value = currentSelection;
    }

    function saveUserInfoToCache(userInfo) {
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
    }

    function loadUserInfoFromCache() {
        const userInfo = JSON.parse(localStorage.getItem('userInfo'));
        if (userInfo) {
            document.getElementById('nome').value = userInfo.nome || '';
            document.getElementById('telefone').value = userInfo.telefone || '';
            bairroSelect.value = userInfo.bairro || '';
            ruaInput.value = userInfo.rua || '';
            document.getElementById('complemento').value = userInfo.complemento || '';
            updateDeliveryFee();
        }
    }

    function updateDeliveryFee() {
        const selectedBairro = bairroSelect.value;
        const feeData = deliveryFees.find(f => f.bairro === selectedBairro);
        const fee = feeData ? feeData.taxa : 0;
        document.getElementById('delivery-fee').textContent = `R$ ${fee.toFixed(2)}`;
        updateCartDisplay();
    }

    function toggleDeliveryTypeFields() {
        const selectedType = document.querySelector('input[name="delivery-type"]:checked').value;
        if (selectedType === 'delivery') {
            addressFields.style.display = 'block';
            pickupTimeGroup.style.display = 'none';
            bairroSelect.required = true;
            ruaInput.required = true;
            pickupTimeInput.required = false;
            updateDeliveryFee();
        } else {
            addressFields.style.display = 'none';
            pickupTimeGroup.style.display = 'block';
            bairroSelect.required = false;
            ruaInput.required = false;
            pickupTimeInput.required = true;
            document.getElementById('delivery-fee').textContent = 'R$ 0,00';
            updateCartDisplay();
        }
    }

    function toggleTrocoField() {
        if (paymentMethodSelect.value === 'Dinheiro') {
            trocoGroup.style.display = 'block';
        } else {
            trocoGroup.style.display = 'none';
        }
    }

    async function handleConfirmOrder(e) {
        e.preventDefault();
        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }

        const numeroWhatsApp = '5585999999999';
        const nomeLoja = "The Hungry Burger";
        
        const userInfo = {
            nome: document.getElementById('nome').value,
            telefone: document.getElementById('telefone').value,
            bairro: bairroSelect.value,
            rua: ruaInput.value,
            complemento: document.getElementById('complemento').value,
            troco: document.getElementById('troco').value
        };
        saveUserInfoToCache(userInfo);

        const deliveryType = document.querySelector('input[name="delivery-type"]:checked').value;
        const feeData = deliveryFees.find(f => f.bairro === userInfo.bairro);
        const taxaEntrega = deliveryType === 'delivery' ? (feeData ? feeData.taxa : 0) : 0;
        const paymentMethod = paymentMethodSelect.value;
        const couponCode = couponInput.value.trim(); // Pega o código do cupom

        const subtotal = cart.reduce((acc, item) => {
            const itemPrice = item.product.preco + item.extras.reduce((extraAcc, extra) => extraAcc + extra.preco, 0);
            return acc + (itemPrice * item.quantity);
        }, 0);
        const total = subtotal + taxaEntrega;

        saveOrderToHistory(cart, total);

        const paymentEmojis = {
            'Dinheiro': '💵',
            'Pix (Pagamento Online)': '💠',
            'Cartão (Pagamento Online)': '💳',
            'Cartão (Pagamento Presencial)': '💳'
        };
        const paymentEmoji = paymentEmojis[paymentMethod] || '💳';

        let mensagem = `✨ *Novo Pedido Chegando!* ✨\n\n`;
        mensagem += `Olá, *${nomeLoja}*!\n`;
        mensagem += `Gostaria de confirmar meu pedido:\n\n`;

        mensagem += `🍔 *RESUMO DO PEDIDO*\n`;
        cart.forEach(item => {
            const itemTotalPrice = (item.product.preco + item.extras.reduce((acc, extra) => acc + extra.preco, 0)) * item.quantity;
            mensagem += `*${item.quantity}x ${item.product.nome}* (R$ ${itemTotalPrice.toFixed(2)})\n`;
            if (item.extras.length > 0) {
                item.extras.forEach(extra => {
                    mensagem += `  - _${extra.nome}_\n`;
                });
            }
        });
        mensagem += `\nSubtotal: R$ ${subtotal.toFixed(2)}\n`;
        if (deliveryType === 'delivery') {
            mensagem += `Taxa de Entrega: R$ ${taxaEntrega.toFixed(2)}\n`;
        }
        
        if (couponCode) {
            mensagem += `*Cupom Aplicado:* ${couponCode}\n`;
        }
        
        mensagem += `💰 *TOTAL (sem desconto): R$ ${total.toFixed(2)}*\n\n`;

        mensagem += `${paymentEmoji} *FORMA DE PAGAMENTO*\n`;
        mensagem += `Pagamento em ${paymentMethod}\n`;
        if (paymentMethod === 'Dinheiro' && userInfo.troco) {
            mensagem += `(Troco para: R$ ${userInfo.troco})\n`;
        }
        mensagem += `\n`;

        if (deliveryType === 'delivery') {
            mensagem += `📍 *DADOS PARA ENTREGA*\n`;
            mensagem += `Nome: ${userInfo.nome}\n`;
            mensagem += `Endereço: ${userInfo.rua}\n`;
            mensagem += `Bairro: ${userInfo.bairro}\n`;
            if (userInfo.complemento) {
                mensagem += `Referência: ${userInfo.complemento}\n`;
            }
            mensagem += `WhatsApp: ${userInfo.telefone}\n`;
        } else {
            const pickupTime = pickupTimeInput.value;
            mensagem += `🚶‍♂️ *RETIRADA NO BALCÃO*\n`;
            mensagem += `Nome: ${userInfo.nome}\n`;
            mensagem += `WhatsApp: ${userInfo.telefone}\n`;
            if (pickupTime) {
                mensagem += `*Hora para Retirada:* ${pickupTime}\n`;
            }
        }

        const mensagemCodificada = encodeURIComponent(mensagem);
        const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensagemCodificada}`;

        window.open(urlWhatsApp, '_blank');
        
        alert("Seu pedido foi formatado! Por favor, envie a mensagem no WhatsApp para finalizar.");
        
        cart = [];
        localStorage.removeItem('savedCart');
        updateCartDisplay();
        closeCheckoutModal();
    }

    // --- FUNÇÕES DO HISTÓRICO DE PEDIDOS ---
    function saveOrderToHistory(orderCart, orderTotal) {
        const order = {
            date: new Date().toLocaleString('pt-BR'),
            items: orderCart.map(item => ({
                quantity: item.quantity,
                name: item.product.nome,
                extras: item.extras.map(e => e.nome)
            })),
            total: orderTotal
        };

        let history = JSON.parse(localStorage.getItem('orderHistory')) || [];
        history.unshift(order);
        if (history.length > 10) {
            history.pop();
        }
        localStorage.setItem('orderHistory', JSON.stringify(history));
    }

    function renderOrderHistory() {
        menuContainer.innerHTML = '';
        menuContainer.style.display = 'block'; 
        const history = JSON.parse(localStorage.getItem('orderHistory')) || [];

        if (history.length === 0) {
            menuContainer.innerHTML = '<div class="loading-container"><p class="loading">Nenhum pedido recente encontrado.</p></div>';
        } else {
            history.forEach((order, index) => {
                const orderElement = document.createElement('div');
                orderElement.className = 'history-item';
                
                let itemsHtml = '';
                order.items.forEach(item => {
                    itemsHtml += `<li>${item.quantity}x ${item.name}`;
                    if (item.extras && item.extras.length > 0) {
                        itemsHtml += ` <i>(${item.extras.join(', ')})</i>`;
                    }
                    itemsHtml += `</li>`;
                });

                orderElement.innerHTML = `
                    <div class="history-item-details">
                       <h3>Pedido de ${order.date}</h3>
                       <ul class="history-item-products">${itemsHtml}</ul>
                       <p class="price">Total: R$ ${order.total.toFixed(2)}</p>
                    </div>
                `;
                orderElement.addEventListener('click', () => repeatOrder(index));
                menuContainer.appendChild(orderElement);
            });
        }
    }
    
    function repeatOrder(orderIndex) {
        const history = JSON.parse(localStorage.getItem('orderHistory')) || [];
        const orderToRepeat = history[orderIndex];
    
        if (!orderToRepeat) return;
    
        if (cart.length > 0 && !confirm('O seu carrinho atual será substituído. Deseja continuar?')) {
            return;
        }
    
        cart = [];
    
        orderToRepeat.items.forEach(historyItem => {
            const mainProduct = fullMenu.find(p => p.nome === historyItem.name);
            if (!mainProduct) return;
    
            const extrasList = (historyItem.extras || []).map(extraName => fullMenu.find(p => p.nome === extraName)).filter(Boolean);
            
            const extraIds = extrasList.map(e => e.id).sort().join('-');
            const cartItemId = `${mainProduct.id}-${extraIds}`;
    
            const newCartItem = {
                cartItemId: cartItemId,
                product: mainProduct,
                extras: extrasList,
                quantity: historyItem.quantity,
            };
            cart.push(newCartItem);
        });
    
        updateCartDisplay();
        alert('Pedido adicionado ao carrinho!');
        if (categoryTabsContainer.querySelector('.category-tab:not(.history-tab)')) {
            categoryTabsContainer.querySelector('.category-tab:not(.history-tab)').click();
        }
    }

    // --- LÓGICA DE ABERTURA/FECHAMENTO DE OVERLAYS ---
    function showCartMobile() {
        cartContainer.classList.add('mobile-visible');
        modalBackdrop.classList.add('visible');
    }
    function hideCartMobile() {
        cartContainer.classList.remove('mobile-visible');
        if (!productModal.classList.contains('visible') && !checkoutModal.classList.contains('visible')) {
            modalBackdrop.classList.remove('visible');
        }
    }

    // --- LÓGICA PARA ARRASTAR AS ABAS ---
    function setupTabDragging() {
        const slider = categoryTabsContainer;
        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.classList.add('active-drag');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => {
            isDown = false;
            slider.classList.remove('active-drag');
        });
        slider.addEventListener('mouseup', () => {
            isDown = false;
            slider.classList.remove('active-drag');
        });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    }

    // --- EVENT LISTENERS ---
    menuContainer.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem) {
            const itemId = parseInt(menuItem.dataset.id);
            const selectedItem = fullMenu.find(item => item.id === itemId);
            if (selectedItem) {
                if (CATEGORIES_FOR_DIRECT_ADD.includes(selectedItem.categoria)) {
                    addToCartDirectly(selectedItem);
                } else {
                    openOptionsModal(selectedItem);
                }
            }
        }
    });

    cartItemsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-from-cart-btn')) {
            removeFromCart(e.target.dataset.cartItemId);
        }
    });

    productModal.querySelector('#modal-close-btn').addEventListener('click', closeOptionsModal);
    productModal.addEventListener('click', (e) => {
        if (e.target.matches('.quantity-btn') && !e.target.matches('.combo-quantity-btn')) {
            const action = e.target.dataset.action;
            if (action === 'increase') currentModalItem.quantity++;
            else if (action === 'decrease' && currentModalItem.quantity > 1) currentModalItem.quantity--;
            productModal.querySelector('#modal-quantity').textContent = currentModalItem.quantity;
            updateModalPrice();
        }
        if (e.target.matches('.combo-quantity-btn')) {
            const action = e.target.dataset.action;
            const quantitySpan = e.target.parentElement.querySelector('.combo-quantity');
            const decreaseBtn = e.target.parentElement.querySelector('[data-action="decrease"]');
            let quantity = parseInt(quantitySpan.textContent);
            if (action === 'increase') quantity++;
            else if (action === 'decrease' && quantity > 0) quantity--;
            quantitySpan.textContent = quantity;
            decreaseBtn.disabled = quantity === 0;
            updateModalPrice();
        }
    });
    productModal.querySelector('#modal-add-to-cart-btn').addEventListener('click', addToCartFromModal);

    mobileCartButton.addEventListener('click', showCartMobile);
    closeCartButton.addEventListener('click', hideCartMobile);

    modalBackdrop.addEventListener('click', () => {
        if (productModal.classList.contains('visible')) closeOptionsModal();
        if (cartContainer.classList.contains('mobile-visible')) hideCartMobile();
        if (checkoutModal.classList.contains('visible')) closeCheckoutModal();
    });

    checkoutButton.addEventListener('click', openCheckoutModal);
    checkoutCloseButton.addEventListener('click', closeCheckoutModal);
    bairroSelect.addEventListener('change', updateDeliveryFee);
    confirmOrderButton.addEventListener('click', handleConfirmOrder);
    paymentMethodSelect.addEventListener('change', toggleTrocoField);
    
    deliveryTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleDeliveryTypeFields);
    });
    
    initializeApp();
});
