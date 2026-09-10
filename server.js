const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new Database("shop.db");

db.pragma("foreign_keys = ON");

/* =========================
   DATABASE TABLES
========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    mrp REAL,
    rating REAL,
    image TEXT,
    description TEXT,
    stock INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    mobile TEXT,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);


/* =========================
   DEMO PRODUCTS
========================= */

const productCount = db
    .prepare("SELECT COUNT(*) AS count FROM products")
    .get();

if (productCount.count === 0) {

    const insert = db.prepare(`
        INSERT INTO products
        (name, price, mrp, rating, image, description, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
        "Classic Oversized T-Shirt",
        799,
        1199,
        4.5,
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80",
        "Comfortable premium oversized T-shirt.",
        50
    );

    insert.run(
        "Premium Casual Shirt",
        1299,
        1799,
        4.6,
        "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=700&q=80",
        "Premium casual shirt for everyday style.",
        30
    );

    insert.run(
        "Everyday Hoodie",
        1499,
        2199,
        4.7,
        "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=700&q=80",
        "Soft and comfortable everyday hoodie.",
        25
    );

    insert.run(
        "Relaxed Fit Jeans",
        1599,
        2299,
        4.4,
        "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=700&q=80",
        "Relaxed fit jeans with comfortable styling.",
        20
    );
}


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
    res.json({
        message: "Kit Kit Fashion Backend is running!"
    });
});


/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {

    const products = db
        .prepare("SELECT * FROM products ORDER BY id DESC")
        .all();

    res.json(products);
});


app.post("/api/products", (req, res) => {

    const {
        name,
        price,
        mrp,
        rating,
        image,
        description,
        stock
    } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({
            error: "Name and price required"
        });
    }

    const result = db.prepare(`
        INSERT INTO products
        (name, price, mrp, rating, image, description, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        name,
        price,
        mrp || null,
        rating || 0,
        image || "",
        description || "",
        stock || 0
    );

    res.json({
        success: true,
        id: result.lastInsertRowid
    });
});


/* =========================
   CUSTOMERS
========================= */

app.post("/api/customers", (req, res) => {

    const {
        name,
        mobile,
        address
    } = req.body;

    if (!name || !mobile) {
        return res.status(400).json({
            error: "Name and mobile required"
        });
    }

    const existing = db
        .prepare(
            "SELECT * FROM customers WHERE mobile = ?"
        )
        .get(mobile);

    if (existing) {

        db.prepare(`
            UPDATE customers
            SET name = ?, address = ?
            WHERE mobile = ?
        `).run(
            name,
            address || "",
            mobile
        );

        return res.json({
            success: true,
            customer: existing
        });
    }

    const result = db.prepare(`
        INSERT INTO customers
        (name, mobile, address)
        VALUES (?, ?, ?)
    `).run(
        name,
        mobile,
        address || ""
    );

    const customer = db
        .prepare(
            "SELECT * FROM customers WHERE id = ?"
        )
        .get(result.lastInsertRowid);

    res.json({
        success: true,
        customer
    });
});


app.get("/api/customers", (req, res) => {

    const customers = db.prepare(`
        SELECT
            c.*,
            COUNT(o.id) AS total_orders
        FROM customers c
        LEFT JOIN orders o
        ON c.id = o.customer_id
        GROUP BY c.id
        ORDER BY c.id DESC
    `).all();

    res.json(customers);
});


app.get("/api/customers/count", (req, res) => {

    const result = db
        .prepare(
            "SELECT COUNT(*) AS count FROM customers"
        )
        .get();

    res.json(result);
});


/* =========================
   ORDERS
========================= */

app.post("/api/orders", (req, res) => {

    const {
        customerId,
        items
    } = req.body;

    if (!customerId || !Array.isArray(items) || !items.length) {
        return res.status(400).json({
            error: "Customer and items required"
        });
    }

    let total = 0;

    const productQuery = db.prepare(
        "SELECT * FROM products WHERE id = ?"
    );

    for (const item of items) {

        const product = productQuery.get(
            item.productId
        );

        if (!product) {
            return res.status(400).json({
                error: `Product ${item.productId} not found`
            });
        }

        total +=
            product.price *
            item.quantity;
    }

    const createOrder = db.prepare(`
        INSERT INTO orders
        (customer_id, total)
        VALUES (?, ?)
    `);

    const orderResult = createOrder.run(
        customerId,
        total
    );

    const orderId =
        orderResult.lastInsertRowid;

    const insertItem = db.prepare(`
        INSERT INTO order_items
        (order_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
    `);

    for (const item of items) {

        const product =
            productQuery.get(item.productId);

        insertItem.run(
            orderId,
            product.id,
            item.quantity,
            product.price
        );
    }

    res.json({
        success: true,
        orderId,
        total
    });
});


app.get("/api/orders", (req, res) => {

    const orders = db.prepare(`
        SELECT
            o.id,
            o.total,
            o.status,
            o.created_at,
            c.name AS customer_name,
            c.mobile,
            c.address
        FROM orders o
        JOIN customers c
        ON o.customer_id = c.id
        ORDER BY o.id DESC
    `).all();

    res.json(orders);
});


app.put("/api/orders/:id/status", (req, res) => {

    const { status } = req.body;

    db.prepare(`
        UPDATE orders
        SET status = ?
        WHERE id = ?
    `).run(
        status,
        req.params.id
    );

    res.json({
        success: true
    });
});


/* =========================
   COMPLAINTS
========================= */

app.post("/api/complaints", (req, res) => {

    const {
        customer_name,
        mobile,
        message
    } = req.body;

    if (!message) {
        return res.status(400).json({
            error: "Message required"
        });
    }

    const result = db.prepare(`
        INSERT INTO complaints
        (customer_name, mobile, message)
        VALUES (?, ?, ?)
    `).run(
        customer_name || "",
        mobile || "",
        message
    );

    res.json({
        success: true,
        id: result.lastInsertRowid
    });
});


app.get("/api/complaints", (req, res) => {

    const complaints = db.prepare(`
        SELECT *
        FROM complaints
        ORDER BY id DESC
    `).all();

    res.json(complaints);
});


/* =========================
   SALES
========================= */

app.get("/api/sales", (req, res) => {

    const result = db.prepare(`
        SELECT
            COUNT(*) AS total_orders,
            COALESCE(SUM(total), 0) AS total_sales
        FROM orders
    `).get();

    res.json(result);
});


/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {

    console.log(
        `Kit Kit Fashion backend running on port ${PORT}`
    );

});