require("dotenv").config();
const xmlrpc = require("xmlrpc");

const {
  ODOO_URL,
  ODOO_DB,
  ODOO_USERNAME,
  ODOO_PASSWORD
} = process.env;

// Create XML-RPC client for common
const odooCommon = xmlrpc.createClient({
  url: `${ODOO_URL}/xmlrpc/2/common`
});

async function authenticateOdoo() {
  return new Promise((resolve, reject) => {
    odooCommon.methodCall("authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}], (err, uid) => {
      if (err) {
        return reject(err);
      }
      if (!uid) {
        return reject(new Error("Authentication failed. Check credentials."));
      }
      resolve(uid);
    });
  });
}

(async () => {
  try {
    console.log("🔐 Attempting to authenticate with Odoo...");
    const uid = await authenticateOdoo();
    console.log(`✅ Success! Authenticated with Odoo. UID: ${uid}`);
  } catch (error) {
    console.error("❌ Failed to authenticate:", error.message);
  }
})();
