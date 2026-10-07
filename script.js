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

const refs = {
    customers: ref(db, 'crm_customers'),
    services: ref(db, 'service_orders'),
    stocks: ref(db, 'inventory_stocks'),
    transactions: ref(db, 'product_transactions'),
    employees: ref(db, 'owner_employees')
};

let rawData = { customers: {}, services: {}, stocks: {}, transactions: {}, employees: {} };
let crmMap = {};
let cardExpandedState = {};
let chartInstance = null;
let currentChartMode = 'daily';

// Helpers DOM
const $ = (id) => document.getElementById(id);
const getVal = (id) => $(id)?.value || '';

const todayStr = new Date().toISOString().split('T')[0];
['crmDate', 'serviceInDate', 'transDate'].forEach(id => { if($(id)) $(id).value = todayStr; });

window.toggleModal = (id, show) => $(id)?.classList[show ? 'remove' : 'add']('hidden');

const getTimeValue = (item, dateKey = 'serviceInDate') => {
    if (!item) return 0;
    const dateVal = item[dateKey] || item.inDate || item.date || item.chatDate || item.transDate;
    return dateVal ? (Date.parse(dateVal) || item.createdAt || 0) : (item.createdAt || 0);
};

const formatDate = (val) => {
    if (!val) return '-';
    const parts = typeof val === 'string' && val.includes('-') ? val.split('-') : null;
    const d = parts && parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(val);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getWeekNumber = (d) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    return Math.ceil((((date - new Date(Date.UTC(date.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7);
};

// Realtime Listeners
onValue(refs.customers, (s) => { rawData.customers = s.val() || {}; renderCustomers(); populateCrmDatalist(); });
onValue(refs.services, (s) => {
    const sb = $('status-badge');
    if (sb) {
        sb.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-400"></span> Terhubung Realtime`;
        sb.className = 'text-xs bg-green-700 text-white font-semibold px-3 py-1 rounded-full flex items-center gap-1.5';
    }
    rawData.services = s.val() || {};
    renderServices(); renderSummaryTable(); renderFinancialReports();
});
onValue(refs.stocks, (s) => { rawData.stocks = s.val() || {}; renderStocks(); populateStockDropdown(); });
onValue(refs.transactions, (s) => { rawData.transactions = s.val() || {}; renderTransactions(); });
onValue(refs.employees, (s) => { rawData.employees = s.val() || {}; renderEmployees(); });

window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('border-maroon-700', 'text-maroon-700', 'font-bold');
        b.classList.add('border-transparent');
    });
    $(`page-${tabName}`).classList.remove('hidden');
    const activeBtn = $(`tab-${tabName}`);
    activeBtn.classList.add('border-maroon-700', 'text-maroon-700', 'font-bold');
    activeBtn.classList.remove('border-transparent');
};

window.setChartMode = (mode) => {
    currentChartMode = mode;
    ['daily', 'weekly', 'monthly', 'yearly'].forEach(m => {
        const btn = $(`btn-chart-${m}`);
        if (btn) btn.className = m === mode ? 'px-3 py-1.5 rounded-md bg-white text-maroon-700 shadow font-bold transition' : 'px-3 py-1.5 rounded-md text-gray-600 hover:text-maroon-700 transition';
    });
    renderFinancialReports();
};

window.toggleCardCollapse = (key) => {
    cardExpandedState[key] = !cardExpandedState[key];
    renderServices();
};

function populateCrmDatalist() {
    const datalist = $('crmDatalist');
    if (!datalist) return;
    datalist.innerHTML = ''; crmMap = {};
    Object.keys(rawData.customers)
        .sort((a,b) => (rawData.customers[b].createdAt || 0) - (rawData.customers[a].createdAt || 0))
        .forEach(k => {
            const c = rawData.customers[k];
            const labelText = `${c.name || c.nama || 'Customer'} - ${c.device || c.perangkat || 'Perangkat'}`;
            crmMap[labelText] = k;
            datalist.appendChild(new Option('', labelText));
        });
}

window.autoFillCustomerData = () => {
    const c = rawData.customers[crmMap[getVal('searchCrmCustomer').trim()]];
    $('customerPhone').value = c ? (c.phone || c.whatsapp || c.noHp || '') : '';
    $('deviceUnit').value = c ? (c.device || c.perangkat || '') : '';
};

function populateStockDropdown() {
    const dropdown = $('transSelectStock');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">-- Pilih Barang dari Stok --</option>';
    Object.keys(rawData.stocks).forEach(k => {
        const i = rawData.stocks[k];
        dropdown.appendChild(new Option(`${i.name || i.nama} (Sisa: ${i.qty || 0} Pcs) - Rp ${Number(i.price || i.harga || 0).toLocaleString('id-ID')}`, k));
    });
}

window.autoFillStockPrice = () => {
    const i = rawData.stocks[getVal('transSelectStock')];
    $('transUnitPrice').value = i ? (i.price || i.harga || 0) : '';
    calculateTransTotal();
};

window.calculateTransTotal = () => {
    $('transTotalPrice').value = (parseInt(getVal('transUnitPrice')) || 0) * (parseInt(getVal('transQty')) || 1);
};

// Form Submit Listeners
$('customer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    push(refs.customers, {
        name: getVal('crmName'), phone: getVal('crmPhone'), device: getVal('crmDevice'),
        source: getVal('crmSource'), note: getVal('crmNote'), chatDate: getVal('crmDate') || todayStr, createdAt: Date.now()
    }).then(() => { $('customer-form').reset();$('crmDate').value = todayStr; alert('Customer Berhasil Ditambahkan ke CRM!'); });
});

$('service-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const searchVal = getVal('searchCrmCustomer').trim();
    const custKey = crmMap[searchVal];
    const custName = custKey && rawData.customers[custKey] ? (rawData.customers[custKey].name || rawData.customers[custKey].nama) : searchVal.split(' - ')[0];

    push(refs.services, {
        customerName: custName || 'Customer', customerPhone: getVal('customerPhone'), deviceUnit: getVal('deviceUnit'),
        deviceIssue: getVal('deviceIssue'), serviceInDate: getVal('serviceInDate') || todayStr, serviceOutDate: '',
        arrivalType: getVal('arrivalType'), techType: getVal('techType'), estimatedCost: parseInt(getVal('estimatedCost')) || 0,
        status: 'Service Masuk', createdAt: Date.now()
    }).then(() => { $('service-form').reset(); $('searchCrmCustomer').value = '';$('serviceInDate').value = todayStr; });
});

$('stock-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    push(refs.stocks, {
        category: getVal('stockCategory'), name: getVal('stockName'),
        price: parseInt(getVal('stockPrice')) || 0, qty: parseInt(getVal('stockQty')) || 0
    }).then(() => $('stock-form').reset());
});

$('trans-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const stockKey = getVal('transSelectStock');
    const item = rawData.stocks[stockKey];
    if (!item) return alert('Silakan pilih produk yang tersedia dari stok!');
    const buyQty = parseInt(getVal('transQty')) || 1;
    const currentQty = parseInt(item.qty || item.stok || 0);
    if (buyQty > currentQty) return alert(`Stok tidak mencukupi! Stok saat ini hanya ${currentQty} Pcs.`);

    const searchVal = getVal('transSearchCust').trim();
    const custKey = crmMap[searchVal];
    const custName = custKey && rawData.customers[custKey] ? (rawData.customers[custKey].name || rawData.customers[custKey].nama) : searchVal.split(' - ')[0];

    push(refs.transactions, {
        customerName: custName || 'Customer Toko', productKey: stockKey, productName: item.name || item.nama,
        category: item.category || 'Barang', qty: buyQty, unitPrice: parseInt(getVal('transUnitPrice')) || 0,
        totalPrice: parseInt(getVal('transTotalPrice')) || 0, transDate: getVal('transDate') || todayStr, createdAt: Date.now()
    }).then(() => {
        update(ref(db, `inventory_stocks/${stockKey}`), { qty: Math.max(0, currentQty - buyQty) });
        $('trans-form').reset(); $('transSearchCust').value = '';$('transDate').value = todayStr;
        alert('Transaksi Penjualan Berhasil Disimpan & Stok Berhasil Dipotong!');
    });
});

$('emp-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    push(refs.employees, {
        name: getVal('empName'), address: getVal('empAddress'), dob: getVal('empDob'), edu: getVal('empEdu'),
        role: getVal('empRole'), salary: parseInt(getVal('empSalary')) || 0, allowance: parseInt(getVal('empAllowance')) || 0
    }).then(() => $('emp-form').reset());
});

// Edit Form Submit Listeners
$('edit-crm-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = getVal('editCrmKey'); if(!key) return;
    update(ref(db, `crm_customers/${key}`), {
        name: getVal('editCrmName'), phone: getVal('editCrmPhone'), device: getVal('editCrmDevice'),
        source: getVal('editCrmSource'), note: getVal('editCrmNote'), chatDate: getVal('editCrmDate')
    }).then(() => { toggleModal('edit-crm-modal', false); alert('Data Customer CRM Berhasil Diperbarui!'); });
});

$('edit-service-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = getVal('editServiceKey'); if(!key) return;
    update(ref(db, `service_orders/${key}`), {
        customerName: getVal('editServiceCustName'), customerPhone: getVal('editServiceCustPhone'),
        deviceUnit: getVal('editServiceDevice'), deviceIssue: getVal('editServiceIssue'),
        serviceInDate: getVal('editServiceInDate'), serviceOutDate: getVal('editServiceOutDate'),
        arrivalType: getVal('editServiceArrival'), techType: getVal('editServiceTech'),
        estimatedCost: parseInt(getVal('editServiceCost')) || 0
    }).then(() => { toggleModal('edit-service-modal', false); alert('Kartu Service Berhasil Diperbarui!'); });
});

$('edit-stock-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = getVal('editStockKey'); if(!key) return;
    update(ref(db, `inventory_stocks/${key}`), {
        category: getVal('editStockCategory'), name: getVal('editStockName'),
        price: parseInt(getVal('editStockPrice')) || 0, qty: parseInt(getVal('editStockQty')) || 0
    }).then(() => { toggleModal('edit-stock-modal', false); alert('Data Stok Produk Berhasil Diperbarui!'); });
});

// Unified Export Excel
window.exportToExcel = (type) => {
    let data = [], fileName = '', sheetName = '';
    if (type === 'crm') {
        const keys = Object.keys(rawData.customers);
        if (!keys.length) return alert('Belum ada data customer!');
        sheetName = "Database CRM"; fileName = `Database_Customer_CRM_PSC_${todayStr}.xlsx`;
        data = keys.map((k, i) => ({
            "No": i + 1, "Nama Customer": rawData.customers[k].name || '', "No WhatsApp": rawData.customers[k].phone || '',
            "Perangkat / Laptop": rawData.customers[k].device || '', "Asal Customer": rawData.customers[k].source || 'Google Maps',
            "Catatan Chat": rawData.customers[k].note || '', "Tanggal Chat": formatDate(rawData.customers[k].chatDate || rawData.customers[k].createdAt)
        }));
    } else if (type === 'service') {
        const keys = Object.keys(rawData.services).reverse();
        if (!keys.length) return alert('Belum ada data service!');
        sheetName = "Rangkuman Service"; fileName = `Rangkuman_Data_Service_PSC_${todayStr}.xlsx`;
        data = keys.map((k, i) => {
            const s = rawData.services[k];
            return {
                "No": i + 1, "ID Service": `#PSC-${k.substring(1, 6).toUpperCase()}`, "Nama Customer": s.customerName || '',
                "No WhatsApp": s.customerPhone || '', "Type Laptop": s.deviceUnit || '', "Kendala / Kerusakan": s.deviceIssue || '',
                "Tgl Masuk": formatDate(s.serviceInDate || s.createdAt), "Tgl Keluar": formatDate(s.serviceOutDate),
                "Kedatangan": s.arrivalType || 'Langsung Toko', "Teknisi": s.techType || 'Internal',
                "Nominal Biaya (Rp)": Number(s.estimatedCost ?? (s.cost || s.biaya || 0)),
                "Status saat ini": s.status === 'Diambil' ? 'Selesai Service' : (s.status || 'Service Masuk')
            };
        });
    } else if (type === 'stocks') {
        const keys = Object.keys(rawData.stocks).reverse();
        if (!keys.length) return alert('Belum ada data stok!');
        sheetName = "Katalog Stok Produk"; fileName = `Katalog_Stok_Produk_PSC_${todayStr}.xlsx`;
        data = keys.map((k, i) => ({
            "No": i + 1, "Kategori": rawData.stocks[k].category || 'Sparepart', "Nama Produk / Unit": rawData.stocks[k].name || '',
            "Harga Jual (Rp)": Number(rawData.stocks[k].price || 0), "Sisa Stok (Pcs)": Number(rawData.stocks[k].qty || 0)
        }));
    } else if (type === 'transactions') {
        const keys = Object.keys(rawData.transactions).reverse();
        if (!keys.length) return alert('Belum ada transaksi!');
        sheetName = "Transaksi Penjualan"; fileName = `Rekap_Transaksi_Produk_PSC_${todayStr}.xlsx`;
        data = keys.map((k, i) => ({
            "No": i + 1, "ID Transaksi": `#TRX-${k.substring(1, 6).toUpperCase()}`, "Nama Pembeli": rawData.transactions[k].customerName || '',
            "Nama Produk": rawData.transactions[k].productName || '', "Kategori": rawData.transactions[k].category || '',
            "Jumlah (Qty)": rawData.transactions[k].qty || 0, "Harga Satuan (Rp)": Number(rawData.transactions[k].unitPrice || 0),
            "Total Bayar (Rp)": Number(rawData.transactions[k].totalPrice || 0), "Tanggal": formatDate(rawData.transactions[k].transDate || rawData.transactions[k].createdAt)
        }));
    }
    const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
};

// Generic Receipt Printer
function printReceipt(config) {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(`
        <!DOCTYPE html><html><head><title>${config.title}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }
            .receipt-box { border: 2px solid #800000; padding: 20px; border-radius: 10px; max-width: 700px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #800000; padding-bottom: 12px; margin-bottom: 15px; }
            .header h1 { margin: 0; color: #800000; font-size: 20px; }
            .header p { margin: 3px 0; font-size: 11px; color: #334155; }
            .title-badge { background: #800000; color: #fff; text-align: center; font-weight: bold; padding: 6px; border-radius: 5px; font-size: 13px; margin-bottom: 15px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 15px; }
            .info-item span { font-weight: bold; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background-color: #f1f5f9; }
            .terms { font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 15px; }
            .footer-signatures { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; font-size: 11px; }
            .sig-box { width: 140px; border-top: 1px solid #475569; margin-top: 45px; }
            @media print { body { padding: 0; } .receipt-box { border: none; } }
        </style></head><body>
            <div class="receipt-box">
                <div class="header">
                    <h1>PARAMOUNT STAR COMPUTER (PSC)</h1>
                    <p>Komplek Puri Indah Jatinangor Blok A3 nomor 21, Jalan sayang, Cikeruh, Jatinangor, Sumedang.</p>
                    <p>Whatsapp / hotline : 0851-8824-3665</p>
                </div>
                <div class="title-badge">${config.badge}</div>
                <div class="info-grid">${config.infoHtml}</div>
                <table>${config.tableHtml}</table>
                ${config.termsHtml || ''}
                <div class="footer-signatures">
                    <div>Customer / Pemilik Unit<div class="sig-box">( ${config.custName} )</div></div>
                    <div>Kasir / Teknisi PSC<div class="sig-box">( Paramount Star Computer )</div></div>
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); };
            </` + `script>
        </body></html>
    `);
    printWindow.document.close();
}

window.printServiceReceipt = (key, receiptType) => {
    const s = rawData.services[key]; if (!s) return;
    const custName = s.customerName || s.name || s.nama || 'Customer';
    const totalCost = Number(s.estimatedCost ?? (s.cost || s.biaya || 0));
    const serviceId = `#PSC-${key.substring(1, 6).toUpperCase()}`;

    let dpAmount = 0;
    if (receiptType === 'handover') {
        const dpPrompt = prompt(`Masukkan Nominal DP (0 jika belum ada):`, "0");
        if (dpPrompt !== null) dpAmount = parseInt(dpPrompt) || 0;
    }
    const remainingBalance = Math.max(0, totalCost - dpAmount);

    printReceipt({
        title: `${receiptType === 'handover' ? 'NOTA BUKTI SERAH TERIMA' : 'NOTA PELUNASAN'} ${serviceId}`,
        badge: receiptType === 'handover' ? 'NOTA BUKTI SERAH TERIMA UNIT SERVICE' : 'NOTA BUKTI PELUNASAN & SELESAI SERVICE',
        custName: custName,
        infoHtml: `
            <div>
                <div class="info-item"><span>ID Service:</span> ${serviceId}</div>
                <div class="info-item"><span>Nama Customer:</span> ${custName}</div>
                <div class="info-item"><span>No WhatsApp:</span> ${s.customerPhone || '-'}</div>
            </div>
            <div>
                <div class="info-item"><span>Tanggal Masuk:</span> ${formatDate(s.serviceInDate)}</div>
                <div class="info-item"><span>Tanggal Keluar:</span> ${formatDate(s.serviceOutDate)}</div>
                <div class="info-item"><span>Status:</span> <strong>${receiptType === 'handover' ? (s.status || 'Unit Diterima') : 'Selesai Service'}</strong></div>
            </div>
        `,
        tableHtml: `
            <thead><tr><th>Perangkat / Unit</th><th>Kendala / Perbaikan</th><th style="text-align: right;">Biaya (Rp)</th></tr></thead>
            <tbody>
                <tr><td><strong>${s.deviceUnit || '-'}</strong></td><td>${s.deviceIssue || '-'}</td><td style="text-align: right;">Rp ${totalCost.toLocaleString('id-ID')}</td></tr>
                <tr style="font-weight:bold; background:#fef3c7; color:#92400e;"><td colspan="2" style="text-align: right;">TOTAL:</td><td style="text-align: right;">Rp ${totalCost.toLocaleString('id-ID')}</td></tr>
                ${receiptType === 'handover' ? `
                    <tr style="font-weight:bold; background:#e0f2fe; color:#0369a1;"><td colspan="2" style="text-align: right;">DP DITERIMA:</td><td style="text-align: right;">Rp ${dpAmount.toLocaleString('id-ID')}</td></tr>
                    <tr style="font-weight:bold; background:#dcfce7; color:#15803d;"><td colspan="2" style="text-align: right;">SISA ESTIMASI:</td><td style="text-align: right;">Rp ${remainingBalance.toLocaleString('id-ID')}</td></tr>
                ` : ''}
            </tbody>
        `,
        termsHtml: `<div class="terms"><strong>Syarat Garansi:</strong> 1. Berlaku 30 hari. 2. Batal jika segel rusak, kena cairan, jatuh. 3. Wajib bawa nota ini.</div>`
    });
};

window.printTransactionReceipt = (key) => {
    const t = rawData.transactions[key]; if (!t) return;
    const custName = t.customerName || 'Customer';
    const totalPrice = Number(t.totalPrice || 0);
    const transId = `#TRX-${key.substring(1, 6).toUpperCase()}`;

    printReceipt({
        title: `Nota Penjualan ${transId}`,
        badge: 'NOTA PENJUALAN PRODUK / SPAREPART',
        custName: custName,
        infoHtml: `
            <div><div class="info-item"><span>No Transaksi:</span> ${transId}</div><div class="info-item"><span>Nama Pembeli:</span> ${custName}</div></div>
            <div><div class="info-item"><span>Tanggal:</span> ${formatDate(t.transDate || t.createdAt)}</div><div class="info-item"><span>Status:</span> <strong style="color:#15803d;">LUNAS</strong></div></div>
        `,
        tableHtml: `
            <thead><tr><th>Produk</th><th style="text-align: center;">Qty</th><th style="text-align: right;">Harga Satuan</th><th style="text-align: right;">Subtotal</th></tr></thead>
            <tbody>
                <tr><td><strong>${t.productName || 'Produk'}</strong></td><td style="text-align: center;">${t.qty || 1} Pcs</td><td style="text-align: right;">Rp ${Number(t.unitPrice || 0).toLocaleString('id-ID')}</td><td style="text-align: right;">Rp ${totalPrice.toLocaleString('id-ID')}</td></tr>
                <tr style="font-weight:bold; background:#dcfce7; color:#15803d;"><td colspan="3" style="text-align: right;">TOTAL BAYAR:</td><td style="text-align: right;">Rp ${totalPrice.toLocaleString('id-ID')}</td></tr>
            </tbody>
        `
    });
};

// Open Modal Handlers
window.openEditCrmModal = (key) => {
    const c = rawData.customers[key]; if (!c) return;
    $('editCrmKey').value = key; $('editCrmName').value = c.name \vert{}\vert{} c.nama \vert{}\vert{} '';$('editCrmPhone').value = c.phone || c.whatsapp || ''; $('editCrmDevice').value = c.device \vert{}\vert{} c.perangkat \vert{}\vert{} '';$('editCrmSource').value = c.source || 'Google Maps'; $('editCrmNote').value = c.note \vert{}\vert{} c.catatan \vert{}\vert{} '';$('editCrmDate').value = c.chatDate || (c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : todayStr);
    toggleModal('edit-crm-modal', true);
};

window.openEditServiceModal = (key) => {
    const s = rawData.services[key]; if (!s) return;
    $('editServiceKey').value = key; $('editServiceCustName').value = s.customerName || '';
    $('editServiceCustPhone').value = s.customerPhone \vert{}\vert{} '';$('editServiceDevice').value = s.deviceUnit || '';
    $('editServiceIssue').value = s.deviceIssue \vert{}\vert{} '';$('editServiceInDate').value = s.serviceInDate || todayStr;
    $('editServiceOutDate').value = s.serviceOutDate \vert{}\vert{} '';$('editServiceArrival').value = s.arrivalType || 'Langsung';
    $('editServiceTech').value = s.techType \vert{}\vert{} 'Internal';$('editServiceCost').value = s.estimatedCost ?? (s.cost || 0);
    toggleModal('edit-service-modal', true);
};

window.openEditStockModal = (key) => {
    const i = rawData.stocks[key]; if (!i) return;
    $('editStockKey').value = key; $('editStockCategory').value = i.category || 'Sparepart';
    $('editStockName').value = i.name \vert{}\vert{} i.nama \vert{}\vert{} '';$('editStockPrice').value = i.price || 0;
    $('editStockQty').value = i.qty || 0;
    toggleModal('edit-stock-modal', true);
};

// Render Kanban Board Cards
function renderServices() {
    const cols = { 'Service Masuk': $('col-masuk'), 'Proses': $('col-proses'), 'Selesai':$('col-selesai'), 'Konfirmasi': $('col-konfirmasi'), 'Diambil':$('col-diambil'), 'Garansi': $('col-garansi'), 'Batal':$('col-batal') };
    const counts = { 'Service Masuk': 0, 'Proses': 0, 'Selesai': 0, 'Konfirmasi': 0, 'Diambil': 0, 'Garansi': 0, 'Batal': 0 };
    Object.values(cols).forEach(c => { if(c) c.innerHTML = ''; });

    const query = (getVal('searchBoard')).toLowerCase();
    Object.keys(rawData.services).reverse().forEach(k => {
        const s = rawData.services[k];
        const custName = s.customerName || s.name || s.nama || 'Customer';
        const device = s.deviceUnit || s.device || s.perangkat || '-';
        if (!custName.toLowerCase().includes(query) && !device.toLowerCase().includes(query)) return;

        let st = s.status || 'Service Masuk';
        if (!cols[st]) st = 'Service Masuk';
        counts[st]++;

        const cost = Number(s.estimatedCost ?? (s.cost || s.biaya || 0));
        const cleanPhone = (s.customerPhone || s.phone || '').replace(/[^0-9]/g, '');
        const waMsg = encodeURIComponent(`Halo Kak ${custName}, update unit ${device}: *${st === 'Diambil' ? 'Selesai Service' : st}*. Biaya: Rp ${cost.toLocaleString('id-ID')}.`);
        const isExpanded = cardExpandedState[k] || false;

        const card = document.createElement('div');
        card.className = 'bg-slate-800 rounded-lg p-3 border border-slate-700 shadow hover:border-amber-500 transition text-xs space-y-2';
        card.innerHTML = `
            <div class="flex justify-between items-start font-bold text-white">
                <div>
                    <span>${custName}</span>
                    <div class="text-[10px] text-amber-300 font-normal flex flex-wrap gap-1.5 mt-0.5">
                        <span><i class="fa-regular fa-calendar-check text-[9px]"></i> Masuk: ${formatDate(s.serviceInDate || s.createdAt)}</span>
                        ${s.serviceOutDate ? `<span class="text-emerald-400 font-semibold"><i class="fa-solid fa-flag-checkered text-[9px]"></i> Out: ${formatDate(s.serviceOutDate)}</span>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1.5">
                    <a href="https://wa.me/${cleanPhone}?text=${waMsg}" target="_blank" class="text-green-400 p-1" title="WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></a>
                    <button onclick="toggleCardCollapse('${k}')" class="text-slate-400 hover:text-amber-400 p-1"><i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs"></i></button>
                </div>
            </div>
            <div class="text-slate-300 font-semibold flex justify-between items-center">
                <span>${device}</span>
                ${!isExpanded ? `<span class="text-amber-400 font-bold text-[11px]">Rp ${cost.toLocaleString('id-ID')}</span>` : ''}
            </div>
            <div class="${isExpanded ? 'block' : 'hidden'} space-y-2 pt-1 border-t border-slate-700/60">
                <div class="text-slate-400 italic text-[11px]">${s.deviceIssue || s.issue || '-'}</div>
                <div class="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-700/60">
                    <span>${s.techType || 'Internal'} | ${s.arrivalType || 'Toko'}</span>
                    <span class="font-bold text-amber-400 text-xs">Rp ${cost.toLocaleString('id-ID')}</span>
                </div>
                <div class="pt-1 flex justify-between items-center gap-1">
                    <select onchange="updateStatus('${k}', this.value)" class="w-full bg-slate-900 text-slate-200 border border-slate-700 rounded p-1 text-[10px]">
                        <option value="Service Masuk" ${st === 'Service Masuk' ? 'selected' : ''}>📥 Service Masuk</option>
                        <option value="Proses" ${st === 'Proses' ? 'selected' : ''}>🛠️ Dikerjakan Teknisi</option>
                        <option value="Selesai" ${st === 'Selesai' ? 'selected' : ''}>✅ Service Selesai</option>
                        <option value="Konfirmasi" ${st === 'Konfirmasi' ? 'selected' : ''}>📞 Konfirmasi Customer</option>
                        <option value="Diambil" ${st === 'Diambil' ? 'selected' : ''}>🤝 Diserahkan (Selesai Service)</option>
                        <option value="Garansi" ${st === 'Garansi' ? 'selected' : ''}>🛡️ Klaim Garansi (Rp 0)</option>
                        <option value="Batal" ${st === 'Batal' ? 'selected' : ''}>❌ Batal / Retur (Rp 0)</option>
                    </select>
                    <button onclick="openEditServiceModal('${k}')" class="text-amber-400 p-1"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteOrder('${k}')" class="text-rose-400 p-1"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
        if (cols[st]) cols[st].appendChild(card);
    });

    if($('cnt-masuk'))$('cnt-masuk').textContent = counts['Service Masuk']; 
    if($('cnt-proses'))$('cnt-proses').textContent = counts['Proses'];
    if($('cnt-selesai'))$('cnt-selesai').textContent = counts['Selesai']; 
    if($('cnt-konfirmasi'))$('cnt-konfirmasi').textContent = counts['Konfirmasi'];
    if($('cnt-diambil'))$('cnt-diambil').textContent = counts['Diambil']; 
    if($('cnt-garansi'))$('cnt-garansi').textContent = counts['Garansi'];
    if($('cnt-batal'))$('cnt-batal').textContent = counts['Batal'];
}

// Render Customers Table
function renderCustomers() {
    const body = $('customer-table-body'); if (!body) return;
    const query = getVal('searchCrmTable').toLowerCase().trim();
    const sortBy = getVal('sortCrmTable') || 'newest';

    let keys = Object.keys(rawData.customers).filter(k => {
        const c = rawData.customers[k];
        return !query || (c.name||'').toLowerCase().includes(query) || (c.phone||'').toLowerCase().includes(query) || (c.device||'').toLowerCase().includes(query) || (c.source||'').toLowerCase().includes(query) || (c.note||'').toLowerCase().includes(query);
    });

    keys.sort((a, b) => {
        const cA = rawData.customers[a], cB = rawData.customers[b];
        if (sortBy === 'newest') return getTimeValue(cB, 'chatDate') - getTimeValue(cA, 'chatDate');
        if (sortBy === 'oldest') return getTimeValue(cA, 'chatDate') - getTimeValue(cB, 'chatDate');
        if (sortBy === 'nameAsc') return (cA.name||'').localeCompare(cB.name||'');
        if (sortBy === 'nameDesc') return (cB.name||'').localeCompare(cA.name||'');
        return 0;
    });

    if (!keys.length) return body.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400">Tidak ada customer yang sesuai pencarian.</td></tr>`;

    const frag = document.createDocumentFragment();
    keys.forEach(k => {
        const c = rawData.customers[k];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 border-b';
        tr.innerHTML = `
            <td class="p-3 font-bold text-gray-800">${c.name || c.nama || 'Customer'}</td>
            <td class="p-3 text-gray-600">${c.phone || c.whatsapp || '-'}</td>
            <td class="p-3 font-medium text-gray-700">${c.device || c.perangkat || '-'}</td>
            <td class="p-3"><span class="px-2.5 py-1 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">${c.source || 'Google Maps'}</span></td>
            <td class="p-3 text-gray-500 italic">${c.note || c.catatan || '-'}</td>
            <td class="p-3 text-xs text-gray-600 font-semibold">${formatDate(c.chatDate || c.createdAt)}</td>
            <td class="p-3 text-center space-x-1.5">
                <a href="https://wa.me/${(c.phone||'').replace(/[^0-9]/g, '')}" target="_blank" class="px-2.5 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 inline-flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i> Chat Promo</a>
                <button onclick="openEditCrmModal('${k}')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded"><i class="fa-solid fa-pen-to-square text-base"></i></button>
                <button onclick="deleteCustomer('${k}')" class="p-1.5 text-red-500 hover:bg-red-50 rounded"><i class="fa-solid fa-trash-can text-base"></i></button>
            </td>
        `;
        frag.appendChild(tr);
    });
    body.innerHTML = ''; body.appendChild(frag);
}

// Render Summary Service Table
function renderSummaryTable() {
    const body = $('summary-service-table'); if (!body) return;
    const query = getVal('searchServiceTable').toLowerCase().trim();
    const sortBy = getVal('sortServiceTable') || 'newest';

    let keys = Object.keys(rawData.services).filter(k => {
        const s = rawData.services[k];
        const idCode = `#PSC-${k.substring(1, 6).toUpperCase()}`.toLowerCase();
        return !query || idCode.includes(query) || (s.customerName||'').toLowerCase().includes(query) || (s.deviceUnit||'').toLowerCase().includes(query) || (s.deviceIssue||'').toLowerCase().includes(query);
    });

    keys.sort((a, b) => {
        const sA = rawData.services[a], sB = rawData.services[b];
        if (sortBy === 'newest') return getTimeValue(sB, 'serviceInDate') - getTimeValue(sA, 'serviceInDate');
        if (sortBy === 'oldest') return getTimeValue(sA, 'serviceInDate') - getTimeValue(sB, 'serviceInDate');
        if (sortBy === 'nameAsc') return (sA.customerName||'').localeCompare(sB.customerName||'');
        if (sortBy === 'costDesc') return Number(sB.estimatedCost ?? (sB.cost||0)) - Number(sA.estimatedCost ?? (sA.cost||0));
        return 0;
    });

    if (!keys.length) return body.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400">Tidak ada data service yang cocok.</td></tr>`;

    const frag = document.createDocumentFragment();
    keys.forEach(k => {
        const s = rawData.services[k];
        const cost = Number(s.estimatedCost ?? (s.cost || s.biaya || 0));
        const rawStatus = s.status || 'Service Masuk';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-amber-50/50 border-b transition';
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-gray-500">#PSC-${k.substring(1, 6).toUpperCase()}</td>
            <td class="p-3 font-bold text-gray-800">${s.customerName || 'Customer'}</td>
            <td class="p-3 font-semibold text-gray-700">${s.deviceUnit || '-'}</td>
            <td class="p-3 text-gray-600 italic">${s.deviceIssue || '-'}</td>
            <td class="p-3 text-xs font-semibold text-amber-800"><span class="px-2 py-0.5 bg-amber-50 rounded border border-amber-200">${formatDate(s.serviceInDate || s.createdAt)}</span></td>
            <td class="p-3 text-xs font-semibold text-emerald-800"><span class="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">${formatDate(s.serviceOutDate)}</span></td>
            <td class="p-3 font-bold text-maroon-700">Rp ${cost.toLocaleString('id-ID')}</td>
            <td class="p-3"><span class="px-2.5 py-1 text-[11px] font-bold ${rawStatus === 'Diambil' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700'} rounded-full border">${rawStatus === 'Diambil' ? 'Selesai Service' : rawStatus}</span></td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="printServiceReceipt('${k}', 'handover')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shadow transition flex items-center gap-1"><i class="fa-solid fa-file-signature"></i> Nota Serah Terima</button>
                    <button onclick="printServiceReceipt('${k}', 'done')" class="px-2.5 py-1 bg-maroon-700 hover:bg-maroon-800 text-white rounded text-[11px] font-bold shadow transition flex items-center gap-1"><i class="fa-solid fa-print"></i> Nota Selesai</button>
                </div>
            </td>
        `;
        frag.appendChild(tr);
    });
    body.innerHTML = ''; body.appendChild(frag);
}

// Render Stocks Table
function renderStocks() {
    const body = $('stock-table-body'); if (!body) return;
    const query = getVal('searchStockTable').toLowerCase().trim();
    const sortBy = getVal('sortStockTable') || 'newest';

    let keys = Object.keys(rawData.stocks).filter(k => {
        const i = rawData.stocks[k];
        return !query || (i.name||'').toLowerCase().includes(query) || (i.category||'').toLowerCase().includes(query);
    });

    keys.sort((a, b) => {
        const iA = rawData.stocks[a], iB = rawData.stocks[b];
        if (sortBy === 'newest') return b.localeCompare(a);
        if (sortBy === 'nameAsc') return (iA.name||'').localeCompare(iB.name||'');
        if (sortBy === 'priceDesc') return Number(iB.price||0) - Number(iA.price||0);
        if (sortBy === 'priceAsc') return Number(iA.price||0) - Number(iB.price||0);
        if (sortBy === 'qtyDesc') return Number(iB.qty||0) - Number(iA.qty||0);
        if (sortBy === 'qtyAsc') return Number(iA.qty||0) - Number(iB.qty||0);
        return 0;
    });

    if (!keys.length) return body.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada produk yang cocok dengan pencarian.</td></tr>`;

    const frag = document.createDocumentFragment();
    keys.forEach(k => {
        const i = rawData.stocks[k];
        const qty = Number(i.qty || 0);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 border-b';
        tr.innerHTML = `
            <td class="p-3 font-bold text-xs"><span class="px-2 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">${i.category || 'Sparepart'}</span></td>
            <td class="p-3 font-semibold text-gray-800">${i.name || 'Produk'}</td>
            <td class="p-3 text-maroon-700 font-bold">Rp ${Number(i.price || 0).toLocaleString('id-ID')}</td>
            <td class="p-3 font-semibold ${qty < 3 ? 'text-red-500 font-bold' : 'text-gray-700'}">${qty} Pcs</td>
            <td class="p-3 text-center space-x-1.5">
                <button onclick="openEditStockModal('${k}')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded"><i class="fa-solid fa-pen-to-square text-base"></i></button>
                <button onclick="deleteStock('${k}')" class="p-1.5 text-red-500 hover:bg-red-50 rounded"><i class="fa-solid fa-trash-can text-base"></i></button>
            </td>
        `;
        frag.appendChild(tr);
    });
    body.innerHTML = ''; body.appendChild(frag);
}

// Render Transactions Table
function renderTransactions() {
    const body = $('trans-table-body'); if (!body) return;
    const query = getVal('searchTransTable').toLowerCase().trim();
    const sortBy = getVal('sortTransTable') || 'newest';

    let keys = Object.keys(rawData.transactions).filter(k => {
        const t = rawData.transactions[k];
        const trxCode = `#TRX-${k.substring(1, 6).toUpperCase()}`.toLowerCase();
        return !query || trxCode.includes(query) || (t.customerName||'').toLowerCase().includes(query) || (t.productName||'').toLowerCase().includes(query);
    });

    keys.sort((a, b) => {
        const tA = rawData.transactions[a], tB = rawData.transactions[b];
        if (sortBy === 'newest') return getTimeValue(tB, 'transDate') - getTimeValue(tA, 'transDate');
        if (sortBy === 'oldest') return getTimeValue(tA, 'transDate') - getTimeValue(tB, 'transDate');
        if (sortBy === 'priceDesc') return Number(tB.totalPrice||0) - Number(tA.totalPrice||0);
        if (sortBy === 'nameAsc') return (tA.customerName||'').localeCompare(tB.customerName||'');
        return 0;
    });

    if (!keys.length) return body.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400">Tidak ada riwayat transaksi yang cocok.</td></tr>`;

    const frag = document.createDocumentFragment();
    keys.forEach(k => {
        const t = rawData.transactions[k];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-emerald-50/50 border-b transition';
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-gray-500">#TRX-${k.substring(1, 6).toUpperCase()}</td>
            <td class="p-3 font-bold text-gray-800">${t.customerName || 'Customer'}</td>
            <td class="p-3 font-semibold text-gray-700">${t.productName || 'Produk'}</td>
            <td class="p-3 text-center font-bold text-gray-800">${t.qty || 1} Pcs</td>
            <td class="p-3 font-extrabold text-emerald-700">Rp ${Number(t.totalPrice || 0).toLocaleString('id-ID')}</td>
            <td class="p-3 text-xs font-semibold text-amber-800"><span class="px-2 py-0.5 bg-amber-50 rounded border border-amber-200">${formatDate(t.transDate || t.createdAt)}</span></td>
            <td class="p-3 text-center space-x-1">
                <button onclick="printTransactionReceipt('${k}')" class="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 inline-flex"><i class="fa-solid fa-print"></i> Print Nota</button>
                <button onclick="deleteTransaction('${k}')" class="p-1 text-red-500 hover:text-red-700"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        frag.appendChild(tr);
    });
    body.innerHTML = ''; body.appendChild(frag);
}

// Render Employees Table
function renderEmployees() {
    const body = $('emp-table-body'); if (!body) return;
    const keys = Object.keys(rawData.employees);
    if (!keys.length) return body.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">Belum ada karyawan.</td></tr>`;

    const frag = document.createDocumentFragment();
    keys.forEach(k => {
        const e = rawData.employees[k];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 border-b';
        tr.innerHTML = `
            <td class="p-2.5"><div class="font-bold text-gray-800">${e.name}</div><div class="text-[11px] text-gray-500">${e.role}</div></td>
            <td class="p-2.5"><div>${e.edu}</div><div class="text-[11px] text-gray-400">Lahir: ${e.dob}</div></td>
            <td class="p-2.5"><div class="font-semibold text-green-700">Gapok: Rp ${Number(e.salary||0).toLocaleString('id-ID')}</div></td>
            <td class="p-2.5 text-center"><button onclick="deleteEmployee('${k}')" class="p-1 text-red-500"><i class="fa-solid fa-trash-can"></i></button></td>
        `;
        frag.appendChild(tr);
    });
    body.innerHTML = ''; body.appendChild(frag);
}

// Financial Reports & Chart Rendering
function renderFinancialReports() {
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear(), currentMonth = now.getMonth(), currentWeekNum = getWeekNumber(now);

    if($('label-week-number'))$('label-week-number').textContent = `Minggu ke-${currentWeekNum} tahun ini`;
    let daily = 0, weekly = 0, monthly = 0, yearly = 0;
    const daysMap = {}, weeksMap = {}, monthsMap = Array(12).fill(0), yearsMap = {}, dayLabels = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(now.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        daysMap[iso] = 0;
        dayLabels.push({ iso, lbl: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) });
    }
    for (let w = 1; w <= currentWeekNum; w++) weeksMap[w] = 0;

    const processIncome = (cost, itemDate, itemISO) => {
        if (!itemDate) return;
        const yr = itemDate.getFullYear(), mo = itemDate.getMonth(), wk = getWeekNumber(itemDate);
        if (itemISO === todayISO) daily += cost;
        if (yr === currentYear && wk === currentWeekNum) weekly += cost;
        if (yr === currentYear && mo === currentMonth) monthly += cost;
        if (yr === currentYear) yearly += cost;

        if (daysMap[itemISO] !== undefined) daysMap[itemISO] += cost;
        if (yr === currentYear) {
            weeksMap[wk] = (weeksMap[wk] || 0) + cost;
            monthsMap[mo] += cost;
        }
        yearsMap[yr] = (yearsMap[yr] || 0) + cost;
    };

    Object.values(rawData.services).forEach(s => {
        if (s.status === 'Batal') return;
        const cost = Number(s.estimatedCost ?? (s.cost || s.biaya || 0));
        let itemDate = null, itemISO = s.serviceInDate || '';
        if (s.serviceInDate) {
            const p = s.serviceInDate.split('-');
            if (p.length === 3) itemDate = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
        } else if (s.createdAt) {
            itemDate = new Date(s.createdAt); itemISO = itemDate.toISOString().split('T')[0];
        }
        processIncome(cost, itemDate, itemISO);
    });

    Object.values(rawData.transactions).forEach(t => {
        const cost = Number(t.totalPrice || t.total || 0);
        let itemDate = null, itemISO = t.transDate || '';
        if (t.transDate) {
            const p = t.transDate.split('-');
            if (p.length === 3) itemDate = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
        } else if (t.createdAt) {
            itemDate = new Date(t.createdAt); itemISO = itemDate.toISOString().split('T')[0];
        }
        processIncome(cost, itemDate, itemISO);
    });

    if($('sum-daily'))$('sum-daily').textContent = `Rp ${daily.toLocaleString('id-ID')}`;
    if($('sum-weekly'))$('sum-weekly').textContent = `Rp ${weekly.toLocaleString('id-ID')}`;
    if($('sum-monthly'))$('sum-monthly').textContent = `Rp ${monthly.toLocaleString('id-ID')}`;
    if($('sum-yearly'))$('sum-yearly').textContent = `Rp ${yearly.toLocaleString('id-ID')}`;

    let chartLabels = [], chartData = [], barColor = '#3b82f6';
    if (currentChartMode === 'daily') {
        chartLabels = dayLabels.map(i => i.lbl); chartData = dayLabels.map(i => daysMap[i.iso] || 0); barColor = '#f59e0b';
    } else if (currentChartMode === 'weekly') {
        const weekKeys = Object.keys(weeksMap).sort((a,b) => parseInt(a) - parseInt(b));
        chartLabels = weekKeys.map(w => `Minggu ${w}`); chartData = weekKeys.map(w => weeksMap[w]); barColor = '#3b82f6';
    } else if (currentChartMode === 'monthly') {
        chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
        chartData = monthsMap; barColor = '#16a34a';
    } else if (currentChartMode === 'yearly') {
        const yearKeys = Object.keys(yearsMap).sort((a,b) => parseInt(a) - parseInt(b));
        if (!yearKeys.length) yearKeys.push(currentYear.toString());
        chartLabels = yearKeys.map(y => `Tahun ${y}`); chartData = yearKeys.map(y => yearsMap[y] || 0); barColor = '#9333ea';
    }

    const chartCanvas = $('chartRevenueReport');
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: chartLabels, datasets: [{ label: 'Omset Service & Penjualan (Rp)', data: chartData, backgroundColor: barColor, borderRadius: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` Total: Rp ${Number(c.raw || 0).toLocaleString('id-ID')}` } } },
            scales: { y: { beginAtZero: true, ticks: { callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k' } } }
        }
    });
}

window.updateStatus = (id, newStatus) => {
    const currentService = rawData.services[id];
    const currentCost = currentService ? Number(currentService.estimatedCost ?? (currentService.cost || currentService.biaya || 0)) : 0;
    const updateData = { status: newStatus };

    if (newStatus === 'Diambil') updateData.serviceOutDate = todayStr;
    else if (newStatus === 'Batal' || newStatus === 'Garansi') updateData.estimatedCost = 0;
    else if (newStatus === 'Konfirmasi') {
        const promptVal = prompt(`Unit dipindah ke status "Konfirmasi Customer".\nEstimasi Biaya Awal: Rp ${currentCost.toLocaleString('id-ID')}\n\nMasukkan BIAYA REAL / BARU jika ada perubahan:`, currentCost);
        if (promptVal !== null && promptVal.trim() !== '') {
            const parsed = parseInt(promptVal);
            if (!isNaN(parsed) && parsed >= 0) updateData.estimatedCost = parsed;
        }
    }
    update(ref(db, `service_orders/${id}`), updateData);
};

// Global Delete Handlers
window.deleteCustomer = (id) => confirm('Hapus customer dari CRM?') && remove(ref(db, `crm_customers/${id}`));
window.deleteOrder = (id) => confirm('Hapus kartu servis ini?') && remove(ref(db, `service_orders/${id}`));
window.deleteStock = (id) => confirm('Hapus produk/laptop ini?') && remove(ref(db, `inventory_stocks/${id}`));
window.deleteTransaction = (id) => confirm('Hapus riwayat transaksi ini?') && remove(ref(db, `product_transactions/${id}`));
window.deleteEmployee = (id) => confirm('Hapus karyawan ini?') && remove(ref(db, `owner_employees/${id}`));

// Export Fungsi Render ke Window Global
window.renderCustomers = renderCustomers;
window.renderServices = renderServices;
window.renderSummaryTable = renderSummaryTable;
window.renderStocks = renderStocks;
window.renderTransactions = renderTransactions;
