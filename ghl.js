require("dotenv").config();
const axios = require("axios");
const xmlrpc = require("xmlrpc");

const {
  ODOO_URL,
  ODOO_DB,
  ODOO_USERNAME,
  ODOO_PASSWORD,
  GOHIGHLEVEL_API_KEY
} = process.env;

const GHL_BASE_URL = "https://public-api.gohighlevel.com/v1";

// XML-RPC clients
const odooCommon = xmlrpc.createClient({ url: `${ODOO_URL}/xmlrpc/2/common` });
const odooObject = xmlrpc.createClient({ url: `${ODOO_URL}/xmlrpc/2/object` });

// Authenticate with Odoo
async function authenticateOdoo() {
  return new Promise((resolve, reject) => {
    odooCommon.methodCall("authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}], (err, uid) => {
      if (err) reject(err);
      else resolve(uid);
    });
  });
}

// Read data from Odoo
async function searchReadOdoo(uid, model, fields = [], domain = []) {
  return new Promise((resolve, reject) => {
    odooObject.methodCall("execute_kw", [
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      model,
      "search_read",
      [domain],
      { fields }
    ], (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// Push data to GHL
async function postToGHL(endpoint, payload) {
  try {
    const res = await axios.post(`${GHL_BASE_URL}${endpoint}`, payload, {
      headers: {
        Authorization: `Bearer ${GOHIGHLEVEL_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    console.log(`✔️ Synced: ${payload.name || payload.title}`);
    return res.data;
  } catch (err) {
    console.error(`❌ Failed to sync to ${endpoint}:`, err.response?.data || err.message);
  }
}

// Check if contact exists or create it
async function findOrCreateContact(lead) {
  try {
    const searchRes = await axios.get(`${GHL_BASE_URL}/contacts/search`, {
      headers: { Authorization: `Bearer ${GOHIGHLEVEL_API_KEY}` },
      params: { email: lead.email_from }
    });

    if (searchRes.data.contacts?.length > 0) {
      return searchRes.data.contacts[0].id;
    }

    const createRes = await postToGHL("/contacts/", {
      firstName: lead.name,
      email: lead.email_from,
      phone: lead.phone
    });

    return createRes?.contact?.id;
  } catch (err) {
    console.error("Error finding/creating contact:", err.message);
  }
}

// Sync Closed-Won Leads as Projects
async function syncProjects(uid) {
  const closedWonLeads = await searchReadOdoo(uid, "crm.lead", ["id", "name", "email_from", "phone", "probability"], [["probability", "=", 100]]);

  for (const lead of closedWonLeads) {
    const contactId = await findOrCreateContact(lead);

    if (!contactId) {
      console.warn(`⚠️ Skipped lead (no contact): ${lead.name}`);
      continue;
    }

    await postToGHL("/projects/", {
      name: lead.name,
      notes: `Imported from Odoo lead ID: ${lead.id}`,
      contactId: contactId
    });
  }
}

// Main runner
async function main() {
  try {
    const uid = await authenticateOdoo();
    console.log("🔐 Authenticated to Odoo as UID:", uid);
    await syncProjects(uid);
    console.log("✅ Project sync completed.");
  } catch (err) {
    console.error("❌ Error in sync:", err);
  }
}

main();
