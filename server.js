// RentFlow Backend API
// Node.js + Express + MySQL

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'rentflow_secret_key_2026';

// Serve static files (frontend)
app.use(express.static(__dirname));

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rentflow',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create pool
const pool = mysql.createPool(dbConfig);

// Initialize Database (run once)
async function initDatabase() {
    try {
        // Create database
        await pool.query('CREATE DATABASE IF NOT EXISTS rentflow');
        await pool.query('USE rentflow');
        
        // Initialize license tables
        await initLicense();
        
        // Create contact_inquiries table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contact_inquiries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                subject VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                inquiry_type ENUM('support', 'sales', 'partnership', 'feedback', 'other') DEFAULT 'other',
                status ENUM('pending', 'reviewed', 'resolved', 'closed') DEFAULT 'pending',
                assigned_to INT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create newsletter_subscriptions table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                unsubscribed_at TIMESTAMP NULL
            )
        `);
        
        // Create testimonials table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS testimonials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255),
                role VARCHAR(50) NOT NULL,
                company VARCHAR(100),
                rating INT NOT NULL,
                title VARCHAR(255),
                content TEXT NOT NULL,
                is_featured BOOLEAN DEFAULT FALSE,
                is_verified BOOLEAN DEFAULT FALSE,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create users table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                id_number VARCHAR(50),
                role ENUM('landlord', 'caretaker', 'tenant', 'admin') DEFAULT 'tenant',
                profile_photo VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role),
                INDEX idx_phone (phone)
            )
        `);

        // Create properties table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS properties (
                id INT AUTO_INCREMENT PRIMARY KEY,
                owner_id INT NOT NULL,
                property_name VARCHAR(255) NOT NULL,
                property_type ENUM('apartment', 'house', 'hostel', 'commercial', 'mixed') DEFAULT 'apartment',
                address TEXT NOT NULL,
                county VARCHAR(100),
                city VARCHAR(100),
                description TEXT,
                total_units INT DEFAULT 0,
                image VARCHAR(255),
                status ENUM('active', 'inactive', 'under_maintenance') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_owner (owner_id),
                INDEX idx_status (status)
            )
        `);

        // Create units table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS units (
                id INT AUTO_INCREMENT PRIMARY KEY,
                property_id INT NOT NULL,
                unit_number VARCHAR(50) NOT NULL,
                unit_type ENUM('single', 'bedsitter', '1bedroom', '2bedroom', '3bedroom', 'studio') DEFAULT 'single',
                floor VARCHAR(20),
                monthly_rent DECIMAL(12,2) NOT NULL,
                deposit_amount DECIMAL(12,2) DEFAULT 0,
                water_charge DECIMAL(10,2) DEFAULT 0,
                garbage_charge DECIMAL(10,2) DEFAULT 0,
                other_charges DECIMAL(10,2) DEFAULT 0,
                status ENUM('vacant', 'occupied', 'maintenance', 'reserved') DEFAULT 'vacant',
                description TEXT,
                features TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
                UNIQUE KEY unique_unit (property_id, unit_number),
                INDEX idx_property (property_id),
                INDEX idx_status (status)
            )
        `);

        // Create tenants table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tenants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                unit_id INT NOT NULL,
                property_id INT NOT NULL,
                lease_start_date DATE NOT NULL,
                lease_end_date DATE,
                monthly_rent DECIMAL(12,2) NOT NULL,
                deposit_paid DECIMAL(12,2) DEFAULT 0,
                deposit_status ENUM('pending', 'paid', 'refunded', 'waived') DEFAULT 'pending',
                move_in_date DATE,
                status ENUM('active', 'pending', 'evicted', 'moved_out') DEFAULT 'active',
                emergency_contact_name VARCHAR(100),
                emergency_contact_phone VARCHAR(20),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
                FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_unit (unit_id),
                INDEX idx_status (status)
            )
        `);

        // Create caretakers table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS caretakers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                property_id INT NOT NULL,
                commission_percentage DECIMAL(5,2) DEFAULT 0,
                commission_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
                salary DECIMAL(10,2) DEFAULT 0,
                status ENUM('active', 'inactive') DEFAULT 'active',
                assigned_date DATE,
                responsibilities TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_property (property_id)
            )
        `);

        // Create payments table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL,
                unit_id INT NOT NULL,
                property_id INT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                payment_type ENUM('rent', 'deposit', 'water', 'garbage', 'fine', 'other') DEFAULT 'rent',
                payment_method ENUM('mpesa', 'cash', 'bank', 'cheque', 'other') DEFAULT 'mpesa',
                payment_date DATE NOT NULL,
                due_date DATE,
                month_covered VARCHAR(20),
                year_covered YEAR,
                transaction_id VARCHAR(100),
                mpesa_receipt VARCHAR(100),
                phone_number VARCHAR(20),
                status ENUM('pending', 'verified', 'failed', 'refunded') DEFAULT 'pending',
                verified_by INT,
                verified_at TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
                FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
                INDEX idx_tenant (tenant_id),
                INDEX idx_status (status),
                INDEX idx_payment_date (payment_date)
            )
        `);

        // Create expenses table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                property_id INT NOT NULL,
                category VARCHAR(100) NOT NULL,
                description TEXT,
                amount DECIMAL(12,2) NOT NULL,
                expense_date DATE NOT NULL,
                receipt_number VARCHAR(50),
                vendor VARCHAR(100),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
                INDEX idx_property (property_id),
                INDEX idx_category (category),
                INDEX idx_date (expense_date)
            )
        `);

        // Create messages table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                recipient_id INT NOT NULL,
                subject VARCHAR(200),
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                parent_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_sender (sender_id),
                INDEX idx_recipient (recipient_id),
                INDEX idx_is_read (is_read)
            )
        `);

        // Create maintenance table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS maintenance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                unit_id INT NOT NULL,
                property_id INT NOT NULL,
                tenant_id INT,
                issue_type VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                priority ENUM('low', 'medium', 'high', 'emergency') DEFAULT 'medium',
                status ENUM('open', 'in_progress', 'completed', 'cancelled') DEFAULT 'open',
                assigned_to INT,
                cost DECIMAL(10,2),
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
                FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
                INDEX idx_unit (unit_id),
                INDEX idx_status (status),
                INDEX idx_priority (priority)
            )
        `);

        // Create notifications table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                type ENUM('payment', 'reminder', 'alert', 'info', 'system') DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                link VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_is_read (is_read)
            )
        `);

        // Create invitations table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invitations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                landlord_id INT NOT NULL,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(100),
                role ENUM('tenant', 'caretaker') DEFAULT 'tenant',
                token VARCHAR(255) NOT NULL,
                status ENUM('pending', 'accepted', 'expired') DEFAULT 'pending',
                property_id INT,
                unit_id INT,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_email (email),
                INDEX idx_token (token),
                INDEX idx_status (status)
            )
        `);

        // Create user_settings table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                notify_email BOOLEAN DEFAULT TRUE,
                notify_payment BOOLEAN DEFAULT TRUE,
                notify_late BOOLEAN DEFAULT TRUE,
                notify_maintenance BOOLEAN DEFAULT TRUE,
                mpesa_shortcode VARCHAR(50),
                mpesa_paybill VARCHAR(50),
                mpesa_customer_name VARCHAR(100),
                late_fee BOOLEAN DEFAULT FALSE,
                late_fee_amount DECIMAL(10,2) DEFAULT 0,
                rent_due_day INT DEFAULT 5,
                auto_reminders BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user (user_id)
            )
        `);
        
        // Insert sample testimonials if table is empty
        const [count] = await pool.query('SELECT COUNT(*) as cnt FROM testimonials WHERE status = "approved"');
        if (count.cnt === 0) {
            await pool.query(`
                INSERT INTO testimonials (name, role, company, rating, title, content, is_featured, is_verified, status) VALUES
                ('James Mwangi', 'Property Owner', 'Nairobi', 5, 'Excellent platform!', 'RentFlow Pro has completely transformed how I manage my 12 rental properties. The automated rent reminders and M-Pesa integration have saved me countless hours.', TRUE, TRUE, 'approved'),
                ('Faith Nekesa', 'Tenant', 'Mombasa', 5, 'Super convenient!', 'As a tenant, I love the convenience. Paying rent is now as easy as a few taps on my phone.', TRUE, TRUE, 'approved'),
                ('Robert Odhiambo', 'Property Manager', 'Kisumu', 4, 'Great tool!', 'Managing 45 units across different buildings used to be chaotic. Now I have everything organized.', TRUE, TRUE, 'approved'),
                ('Samuel Kiptoo', 'Landlord', 'Nakuru', 5, 'Highly recommend!', 'The tenant verification feature gives me peace of mind. The support team is very responsive.', FALSE, TRUE, 'approved'),
                ('Grace Atieno', 'Tenant', 'Eldoret', 5, 'Love it!', 'Finally, a rental platform that works! The STK push feature is incredibly convenient.', FALSE, TRUE, 'approved')
            `);
        }
        
        console.log('Database initialized successfully');
    } catch (error) {
        console.log('Database initialization:', error.message);
    }
}

// Authentication Middleware
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check license status
        const licenseStatus = await checkLicenseStatus();
        if (!licenseStatus.isValid) {
            return res.status(403).json({ 
                error: 'LICENSE_EXPIRED',
                message: licenseStatus.message,
                daysRemaining: licenseStatus.daysRemaining,
                requiresPayment: true
            });
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
}

// ============ LICENSE & SUBSCRIPTION MANAGEMENT ============

// License configuration
const LICENSE_CONFIG = {
    TRIAL_DAYS: 14,          // Free trial period (14 days)
    GRACE_PERIOD_DAYS: 5,    // Days after expiry before full lock
    MONTHLY_PRICE: 5000,     // KSh per month
    YEARLY_PRICE: 50000,     // KSh per year (discounted)
    BUYOUT_PRICE: 150000    // One-time buyout
};

// Check license status
async function checkLicenseStatus() {
    try {
        const [licenses] = await pool.query('SELECT * FROM license ORDER BY id DESC LIMIT 1');
        
        if (licenses.length === 0) {
            // No license found - create trial
            const startDate = new Date();
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + LICENSE_CONFIG.TRIAL_DAYS);
            
            await pool.query(
                `INSERT INTO license (license_type, start_date, expiry_date, status, is_trial) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['trial', startDate, expiryDate, 'active', true]
            );
            
            return {
                isValid: true,
                isTrial: true,
                daysRemaining: LICENSE_CONFIG.TRIAL_DAYS,
                message: `Trial period - ${LICENSE_CONFIG.TRIAL_DAYS} days remaining`
            };
        }
        
        const license = licenses[0];
        const now = new Date();
        const expiry = new Date(license.expiry_date);
        const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        
        if (license.license_type === 'buyout') {
            return {
                isValid: true,
                isTrial: false,
                daysRemaining: 'unlimited',
                message: 'Lifetime license activated'
            };
        }
        
        if (daysRemaining > 0) {
            // Still valid
            const isGrace = daysRemaining <= LICENSE_CONFIG.GRACE_PERIOD_DAYS;
            return {
                isValid: true,
                isTrial: false,
                daysRemaining: daysRemaining,
                message: isGrace 
                    ? `Expiring soon - ${daysRemaining} days remaining`
                    : `Active - ${daysRemaining} days remaining`,
                isGrace: isGrace
            };
        } else {
            // Expired
            return {
                isValid: false,
                isTrial: license.is_trial,
                daysRemaining: daysRemaining,
                message: license.is_trial 
                    ? 'Trial period expired. Please subscribe to continue.'
                    : 'Subscription expired. Please renew to continue.',
                expiredDays: Math.abs(daysRemaining)
            };
        }
    } catch (error) {
        console.error('License check error:', error);
        // Default to valid if database error (prevent lockout)
        return { isValid: true, message: 'License check failed - allowing access' };
    }
}

// Initialize license table
async function initLicense() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS license (
                id INT AUTO_INCREMENT PRIMARY KEY,
                license_type ENUM('trial', 'monthly', 'yearly', 'buyout') DEFAULT 'trial',
                start_date DATE NOT NULL,
                expiry_date DATE NOT NULL,
                status ENUM('active', 'expired', 'suspended') DEFAULT 'active',
                is_trial BOOLEAN DEFAULT FALSE,
                payment_reference VARCHAR(255),
                amount_paid DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create payment history table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS license_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                license_id INT,
                amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50),
                transaction_id VARCHAR(255),
                status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (license_id) REFERENCES license(id)
            )
        `);
        
        console.log('License tables initialized');
    } catch (error) {
        console.error('License init error:', error.message);
    }
}

// API: Get current license status
app.get('/api/license/status', async (req, res) => {
    try {
        const status = await checkLicenseStatus();
        
        res.json({
            success: true,
            license: {
                isValid: status.isValid,
                daysRemaining: status.daysRemaining,
                message: status.message,
                isGrace: status.isGrace || false,
                prices: {
                    monthly: LICENSE_CONFIG.MONTHLY_PRICE,
                    yearly: LICENSE_CONFIG.YEARLY_PRICE,
                    buyout: LICENSE_CONFIG.BUYOUT_PRICE
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Initiate subscription payment (STK Push)
app.post('/api/license/pay', async (req, res) => {
    try {
        const { plan, phone } = req.body; // plan: 'monthly', 'yearly', 'buyout'
        
        const amounts = {
            monthly: LICENSE_CONFIG.MONTHLY_PRICE,
            yearly: LICENSE_CONFIG.YEARLY_PRICE,
            buyout: LICENSE_CONFIG.BUYOUT_PRICE
        };
        
        const amount = amounts[plan];
        if (!amount) {
            return res.status(400).json({ success: false, error: 'Invalid plan' });
        }
        
        // In production, call M-Pesa STK Push here
        // For demo, simulate payment
        
        const transactionId = `LIC${Date.now()}`;
        
        // Record pending payment
        const [licenses] = await pool.query('SELECT * FROM license ORDER BY id DESC LIMIT 1');
        if (licenses.length > 0) {
            await pool.query(
                `INSERT INTO license_payments (license_id, amount, payment_method, transaction_id, status) 
                 VALUES (?, ?, 'mpesa', ?, 'pending')`,
                [licenses[0].id, amount, transactionId]
            );
        }
        
        res.json({
            success: true,
            message: 'Payment initiated. Please check your phone.',
            transactionId: transactionId,
            amount: amount,
            plan: plan,
            instructions: 'You will receive an M-Pesa prompt. Enter your PIN to complete payment.'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Verify payment and activate license
app.post('/api/license/verify', async (req, res) => {
    try {
        const { transactionId, plan } = req.body;
        
        // In production, verify with M-Pesa API
        // For demo, simulate successful verification
        
        const amounts = {
            monthly: LICENSE_CONFIG.MONTHLY_PRICE,
            yearly: LICENSE_CONFIG.YEARLY_PRICE,
            buyout: LICENSE_CONFIG.BUYOUT_PRICE
        };
        
        const amount = amounts[plan];
        
        // Update payment status
        await pool.query(
            `UPDATE license_payments SET status = 'completed' WHERE transaction_id = ?`,
            [transactionId]
        );
        
        // Calculate new expiry date
        let newExpiry;
        const now = new Date();
        
        if (plan === 'buyout') {
            newExpiry = new Date('2099-12-31'); // Far future
        } else if (plan === 'yearly') {
            newExpiry = new Date(now);
            newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        } else { // monthly
            newExpiry = new Date(now);
            newExpiry.setMonth(newExpiry.getMonth() + 1);
        }
        
        // Get current license
        const [licenses] = await pool.query('SELECT * FROM license ORDER BY id DESC LIMIT 1');
        
        if (licenses.length > 0) {
            // Update existing license
            await pool.query(
                `UPDATE license SET 
                    license_type = ?,
                    expiry_date = ?,
                    status = 'active',
                    is_trial = FALSE,
                    payment_reference = ?
                 WHERE id = ?`,
                [plan, newExpiry, transactionId, licenses[0].id]
            );
        } else {
            // Create new license
            await pool.query(
                `INSERT INTO license (license_type, start_date, expiry_date, status, is_trial) 
                 VALUES (?, ?, ?, 'active', FALSE)`,
                [plan, now, newExpiry]
            );
        }
        
        res.json({
            success: true,
            message: 'Payment verified! License activated.',
            plan: plan,
            expiryDate: newExpiry.toISOString().split('T')[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Extend license (manual admin function)
app.post('/api/license/extend', async (req, res) => {
    try {
        const { days, licenseType } = req.body;
        
        const now = new Date();
        const newExpiry = new Date(now);
        
        if (licenseType === 'buyout') {
            newExpiry.setFullYear(2099);
        } else if (licenseType === 'yearly') {
            newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        } else {
            newExpiry.setDate(newExpiry.getDate() + (days || 30));
        }
        
        await pool.query(
            `UPDATE license SET expiry_date = ?, status = 'active' ORDER BY id DESC LIMIT 1`,
            [newExpiry]
        );
        
        res.json({
            success: true,
            message: 'License extended',
            newExpiry: newExpiry.toISOString().split('T')[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Check payment status (for polling)
app.get('/api/license/payment/:transactionId/status', async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        const [payments] = await pool.query(
            'SELECT * FROM license_payments WHERE transaction_id = ?',
            [transactionId]
        );
        
        if (payments.length === 0) {
            return res.json({ status: 'not_found' });
        }
        
        res.json({
            status: payments[0].status,
            amount: payments[0].amount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = users[0];
        
        // For demo, accept any password or check hash
        const validPassword = await bcrypt.compare(password, user.password_hash) || password === 'demo123';
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, role, idNumber } = req.body;
        
        // Check if user exists
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Insert user (without id_number if column doesn't exist)
        const [result] = await pool.query(
            'INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
            [email, passwordHash, firstName, lastName, phone, role || 'tenant']
        );
        
        res.status(201).json({ success: true, message: 'User registered successfully', userId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ LANDLORD ROUTES ============

// Get landlord dashboard stats
app.get('/api/landlord/dashboard', authenticateToken, async (req, res) => {
    try {
        const landlordId = req.user.id;
        
        // Get properties
        const [properties] = await pool.query(
            'SELECT * FROM properties WHERE owner_id = ?',
            [landlordId]
        );
        
        if (properties.length === 0) {
            return res.json({
                properties: [],
                stats: { totalBalance: 0, tenantsPaid: 0, pending: 0, overdue: 0 }
            });
        }
        
        const propertyIds = properties.map(p => p.id);
        
        // Get units
        const [units] = await pool.query(
            `SELECT * FROM units WHERE property_id IN (?)`,
            [propertyIds]
        );
        
        // Get tenants
        const [tenants] = await pool.query(
            `SELECT t.*, u.first_name, u.last_name, u.email, u.phone 
             FROM tenants t 
             JOIN users u ON t.user_id = u.id 
             WHERE t.status = 'active'`
        );
        
        // Get payments this month
        const currentMonth = new Date().toISOString().slice(0, 7);
        const [payments] = await pool.query(
            `SELECT p.*, t.unit_id, u.unit_number 
             FROM payments p 
             JOIN tenants t ON p.tenant_id = t.id 
             JOIN units u ON t.unit_id = u.id 
             WHERE p.payment_date LIKE ?`,
            [`${currentMonth}%`]
        );
        
        // Calculate stats
        const totalRent = tenants.reduce((sum, t) => sum + parseFloat(t.monthly_rent), 0);
        const paidAmount = payments.filter(p => p.status === 'verified').reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const pendingCount = payments.filter(p => p.status === 'pending').length;
        const overdueCount = tenants.length - payments.filter(p => p.status === 'verified').length;
        
        res.json({
            properties,
            units,
            tenants,
            stats: {
                totalBalance: paidAmount,
                totalExpected: totalRent,
                tenantsPaid: payments.filter(p => p.status === 'verified').length,
                totalTenants: tenants.length,
                pending: pendingCount,
                overdue: overdueCount
            },
            recentPayments: payments.slice(0, 10)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all tenants
app.get('/api/landlord/tenants', authenticateToken, async (req, res) => {
    try {
        const [tenants] = await pool.query(
            `SELECT t.*, u.first_name, u.last_name, u.email, u.phone, 
                    un.unit_number, un.rent_amount, p.name as property_name
             FROM tenants t
             JOIN users u ON t.user_id = u.id
             JOIN units un ON t.unit_id = un.id
             JOIN properties p ON un.property_id = p.id
             WHERE p.owner_id = ?
             ORDER BY t.created_at DESC`,
            [req.user.id]
        );
        
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add tenant
app.post('/api/landlord/tenants', authenticateToken, async (req, res) => {
    try {
        const { userId, unitId, leaseStart, leaseEnd, monthlyRent, depositPaid } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO tenants (user_id, unit_id, lease_start, lease_end, monthly_rent, deposit_paid) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, unitId, leaseStart, leaseEnd, monthlyRent, depositPaid || 0]
        );
        
        // Update unit status
        await pool.query('UPDATE units SET status = "occupied" WHERE id = ?', [unitId]);
        
        res.status(201).json({ message: 'Tenant added successfully', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get payments
app.get('/api/landlord/payments', authenticateToken, async (req, res) => {
    try {
        const [payments] = await pool.query(
            `SELECT p.*, u.first_name, u.last_name, un.unit_number
             FROM payments p
             JOIN tenants t ON p.tenant_id = t.id
             JOIN users u ON t.user_id = u.id
             JOIN units un ON t.unit_id = un.id
             JOIN properties pr ON un.property_id = pr.id
             WHERE pr.owner_id = ?
             ORDER BY p.payment_date DESC`,
            [req.user.id]
        );
        
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CARETAKER ROUTES ============

// Get caretaker dashboard
app.get('/api/caretaker/dashboard', authenticateToken, async (req, res) => {
    try {
        const caretakerId = req.user.id;
        
        // Get assigned properties
        const [assignments] = await pool.query(
            `SELECT ca.*, p.name as property_name, p.id as property_id
             FROM caretaker_assignments ca
             JOIN properties p ON ca.property_id = p.id
             WHERE ca.caretaker_id = ? AND ca.is_active = TRUE`,
            [caretakerId]
        );
        
        if (assignments.length === 0) {
            return res.json({ assignments: [], units: [], pendingPayments: [], maintenanceRequests: [] });
        }
        
        const propertyIds = assignments.map(a => a.property_id);
        
        // Get units
        const [units] = await pool.query(
            `SELECT * FROM units WHERE property_id IN (?)`,
            [propertyIds]
        );
        
        // Get pending payments
        const [pendingPayments] = await pool.query(
            `SELECT p.*, u.first_name, u.last_name, u.phone, un.unit_number
             FROM payments p
             JOIN tenants t ON p.tenant_id = t.id
             JOIN users u ON t.user_id = u.id
             JOIN units un ON t.unit_id = un.id
             WHERE p.status = 'pending' AND un.property_id IN (?)
             ORDER BY p.created_at DESC`,
            [propertyIds]
        );
        
        // Get maintenance requests
        const [maintenanceRequests] = await pool.query(
            `SELECT m.*, u.first_name, u.last_name, un.unit_number
             FROM maintenance_requests m
             JOIN units un ON m.unit_id = un.id
             LEFT JOIN users u ON m.tenant_id = (
                 SELECT id FROM tenants WHERE unit_id = un.id AND status = 'active' LIMIT 1
             )
             WHERE un.property_id IN (?)
             ORDER BY m.created_at DESC`,
            [propertyIds]
        );
        
        res.json({
            assignments,
            units,
            pendingPayments,
            maintenanceRequests,
            stats: {
                occupiedUnits: units.filter(u => u.status === 'occupied').length,
                totalUnits: units.length,
                pendingVerification: pendingPayments.length,
                maintenanceIssues: maintenanceRequests.filter(m => m.status !== 'resolved').length
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify payment
app.post('/api/caretaker/verify-payment', authenticateToken, async (req, res) => {
    try {
        const { paymentId, status } = req.body;
        
        await pool.query(
            `UPDATE payments SET status = ?, verified_by = ?, verified_at = NOW() WHERE id = ?`,
            [status, req.user.id, paymentId]
        );
        
        res.json({ message: `Payment ${status} successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Record payment
app.post('/api/caretaker/record-payment', authenticateToken, async (req, res) => {
    try {
        const { tenantId, amount, method, transactionId, paymentDate } = req.body;
        
        const dueDate = new Date(paymentDate);
        
        const [result] = await pool.query(
            `INSERT INTO payments (tenant_id, amount, payment_method, transaction_id, payment_date, due_date, status, verified_by, verified_at) 
             VALUES (?, ?, ?, ?, ?, ?, 'verified', ?, NOW())`,
            [tenantId, amount, method, transactionId, paymentDate, dueDate, req.user.id]
        );
        
        res.status(201).json({ message: 'Payment recorded successfully', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ TENANT ROUTES ============

// Get tenant dashboard
app.get('/api/tenant/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get tenant info
        const [tenants] = await pool.query(
            `SELECT t.*, un.unit_number, un.rent_amount, p.name as property_name
             FROM tenants t
             JOIN units un ON t.unit_id = un.id
             JOIN properties p ON un.property_id = p.id
             WHERE t.user_id = ? AND t.status = 'active'`,
            [userId]
        );
        
        if (tenants.length === 0) {
            return res.json({ tenant: null, payments: [], notices: [] });
        }
        
        const tenant = tenants[0];
        
        // Get payments
        const [payments] = await pool.query(
            `SELECT * FROM payments WHERE tenant_id = ? ORDER BY payment_date DESC`,
            [tenant.id]
        );
        
        // Get notices
        const [notices] = await pool.query(
            `SELECT * FROM notices 
             WHERE property_id = (SELECT property_id FROM units WHERE id = ?) 
             OR tenant_id = ?
             ORDER BY created_at DESC`,
            [tenant.unit_id, tenant.id]
        );
        
        // Calculate outstanding
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthPayment = payments.find(p => 
            p.payment_date.startsWith(currentMonth) && p.status === 'verified'
        );
        
        res.json({
            tenant,
            payments,
            notices,
            outstanding: currentMonthPayment ? 0 : tenant.monthly_rent,
            paidThisMonth: !!currentMonth
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Make payment
app.post('/api/tenant/pay-rent', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, method, transactionId } = req.body;
        
        // Get tenant
        const [tenants] = await pool.query(
            'SELECT * FROM tenants WHERE user_id = ? AND status = "active"',
            [userId]
        );
        
        if (tenants.length === 0) {
            return res.status(404).json({ error: 'No active tenant found' });
        }
        
        const tenant = tenants[0];
        const paymentDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(1);
        dueDate.setMonth(dueDate.getMonth() + 1);
        
        // Create payment (pending verification)
        const [result] = await pool.query(
            `INSERT INTO payments (tenant_id, amount, payment_method, transaction_id, payment_date, due_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [tenant.id, amount, method, transactionId, paymentDate, dueDate.toISOString().split('T')[0]]
        );
        
        res.status(201).json({ 
            message: 'Payment submitted for verification',
            paymentId: result.insertId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit maintenance request
app.post('/api/tenant/maintenance', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { issueType, priority, description } = req.body;
        
        // Get tenant's unit
        const [tenants] = await pool.query(
            'SELECT * FROM tenants WHERE user_id = ? AND status = "active"',
            [userId]
        );
        
        if (tenants.length === 0) {
            return res.status(404).json({ error: 'No active tenant found' });
        }
        
        const [result] = await pool.query(
            `INSERT INTO maintenance_requests (unit_id, tenant_id, reported_by, issue_type, priority, description, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [tenants[0].unit_id, tenants[0].id, userId, issueType, priority, description]
        );
        
        res.status(201).json({ message: 'Maintenance request submitted', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ MAINTENANCE ROUTES ============

// Get all maintenance requests
app.get('/api/maintenance', authenticateToken, async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT m.*, un.unit_number, p.name as property_name
             FROM maintenance_requests m
             JOIN units un ON m.unit_id = un.id
             JOIN properties p ON un.property_id = p.id
             ORDER BY 
                CASE m.priority 
                    WHEN 'emergency' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END,
             m.created_at DESC`
        );
        
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update maintenance status
app.put('/api/maintenance/:id', authenticateToken, async (req, res) => {
    try {
        const { status, assignedTechnician, estimatedCost } = req.body;
        
        const updates = [];
        const values = [];
        
        if (status) {
            updates.push('status = ?');
            values.push(status);
            
            if (status === 'resolved') {
                updates.push('resolved_at = NOW()');
            }
        }
        
        if (assignedTechnician) {
            updates.push('assigned_technician = ?');
            values.push(assignedTechnician);
        }
        
        if (estimatedCost) {
            updates.push('estimated_cost = ?');
            values.push(estimatedCost);
        }
        
        values.push(req.params.id);
        
        await pool.query(
            `UPDATE maintenance_requests SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        res.json({ message: 'Maintenance request updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ REPORTS & EXPORTS ============

// Get monthly report
app.get('/api/reports/monthly', authenticateToken, async (req, res) => {
    try {
        const { year, month } = req.query;
        
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const [payments] = await pool.query(
            `SELECT p.*, u.first_name, u.last_name, un.unit_number
             FROM payments p
             JOIN tenants t ON p.tenant_id = t.id
             JOIN users u ON t.user_id = u.id
             JOIN units un ON t.unit_id = un.id
             JOIN properties pr ON un.property_id = pr.id
             WHERE pr.owner_id = ? AND p.payment_date BETWEEN ? AND ? AND p.status = 'verified'`,
            [req.user.id, startDate, endDate]
        );
        
        const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        res.json({
            period: { startDate, endDate },
            payments,
            summary: {
                totalCollected,
                transactionCount: payments.length,
                averagePayment: payments.length > 0 ? totalCollected / payments.length : 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ MPESA INTEGRATION ============

// M-Pesa STK Push callback
app.post('/api/mpesa/callback', async (req, res) => {
    try {
        const callback = req.body;
        
        // Process STK callback
        if (callback.Body && callback.Body.stkCallback) {
            const stkCallback = callback.Body.stkCallback;
            const checkoutRequestId = stkCallback.CheckoutRequestID;
            const resultCode = stkCallback.ResultCode;
            const resultDesc = stkCallback.ResultDesc;
            
            // Find payment by transaction ID
            const [payments] = await pool.query(
                'SELECT * FROM payments WHERE transaction_id = ?',
                [checkoutRequestId]
            );
            
            if (payments.length > 0) {
                const payment = payments[0];
                
                if (resultCode === 0) {
                    // Success
                    const mpesaReceipt = stkCallback.CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
                    
                    await pool.query(
                        'UPDATE payments SET status = ?, mpesa_receipt = ?, verified_at = NOW() WHERE id = ?',
                        ['verified', mpesaReceipt, payment.id]
                    );
                    
                    // Create receipt
                    const receiptNumber = `RCP${Date.now()}`;
                    await pool.query(
                        `INSERT INTO receipts (payment_id, receipt_number, tenant_name, unit_number, amount, payment_method, transaction_id, payment_date)
                         SELECT ?, ?, CONCAT(u.first_name, ' ', u.last_name), un.unit_number, p.amount, p.payment_method, p.transaction_id, p.payment_date
                         FROM payments p
                         JOIN tenants t ON p.tenant_id = t.id
                         JOIN users u ON t.user_id = u.id
                         JOIN units un ON t.unit_id = un.id
                         WHERE p.id = ?`,
                        [payment.id, receiptNumber, payment.id]
                    );
                } else {
                    // Failed
                    await pool.query(
                        'UPDATE payments SET status = ?, notes = ? WHERE id = ?',
                        ['failed', resultDesc, payment.id]
                    );
                }
            }
        }
        
        res.json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
        console.error('M-Pesa callback error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initiate STK Push
app.post('/api/mpesa/stkpush', authenticateToken, async (req, res) => {
    try {
        const { phone, amount } = req.body;
        
        // In production, this would call Safaricom Daraja API
        // For demo, simulate response
        const transactionId = `TXN${Date.now()}`;
        
        res.json({
            success: true,
            message: 'STK Push initiated',
            transactionId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Serve license page
app.get('/license', (req, res) => {
    res.sendFile(__dirname + '/license.html');
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

// Serve register page
app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/register.html');
});

// Serve caretaker dashboard
app.get('/dashboard-caretaker.html', authenticateToken, (req, res) => {
    res.sendFile(__dirname + '/dashboard-caretaker.html');
});

// Serve tenant dashboard
app.get('/dashboard-tenant.html', authenticateToken, (req, res) => {
    res.sendFile(__dirname + '/dashboard-tenant.html');
});

// ============ PROPERTIES API ============

// Get all properties
app.get('/api/properties', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = 'SELECT * FROM properties';
        let params = [];
        
        if (userRole === 'landlord') {
            query += ' WHERE owner_id = ?';
            params.push(userId);
        } else if (userRole === 'caretaker') {
            query += ' WHERE id IN (SELECT property_id FROM caretakers WHERE user_id = ?)';
            params.push(userId);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [properties] = await pool.query(query, params);
        res.json({ success: true, properties });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new property
app.post('/api/properties', authenticateToken, async (req, res) => {
    try {
        const { property_name, property_type, address, county, city, description, total_units } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO properties (owner_id, property_name, property_type, address, county, city, description, total_units) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, property_name, property_type, address, county, city, description, total_units || 0]
        );
        
        res.json({ success: true, propertyId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update property
app.put('/api/properties/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { property_name, property_type, address, county, city, description, status } = req.body;
        
        await pool.query(
            `UPDATE properties SET property_name = ?, property_type = ?, address = ?, county = ?, city = ?, description = ?, status = ? 
             WHERE id = ? AND owner_id = ?`,
            [property_name, property_type, address, county, city, description, status, id, req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete property
app.delete('/api/properties/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM properties WHERE id = ? AND owner_id = ?', [id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ UNITS API ============

// Get all units
app.get('/api/units', authenticateToken, async (req, res) => {
    try {
        const { property_id } = req.query;
        let query = 'SELECT * FROM units';
        let params = [];
        
        if (property_id) {
            query += ' WHERE property_id = ?';
            params.push(property_id);
        }
        
        query += ' ORDER BY unit_number';
        
        const [units] = await pool.query(query, params);
        res.json({ success: true, units });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new unit
app.post('/api/units', authenticateToken, async (req, res) => {
    try {
        const { property_id, unit_number, unit_type, floor, monthly_rent, deposit_amount, water_charge, garbage_charge, description } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO units (property_id, unit_number, unit_type, floor, monthly_rent, deposit_amount, water_charge, garbage_charge, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [property_id, unit_number, unit_type, floor, monthly_rent, deposit_amount || 0, water_charge || 0, garbage_charge || 0, description]
        );
        
        // Update property total_units count
        await pool.query('UPDATE properties SET total_units = total_units + 1 WHERE id = ?', [property_id]);
        
        res.json({ success: true, unitId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update unit
app.put('/api/units/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { unit_number, unit_type, floor, monthly_rent, deposit_amount, status } = req.body;
        
        await pool.query(
            `UPDATE units SET unit_number = ?, unit_type = ?, floor = ?, monthly_rent = ?, deposit_amount = ?, status = ? 
             WHERE id = ?`,
            [unit_number, unit_type, floor, monthly_rent, deposit_amount, status, id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ TENANTS API ============

// Get all tenants
app.get('/api/tenants', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `SELECT t.*, u.first_name, u.last_name, u.email, u.phone, pr.property_name, un.unit_number 
                     FROM tenants t 
                     JOIN users u ON t.user_id = u.id 
                     JOIN properties pr ON t.property_id = pr.id 
                     JOIN units un ON t.unit_id = un.id`;
        
        if (userRole === 'landlord') {
            query += ' WHERE pr.owner_id = ?';
            query += ' ORDER BY t.created_at DESC';
            const [tenants] = await pool.query(query, [userId]);
            return res.json({ success: true, tenants });
        } else if (userRole === 'caretaker') {
            query += ' WHERE pr.id IN (SELECT property_id FROM caretakers WHERE user_id = ?)';
            query += ' ORDER BY t.created_at DESC';
            const [tenants] = await pool.query(query, [userId]);
            return res.json({ success: true, tenants });
        } else if (userRole === 'tenant') {
            query += ' WHERE u.id = ?';
            const [tenants] = await pool.query(query, [userId]);
            return res.json({ success: true, tenants });
        }
        
        res.json({ success: true, tenants: [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new tenant
app.post('/api/tenants', authenticateToken, async (req, res) => {
    try {
        const { user_id, unit_id, property_id, lease_start_date, lease_end_date, monthly_rent, deposit_paid } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO tenants (user_id, unit_id, property_id, lease_start_date, lease_end_date, monthly_rent, deposit_paid, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [user_id, unit_id, property_id, lease_start_date, lease_end_date, monthly_rent, deposit_paid]
        );
        
        // Update unit status
        await pool.query('UPDATE units SET status = "occupied" WHERE id = ?', [unit_id]);
        
        res.json({ success: true, tenantId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update tenant
app.put('/api/tenants/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { monthly_rent, lease_end_date, status } = req.body;
        
        await pool.query(
            `UPDATE tenants SET monthly_rent = ?, lease_end_date = ?, status = ? WHERE id = ?`,
            [monthly_rent, lease_end_date, status, id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ UNITS API ============

// Get all units
app.get('/api/units', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `SELECT u.*, p.property_name 
                     FROM units u 
                     JOIN properties p ON u.property_id = p.id`;
        
        let params = [];
        
        if (userRole === 'landlord') {
            query += ' WHERE p.owner_id = ?';
            params.push(userId);
        } else if (userRole === 'caretaker') {
            query += ' WHERE p.id IN (SELECT property_id FROM caretakers WHERE user_id = ?)';
            params.push(userId);
        }
        
        query += ' ORDER BY u.created_at DESC';
        
        const [units] = await pool.query(query, params);
        res.json({ success: true, units });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new unit
app.post('/api/units', authenticateToken, async (req, res) => {
    try {
        const { property_id, unit_number, unit_type, bedrooms, bathrooms, rent_amount, deposit_amount, description, status } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO units (property_id, unit_number, unit_type, bedrooms, bathrooms, rent_amount, deposit_amount, description, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [property_id, unit_number, unit_type, bedrooms, bathrooms, rent_amount, deposit_amount, description, status || 'vacant']
        );
        
        res.json({ success: true, unitId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CARETAKERS API ============

// Get all caretakers
app.get('/api/caretakers', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `SELECT c.*, u.first_name, u.last_name, u.email, u.phone, p.property_name 
                     FROM caretakers c 
                     JOIN users u ON c.user_id = u.id 
                     LEFT JOIN properties p ON c.property_id = p.id`;
        
        let params = [];
        
        if (userRole === 'landlord') {
            if (userRole === 'landlord') {
                query += ' WHERE p.owner_id = ? OR c.user_id = ?';
                params.push(userId, userId);
            }
        } else if (userRole === 'caretaker') {
            query += ' WHERE c.user_id = ?';
            params.push(userId);
        }
        
        query += ' ORDER BY c.created_at DESC';
        
        const [caretakers] = await pool.query(query, params);
        res.json({ success: true, caretakers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new caretaker
app.post('/api/caretakers', authenticateToken, async (req, res) => {
    try {
        const { user_id, property_id, name, email, phone, role, status } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO caretakers (user_id, property_id, name, email, phone, role, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user_id, property_id, name, email, phone, role || 'caretaker', status || 'active']
        );
        
        res.json({ success: true, caretakerId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ MESSAGES API ============

// Get all messages
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `SELECT m.*, 
                     CONCAT(u.first_name, ' ', u.last_name) as sender_name,
                     u.email as sender_email
                     FROM messages m 
                     JOIN users u ON m.sender_id = u.id`;
        
        let params = [];
        
        if (userRole === 'landlord') {
            query += ' WHERE m.receiver_id = ? OR m.sender_id = ?';
            params.push(userId, userId);
        } else if (userRole === 'caretaker') {
            query += ' WHERE m.receiver_id = ? OR m.sender_id = ?';
            params.push(userId, userId);
        } else if (userRole === 'tenant') {
            query += ' WHERE m.receiver_id = ? OR m.sender_id = ?';
            params.push(userId, userId);
        }
        
        query += ' ORDER BY m.created_at DESC';
        
        const [messages] = await pool.query(query, params);
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send new message
app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { receiver_id, subject, message } = req.body;
        const sender_id = req.user.id;
        
        const [result] = await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, subject, message) VALUES (?, ?, ?, ?)`,
            [sender_id, receiver_id, subject, message]
        );
        
        res.json({ success: true, messageId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ EXPENSES API ============

// Get all expenses
app.get('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `SELECT e.*, p.property_name 
                     FROM expenses e 
                     LEFT JOIN properties p ON e.property_id = p.id`;
        
        let params = [];
        
        if (userRole === 'landlord') {
            query += ' WHERE e.property_id IN (SELECT id FROM properties WHERE owner_id = ?)';
            params.push(userId);
        } else if (userRole === 'caretaker') {
            query += ' WHERE e.property_id IN (SELECT property_id FROM caretakers WHERE user_id = ?)';
            params.push(userId);
        }
        
        query += ' ORDER BY e.date DESC';
        
        const [expenses] = await pool.query(query, params);
        res.json({ success: true, expenses });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new expense
app.post('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const { property_id, category, description, amount, date, status } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO expenses (property_id, category, description, amount, date, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [property_id, category, description, amount, date, status || 'pending']
        );
        
        res.json({ success: true, expenseId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PAYMENTS API ============

// Get all payments
app.get('/api/payments', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `SELECT p.*, u.first_name, u.last_name, pr.property_name, un.unit_number 
                     FROM payments p 
                     JOIN tenants t ON p.tenant_id = t.id 
                     JOIN users u ON t.user_id = u.id 
                     JOIN properties pr ON p.property_id = pr.id 
                     JOIN units un ON p.unit_id = un.id`;
        
        if (userRole === 'landlord') {
            query += ' WHERE pr.owner_id = ? ORDER BY p.payment_date DESC';
            const [payments] = await pool.query(query, [userId]);
            return res.json({ success: true, payments });
        } else if (userRole === 'caretaker') {
            query += ' WHERE pr.id IN (SELECT property_id FROM caretakers WHERE user_id = ?) ORDER BY p.payment_date DESC';
            const [payments] = await pool.query(query, [userId]);
            return res.json({ success: true, payments });
        } else if (userRole === 'tenant') {
            query += ' WHERE u.id = ? ORDER BY p.payment_date DESC';
            const [payments] = await pool.query(query, [userId]);
            return res.json({ success: true, payments });
        }
        
        res.json({ success: true, payments: [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new payment
app.post('/api/payments', authenticateToken, async (req, res) => {
    try {
        const { tenant_id, unit_id, property_id, amount, payment_type, payment_method, payment_date, month_covered, year_covered, transaction_id } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO payments (tenant_id, unit_id, property_id, amount, payment_type, payment_method, payment_date, month_covered, year_covered, transaction_id, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified')`,
            [tenant_id, unit_id, property_id, amount, payment_type || 'rent', payment_method || 'mpesa', payment_date, month_covered, year_covered, transaction_id]
        );
        
        // Create receipt
        const receiptNumber = `RCP${Date.now()}`;
        await pool.query(
            `INSERT INTO receipts (payment_id, receipt_number, tenant_name, unit_number, amount, payment_method, transaction_id, payment_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [result.insertId, receiptNumber, 'Tenant', 'Unit', amount, payment_method || 'mpesa', transaction_id, payment_date]
        );
        
        res.json({ success: true, paymentId: result.insertId, receiptNumber });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get payment summary stats
app.get('/api/payments/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Get stats based on user role
        let propertyCondition = '';
        if (req.user.role === 'landlord') {
            propertyCondition = 'AND pr.owner_id = ?';
        } else if (req.user.role === 'caretaker') {
            propertyCondition = 'AND pr.id IN (SELECT property_id FROM caretakers WHERE user_id = ?)';
        }
        
        const [stats] = await pool.query(`
            SELECT 
                COUNT(DISTINCT p.id) as total_payments,
                COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0) as collected,
                COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN p.payment_date LIKE ? THEN p.amount ELSE 0 END), 0) as this_month
            FROM payments p
            JOIN properties pr ON p.property_id = pr.id
            WHERE 1=1 ${propertyCondition}
        `, [`${currentMonth}%`, userId]);
        
        res.json({ success: true, stats: stats[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ EXPENSES API ============

// Get all expenses
app.get('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const { property_id } = req.query;
        let query = 'SELECT e.*, pr.property_name, un.unit_number FROM expenses e LEFT JOIN properties pr ON e.property_id = pr.id LEFT JOIN units e2 ON e.unit_id = e2.id';
        let params = [];
        
        if (property_id) {
            query += ' WHERE e.property_id = ?';
            params.push(property_id);
        }
        
        query += ' ORDER BY e.expense_date DESC';
        
        const [expenses] = await pool.query(query, params);
        res.json({ success: true, expenses });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new expense
app.post('/api/expenses', authenticateToken, async (req, res) => {
    try {
        const { property_id, unit_id, category, description, amount, expense_date, vendor_name } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO expenses (property_id, unit_id, category, description, amount, expense_date, vendor_name, status, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
            [property_id, unit_id || null, category, description, amount, expense_date, vendor_name, req.user.id]
        );
        
        res.json({ success: true, expenseId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ MAINTENANCE API ============

// Get all maintenance requests
app.get('/api/maintenance', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `SELECT m.*, pr.property_name, un.unit_number, u.first_name, u.last_name 
                     FROM maintenance m 
                     JOIN properties pr ON m.property_id = pr.id 
                     LEFT JOIN units un ON m.unit_id = un.id
                     LEFT JOIN users u ON m.reported_by = u.id`;
        let params = [];
        
        if (userRole === 'landlord') {
            query += ' WHERE pr.owner_id = ?';
            params.push(userId);
        } else if (userRole === 'caretaker') {
            query += ' WHERE pr.id IN (SELECT property_id FROM caretakers WHERE user_id = ?)';
            params.push(userId);
        }
        
        query += ' ORDER BY m.created_at DESC';
        
        const [maintenance] = await pool.query(query, params);
        res.json({ success: true, maintenance });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add maintenance request
app.post('/api/maintenance', authenticateToken, async (req, res) => {
    try {
        const { property_id, unit_id, category, priority, title, description } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO maintenance (property_id, unit_id, reported_by, category, priority, title, description, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [property_id, unit_id || null, req.user.id, category, priority, title, description]
        );
        
        res.json({ success: true, maintenanceId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update maintenance status
app.put('/api/maintenance/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_to, cost } = req.body;
        
        let updateFields = 'status = ?';
        let params = [status];
        
        if (assigned_to) {
            updateFields += ', assigned_to = ?, assigned_at = NOW()';
            params.push(assigned_to);
        }
        
        if (cost) {
            updateFields += ', cost = ?';
            params.push(cost);
        }
        
        if (status === 'completed') {
            updateFields += ', completed_at = NOW()';
        }
        
        params.push(id);
        
        await pool.query(`UPDATE maintenance SET ${updateFields} WHERE id = ?`, params);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ MESSAGES API ============

// Get all messages
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [messages] = await pool.query(`
            SELECT m.*, 
                   sender.first_name as sender_first_name, sender.last_name as sender_last_name,
                   recipient.first_name as recipient_first_name, recipient.last_name as recipient_last_name
            FROM messages m
            JOIN users sender ON m.sender_id = sender.id
            JOIN users recipient ON m.recipient_id = recipient.id
            WHERE m.sender_id = ? OR m.recipient_id = ?
            ORDER BY m.created_at DESC
        `, [userId, userId]);
        
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send message
app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { recipient_id, property_id, subject, message } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO messages (sender_id, recipient_id, property_id, subject, message) VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, recipient_id, property_id || null, subject, message]
        );
        
        res.json({ success: true, messageId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark message as read
app.put('/api/messages/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE messages SET is_read = TRUE WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ NOTIFICATIONS API ============

// Get notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        );
        res.json({ success: true, notifications });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ DASHBOARD STATS API ============

// Get dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let propertyIds = [];
        let tenantCondition = '';
        
        if (userRole === 'landlord') {
            const [properties] = await pool.query('SELECT id FROM properties WHERE owner_id = ?', [userId]);
            propertyIds = properties.map(p => p.id);
        } else if (userRole === 'caretaker') {
            const [caretakerProps] = await pool.query('SELECT property_id FROM caretakers WHERE user_id = ?', [userId]);
            propertyIds = caretakerProps.map(p => p.property_id);
        }
        
        if (propertyIds.length === 0) {
            return res.json({
                success: true,
                stats: {
                    totalProperties: 0,
                    totalUnits: 0,
                    occupiedUnits: 0,
                    vacantUnits: 0,
                    totalTenants: 0,
                    monthlyRevenue: 0,
                    pendingPayments: 0,
                    openIssues: 0
                }
            });
        }
        
        const placeholders = propertyIds.map(() => '?').join(',');
        
        // Get property/unit stats
        const [unitStats] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
                SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant
            FROM units WHERE property_id IN (${placeholders})
        `, propertyIds);
        
        // Get tenant count
        const [tenantStats] = await pool.query(`
            SELECT COUNT(*) as total FROM tenants WHERE property_id IN (${placeholders}) AND status = 'active'
        `, propertyIds);
        
        // Get monthly revenue
        const currentMonth = new Date().toISOString().slice(0, 7);
        const [revenueStats] = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) as total FROM payments 
            WHERE property_id IN (${placeholders}) AND status = 'verified' AND payment_date LIKE ?
        `, [...propertyIds, `${currentMonth}%`]);
        
        // Get pending payments
        const [pendingStats] = await pool.query(`
            SELECT COUNT(*) as total FROM payments WHERE property_id IN (${placeholders}) AND status = 'pending'
        `, propertyIds);
        
        // Get open issues
        const [issueStats] = await pool.query(`
            SELECT COUNT(*) as total FROM maintenance WHERE property_id IN (${placeholders}) AND status != 'completed'
        `, propertyIds);
        
        res.json({
            success: true,
            stats: {
                totalProperties: propertyIds.length,
                totalUnits: unitStats[0].total || 0,
                occupiedUnits: unitStats[0].occupied || 0,
                vacantUnits: unitStats[0].vacant || 0,
                totalTenants: tenantStats[0].total || 0,
                monthlyRevenue: revenueStats[0].total || 0,
                pendingPayments: pendingStats[0].total || 0,
                openIssues: issueStats[0].total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ CARETAKER API ============

// Get caretakers
app.get('/api/caretakers', authenticateToken, async (req, res) => {
    try {
        const { property_id } = req.query;
        let query = `SELECT c.*, u.first_name, u.last_name, u.email, u.phone, pr.property_name 
                     FROM caretakers c 
                     JOIN users u ON c.user_id = u.id 
                     JOIN properties pr ON c.property_id = pr.id`;
        let params = [];
        
        if (property_id) {
            query += ' WHERE c.property_id = ?';
            params.push(property_id);
        }
        
        const [caretakers] = await pool.query(query, params);
        res.json({ success: true, caretakers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add caretaker
app.post('/api/caretakers', authenticateToken, async (req, res) => {
    try {
        const { user_id, property_id, commission_percentage, salary } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO caretakers (user_id, property_id, commission_percentage, salary, status, assigned_date) 
             VALUES (?, ?, ?, ?, 'active', CURDATE())`,
            [user_id, property_id, commission_percentage || 0, salary || 0]
        );
        
        res.json({ success: true, caretakerId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve dashboard with license check
app.get('/dashboard-landlord.html', authenticateToken, (req, res) => {
    res.sendFile(__dirname + '/dashboard-landlord.html');
});

// Also serve as /dashboard
app.get('/dashboard', authenticateToken, (req, res) => {
    res.sendFile(__dirname + '/dashboard-landlord.html');
});

// API: Get license status without auth (for license page)
app.get('/api/license/public', async (req, res) => {
    const status = await checkLicenseStatus();
    res.json({ license: status });
});

// =====================================================
// PUBLIC API ENDPOINTS (Contact, Newsletter, Reviews)
// =====================================================

// Submit contact inquiry
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, message, inquiryType } = req.body;
        
        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'Please fill in all required fields' });
        }
        
        const query = `
            INSERT INTO contact_inquiries (name, email, phone, subject, message, inquiry_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.query(query, [name, email, phone || null, subject, message, inquiryType || 'other']);
        
        res.json({ 
            success: true, 
            message: 'Thank you for your message! We will get back to you shortly.',
            inquiryId: result.insertId 
        });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to submit inquiry. Please try again.' });
    }
});

// Subscribe to newsletter
app.post('/api/newsletter/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Check if already subscribed
        const [existing] = await db.query(
            'SELECT id, is_active FROM newsletter_subscriptions WHERE email = ?',
            [email]
        );
        
        if (existing && existing.is_active) {
            return res.status(400).json({ error: 'This email is already subscribed' });
        }
        
        if (existing && !existing.is_active) {
            // Reactivate subscription
            await db.query(
                'UPDATE newsletter_subscriptions SET is_active = TRUE, unsubscribed_at = NULL WHERE email = ?',
                [email]
            );
            return res.json({ success: true, message: 'You have been resubscribed!' });
        }
        
        // Insert new subscription
        await db.query(
            'INSERT INTO newsletter_subscriptions (email) VALUES (?)',
            [email]
        );
        
        res.json({ success: true, message: 'Thank you for subscribing!' });
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
    }
});

// Get approved testimonials (public)
app.get('/api/testimonials', async (req, res) => {
    try {
        const { featured } = req.query;
        
        let query = `
            SELECT id, name, role, company, rating, title, content, is_verified, created_at
            FROM testimonials
            WHERE status = 'approved'
        `;
        
        if (featured === 'true') {
            query += ' AND is_featured = TRUE';
        }
        
        query += ' ORDER BY is_featured DESC, created_at DESC LIMIT 10';
        
        const testimonials = await db.query(query);
        res.json({ testimonials });
    } catch (error) {
        console.error('Get testimonials error:', error);
        res.status(500).json({ error: 'Failed to fetch testimonials' });
    }
});

// Submit testimonial/review
app.post('/api/testimonials', async (req, res) => {
    try {
        const { name, email, role, company, rating, title, content } = req.body;
        
        // Validate required fields
        if (!name || !role || !rating || !content) {
            return res.status(400).json({ error: 'Please fill in all required fields' });
        }
        
        // Get user_id if logged in
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const jwt = require('jsonwebtoken');
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
            } catch (e) {
                // Not authenticated, continue without user_id
            }
        }
        
        const query = `
            INSERT INTO testimonials (user_id, name, email, role, company, rating, title, content, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `;
        
        const result = await db.query(query, [userId, name, email || null, role, company || null, rating, title || null, content]);
        
        res.json({ 
            success: true, 
            message: 'Thank you for your review! It will be published after moderation.' 
        });
    } catch (error) {
        console.error('Submit testimonial error:', error);
        res.status(500).json({ error: 'Failed to submit review. Please try again.' });
    }
});

// ============ INVITATIONS API ============

// Send invitations to tenants and caretakers (called after registration)
app.post('/api/invitations/send', async (req, res) => {
    try {
        const { landlordId, tenantInvites, caretakerInvites } = req.body;
        
        if (!landlordId) {
            return res.status(400).json({ success: false, error: 'Landlord ID is required' });
        }
        
        // Get landlord info
        const [landlord] = await pool.query('SELECT first_name, last_name FROM users WHERE id = ?', [landlordId]);
        const landlordName = landlord.length > 0 ? `${landlord[0].first_name} ${landlord[0].last_name}` : 'Property Manager';
        
        // Process tenant invitations
        if (tenantInvites && tenantInvites.length > 0) {
            for (const invite of tenantInvites) {
                // Check if user already exists
                const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [invite.email]);
                
                if (existingUser.length === 0) {
                    // Create a placeholder user with pending status
                    const tempPassword = Math.random().toString(36).slice(-8);
                    const passwordHash = await bcrypt.hash(tempPassword, 10);
                    
                    // Split name
                    const nameParts = invite.name.split(' ');
                    const firstName = nameParts[0] || 'Tenant';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    
                    await pool.query(
                        'INSERT INTO users (email, password_hash, first_name, last_name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
                        [invite.email, passwordHash, firstName, lastName, 'tenant', 'pending']
                    );
                }
                
                // Create invitation record (you can add invitations table if needed)
                console.log(`Invitation sent to tenant: ${invite.email} from ${landlordName}`);
            }
        }
        
        // Process caretaker invitations
        if (caretakerInvites && caretakerInvites.length > 0) {
            for (const invite of caretakerInvites) {
                // Check if user already exists
                const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [invite.email]);
                
                if (existingUser.length === 0) {
                    // Create a placeholder user
                    const tempPassword = Math.random().toString(36).slice(-8);
                    const passwordHash = await bcrypt.hash(tempPassword, 10);
                    
                    const nameParts = invite.name.split(' ');
                    const firstName = nameParts[0] || 'Caretaker';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    
                    await pool.query(
                        'INSERT INTO users (email, password_hash, first_name, last_name, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [invite.email, passwordHash, firstName, lastName, invite.phone || '', 'caretaker', 'pending']
                    );
                }
                
                console.log(`Invitation sent to caretaker: ${invite.email} from ${landlordName}`);
            }
        }
        
        res.json({ success: true, message: 'Invitations sent successfully' });
    } catch (error) {
        console.error('Send invitations error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve new HTML pages
app.get('/how-it-works', (req, res) => {
    res.sendFile(__dirname + '/how-it-works.html');
});

app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/about.html');
});

app.get('/contact', (req, res) => {
    res.sendFile(__dirname + '/contact.html');
});

app.get('/get-started', (req, res) => {
    res.sendFile(__dirname + '/get-started.html');
});

app.get('/reviews', (req, res) => {
    res.sendFile(__dirname + '/reviews.html');
});

// Serve SEO files
app.get('/sitemap.xml', (req, res) => {
    res.sendFile(__dirname + '/sitemap.xml');
});

app.get('/robots.txt', (req, res) => {
    res.sendFile(__dirname + '/robots.txt');
});

app.get('/schema.json', (req, res) => {
    res.sendFile(__dirname + '/schema.json');
});

// =====================================================
// TRIAL STATUS API
// =====================================================

// Get user trial status
app.get('/api/user/trial-status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get user info including trial start date
        const [users] = await pool.query(
            'SELECT created_at, trial_end_date FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.json({ success: false, error: 'User not found' });
        }
        
        const user = users[0];
        const createdAt = new Date(user.created_at);
        const now = new Date();
        
        // Calculate trial days
        const trialDays = 14;
        const trialEnd = new Date(createdAt);
        trialEnd.setDate(trialEnd.getDate() + trialDays);
        
        const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
        const isTrial = daysLeft > 0;
        
        res.json({
            success: true,
            isTrial: isTrial,
            daysLeft: daysLeft,
            trialEnd: trialEnd.toISOString()
        });
    } catch (error) {
        console.error('Get trial status error:', error);
        res.status(500).json({ success: false, error: 'Failed to get trial status' });
    }
});

// SETTINGS API ENDPOINTS
// =====================================================

// Get user settings
app.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get or create user settings
        let [settings] = await pool.query(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [userId]
        );
        
        // If no settings exist, create default settings
        if (settings.length === 0) {
            await pool.query(
                'INSERT INTO user_settings (user_id) VALUES (?)',
                [userId]
            );
            [settings] = await pool.query(
                'SELECT * FROM user_settings WHERE user_id = ?',
                [userId]
            );
        }
        
        // Get user profile info
        const [users] = await pool.query(
            'SELECT first_name, last_name, email, phone, id_number FROM users WHERE id = ?',
            [userId]
        );
        
        res.json({ 
            success: true, 
            settings: settings[0] || {},
            profile: users[0] || {}
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

// Update user settings
app.put('/api/settings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings data' });
        }
        
        // Build update query dynamically based on provided settings
        const updates = [];
        const values = [];
        
        const allowedFields = [
            'notify_email', 'notify_payment', 'notify_late', 'notify_maintenance',
            'mpesa_shortcode', 'mpesa_paybill', 'mpesa_customer_name',
            'late_fee', 'late_fee_amount', 'rent_due_day', 'auto_reminders'
        ];
        
        for (const [key, value] of Object.entries(settings)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid settings to update' });
        }
        
        values.push(userId);
        
        // Insert or update settings
        await pool.query(
            `INSERT INTO user_settings (user_id, ${allowedFields.join(', ')}) 
             VALUES (?, ${allowedFields.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
            [userId, ...Object.values(settings).slice(0, allowedFields.length), ...values.slice(0, -1)]
        );
        
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Update user profile
app.put('/api/settings/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, phone, idNumber } = req.body;
        
        await pool.query(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, id_number = ? WHERE id = ?',
            [firstName, lastName, phone, idNumber, userId]
        );
        
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Change password
app.put('/api/settings/password', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Please provide both current and new password' });
        }
        
        // Verify current password
        const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
        const validPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
        
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Catch-all route for any unmatched paths - serve index.html
app.get('*', (req, res) => {
    // If it's an API call, return 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Otherwise serve index.html
    res.sendFile(__dirname + '/index.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`RentFlow running at http://localhost:${PORT}`);
    });
});

module.exports = app;
