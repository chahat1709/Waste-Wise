import { config } from './config.js';

document.addEventListener("DOMContentLoaded", function () {
    // Initialize EmailJS with secure config
    emailjs.init(config.privateConfig.EMAIL_CONFIG.publicKey);

    const contactForm = document.getElementById("contactForm");

    if (contactForm) {
        contactForm.addEventListener("submit", function (event) {
            event.preventDefault(); // Prevent form from refreshing the page
            sendEmail();
        });
    } else {
        console.error("❌ Contact form not found in the DOM!");
    }
});

// ✅ Define sendEmail function
function sendEmail() {
    console.log("📤 Sending email...");

    // ✅ Get input field values
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const subject = document.getElementById("subject").value.trim();
    const message = document.getElementById("message").value.trim();

    // ✅ Validate input fields
    if (!name || !email || !subject || !message) {
        alert("❌ Please fill in all fields before submitting.");
        return;
    }

    // ✅ Validate email format
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
        alert("❌ Please enter a valid email address.");
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
    const submitBtn = document.getElementById('contactSubmitBtn');
    const feedback = document.getElementById('contactFeedback');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
    }
    if (feedback) {
        feedback.style.display = 'none';
        feedback.className = 'contact-feedback';
        feedback.textContent = '';
    }

    emailjs.send(
        config.privateConfig.EMAIL_CONFIG.serviceId,
        config.privateConfig.EMAIL_CONFIG.templateId,
        templateParams
    )
        .then((response) => {
            console.log("✅ Email sent successfully!", response);
            if (feedback) {
                feedback.classList.add('success');
                feedback.textContent = '✅ Your message has been sent successfully! We will get back to you shortly.';
                feedback.style.display = 'block';
            } else {
                alert('✅ Your message has been sent successfully!');
            }
            document.getElementById("contactForm").reset(); // Reset form after submission
        })
        .catch((error) => {
            console.error("❌ Failed to send email:", error);
            if (feedback) {
                feedback.classList.add('error');
                feedback.textContent = '❌ Failed to send message. Please try again later.';
                feedback.style.display = 'block';
            } else {
                alert('❌ Failed to send message. Please check the console for errors.');
            }

            // Extra logging for specific EmailJS errors
            if (error && error.status) {
                console.warn('EmailJS status code:', error.status);
            }
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            }
        });
}
