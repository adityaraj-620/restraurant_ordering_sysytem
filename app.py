from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json
import os

app = Flask(__name__)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///restaurant.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

db = SQLAlchemy(app)

# Database Models
class MenuItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    available = db.Column(db.Boolean, default=True)
    image_url = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'category': self.category,
            'available': self.available,
            'image_url': self.image_url
        }

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100), default='Guest')
    customer_email = db.Column(db.String(100))
    customer_phone = db.Column(db.String(20))
    notes = db.Column(db.Text)
    subtotal = db.Column(db.Float, nullable=False)
    tax = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, preparing, ready, delivered, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'customer_name': self.customer_name,
            'customer_email': self.customer_email,
            'customer_phone': self.customer_phone,
            'notes': self.notes,
            'subtotal': self.subtotal,
            'tax': self.tax,
            'total': self.total,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'items': [item.to_dict() for item in self.items]
        }

class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_item.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)  # Price at time of order
    
    order = db.relationship('Order', backref=db.backref('items', lazy=True))
    menu_item = db.relationship('MenuItem', backref=db.backref('order_items', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'menu_item_id': self.menu_item_id,
            'name': self.menu_item.name,
            'quantity': self.quantity,
            'price': self.price,
            'total': self.quantity * self.price
        }

# Initialize database
def init_db():
    with app.app_context():
        db.create_all()
        
        # Check if menu items exist, if not, populate with default data
        if MenuItem.query.count() == 0:
            default_menu_items = [
                # Beverages
                MenuItem(name="Coffee", description="Fresh brewed coffee", price=3.50, category="beverages"),
                MenuItem(name="Tea", description="Herbal tea selection", price=2.50, category="beverages"),
                MenuItem(name="Soda", description="Assorted soft drinks", price=2.00, category="beverages"),
                MenuItem(name="Fresh Juice", description="Orange, apple, or grape", price=4.00, category="beverages"),
                
                # Main Course
                MenuItem(name="Margherita Pizza", description="Classic tomato and mozzarella", price=12.99, category="main_course"),
                MenuItem(name="Pepperoni Pizza", description="Pepperoni with mozzarella cheese", price=15.99, category="main_course"),
                MenuItem(name="Pasta Carbonara", description="Creamy pasta with bacon", price=13.50, category="main_course"),
                MenuItem(name="Grilled Chicken", description="Herb-seasoned grilled chicken", price=16.99, category="main_course"),
                MenuItem(name="Caesar Salad", description="Fresh romaine with caesar dressing", price=9.99, category="main_course"),
                
                # Desserts
                MenuItem(name="Chocolate Cake", description="Rich chocolate layer cake", price=6.99, category="desserts"),
                MenuItem(name="Tiramisu", description="Classic Italian dessert", price=7.50, category="desserts"),
                MenuItem(name="Ice Cream", description="Vanilla, chocolate, or strawberry", price=4.99, category="desserts"),
                MenuItem(name="Cheesecake", description="New York style cheesecake", price=6.50, category="desserts"),
            ]
            
            for item in default_menu_items:
                db.session.add(item)
            
            db.session.commit()
            print("Database initialized with default menu items!")

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

# API Routes
@app.route('/api/menu')
def get_menu():
    try:
        menu_items = MenuItem.query.filter_by(available=True).all()
        menu_by_category = {}
        
        for item in menu_items:
            category = item.category
            if category not in menu_by_category:
                menu_by_category[category] = []
            menu_by_category[category].append(item.to_dict())
        
        return jsonify(menu_by_category)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/menu/<int:item_id>')
def get_menu_item(item_id):
    try:
        item = MenuItem.query.get_or_404(item_id)
        return jsonify(item.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit-order', methods=['POST'])
def submit_order():
    try:
        order_data = request.json
        
        # Validate order data
        if not order_data or 'items' not in order_data or not order_data['items']:
            return jsonify({'error': 'Invalid order data'}), 400
        
        # Calculate totals
        subtotal = 0
        order_items = []
        
        for item_data in order_data['items']:
            menu_item = MenuItem.query.get(item_data['id'])
            if not menu_item or not menu_item.available:
                return jsonify({'error': f'Item {item_data["id"]} not available'}), 400
            
            quantity = item_data['quantity']
            price = menu_item.price
            subtotal += price * quantity
            
            order_items.append({
                'menu_item': menu_item,
                'quantity': quantity,
                'price': price
            })
        
        tax_rate = 0.08  # 8% tax
        tax = subtotal * tax_rate
        total = subtotal + tax
        
        # Create order
        order = Order(
            customer_name=order_data.get('customer_name', 'Guest'),
            customer_email=order_data.get('customer_email'),
            customer_phone=order_data.get('customer_phone'),
            notes=order_data.get('notes', ''),
            subtotal=round(subtotal, 2),
            tax=round(tax, 2),
            total=round(total, 2),
            status='pending'
        )
        
        db.session.add(order)
        db.session.flush()  # Get the order ID
        
        # Add order items
        for item_data in order_items:
            order_item = OrderItem(
                order_id=order.id,
                menu_item_id=item_data['menu_item'].id,
                quantity=item_data['quantity'],
                price=item_data['price']
            )
            db.session.add(order_item)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'order_id': order.id,
            'order': order.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders')
def get_orders():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status = request.args.get('status')
        
        query = Order.query
        if status:
            query = query.filter_by(status=status)
        
        orders = query.order_by(Order.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'orders': [order.to_dict() for order in orders.items],
            'total': orders.total,
            'pages': orders.pages,
            'current_page': page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders/<int:order_id>')
def get_order(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        return jsonify(order.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        data = request.json
        
        if 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        
        valid_statuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']
        if data['status'] not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400
        
        order.status = data['status']
        order.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'order': order.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Admin API Routes
@app.route('/api/admin/menu', methods=['GET'])
def admin_get_menu():
    try:
        menu_items = MenuItem.query.all()
        return jsonify([item.to_dict() for item in menu_items])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/menu', methods=['POST'])
def admin_add_menu_item():
    try:
        data = request.json
        
        required_fields = ['name', 'price', 'category']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        menu_item = MenuItem(
            name=data['name'],
            description=data.get('description', ''),
            price=float(data['price']),
            category=data['category'],
            available=data.get('available', True),
            image_url=data.get('image_url')
        )
        
        db.session.add(menu_item)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'item': menu_item.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/menu/<int:item_id>', methods=['PUT'])
def admin_update_menu_item(item_id):
    try:
        menu_item = MenuItem.query.get_or_404(item_id)
        data = request.json
        
        # Update fields if provided
        if 'name' in data:
            menu_item.name = data['name']
        if 'description' in data:
            menu_item.description = data['description']
        if 'price' in data:
            menu_item.price = float(data['price'])
        if 'category' in data:
            menu_item.category = data['category']
        if 'available' in data:
            menu_item.available = data['available']
        if 'image_url' in data:
            menu_item.image_url = data['image_url']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'item': menu_item.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/menu/<int:item_id>', methods=['DELETE'])
def admin_delete_menu_item(item_id):
    try:
        menu_item = MenuItem.query.get_or_404(item_id)
        db.session.delete(menu_item)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/stats')
def admin_get_stats():
    try:
        total_orders = Order.query.count()
        pending_orders = Order.query.filter_by(status='pending').count()
        total_revenue = db.session.query(db.func.sum(Order.total)).scalar() or 0
        popular_items = db.session.query(
            MenuItem.name,
            db.func.sum(OrderItem.quantity).label('total_ordered')
        ).join(OrderItem).group_by(MenuItem.id).order_by(
            db.func.sum(OrderItem.quantity).desc()
        ).limit(5).all()
        
        return jsonify({
            'total_orders': total_orders,
            'pending_orders': pending_orders,
            'total_revenue': float(total_revenue),
            'popular_items': [{'name': item[0], 'total_ordered': item[1]} for item in popular_items]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
