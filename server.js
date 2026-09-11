const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 10000;

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors());
app.use(express.json());

// ===============================
// DATABASE
// ===============================
const db = new Database("shop.db");

db.pragma("journal_mode = WAL");

// ===============================
// OWNER SETTINGS
// ===============================
const OWNER_MOBILE = "9530450140";

const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

// ===============================
// TABLES
// ===============================

db.exec(`
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    description TEXT,
    category TEXT,
    stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    mobile TEXT UNIQUE,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    total REAL NOT NULL,
    status TEXT DEFAULT 'Pending',
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price REAL
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    mobile TEXT,
    message TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ===============================
// DEMO PRODUCTS
// ===============================

const productCount = db
    .prepare("SELECT COUNT(*) AS count FROM products")
    .get().count;

if (productCount === 0) {
    const insert = db.prepare(`
        INSERT INTO products
        (name, price, image, description, category, stock)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    insert.run(
        "Stylish T-Shirt",
        499,
        "https://via.placeholder.com/300",
        "Premium quality stylish T-Shirt",
        "T-Shirts",
        20
    );

    insert.run(
        "Classic Shirt",
        799,
        "https://via.placeholder.com/300",
        "Comfortable classic shirt",
        "Shirts",
        15
    );

    insert.run(
        "Fashion Jeans",
        999,
        "https://via.placeholder.com/300",
        "Trendy fashion jeans",
        "Jeans",
        10
    );

    insert.run(
        "Hoodie",
        899,
        "https://via.placeholder.com/300",
        "Warm and stylish hoodie",
        "Hoodies",
        12
    );
}

// ===============================
// HOME / HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Kit Kit Fashion Backend is running 🚀"
    });
});

// =====================================================
// PRODUCTS
// =====================================================

// GET PRODUCTS
app.get("/api/products", (req, res) => {
    try {
        const products = db
            .prepare("SELECT * FROM products ORDER BY id DESC")
            .all();

        res.json(products);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Products load nahi ho paye"
        });
    }
});

// ADD PRODUCT
app.post("/api/products", (req, res) => {
    try {
        const {
            name,
            price,
            image,
            description,
            category,
            stock
        } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({
                success: false,
                message: "Product name aur price required hai"
            });
        }

        const result = db.prepare(`
            INSERT INTO products
            (name, price, image, description, category, stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            name,
            Number(price),
            image || "",
            description || "",
            category || "",
            Number(stock || 0)
        );

        const product = db
            .prepare("SELECT * FROM products WHERE id = ?")
            .get(result.lastInsertRowid);

        res.json({
            success: true,
            product
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Product add nahi hua"
        });
    }
});

// UPDATE PRODUCT
app.put("/api/products/:id", (req, res) => {
    try {
        const id = req.params.id;

        const {
            name,
            price,
            image,
            description,
            category,
            stock
        } = req.body;

        const result = db.prepare(`
            UPDATE products
            SET
                name = ?,
                price = ?,
                image = ?,
                description = ?,
                category = ?,
                stock = ?
            WHERE id = ?
        `).run(
            name,
            Number(price),
            image || "",
            description || "",
            category || "",
            Number(stock || 0),
            id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Product nahi mila"
            });
        }

        res.json({
            success: true,
            message: "Product updated"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Product update nahi hua"
        });
    }
});

// DELETE PRODUCT
app.delete("/api/products/:id", (req, res) => {
    try {
        const id = req.params.id;

        const result = db
            .prepare("DELETE FROM products WHERE id = ?")
            .run(id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Product nahi mila"
            });
        }

        res.json({
            success: true,
            message: "Product deleted"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Product delete nahi hua"
        });
    }
});

// =====================================================
// CUSTOMERS
// =====================================================

// ADD CUSTOMER
app.post("/api/customers", (req, res) => {
    try {
        const {
            name,
            mobile,
            email
        } = req.body;

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile required hai"
            });
        }

        const existing = db
            .prepare("SELECT * FROM customers WHERE mobile = ?")
            .get(mobile);

        if (existing) {
            return res.json({
                success: true,
                customer: existing
            });
        }

        const result = db.prepare(`
            INSERT INTO customers
            (name, mobile, email)
            VALUES (?, ?, ?)
        `).run(
            name || "",
            mobile,
            email || ""
        );

        const customer = db
            .prepare("SELECT * FROM customers WHERE id = ?")
            .get(result.lastInsertRowid);

        res.json({
            success: true,
            customer
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Customer save nahi hua"
        });
    }
});

// GET CUSTOMERS
app.get("/api/customers", (req, res) => {
    try {
        const customers = db
            .prepare("SELECT * FROM customers ORDER BY id DESC")
            .all();

        res.json(customers);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Customers load nahi hue"
        });
    }
});

// CUSTOMER COUNT
app.get("/api/customers/count", (req, res) => {
    try {
        const result = db
            .prepare("SELECT COUNT(*) AS count FROM customers")
            .get();

        res.json(result);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Customer count nahi mila"
        });
    }
});

// =====================================================
// ORDERS
// =====================================================

// CREATE ORDER
app.post("/api/orders", (req, res) => {
    try {
        const {
            customer_id,
            total,
            address,
            items
        } = req.body;

        if (!total || !items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                message: "Order information incomplete hai"
            });
        }

        const createOrder = db.transaction(() => {

            const orderResult = db.prepare(`
                INSERT INTO orders
                (customer_id, total, address, status)
                VALUES (?, ?, ?, ?)
            `).run(
                customer_id || null,
                Number(total),
                address || "",
                "Pending"
            );

            const orderId = orderResult.lastInsertRowid;

            const insertItem = db.prepare(`
                INSERT INTO order_items
                (order_id, product_id, quantity, price)
                VALUES (?, ?, ?, ?)
            `);

            for (const item of items) {
                insertItem.run(
                    orderId,
                    item.product_id,
                    Number(item.quantity || 1),
                    Number(item.price || 0)
                );
            }

            return orderId;
        });

        const orderId = createOrder();

        res.json({
            success: true,
            order_id: orderId,
            message: "Order created successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Order create nahi hua"
        });
    }
});

// GET ORDERS
app.get("/api/orders", (req, res) => {
    try {
        const orders = db.prepare(`
            SELECT
                orders.*,
                customers.name AS customer_name,
                customers.mobile AS customer_mobile
            FROM orders
            LEFT JOIN customers
            ON orders.customer_id = customers.id
            ORDER BY orders.id DESC
        `).all();

        res.json(orders);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Orders load nahi hue"
        });
    }
});

// UPDATE ORDER STATUS
app.put("/api/orders/:id/status", (req, res) => {
    try {
        const id = req.params.id;
        const { status } = req.body;

        const result = db.prepare(`
            UPDATE orders
            SET status = ?
            WHERE id = ?
        `).run(status, id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Order nahi mila"
            });
        }

        res.json({
            success: true,
            message: "Order status updated"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Status update nahi hua"
        });
    }
});

// =====================================================
// COMPLAINTS
// =====================================================

// ADD COMPLAINT
app.post("/api/complaints", (req, res) => {
    try {
        const {
            customer_name,
            mobile,
            message
        } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Complaint message required hai"
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
            complaint_id: result.lastInsertRowid,
            message: "Complaint submitted"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Complaint save nahi hui"
        });
    }
});

// GET COMPLAINTS
app.get("/api/complaints", (req, res) => {
    try {
        const complaints = db
            .prepare("SELECT * FROM complaints ORDER BY id DESC")
            .all();

        res.json(complaints);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Complaints load nahi hui"
        });
    }
});

// =====================================================
// SALES
// =====================================================

app.get("/api/sales", (req, res) => {
    try {
        const result = db.prepare(`
            SELECT
                COUNT(*) AS total_orders,
                COALESCE(SUM(total), 0) AS total_sales
            FROM orders
            WHERE status != 'Cancelled'
        `).get();

        res.json(result);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Sales data load nahi hua"
        });
    }
});

// =====================================================
// OWNER - SEND OTP
// =====================================================

app.post("/api/owner/send-otp", async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile number required"
            });
        }

        if (mobile !== OWNER_MOBILE) {
            return res.status(403).json({
                success: false,
                message: "Owner number allowed nahi hai"
            });
        }

        if (!MSG91_AUTHKEY || !MSG91_TEMPLATE_ID) {
            return res.status(500).json({
                success: false,
                message: "MSG91 server par configure nahi hai"
            });
        }

        const response = await fetch(
            `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(
                MSG91_TEMPLATE_ID
            )}&mobile=91${OWNER_MOBILE}`,
            {
                method: "POST",
                headers: {
                    authkey: MSG91_AUTHKEY,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        console.log("MSG91 Send OTP:", data);

        if (!response.ok || data.type !== "success") {
            return res.status(500).json({
                success: false,
                message: "OTP send nahi ho paya"
            });
        }

        res.json({
            success: true,
            message: "OTP sent successfully"
        });

    } catch (error) {
        console.error("Send OTP Error:", error);

        res.status(500).json({
            success: false,
            message: "OTP server error"
        });
    }
});

// =====================================================
// OWNER - VERIFY OTP
// =====================================================

app.post("/api/owner/verify-otp", async (req, res) => {
    try {
        const {
            mobile,
            otp
        } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile aur OTP required hai"
            });
        }

        if (mobile !== OWNER_MOBILE) {
            return res.status(403).json({
                success: false,
                message: "Owner number allowed nahi hai"
            });
        }

        if (!MSG91_AUTHKEY) {
            return res.status(500).json({
                success: false,
                message: "MSG91 server par configure nahi hai"
            });
        }

        const response = await fetch(
            `https://control.msg91.com/api/v5/otp/verify?otp=${encodeURIComponent(
                otp
            )}&mobile=91${OWNER_MOBILE}`,
            {
                method: "GET",
                headers: {
                    authkey: MSG91_AUTHKEY
                }
            }
        );

        const data = await response.json();

        console.log("MSG91 Verify OTP:", data);

        if (!response.ok || data.type !== "success") {
            return res.status(401).json({
                success: false,
                message: "Invalid ya expired OTP"
            });
        }

        res.json({
            success: true,
            message: "Owner login successful"
        });

    } catch (error) {
        console.error("Verify OTP Error:", error);

        res.status(500).json({
            success: false,
            message: "OTP verification error"
        });
    }
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
    console.log(`Kit Kit Fashion Backend running on port ${PORT}`);
});
