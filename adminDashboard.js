import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Replace these with your actual Supabase credentials
const SUPABASE_URL = "https://dwskiourizsqowlfjgiu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3c2tpb3VyaXpzcW93bGZqZ2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0OTYyMjYsImV4cCI6MjA1OTA3MjIyNn0.xpSfb8RhWPSisPqZLUNQ0IN30M-riqPsYuxrsxUjqIM";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Fetch all bins from the "bins" table
 */
async function fetchDustbins() {
  try {
    const { data, error } = await supabase.from("bins").select("*");
    if (error) {
      console.error("Error fetching bins:", error.message);
      alert("Failed to fetch dustbins. Please try again.");
      return;
    }
    populateDustbinTable(data);
  } catch (err) {
    console.error("Unexpected error fetching bins:", err);
    alert("An error occurred while fetching dustbins.");
  }
}

/**
 * Populate the bin table with the given data
 */
function populateDustbinTable(bins) {
  const tbody = document.querySelector("#dustbinTable tbody");
  if (!tbody) {
    console.error("Table body element not found");
    alert("Table body element is missing. Please check your HTML.");
    return;
  }

  // Clear existing rows
  tbody.innerHTML = "";

  // Populate rows with bin data
  bins.forEach((bin) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${bin.id}</td>
      <td>${bin.location}</td>
      <td>${bin.fullness || 0}%</td>
      <td>
        <button onclick="deleteDustbin(${bin.id})">Delete</button>
      </td>
    `;

    // Row click redirects to signup.html with bin ID
    row.addEventListener("click", (event) => {
      if (event.target.tagName.toLowerCase() !== "button") {
        window.location.href = "signup.html?binId=" + encodeURIComponent(bin.id);
      }
    });

    tbody.appendChild(row);
  });
}

/**
 * Handle adding a new bin using the form
 */
async function addDustbin(event) {
  event.preventDefault();
  const locationInput = document.getElementById("dustbinLocationInput");
  const ssidInput = document.getElementById("dustbinSsidInput");
  const wifiPassInput = document.getElementById("dustbinWifiPasswordInput");
  if (!locationInput) {
    alert("Location input not found in the form.");
    return;
  }
  const location = locationInput.value.trim();
  const ssid = ssidInput ? ssidInput.value.trim() : "";
  const wifiPassword = wifiPassInput ? wifiPassInput.value.trim() : "";

  if (!location) {
    alert("Please enter a bin location.");
    return;
  }

  try {
    const insertPayload = { location };
    if (ssid) insertPayload.provision_ssid = ssid;
    if (wifiPassword) insertPayload.provision_wifi_password = wifiPassword; // store temporarily (consider encrypting)

    const { data, error } = await supabase
      .from("bins")
      .insert([insertPayload]) // Add more fields here if required (e.g., bin_name)
      .select();

    console.log("Insert response:", { data, error });
    if (error) {
      console.error("Error adding bin:", error.message);
      alert(`Failed to add bin. Error: ${error.message}`);
    } else {
      locationInput.value = ""; // Clear the inputs
      if (ssidInput) ssidInput.value = "";
      if (wifiPassInput) wifiPassInput.value = "";
      fetchDustbins(); // Refresh the list

      // If provisioning info was provided, notify server to queue provisioning for the new bin
      try {
        const binId = data && data[0] && data[0].id ? data[0].id : null;
        if (binId && (ssid || wifiPassword)) {
          await fetch('/provision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-key': 'dev-default-key' // replace with secure key in production
            },
            body: JSON.stringify({ binId, ssid, wifiPassword, location })
          });
        }
      } catch (err) {
        console.warn('Failed to notify provision endpoint:', err);
      }
    }
  } catch (err) {
    console.error("Unexpected error adding bin:", err);
    alert("An error occurred while adding the bin.");
  }
}

/**
 * Delete a bin by its ID
 */
async function deleteDustbin(binId) {
  if (!confirm("Are you sure you want to delete this bin?")) return;

  try {
    const { error } = await supabase.from("bins").delete().eq("id", binId);
    if (error) {
      console.error("Error deleting bin:", error.message);
      alert(`Failed to delete bin. Error: ${error.message}`);
    } else {
      fetchDustbins(); // Refresh the list
    }
  } catch (err) {
    console.error("Unexpected error deleting bin:", err);
    alert("An error occurred while deleting the bin.");
  }
}

// Expose deleteDustbin to global scope for inline onclick usage
window.deleteDustbin = deleteDustbin;

/**
 * Logout function to clear credentials and redirect to login page
 */
function logout() {
  localStorage.removeItem("adminLoggedIn");
  window.location.href = "login.html";
}

/**
 * Initialize the dashboard once the DOM is loaded
 */
document.addEventListener("DOMContentLoaded", () => {
  fetchDustbins();
  const form = document.getElementById("dustbinForm");
  if (form) {
    form.addEventListener("submit", addDustbin);
  } else {
    console.error("Form element (dustbinForm) not found");
    alert("The form element for adding bins is missing. Please check your HTML.");
  }
});