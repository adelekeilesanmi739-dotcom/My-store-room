async function loadDirectory(productTypeFilter, searchTerm) {

    const loading = document.getElementById("directoryLoading");
    const empty = document.getElementById("directoryEmpty");
    const list = document.getElementById("directoryList");

    loading.style.display = "block";
    empty.style.display = "none";
    list.innerHTML = "";

    // Public-read policy lets anyone (logged in or not) see profiles
    // that have a store_slug set — same pattern as store.html.
    let query = supabaseClient
        .from("profiles")
        .select("business_name, business_description, product_type, store_slug")
        .not("store_slug", "is", null);

    if (productTypeFilter) {
        query = query.eq("product_type", productTypeFilter);
    }

    if (searchTerm) {
        // Case-insensitive partial match on business name.
        query = query.ilike("business_name", `%${searchTerm}%`);
    }

    const { data, error } = await query;

    loading.style.display = "none";

    if (error || !data || data.length === 0) {
        empty.style.display = "block";
        return;
    }

    data.forEach((business) => {

        const card = document.createElement("div");
        card.className = "who-card";

        card.innerHTML = `
            <h3>${escapeHtml(business.business_name || "Unnamed Business")}</h3>
            <p style="color: darkblue; font-weight: bold; font-size: 13px;">
                ${escapeHtml(business.product_type ? business.product_type.toUpperCase() : "")}
            </p>
            <p>${escapeHtml(business.business_description || "")}</p>
            <a href="store.html?store=${business.store_slug}" class="secondary-button" style="display: inline-block; margin-top: 10px;">
                Visit Store
            </a>
        `;

        list.appendChild(card);
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Load everything on page load
loadDirectory("", "");

// Re-load whenever the category filter changes
document.getElementById("filterProductType").addEventListener("change", () => {
    applyFilters();
});

// Re-load as the user types a search term, with a short debounce
// so we're not querying the database on every single keystroke.
let searchDebounceTimer = null;

document.getElementById("searchBusinessName").addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFilters, 300);
});

function applyFilters() {
    const productType = document.getElementById("filterProductType").value;
    const searchTerm = document.getElementById("searchBusinessName").value.trim();
    loadDirectory(productType, searchTerm);
}