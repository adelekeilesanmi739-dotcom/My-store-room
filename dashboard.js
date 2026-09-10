let currentUserId = null;

// This runs as soon as the page loads, before showing anything.
async function checkLogin() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (!data.session) {
        // Nobody is logged in — send them to the login page.
        window.location.href = "login.html";
        return;
    }

    currentUserId = data.session.user.id;

    // Show their email in the sidebar.
    const userEmail = document.getElementById("userEmail");
    userEmail.textContent = data.session.user.email;

       // Load everything saved about this user.
    await loadProfile();
    await loadProducts();
    await loadConversations();
}

checkLogin();

// =========================
// LOAD PROFILE (product type + business info)
// =========================

async function loadProfile() {

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("product_type, business_name, business_description, store_slug")
        .eq("id", currentUserId)
        .maybeSingle();

    // --- Product type section ---
    const productSelection = document.getElementById("productSelection");
    const currentSelection = document.getElementById("currentSelection");
    const selectedTypeText = document.getElementById("selectedTypeText");

    if (data && data.product_type) {
        selectedTypeText.textContent = data.product_type;
        currentSelection.style.display = "block";
        productSelection.style.display = "none";
    } else {
        currentSelection.style.display = "none";
        productSelection.style.display = "block";
    }

    // --- Business info form (pre-fill if already saved) ---
    if (data && data.business_name) {
        document.getElementById("businessName").value = data.business_name;
    }
    if (data && data.business_description) {
        document.getElementById("businessDescription").value = data.business_description;
    }
        if (data && data.store_slug) {
        document.getElementById("storeSlug").value = data.store_slug;
        showStoreLinkPreview(data.store_slug);
    }

    // --- Overview section ---
    const overviewBusinessName = document.querySelector("#overviewBusinessName span");
    const overviewProductType = document.querySelector("#overviewProductType span");

    overviewBusinessName.textContent =
        (data && data.business_name) ? data.business_name : "Not set yet";

        overviewProductType.textContent =
        (data && data.product_type) ? data.product_type : "Not set yet";

    const overviewStoreLink = document.getElementById("overviewStoreLink");

    if (data && data.store_slug) {
        const url = `store.html?store=${data.store_slug}`;
        overviewStoreLink.innerHTML = `<strong>Storefront:</strong> <a href="${url}" target="_blank">View My Storefront</a>`;
        overviewStoreLink.style.display = "block";
    } else {
        overviewStoreLink.style.display = "none";
    }
}    

// =========================
// SAVE PRODUCT TYPE (when a card is clicked)
// =========================

const productOptions = document.querySelectorAll(".product-type-option");

productOptions.forEach((card) => {

    card.addEventListener("click", async () => {

        const chosenType = card.getAttribute("data-type");

        const { error } = await supabaseClient
            .from("profiles")
            .upsert({ id: currentUserId, product_type: chosenType });

        if (error) {
            alert("Something went wrong saving your choice: " + error.message);
            return;
        }

        await loadProfile();
    });

});

// =========================
// "CHANGE" BUTTON (product type)
// =========================

const changeSelectionButton = document.getElementById("changeSelectionButton");

changeSelectionButton.addEventListener("click", () => {
    document.getElementById("currentSelection").style.display = "none";
    document.getElementById("productSelection").style.display = "block";
});

// =========================
// SAVE BUSINESS INFO
// =========================

const businessForm = document.getElementById("businessForm");
// Auto-suggest a store URL slug as the user types a business name,
// but only if they haven't already typed their own slug.
const businessNameInput = document.getElementById("businessName");
const storeSlugInput = document.getElementById("storeSlug");

businessNameInput.addEventListener("input", () => {

    if (storeSlugInput.dataset.userEdited === "true") {
        return;
    }

    const suggestion = businessNameInput.value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");

    storeSlugInput.value = suggestion;
});


businessForm.addEventListener("submit", async (e) => {

// If the user manually edits the slug themselves, stop auto-suggesting.
storeSlugInput.addEventListener("input", () => {
    storeSlugInput.dataset.userEdited = "true";
});
    e.preventDefault();

    const businessName = document.getElementById("businessName").value;
    const businessDescription = document.getElementById("businessDescription").value;
    const storeSlug = document.getElementById("storeSlug").value.trim();
    const businessMessage = document.getElementById("businessMessage");

    // Validate the slug format: lowercase letters, numbers, and dashes only
    const slugPattern = /^[a-z0-9-]+$/;

    if (storeSlug && !slugPattern.test(storeSlug)) {
        businessMessage.textContent =
            "Store URL can only contain lowercase letters, numbers, and dashes (no spaces).";
        return;
    }

    businessMessage.textContent = "Saving...";

    const { error } = await supabaseClient
        .from("profiles")
        .upsert({
            id: currentUserId,
            business_name: businessName,
            business_description: businessDescription,
            store_slug: storeSlug || null
        });

    if (error) {
        if (error.code === "23505") {
            businessMessage.textContent =
                "That store URL is already taken — please choose a different one.";
        } else {
            businessMessage.textContent = "Something went wrong: " + error.message;
        }
        return;
    }

    businessMessage.textContent = "Saved!";

    if (storeSlug) {
        showStoreLinkPreview(storeSlug);
    }

    await loadProfile();
});


function showStoreLinkPreview(slug) {
    const preview = document.getElementById("storeLinkPreview");
    const url = `store.html?store=${slug}`;
    preview.innerHTML = `Your public store link: <a href="${url}" target="_blank">${url}</a>`;
}

// =========================
// PRODUCTS
// =========================

let loadedProducts = [];
let editingProductId = null;

async function loadProducts() {

    const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, price, description, image_url")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

    loadedProducts = data || [];

    const productList = document.getElementById("productList");
    productList.innerHTML = "";

    if (error) {
        productList.textContent = "Couldn't load products right now.";
        return;
    }

    if (!data || data.length === 0) {
        productList.innerHTML = "<p>No products added yet.</p>";
        return;
    }

    data.forEach((product) => {

        const item = document.createElement("div");
        item.className = "product-item";

        const priceText = product.price !== null
            ? `$${Number(product.price).toFixed(2)}`
            : "";

        const imageHtml = product.image_url
            ? `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" style="width: 100%; max-width: 300px; height: auto; border-radius: 10px; margin-top: 12px; display: block;">`
            : "";

        item.innerHTML = `
            <div class="product-item-info" style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4>${escapeHtml(product.name)}</h4>
                        <p>${escapeHtml(product.description || "")}</p>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                        <span class="product-item-price">${priceText}</span>
                        <div style="display: flex; gap: 8px;">
                            <button class="product-delete-button" data-id="${product.id}" data-action="edit">Edit</button>
                            <button class="product-delete-button" data-id="${product.id}" data-action="delete">Delete</button>
                        </div>
                    </div>
                </div>
                ${imageHtml}
            </div>
        `;

        productList.appendChild(item);
    });

    // Wire up all the edit/delete buttons we just created.
    document.querySelectorAll(".product-delete-button").forEach((button) => {
        button.addEventListener("click", async () => {
            const productId = button.getAttribute("data-id");
            const action = button.getAttribute("data-action");

            if (action === "edit") {
                startEditingProduct(productId);
            } else {
                await deleteProduct(productId);
            }
        });
    });
}

// Very small helper to avoid raw user text breaking the page layout.
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

const productForm = document.getElementById("productForm");
const productSubmitButton = document.getElementById("productSubmitButton");
const cancelEditButton = document.getElementById("cancelEditButton");

function startEditingProduct(productId) {

    const product = loadedProducts.find((p) => p.id === productId);
    if (!product) return;

    editingProductId = productId;

    document.getElementById("productName").value = product.name;
    document.getElementById("productPrice").value = product.price !== null ? product.price : "";
    document.getElementById("productDescription").value = product.description || "";
    // Note: file inputs can't be pre-filled for security reasons —
    // the existing image stays unless the user chooses a new file.

    productSubmitButton.textContent = "Update Product";
    cancelEditButton.style.display = "inline-block";

    document.getElementById("productForm").scrollIntoView({ behavior: "smooth" });
}

function stopEditingProduct() {
    editingProductId = null;
    productForm.reset();
    productSubmitButton.textContent = "Add Product";
    cancelEditButton.style.display = "none";
}

cancelEditButton.addEventListener("click", stopEditingProduct);

productForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const name = document.getElementById("productName").value;
    const priceValue = document.getElementById("productPrice").value;
    const description = document.getElementById("productDescription").value;
    const imageFile = document.getElementById("productImage").files[0];
    const productMessage = document.getElementById("productMessage");

    const price = priceValue ? parseFloat(priceValue) : null;

    let imageUrl = null;

    if (imageFile) {

        productMessage.textContent = "Uploading image...";

        // Path MUST start with the user's own ID to match our storage policy.
        const filePath = `${currentUserId}/${Date.now()}-${imageFile.name}`;

        const { error: uploadError } = await supabaseClient
            .storage
            .from("product-images")
            .upload(filePath, imageFile);

        if (uploadError) {
            productMessage.textContent = "Image upload failed: " + uploadError.message;
            return;
        }

        const { data: publicUrlData } = supabaseClient
            .storage
            .from("product-images")
            .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
    }

    if (editingProductId) {

        productMessage.textContent = "Updating...";

        const updateData = {
            name: name,
            price: price,
            description: description
        };

        // Only overwrite the image if the user picked a new one.
        if (imageUrl) {
            updateData.image_url = imageUrl;
        }

        const { error } = await supabaseClient
            .from("products")
            .update(updateData)
            .eq("id", editingProductId);

        if (error) {
            productMessage.textContent = "Something went wrong: " + error.message;
            return;
        }

        productMessage.textContent = "Product updated!";
        stopEditingProduct();
        await loadProducts();

    } else {

        productMessage.textContent = "Adding...";

        const { error } = await supabaseClient
            .from("products")
            .insert({
                user_id: currentUserId,
                name: name,
                price: price,
                description: description,
                image_url: imageUrl
            });

        if (error) {
            productMessage.textContent = "Something went wrong: " + error.message;
            return;
        }

        productMessage.textContent = "Product added!";
        productForm.reset();
        await loadProducts();
    }
});

async function deleteProduct(productId) {

    const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", productId);

    if (error) {
        alert("Couldn't delete this product: " + error.message);
        return;
    }

    // If you were editing the product you just deleted, exit edit mode.
    if (editingProductId === productId) {
        stopEditingProduct();
    }

    await loadProducts();
}


// =========================
// MESSAGES (live chat)
// =========================
 
let currentDashboardConversationId = null;
let dashboardChatChannel = null;
let myConversationIds = [];
let badgeChannel = null;
 
async function loadConversations() {
 
    const { data, error } = await supabaseClient
        .from("conversations")
        .select("id, visitor_name, created_at")
        .eq("business_id", currentUserId)
        .order("created_at", { ascending: false });
 
    const conversationsList = document.getElementById("conversationsList");
    conversationsList.innerHTML = "";
 
    if (error || !data || data.length === 0) {
        conversationsList.innerHTML = "<p>No conversations yet.</p>";
        myConversationIds = [];
        updateUnreadBadge();
        return;
    }
 
    myConversationIds = data.map((c) => c.id);
 
    data.forEach((conversation) => {
 
        const item = document.createElement("div");
        item.className = "who-card";
        item.style.cursor = "pointer";
        item.style.marginBottom = "10px";
 
        const dateText = new Date(conversation.created_at).toLocaleString();
 
        item.innerHTML = `
            <h4 style="margin: 0 0 5px;">${escapeHtml(conversation.visitor_name || "Visitor")}</h4>
            <p style="font-size: 12px; color: #999; margin: 0;">${dateText}</p>
        `;
 
        item.addEventListener("click", () => {
            openDashboardConversation(conversation.id, conversation.visitor_name || "Visitor");
        });
 
        conversationsList.appendChild(item);
    });
 
    await updateUnreadBadge();
    subscribeToBadgeUpdates();
}
 
async function updateUnreadBadge() {
 
    const badge = document.getElementById("messagesBadge");
 
    if (myConversationIds.length === 0) {
        badge.style.display = "none";
        return;
    }
 
    const { count, error } = await supabaseClient
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_type", "visitor")
        .eq("read", false)
        .in("conversation_id", myConversationIds);
 
    if (error || !count) {
        badge.style.display = "none";
        return;
    }
 
    badge.textContent = count;
    badge.style.display = "inline-block";
}
 
function subscribeToBadgeUpdates() {
 
    if (badgeChannel) {
        supabaseClient.removeChannel(badgeChannel);
    }
 
    badgeChannel = supabaseClient
        .channel("badge-updates")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "chat_messages",
                filter: "sender_type=eq.visitor"
            },
            (payload) => {
                if (myConversationIds.includes(payload.new.conversation_id)) {
                    updateUnreadBadge();
                }
            }
        )
        .subscribe();
}
 
async function openDashboardConversation(conversationId, visitorName) {
 
    currentDashboardConversationId = conversationId;
 
    document.getElementById("dashboardChatWindow").style.display = "block";
    document.getElementById("chatWithName").textContent = "Chat with " + visitorName;
 
    const chatMessagesDiv = document.getElementById("dashboardChatMessages");
    chatMessagesDiv.innerHTML = "";
 
    // Load the existing message history for this conversation.
    const { data, error } = await supabaseClient
        .from("chat_messages")
        .select("sender_type, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
 
    if (data) {
        data.forEach((msg) => {
            appendDashboardChatMessage(msg.sender_type, msg.content);
        });
    }
 
    // Mark this conversation's visitor messages as read now that we've opened it.
    await supabaseClient
        .from("chat_messages")
        .update({ read: true })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "visitor")
        .eq("read", false);
 
    await updateUnreadBadge();
 
    // Unsubscribe from any previous conversation's live updates first.
    if (dashboardChatChannel) {
        supabaseClient.removeChannel(dashboardChatChannel);
    }
 
    dashboardChatChannel = supabaseClient
        .channel(`dashboard-chat-${conversationId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "chat_messages",
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                appendDashboardChatMessage(payload.new.sender_type, payload.new.content);
 
                if (payload.new.sender_type === "visitor" && !payload.new.read) {
                    supabaseClient
                        .from("chat_messages")
                        .update({ read: true })
                        .eq("id", payload.new.id)
                        .then(() => updateUnreadBadge());
                }
            }
        )
        .subscribe();
}
 
function appendDashboardChatMessage(senderType, content) {
 
    const chatMessages = document.getElementById("dashboardChatMessages");
    const bubble = document.createElement("div");
 
    const isBusiness = senderType === "business";
 
    bubble.style.textAlign = isBusiness ? "right" : "left";
    bubble.style.margin = "8px 0";
 
    bubble.innerHTML = `
        <span style="display: inline-block; background: ${isBusiness ? "darkblue" : "#e5e7eb"}; color: ${isBusiness ? "white" : "#111"}; padding: 8px 14px; border-radius: 14px; max-width: 80%;">
            ${escapeHtml(content)}
        </span>
    `;
 
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
 
document.getElementById("dashboardChatForm").addEventListener("submit", async (e) => {
 
    e.preventDefault();
 
    const input = document.getElementById("dashboardChatInput");
    const content = input.value.trim();
    if (!content || !currentDashboardConversationId) return;
 
    input.value = "";
 
    await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: currentDashboardConversationId,
            sender_type: "business",
            content: content
        });
});

// =========================
// LOG OUT
// =========================

const logoutButton = document.getElementById("logoutButton");

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});
