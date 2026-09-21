const USERS_KEY = "birga_users";
const SESSION_KEY = "birga_session";
const ORDERS_KEY = "birga_orders";
const TAKEN_ORDERS_KEY = "birga_taken_orders";
const RESPONSES_KEY = "birga_responses";
const NOTIFICATIONS_KEY = "birga_notifications";
const COMPLETED_ORDERS_KEY = "birga_completed_orders";
const FAVORITES_KEY = "birga_favorites";

// ===================== ВРЕМЕННЫЙ БЛОК ДЛЯ ТЕСТИРОВАНИЯ =====================
// Пока TEST_ALL_ROLES = true, у любого аккаунта есть возможности
// заказчика (создание заказов), исполнителя (взятие/сдача заказов)
// и админа (админ-панель, модерация).
// Чтобы отключить режим — поставьте false или удалите блок.
const TEST_ALL_ROLES = true;
// ===========================================================================

let orderStep = 1;
let activeSearchQuery = "";
let editingOrderId = null;

function isOrderTaken(orderId) {
    return getTakenOrders().some((item) => String(item.orderId) === String(orderId));
}

function purgeStaleTakenOrders() {
    const orders = getOrders();
    const takenOrders = getTakenOrders();
    const valid = takenOrders.filter(
        (item) => item.status !== "active" || orders.some((order) => String(order.id) === String(item.orderId))
    );
    if (valid.length !== takenOrders.length) saveTakenOrders(valid);
    return valid;
}

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getOrders() {
    try {
        return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveOrders(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function getTakenOrders() {
    try {
        return JSON.parse(localStorage.getItem(TAKEN_ORDERS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveTakenOrders(takenOrders) {
    localStorage.setItem(TAKEN_ORDERS_KEY, JSON.stringify(takenOrders));
}

function getResponses() {
    try {
        return JSON.parse(localStorage.getItem(RESPONSES_KEY)) || [];
    } catch {
        return [];
    }
}

function saveResponses(responses) {
    localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
}

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    } catch {
        return [];
    }
}

function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isFavorite(orderId, email) {
    return getFavorites().some(
        (item) => item.email === email && String(item.orderId) === String(orderId)
    );
}

function toggleFavorite(orderId) {
    const user = getCurrentUser();
    if (!user) return false;

    const favorites = getFavorites();
    const index = favorites.findIndex(
        (item) => item.email === user.email && String(item.orderId) === String(orderId)
    );
    const nowFavorite = index < 0;
    if (nowFavorite) {
        favorites.push({ email: user.email, orderId, addedAt: Date.now() });
    } else {
        favorites.splice(index, 1);
    }
    saveFavorites(favorites);

    document.querySelectorAll(`.fav-btn[data-fav-id="${orderId}"]`).forEach((btn) => {
        btn.classList.toggle("active", nowFavorite);
        btn.textContent = nowFavorite ? "♥" : "♡";
    });

    const favoritesScreen = document.getElementById("favorites-screen");
    if (favoritesScreen && !favoritesScreen.classList.contains("hidden")) renderFavorites();
    return nowFavorite;
}

function renderFavorites() {
    const user = getCurrentUser();
    const list = document.getElementById("favorites-list");
    const emptyState = document.getElementById("favorites-empty-state");
    if (!user || !list) return;

    const favorites = getFavorites().filter((item) => item.email === user.email);
    const orders = getOrders().filter((order) =>
        favorites.some((item) => String(item.orderId) === String(order.id))
    );

    if (!orders.length) {
        list.innerHTML = "";
        list.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = renderOrderCards(orders);
}

function getNotifications() {
    try {
        return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveNotifications(notifications) {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function getCompletedOrders() {
    try {
        return JSON.parse(localStorage.getItem(COMPLETED_ORDERS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveCompletedOrders(orders) {
    localStorage.setItem(COMPLETED_ORDERS_KEY, JSON.stringify(orders));
}

const REVIEWS_KEY = "birga_reviews";

function getReviews() {
    try {
        return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveReviews(reviews) {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

function getRatingFor(email, reviews = getReviews()) {
    const userReviews = reviews.filter((review) => review.contractor === email || review.customer === email);
    if (!userReviews.length) return { avg: 0, count: 0 };
    const sum = userReviews.reduce((total, review) => total + Number(review.rating || 0), 0);
    return { avg: sum / userReviews.length, count: userReviews.length };
}

function formatRatingStars(avg) {
    const rounded = Math.round(avg);
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

function formatRatingText(email, reviews = getReviews()) {
    const { avg, count } = getRatingFor(email, reviews);
    if (!count) return "";
    return `${formatRatingStars(avg)} ${avg.toFixed(1)} (${formatOrderCount(count)})`;
}

function addNotification(email, message, orderId) {
    if (!email) return;
    const notifications = getNotifications();
    notifications.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        email,
        message,
        orderId,
        createdAt: Date.now(),
        read: false
    });
    saveNotifications(notifications);
}

function getUserNotifications(email) {
    return getNotifications()
        .filter((item) => item.email === email)
        .sort((first, second) => second.createdAt - first.createdAt);
}

function getUnreadNotificationCount(email) {
    return getUserNotifications(email).filter((item) => !item.read).length;
}

function markAllNotificationsRead(email) {
    const notifications = getNotifications();
    let changed = false;
    notifications.forEach((item) => {
        if (item.email === email && !item.read) {
            item.read = true;
            changed = true;
        }
    });
    if (changed) saveNotifications(notifications);
}

function getTakenOrderIds(email) {
    return getTakenOrders()
        .filter((item) => item.contractor === email && item.status !== "completed")
        .map((item) => String(item.orderId));
}

function getCurrentTakenOrders() {
    const user = getCurrentUser();
    if (!user) return [];

    const takenIds = new Set(getTakenOrderIds(user.email));
    return getOrders().filter((order) => takenIds.has(String(order.id)));
}

function getOwnActiveTakenOrderIds() {
    const user = getCurrentUser();
    if (!user) return [];
    const orders = getOrders();
    const takenOrders = purgeStaleTakenOrders();
    return takenOrders
        .filter((item) => item.contractor === user.email && item.status === "active")
        .map((item) => String(item.orderId))
        .filter((orderId) => orders.some((order) => String(order.id) === orderId));
}

function hasTakenOrder(orderId) {
    const user = getCurrentUser();
    return Boolean(user && getTakenOrderIds(user.email).includes(String(orderId)));
}

function findOwnTakenRecord(orderId, status) {
    const user = getCurrentUser();
    if (!user) return null;
    return getTakenOrders().find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === user.email && item.status === status
    ) || null;
}

function findOwnResponse(orderId, email) {
    return getResponses().find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === email
    ) || null;
}

function getSelectedOrderMode() {
    const active = document.querySelector("#order-mode-toggle button.active");
    return active && active.dataset.mode === "responses" ? "responses" : "normal";
}

function setOrderMode(mode) {
    document.querySelectorAll("#order-mode-toggle button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    document.getElementById("order-mode-hint").textContent = mode === "responses"
        ? "Исполнители отправят отклик с сообщением — вы выберете исполнителя сами"
        : "Исполнитель сможет просто взять заказ";
}

function takeOrder(orderId) {
    const user = getCurrentUser();
    if (!user || (user.role !== "contractor" && !TEST_ALL_ROLES) || hasTakenOrder(orderId)) return;

    const takenOrders = getTakenOrders();
    takenOrders.push({
        orderId,
        contractor: user.email,
        takenAt: Date.now(),
        status: "active"
    });
    saveTakenOrders(takenOrders);
    renderTakenOrders();
    updateOrderActionButtons(orderId);
}

function countPendingResponses(orderId) {
    return getResponses().filter(
        (item) => String(item.orderId) === String(orderId) && item.status === "pending"
    ).length;
}

function sendOrderResponse(orderId, message) {
    const user = getCurrentUser();
    if (!user || (user.role !== "contractor" && !TEST_ALL_ROLES)) return false;

    const order = getOrders().find((item) => String(item.id) === String(orderId));
    if (!order || hasTakenOrder(orderId) || findOwnTakenRecord(orderId, "completed")) return false;

    const responses = getResponses();
    const existing = responses.find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === user.email && item.status === "pending"
    );
    if (existing) {
        existing.message = message;
        existing.updatedAt = Date.now();
    } else {
        responses.push({
            orderId,
            contractor: user.email,
            contractorName: user.name,
            message,
            status: "pending",
            createdAt: Date.now()
        });
    }
    saveResponses(responses);

    addNotification(
        order.author,
        `${user.name} откликнулся на заказ «${order.title}».`,
        orderId
    );

    renderMyOrders();
    updateOrderActionButtons(orderId);
    return true;
}

function acceptResponse(orderId, contractorEmail) {
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    const responses = getResponses();
    const response = responses.find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === contractorEmail && item.status === "pending"
    );
    if (!order || !response) return;

    response.status = "accepted";
    responses.forEach((item) => {
        if (String(item.orderId) === String(orderId) && item.contractor !== contractorEmail && item.status === "pending") {
            item.status = "rejected";
            addNotification(item.contractor, `Заказчик выбрал другого исполнителя для заказа «${order.title}».`, orderId);
        }
    });
    saveResponses(responses);

    if (!hasTakenOrder(orderId)) {
        const takenOrders = getTakenOrders();
        takenOrders.push({
            orderId,
            contractor: contractorEmail,
            takenAt: Date.now(),
            status: "active"
        });
        saveTakenOrders(takenOrders);
    }

    addNotification(
        contractorEmail,
        `Заказчик принял ваш отклик на заказ «${order.title}». Теперь можно выполнять работу.`,
        orderId
    );

    renderMyOrders();
    renderTakenOrders();
    renderAdminPanel();
}

function rejectResponse(orderId, contractorEmail) {
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    const responses = getResponses();
    const response = responses.find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === contractorEmail && item.status === "pending"
    );
    if (!order || !response) return;

    response.status = "rejected";
    saveResponses(responses);

    addNotification(
        contractorEmail,
        `Заказчик отклонил ваш отклик на заказ «${order.title}».`,
        orderId
    );

    renderMyOrders();
}

function notifyAdmins(message, orderId) {
    getUsers()
        .filter((user) => isAdminUser(user))
        .forEach((user) => addNotification(user.email, message, orderId));
}

const SUBMIT_MAX_TOTAL_BYTES = 3 * 1024 * 1024;

function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(2)} МБ`;
}

function submissionFilesMarkup(files) {
    if (!files || !files.length) return '<p class="admin-empty">Файлы не приложены</p>';
    return files.map((file) => `
        <a class="submit-file-item" href="${file.dataUrl}" download="${escapeHTML(file.name)}" title="Скачать ${escapeHTML(file.name)}">
            <span class="submit-file-icon">📄</span>
            <span class="submit-file-name">${escapeHTML(file.name)}</span>
            <span class="submit-file-size">${formatFileSize(file.size)}</span>
            <span class="submit-file-download">Скачать ↓</span>
        </a>
    `).join("");
}

function submitOrderForReview(orderId, message, files) {
    const user = getCurrentUser();
    if (!user || (user.role !== "contractor" && !TEST_ALL_ROLES)) return false;

    const order = getOrders().find((item) => String(item.id) === String(orderId));
    const record = findOwnTakenRecord(orderId, "active");
    if (!order || !record || record.submitRequested) return false;

    const takenOrders = getTakenOrders();
    const target = takenOrders.find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === user.email && item.status === "active"
    );
    target.submitRequested = true;
    target.submittedAt = Date.now();
    target.submission = { message, files };
    try {
        saveTakenOrders(takenOrders);
    } catch {
        addNotification(user.email, "Не удалось сохранить работу: слишком большой объём файлов. Уменьшите вложения и попробуйте снова.", orderId);
        return false;
    }

    notifyAdmins(`Исполнитель ${user.name} отправил работу по заказу «${order.title}» на проверку (вложений: ${files.length}).`, orderId);
    addNotification(
        order.author,
        `Исполнитель ${user.name} отправил работу по заказу «${order.title}» на проверку.`,
        orderId
    );

    renderTakenOrders();
    updateOrderActionButtons(orderId);
    return true;
}

function approveSubmitRequest(orderId, contractorEmail) {
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    const takenOrders = getTakenOrders();
    const record = takenOrders.find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === contractorEmail && item.status === "active" && item.submitRequested
    );
    if (!order || !record) return;

    const users = getUsers();
    const contractorAccount = users.find((item) => item.email === contractorEmail);
    if (contractorAccount) {
        contractorAccount.balance = Number(contractorAccount.balance || 0) + Number(order.price || 0);
        saveUsers(users);
    }

    const contractorName = contractorAccount ? contractorAccount.name : contractorEmail;
    addNotification(
        contractorEmail,
        `Администратор одобрил сдачу работы. Заказ «${order.title}» выполнен.`,
        orderId
    );
    addNotification(
        order.author,
        `Заказ «${order.title}» выполнен. Администратор проверил работу по ТЗ — материалы от исполнителя доступны в разделе «Мои заказы» (кнопка «Материалы»).`,
        orderId
    );

    const completed = getCompletedOrders();
    completed.unshift({
        ...order,
        completedAt: Date.now(),
        contractor: contractorEmail,
        contractorName,
        takenAt: record.takenAt || null,
        submission: record.submission || null
    });
    saveCompletedOrders(completed);

    saveOrders(getOrders().filter((item) => String(item.id) !== String(orderId)));
    saveTakenOrders(getTakenOrders().filter((item) => String(item.orderId) !== String(orderId)));
    renderAdminPanel();
    renderOrders();
    renderSearchResults(activeSearchQuery);
    renderFavorites();
}

function rejectSubmitRequest(orderId, contractorEmail) {
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    const takenOrders = getTakenOrders();
    const record = takenOrders.find(
        (item) => String(item.orderId) === String(orderId) && item.contractor === contractorEmail && item.status === "active" && item.submitRequested
    );
    if (!order || !record) return;

    record.submitRequested = false;
    delete record.submittedAt;
    delete record.submission;
    saveTakenOrders(takenOrders);

    addNotification(
        contractorEmail,
        `Администратор отклонил сдачу работы по заказу «${order.title}». Проверьте замечания и отправьте заново.`,
        orderId
    );
    addNotification(
        order.author,
        `Администратор отклонил сдачу работы по заказу «${order.title}».`,
        orderId
    );
    renderAdminPanel();
}

function approvePendingOrder(orderId) {
    const orders = getOrders();
    const order = orders.find((item) => String(item.id) === String(orderId) && item.status === "pending");
    if (!order) return;

    order.status = "published";
    saveOrders(orders);

    addNotification(
        order.author,
        `Заказ «${order.title}» одобрен администратором и опубликован.`,
        orderId
    );
    renderAdminPanel();
    renderOrders();
    renderSearchResults(activeSearchQuery);
}

function rejectPendingOrder(orderId) {
    const order = getOrders().find((item) => String(item.id) === String(orderId) && item.status === "pending");
    if (!order) return;

    saveOrders(getOrders().filter((item) => String(item.id) !== String(orderId)));
    saveTakenOrders(getTakenOrders().filter((item) => String(item.orderId) !== String(orderId)));

    addNotification(
        order.author,
        `Заказ «${order.title}» отклонён администратором и удалён.`,
        orderId
    );
    renderAdminPanel();
}

function cancelTakenOrder(orderId) {
    const user = getCurrentUser();
    if (!user || (user.role !== "contractor" && !TEST_ALL_ROLES)) return;

    const takenOrders = getTakenOrders().filter(
        (item) => !(String(item.orderId) === String(orderId) && item.contractor === user.email && item.status === "active")
    );
    saveTakenOrders(takenOrders);

    renderTakenOrders();
    updateOrderActionButtons(orderId);
}

function updateOrderActionButtons(orderId) {
    const takeBtn = document.getElementById("take-order-btn");
    const completeBtn = document.getElementById("complete-order-btn");
    const cancelBtn = document.getElementById("cancel-order-btn");
    const statusNote = document.getElementById("order-status-note");
    const user = getCurrentUser();

    [takeBtn, completeBtn, cancelBtn].forEach((button) => {
        button.dataset.orderId = orderId;
        button.classList.add("hidden");
    });
    statusNote.classList.add("hidden");
    statusNote.textContent = "";

    if (!user || (user.role !== "contractor" && !TEST_ALL_ROLES)) return;

    if (findOwnTakenRecord(orderId, "completed")) {
        statusNote.textContent = "Вы выполнили этот заказ";
        statusNote.classList.remove("hidden");
        return;
    }

    const activeRecord = findOwnTakenRecord(orderId, "active");
    if (activeRecord) {
        if (activeRecord.submitRequested) {
            statusNote.textContent = "Работа отправлена на проверку администратору";
            statusNote.classList.remove("hidden");
        } else {
            completeBtn.classList.remove("hidden");
            cancelBtn.classList.remove("hidden");
        }
        return;
    }

    const order = getOrders().find((item) => String(item.id) === String(orderId));
    const responsesMode = Boolean(order && order.responseMode === "responses");

    if (responsesMode) {
        const ownResponse = findOwnResponse(orderId, user.email);
        if (ownResponse && ownResponse.status === "pending") {
            statusNote.textContent = "Отклик отправлен — ждём решения заказчика";
            statusNote.classList.remove("hidden");
            return;
        }
        if (ownResponse && ownResponse.status === "rejected") {
            statusNote.textContent = "Заказчик отклонил ваш отклик";
            statusNote.classList.remove("hidden");
            return;
        }
        takeBtn.textContent = "Откликнуться";
    } else {
        takeBtn.textContent = "Взять заказ";
    }
    takeBtn.classList.remove("hidden");
}

function updateBalanceDisplay() {
    const balanceEl = document.getElementById("profile-balance");
    if (!balanceEl) return;
    const user = getCurrentUser();
    const balance = user ? Number(user.balance || 0) : 0;
    balanceEl.textContent = `${balance.toLocaleString("ru-RU")} ₽`;
}

function updateNotificationsBadge() {
    const badge = document.getElementById("notifications-badge");
    const user = getCurrentUser();
    if (!user) {
        badge.classList.add("hidden");
        return;
    }

    const count = getUnreadNotificationCount(user.email);
    if (count > 0) {
        badge.textContent = String(count);
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

function renderNotifications() {
    const user = getCurrentUser();
    const list = document.getElementById("notifications-list");
    const emptyState = document.getElementById("notifications-empty-state");
    if (!user) return;

    const items = getUserNotifications(user.email);
    if (!items.length) {
        list.innerHTML = "";
        list.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = items.map((item) => `
        <div class="notification-item${item.read ? "" : " notification-unread"}">
            <p>${escapeHTML(item.message)}</p>
            <span class="notification-date">${formatOrderDate(item.createdAt)}</span>
        </div>
    `).join("");
}


function isAdminUser(user) {
    if (TEST_ALL_ROLES && user) return true;
    return Boolean(user && String(user.email || "").toLowerCase().includes("admin"));
}

function renderAdminPanel() {
    const user = getCurrentUser();
    if (!isAdminUser(user)) return;

    purgeStaleTakenOrders();
    document.getElementById("admin-stat-users").textContent = String(getUsers().length);
    document.getElementById("admin-stat-orders").textContent = String(getOrders().length);
    document.getElementById("admin-stat-taken").textContent = String(
        getTakenOrders().filter((item) => item.status === "active").length
    );

    renderAdminReviewOrders();
    renderAdminReviewSubmits();
    renderAdminUsers(user.email);
    renderAdminOrders();
    renderAdminTakenOrders();
}

function renderAdminReviewOrders() {
    const list = document.getElementById("admin-review-orders");
    const pendingOrders = getOrders().filter((order) => order.status === "pending");

    if (!pendingOrders.length) {
        list.innerHTML = '<p class="admin-empty">Нет заказов на проверке</p>';
        return;
    }

    list.innerHTML = pendingOrders.map((order) => `
        <div class="admin-item">
            <div class="admin-item-info">
                <strong>${escapeHTML(order.title)}</strong>
                <span>Автор: ${escapeHTML(order.authorName || order.author)}</span>
                <span>${Number(order.price).toLocaleString("ru-RU")} ₽ • ${formatOrderDate(order.createdAt || order.id)}</span>
            </div>
            <button type="button" class="admin-approve-btn" data-order-id="${escapeHTML(order.id)}">Одобрить</button>
            <button type="button" class="admin-delete-btn" data-order-id="${escapeHTML(order.id)}" aria-label="Отклонить заказ">×</button>
        </div>
    `).join("");

    list.querySelectorAll(".admin-approve-btn").forEach((button) => {
        button.addEventListener("click", () => approvePendingOrder(button.dataset.orderId));
    });
    list.querySelectorAll(".admin-delete-btn").forEach((button) => {
        button.addEventListener("click", () => rejectPendingOrder(button.dataset.orderId));
    });
}

function renderAdminReviewSubmits() {
    const list = document.getElementById("admin-review-submits");
    const submits = purgeStaleTakenOrders().filter((item) => item.status === "active" && item.submitRequested);

    if (!submits.length) {
        list.innerHTML = '<p class="admin-empty">Нет запросов на сдачу работ</p>';
        return;
    }

    const orders = getOrders();
    list.innerHTML = submits.map((item) => {
        const order = orders.find((order) => String(order.id) === String(item.orderId));
        if (!order) return "";
        const submission = item.submission || {};
        const shortSpec = String(order.description || "").length > 160
            ? `${String(order.description).slice(0, 160)}…`
            : String(order.description || "");
        return `
            <div class="admin-item admin-submit-item">
                <div class="admin-item-info">
                    <strong>${escapeHTML(order.title)}</strong>
                    <span>Исполнитель: ${escapeHTML(item.contractor)}</span>
                    <span>Сдал ${formatOrderDate(item.submittedAt)}</span>
                    ${shortSpec ? `<span class="admin-submit-spec">ТЗ: ${escapeHTML(shortSpec)}</span>` : ""}
                </div>
                ${submission.message ? `<p class="admin-submit-message">${escapeHTML(submission.message)}</p>` : ""}
                <div class="submit-files-list">${submissionFilesMarkup(submission.files)}</div>
                <div class="admin-submit-actions">
                    <button type="button" class="admin-approve-btn" data-order-id="${escapeHTML(order.id)}" data-contractor="${escapeHTML(item.contractor)}">Одобрить и отправить заказчику</button>
                    <button type="button" class="admin-reject-btn" data-order-id="${escapeHTML(order.id)}" data-contractor="${escapeHTML(item.contractor)}">Отклонить</button>
                </div>
            </div>
        `;
    }).join("");

    list.querySelectorAll(".admin-approve-btn").forEach((button) => {
        button.addEventListener("click", () => approveSubmitRequest(button.dataset.orderId, button.dataset.contractor));
    });
    list.querySelectorAll(".admin-reject-btn").forEach((button) => {
        button.addEventListener("click", () => rejectSubmitRequest(button.dataset.orderId, button.dataset.contractor));
    });
}

let adminUsersQuery = "";
let adminUsersRole = "";
let adminOrdersQuery = "";
let adminOrdersStatus = "";

function renderAdminUsers(currentEmail) {
    const list = document.getElementById("admin-users-list");
    const allUsers = getUsers();
    const query = normalizeSearchText(adminUsersQuery);
    const users = allUsers.filter((item) => {
        if (adminUsersRole && item.role !== adminUsersRole) return false;
        if (query && !normalizeSearchText(`${item.name} ${item.email}`).includes(query)) return false;
        return true;
    });

    if (!users.length) {
        list.innerHTML = `<p class="admin-empty">${allUsers.length ? "Ничего не найдено по фильтру" : "Пользователей пока нет"}</p>`;
        return;
    }

    list.innerHTML = users.map((item) => `
        <div class="admin-item">
            <div class="admin-item-info">
                <strong>${escapeHTML(item.name)}</strong>
                <span>${escapeHTML(item.email)}</span>
                <span>${item.role === "contractor" ? "Исполнитель" : "Заказчик"} • баланс ${Number(item.balance || 0).toLocaleString("ru-RU")} ₽</span>
            </div>
            ${item.email === currentEmail ? "" : `
                <select class="admin-role-select" data-email="${escapeHTML(item.email)}">
                    <option value="customer"${item.role === "customer" ? " selected" : ""}>Заказчик</option>
                    <option value="contractor"${item.role === "contractor" ? " selected" : ""}>Исполнитель</option>
                </select>
                <button type="button" class="admin-delete-btn" data-email="${escapeHTML(item.email)}" aria-label="Удалить пользователя">×</button>
            `}
        </div>
    `).join("");

    list.querySelectorAll(".admin-role-select").forEach((select) => {
        select.addEventListener("change", () => changeAdminUserRole(select.dataset.email, select.value));
    });
    list.querySelectorAll(".admin-delete-btn").forEach((button) => {
        button.addEventListener("click", () => deleteAdminUser(button.dataset.email));
    });
}

function renderAdminOrders() {
    const list = document.getElementById("admin-orders-list");
    const allOrders = getOrders();
    const query = normalizeSearchText(adminOrdersQuery);
    const orders = allOrders.filter((order) => {
        if (adminOrdersStatus && order.status !== adminOrdersStatus) return false;
        if (query && !normalizeSearchText(`${order.title} ${order.authorName || ""} ${order.author}`).includes(query)) return false;
        return true;
    });

    if (!orders.length) {
        list.innerHTML = `<p class="admin-empty">${allOrders.length ? "Ничего не найдено по фильтру" : "Заказов пока нет"}</p>`;
        return;
    }

    list.innerHTML = orders.map((order) => `
        <div class="admin-item">
            <div class="admin-item-info">
                <strong>${escapeHTML(order.title)}</strong>
                <span>Автор: ${escapeHTML(order.authorName || order.author)}</span>
                <span>${Number(order.price).toLocaleString("ru-RU")} ₽ • ${order.status === "pending" ? "На проверке" : "Опубликован"}</span>
            </div>
            <button type="button" class="admin-delete-btn" data-order-id="${escapeHTML(order.id)}" aria-label="Удалить заказ">×</button>
        </div>
    `).join("");

    list.querySelectorAll(".admin-delete-btn").forEach((button) => {
        button.addEventListener("click", () => deleteAdminOrder(button.dataset.orderId));
    });
}

function renderAdminTakenOrders() {
    const list = document.getElementById("admin-taken-list");
    const orders = getOrders();
    const takenOrders = purgeStaleTakenOrders().filter((item) => item.status === "active");

    if (!takenOrders.length) {
        list.innerHTML = '<p class="admin-empty">Сейчас никто не выполняет заказы</p>';
        return;
    }

    list.innerHTML = takenOrders.map((item) => {
        const order = orders.find((order) => String(order.id) === String(item.orderId));
        return `
            <div class="admin-item">
                <div class="admin-item-info">
                    <strong>${escapeHTML(order ? order.title : "Заказ удалён")}</strong>
                    <span>Исполнитель: ${escapeHTML(item.contractor)}</span>
                    <span>Взят ${formatOrderDate(item.takenAt)}</span>
                </div>
            </div>
        `;
    }).join("");
}

function changeAdminUserRole(email, role) {
    const users = getUsers();
    const target = users.find((item) => item.email === email);
    if (!target) return;

    target.role = role;
    saveUsers(users);
    renderAdminUsers(getCurrentUser().email);
}

function deleteAdminUser(email) {
    if (!confirm(`Удалить пользователя ${email}? Его заказы тоже будут удалены.`)) return;

    saveUsers(getUsers().filter((item) => item.email !== email));
    saveOrders(getOrders().filter((item) => item.author !== email));
    saveTakenOrders(getTakenOrders().filter((item) => item.contractor !== email));
    saveNotifications(getNotifications().filter((item) => item.email !== email));
    renderAdminPanel();
}

function deleteAdminOrder(orderId) {
    if (!confirm("Удалить этот заказ?")) return;

    saveOrders(getOrders().filter((item) => String(item.id) !== String(orderId)));
    saveTakenOrders(getTakenOrders().filter((item) => String(item.orderId) !== String(orderId)));
    renderAdminPanel();
}

function renderTakenOrders() {
    const list = document.getElementById("taken-order-list");
    const emptyState = document.getElementById("taken-orders-empty-state");
    const countLabel = document.getElementById("taken-order-count-label");
    const orders = getCurrentTakenOrders();

    countLabel.textContent = formatOrderCount(orders.length);

    const user = getCurrentUser();
    const completedOrders = user
        ? getCompletedOrders().filter((order) => order.contractor === user.email)
        : [];
    const completedHeading = document.getElementById("completed-orders-heading");
    const completedList = document.getElementById("completed-order-list");

    completedHeading.classList.toggle("hidden", !completedOrders.length);
    completedList.classList.toggle("hidden", !completedOrders.length);

    if (completedOrders.length) {
        const myReviews = new Set(
            getReviews()
                .filter((review) => review.author === user.email)
                .map((review) => String(review.orderId))
        );
        completedList.innerHTML = completedOrders.map((order) => {
            const reviewed = myReviews.has(String(order.id));
            return `
                <div class="admin-item">
                    <div class="admin-item-info">
                        <strong>${escapeHTML(order.title)}</strong>
                        <span>${Number(order.price || 0).toLocaleString("ru-RU")} ₽ • заказчик ${escapeHTML(order.authorName || order.author)}</span>
                        <span>Завершён ${formatOrderDate(order.completedAt)}</span>
                    </div>
                    ${reviewed
                        ? '<span class="review-done-label">Отзыв оставлен</span>'
                        : `<button type="button" class="my-order-review-btn" data-review-order-id="${escapeHTML(order.id)}" data-target="${escapeHTML(order.author)}">★ Отзыв</button>`}
                </div>
            `;
        }).join("");

        completedList.querySelectorAll(".my-order-review-btn").forEach((button) => {
            button.addEventListener("click", () => {
                openReviewModal(button.dataset.reviewOrderId, button.dataset.target, "customer");
            });
        });
    } else {
        completedList.innerHTML = "";
    }

    if (!orders.length) {
        list.classList.add("hidden");
        list.innerHTML = "";
        emptyState.classList.toggle("hidden", Boolean(completedOrders.length));
        return;
    }

    emptyState.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = renderOrderCards(orders);
}

function normalizeSearchText(value) {
    return String(value || "")
        .toLocaleLowerCase("ru-RU")
        .replace(/ё/g, "е")
        .replace(/(^|\s)аи(?=\s|$)/g, "$1ai")
        .replace(/[^a-zа-я0-9]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const SEARCH_STOP_WORDS = new Set([
    "и", "в", "во", "на", "для", "с", "со", "по", "из", "к", "у", "о", "об",
    "от", "до", "за", "под", "без", "или", "а", "но", "же", "это", "мне", "нужен",
    "нужна", "нужно", "сделать", "создать"
]);

function tokenizeSearchQuery(value) {
    return [...new Set(
        normalizeSearchText(value)
            .split(" ")
            .filter((word) => word.length > 1 && !SEARCH_STOP_WORDS.has(word))
    )];
}

function levenshteinDistance(first, second) {
    const distances = Array.from({ length: second.length + 1 }, (_, index) => index);

    for (let row = 1; row <= first.length; row += 1) {
        let previous = distances[0];
        distances[0] = row;

        for (let column = 1; column <= second.length; column += 1) {
            const current = distances[column];
            const cost = first[row - 1] === second[column - 1] ? 0 : 1;
            distances[column] = Math.min(
                distances[column] + 1,
                distances[column - 1] + 1,
                previous + cost
            );
            previous = current;
        }
    }

    return distances[second.length];
}

function scoreSearchTerm(term, fieldValue, weight) {
    const words = tokenizeSearchQuery(fieldValue);
    let bestMatch = 0;

    words.forEach((word) => {
        if (word === term) {
            bestMatch = Math.max(bestMatch, 6);
        } else if (word.startsWith(term) || term.startsWith(word)) {
            bestMatch = Math.max(bestMatch, 4);
        } else if (term.length > 2 && word.includes(term)) {
            bestMatch = Math.max(bestMatch, 3);
        } else if (
            term.length >= 4 &&
            Math.abs(word.length - term.length) <= 2 &&
            levenshteinDistance(word, term) <= (term.length >= 7 ? 2 : 1)
        ) {
            bestMatch = Math.max(bestMatch, 1);
        }
    });

    return bestMatch * weight;
}

function findMatchingOrders(query) {
    const terms = tokenizeSearchQuery(query);
    if (!terms.length) return [];

    return getOrders()
        .filter((order) => order.status !== "pending")
        .map((order, originalIndex) => {
            const fields = [
                { value: order.title, weight: 8 },
                { value: order.topic, weight: 7 },
                { value: order.tags, weight: 6 },
                { value: order.description, weight: 3 },
                { value: order.extras, weight: 2 }
            ];
            let score = 0;

            for (const term of terms) {
                const termScore = Math.max(
                    ...fields.map((field) => scoreSearchTerm(term, field.value, field.weight))
                );
                if (!termScore) return null;
                score += termScore;
            }

            const normalizedQuery = normalizeSearchText(query);
            const normalizedTitle = normalizeSearchText(order.title);
            const normalizedTopic = normalizeSearchText(order.topic);
            if (normalizedTitle.includes(normalizedQuery)) score += 18;
            if (normalizedTopic.includes(normalizedQuery)) score += 14;

            return { order, score, originalIndex };
        })
        .filter(Boolean)
        .sort((first, second) => {
            if (second.score !== first.score) return second.score - first.score;
            return second.originalIndex - first.originalIndex;
        })
        .map((result) => result.order);
}

function escapeHTML(value) {
    return String(value || "").replace(/[&<>\"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '\"': "&quot;",
        "'": "&#039;"
    }[character]));
}

function formatDeadline(value) {
    if (!value) return "Не указан";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Не указан";
    return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function formatOrderStatus(order) {
    if (order.status === "pending") return { label: "На проверке", className: "status-pending" };
    const activeRecord = getTakenOrders().find(
        (item) => String(item.orderId) === String(order.id) && item.status === "active"
    );
    if (activeRecord?.submitRequested) return { label: "Сдан на проверку", className: "status-submitted" };
    if (activeRecord) return { label: "В работе", className: "status-active" };
    if (getCompletedOrders().some((item) => String(item.id) === String(order.id))) {
        return { label: "Сдан", className: "status-completed" };
    }
    return { label: "Опубликован", className: "status-published" };
}

function renderMyOrders() {
    const user = getCurrentUser();
    const list = document.getElementById("my-order-list");
    const emptyState = document.getElementById("my-orders-empty-state");
    const countLabel = document.getElementById("my-order-count-label");
    if (!user) return;

    const orders = getOrders().filter((order) => order.author === user.email);
    purgeExpiredHistory();
    const completed = getCompletedOrders().filter((order) => order.author === user.email);
    const completedActive = completed.filter((item) => !item.removedAt);
    const history = completed.filter((item) => item.removedAt);
    const allOrders = [...orders, ...completedActive.filter((item) => !orders.some((order) => String(order.id) === String(item.id)))];
    countLabel.textContent = formatOrderCount(allOrders.length);
    renderHistory(history);
    document.getElementById("my-tab-history").textContent = history.length ? `История (${history.length})` : "История";

    if (!allOrders.length) {
        list.innerHTML = "";
        list.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    list.classList.remove("hidden");
    const completedIds = new Set(completed.map((item) => String(item.id)));
    const reviewedIds = new Set(
        getReviews()
            .filter((review) => review.author === user.email)
            .map((review) => String(review.orderId))
    );
    list.innerHTML = allOrders.map((order) => {
        const status = formatOrderStatus(order);
        const isCompleted = completedIds.has(String(order.id)) && !orders.some((item) => String(item.id) === String(order.id));
        const canReview = isCompleted && order.contractor && !reviewedIds.has(String(order.id));
        const pendingResponses = isCompleted ? 0 : countPendingResponses(order.id);
        return `
            <article class="my-order-item" data-order-id="${escapeHTML(order.id)}">
                <div class="my-order-info">
                    <strong>${escapeHTML(order.title)}</strong>
                    <span>${escapeHTML(order.topic || "Без темы")} • ${Number(order.price || 0).toLocaleString("ru-RU")} ₽</span>
                    ${order.deadline ? `<span>Срок: ${formatDeadline(order.deadline)}</span>` : ""}
                    ${isCompleted && order.contractor ? `<span>Исполнитель: ${escapeHTML(order.contractorName || order.contractor)}</span>` : ""}
                </div>
                <span class="order-status ${status.className}">${status.label}</span>
                ${!isCompleted ? `
                    <button type="button" class="my-order-responses-btn${pendingResponses ? " has-new" : ""}" data-responses-order-id="${escapeHTML(order.id)}" title="Отклики исполнителей">💬 Отклики${pendingResponses ? ` (${pendingResponses})` : ""}</button>
                ` : ""}
                ${isCompleted && order.submission ? `
                    <button type="button" class="my-order-responses-btn" data-materials-id="${escapeHTML(order.id)}" title="Материалы работы">📎 Материалы</button>
                ` : ""}
                ${canReview ? `
                    <button type="button" class="my-order-review-btn" data-review-order-id="${escapeHTML(order.id)}" data-contractor="${escapeHTML(order.contractor)}" title="Оставить отзыв">★ Отзыв</button>
                ` : isCompleted && order.contractor ? `
                    <span class="review-done-label">Отзыв оставлен</span>
                ` : ""}
                ${isCompleted ? `
                    <button type="button" class="my-order-done-btn" data-done-id="${escapeHTML(order.id)}" aria-label="Убрать заказ из списка" title="Убрать из списка">✓</button>
                ` : ""}
            </article>
        `;
    }).join("");

    list.querySelectorAll(".my-order-done-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            removeCompletedOrder(button.dataset.doneId);
        });
    });

    list.querySelectorAll(".my-order-responses-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            if (button.dataset.materialsId) openSubmissionModal(button.dataset.materialsId);
            else openResponsesListModal(button.dataset.responsesOrderId);
        });
    });

    list.querySelectorAll(".my-order-review-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            openReviewModal(button.dataset.reviewOrderId, button.dataset.contractor);
        });
    });

    list.querySelectorAll(".my-order-item").forEach((item) => {
        item.addEventListener("click", () => {
            if (getOrders().some((order) => String(order.id) === String(item.dataset.orderId))) {
                showOrderDetails(item.dataset.orderId);
            }
        });
    });
}

// Удобный выбор срока выполнения
function toLocalIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function deadlineDaysLeft(value) {
    if (!value) return null;
    const target = new Date(`${value}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function updateDeadlineHint() {
    const input = document.getElementById("order-deadline");
    const hint = document.getElementById("deadline-hint");
    const clearBtn = document.getElementById("deadline-clear");
    const chips = document.querySelectorAll("#deadline-chips button");
    const daysLeft = deadlineDaysLeft(input.value);

    chips.forEach((chip) => {
        chip.classList.toggle("active", input.value !== "" && toLocalIsoDate(new Date(Date.now() + Number(chip.dataset.days) * 86400000)) === input.value);
    });
    clearBtn.classList.toggle("hidden", input.value === "");

    if (daysLeft === null) {
        hint.textContent = "Когда заказ нужно успеть сделать";
        return;
    }
    const monthName = DEADLINE_MONTHS[Number(input.value.slice(5, 7)) - 1];
    const readable = `${Number(input.value.slice(8, 10))} ${monthName} ${input.value.slice(0, 4)}`;
    let relative;
    if (daysLeft < 0) relative = "просрочен";
    else if (daysLeft === 0) relative = "сегодня";
    else if (daysLeft === 1) relative = "завтра";
    else if (daysLeft < 5) relative = `через ${daysLeft} дня`;
    else relative = `через ${daysLeft} дней`;
    hint.textContent = `Срок: ${readable} — ${relative}`;
}

const DEADLINE_MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

function syncDeadlineFromSelects() {
    const day = document.getElementById("deadline-day").value;
    const month = document.getElementById("deadline-month").value;
    const year = document.getElementById("deadline-year").value;
    document.getElementById("order-deadline").value = day && month && year ? `${year}-${month}-${day}` : "";
    updateDeadlineHint();
}

function fillDeadlineDays() {
    const daySelect = document.getElementById("deadline-day");
    const month = document.getElementById("deadline-month").value;
    const year = document.getElementById("deadline-year").value;
    const selectedDay = daySelect.value;
    const daysInMonth = month && year ? new Date(Number(year), Number(month), 0).getDate() : 31;

    daySelect.innerHTML = '<option value="">День</option>';
    for (let day = 1; day <= daysInMonth; day += 1) {
        daySelect.insertAdjacentHTML("beforeend", `<option value="${String(day).padStart(2, "0")}">${day}</option>`);
    }
    if (selectedDay && Number(selectedDay) <= daysInMonth) daySelect.value = selectedDay;
}

function setDeadlineValue(value) {
    const daySelect = document.getElementById("deadline-day");
    const monthSelect = document.getElementById("deadline-month");
    const yearSelect = document.getElementById("deadline-year");

    fillDeadlineDays();
    if (value) {
        daySelect.value = value.slice(8, 10);
        monthSelect.value = value.slice(5, 7);
        yearSelect.value = value.slice(0, 4);
    } else {
        daySelect.value = "";
        monthSelect.value = "";
        yearSelect.value = "";
    }
    document.getElementById("order-deadline").value = value || "";
    updateDeadlineHint();
}

function initDeadlinePicker() {
    const daySelect = document.getElementById("deadline-day");
    const monthSelect = document.getElementById("deadline-month");
    const yearSelect = document.getElementById("deadline-year");

    monthSelect.innerHTML = '<option value="">Месяц</option>';
    DEADLINE_MONTHS.forEach((name, index) => {
        monthSelect.insertAdjacentHTML("beforeend", `<option value="${String(index + 1).padStart(2, "0")}">${name}</option>`);
    });
    yearSelect.innerHTML = '<option value="">Год</option>';
    const now = new Date();
    for (let offset = 0; offset <= 2; offset += 1) {
        const year = now.getFullYear() + offset;
        yearSelect.insertAdjacentHTML("beforeend", `<option value="${year}">${year}</option>`);
    }
    fillDeadlineDays();

    document.querySelectorAll("#deadline-chips button").forEach((chip) => {
        chip.addEventListener("click", () => {
            const date = new Date();
            date.setDate(date.getDate() + Number(chip.dataset.days));
            setDeadlineValue(toLocalIsoDate(date));
        });
    });

    [monthSelect, yearSelect].forEach((select) => select.addEventListener("change", () => {
        fillDeadlineDays();
        syncDeadlineFromSelects();
    }));
    daySelect.addEventListener("change", syncDeadlineFromSelects);

    document.getElementById("deadline-clear").addEventListener("click", () => setDeadlineValue(""));
}

initDeadlinePicker();

function removeCompletedOrder(orderId) {
    const completed = getCompletedOrders();
    const entry = completed.find((item) => String(item.id) === String(orderId));
    if (!entry || entry.removedAt) return;
    entry.removedAt = Date.now();
    saveCompletedOrders(completed);
    renderMyOrders();
}

const HISTORY_DAYS = 15;

function purgeExpiredHistory() {
    const completed = getCompletedOrders();
    const kept = completed.filter(
        (item) => !item.removedAt || Date.now() - item.removedAt < HISTORY_DAYS * 86400000
    );
    if (kept.length !== completed.length) saveCompletedOrders(kept);
}

function historyDaysLeft(removedAt) {
    const end = Number(removedAt) + HISTORY_DAYS * 86400000;
    return Math.max(1, Math.ceil((end - Date.now()) / 86400000));
}

let myOrdersTab = "orders";

function setMyOrdersTab(tab) {
    myOrdersTab = tab === "history" ? "history" : "orders";
    document.querySelectorAll("[data-my-tab]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.myTab === myOrdersTab);
    });
    document.getElementById("my-orders-panel-orders").classList.toggle("hidden", myOrdersTab !== "orders");
    document.getElementById("my-orders-panel-history").classList.toggle("hidden", myOrdersTab !== "history");
}

function renderHistory(history) {
    const list = document.getElementById("history-list");
    const emptyState = document.getElementById("history-empty-state");
    if (!list) return;

    list.classList.toggle("hidden", !history.length);
    emptyState.classList.toggle("hidden", Boolean(history.length));
    if (!history.length) {
        list.innerHTML = "";
        return;
    }

    list.innerHTML = [...history].sort((a, b) => (b.removedAt || 0) - (a.removedAt || 0)).map((order) => {
        const daysLeft = historyDaysLeft(order.removedAt);
        const daysLabel = daysLeft === 1 ? "1 день" : daysLeft < 5 ? `${daysLeft} дня` : `${daysLeft} дней`;
        return `
            <article class="my-order-item history-item">
                <div class="my-order-info">
                    <strong>${escapeHTML(order.title)}</strong>
                    <span>${Number(order.price || 0).toLocaleString("ru-RU")} ₽ • Сдан ${formatOrderDate(order.completedAt)}</span>
                    <span class="history-left">Материалы доступны ещё ${daysLabel}</span>
                </div>
                ${order.submission ? `
                    <button type="button" class="my-order-responses-btn" data-materials-id="${escapeHTML(order.id)}" title="Материалы работы">📎 Материалы</button>
                ` : ""}
                <button type="button" class="history-purge-btn" data-history-purge-id="${escapeHTML(order.id)}" title="Удалить навсегда">Удалить</button>
            </article>
        `;
    }).join("");

    list.querySelectorAll("[data-materials-id]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            openSubmissionModal(button.dataset.materialsId);
        });
    });
    list.querySelectorAll("[data-history-purge-id]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            saveCompletedOrders(getCompletedOrders().filter((item) => String(item.id) !== String(button.dataset.historyPurgeId)));
            renderMyOrders();
        });
    });
}

function renderProfileActivity() {
    const user = getCurrentUser();
    if (!user) return;

    const isContractor = user.role === "contractor";
    const completedAll = getCompletedOrders().filter((item) =>
        isContractor ? item.contractor === user.email : item.author === user.email
    );
    const completedActive = completedAll.filter((item) => !item.removedAt);

    const contractorStats = document.getElementById("profile-contractor-stats");
    contractorStats.classList.toggle("hidden", !isContractor);
    if (isContractor) {
        const { avg, count } = getRatingFor(user.email);
        document.getElementById("profile-completed-count").textContent = String(completedActive.length);
        document.getElementById("profile-own-rating").textContent = count
            ? `${formatRatingStars(avg)} ${avg.toFixed(1)}`
            : "—";

        const withDuration = completedActive.filter((item) => item.takenAt && item.completedAt);
        if (withDuration.length) {
            const avgDays = withDuration.reduce(
                (sum, item) => sum + (item.completedAt - item.takenAt) / 86400000, 0
            ) / withDuration.length;
            const avgLabel = avgDays < 1 ? `${Math.max(1, Math.round(avgDays * 24))} ч` : `${avgDays.toFixed(1)} дн.`;
            document.getElementById("profile-avg-duration").textContent = avgLabel;
        } else {
            document.getElementById("profile-avg-duration").textContent = "—";
        }
    }

    const completedTitle = document.getElementById("profile-completed-title");
    completedTitle.textContent = isContractor ? "Выполненные заказы" : "Мои завершённые заказы";
    const completedList = document.getElementById("profile-completed-list");
    if (!completedActive.length) {
        completedList.innerHTML = '<p class="admin-empty">Пока нет выполненных заказов</p>';
    } else {
        completedList.innerHTML = completedActive.slice(0, 8).map((item) => {
            let deadlineInfo = "";
            if (item.deadline) {
                const deadlineDate = new Date(`${item.deadline}T23:59:59`);
                const done = new Date(item.completedAt);
                const lateDays = Math.floor((done - deadlineDate) / 86400000) + 1;
                deadlineInfo = lateDays > 0
                    ? `<span class="profile-deadline late">Опоздание: ${lateDays} дн.</span>`
                    : '<span class="profile-deadline ontime">Сдан в срок</span>';
            }
            return `
                <div class="admin-item">
                    <div class="admin-item-info">
                        <strong>${escapeHTML(item.title)}</strong>
                        <span>${Number(item.price || 0).toLocaleString("ru-RU")} ₽ • ${formatOrderDate(item.completedAt)}</span>
                        ${deadlineInfo}
                    </div>
                </div>
            `;
        }).join("");
    }

    const reviewsList = document.getElementById("profile-reviews-list");
    const reviewsAbout = getReviews().filter((review) =>
        isContractor ? review.contractor === user.email : review.customer === user.email
    );
    if (!reviewsAbout.length) {
        reviewsList.innerHTML = '<p class="admin-empty">Отзывов пока нет</p>';
    } else {
        reviewsList.innerHTML = reviewsAbout.slice(0, 8).map((review) => {
            const author = getUsers().find((item) => item.email === review.author);
            return `
                <div class="review-item">
                    <div class="review-head">
                        <span class="rating-stars">${formatRatingStars(review.rating)}</span>
                        <strong>${escapeHTML(author?.name || review.author)}</strong>
                    </div>
                    ${review.text ? `<p class="review-text">${escapeHTML(review.text)}</p>` : ""}
                    <span class="review-meta">${escapeHTML(review.orderTitle || "")} • ${formatOrderDate(review.createdAt)}</span>
                </div>
            `;
        }).join("");
    }
}

function showPublicProfile(email) {
    const profileUser = getUsers().find((user) => user.email === email);
    const completedOrders = getCompletedOrders().filter((order) => order.contractor === email && !order.removedAt);
    const { avg, count } = getRatingFor(email);

    const knownOrders = [...getOrders(), ...getCompletedOrders()];
    const fallbackName = knownOrders.find((order) => order.author === email)?.authorName;
    const displayName = profileUser?.name || fallbackName || "Пользователь";

    document.getElementById("public-profile-avatar").textContent = displayName.charAt(0).toUpperCase();
    document.getElementById("public-profile-name").textContent = displayName;
    document.getElementById("public-profile-email").textContent = email;
    document.getElementById("public-profile-role").textContent =
        profileUser?.role === "contractor" ? "Исполнитель" : "Заказчик";
    document.getElementById("public-profile-completed").textContent = String(completedOrders.length);
    document.getElementById("public-profile-since").textContent = profileUser?.registeredAt
        ? new Date(profileUser.registeredAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "—";
    document.getElementById("public-profile-rating").textContent = count
        ? `${formatRatingStars(avg)} ${avg.toFixed(1)} — ${formatOrderCount(count)}`
        : "Оценок пока нет";

    const isContractor = profileUser?.role === "contractor";
    document.getElementById("public-profile-completed-item").classList.toggle("hidden", !isContractor);
    document.getElementById("public-profile-orders-heading").classList.toggle("hidden", !isContractor);
    document.getElementById("public-profile-orders").classList.toggle("hidden", !isContractor);
    document.getElementById("public-profile-reviews-title").textContent = isContractor
        ? "Что пишут заказчики"
        : "Что пишут исполнители";
    document.getElementById("public-profile-reviews-heading").classList.remove("hidden");
    document.getElementById("public-profile-reviews").classList.remove("hidden");

    const about = String(profileUser?.about || "").trim();
    document.getElementById("public-profile-about").textContent = about || "Пока ничего не рассказано.";

    const skills = String(profileUser?.skills || "")
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
    document.getElementById("public-profile-skills").innerHTML = skills.length
        ? skills.map((skill) => `<span class="task-tag">${escapeHTML(skill)}</span>`).join("")
        : '<span class="field-hint">Навыки не указаны</span>';

    const ordersList = document.getElementById("public-profile-orders");
    ordersList.innerHTML = completedOrders.length
        ? completedOrders.map((order) => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <strong>${escapeHTML(order.title)}</strong>
                    <span>${Number(order.price || 0).toLocaleString("ru-RU")} ₽ • завершён ${formatOrderDate(order.completedAt)}</span>
                </div>
            </div>
        `).join("")
        : '<p class="admin-empty">Выполненных заказов пока нет</p>';

    const reviewsAbout = getReviews().filter((review) =>
        isContractor ? review.contractor === email : review.customer === email
    );
    const reviewsList = document.getElementById("public-profile-reviews");
    reviewsList.innerHTML = reviewsAbout.length
        ? reviewsAbout.map((review) => {
            const author = getUsers().find((user) => user.email === review.author);
            return `
                <div class="review-item">
                    <div class="review-head">
                        <span class="rating-stars">${formatRatingStars(review.rating)}</span>
                        <strong>${escapeHTML(author?.name || review.author)}</strong>
                    </div>
                    ${review.text ? `<p class="review-text">${escapeHTML(review.text)}</p>` : ""}
                    <span class="review-meta">${escapeHTML(review.orderTitle || "")} • ${formatOrderDate(review.createdAt)}</span>
                </div>
            `;
        }).join("")
        : '<p class="admin-empty">Отзывов пока нет</p>';

    switchScreen("public-profile-screen", "Профиль исполнителя", null);
}

let reviewTarget = null;

let responseOrderId = null;
let responsesListOrderId = null;

function openResponseModal(orderId) {
    const user = getCurrentUser();
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    if (!user || !order) return;

    responseOrderId = orderId;
    document.getElementById("response-order-name").textContent = `Заказ «${order.title}» — ${Number(order.price || 0).toLocaleString("ru-RU")} ₽`;
    document.getElementById("response-text").value = "";
    document.getElementById("error-response-text").textContent = "";
    document.getElementById("response-modal").classList.remove("hidden");
}

function openResponsesListModal(orderId) {
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    if (!order) return;

    responsesListOrderId = orderId;
    renderResponsesList();
    document.getElementById("responses-list-modal").classList.remove("hidden");
}

function renderResponsesList() {
    const list = document.getElementById("responses-list");
    const empty = document.getElementById("responses-list-empty");
    const responses = getResponses().filter((item) => String(item.orderId) === String(responsesListOrderId));

    if (!responses.length) {
        list.innerHTML = "";
        list.classList.add("hidden");
        empty.classList.remove("hidden");
        return;
    }

    empty.classList.add("hidden");
    list.classList.remove("hidden");
    list.innerHTML = responses.map((item) => {
        const isPending = item.status === "pending";
        const statusLabel = isPending ? "Ожидает решения" : item.status === "accepted" ? "Принят" : "Отклонён";
        return `
            <div class="response-item${item.status === "accepted" ? " response-accepted" : ""}">
                <div class="response-head">
                    <button type="button" class="response-author" data-email="${escapeHTML(item.contractor)}">${escapeHTML(item.contractorName || item.contractor)}</button>
                    <span class="response-status-label">${statusLabel}</span>
                </div>
                <p class="response-message">${escapeHTML(item.message)}</p>
                <span class="response-date">${formatOrderDate(item.createdAt)}</span>
                ${isPending ? `
                    <div class="response-actions">
                        <button type="button" class="admin-approve-btn" data-accept="${escapeHTML(item.contractor)}">Принять</button>
                        <button type="button" class="admin-reject-btn" data-reject="${escapeHTML(item.contractor)}">Отклонить</button>
                    </div>
                ` : ""}
            </div>
        `;
    }).join("");
}

function openReviewModal(orderId, targetEmail, mode = "contractor") {
    const user = getCurrentUser();
    const completed = getCompletedOrders().find((item) => String(item.id) === String(orderId));
    if (!user || !completed || !targetEmail) return;

    if (mode === "contractor" && completed.author !== user.email) return;
    if (mode === "customer" && completed.contractor !== user.email) return;

    reviewTarget = { orderId, targetEmail, mode };
    const targetName = mode === "contractor"
        ? completed.contractorName || targetEmail
        : completed.authorName || targetEmail;
    const targetLabel = mode === "contractor" ? "исполнитель" : "заказчик";
    document.getElementById("review-order-name").textContent =
        `Заказ «${completed.title}» — ${targetLabel} ${targetName}`;
    document.getElementById("review-text").value = "";
    document.getElementById("error-review-rating").textContent = "";
    document.querySelectorAll("#stars-input button").forEach((star) => star.classList.remove("active"));
    document.getElementById("review-modal").classList.remove("hidden");
}

function formatOrderCount(count) {
    const remainder = count % 10;
    const lastTwo = count % 100;
    let word = "заказов";
    if (remainder === 1 && lastTwo !== 11) word = "заказ";
    if (remainder >= 2 && remainder <= 4 && (lastTwo < 10 || lastTwo >= 20)) word = "заказа";
    return `${count} ${word}`;
}
function collectExtras() {
    return [...document.querySelectorAll(".extra-row")]
        .map((row) => ({
            name: row.querySelector(".extra-name").value.trim(),
            price: Number(row.querySelector(".extra-price").value)
        }))
        .filter((extra) => extra.name || extra.price);
}

function formatExtras(extras) {
    if (!extras.length) return "Без доп. услуг";
    return extras.map((extra) => `${extra.name} — +${extra.price.toLocaleString("ru-RU")} ₽`).join(", ");
}

function resetExtras() {
    document.getElementById("extras-list").innerHTML = `
        <div class="extra-row">
            <input type="text" class="extra-name" maxlength="40" placeholder="Например, сделать за 1 день">
            <input type="number" class="extra-price" min="1" max="5000" placeholder="Цена, ₽">
        </div>
    `;
}

function validateExtras() {
    const error = document.getElementById("error-order-extras");
    const extras = collectExtras();
    error.textContent = "";

    for (const extra of extras) {
        if (!extra.name || !extra.price) {
            error.textContent = "Заполните название и цену каждой услуги";
            return false;
        }
        if (extra.name.length > 40) {
            error.textContent = "Название услуги должно быть не больше 40 символов";
            return false;
        }
        if (extra.price > 5000 || extra.price < 1) {
            error.textContent = "Цена дополнительной услуги — от 1 до 5000 ₽";
            return false;
        }
    }

    return true;
}

function showError(id, message) {
    document.getElementById(id).textContent = message || "";
}

function clearErrors(form) {
    form.querySelectorAll(".error").forEach((element) => {
        element.textContent = "";
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showCard(cardId) {
    document.getElementById("register-card").classList.add("hidden");
    document.getElementById("login-card").classList.add("hidden");
    document.getElementById("app-shell").classList.add("hidden");
    document.getElementById(cardId).classList.remove("hidden");
}

function getCurrentUser() {
    const email = localStorage.getItem(SESSION_KEY);
    return getUsers().find((user) => user.email === email);
}

// Живые счётчики в шапке: активные заказы и баланс
function updateHeaderStats() {
    const ordersCount = document.getElementById("header-stat-orders");
    const balanceValue = document.getElementById("header-stat-balance");
    if (!ordersCount || !balanceValue) return;

    const activeOrders = getOrders().filter((order) => order.status !== "pending").length;
    ordersCount.textContent = activeOrders;

    const user = getCurrentUser();
    const balance = user ? Number(user.balance || 0) : 0;
    balanceValue.textContent = `${balance.toLocaleString("ru-RU")} ₽`;
}

function showApp() {
    const user = getCurrentUser();
    if (!user) {
        showCard("register-card");
        return;
    }

    updateHeaderStats();
    const firstLetter = user.name.charAt(0).toUpperCase();
    document.getElementById("header-avatar").textContent = firstLetter;
    document.getElementById("profile-avatar").textContent = firstLetter;
    document.getElementById("profile-name").textContent = user.name;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-role").textContent =
        user.role === "contractor" ? "Исполнитель" : "Заказчик";
    document.getElementById("open-create-order").classList.toggle(
        "hidden",
        user.role !== "customer" && !TEST_ALL_ROLES
    );
    document.getElementById("admin-nav").classList.toggle("hidden", !isAdminUser(user));
    document.getElementById("taken-orders-nav").classList.toggle(
        "hidden",
        user.role !== "contractor" && !TEST_ALL_ROLES
    );
    document.getElementById("my-orders-nav").classList.toggle(
        "hidden",
        user.role !== "customer" && !TEST_ALL_ROLES
    );
    updateBalanceDisplay();
    renderProfileActivity();

    const customerStats = document.getElementById("profile-customer-stats");
    const isCustomer = user.role !== "contractor";
    if (customerStats) {
        customerStats.classList.toggle("hidden", !isCustomer);
        if (isCustomer) {
            const spent = getCompletedOrders()
                .filter((order) => order.author === user.email)
                .reduce((sum, order) => sum + Number(order.price || 0), 0);
            document.getElementById("profile-spent").textContent = `${spent.toLocaleString("ru-RU")} ₽`;

            const inProgress = getOrders().filter(
                (order) => order.author === user.email && isOrderTaken(order.id)
            ).length;
            document.getElementById("profile-in-progress").textContent = String(inProgress);

            const givenReviews = getReviews().filter(
                (review) => review.author === user.email && review.contractor
            );
            const givenAvg = givenReviews.length
                ? givenReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / givenReviews.length
                : 0;
            document.getElementById("profile-given-rating").textContent = givenReviews.length
                ? `${formatRatingStars(givenAvg)} ${givenAvg.toFixed(1)}`
                : "—";
        }
    }

    updateNotificationsBadge();
    renderOrders();
    renderTakenOrders();
    renderMyOrders();
    const homeItem = document.querySelector('[data-screen="home-screen"]');
    switchScreen("home-screen", "Главный экран", homeItem);
    showCard("app-shell");
}

function switchScreen(screenId, title, navItem) {
    document.querySelectorAll(".app-screen").forEach((screen) => {
        screen.classList.toggle("hidden", screen.id !== screenId);
    });
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("active", item === navItem);
    });
    document.getElementById("screen-title").textContent = title;
}

function showOrderDetails(orderId) {
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    if (!order) return;

    const author = getUsers().find((user) => user.email === order.author);
    const authorName = author?.name || order.authorName || "Пользователь";
    const authorLetter = authorName.charAt(0).toUpperCase();
    const tags = String(order.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => `<span class="task-tag">${escapeHTML(tag)}</span>`)
        .join("");

    document.getElementById("detail-topic").textContent = order.topic || "Без темы";
    document.getElementById("detail-title").textContent = order.title;
    document.getElementById("detail-price").textContent = `${Number(order.price).toLocaleString("ru-RU")} ₽`;
    document.getElementById("detail-description").textContent = order.description;
    document.getElementById("detail-deadline").textContent = formatDeadline(order.deadline);
    document.getElementById("detail-extras").textContent = order.extras || "Без дополнительных услуг";
    document.getElementById("detail-tags").innerHTML = tags || "<span class=\"field-hint\">Без тегов</span>";
    document.getElementById("detail-author-avatar").textContent = authorLetter;
    const authorElement = document.getElementById("detail-author");
    authorElement.textContent = authorName;
    authorElement.dataset.email = order.author;
    document.getElementById("detail-author-rating").textContent = formatRatingText(order.author);
    document.getElementById("detail-date").textContent = `Опубликовано ${formatOrderDate(order.createdAt || order.id)}`;

    const photoElement = document.querySelector(".order-detail-photo");
    const orderCover = getOrderCover(order);
    photoElement.className = `order-detail-photo tone-${orderCover.tone}`;
    photoElement.innerHTML = `<span class="cover-emoji-big">${orderCover.icon}</span>`;

    const user = getCurrentUser();
    const isAuthor = Boolean(user && order.author === user.email);
    const canManage = isAuthor && !isOrderTaken(order.id);
    document.getElementById("edit-order-btn").classList.toggle("hidden", !canManage);
    document.getElementById("edit-order-btn").dataset.orderId = order.id;
    document.getElementById("delete-order-btn").classList.toggle("hidden", !canManage);
    document.getElementById("delete-order-btn").dataset.orderId = order.id;

    updateOrderActionButtons(order.id);

    switchScreen("order-details-screen", "Задание", null);
}

function formatOrderDate(timestamp) {
    if (!timestamp) return "Дата не указана";
    return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(timestamp));
}

function getFeedFilters(prefix) {
    return {
        topic: document.getElementById(`${prefix}filter-topic`).value,
        priceMin: Number(document.getElementById(`${prefix}filter-price-min`).value) || 0,
        priceMax: Number(document.getElementById(`${prefix}filter-price-max`).value) || Infinity,
        sort: document.getElementById(`${prefix}filter-sort`).value
    };
}

function applyFeedFilters(orders, prefix) {
    const filters = getFeedFilters(prefix);

    const filtered = orders.filter((order) => {
        if (filters.topic && order.topic !== filters.topic) return false;
        const price = Number(order.price || 0);
        if (price < filters.priceMin) return false;
        if (price > filters.priceMax) return false;
        return true;
    });

    if (filters.sort === "cheap") {
        filtered.sort((first, second) => Number(first.price) - Number(second.price));
    } else if (filters.sort === "expensive") {
        filtered.sort((first, second) => Number(second.price) - Number(first.price));
    } else if (filters.sort === "new") {
        filtered.sort((first, second) => second.createdAt - first.createdAt);
    }
    // "relevance" — сохраняем порядок, который вернул поиск

    return filtered;
}

const FEED_MAX = 50;
const FEED_STEP = 5;
const FEED_STEP_MEDIUM = 8;
const FEED_STEP_WIDE = 9;
const MEDIUM_LAYOUT_MIN = 601;
const WIDE_LAYOUT_MIN = 1024;

function isWideLayout() {
    return window.innerWidth >= WIDE_LAYOUT_MIN;
}

function currentFeedStep() {
    const width = window.innerWidth;
    if (width >= WIDE_LAYOUT_MIN) return FEED_STEP_WIDE;
    if (width >= MEDIUM_LAYOUT_MIN) return FEED_STEP_MEDIUM;
    return FEED_STEP;
}

let feedVisibleCount = currentFeedStep();

// При переходе между режимами раскладки пересобираем ленту
let lastFeedStep = currentFeedStep();
window.addEventListener("resize", () => {
    const step = currentFeedStep();
    if (step === lastFeedStep) return;
    lastFeedStep = step;
    feedVisibleCount = step;
    renderOrders();
});

// Кэш отфильтрованной ленты — чтобы скролл-хендлер не пересчитывал фильтры
let feedCache = null;

function renderOrders() {
    const taskList = document.getElementById("task-list");
    const countLabel = document.getElementById("task-count-label");
    const publishedOrders = getOrders().filter((order) => order.status !== "pending");
    updateHeaderStats();

    if (!publishedOrders.length) {
        feedCache = null;
        countLabel.textContent = "Скоро";
        taskList.innerHTML = `
            <div class="task-skeleton"><span></span><span></span><span></span></div>
            <div class="task-skeleton"><span></span><span></span><span></span></div>
            <div class="task-skeleton"><span></span><span></span><span></span></div>
        `;
        return;
    }

    const orders = applyFeedFilters(publishedOrders, "");
    countLabel.textContent = formatOrderCount(orders.length);

    if (!orders.length) {
        feedCache = null;
        taskList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⌕</div>
                <h3>Ничего не найдено</h3>
                <p>Попробуйте изменить фильтры или сбросить их.</p>
            </div>
        `;
        return;
    }

    feedCache = { orders };
    taskList.innerHTML = renderOrderCards(orders.slice(0, feedVisibleCount));
}

// Догрузка ленты: добавляет только новые карточки, не перерисовывая существующие
function appendFeedOrders(freshOrders) {
    if (!freshOrders.length) return;
    const taskList = document.getElementById("task-list");
    taskList.insertAdjacentHTML("beforeend", renderOrderCards(freshOrders));
}

// Обложки заказов: эмодзи-иконка по теме + фирменный градиент
const ORDER_COVERS = {
    "AI картинки": { icon: "🎨", tone: 1 },
    "АИ Видео": { icon: "🎬", tone: 2 },
    "АИ текст": { icon: "✍️", tone: 3 },
    "Телеграм бот": { icon: "🤖", tone: 4 },
    "пайтон код": { icon: "🐍", tone: 5 },
    "код": { icon: "💻", tone: 6 },
    "приложение": { icon: "📱", tone: 2 },
    "программа": { icon: "⚙️", tone: 6 },
    "парсер": { icon: "🔍", tone: 4 }
};
const COVER_FALLBACK_ICONS = ["✨", "🚀", "💡", "🎯", "🧩", "📌"];

function getOrderCover(order) {
    const known = ORDER_COVERS[order.topic];
    if (known) return known;
    const source = `${order.title || ""}${order.id || ""}`;
    const hash = source.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return {
        icon: COVER_FALLBACK_ICONS[hash % COVER_FALLBACK_ICONS.length],
        tone: (hash % 6) + 1
    };
}

function coverMarkup(order) {
    const cover = getOrderCover(order);
    return `<div class="order-cover tone-${cover.tone}" aria-hidden="true"><span>${cover.icon}</span></div>`;
}

function renderOrderCards(orders, reviews = getReviews()) {
    const users = getUsers();
    const currentUserEmail = getCurrentUser()?.email;
    return orders.map((order) => {
        const tags = String(order.tags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .map((tag) => `<span class="task-tag">${escapeHTML(tag)}</span>`)
            .join("");
        const author = users.find((user) => user.email === order.author);
        const authorName = author?.name || order.authorName || "Пользователь";
        const rating = formatRatingText(order.author, reviews);
        const authorLine = `
            <div class="task-author">Опубликовал: <span class="profile-link task-author-name" data-email="${escapeHTML(order.author)}">${escapeHTML(authorName)}</span>${rating ? ` <span class="rating-stars">${rating}</span>` : ""}</div>
        `;
        const favActive = currentUserEmail && isFavorite(order.id, currentUserEmail);

        return `
        <article class="task-card" data-order-id="${escapeHTML(order.id)}" tabindex="0" role="button" aria-label="Открыть задание: ${escapeHTML(order.title)}">
            ${coverMarkup(order)}
            <button type="button" class="fav-btn${favActive ? " active" : ""}" data-fav-id="${escapeHTML(order.id)}" aria-label="${favActive ? "Убрать из избранного" : "В избранное"}">${favActive ? "♥" : "♡"}</button>
            <div class="task-card-preview">
                <h3>${escapeHTML(order.title)}</h3>
                <p>${escapeHTML(order.description)}</p>
            </div>
            <div class="task-tags">
                <span class="task-topic">${escapeHTML(order.topic)}</span>
                ${tags}
            </div>
            <div class="task-meta">
                <span class="task-price">${Number(order.price).toLocaleString("ru-RU")} ₽</span>
                <span>${escapeHTML(order.extras || "Без доп. услуг")}</span>
            </div>
            ${order.deadline ? `<div class="task-deadline">Срок: ${formatDeadline(order.deadline)}</div>` : ""}
            ${authorLine}
        </article>
        `;
    }).join("");
}

function renderSearchResults(query) {
    const results = document.getElementById("search-results");
    const emptyState = document.getElementById("search-empty-state");
    const meta = document.getElementById("search-result-meta");
    const title = document.getElementById("search-empty-title");
    const text = document.getElementById("search-empty-text");
    const terms = tokenizeSearchQuery(query);
    const matches = applyFeedFilters(
        terms.length ? findMatchingOrders(query) : getOrders().filter((order) => order.status !== "pending"),
        "s-"
    );

    if (!matches.length) {
        results.classList.add("hidden");
        emptyState.classList.remove("hidden");
        meta.textContent = "";
        title.textContent = terms.length ? "Ничего не найдено" : "Нет подходящих заданий";
        text.textContent = terms.length
            ? "Все слова запроса должны совпасть с названием, темой, тегами или описанием. Возможно, мешают фильтры."
            : "Попробуйте изменить фильтры.";
        return;
    }

    emptyState.classList.add("hidden");
    results.classList.remove("hidden");
    meta.textContent = terms.length
        ? `${formatOrderCount(matches.length)} по запросу «${query.trim()}»`
        : `${formatOrderCount(matches.length)} заданий`;
    results.innerHTML = renderOrderCards(matches);
}

// Один делегированный слушатель вместо привязки к каждой карточке.
// Работает и для ленты, и для поиска, и для догруженных карточек.
function setupOrderCardDelegation() {
    document.addEventListener("click", (event) => {
        const favBtn = event.target.closest(".fav-btn[data-fav-id]");
        if (favBtn) {
            toggleFavorite(favBtn.dataset.favId);
            return;
        }
        const authorName = event.target.closest(".task-author-name[data-email]");
        if (authorName) {
            showPublicProfile(authorName.dataset.email);
            return;
        }
        const card = event.target.closest(".task-card[data-order-id]");
        if (card) showOrderDetails(card.dataset.orderId);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".task-card[data-order-id]");
        if (!card) return;
        event.preventDefault();
        showOrderDetails(card.dataset.orderId);
    });
}

setupOrderCardDelegation();

function updateOrderStep() {
    document.querySelectorAll(".order-step").forEach((step) => {
        step.classList.toggle("hidden", Number(step.dataset.step) !== orderStep);
    });
    document.getElementById("order-page-number").textContent = `${orderStep}/3`;
    document.getElementById("order-back").classList.toggle("hidden", orderStep === 1);
    document.getElementById("order-next").classList.toggle("hidden", orderStep === 3);
    document.getElementById("order-submit").classList.toggle("hidden", orderStep !== 3);
}

function validateOrderStep() {
    const form = document.getElementById("create-order-form");
    clearErrors(form);
    let valid = true;

    if (orderStep === 1) {
        if (!document.getElementById("order-title").value.trim()) {
            showError("error-order-title", "Введите название заказа");
            valid = false;
        }
        if (!document.getElementById("order-description").value.trim()) {
            showError("error-order-description", "Добавьте описание заказа");
            valid = false;
        }
    }

    if (orderStep === 2 && !document.getElementById("order-topic").value) {
        showError("error-order-topic", "Выберите тему заказа");
        valid = false;
    }

    if (orderStep === 3) {
        const price = Number(document.getElementById("order-price").value);
        const deadline = document.getElementById("order-deadline").value;
        if (!price || price < 1) {
            showError("error-order-price", "Укажите цену больше 0");
            valid = false;
        }
        if (!deadline) {
            showError("error-order-deadline", "Укажите срок выполнения");
            valid = false;
        } else if (deadline < new Date().toISOString().slice(0, 10)) {
            showError("error-order-deadline", "Срок не может быть в прошлом");
            valid = false;
        }
        if (!validateExtras()) valid = false;
    }

    return valid;
}

function closeOrderModal() {
    document.getElementById("create-order-modal").classList.add("hidden");
    document.getElementById("create-order-form").reset();
    setOrderMode("normal");
    setDeadlineValue("");
    resetExtras();
    orderStep = 1;
    editingOrderId = null;
    document.getElementById("create-order-eyebrow").textContent = "Новый заказ";
    document.getElementById("create-order-title").textContent = "Создать заказ";
    document.getElementById("order-submit").textContent = "Оплатить и отправить на проверку";
    updateOrderStep();
}

function openOrderModalForEdit(orderId) {
    const user = getCurrentUser();
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    if (!order || !user || order.author !== user.email || isOrderTaken(orderId)) return;

    editingOrderId = String(orderId);
    document.getElementById("order-title").value = order.title;
    document.getElementById("order-description").value = order.description;
    document.getElementById("order-topic").value = order.topic;
    document.getElementById("order-tags").value = order.tags || "";
    document.getElementById("order-price").value = order.price;
    setDeadlineValue(order.deadline || "");
    setOrderMode(order.responseMode === "responses" ? "responses" : "normal");
    resetExtras();
    orderStep = 1;
    updateOrderStep();
    document.getElementById("create-order-eyebrow").textContent = "Редактирование";
    document.getElementById("create-order-title").textContent = "Редактировать заказ";
    document.getElementById("order-submit").textContent = "Оплатить и отправить на проверку";
    document.getElementById("create-order-modal").classList.remove("hidden");
}

function deleteOwnOrder(orderId) {
    const user = getCurrentUser();
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    if (!order || !user || order.author !== user.email || isOrderTaken(orderId)) return;

    if (!confirm(`Удалить заказ «${order.title}»?`)) return;

    saveOrders(getOrders().filter((item) => String(item.id) !== String(orderId)));
    renderOrders();
    renderSearchResults(activeSearchQuery);

    const homeItem = document.querySelector('[data-screen="home-screen"]');
    switchScreen("home-screen", "Главный экран", homeItem);
}

// Регистрация
document.getElementById("register-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    clearErrors(form);

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;
    const password2 = form.elements.password2.value;
    const role = form.elements.role.value;
    let valid = true;

    if (name.length < 2) {
        showError("error-name", "Введите имя (минимум 2 символа)");
        valid = false;
    }
    if (!isValidEmail(email)) {
        showError("error-email", "Введите корректный email");
        valid = false;
    }
    if (password.length < 6) {
        showError("error-password", "Пароль должен быть минимум 6 символов");
        valid = false;
    }
    if (password !== password2) {
        showError("error-password2", "Пароли не совпадают");
        valid = false;
    }
    if (!valid) return;

    const users = getUsers();
    if (users.some((user) => user.email === email)) {
        showError("error-email", "Пользователь с таким email уже зарегистрирован");
        return;
    }

    users.push({ name, email, password, role, about: "", skills: "", registeredAt: Date.now() });
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, email);
    form.reset();
    showApp();
});

// Вход
document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    clearErrors(form);

    const email = form.elements["login-email"].value.trim().toLowerCase();
    const password = form.elements["login-password"].value;
    const user = getUsers().find((item) => item.email === email);

    if (!user || user.password !== password) {
        showError("error-login-password", "Неверный email или пароль");
        return;
    }

    localStorage.setItem(SESSION_KEY, email);
    form.reset();
    showApp();
});

// Переключение между регистрацией и входом
document.getElementById("show-login").addEventListener("click", (event) => {
    event.preventDefault();
    showCard("login-card");
});

document.getElementById("show-register").addEventListener("click", (event) => {
    event.preventDefault();
    showCard("register-card");
});

// Нижняя навигация
document.querySelectorAll(".nav-item:not(#open-create-order)").forEach((item) => {
    item.addEventListener("click", () => {
        switchScreen(item.dataset.screen, item.dataset.title, item);
        if (item.dataset.screen === "taken-orders-screen") renderTakenOrders();
        if (item.dataset.screen === "my-orders-screen") renderMyOrders();
        if (item.dataset.screen === "favorites-screen") renderFavorites();
        if (item.dataset.screen === "admin-screen") renderAdminPanel();
    });
});

document.getElementById("back-to-orders").addEventListener("click", () => {
    const homeItem = document.querySelector('[data-screen="home-screen"]');
    switchScreen("home-screen", "Главный экран", homeItem);
});

// Взять заказ или откликнуться (зависит от режима заказа)
document.getElementById("take-order-btn").addEventListener("click", (event) => {
    const orderId = event.currentTarget.dataset.orderId;
    if (!orderId) return;
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    if (order && order.responseMode === "responses") openResponseModal(orderId);
    else takeOrder(orderId);
});

// Отправить работу на проверку администратору (с материалами)
document.getElementById("complete-order-btn").addEventListener("click", (event) => {
    const orderId = event.currentTarget.dataset.orderId;
    if (orderId) openSubmitWorkModal(orderId);
});

// Отменить взятие заказа
document.getElementById("cancel-order-btn").addEventListener("click", (event) => {
    const orderId = event.currentTarget.dataset.orderId;
    if (orderId) cancelTakenOrder(orderId);
});

// Открыть публичный профиль автора заказа
document.getElementById("detail-author").addEventListener("click", (event) => {
    const email = event.currentTarget.dataset.email;
    if (email) showPublicProfile(email);
});

document.getElementById("back-from-public-profile").addEventListener("click", () => {
    const homeItem = document.querySelector('[data-screen="home-screen"]');
    switchScreen("home-screen", "Главный экран", homeItem);
});

// Редактирование профиля
document.getElementById("edit-profile-btn").addEventListener("click", () => {
    const user = getCurrentUser();
    if (!user) return;
    document.getElementById("profile-edit-name").value = user.name;
    document.getElementById("profile-edit-about").value = user.about || "";
    document.getElementById("profile-edit-skills").value = user.skills || "";
    document.getElementById("error-profile-edit-name").textContent = "";
    document.getElementById("edit-profile-modal").classList.remove("hidden");
});

document.getElementById("edit-profile-cancel").addEventListener("click", () => {
    document.getElementById("edit-profile-modal").classList.add("hidden");
});

document.getElementById("edit-profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("profile-edit-name").value.trim();
    if (name.length < 2) {
        showError("error-profile-edit-name", "Имя должно быть минимум 2 символа");
        return;
    }

    const user = getCurrentUser();
    const users = getUsers();
    const account = users.find((item) => item.email === user.email);
    account.name = name;
    account.about = document.getElementById("profile-edit-about").value.trim();
    account.skills = document.getElementById("profile-edit-skills").value.trim();
    saveUsers(users);

    document.getElementById("edit-profile-modal").classList.add("hidden");
    const firstLetter = name.charAt(0).toUpperCase();
    document.getElementById("header-avatar").textContent = firstLetter;
    document.getElementById("profile-avatar").textContent = firstLetter;
    document.getElementById("profile-name").textContent = name;
});

// Отзывы
document.querySelectorAll("#stars-input button").forEach((star) => {
    star.addEventListener("click", () => {
        document.querySelectorAll("#stars-input button").forEach((item) => {
            item.classList.toggle("active", Number(item.dataset.star) <= Number(star.dataset.star));
        });
    });
});

document.getElementById("review-cancel").addEventListener("click", () => {
    document.getElementById("review-modal").classList.add("hidden");
});

document.getElementById("review-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const user = getCurrentUser();
    const selected = document.querySelectorAll("#stars-input button.active");
    if (!reviewTarget || !user) return;

    if (!selected.length) {
        showError("error-review-rating", "Поставьте оценку от 1 до 5 звёзд");
        return;
    }

    const completed = getCompletedOrders().find((item) => String(item.id) === String(reviewTarget.orderId));
    if (!completed) return;

    const review = {
        orderId: reviewTarget.orderId,
        orderTitle: completed.title,
        author: user.email,
        authorName: user.name,
        rating: Number(selected.length),
        text: document.getElementById("review-text").value.trim(),
        createdAt: Date.now()
    };
    if (reviewTarget.mode === "customer") {
        review.customer = reviewTarget.targetEmail;
    } else {
        review.contractor = reviewTarget.targetEmail;
    }

    const reviews = getReviews();
    reviews.unshift(review);
    saveReviews(reviews);

    addNotification(
        reviewTarget.targetEmail,
        `${user.name} оставил отзыв о вас по заказу «${completed.title}»: ${"★".repeat(selected.length)}`,
        reviewTarget.orderId
    );

    reviewTarget = null;
    document.getElementById("review-modal").classList.add("hidden");
    renderMyOrders();
    renderTakenOrders();
});

// Переключатель режима заказа (обычный / отклики)
document.querySelectorAll("#order-mode-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => setOrderMode(btn.dataset.mode));
});

// Табы «Заказы / История» в «Моих заказах»
document.querySelectorAll("[data-my-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setMyOrdersTab(btn.dataset.myTab));
});

// Фильтры в админ-панели
document.getElementById("admin-user-search").addEventListener("input", (event) => {
    adminUsersQuery = event.target.value.trim();
    renderAdminUsers(getCurrentUser().email);
});

document.getElementById("admin-user-role-filter").addEventListener("change", (event) => {
    adminUsersRole = event.target.value;
    renderAdminUsers(getCurrentUser().email);
});

document.getElementById("admin-order-search").addEventListener("input", (event) => {
    adminOrdersQuery = event.target.value.trim();
    renderAdminOrders();
});

document.getElementById("admin-order-status-filter").addEventListener("change", (event) => {
    adminOrdersStatus = event.target.value;
    renderAdminOrders();
});

// Отклики
document.getElementById("response-cancel").addEventListener("click", () => {
    document.getElementById("response-modal").classList.add("hidden");
});

document.getElementById("response-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const message = document.getElementById("response-text").value.trim();
    if (message.length < 10) {
        showError("error-response-text", "Напишите, почему вы справитесь (минимум 10 символов)");
        return;
    }
    if (!responseOrderId || !sendOrderResponse(responseOrderId, message)) return;

    responseOrderId = null;
    document.getElementById("response-modal").classList.add("hidden");
});

document.getElementById("responses-list-close").addEventListener("click", () => {
    document.getElementById("responses-list-modal").classList.add("hidden");
});

document.getElementById("responses-list").addEventListener("click", (event) => {
    const acceptBtn = event.target.closest("[data-accept]");
    const rejectBtn = event.target.closest("[data-reject]");
    const authorBtn = event.target.closest(".response-author");

    if (acceptBtn) {
        acceptResponse(responsesListOrderId, acceptBtn.dataset.accept);
        renderResponsesList();
    } else if (rejectBtn) {
        rejectResponse(responsesListOrderId, rejectBtn.dataset.reject);
        renderResponsesList();
    } else if (authorBtn && authorBtn.dataset.email) {
        document.getElementById("responses-list-modal").classList.add("hidden");
        showPublicProfile(authorBtn.dataset.email);
    }
});

// Сдача работы с материалами
let submitWorkOrderId = null;
let pendingSubmitFiles = [];

function openSubmitWorkModal(orderId) {
    const order = getOrders().find((item) => String(item.id) === String(orderId));
    const record = findOwnTakenRecord(orderId, "active");
    if (!order || !record || record.submitRequested) return;

    submitWorkOrderId = orderId;
    pendingSubmitFiles = [];
    document.getElementById("submit-work-order-name").textContent = `Заказ «${order.title}» — ${Number(order.price || 0).toLocaleString("ru-RU")} ₽`;
    document.getElementById("submit-work-message").value = "";
    document.getElementById("error-submit-files").textContent = "";
    renderPendingSubmitFiles();
    document.getElementById("submit-work-modal").classList.remove("hidden");
}

function renderPendingSubmitFiles() {
    const list = document.getElementById("submit-files-list");
    list.innerHTML = pendingSubmitFiles.map((file, index) => `
        <div class="pending-file">
            <span class="submit-file-name">${escapeHTML(file.name)}</span>
            <span class="submit-file-size">${formatFileSize(file.size)}</span>
            <button type="button" class="pending-file-remove" data-index="${index}" aria-label="Убрать файл">×</button>
        </div>
    `).join("");
    list.classList.toggle("hidden", !pendingSubmitFiles.length);
}

function addPickedFiles(fileList) {
    const existing = new Set(pendingSubmitFiles.map((file) => file.name));
    Array.from(fileList).forEach((file) => {
        if (!existing.has(file.name)) pendingSubmitFiles.push(file);
    });
    document.getElementById("error-submit-files").textContent = "";
    renderPendingSubmitFiles();
}

document.getElementById("submit-files-pick").addEventListener("click", () => {
    document.getElementById("submit-files-input").click();
});

document.getElementById("submit-folder-pick").addEventListener("click", () => {
    document.getElementById("submit-folder-input").click();
});

document.getElementById("submit-files-input").addEventListener("change", (event) => {
    addPickedFiles(event.target.files);
    event.target.value = "";
});

document.getElementById("submit-folder-input").addEventListener("change", (event) => {
    addPickedFiles(event.target.files);
    event.target.value = "";
});

document.getElementById("submit-files-list").addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".pending-file-remove");
    if (!removeBtn) return;
    pendingSubmitFiles.splice(Number(removeBtn.dataset.index), 1);
    renderPendingSubmitFiles();
});

document.getElementById("submit-work-cancel").addEventListener("click", () => {
    document.getElementById("submit-work-modal").classList.add("hidden");
});

document.getElementById("submit-work-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!submitWorkOrderId) return;

    const message = document.getElementById("submit-work-message").value.trim();
    if (!pendingSubmitFiles.length && message.length < 5) {
        showError("error-submit-files", "Прикрепите файлы или напишите, что сделано");
        return;
    }

    const totalBytes = pendingSubmitFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > SUBMIT_MAX_TOTAL_BYTES) {
        showError("error-submit-files", `Суммарный объём больше 3 МБ (${formatFileSize(totalBytes)})`);
        return;
    }

    const readAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    try {
        const files = [];
        for (const file of pendingSubmitFiles) {
            files.push({ name: file.name, size: file.size, type: file.type, dataUrl: await readAsDataUrl(file) });
        }
        if (!submitOrderForReview(submitWorkOrderId, message, files)) return;
    } catch {
        showError("error-submit-files", "Не удалось прочитать файлы, попробуйте ещё раз");
        return;
    }

    submitWorkOrderId = null;
    pendingSubmitFiles = [];
    document.getElementById("submit-work-modal").classList.add("hidden");
});

// Просмотр материалов выполненного заказа
function openSubmissionModal(orderId) {
    const order = getCompletedOrders().find((item) => String(item.id) === String(orderId));
    if (!order || !order.submission) return;

    document.getElementById("submission-order-name").textContent = `Заказ «${order.title}» — исполнитель ${order.contractorName || order.contractor}`;
    const messageEl = document.getElementById("submission-message");
    messageEl.textContent = order.submission.message || "Комментарий не оставлен";
    messageEl.classList.toggle("hidden", !order.submission.message);
    document.getElementById("submission-files").innerHTML = submissionFilesMarkup(order.submission.files);
    document.getElementById("submission-modal").classList.remove("hidden");
}

document.getElementById("submission-close").addEventListener("click", () => {
    document.getElementById("submission-modal").classList.add("hidden");
});

// Уведомления
document.getElementById("notifications-btn").addEventListener("click", () => {
    renderNotifications();
    document.getElementById("notifications-modal").classList.remove("hidden");
    const user = getCurrentUser();
    if (user) {
        markAllNotificationsRead(user.email);
        updateNotificationsBadge();
    }
});

document.getElementById("notifications-close").addEventListener("click", () => {
    document.getElementById("notifications-modal").classList.add("hidden");
});

document.getElementById("notifications-modal").addEventListener("click", (event) => {
    if (event.target.id === "notifications-modal") {
        document.getElementById("notifications-modal").classList.add("hidden");
    }
});

// Поиск на главном экране открывает экран поиска
document.getElementById("home-search").addEventListener("focus", () => {
    const searchItem = document.querySelector('[data-screen="search-screen"]');
    switchScreen("search-screen", "Поиск заданий", searchItem);
    const searchInput = document.getElementById("search-screen-input");
    searchInput.value = document.getElementById("home-search").value;
    activeSearchQuery = searchInput.value;
    renderSearchResults(activeSearchQuery);
    searchInput.focus();
});

document.getElementById("home-search").addEventListener("input", (event) => {
    activeSearchQuery = event.target.value;
});

document.getElementById("search-screen-input").addEventListener("input", (event) => {
    activeSearchQuery = event.target.value;
    document.getElementById("home-search").value = activeSearchQuery;
    renderSearchResults(activeSearchQuery);
});

// Открытие окна создания заказа
document.getElementById("open-create-order").addEventListener("click", () => {
    orderStep = 1;
    updateOrderStep();
    document.getElementById("create-order-modal").classList.remove("hidden");
});

document.getElementById("order-next").addEventListener("click", () => {
    if (!validateOrderStep()) return;
    orderStep += 1;
    updateOrderStep();
});

document.getElementById("order-back").addEventListener("click", () => {
    orderStep -= 1;
    updateOrderStep();
});

document.getElementById("create-order-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateOrderStep()) return;

    const user = getCurrentUser();
    const payload = {
        title: document.getElementById("order-title").value.trim(),
        description: document.getElementById("order-description").value.trim(),
        topic: document.getElementById("order-topic").value,
        tags: document.getElementById("order-tags").value.trim(),
        price: Number(document.getElementById("order-price").value),
        deadline: document.getElementById("order-deadline").value,
        extras: formatExtras(collectExtras()),
        responseMode: getSelectedOrderMode()
    };

    if (editingOrderId) {
        const orders = getOrders();
        const order = orders.find((item) => String(item.id) === String(editingOrderId));
        if (!order || order.author !== user.email) {
            closeOrderModal();
            return;
        }
        Object.assign(order, payload);
        order.status = "pending";
        saveOrders(orders);
        addNotification(
            user.email,
            `Изменения в заказе «${order.title}» отправлены на проверку администратору.`,
            order.id
        );
        notifyAdmins(`Заказ «${order.title}» отредактирован и ожидает повторной проверки.`, order.id);
        closeOrderModal();
        renderOrders();
        renderSearchResults(activeSearchQuery);
        const homeItem = document.querySelector('[data-screen="home-screen"]');
        switchScreen("home-screen", "Главный экран", homeItem);
        return;
    }

    const orders = getOrders();
    const newOrder = {
        id: Date.now(),
        ...payload,
        author: user.email,
        authorName: user.name,
        createdAt: Date.now(),
        status: "pending"
    };
    orders.unshift(newOrder);
    saveOrders(orders);

    addNotification(
        user.email,
        `Заказ «${newOrder.title}» оплачен и отправлен на проверку администратору.`,
        newOrder.id
    );
    notifyAdmins(`Новый заказ «${newOrder.title}» от ${user.name} ожидает проверки.`, newOrder.id);

    closeOrderModal();
    renderOrders();
    renderSearchResults(activeSearchQuery);
});

// Редактирование и удаление своего заказа
document.getElementById("edit-order-btn").addEventListener("click", (event) => {
    const orderId = event.currentTarget.dataset.orderId;
    if (orderId) openOrderModalForEdit(orderId);
});

document.getElementById("delete-order-btn").addEventListener("click", (event) => {
    const orderId = event.currentTarget.dataset.orderId;
    if (orderId) deleteOwnOrder(orderId);
});

// Вкладки админ-панели
document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach((item) => {
            item.classList.toggle("active", item === tab);
        });
        document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
            panel.classList.toggle("hidden", panel.id !== `admin-tab-${tab.dataset.adminTab}`);
        });
    });
});

document.getElementById("add-extra").addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "extra-row";
    row.innerHTML = `
        <input type="text" class="extra-name" maxlength="40" placeholder="Например, сделать за 1 день">
        <input type="number" class="extra-price" min="1" max="5000" placeholder="Цена, ₽">
    `;
    document.getElementById("extras-list").appendChild(row);
});

// Выход из аккаунта
document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    showCard("register-card");
});

document.getElementById("create-order-modal").addEventListener("click", (event) => {
    if (event.target.id === "create-order-modal") closeOrderModal();
});

// Фильтры ленты и поиска
(function initFeedFilters() {
    const topicOptions = [...document.querySelectorAll("#order-topic option")]
        .filter((option) => option.value);

    ["", "s-"].forEach((prefix) => {
        const topicSelect = document.getElementById(`${prefix}filter-topic`);
        topicOptions.forEach((option) => {
            const item = document.createElement("option");
            item.value = option.value;
            item.textContent = option.textContent;
            topicSelect.appendChild(item);
        });

        [`${prefix}filter-topic`, `${prefix}filter-price-min`, `${prefix}filter-price-max`, `${prefix}filter-sort`]
            .forEach((id) => {
                document.getElementById(id).addEventListener("input", () => {
                    if (prefix === "") feedVisibleCount = currentFeedStep();
                    renderOrders();
                    renderSearchResults(activeSearchQuery);
                });
            });

        document.getElementById(`${prefix}filter-reset`).addEventListener("click", () => {
            document.getElementById(`${prefix}filter-topic`).value = "";
            document.getElementById(`${prefix}filter-price-min`).value = "";
            document.getElementById(`${prefix}filter-price-max`).value = "";
            document.getElementById(`${prefix}filter-sort`).value = prefix === "" ? "new" : "relevance";
            if (prefix === "") feedVisibleCount = currentFeedStep();
            renderOrders();
            renderSearchResults(activeSearchQuery);
        });
    });

    // Подгрузка заданий в ленте: долистал до конца — добавились новые (до 50).
    // Троттлинг через requestAnimationFrame + кэш фильтрации — без пересчётов на каждый тик.
    const homeScreen = document.getElementById("home-screen");
    let feedScrollTicking = false;
    homeScreen.addEventListener("scroll", () => {
        if (feedScrollTicking) return;
        feedScrollTicking = true;
        requestAnimationFrame(() => {
            feedScrollTicking = false;
            if (homeScreen.scrollTop + homeScreen.clientHeight < homeScreen.scrollHeight - 40) return;
            if (!feedCache) return;

            const target = Math.min(feedCache.orders.length, FEED_MAX);
            if (feedVisibleCount >= target) return;

            const prevCount = feedVisibleCount;
            feedVisibleCount = Math.min(feedVisibleCount + currentFeedStep(), target);
            appendFeedOrders(feedCache.orders.slice(prevCount, feedVisibleCount));
        });
    });
})();

// Демо-заказы для тестирования (добавляются один раз)
function seedDemoOrders() {
    const SEED_KEY = "birga_seed_v1";
    if (localStorage.getItem(SEED_KEY)) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const demoOrders = [
        {
            title: "Нарисовать 10 аватарок в едином стиле",
            description: "Нужны аватарки для соцсетей в минималистичном стиле. Пришлите примеры работ, срок — неделя.",
            topic: "AI картинки", tags: "аватарки, стиль, соцсети", price: 1500,
            extras: "Сделать за 3 дня — +800 ₽", author: "olga@example.com", authorName: "Ольга",
            createdAt: now - day
        },
        {
            title: "Обложки для YouTube-канала, 5 штук",
            description: "Канал про технологии. Нужны яркие кликабельные обложки в одном стиле.",
            topic: "AI картинки", tags: "youtube, обложки, дизайн", price: 2500,
            extras: "Без доп. услуг", author: "dmitry@example.com", authorName: "Дмитрий",
            createdAt: now - 2 * day
        },
        {
            title: "Рекламный ролик 30 секунд",
            description: "Ролик для продвижения кофейни в соцсетях. Есть логотип и фото, нужен монтаж и озвучка.",
            topic: "АИ Видео", tags: "видео, реклама, монтаж", price: 5000,
            extras: "Озвучка голосом — +1500 ₽", author: "anna@example.com", authorName: "Анна",
            createdAt: now - 3 * day
        },
        {
            title: "Анимированная заставка для стрима",
            description: "Нужна короткая анимированная заставка 5–7 секунд для Twitch-канала.",
            topic: "АИ Видео", tags: "twitch, анимация, заставка", price: 3500,
            extras: "Без доп. услуг", author: "maksim@example.com", authorName: "Максим",
            createdAt: now - 4 * day
        },
        {
            title: "10 статей для блога о путешествиях",
            description: "Статьи по 5–7 тысяч знаков, уникальные, SEO-дружелюбные. Темы подскажем.",
            topic: "АИ текст", tags: "тексты, блог, seo", price: 4000,
            extras: "Подбор картинок — +500 ₽", author: "olga@example.com", authorName: "Ольга",
            createdAt: now - 5 * day
        },
        {
            title: "Описания для 50 товаров магазина",
            description: "Интернет-магазин товаров для дома. Нужны продающие описания по 800–1000 знаков.",
            topic: "АИ текст", tags: "описания, копирайтинг, магазин", price: 3000,
            extras: "Без доп. услуг", author: "sergey@example.com", authorName: "Сергей",
            createdAt: now - 6 * day
        },
        {
            title: "Телеграм-бот магазин с оплатой",
            description: "Бот-магазин: каталог товаров, корзина, приём оплат, уведомления о заказах.",
            topic: "Телеграм бот", tags: "телеграм, бот, магазин", price: 12000,
            extras: "Деплой на сервер — +2000 ₽", author: "dmitry@example.com", authorName: "Дмитрий",
            createdAt: now - 7 * day
        },
        {
            title: "Бот-рассылка для канала",
            description: "Нужен бот для массовых рассылок подписчикам с отложенным запуском и статистикой.",
            topic: "Телеграм бот", tags: "телеграм, рассылка", price: 4500,
            extras: "Без доп. услуг", author: "anna@example.com", authorName: "Анна",
            createdAt: now - 8 * day
        },
        {
            title: "Скрипт автоматизации отчётов Excel",
            description: "Каждую неделю собираем данные из 5 файлов в один отчёт. Нужен скрипт на Python.",
            topic: "пайтон код", tags: "python, excel, автоматизация", price: 2000,
            extras: "Сделать за 1 день — +1000 ₽", author: "sergey@example.com", authorName: "Сергей",
            createdAt: now - 9 * day
        },
        {
            title: "Парсер товаров с маркетплейса",
            description: "Собирать названия, цены и рейтинги товаров, выгружать в таблицу. Обновление раз в сутки.",
            topic: "парсер", tags: "парсер, маркетплейс, данные", price: 6000,
            extras: "Без доп. услуг", author: "maksim@example.com", authorName: "Максим",
            createdAt: now - 10 * day
        },
        {
            title: "Правки на сайте (HTML/CSS)",
            description: "Поправить вёрстку на 3 страницах: съезжают блоки на мобильных, надо адаптив.",
            topic: "код", tags: "html, css, вёрстка", price: 1800,
            extras: "Без доп. услуг", author: "olga@example.com", authorName: "Ольга",
            createdAt: now - 11 * day
        },
        {
            title: "Сверстать лендинг по макету",
            description: "Есть макет в Figma, 5 блоков. Нужен адаптивный лендинг без конструкторов.",
            topic: "код", tags: "лендинг, вёрстка, figma", price: 8000,
            extras: "Подключение формы — +1000 ₽", author: "dmitry@example.com", authorName: "Дмитрий",
            createdAt: now - 12 * day
        },
        {
            title: "Приложение-заметки для Android",
            description: "Простое приложение: создание заметок, напоминания, тёмная тема. Дизайн есть.",
            topic: "приложение", tags: "android, мобильное, заметки", price: 15000,
            extras: "Публикация в Google Play — +3000 ₽", author: "anna@example.com", authorName: "Анна",
            createdAt: now - 13 * day
        },
        {
            title: "Программа для массового переименования файлов",
            description: "Нужна программа с простым интерфейсом: переименование тысяч файлов по шаблону.",
            topic: "программа", tags: "утилита, файлы, программа", price: 2500,
            extras: "Без доп. услуг", author: "sergey@example.com", authorName: "Сергей",
            createdAt: now - 14 * day
        },
        {
            title: "Парсер цен конкурентов",
            description: "Ежедневный сбор цен по списку сайтов конкурентов с отчётом на почту.",
            topic: "парсер", tags: "парсер, цены, отчёты", price: 6500,
            extras: "Отчёт в Telegram — +1500 ₽", author: "maksim@example.com", authorName: "Максим",
            createdAt: now - 15 * day
        }
    ];

    const orders = getOrders();
    demoOrders.forEach((demo, index) => {
        if (orders.some((order) => order.title === demo.title)) return;
        orders.unshift({
            id: now - index,
            ...demo,
            deadline: demo.deadline || new Date(now + (index + 3) * day).toISOString().slice(0, 10),
            status: "published"
        });
    });
    saveOrders(orders);
    localStorage.setItem(SEED_KEY, "1");
}

seedDemoOrders();

if (localStorage.getItem(SESSION_KEY)) {
    showApp();
}
