class LogoutManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupLogoutHandler();
        this.preventCaching();
        this.setupBeforeUnload();
    }

    setupLogoutHandler() {
        const logoutBtn = document.getElementById('logoutBtn');
        const logoutModal = document.getElementById('logoutModal');
        const cancelLogout = document.getElementById('cancelLogout');
        const confirmLogout = document.getElementById('confirmLogout');

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLogoutModal();
            });
        }

        if (cancelLogout) {
            cancelLogout.addEventListener('click', () => {
                this.hideLogoutModal();
            });
        }

        if (confirmLogout) {
            confirmLogout.addEventListener('click', () => {
                this.performLogout();
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === logoutModal) {
                this.hideLogoutModal();
            }
        });
    }

    showLogoutModal() {
        const modal = document.getElementById('logoutModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideLogoutModal() {
        const modal = document.getElementById('logoutModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async performLogout() {
        try {
            await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                credentials: 'include'
            });

            this.clearClientData();
            this.redirectToLogin();
            
        } catch (error) {
            console.error('Logout error:', error);
            this.redirectToLogin();
        }
    }

    clearClientData() {
        localStorage.clear();
        sessionStorage.clear();
        
        if (window.caches) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }

        if (window.indexedDB) {
            indexedDB.databases().then(databases => {
                databases.forEach(db => {
                    if (db.name) indexedDB.deleteDatabase(db.name);
                });
            });
        }
    }

    redirectToLogin() {
        window.location.replace('/login');
        
        window.history.pushState(null, null, window.location.href);
        window.addEventListener('popstate', () => {
            window.history.pushState(null, null, window.location.href);
            window.location.replace('/login');
        });
    }

    preventCaching() {
        if (window.performance && window.performance.navigation.type === 2) {
            window.location.reload();
        }
    }

    setupBeforeUnload() {
        window.addEventListener('beforeunload', () => {
            sessionStorage.setItem('lastActivity', Date.now().toString());
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LogoutManager();
});