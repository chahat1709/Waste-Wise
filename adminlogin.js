// Admin Login JavaScript with login theme integration
document.addEventListener('DOMContentLoaded', function() {
    // Clock functionality (exact match to login.html)
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const clockElement = document.getElementById('admin-clock');
        if (clockElement) {
            clockElement.textContent = `${hours}:${minutes}:${seconds}`;
        }
    }
    
    // Update clock immediately and then every second
    updateClock();
    setInterval(updateClock, 1000);
    
    // Message box functionality (exact match to login-auth.js)
    const messageBox = document.getElementById("messageBox");
    const overlay = document.getElementById("overlay");
    const messageBoxTitle = document.getElementById("messageBoxTitle");
    const messageBoxContent = document.getElementById("messageBoxContent");
    const messageBoxConfirmBtn = document.getElementById("messageBoxConfirmBtn");
    const messageBoxCancelBtn = document.getElementById("messageBoxCancelBtn");

    function showMessageBox(title, content, isConfirm = false) {
        return new Promise((resolve) => {
            if (!messageBox || !overlay || !messageBoxTitle || !messageBoxContent || !messageBoxConfirmBtn || !messageBoxCancelBtn) {
                console.error("❌ Message box HTML elements not found. Please ensure the modal HTML is included in your page.");
                console.warn(`[Fallback Message] ${title}: ${content}`);
                resolve(isConfirm ? false : true);
                return;
            }

            messageBoxTitle.textContent = title;
            messageBoxContent.textContent = content;
            messageBoxCancelBtn.classList.toggle("hidden", !isConfirm);
            
            messageBox.classList.add("show");
            overlay.classList.add("show");
            
            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };
            
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };
            
            const cleanup = () => {
                messageBox.classList.remove("show");
                overlay.classList.remove("show");
                messageBoxConfirmBtn.removeEventListener("click", handleConfirm);
                messageBoxCancelBtn.removeEventListener("click", handleCancel);
            };
            
            messageBoxConfirmBtn.addEventListener("click", handleConfirm);
            if (isConfirm) {
                messageBoxCancelBtn.addEventListener("click", handleCancel);
            }
        });
    }
    
    // Form submission (admin-specific)
    const form = document.getElementById('admin-login-form');
    const errorMessage = document.getElementById('error-message');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-password').value.trim();
        
        // Hide previous error
        errorMessage.classList.add('hidden');
        
        // Basic validation
        if (!email || !password) {
            errorMessage.textContent = 'Please fill in all fields';
            errorMessage.classList.remove('hidden');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorMessage.textContent = 'Please enter a valid email address';
            errorMessage.classList.remove('hidden');
            return;
        }
        
        try {
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Signing in...';
            submitBtn.disabled = true;
            
            // Simulate admin authentication (replace with actual API call)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Check credentials (replace with actual authentication)
            if (email === 'admin@wastewise.com' && password === 'admin123') {
                await showMessageBox('Login Successful', 'Welcome to Admin Portal!', false);
                // Redirect to admin dashboard
                window.location.href = 'admindashboard.html';
            } else {
                errorMessage.textContent = 'Invalid admin credentials';
                errorMessage.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'Login failed. Please try again.';
            errorMessage.classList.remove('hidden');
        } finally {
            // Reset button state
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Admin Login';
            submitBtn.disabled = false;
        }
    });
    
    // Clear error on input
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            errorMessage.classList.add('hidden');
        });
    });
});
