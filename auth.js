// =========================
// SIGN UP
// =========================

const signupForm = document.getElementById("signupForm");

if (signupForm) {

    signupForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("signupEmail").value;
        const password = document.getElementById("signupPassword").value;
        const signupMessage = document.getElementById("signupMessage");

        signupMessage.textContent = "Creating your account...";

        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        if (error) {
            signupMessage.textContent = error.message;
            return;
        }

        if (data.session) {
            // Email confirmation is off — user is already logged in.
            signupMessage.textContent = "Account created! You're now logged in.";
            signupForm.reset();
            // We'll build dashboard.html next — this link will work once it exists.
            window.location.href = "dashboard.html";
        } else {
            // Email confirmation is required.
            signupMessage.textContent =
                "Account created! Check your email to confirm, then log in.";
            signupForm.reset();
        }
    });

}


// =========================
// LOG IN
// =========================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
        const loginMessage = document.getElementById("loginMessage");

        loginMessage.textContent = "Logging in...";

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            loginMessage.textContent = error.message;
            return;
        }

        loginMessage.textContent = "Success! Redirecting...";

        // We'll build dashboard.html next — this link will work once it exists.
        window.location.href = "dashboard.html";
    });

}