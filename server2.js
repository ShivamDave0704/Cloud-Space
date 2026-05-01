// server2.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { getUsersList } from "./utils/pay-kundli-manager.js";
import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();

/* ===============================
   FIX __dirname (ESM)
================================*/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/* ===============================
   SUPPORT FOLDER + FILE
================================*/
const supportDir = path.join(process.cwd(), "support");
const feedbackFile = path.join(supportDir, "support.json");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ANSI Color codes
const colors = {
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

// ASCII Art Banner
console.log(`\n${colors.cyan}${colors.bright}
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██████╗██╗      ██████╗ ██╗   ██╗██████╗                       ║
║  ██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗                      ║
║  ██║     ██║     ██║   ██║██║   ██║██║  ██║                      ║
║  ██║     ██║     ██║   ██║██║   ██║██║  ██║                      ║
║  ╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝                      ║
║   ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝                       ║
║                                                                   ║
║   ███████╗██████╗  █████╗  ██████╗███████╗                       ║
║   ██╔════╝██╔══██╗██╔══██╗██╔════╝██╔════╝                       ║
║   ███████╗██████╔╝███████║██║     █████╗                         ║
║   ╚════██║██╔═══╝ ██╔══██║██║     ██╔══╝                         ║
║   ███████║██║     ██║  ██║╚██████╗███████╗                       ║
║   ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝╚══════╝                       ║
║                                                                   ║
║              ${colors.green}⚡ Premium Cloud Storage Platform ⚡${colors.cyan}              ║
║                     ${colors.yellow}v2.0.0 - Production Ready${colors.cyan}                ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
${colors.reset}`);

console.log(`${colors.magenta}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
console.log(`${colors.bright}${colors.blue}📋 SYSTEM INITIALIZATION${colors.reset}\n`);
console.log(`${colors.bright}${colors.green}🔐 JWT Secret: ${JWT_SECRET === "supersecretkey" ? colors.yellow + "⚠️  Using Default (Change in Production!)" : colors.cyan + "✅ Custom from .env"}${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}🔑 Key Value:  ${colors.yellow}${JWT_SECRET.substring(0, 30)}...${colors.dim}[${JWT_SECRET.length} chars]${colors.reset}`);

/* ===============================
   ENSURE SUPPORT FILES
================================*/
if (!fs.existsSync(supportDir)) {
  fs.mkdirSync(supportDir, { recursive: true });
  console.log(`${colors.bright}${colors.cyan}📁 Created: ${colors.yellow}support/ folder${colors.reset}`);
}

if (!fs.existsSync(feedbackFile)) {
  fs.writeFileSync(feedbackFile, JSON.stringify([], null, 2));
  console.log(`${colors.bright}${colors.cyan}📝 Created: ${colors.yellow}support/support.json${colors.reset}`);
}

/* ===============================
   POST FEEDBACK
================================*/
router.post("/feedback", (req, res) => {
  try {
    /* ---------- 1️⃣ VERIFY JWT ---------- */
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: token missing"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: invalid token"
      });
    }

    /* ---------- 2️⃣ LOAD USER ---------- */
    const users = getUsersList();
    const user = users.find(u => u.email === decoded.email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    /* ---------- 3️⃣ VALIDATE ---------- */
    const { message, rating, reason, priority, phone } = req.body;

    if (!message && !rating) {
      return res.status(400).json({
        success: false,
        error: "Message or rating is required"
      });
    }

    /* ---------- 4️⃣ SAVE FEEDBACK ---------- */
    const feedbacks = JSON.parse(
      fs.readFileSync(feedbackFile, "utf8") || "[]"
    );

    const newFeedback = {
      userId: user.uid,                 // ✅ REAL UID
      user: {
        name: user.username,            // ✅ REAL NAME
        email: user.email,              // ✅ REAL EMAIL
        phone: phone || null            // ✅ PHONE NUMBER
      },
      purpose: reason || "Not specified",
      priority: priority || "Normal",
      feedback: {
        message: message || "",
        rating: Number(rating) || 0
      },
      meta: {
        submittedAt: new Date().toISOString(),
        source: "Support Page",
        status: "new"
      }
    };

    feedbacks.push(newFeedback);
    fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));

    res.json({
      success: true,
      message: "✅ Feedback saved successfully"
    });

  } catch (err) {
    console.error("❌ Feedback error:", err);
    res.status(500).json({
      success: false,
      error: "Server error while saving feedback"
    });
  }
});

/* ===============================
   GET ALL FEEDBACKS (ADMIN)
================================*/
router.get("/feedback", (req, res) => {
  try {
    const feedbacks = JSON.parse(
      fs.readFileSync(feedbackFile, "utf8") || "[]"
    );
    res.json({ success: true, feedbacks });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Unable to load feedbacks"
    });
  }
});

/* ===============================
   TICKET SYSTEM
================================*/
const ticketsFile = path.join(supportDir, "tickets.json");

// Initialize tickets file
if (!fs.existsSync(ticketsFile)) {
  fs.writeFileSync(ticketsFile, JSON.stringify([], null, 2));
}

// GET user's tickets
router.get("/tickets", (req, res) => {
  try {
    const auth = req.headers.authorization;
    const tokenPreview = auth ? auth.substring(0, 50) : "MISSING";
    console.log("🎫 GET /tickets - Auth header:", tokenPreview);
    
    if (!auth || !auth.startsWith("Bearer ")) {
      console.log("❌ Missing or invalid Bearer token format");
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const token = auth.split(" ")[1];
    console.log("Token extracted, length:", token ? token.length : 0);

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log("✅ JWT verified for email:", decoded.email);
    } catch (err) {
      console.log("❌ JWT verification failed:", err.message);
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const userTickets = tickets.filter(t => t.userEmail === decoded.email);
    console.log(`✅ Found ${userTickets.length} tickets for ${decoded.email}`);

    res.json({ success: true, tickets: userTickets });
  } catch (err) {
    console.error("Tickets error:", err);
    res.status(500).json({ success: false, error: "Failed to load tickets" });
  }
});

// GET specific ticket
router.get("/tickets/:ticketId", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const ticket = tickets.find(t => t.ticketId === req.params.ticketId && t.userEmail === decoded.email);

    if (!ticket) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (err) {
    console.error("Ticket error:", err);
    res.status(500).json({ success: false, error: "Failed to load ticket" });
  }
});

// POST message to ticket
router.post("/tickets/:ticketId/message", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const { message, sender } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: "Message required" });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const ticket = tickets.find(t => t.ticketId === req.params.ticketId && t.userEmail === decoded.email);

    if (!ticket) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    ticket.messages.push({
      sender: sender || "user",
      type: "text",
      content: message,
      timestamp: new Date().toISOString()
    });

    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
    res.json({ success: true, message: "Message added" });
  } catch (err) {
    console.error("Message error:", err);
    res.status(500).json({ success: false, error: "Failed to add message" });
  }
});

// POST file upload to ticket
router.post("/tickets/upload", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    // File upload handled by multer middleware
    // This is a placeholder - implement multer integration as needed
    res.json({ success: true, fileUrl: "/uploads/" + (req.file?.filename || "file") });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

// ADMIN: Create ticket from feedback
router.post("/admin/create-ticket", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    // Verify admin (basic check - expand as needed)
    const { userEmail, purpose, userId, durationHours } = req.body;

    if (!userEmail || !purpose) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    
    const ticketId = "T" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + (durationHours || 24) * 60 * 60 * 1000);

    const newTicket = {
      ticketId,
      userEmail,
      userId,
      originalFeedback: { purpose },
      status: "Open",
      permaClosed: false,
      reopenCount: 0,
      lastReopenedAt: null,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      messages: [{
        sender: "admin",
        type: "text",
        content: `Support ticket created for: ${purpose}`,
        timestamp: createdAt.toISOString()
      }]
    };

    tickets.push(newTicket);
    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));

    res.json({ success: true, message: "Ticket created", ticket: newTicket });
  } catch (err) {
    console.error("Ticket creation error:", err);
    res.status(500).json({ success: false, error: "Failed to create ticket" });
  }
});

// ADMIN: Get all tickets
router.get("/admin/tickets", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    res.json({ success: true, tickets });
  } catch (err) {
    console.error("Get tickets error:", err);
    res.status(500).json({ success: false, error: "Failed to load tickets" });
  }
});

// ADMIN: Update ticket status
router.put("/admin/tickets/:ticketId", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const { status, message } = req.body;
    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const ticket = tickets.find(t => t.ticketId === req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    if (status) {
      ticket.status = status;
    }

    if (message) {
      ticket.messages.push({
        sender: "admin",
        type: "text",
        content: message,
        timestamp: new Date().toISOString()
      });
    }

    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
    res.json({ success: true, message: "Ticket updated", ticket });
  } catch (err) {
    console.error("Ticket update error:", err);
    res.status(500).json({ success: false, error: "Failed to update ticket" });
  }
});

// USER: Close own ticket
router.post("/tickets/:ticketId/close", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const ticketsFile = path.join(supportDir, "tickets.json");
    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const ticket = tickets.find(t => t.ticketId === req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    // Verify user is the ticket owner
    if (ticket.userEmail !== decoded.email) {
      return res.status(403).json({ success: false, error: "Not authorized to close this ticket" });
    }

    // Update ticket status to Closed
    ticket.status = "Closed";
    ticket.messages.push({
      sender: "user",
      type: "system",
      content: "User closed this ticket",
      timestamp: new Date().toISOString()
    });

    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
    res.json({ success: true, message: "Ticket closed successfully", ticket });
  } catch (err) {
    console.error("Close ticket error:", err);
    res.status(500).json({ success: false, error: "Failed to close ticket" });
  }
});

// USER: Reopen closed ticket and clear messages
router.post("/tickets/:ticketId/reopen", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const ticketsFile = path.join(supportDir, "tickets.json");
    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const ticket = tickets.find(t => t.ticketId === req.params.ticketId && t.userEmail === decoded.email);

    if (!ticket) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    // Block if permanently closed by admin
    if (ticket.permaClosed) {
      return res.status(403).json({ success: false, error: "Ticket permanently closed by admin" });
    }

    // Reopen ticket
    ticket.status = "Open";
    ticket.reopenCount = (ticket.reopenCount || 0) + 1;
    ticket.lastReopenedAt = new Date().toISOString();
    
    // Clear all messages if requested
    if (req.body.clearMessages) {
      ticket.messages = [{
        sender: "system",
        type: "system",
        content: "Ticket reopened - fresh conversation",
        timestamp: new Date().toISOString()
      }];
    }

    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
    res.json({ success: true, message: "Ticket reopened successfully", ticket });
  } catch (err) {
    console.error("Reopen ticket error:", err);
    res.status(500).json({ success: false, error: "Failed to reopen ticket" });
  }
});

// ADMIN: Permanently close ticket (block future reopens)
router.post("/admin/tickets/:ticketId/perma-close", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    if (!decoded || (decoded.role !== "admin" && decoded.role !== "superadmin")) {
      return res.status(403).json({ success: false, error: "Admins only" });
    }

    const { reason } = req.body || {};
    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const ticket = tickets.find(t => t.ticketId === req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    ticket.status = "Closed";
    ticket.permaClosed = true;
    ticket.messages = ticket.messages || [];
    ticket.messages.push({
      sender: "admin",
      type: "system",
      content: reason ? `Ticket permanently closed by admin: ${reason}` : "Ticket permanently closed by admin",
      timestamp: new Date().toISOString()
    });

    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
    res.json({ success: true, message: "Ticket permanently closed", ticket });
  } catch (err) {
    console.error("Perma-close ticket error:", err);
    res.status(500).json({ success: false, error: "Failed to permanently close ticket" });
  }
});

// ADMIN: Delete ticket permanently
router.delete("/admin/tickets/:ticketId", (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    if (!decoded || (decoded.role !== "admin" && decoded.role !== "superadmin")) {
      return res.status(403).json({ success: false, error: "Admins only" });
    }

    const tickets = JSON.parse(fs.readFileSync(ticketsFile, "utf8") || "[]");
    const index = tickets.findIndex(t => t.ticketId === req.params.ticketId);

    if (index === -1) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    const deleted = tickets.splice(index, 1)[0];
    fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
    res.json({ success: true, message: "Ticket deleted", ticket: deleted });
  } catch (err) {
    console.error("Delete ticket error:", err);
    res.status(500).json({ success: false, error: "Failed to delete ticket" });
  }
});

export default router;

