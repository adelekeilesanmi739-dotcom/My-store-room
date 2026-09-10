// Checks whether someone is already logged in, and shows the
// right links in the nav bar (Log In/Sign Up vs. Dashboard).

async function updateNavAuthLinks() {

    const { data } = await supabaseClient.auth.getSession();

    const loginLink = document.getElementById("navLoginLink");
    const signupLink = document.getElementById("navSignupLink");
    const dashboardLink = document.getElementById("navDashboardLink");

    if (data.session) {
        // Logged in — show Dashboard, hide Log In/Sign Up
        loginLink.style.display = "none";
        signupLink.style.display = "none";
        dashboardLink.style.display = "inline";
    } else {
        // Logged out — show Log In/Sign Up, hide Dashboard
        loginLink.style.display = "inline";
        signupLink.style.display = "inline";
        dashboardLink.style.display = "none";
    }
}

updateNavAuthLinks();