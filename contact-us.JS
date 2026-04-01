// ✅ Initialize EmailJS (ensure you've loaded the EmailJS SDK in your HTML head)
// <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
// If you are using module imports for EmailJS, adjust this line accordingly
// import emailjs from 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'; // Example if using module

// Your Public Key (replace with your actual EmailJS Public Key)
const EMAILJS_PUBLIC_KEY = "CJ5zX77JW1QIegjIn"; 

// ✅ Custom Message Box / Modal Functions (Copying from adminDashboard.js for consistency)
// These elements must be present in the HTML page where this script runs.
const messageBox = document.getElementById("messageBox");
const overlay = document.getElementById("overlay");
const messageBoxTitle = document.getElementById("messageBoxTitle");
const messageBoxContent = document.getElementById("messageBoxContent");
const messageBoxConfirmBtn = document.getElementById("messageBoxConfirmBtn");
const messageBoxCancelBtn = document.getElementById("messageBoxCancelBtn");

/**
 * Displays a custom message box (modal).
 * @param {string} title - The title of the message box.
 * @param {string} content - The main message content.
 * @param {boolean} [isConfirm=false] - If true, displays OK and Cancel buttons. Otherwise, only OK.
 * @returns {Promise<boolean>} Resolves to true for OK, false for Cancel (if isConfirm is true).
 */
function showMessageBox(title, content, isConfirm = false) {
    return new Promise((resolve) => {
        // Ensure elements exist before trying to access properties
        if (!messageBox || !overlay || !messageBoxTitle || !messageBoxContent || !messageBoxConfirmBtn || !messageBoxCancelBtn) {
            console.error("❌ Message box HTML elements not found. Please ensure the modal HTML is included in your page.");
            // Fallback to alert if modal elements are missing
            alert(`${title}\n\n${content}`); 
            resolve(isConfirm ? false : true); // Assume cancellation for confirm if modal isn't there
            return;
        }

        messageBoxTitle.textContent = title;
        messageBoxContent.textContent = content;

        messageBoxCancelBtn.classList.toggle("hidden", !isConfirm); // Hide/show Cancel button
        messageBoxConfirmBtn.textContent = isConfirm ? "Confirm" : "OK"; // Change text for OK button

        messageBox.classList.add("show");
        overlay.classList.add("show");

        const handleConfirm = () => {
            messageBox.classList.remove("show");
            overlay.classList.remove("show");
            messageBoxConfirmBtn.removeEventListener("click", handleConfirm);
            messageBoxCancelBtn.removeEventListener("click", handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            messageBox.classList.remove("show");
            overlay.classList.remove("show");
            messageBoxConfirmBtn.removeEventListener("click", handleConfirm);
            messageBoxCancelBtn.removeEventListener("click", handleCancel);
            resolve(false);
        };

        messageBoxConfirmBtn.addEventListener("click", handleConfirm);
        messageBoxCancelBtn.addEventListener("click", handleCancel);

        // Optional: Close modal on overlay click if it's not a confirmation
        if (!isConfirm) {
            overlay.addEventListener("click", handleConfirm, { once: true }); // Only once
        }
    });
}

// ✅ Define sendEmail function
async function sendEmail() { // Made async as showMessageBox returns a Promise
    console.log("📤 Sending email...");

    // ✅ Get input field values
    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const subjectInput = document.getElementById("subject");
    const messageInput = document.getElementById("message");

    // Ensure input elements exist
    if (!nameInput || !emailInput || !subjectInput || !messageInput) {
        showMessageBox("Error", "Contact form input fields not found. Please check your HTML.", false);
        console.error("❌ Missing contact form input elements (name, email, subject, message).");
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const subject = subjectInput.value.trim();
    const message = messageInput.value.trim();

    // ✅ Validate input fields
    if (!name || !email || !subject || !message) {
        showMessageBox("Validation Error", "Please fill in all fields before submitting.", false);
        return;
    }

    // ✅ Validate email format
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
        showMessageBox("Validation Error", "Please enter a valid email address.", false);
        return;
    }

    // ✅ EmailJS parameters
    const templateParams = {
        from_name: name,
        from_email: email,
        subject: subject,
        message: message
    };

    // ✅ Send email using EmailJS
    try {
        // Ensure emailjs is initialized and available
        if (typeof emailjs === 'undefined' || !emailjs.send) {
            console.error("❌ EmailJS SDK not loaded or initialized. Please ensure the EmailJS SDK script is included in your HTML BEFORE this script.");
            showMessageBox("Error", "Email service not available. Please try again later.", false);
            return;
        }

        const response = await emailjs.send("service_cyaf2am", "template_wq1oiy6", templateParams);
        console.log("✅ Email sent successfully!", response);
        showMessageBox("Success", "Your message has been sent successfully!", false);
        document.getElementById("contactForm").reset(); // Reset form after submission
    } catch (error) {
        console.error("❌ Failed to send email:", error);
        let errorMessage = "Failed to send message. Please check the console for more details.";

        // ✅ Handle specific EmailJS errors
        switch (error.status) {
            case 400:
                errorMessage = "Service ID or Template ID is incorrect. Please verify your EmailJS settings.";
                break;
            case 401:
                errorMessage = "Invalid Public Key. Check your EmailJS Public Key.";
                break;
            case 403:
                errorMessage = "API Key might be restricted or invalid.";
                break;
            case 418: // This is an HTTP code for "I'm a teapot", unlikely for EmailJS but good for example
                errorMessage = "Unsupported EmailJS SDK version. Update your EmailJS integration.";
                break;
            default:
                errorMessage = `An unexpected error occurred: ${error.message || 'Unknown error'}. Please try again later.`;
        }
        showMessageBox("Email Send Error", errorMessage, false);
    }
}

// ✅ Wait for DOM to be ready before attaching event listener and initializing EmailJS
document.addEventListener("DOMContentLoaded", function () {
    // Initialize EmailJS here to ensure it's done after DOM is ready
    if (typeof emailjs !== 'undefined' && emailjs.init) {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    } else {
        console.error("❌ EmailJS SDK is not loaded. Please include <script type='text/javascript' src='https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'></script> in your HTML head.");
    }

    const contactForm = document.getElementById("contactForm");

    if (contactForm) {
        contactForm.addEventListener("submit", function (event) {
            event.preventDefault(); // Prevent form from refreshing the page
            sendEmail();
        });
    } else {
        console.error("❌ Contact form not found in the DOM (ID 'contactForm').");
        // This won't show a message box, as the form itself isn't found.
    }
});
