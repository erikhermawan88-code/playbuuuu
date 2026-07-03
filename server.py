"""
Playbie E-Commerce Full-Stack Server
Serves both static website AND API on port 5000
"""

from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

app = Flask(__name__, static_folder='.')
CORS(app)

DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)

# === UTILITY ===
def load_json(filename, default):
    path = DATA_DIR / filename
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default

def save_json(filename, data):
    path = DATA_DIR / filename
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data

def load_products():
    with open('products.json', 'r', encoding='utf-8') as f:
        return json.load(f)

# === STATIC FILES ===
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Skip API routes
    if path.startswith('api/') or path.startswith('data/') or path.startswith('assets/qr/'):
        return send_from_directory('.', path)
    
    # Check if file exists
    file_path = Path(path)
    if file_path.exists() and file_path.is_file():
        return send_from_directory('.', path)
    
    # Default to index.html for SPA routing
    return send_from_directory('.', 'index.html')

# === API PRODUCTS ===
@app.route('/api/products', methods=['GET'])
def get_products():
    try:
        products = load_products()
        stock = load_json('stock.json', {})
        
        for p in products.get('products', []):
            p['stock'] = stock.get(p['id'], {})
            if not p['stock']:
                variants = p.get('variants', {})
                colors = variants.get('colors', [])
                sizes = variants.get('sizes', [])
                p['stock'] = {
                    'total': 100,
                    'colors': {c: 50 for c in colors} if colors else {},
                    'sizes': {s: 30 for s in sizes} if sizes else {},
                    'available': True
                }
        return jsonify(products)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/<product_id>', methods=['GET'])
def get_product(product_id):
    try:
        products = load_products()
        for p in products.get('products', []):
            if p['id'] == product_id:
                stock = load_json('stock.json', {})
                p['stock'] = stock.get(p['id'], {})
                return jsonify(p)
        return jsonify({'error': 'Product not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# === API STOCK ===
@app.route('/api/stock', methods=['GET'])
def get_all_stock():
    return jsonify(load_json('stock.json', {}))

@app.route('/api/stock', methods=['POST'])
def update_stock():
    data = request.json
    stock = load_json('stock.json', {})
    
    product_id = data.get('productId')
    if not product_id:
        return jsonify({'error': 'productId required'}), 400
    
    if product_id not in stock:
        stock[product_id] = {'total': 0, 'available': True}
    
    if data.get('color') and 'colors' not in stock[product_id]:
        stock[product_id]['colors'] = {}
    if data.get('color'):
        stock[product_id]['colors'][data['color']] = data.get('quantity', 0)
    
    if data.get('size') and 'sizes' not in stock[product_id]:
        stock[product_id]['sizes'] = {}
    if data.get('size'):
        stock[product_id]['sizes'][data['size']] = data.get('quantity', 0)
    
    save_json('stock.json', stock)
    return jsonify({'success': True, 'stock': stock[product_id]})

@app.route('/api/stock/check', methods=['POST'])
def check_stock():
    data = request.json
    stock = load_json('stock.json', {})
    product_stock = stock.get(data.get('productId', ''), {})
    
    return jsonify({
        'available': product_stock.get('available', True),
        'message': 'Tersedia'
    })

# === API ORDERS ===
@app.route('/api/orders', methods=['GET'])
def get_orders():
    orders = load_json('orders.json', [])
    return jsonify({'orders': orders, 'total': len(orders)})

@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    orders = load_json('orders.json', [])
    for o in orders:
        if o['id'] == order_id:
            return jsonify(o)
    return jsonify({'error': 'Order not found'}), 404

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.json
    
    required = ['productId', 'name', 'phone', 'address']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} required'}), 400
    
    products = load_products()
    product = None
    for p in products.get('products', []):
        if p['id'] == data['productId']:
            product = p
            break
    
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    
    order = {
        'id': 'ORD-' + datetime.now().strftime('%Y%m%d%H%M%S') + '-' + str(uuid.uuid4())[:4].upper(),
        'productId': data['productId'],
        'productName': product['name'],
        'productImage': product.get('image', ''),
        'variant': {
            'color': data.get('color', ''),
            'size': data.get('size', ''),
            'type': data.get('type', ''),
        },
        'quantity': data.get('quantity', 1),
        'price': product.get('price', ''),
        'total': data.get('total', product.get('price', '')),
        'customer': {
            'name': data['name'],
            'phone': data['phone'],
            'address': data['address'],
            'notes': data.get('notes', ''),
        },
        'paymentMethod': data.get('paymentMethod', 'qris'),
        'paymentStatus': 'pending',
        'orderStatus': 'new',
        'createdAt': datetime.now().isoformat(),
        'updatedAt': datetime.now().isoformat(),
    }
    
    orders = load_json('orders.json', [])
    orders.insert(0, order)
    save_json('orders.json', orders)
    
    # Deduct stock
    stock = load_json('stock.json', {})
    product_id = data['productId']
    if product_id not in stock:
        stock[product_id] = {'total': 100, 'available': True}
    qty = data.get('quantity', 1)
    if data.get('color') and 'colors' in stock[product_id]:
        stock[product_id]['colors'][data['color']] = max(0, stock[product_id]['colors'].get(data['color'], 0) - qty)
    if data.get('size') and 'sizes' in stock[product_id]:
        stock[product_id]['sizes'][data['size']] = max(0, stock[product_id]['sizes'].get(data['size'], 0) - qty)
    save_json('stock.json', stock)
    
    return jsonify({'success': True, 'order': order}), 201

@app.route('/api/orders/<order_id>', methods=['PATCH'])
def update_order(order_id):
    data = request.json
    orders = load_json('orders.json', [])
    
    for o in orders:
        if o['id'] == order_id:
            if 'paymentStatus' in data:
                o['paymentStatus'] = data['paymentStatus']
            if 'orderStatus' in data:
                o['orderStatus'] = data['orderStatus']
            o['updatedAt'] = datetime.now().isoformat()
            save_json('orders.json', orders)
            return jsonify({'success': True, 'order': o})
    
    return jsonify({'error': 'Order not found'}), 404

@app.route('/api/orders/<order_id>', methods=['DELETE'])
def delete_order(order_id):
    orders = load_json('orders.json', [])
    original_len = len(orders)
    orders = [o for o in orders if o['id'] != order_id]
    
    if len(orders) == original_len:
        return jsonify({'error': 'Order not found'}), 404
    
    save_json('orders.json', orders)
    return jsonify({'success': True})

# === QRIS ===
@app.route('/api/qris/generate', methods=['POST'])
def generate_qris():
    import qrcode
    from io import BytesIO
    import base64
    
    data = request.json
    amount = data.get('amount', 0)
    order_id = data.get('orderId', '')
    
    qris_string = f"00020101021126580009COM.NOBUBANK.WWW011893600009{order_id}5204500053033605802ID5920PLAYBIE E-COMMERCE61051234562070703A016304{order_id}6304"
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qris_string)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    os.makedirs('assets/qr', exist_ok=True)
    img_path = f'assets/qr/{order_id}.png'
    img.save(img_path)
    
    return jsonify({
        'success': True,
        'qrImage': '/' + img_path,
        'amount': amount,
        'orderId': order_id
    })

if __name__ == '__main__':
    print("🛒 Playbie E-Commerce Server Starting...")
    print("🌐 Website + API: http://localhost:5000/")
    print("📋 Admin Panel: http://localhost:5000/admin/")
    print("🛍️ Checkout: http://localhost:5000/checkout.html")
    print("\n📦 API Endpoints:")
    print("  GET  /api/products          - List products")
    print("  GET  /api/products/:id     - Get product")
    print("  GET  /api/orders           - List orders")
    print("  POST /api/orders           - Create order")
    print("  PATCH /api/orders/:id     - Update order")
    print("  GET  /api/stock            - Get stock")
    print("  POST /api/qris/generate    - Generate QRIS")
    app.run(host='0.0.0.0', port=8080, debug=True)
