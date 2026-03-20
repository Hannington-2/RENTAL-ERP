-- =====================================================
-- RENTFLOW PRO - Clean Production Database Schema
-- No sample data - Ready for business use
-- =====================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS rentflow;
USE rentflow;

-- =====================================================
-- USERS TABLE
-- =====================================================
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
);

-- =====================================================
-- PROPERTIES TABLE
-- =====================================================
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
);

-- =====================================================
-- UNITS TABLE
-- =====================================================
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
);

-- =====================================================
-- TENANTS TABLE
-- =====================================================
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
);

-- =====================================================
-- CARETAKERS TABLE
-- =====================================================
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
);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
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
    FOREIGN KEY (verified_by) REFERENCES users(id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status),
    INDEX idx_payment_date (payment_date),
    INDEX idx_transaction (transaction_id)
);

-- =====================================================
-- RECEIPTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    tenant_name VARCHAR(200),
    unit_number VARCHAR(50),
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    payment_date DATE,
    issued_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES users(id),
    INDEX idx_receipt_number (receipt_number)
);

-- =====================================================
-- EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    unit_id INT,
    category ENUM('repair', 'maintenance', 'utility', 'legal', 'agent', 'other') DEFAULT 'other',
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    vendor_name VARCHAR(200),
    receipt_number VARCHAR(100),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by INT,
    approved_at TIMESTAMP,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_property (property_id),
    INDEX idx_category (category),
    INDEX idx_status (status)
);

-- =====================================================
-- MAINTENANCE REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS maintenance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    unit_id INT,
    tenant_id INT,
    reported_by INT NOT NULL,
    category ENUM('plumbing', 'electrical', 'structural', 'appliance', 'pest', 'other') DEFAULT 'other',
    priority ENUM('low', 'medium', 'high', 'emergency') DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    assigned_to INT,
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    INDEX idx_property (property_id),
    INDEX idx_status (status),
    INDEX idx_priority (priority)
);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    property_id INT,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    INDEX idx_sender (sender_id),
    INDEX idx_recipient (recipient_id),
    INDEX idx_is_read (is_read)
);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('payment', 'reminder', 'maintenance', 'message', 'system') DEFAULT 'system',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_is_read (is_read)
);

-- =====================================================
-- USER SETTINGS TABLE
-- =====================================================
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
);

-- =====================================================
-- LICENSE TABLE (For Subscription Management)
-- =====================================================
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
);

-- =====================================================
-- LICENSE PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS license_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_id INT,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES license(id) ON DELETE SET NULL
);

-- =====================================================
-- SMS LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
    mpesa_code VARCHAR(50),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (recipient_phone),
    INDEX idx_status (status)
);

-- =====================================================
-- PROPERTY IMAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS property_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    image_type ENUM('cover', 'gallery', 'floor_plan') DEFAULT 'gallery',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    INDEX idx_property (property_id)
);

-- =====================================================
-- LEASE DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS lease_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    document_type ENUM('lease_agreement', 'id_copy', 'kra_pin', 'other') DEFAULT 'other',
    document_url VARCHAR(255) NOT NULL,
    file_name VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_tenant (tenant_id)
);

-- =====================================================
-- CONTACT INQUIRIES TABLE
-- =====================================================
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
);

-- =====================================================
-- NEWSLETTER SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP NULL
);

-- =====================================================
-- TESTIMONIALS TABLE
-- =====================================================
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
);

-- =====================================================
-- INSERT DEFAULT LICENSE (14-Day Trial)
-- =====================================================
INSERT INTO license (license_type, start_date, expiry_date, status, is_trial) 
VALUES ('trial', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'active', TRUE);

-- =====================================================
-- DATABASE READY FOR PRODUCTION USE
-- =====================================================
SELECT 'Clean database created successfully! Ready for business use.' AS message;
