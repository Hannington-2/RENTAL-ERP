# RentFlow - Rental Management System

A comprehensive rental management platform built for the Kenyan/African market with M-Pesa integration, multi-role access, and automated financial management.

## Features

- **Multi-Role System**: Landlords, Caretakers, and Tenants with role-based access
- **Smart Rent Payments**: M-Pesa STK Push, Bank transfers, Cash, Card payments
- **Real-time Verification**: Automatic payment matching and confirmation
- **Automated Invoicing**: PDF receipts and invoices automatically generated
- **Maintenance Tracking**: Digital issue reporting with priority levels
- **Financial Reports**: Monthly reports, KRA compliance, exportable data
- **Communication**: SMS and WhatsApp notifications

## Project Structure

```
RENTAL ERP/
├── index.html              # Landing page
├── login.html             # Login page
├── register.html          # Registration page
├── dashboard-landlord.html # Landlord dashboard
├── dashboard-caretaker.html # Caretaker dashboard
├── dashboard-tenant.html   # Tenant dashboard
├── api.js                 # Frontend API client
├── server.js              # Backend API (Node.js)
├── database.sql           # MySQL database schema
├── package.json           # Node.js dependencies
├── .env.example          # Environment configuration
└── README.md              # This file
```

## Quick Start

### Prerequisites

1. **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
2. **MySQL** (v5.7 or higher) - [Download](https://www.mysql.com/)
3. **Web Server** (Apache/Nginx) or VS Code Live Server

### Installation

1. **Clone or download** the project files

2. **Set up the database**:
   ```bash
   # Open MySQL
   mysql -u root -p
   
   # Run the database script
   SOURCE path/to/database.sql;
   ```

3. **Configure the backend**:
   ```bash
   # Copy the environment file
   cp .env.example .env
   
   # Edit .env with your database credentials
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Start the server**:
   ```bash
   npm start
   ```

6. **Access the application**:
   - Frontend: http://localhost (or your web server)
   - API: http://localhost:3000/api

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Landlord | landlord@demo.com | demo123 |
| Caretaker | caretaker@demo.com | demo123 |
| Tenant | tenant@demo.com | demo123 |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Landlord
- `GET /api/landlord/dashboard` - Dashboard stats
- `GET /api/landlord/tenants` - List all tenants
- `POST /api/landlord/tenants` - Add new tenant
- `GET /api/landlord/payments` - Payment history

### Caretaker
- `GET /api/caretaker/dashboard` - Operations dashboard
- `POST /api/caretaker/verify-payment` - Verify payment
- `POST /api/caretaker/record-payment` - Record payment

### Tenant
- `GET /api/tenant/dashboard` - Tenant overview
- `POST /api/tenant/pay-rent` - Make payment
- `POST /api/tenant/maintenance` - Submit request

### Maintenance
- `GET /api/maintenance` - All requests
- `PUT /api/maintenance/:id` - Update status

### M-Pesa
- `POST /api/mpesa/stkpush` - Initiate STK Push
- `POST /api/mpesa/callback` - Payment callback

## Database Schema

### Core Tables
- `users` - All system users (landlords, caretakers, tenants)
- `properties` - Rental properties
- `units` - Individual rooms/apartments
- `tenants` - Tenant assignments
- `payments` - Payment records
- `invoices` - Generated invoices
- `receipts` - Payment receipts
- `maintenance_requests` - Maintenance issues
- `notices` - Announcements to tenants
- `notifications` - User notifications
- `caretaker_assignments` - Caretaker-property links

## M-Pesa Integration

To enable real M-Pesa payments:

1. Register at [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Create an app and get credentials
3. Update `.env` with your credentials
4. Configure callback URL in your app settings

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Payments**: M-Pesa Daraja API
- **Security**: bcryptjs for password hashing

## Marketing Positioning

> **Don't market it as "Property Management Software"**
> 
> Market it as: **"A Rent & Payment Control System for Hostels and Rentals"**
> 
> Unique Selling Points:
> 1. Real-time payment verification
> 2. Landlord–Caretaker separation
> 3. Automatic invoices
> 4. M-Pesa-first design
> 5. No Excel. No lies. No delays.

## License

MIT License - Feel free to use and modify for your needs.

## Support

For questions or issues, contact: support@rentflow.co.ke

---

Built with ❤️ in Kenya for African Landlords
