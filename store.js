async function loadStore() {

    // Read the "store" value from the URL, e.g. store.html?store=grace-painting
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("store");

    const loading = document.getElementById("storeLoading");
    const notFound = document.getElementById("storeNotFound");
    const content = document.getElementById("storeContent");

    if (!slug) {
        loading.style.display = "none";
        notFound.style.display = "block";
        return;
    }

    // This works even for visitors who are NOT logged in,
    // because of the public-read policy we added in Supabase.
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, business_name, business_description, product_type")
        .eq("store_slug", slug)
        .maybeSingle();

    loading.style.display = "none";

    if (error || !data) {
        notFound.style.display = "block";
        return;
    }

    document.getElementById("storeBusinessName").textContent =
        data.business_name || "Unnamed Business";

    document.getElementById("storeBusinessDescription").textContent =
        data.business_description || "";

    document.getElementById("storeProductType").textContent =
        data.product_type ? data.product_type.toUpperCase() : "";

           content.style.display = "block";

    // Store this so the chat widget knows who to start a conversation with.
    currentBusinessId = data.id;
    currentStoreSlug = slug;

    // Now load this business's products (also public, via our
    // "Public can view products of published stores" policy).
    await loadStoreProducts(data.id);

        // Load reviews (also public, via our
    // "Anyone can view reviews of published stores" policy).
    await loadReviews(data.id);

    // Check if this visitor already has an ongoing conversation
    // with this specific business, saved from a previous visit.
    await resumeExistingChatIfAny();
}

// =========================
// PRODUCTS
// =========================

async function loadStoreProducts(ownerId) {

    const { data: products, error } = await supabaseClient
        .from("products")
        .select("id, name, price, description")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false });

    const storeProducts = document.getElementById("storeProducts");

    if (error || !products || products.length === 0) {
        storeProducts.innerHTML = "";
        return;
    }

    // Fetch all images for all these products in one query.
    const productIds = products.map((p) => p.id);

    const { data: allImages } = await supabaseClient
        .from("product_images")
        .select("product_id, image_url")
        .in("product_id", productIds);

    storeProducts.innerHTML = "<h3>Products</h3>";

    products.forEach((product) => {

        const item = document.createElement("div");
        item.className = "product-item";

        const priceText = product.price !== null
            ? `$${Number(product.price).toFixed(2)}`
            : "";

        const images = (allImages || []).filter((img) => img.product_id === product.id);

        const imagesHtml = images.map((img) => `
            <img src="${img.image_url}" alt="${escapeHtml(product.name)}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin: 5px 5px 0 0; display: inline-block;">
        `).join("");

        item.innerHTML = `
            <div class="product-item-info" style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4>${escapeHtml(product.name)}</h4>
                        <p>${escapeHtml(product.description || "")}</p>
                    </div>
                    <span class="product-item-price">${priceText}</span>
                </div>
                <div style="margin-top: 10px;">
                    ${imagesHtml}
                </div>
            </div>
        `;

        storeProducts.appendChild(item);
    });
}

// =========================
// REVIEWS
// =========================
let currentBusinessId = null;
let currentStoreSlug = null;
async function loadReviews(businessId) {

    const { data, error } = await supabaseClient
        .from("reviews")
        .select("reviewer_name, rating, comment, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

    const reviewsList = document.getElementById("reviewsList");
    const averageRating = document.getElementById("averageRating");

    reviewsList.innerHTML = "";

    if (error || !data || data.length === 0) {
        averageRating.textContent = "No reviews yet.";
        return;
    }

    const total = data.reduce((sum, r) => sum + r.rating, 0);
    const average = (total / data.length).toFixed(1);
    const stars = "★".repeat(Math.round(average)) + "☆".repeat(5 - Math.round(average));

    averageRating.textContent = `${stars} ${average} out of 5 (${data.length} review${data.length === 1 ? "" : "s"})`;

    data.forEach((review) => {

        const item = document.createElement("div");
        item.className = "product-item";

        const reviewStars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
        const dateText = new Date(review.created_at).toLocaleDateString();

        item.innerHTML = `
            <div class="product-item-info" style="width: 100%;">
                <h4>${escapeHtml(review.reviewer_name)} <span style="color: darkblue;">${reviewStars}</span></h4>
                <p>${escapeHtml(review.comment || "")}</p>
                <p style="font-size: 12px; color: #999;">${dateText}</p>
            </div>
        `;

        reviewsList.appendChild(item);
    });
}

document.getElementById("reviewForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const reviewerName = document.getElementById("reviewerName").value;
    const rating = parseInt(document.getElementById("reviewRating").value);
    const comment = document.getElementById("reviewComment").value;
    const reviewFormMessage = document.getElementById("reviewFormMessage");

    reviewFormMessage.textContent = "Submitting...";

    const { error } = await supabaseClient
        .from("reviews")
        .insert({
            business_id: currentBusinessId,
            reviewer_name: reviewerName,
            rating: rating,
            comment: comment
        });

    if (error) {
        reviewFormMessage.textContent = "Something went wrong: " + error.message;
        return;
    }

    reviewFormMessage.textContent = "Thanks for your review!";
    document.getElementById("reviewForm").reset();
    await loadReviews(currentBusinessId);
});

// =========================
// CHAT
// =========================
let currentConversationId = null;
let chatChannel = null;

function chatStorageKey() {
    return `mystore_chat_${currentStoreSlug}`;
}

async function resumeExistingChatIfAny() {

    const savedConversationId = localStorage.getItem(chatStorageKey());
    if (!savedConversationId) return;

    // Verify the conversation still actually exists before reconnecting.
    const { data, error } = await supabaseClient
        .from("conversations")
        .select("id")
        .eq("id", savedConversationId)
        .maybeSingle();

    if (error || !data) {
        // It's gone (e.g. deleted) — clear the stale saved reference.
        localStorage.removeItem(chatStorageKey());
        return;
    }

    currentConversationId = savedConversationId;

    document.getElementById("chatStart").style.display = "none";
    document.getElementById("chatWindow").style.display = "block";

    // Load the existing message history for this conversation.
    const { data: messages } = await supabaseClient
        .from("chat_messages")
        .select("sender_type, content")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

    if (messages) {
        messages.forEach((msg) => {
            appendChatMessage(msg.sender_type, msg.content);
        });
    }

    subscribeToChatMessages();
}  

document.getElementById("startChatButton").addEventListener("click", async () => {

    const visitorName = document.getElementById("chatVisitorName").value || "Visitor";

    const { data, error } = await supabaseClient
        .from("conversations")
        .insert({
            business_id: currentBusinessId,
            visitor_name: visitorName
        })
        .select()
        .single();

    if (error) {
        alert("Couldn't start chat: " + error.message);
        return;
    }

        currentConversationId = data.id;

    localStorage.setItem(chatStorageKey(), currentConversationId);

    document.getElementById("chatStart").style.display = "none";
    document.getElementById("chatWindow").style.display = "block";

    subscribeToChatMessages();
});

document.getElementById("chatForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const input = document.getElementById("chatMessageInput");
    const content = input.value.trim();
    if (!content) return;

    input.value = "";

    await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: currentConversationId,
            sender_type: "visitor",
            content: content
        });
});

function appendChatMessage(senderType, content) {

    const chatMessages = document.getElementById("chatMessages");
    const bubble = document.createElement("div");

    const isVisitor = senderType === "visitor";

    bubble.style.textAlign = isVisitor ? "right" : "left";
    bubble.style.margin = "8px 0";

    bubble.innerHTML = `
        <span style="display: inline-block; background: ${isVisitor ? "darkblue" : "#e5e7eb"}; color: ${isVisitor ? "white" : "#111"}; padding: 8px 14px; border-radius: 14px; max-width: 80%;">
            ${escapeHtml(content)}
        </span>
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function subscribeToChatMessages() {

    chatChannel = supabaseClient
        .channel(`chat-${currentConversationId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "chat_messages",
                filter: `conversation_id=eq.${currentConversationId}`
            },
            (payload) => {
                appendChatMessage(payload.new.sender_type, payload.new.content);
            }
        )
        .subscribe();
}

// =========================
// SHARED HELPER
// =========================
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

loadStore();
