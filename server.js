const express = require("express");
const multer = require("multer");
const cors = require("cors");
const Low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const XLSX = require("xlsx");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const adapter = new FileSync("db.json");
const db = new Low(adapter);

// Initialize database if empty
db.defaults({ contacts: [] }).write();

// Get all contacts
app.get("/contacts", (req, res) => {
  res.json(db.get("contacts").value());
});

// Add a new contact
app.post("/contacts", (req, res) => {
  const { name, phoneNumbers, emails, addresses } = req.body;
  const contact = {
    id: Date.now().toString(),
    name,
    phoneNumbers: phoneNumbers || [],
    emails: emails || [],
    addresses: addresses || [],
    category: null, // Default category is null
  };
  db.get("contacts").push(contact).write();
  res.status(201).json(contact);
});

// Update a contact
app.put("/contacts/:id", (req, res) => {
  const id = req.params.id;
  const contact = db.get("contacts").find({ id }).value();
  if (contact) {
    db.get("contacts").find({ id }).assign(req.body).write();
    res.json({ message: "Contact updated successfully" });
  } else {
    res.status(404).json({ error: "Contact not found" });
  }
});

// Delete a contact
app.delete("/contacts/:id", (req, res) => {
  const id = req.params.id;
  const contact = db.get("contacts").find({ id }).value();
  if (contact) {
    db.get("contacts").remove({ id }).write();
    res.json({ message: "Contact deleted successfully" });
  } else {
    res.status(404).json({ error: "Contact not found" });
  }
});

// Import contacts from Excel
const upload = multer({ dest: "uploads/" });
app.post("/contacts/import", upload.single("file"), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const contacts = XLSX.utils.sheet_to_json(sheet);
    const formattedContacts = contacts.map((c) => ({
      id: Date.now().toString(),
      name: c.name || "",
      phoneNumbers: c.phoneNumbers ? c.phoneNumbers.split(",") : [],
      emails: c.emails ? c.emails.split(",") : [],
      addresses: c.addresses ? c.addresses.split(",") : [],
      category: null,
    }));
    db.get("contacts").push(...formattedContacts).write();
    res.json({ message: "Contacts imported successfully", imported: formattedContacts.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to import contacts" });
  }
});

// Export contacts to Excel
app.get("/contacts/export", (req, res) => {
  try {
    const contacts = db.get("contacts").value();
    const formattedContacts = contacts.map((c) => ({
      name: c.name,
      phoneNumbers: c.phoneNumbers.join(", "),
      emails: c.emails.join(", "),
      addresses: c.addresses.join(", "),
      category: c.category || "None",
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedContacts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    const filePath = "contacts.xlsx";
    XLSX.writeFile(workbook, filePath);

    res.download(filePath, (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to download file" });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to export contacts" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
