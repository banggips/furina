// Mencegah Klik Kanan
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 1. Mencegah Shortcut Keyboard (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
document.onkeydown = function(e) {
    if (e.keyCode == 123) { // F12
        return false;
    }
    if (e.ctrlKey && e.shiftKey && (e.keyCode == 'I'.charCodeAt(0) || e.keyCode == 'J'.charCodeAt(0))) {
        return false;
    }
    if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) {
        return false;
    }
};

// 2. Deteksi Jika DevTools Terbuka (Anti-Debugging)
// Jika seseorang berhasil membuka konsol, script ini akan membuat loop debugger
// yang menghambat kinerja konsol mereka.
setInterval(function() {
    const start = performance.now();
    debugger; 
    const end = performance.now();
    if (end - start > 100) {
        // Jika debugger memicu jeda lama, kemungkinan besar DevTools sedang terbuka
        console.clear();
    }
}, 1000);

// Mencegah shortcut keyboard untuk copy (Ctrl+C, Ctrl+U, dll)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'c' || e.key === 'u' || e.key === 's' || e.key === 'a')) {
        e.preventDefault();
    }
});