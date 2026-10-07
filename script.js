import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCUv1FoZD1AhcD8FxeOvaTZ9XZJ_D3i3zc",
    authDomain: "psc-service-system.firebaseapp.com",
    databaseURL: "https://psc-service-system-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "psc-service-system",
    storageBucket: "psc-service-system.firebasestorage.app",
    messagingSenderId: "1060022500226",
    appId: "1:1060022500226:web:bde4e4328e8e3d7ed1ed9b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Menghubungkan fungsi render agar bisa dibaca oleh event HTML saat dipanggil langsung
window.renderCustomers = renderCustomers;
window.renderServices = renderServices;
window.renderSummaryTable = renderSummaryTable;
window.renderStocks = renderStocks;
window.renderTransactions = renderTransactions;
