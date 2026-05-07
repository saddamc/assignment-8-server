# LuxeCommerce Server API

Express 5 + TypeScript + Prisma (PostgreSQL) + Stripe + Cloudinary

Base URL: `http://localhost:5000/api/v1`

---

## Authentication

All protected routes require a JWT `accessToken` cookie (set on login). Role values: `CUSTOMER`, `SELLER`, `ADMIN`.

### `POST /auth/login`

Login with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "yourPassword"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt...",
    "user": { "id": "...", "email": "...", "role": "CUSTOMER" }
  }
}
```

Sets `accessToken` + `refreshToken` cookies.

---

### `POST /auth/refresh-token`

Refresh the access token using the `refreshToken` cookie.

**Response:**

```json
{ "success": true, "data": { "accessToken": "jwt..." } }
```

---

### `POST /auth/change-password`

🔒 **Auth Required** (any role)

**Request Body:**

```json
{ "currentPassword": "old", "newPassword": "new" }
```

---

## User

### `POST /user/create-customer`

Register a new customer account.

**Request Body:**

```json
{
  "password": "Password123",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "contactNumber": "+1234567890",
    "address": "New York, USA"
  }
}
```

You can also send flat JSON (without `customer` wrapper), for example:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "phone": "+1234567890"
}
```

---

### `POST /user/create-seller`

Register a new seller account.

**Request Body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "Password123",
  "storeName": "Jane's Boutique",
  "phone": "+1234567890"
}
```

---

### `POST /user/create-admin`

🔒 **Auth Required** (ADMIN only)

**Request Body:**

```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "AdminPass123"
}
```

---

### `GET /user/all-users`

🔒 **Auth Required** (ADMIN only)

**Query Params:** `page`, `limit`, `role`, `status`, `searchTerm`

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [...users],
    "meta": { "total": 100, "page": 1, "limit": 10 }
  }
}
```

---

### `GET /user/me`

🔒 **Auth Required** (any role)

Returns the current user's profile.

---

### `PATCH /user/update-my-profile`

🔒 **Auth Required** (any role)

**Request Body (multipart/form-data):**

```text
name: "Updated Name"
phone: "+1987654321"
profilePhoto: <file>   (optional)
```

---

### `PATCH /user/change-status/:userId`

🔒 **Auth Required** (ADMIN only)

**Request Body:**

```json
{ "status": "BLOCKED" }
```

Status values: `ACTIVE`, `BLOCKED`

---

## Products

### `GET /products/categories`

Get all product categories.

**Response:**

```json
{
  "success": true,
  "data": [{ "id": "...", "name": "Electronics", "image": "url..." }]
}
```

---

### `POST /products/categories`

🔒 **Auth Required** (ADMIN only)

**Request Body (multipart/form-data):**

```text
name: "New Category"
image: <file>   (optional)
```

---

### `PATCH /products/categories/:id`

🔒 **Auth Required** (ADMIN only)

**Request Body (multipart/form-data):**

```text
name: "Updated Name"
image: <file>   (optional)
```

---

### `DELETE /products/categories/:id`

🔒 **Auth Required** (ADMIN only)

---

### `GET /products`

Get all products with filtering, sorting, and pagination.

**Query Params:**

| Param | Type | Description |
| --- | --- | --- |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10) |
| `searchTerm` | string | Search by name/description |
| `categoryId` | string | Filter by category |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |
| `sortBy` | string | Field to sort by (e.g. `price`, `createdAt`) |
| `sortOrder` | `asc` \| `desc` | Sort direction |

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [...products],
    "meta": { "total": 200, "page": 1, "limit": 10 }
  }
}
```

---

### `GET /products/:id`

Get a single product by ID (includes category, seller info, and reviews).

---

### `POST /products`

🔒 **Auth Required** (SELLER or ADMIN)

**Request Body (multipart/form-data):**

```text
name: "Product Name"
description: "Product description"
price: 299.99
stock: 50
categoryId: "uuid..."
discount: 10        (optional, percentage)
images: <files>     (up to 5 images, uploaded to Cloudinary)
```

---

### `PATCH /products/:id`

🔒 **Auth Required** (SELLER owner or ADMIN)

**Request Body (multipart/form-data):** (same fields as POST, all optional)

---

### `DELETE /products/:id`

🔒 **Auth Required** (SELLER owner or ADMIN)

---

### `POST /products/:id/reviews`

🔒 **Auth Required** (CUSTOMER only)

**Request Body:**

```json
{ "rating": 5, "comment": "Excellent product!" }
```

---

### `GET /products/:id/reviews`

Get all reviews for a product.

---

## Cart

### `GET /cart`

🔒 **Auth Required** (CUSTOMER)

Returns the current customer's cart with all items and product details.

---

### `POST /cart`

🔒 **Auth Required** (CUSTOMER)

**Request Body:**

```json
{ "productId": "uuid...", "quantity": 2 }
```

---

### `PATCH /cart/:itemId`

🔒 **Auth Required** (CUSTOMER)

**Request Body:**

```json
{ "quantity": 3 }
```

---

### `DELETE /cart/:itemId`

🔒 **Auth Required** (CUSTOMER)

Remove a single item from the cart.

---

### `DELETE /cart`

🔒 **Auth Required** (CUSTOMER)

Clear the entire cart.

---

## Orders

### `POST /orders`

🔒 **Auth Required** (CUSTOMER)

Creates an order from the current cart contents. Clears the cart on success.

**Request Body:**

```json
{
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "US"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "order-uuid...",
    "totalAmount": 599.98,
    "status": "PENDING",
    "items": [...]
  }
}
```

---

### `GET /orders/my-orders`

🔒 **Auth Required** (CUSTOMER)

Returns all orders for the current customer.

**Query Params:** `page`, `limit`, `status`

---

### `GET /orders`

🔒 **Auth Required** (ADMIN)

Returns all orders in the system.

**Query Params:** `page`, `limit`, `status`, `searchTerm`

---

### `PATCH /orders/:id/status`

🔒 **Auth Required** (ADMIN or SELLER)

**Request Body:**

```json
{ "status": "SHIPPED" }
```

Status values: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`

---

## Payments

### `POST /payment/create-intent`

🔒 **Auth Required** (CUSTOMER)

Creates a Stripe PaymentIntent for the specified order.

**Request Body:**

```json
{ "orderId": "uuid..." }
```

**Response:**

```json
{
  "success": true,
  "data": { "clientSecret": "pi_xxx_secret_xxx" }
}
```

---

### `POST /payment/webhook`

Stripe webhook endpoint. Must be called with raw body and `stripe-signature` header.

Handles `payment_intent.succeeded` and `payment_intent.payment_failed` events.

> **Note:** Configure your Stripe webhook to point to `https://yourdomain.com/api/v1/payment/webhook`

---

## Wishlist

### `GET /wishlist`

🔒 **Auth Required** (CUSTOMER)

Returns all items in the current customer's wishlist with product details.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "items": [{ "id": "...", "product": {...} }]
  }
}
```

---

### `POST /wishlist/:productId/toggle`

🔒 **Auth Required** (CUSTOMER)

Adds the product to the wishlist if not present, or removes it if it is.

**Response:**

```json
{
  "success": true,
  "data": { "added": true, "message": "Product added to wishlist" }
}
```

---

### `GET /wishlist/:productId/status`

🔒 **Auth Required** (CUSTOMER)

**Response:**

```json
{
  "success": true,
  "data": { "isWishlisted": true }
}
```

---

## Analytics

### `GET /analytics/admin`

🔒 **Auth Required** (ADMIN only)

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRevenue": 124500,
      "totalOrders": 1847,
      "totalCustomers": 8432,
      "totalProducts": 356,
      "pendingOrders": 24,
      "lowStockProducts": 8
    },
    "recentOrders": [...last 10 orders with customer details],
    "topProducts": [...top 5 products by order count],
    "lowStockProducts": [...products with stock <= 5],
    "revenueChart": [
      { "month": "Jan", "revenue": 18200 }
    ]
  }
}
```

---

### `GET /analytics/seller`

🔒 **Auth Required** (SELLER only)

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRevenue": 12450,
      "totalOrders": 142,
      "totalProducts": 38,
      "pendingOrders": 14
    },
    "recentOrders": [...last 10 orders for this seller],
    "myProducts": [...this seller's products with stock info]
  }
}
```

---

## Error Format

All errors follow this structure:

```json
{
  "success": false,
  "message": "Error description",
  "errorDetails": { ... }
}
```

**Common HTTP Status Codes:**

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Created |
| `400` | Bad Request / Validation Error |
| `401` | Unauthorized (missing/expired token) |
| `403` | Forbidden (insufficient role) |
| `404` | Not Found |
| `409` | Conflict (duplicate) |
| `500` | Internal Server Error |

---

## Environment Variables

```env
DATABASE_URL="postgresql://..."
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_ACCESS_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
CLIENT_URL="http://localhost:3000"
PORT=5000
```

---

## Running the Server

```bash
# Install dependencies
pnpm install

# Run Prisma migrations
pnpm prisma migrate dev

# Seed the database (if available)
pnpm prisma db seed

# Start development server
pnpm dev

# Build for production
pnpm build
pnpm start
```

---

## Testing with Postman

Import the collection from `follow-server/External_Resources/HealthCare.postman_collection.json` as a starting reference, or use the endpoints above directly.

Set up a Postman environment with:

- `base_url`: `http://localhost:5000/api/v1`
- `access_token`: (filled after login)

For authenticated requests, add the cookie: `accessToken={{access_token}}`
