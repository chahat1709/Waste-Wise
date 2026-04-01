// config.js - Configuration management
require('dotenv').config();

const config = {
    // Public configs that can be exposed to client
    publicConfig: {
        SOCKET_IO_URL: process.env.SOCKET_IO_URL || 'http://localhost:5000',
    },
    
    // Private configs only used server-side
    privateConfig: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
        FIREBASE_CONFIG: {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            measurementId: process.env.FIREBASE_MEASUREMENT_ID
        },
        EMAIL_CONFIG: {
            publicKey: process.env.EMAILJS_PUBLIC_KEY,
            serviceId: process.env.EMAILJS_SERVICE_ID,
            templateId: process.env.EMAILJS_TEMPLATE_ID
        },
        ADMIN_KEY: process.env.ADMIN_KEY
    }
};

// Only expose what's needed to the client
module.exports = {
    config,
    getPublicConfig: () => config.publicConfig,
    getPrivateConfig: () => config.privateConfig
};