/**
 * RentFlow API Client
 * Frontend integration with backend API
 */

// Use localhost for local development, or change to your server URL
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : 'https://your-domain.com/api';

// Token management
const TokenManager = {
    getToken: () => localStorage.getItem('rentflow_token'),
    setToken: (token) => localStorage.setItem('rentflow_token', token),
    removeToken: () => localStorage.removeItem('rentflow_token'),
    getUser: () => JSON.parse(localStorage.getItem('rentflow_user') || 'null'),
    setUser: (user) => localStorage.setItem('rentflow_user', JSON.stringify(user)),
    removeUser: () => localStorage.removeItem('rentflow_user')
};

// API Fetch wrapper
async function apiFetch(endpoint, options = {}) {
    const token = TokenManager.getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'An error occurred');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============ AUTH API ============

const AuthAPI = {
    login: async (email, password) => {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (data.token) {
            TokenManager.setToken(data.token);
            TokenManager.setUser(data.user);
        }
        
        return data;
    },
    
    register: async (userData) => {
        return await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    
    logout: () => {
        TokenManager.removeToken();
        TokenManager.removeUser();
        window.location.href = 'login.html';
    },
    
    isAuthenticated: () => {
        return !!TokenManager.getToken();
    },
    
    getCurrentUser: () => {
        return TokenManager.getUser();
    },
    
    requireAuth: () => {
        if (!AuthAPI.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }
};

// ============ LANDLORD API ============

const LandlordAPI = {
    getDashboard: async () => {
        return await apiFetch('/landlord/dashboard');
    },
    
    getTenants: async () => {
        return await apiFetch('/landlord/tenants');
    },
    
    addTenant: async (tenantData) => {
        return await apiFetch('/landlord/tenants', {
            method: 'POST',
            body: JSON.stringify(tenantData)
        });
    },
    
    getPayments: async () => {
        return await apiFetch('/landlord/payments');
    },
    
    getReports: async (year, month) => {
        return await apiFetch(`/reports/monthly?year=${year}&month=${month}`);
    }
};

// ============ CARETAKER API ============

const CaretakerAPI = {
    getDashboard: async () => {
        return await apiFetch('/caretaker/dashboard');
    },
    
    verifyPayment: async (paymentId, status) => {
        return await apiFetch('/caretaker/verify-payment', {
            method: 'POST',
            body: JSON.stringify({ paymentId, status })
        });
    },
    
    recordPayment: async (paymentData) => {
        return await apiFetch('/caretaker/record-payment', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }
};

// ============ TENANT API ============

const TenantAPI = {
    getDashboard: async () => {
        return await apiFetch('/tenant/dashboard');
    },
    
    payRent: async (paymentData) => {
        return await apiFetch('/tenant/pay-rent', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    },
    
    submitMaintenance: async (requestData) => {
        return await apiFetch('/tenant/maintenance', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    }
};

// ============ MAINTENANCE API ============

const MaintenanceAPI = {
    getAll: async () => {
        return await apiFetch('/maintenance');
    },
    
    update: async (id, updateData) => {
        return await apiFetch(`/maintenance/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }
};

// ============ MPESA API ============

const MpesaAPI = {
    stkPush: async (phone, amount) => {
        return await apiFetch('/mpesa/stkpush', {
            method: 'POST',
            body: JSON.stringify({ phone, amount })
        });
    }
};

// ============ UI Helpers ============

const UI = {
    showLoading: (elementId) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
        }
    },
    
    showError: (message) => {
        alert('Error: ' + message);
    },
    
    showSuccess: (message) => {
        alert('Success: ' + message);
    },
    
    formatCurrency: (amount) => {
        return 'KSh ' + parseFloat(amount).toLocaleString('en-KE');
    },
    
    formatDate: (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-KE', options);
    },
    
    getStatusBadge: (status) => {
        const badges = {
            'paid': '<span class="status-badge paid"><i class="fas fa-check"></i> Paid</span>',
            'verified': '<span class="status-badge paid"><i class="fas fa-check"></i> Verified</span>',
            'pending': '<span class="status-badge pending"><i class="fas fa-clock"></i> Pending</span>',
            'overdue': '<span class="status-badge overdue"><i class="fas fa-exclamation"></i> Overdue</span>',
            'rejected': '<span class="status-badge overdue"><i class="fas fa-times"></i> Rejected</span>',
            'failed': '<span class="status-badge overdue"><i class="fas fa-times"></i> Failed</span>'
        };
        return badges[status] || status;
    }
};

// Export for use in other files
window.RentFlowAPI = {
    Auth: AuthAPI,
    Landlord: LandlordAPI,
    Caretaker: CaretakerAPI,
    Tenant: TenantAPI,
    Maintenance: MaintenanceAPI,
    Mpesa: MpesaAPI,
    UI: UI,
    Token: TokenManager
};
