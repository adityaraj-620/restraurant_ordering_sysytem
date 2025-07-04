class RestaurantApp {
  constructor() {
    this.menu = {}
    this.order = []
    this.currentCategory = "beverages"
    this.taxRate = 0.08

    this.init()
  }

  async init() {
    await this.loadMenu()
    this.setupEventListeners()
    this.displayMenu()
  }

  async loadMenu() {
    try {
      const response = await fetch("/api/menu")
      this.menu = await response.json()
    } catch (error) {
      console.error("Error loading menu:", error)
      this.showError("Failed to load menu. Please refresh the page.")
    }
  }

  setupEventListeners() {
    // Category tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchCategory(e.target.dataset.category)
      })
    })

    // Submit order
    document.getElementById("submit-order").addEventListener("click", () => {
      this.submitOrder()
    })

    // Print bill
    document.getElementById("print-bill").addEventListener("click", () => {
      this.printBill()
    })

    // Modal close
    document.querySelector(".close").addEventListener("click", () => {
      this.closeModal()
    })

    // New order
    document.getElementById("new-order").addEventListener("click", () => {
      this.startNewOrder()
    })

    // Close modal when clicking outside
    window.addEventListener("click", (e) => {
      const modal = document.getElementById("confirmation-modal")
      if (e.target === modal) {
        this.closeModal()
      }
    })
  }

  switchCategory(category) {
    this.currentCategory = category

    // Update active tab
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    document.querySelector(`[data-category="${category}"]`).classList.add("active")

    this.displayMenu()
  }

  displayMenu() {
    const menuContainer = document.getElementById("menu-items")
    const items = this.menu[this.currentCategory] || []

    menuContainer.innerHTML = items
      .map(
        (item) => `
            <div class="menu-item">
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <div class="price">$${item.price.toFixed(2)}</div>
                <button class="add-btn" onclick="app.addToOrder(${item.id})">
                    Add to Order
                </button>
            </div>
        `,
      )
      .join("")
  }

  addToOrder(itemId) {
    // Find the item in menu
    let menuItem = null
    for (const category in this.menu) {
      menuItem = this.menu[category].find((item) => item.id === itemId)
      if (menuItem) break
    }

    if (!menuItem) return

    // Check if item already in order
    const existingItem = this.order.find((item) => item.id === itemId)

    if (existingItem) {
      existingItem.quantity += 1
    } else {
      this.order.push({
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
      })
    }

    this.updateOrderDisplay()
    this.showAddedToCartAnimation()
  }

  removeFromOrder(itemId) {
    this.order = this.order.filter((item) => item.id !== itemId)
    this.updateOrderDisplay()
  }

  updateQuantity(itemId, change) {
    const item = this.order.find((item) => item.id === itemId)
    if (item) {
      item.quantity += change
      if (item.quantity <= 0) {
        this.removeFromOrder(itemId)
      } else {
        this.updateOrderDisplay()
      }
    }
  }

  updateOrderDisplay() {
    const orderContainer = document.getElementById("order-items")
    const totalsContainer = document.getElementById("order-totals")
    const customerInfo = document.getElementById("customer-info")
    const submitBtn = document.getElementById("submit-order")
    const printBtn = document.getElementById("print-bill")

    if (this.order.length === 0) {
      orderContainer.innerHTML = '<p class="empty-order">Your cart is empty</p>'
      totalsContainer.style.display = "none"
      customerInfo.style.display = "none"
      submitBtn.style.display = "none"
      printBtn.style.display = "none"
      return
    }

    // Display order items
    orderContainer.innerHTML = this.order
      .map(
        (item) => `
            <div class="order-item">
                <div class="item-info">
                    <h5>${item.name}</h5>
                    <p>$${item.price.toFixed(2)} each</p>
                </div>
                <div class="quantity-controls">
                    <button class="qty-btn" onclick="app.updateQuantity(${item.id}, -1)">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="qty-btn" onclick="app.updateQuantity(${item.id}, 1)">+</button>
                    <button class="remove-btn" onclick="app.removeFromOrder(${item.id})">Remove</button>
                </div>
            </div>
        `,
      )
      .join("")

    // Calculate totals
    const subtotal = this.order.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = subtotal * this.taxRate
    const total = subtotal + tax

    // Display totals
    document.getElementById("subtotal").textContent = `$${subtotal.toFixed(2)}`
    document.getElementById("tax").textContent = `$${tax.toFixed(2)}`
    document.getElementById("total").textContent = `$${total.toFixed(2)}`

    // Show elements
    totalsContainer.style.display = "block"
    customerInfo.style.display = "block"
    submitBtn.style.display = "block"
    printBtn.style.display = "block"
  }

  async submitOrder() {
    if (this.order.length === 0) {
      alert("Your cart is empty!")
      return
    }

    const customerName = document.getElementById("customer-name").value.trim()
    const notes = document.getElementById("order-notes").value.trim()

    const orderData = {
      items: this.order,
      customer_name: customerName || "Guest",
      notes: notes,
    }

    this.showLoading(true)

    try {
      const response = await fetch("/api/submit-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      })

      const result = await response.json()

      if (result.success) {
        this.showOrderConfirmation(result.order_id, result.order)
      } else {
        throw new Error(result.error || "Failed to submit order")
      }
    } catch (error) {
      console.error("Error submitting order:", error)
      this.showError("Failed to submit order. Please try again.")
    } finally {
      this.showLoading(false)
    }
  }

  showOrderConfirmation(orderId, orderDetails) {
    const modal = document.getElementById("confirmation-modal")
    const detailsContainer = document.getElementById("confirmation-details")

    detailsContainer.innerHTML = `
            <div class="confirmation-details">
                <h3>Order #${orderId}</h3>
                <p><strong>Customer:</strong> ${orderDetails.customer_name}</p>
                ${orderDetails.notes ? `<p><strong>Notes:</strong> ${orderDetails.notes}</p>` : ""}
                
                <h4>Order Items:</h4>
                ${orderDetails.items
                  .map(
                    (item) => `
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>${item.name} x${item.quantity}</span>
                        <span>$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `,
                  )
                  .join("")}
                
                <hr style="margin: 15px 0;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal:</span>
                    <span>$${orderDetails.subtotal}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Tax:</span>
                    <span>$${orderDetails.tax}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em;">
                    <span>Total:</span>
                    <span>$${orderDetails.total}</span>
                </div>
                
                <p style="margin-top: 20px; color: #666; font-style: italic;">
                    Thank you for your order! We'll have it ready soon.
                </p>
            </div>
        `

    modal.style.display = "block"
  }

  closeModal() {
    document.getElementById("confirmation-modal").style.display = "none"
  }

  startNewOrder() {
    this.order = []
    document.getElementById("customer-name").value = ""
    document.getElementById("order-notes").value = ""
    this.updateOrderDisplay()
    this.closeModal()
  }

  printBill() {
    window.print()
  }

  showLoading(show) {
    document.getElementById("loading").style.display = show ? "block" : "none"
  }

  showError(message) {
    alert(message) // In a real app, you'd use a better notification system
  }

  showAddedToCartAnimation() {
    // Simple visual feedback
    const submitBtn = document.getElementById("submit-order")
    if (submitBtn.style.display !== "none") {
      submitBtn.style.transform = "scale(1.05)"
      setTimeout(() => {
        submitBtn.style.transform = "scale(1)"
      }, 200)
    }
  }
}

// Initialize the app when the page loads
let app
document.addEventListener("DOMContentLoaded", () => {
  app = new RestaurantApp()
})
