// ============================================================
// BIOME PROPERTY MARKETPLACE
// SIGN-UP
// PART 1
// Configuration, UI Helpers & Validation
// ============================================================


// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const supabaseUrl =
    "https://cwatxxamkoukctwijomr.supabase.co";

const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3YXR4eGFta291a2N0d2lqb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDU0NDYsImV4cCI6MjA5OTY4MTQ0Nn0.rfVtSuJK5xgmHCinKHbni0DLazedmvW6yKQaVTBD3PM";

const supabaseClient =
    window.supabase.createClient(
        supabaseUrl,
        supabaseKey
    );

console.log("✓ Supabase Initialized");


// ============================================================
// DOM ELEMENTS
// ============================================================

const signupForm =
    document.getElementById("signup-form");

const signupButton =
    document.getElementById("signup-button");

const statusMessage =
    document.getElementById("status-message");

const passwordInput =
    document.getElementById("password");

const confirmPasswordInput =
    document.getElementById("confirm-password");

const strengthBar =
    document.getElementById("strength-bar");

const strengthText =
    document.getElementById("strength-text");


// ============================================================
// STATUS MESSAGE
// ============================================================

function showMessage(
    message,
    type = "info"
){

    if(!statusMessage){

        console.error(
            "status-message element not found."
        );

        return;
    }

    statusMessage.textContent = message;

    statusMessage.className =
        `status-message ${type}`;
}


// ============================================================
// CLEAR STATUS
// ============================================================

function clearMessage(){

    if(!statusMessage){
        return;
    }

    statusMessage.className =
        "status-message";

    statusMessage.textContent = "";
}


// ============================================================
// BUTTON LOADING
// ============================================================

function setLoading(
    loading
){

    if(!signupButton){
        return;
    }

    signupButton.disabled =
        loading;

    if(loading){

        signupButton.innerHTML =

        `
        <span class="spinner"></span>
        Creating Account...
        `;

    }

    else{

        signupButton.innerHTML =
            "Create Account";
    }

}


// ============================================================
// EMAIL VALIDATION
// ============================================================

function isValidEmail(
    email
){

    const regex =

        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return regex.test(email);

}


// ============================================================
// PHONE VALIDATION
// ============================================================

function isValidPhone(
    phone
){

    const regex =

        /^[0-9+\-\s()]{8,20}$/;

    return regex.test(phone);

}


// ============================================================
// PASSWORD STRENGTH
// ============================================================

function updatePasswordStrength(
    password
){

    if(
        !strengthBar ||
        !strengthText
    ){
        return;
    }

    let score = 0;

    if(password.length >= 8)
        score++;

    if(/[A-Z]/.test(password))
        score++;

    if(/[0-9]/.test(password))
        score++;

    if(/[^A-Za-z0-9]/.test(password))
        score++;

    strengthBar.className =
        "strength-bar";

    if(password.length === 0){

        strengthText.textContent =
            "Password strength";

        return;

    }

    if(score <= 1){

        strengthBar.classList.add(
            "weak"
        );

        strengthText.textContent =
            "Weak password";

    }

    else if(score <= 3){

        strengthBar.classList.add(
            "medium"
        );

        strengthText.textContent =
            "Medium password";

    }

    else{

        strengthBar.classList.add(
            "strong"
        );

        strengthText.textContent =
            "Strong password";

    }

}


// ============================================================
// PASSWORD LISTENER
// ============================================================

if(passwordInput){

    passwordInput.addEventListener(
        "input",
        function(){

            updatePasswordStrength(
                passwordInput.value
            );

        }
    );

}


// ============================================================
// FORM VALIDATION
// ============================================================

function validateForm(){

    clearMessage();

    const firstName =
        document
            .getElementById("first-name")
            .value
            .trim();

    const surname =
        document
            .getElementById("surname")
            .value
            .trim();

    const email =
        document
            .getElementById("email")
            .value
            .trim();

    const phone =
        document
            .getElementById("phone")
            .value
            .trim();

    const password =
        passwordInput.value;

    const confirmPassword =
        confirmPasswordInput.value;

    const accountType =
        document
            .getElementById("account-type")
            .value;

    if(firstName.length < 2){

        showMessage(
            "Please enter your first name.",
            "error"
        );

        return false;

    }

    if(surname.length < 2){

        showMessage(
            "Please enter your surname.",
            "error"
        );

        return false;

    }

    if(!isValidEmail(email)){

        showMessage(
            "Please enter a valid email address.",
            "error"
        );

        return false;

    }

    if(!isValidPhone(phone)){

        showMessage(
            "Please enter a valid phone number.",
            "error"
        );

        return false;

    }

    if(password.length < 8){

        showMessage(
            "Password must contain at least 8 characters.",
            "error"
        );

        return false;

    }

    if(password !== confirmPassword){

        showMessage(
            "Passwords do not match.",
            "error"
        );

        return false;

    }

    if(accountType === ""){

        showMessage(
            "Please choose an account type.",
            "error"
        );

        return false;

    }

    return true;

}


// ============================================================
// READY
// ============================================================

console.log(
    "✓ Validation Helpers Loaded"
);


// ============================================================
// PART 2
// SIGN-UP EVENT
// ============================================================

if (!signupForm) {

    console.error(
        "signup-form element not found."
    );

}
else {

    signupForm.addEventListener(

        "submit",

        async function (e) {

            e.preventDefault();

            console.log(
                "Creating Biome account..."
            );

            // ======================================
            // VALIDATE FORM
            // ======================================

            if (!validateForm()) {
                return;
            }

            clearMessage();

            setLoading(true);

            // ======================================
            // GET FORM VALUES
            // ======================================

            const firstName =
                document
                    .getElementById("first-name")
                    .value
                    .trim();

            const surname =
                document
                    .getElementById("surname")
                    .value
                    .trim();

            const dob =
                document
                    .getElementById("dob")
                    .value;

            const accountType =
                document
                    .getElementById("account-type")
                    .value;

            const email =
                document
                    .getElementById("email")
                    .value
                    .trim()
                    .toLowerCase();

            const phone =
                document
                    .getElementById("phone")
                    .value
                    .trim();

            const country =
                document
                    .getElementById("country")
                    .value
                    .trim();

            const password =
                document
                    .getElementById("password")
                    .value;

            const displayName =
                `${firstName} ${surname}`;

            try {

                console.log(
                    "Sending request to Supabase..."
                );

                // ======================================
                // CREATE AUTH USER
                // ======================================

                const {

                    data,

                    error

                } =

                await supabaseClient
                    .auth
                    .signUp({

                        email,

                        password,

                        options: {

                            emailRedirectTo:
                                window.location.origin +
                                "/sign-in.html",

                            data: {

                                first_name: firstName,

                                surname: surname,

                                display_name: displayName,

                                phone: phone,

                                country: country,

                                dob: dob,

                                owner_type: accountType

                            }

                        }

                    });

                // ======================================
                // HANDLE ERRORS
                // ======================================

                if (error) {

                    throw error;

                }

                if (!data.user) {

                    throw new Error(
                        "Unable to create account."
                    );

                }

                console.log(
                    "Authentication account created."
                );

                // ======================================
                // EMAIL VERIFICATION REQUIRED
                // ======================================

                if (!data.session) {

                    showMessage(

                        "Account created successfully. Please verify your email before signing in.",

                        "success"

                    );

                    signupForm.reset();

                    updatePasswordStrength("");

                    return;

                }

                // ======================================
                // ACCOUNT CREATED
                // ======================================

                showMessage(

                    "Your Biome account has been created successfully.",

                    "success"

                );

                console.log(
                    "Waiting for database trigger..."
                );

                // ======================================
                // WAIT A MOMENT
                // FOR DATABASE TRIGGER
                // ======================================

                await new Promise(

                    resolve =>

                    setTimeout(

                        resolve,

                        1000

                    )

                );

                // ======================================
                // REDIRECT
                // ======================================

                window.location.href =
                    "sign-in.html";

            }

            catch (err) {

                console.error(
                    "SIGN-UP ERROR:",
                    err
                );

                let message =
                    err.message;

                // ======================================
                // FRIENDLY ERRORS
                // ======================================

                if (

                    err.message
                    .toLowerCase()
                    .includes("already")

                ) {

                    message =
                        "An account with this email already exists.";

                }

                if (

                    err.message
                    .toLowerCase()
                    .includes("password")

                ) {

                    message =
                        "Password does not meet the required security rules.";

                }

                if (

                    err.message
                    .toLowerCase()
                    .includes("network")

                ) {

                    message =
                        "Unable to connect to the server. Please check your internet connection.";

                }

                showMessage(

                    message,

                    "error"

                );

            }

            finally {

                setLoading(false);

            }

        }

    );

}

console.log(
    "✓ Sign-Up Event Loaded"
);

// ======================================
// CHECK EXISTING SESSION
// ======================================

async function checkSession() {

    try {

        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        if (!session) {
            console.log("No active session.");
            return;
        }

        console.log("Active session found.");

        const profile = await getCurrentProfile();

        if (!profile) {
            return;
        }

        redirectUser(profile.account_type);

    }
    catch (err) {

        console.error(
            "Session Check Error:",
            err
        );

    }

}


// ======================================
// GET CURRENT PROFILE
// ======================================

async function getCurrentProfile() {

    try {

        const {
            data: { user },
            error: userError
        } =
            await supabaseClient.auth.getUser();

        if (userError) {
            throw userError;
        }

        if (!user) {
            return null;
        }

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq("profile_id", user.id)
                .single();

        if (profileError) {

            console.error(
                "Profile Lookup Error:",
                profileError
            );

            return null;

        }

        return profile;

    }
    catch (err) {

        console.error(err);

        return null;

    }

}


// ======================================
// ROLE REDIRECTION
// ======================================

function redirectUser(accountType) {

    switch (accountType) {

        case "buyer":

            window.location.href =
                "buyer-dashboard.html";

            break;

        case "seller":

            window.location.href =
                "seller-dashboard.html";

            break;

        case "admin":

            window.location.href =
                "admin-dashboard.html";

            break;

        default:

            window.location.href =
                "index.html";

    }

}


// ======================================
// AUTH STATE LISTENER
// ======================================

supabaseClient.auth.onAuthStateChange(

    async (event, session) => {

        console.log(
            "Auth Event:",
            event
        );

        switch (event) {

            case "SIGNED_IN":

                console.log(
                    "User signed in."
                );

                break;

            case "SIGNED_OUT":

                console.log(
                    "User signed out."
                );

                break;

            case "USER_UPDATED":

                console.log(
                    "User updated."
                );

                break;

            case "PASSWORD_RECOVERY":

                console.log(
                    "Password recovery."
                );

                break;

        }

    }

);


// ======================================
// OPTIONAL LOGOUT HELPER
// ======================================

async function logout() {

    try {

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href =
            "sign-in.html";

    }
    catch (err) {

        console.error(
            "Logout Error:",
            err
        );

    }

}


// ======================================
// OPTIONAL PAGE PROTECTION
// ======================================

async function requireAuth() {

    const {
        data: { session }
    } =
        await supabaseClient.auth.getSession();

    if (!session) {

        window.location.href =
            "sign-in.html";

        return false;

    }

    return true;

}


// ======================================
// INITIALIZE PAGE
// ======================================

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        console.log(
            "Biome Sign-Up Ready."
        );

        await checkSession();

    }

);  