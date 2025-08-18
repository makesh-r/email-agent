import admin from 'firebase-admin';
// import { createRequire } from 'module';

// const require = createRequire(import.meta.url);
// const serviceAccount = require('../../firebaseConfig.json');

if (!admin.apps.length) {
    admin.initializeApp({
        // credential: admin.credential.cert(serviceAccount),
        credential: admin.credential.cert("/etc/secrets/firebaseConfig.json"),
    });
}

export const db = admin.firestore();