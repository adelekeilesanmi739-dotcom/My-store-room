let currentUserId = null;

async function checkLogin() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (!data.session) {
        window.location.href = "login.html";
        return;
    }

    currentUserId = data.session.user.id;
}

checkLogin();


// =========================
// CHANGE EMAIL
// =========================

document.getElementById("emailForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const newEmail = document.getElementById("newEmail").value;
    const emailMessage = document.getElementById("emailMessage");

    emailMessage.textContent = "Updating...";

    const { error } = await supabaseClient.auth.updateUser({ email: newEmail });

    if (error) {
        emailMessage.textContent = "Something went wrong: " + error.message;
        return;
    }

    emailMessage.textContent =
        "Check your new email address for a confirmation link to complete the change.";

    document.getElementById("emailForm").reset();
});


// =========================
// CHANGE PASSWORD
// =========================

document.getElementById("passwordForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const newPassword = document.getElementById("newPassword").value;
    const passwordMessage = document.getElementById("passwordMessage");

    passwordMessage.textContent = "Updating...";

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
        passwordMessage.textContent = "Something went wrong: " + error.message;
        return;
    }

    passwordMessage.textContent = "Password updated successfully!";
    document.getElementById("passwordForm").reset();
});

// =========================
// DELETE ACCOUNT
// =========================

document.getElementById("deleteAccountButton").addEventListener("click", async () => {

    const deleteMessage = document.getElementById("deleteMessage");

    const firstConfirm = confirm(
        "Are you sure you want to permanently delete your account? " +
        "This will remove your storefront, products, and messages. This cannot be undone."
    );

    if (!firstConfirm) return;

    const secondConfirm = prompt(
        "Type DELETE (in capital letters) to confirm you really want to delete your account:"
    );

    if (secondConfirm !== "DELETE") {
        deleteMessage.textContent = "Account deletion cancelled.";
        return;
    }

    deleteMessage.textContent = "Deleting your account...";

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData.session.access_token;

    const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    const result = await response.json();

    if (!response.ok) {
        deleteMessage.textContent = "Something went wrong: " + result.message;
        return;
    }

    alert("Your account has been deleted.");
    window.location.href = "index.html";
});