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

    // Check if this visitor already has an ongoing conversation
    // with this specific business, saved from a previous visit.
    await resumeExistingChatIfAny();
}

let currentBusinessId = null;
let currentStoreSlug = null;
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


async function loadStoreProducts(ownerId) {

    const { data: products, error } = await supabaseClient
        .from("products")
        .select("name, price, description, image_url")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false });

    const storeProducts = document.getElementById("storeProducts");

    if (error || !products || products.length === 0) {
        storeProducts.innerHTML = "";
        return;
    }

    storeProducts.innerHTML = "<h3>Products</h3>";

    products.forEach((product) => {

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
                    <span class="product-item-price">${priceText}</span>
                </div>
                ${imageHtml}
            </div>
        `;

        storeProducts.appendChild(item);
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

loadStore();