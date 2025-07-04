class AdminApp {
  constructor() {
    this.currentSection = "dashboard"
    this.currentPage = 1
    this.currentStatusFilter = ""

    this.init()
  }

  async init() {
    this.setupEventListeners()
    await this.loadDashboard()
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (e.target.dataset.section) {
          this.switchSection(e.target.dataset.section)
        }
      })
    })

    // Orders
    document.getElementById("status-filter").addEventListener("change", (e) => {
      this.currentStatusFilter = e.target.value
      this.currentPage = 1
      this.loadOrders()
    })

    document.getElementById("refresh-orders").addEventListener("click", () => {
      this.loadOrders()
    })

    // Menu management
    document.getElementById("add-menu-item").addEventListener("click", () => {
      this.openMenuItemModal()
    })

    document.getElementById("menu-item-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.saveMenuItem()
    })

    // Modal close
    document.querySelector(".close").addEventListener("click", () => {
      this.closeMenuItemModal()
    })

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("menu-item-modal")
      if (e.target === modal) {
        this.closeMenuItemModal()
      }
    })
  }

  switchSection(section) {
    // Update navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    document.querySelector(`[data-section="${section}"]`).classList.add("active")

    // Update sections
    document.querySelectorAll(".admin-section").forEach((sec) => {
      sec.classList.remove("active")
    })
    document.getElementById(section).classList.add("active")

    this.currentSection = section

    // Load section data
    switch (section) {
      case "dashboard":
        this.loadDashboard()
        break
      case "orders":
        this.loadOrders()
        break
      case "menu":
        this.loadMenuItems()
        break
    }
  }

  async loadDashboard() {
    try {
      const response = await fetch("/api/admin/stats")
      const stats = await response.json()

      document.getElementById("total-orders").textContent = stats.total_orders
      document.getElementById("pending-orders").textContent = stats.pending_orders
      document.getElementById("total-revenue").textContent = `$${stats.total_revenue.toFixed(2)}`

      const popularItemsList = document.getElementById("popular-items-list")
      popularItemsList.innerHTML = stats.popular_items
        .map(
          (item) => `
        <div class="popular-item">
          <span>${item.name}</span>
          <span>${item.total_ordered} orders</span>
        </div>
      `,
        )
        .join("")
    } catch (error) {
      console.error("Error loading dashboard:", error)
      this.showError("Failed to load dashboard data")
    }
  }

  async loadOrders() {
    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        per_page: 10,
      })

      if (this.currentStatusFilter) {
        params.append("status", this.currentStatusFilter)
      }

      const response = await fetch(`/api/orders?${params}`)
      const data = await response.json()

      this.displayOrders(data.orders)
      this.displayOrdersPagination(data.current_page, data.pages)
    } catch (error) {
      console.error("Error loading orders:", error)
      this.showError("Failed to load orders")
    }
  }

  displayOrders(orders) {
    const container = document.getElementById("orders-list")

    if (orders.length === 0) {
      container.innerHTML = '<p class="text-center">No orders found</p>'
      return
    }

    container.innerHTML = orders
      .map(
        (order) => `
      <div class="order-card">
        <div class="order-header">
          <div class="order-id">Order #${order.id}</div>
          <div class="order-status status-${order.status}">${order.status}</div>
        </div>
        
        <div class="order-details">
          <div class="order-info">
            <p><strong>Customer:</strong> ${order.customer_name}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Total:</strong> $${order.total}</p>
          </div>
          <div class="order-info">
            ${order.customer_email ? `<p><strong>Email:</strong> ${order.customer_email}</p>` : ""}
            ${order.customer_phone ? `<p><strong>Phone:</strong> ${order.customer_phone}</p>` : ""}
            ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ""}
          </div>
        </div>

        <div class="order-items">
          <h4>Items:</h4>
          ${order.items
            .map(
              (item) => `
            <div class="order-item">
              <span>${item.name} x${item.quantity}</span>
              <span>$${item.total.toFixed(2)}</span>
            </div>
          `,
            )
            .join("")}
        </div>

        <div class="order-actions">
          <select class="status-select" onchange="adminApp.updateOrderStatus(${order.id}, this.value)">
            <option value="pending" ${order.status === "pending" ? "selected" : ""}>Pending</option>
            <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>Confirmed</option>
            <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>Preparing</option>
            <option value="ready" ${order.status === "ready" ? "selected" : ""}>Ready</option>
            <option value="delivered" ${order.status === "delivered" ? "selected" : ""}>Delivered</option>
            <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </div>
      </div>
    `,
      )
      .join("")
  }

  displayOrdersPagination(currentPage, totalPages) {
    const container = document.getElementById("orders-pagination")

    if (totalPages <= 1) {
      container.innerHTML = ""
      return
    }

    let pagination = ""

    // Previous button
    pagination += `<button ${currentPage === 1 ? "disabled" : ""} onclick="adminApp.changePage(${currentPage - 1})">Previous</button>`

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === currentPage || i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pagination += `<button class="${i === currentPage ? "active" : ""}" onclick="adminApp.changePage(${i})">${i}</button>`
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        pagination += "<span>...</span>"
      }
    }

    // Next button
    pagination += `<button ${currentPage === totalPages ? "disabled" : ""} onclick="adminApp.changePage(${currentPage + 1})">Next</button>`

    container.innerHTML = pagination
  }

  changePage(page) {
    this.currentPage = page
    this.loadOrders()
  }

  async updateOrderStatus(orderId, status) {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      const result = await response.json()

      if (result.success) {
        this.showSuccess("Order status updated successfully")
        // Refresh the current view
        if (this.currentSection === "orders") {
          this.loadOrders()
        }
        if (this.currentSection === "dashboard") {
          this.loadDashboard()
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error updating order status:", error)
      this.showError("Failed to update order status")
    }
  }

  async loadMenuItems() {
    try {
      const response = await fetch("/api/admin/menu")
      const menuItems = await response.json()

      this.displayMenuItems(menuItems)
    } catch (error) {
      console.error("Error loading menu items:", error)
      this.showError("Failed to load menu items")
    }
  }

  displayMenuItems(menuItems) {
    const container = document.getElementById("menu-items-list")

    container.innerHTML = `
      <div class="menu-items-grid">
        ${menuItems
          .map(
            (item) => `
          <div class="menu-item-card ${!item.available ? "unavailable" : ""}">
            <h4>${item.name}</h4>
            <p>${item.description}</p>
            <div class="menu-item-price">$${item.price.toFixed(2)}</div>
            <div class="menu-item-category">${item.category.replace("_", " ")}</div>
            <div class="menu-item-actions">
              <button class="btn btn-warning btn-sm" onclick="adminApp.editMenuItem(${item.id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="adminApp.deleteMenuItem(${item.id})">Delete</button>
              <button class="btn btn-secondary btn-sm" onclick="adminApp.toggleItemAvailability(${item.id}, ${!item.available})">
                ${item.available ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `
  }

  openMenuItemModal(item = null) {
    const modal = document.getElementById("menu-item-modal")
    const form = document.getElementById("menu-item-form")

    if (item) {
      document.getElementById("modal-title").textContent = "Edit Menu Item"
      document.getElementById("item-id").value = item.id
      document.getElementById("item-name").value = item.name
      document.getElementById("item-description").value = item.description
      document.getElementById("item-price").value = item.price
      document.getElementById("item-category").value = item.category
      document.getElementById("item-image-url").value = item.image_url || ""
      document.getElementById("item-available").checked = item.available
    } else {
      document.getElementById("modal-title").textContent = "Add Menu Item"
      form.reset()
      document.getElementById("item-id").value = ""
      document.getElementById("item-available").checked = true
    }

    modal.style.display = "block"
  }

  closeMenuItemModal() {
    document.getElementById("menu-item-modal").style.display = "none"
  }

  async editMenuItem(itemId) {
    try {
      const response = await fetch(`/api/menu/${itemId}`)
      const item = await response.json()
      this.openMenuItemModal(item)
    } catch (error) {
      console.error("Error loading menu item:", error)
      this.showError("Failed to load menu item")
    }
  }

  async saveMenuItem() {
    try {
      const itemId = document.getElementById("item-id").value
      const itemData = {
        name: document.getElementById("item-name").value,
        description: document.getElementById("item-description").value,
        price: Number.parseFloat(document.getElementById("item-price").value),
        category: document.getElementById("item-category").value,
        image_url: document.getElementById("item-image-url").value,
        available: document.getElementById("item-available").checked,
      }

      const url = itemId ? `/api/admin/menu/${itemId}` : "/api/admin/menu"
      const method = itemId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemData),
      })

      const result = await response.json()

      if (result.success) {
        this.showSuccess(`Menu item ${itemId ? "updated" : "added"} successfully`)
        this.closeMenuItemModal()
        this.loadMenuItems()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error saving menu item:", error)
      this.showError("Failed to save menu item")
    }
  }

  async deleteMenuItem(itemId) {
    if (!confirm("Are you sure you want to delete this menu item?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/menu/${itemId}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        this.showSuccess("Menu item deleted successfully")
        this.loadMenuItems()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting menu item:", error)
      this.showError("Failed to delete menu item")
    }
  }

  async toggleItemAvailability(itemId, available) {
    try {
      const response = await fetch(`/api/admin/menu/${itemId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ available }),
      })

      const result = await response.json()

      if (result.success) {
        this.showSuccess(`Menu item ${available ? "enabled" : "disabled"} successfully`)
        this.loadMenuItems()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error updating menu item:", error)
      this.showError("Failed to update menu item")
    }
  }

  showSuccess(message) {
    // Simple success notification - in a real app, use a proper notification system
    alert(`✅ ${message}`)
  }

  showError(message) {
    // Simple error notification - in a real app, use a proper notification system
    alert(`❌ ${message}`)
  }
}

// Initialize admin app
let adminApp
document.addEventListener("DOMContentLoaded", () => {
  adminApp = new AdminApp()
})

// Global functions for onclick handlers
window.adminApp = adminApp
