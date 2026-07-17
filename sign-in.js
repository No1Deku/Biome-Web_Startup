// ======================================================
// BIOME
// sign-in.js
// ======================================================

console.log("Biome Sign-In Loaded.");

const authClient = BiomeAuth.supabase;


// ======================================================
// DOM ELEMENTS
// ======================================================

const signinForm =
    document.getElementById("signin-form");

const signinButton =
    document.getElementById("signin-button");

const statusMessage =
    document.getElementById("status-message");

const forgotPassword =
    document.getElementById("forgot-password");


// ======================================================
// STATUS MESSAGE HELPERS
// ======================================================

function showMessage(message, type = "") {

    if (!statusMessage) return;

    statusMessage.textContent = message;

    statusMessage.className = `status ${type}`;

}

function clearMessage() {

    if (!statusMessage) return;

    statusMessage.textContent = "";

    statusMessage.className = "status";

}


// ======================================================
// SIGN IN
// ======================================================

if (signinForm) {

    signinForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        clearMessage();

        const email =
            document
                .getElementById("signin-email")
                .value
                .trim()
                .toLowerCase();

        const password =
            document
                .getElementById("signin-password")
                .value;

        if (!email || !password) {

            showMessage(
                "Please enter your email and password.",
                "error"
            );

            return;

        }

        signinButton.disabled = true;

        signinButton.innerHTML = `
            <span class="loader"></span>
            Signing In...
        `;

        try {

            const {

                data,
                error

            } =
            await authClient.auth.signInWithPassword({

                email,
                password

            });

            if (error) {

                throw error;

            }

            if (!data.user) {

                throw new Error(
                    "Unable to authenticate user."
                );

            }

            const profile =
                await BiomeAuth.getCurrentProfile();

            if (!profile) {

                throw new Error(
                    "Unable to load profile."
                );

            }

            showMessage(
                "Login successful.",
                "success"
            );

            setTimeout(async () => {

                await BiomeAuth.redirectUser();

            }, 1000);

        }
        catch (err) {

            console.error(err);

            showMessage(
                err.message,
                "error"
            );

        }
        finally {

            signinButton.disabled = false;

            signinButton.textContent =
                "Sign In";

        }

    });

}


// ======================================================
// PASSWORD RESET
// ======================================================

if (forgotPassword) {

    forgotPassword.addEventListener("click", async (e) => {

        e.preventDefault();

        clearMessage();

        const email =
            prompt("Enter your email address");

        if (!email) return;

        try {

            const {

                error

            } =
            await authClient.auth.resetPasswordForEmail(

                email,

                {

                    redirectTo:
                        window.location.origin +
                        "/reset-password.html"

                }

            );

            if (error) {

                throw error;

            }

            showMessage(
                "Password reset email sent.",
                "success"
            );

        }
        catch (err) {

            console.error(err);

            showMessage(
                err.message,
                "error"
            );

        }

    });

}


// ======================================================
// EXISTING SESSION
// ======================================================

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        const session =
            await BiomeAuth.getSession();

        if (!session) {

            return;

        }

        console.log(
            "Existing session detected."
        );

        const profile =
            await BiomeAuth.getCurrentProfile();

        if (!profile) {

            return;

        }

        await BiomeAuth.redirectUser();

    }

);