import requests
import json
import unittest
import uuid
import time
from datetime import datetime

# Base URL from frontend/.env
BASE_URL = "https://c8cd11e7-d014-46bd-ab9d-23403908d9ea.preview.emergentagent.com/api"

class InventoryAPITest(unittest.TestCase):
    def setUp(self):
        # Generate unique identifiers for test data to avoid conflicts
        self.test_prefix = f"test_{uuid.uuid4().hex[:8]}"
        
        # Create a test user for authentication tests
        self.test_user = {
            "username": f"{self.test_prefix}_user",
            "email": f"{self.test_prefix}@example.com",
            "password": "SecurePassword123!"
        }
        
        # Create test item data
        self.test_item = {
            "name": f"{self.test_prefix}_Laptop",
            "code": f"LPT-{self.test_prefix}",
            "quantity": 50,
            "price": 1200.00,
            "location": "Warehouse A",
            "category": "Electronics",
            "min_stock": 10
        }
        
        # Store created items and users for cleanup
        self.created_items = []
        self.created_users = []

    def tearDown(self):
        # Clean up created test items
        for item_id in self.created_items:
            requests.delete(f"{BASE_URL}/items/{item_id}")
        
        # Note: We can't clean up users as there's no delete endpoint

    def test_01_api_health_check(self):
        """Test the API health check endpoint"""
        response = requests.get(f"{BASE_URL}/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("message", data)
        self.assertEqual(data["message"], "Sistema de Controle de Estoque API")
        print("✅ API Health Check: Passed")

    def test_02_create_item(self):
        """Test creating a new inventory item"""
        response = requests.post(f"{BASE_URL}/items", json=self.test_item)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify all fields were saved correctly
        for key, value in self.test_item.items():
            self.assertEqual(data[key], value)
        
        # Store item ID for later tests and cleanup
        self.created_items.append(data["id"])
        self.test_item_id = data["id"]
        print(f"✅ Create Item: Passed - Created item with ID: {self.test_item_id}")

    def test_03_get_all_items(self):
        """Test retrieving all inventory items"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        response = requests.get(f"{BASE_URL}/items")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        
        # Verify our test item is in the list
        item_found = False
        for item in data:
            if hasattr(self, 'test_item_id') and item["id"] == self.test_item_id:
                item_found = True
                break
        
        self.assertTrue(item_found, "Created test item not found in items list")
        print("✅ Get All Items: Passed")

    def test_04_get_specific_item(self):
        """Test retrieving a specific inventory item"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        response = requests.get(f"{BASE_URL}/items/{self.test_item_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify item details
        self.assertEqual(data["id"], self.test_item_id)
        for key, value in self.test_item.items():
            self.assertEqual(data[key], value)
        
        print("✅ Get Specific Item: Passed")

    def test_05_update_item(self):
        """Test updating an inventory item"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        # Update data
        update_data = {
            "name": f"{self.test_prefix}_Updated Laptop",
            "quantity": 75,
            "price": 1299.99
        }
        
        response = requests.put(f"{BASE_URL}/items/{self.test_item_id}", json=update_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify updated fields
        for key, value in update_data.items():
            self.assertEqual(data[key], value)
        
        # Verify other fields remain unchanged
        self.assertEqual(data["code"], self.test_item["code"])
        self.assertEqual(data["location"], self.test_item["location"])
        
        print("✅ Update Item: Passed")

    def test_06_delete_item(self):
        """Test deleting an inventory item"""
        # Create a new item specifically for deletion
        delete_item = {
            "name": f"{self.test_prefix}_DeleteMe",
            "code": f"DEL-{self.test_prefix}",
            "quantity": 10,
            "price": 50.00,
            "location": "Warehouse B",
            "category": "Test",
            "min_stock": 5
        }
        
        # Create the item
        response = requests.post(f"{BASE_URL}/items", json=delete_item)
        self.assertEqual(response.status_code, 200)
        item_id = response.json()["id"]
        
        # Delete the item
        response = requests.delete(f"{BASE_URL}/items/{item_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("message", data)
        self.assertEqual(data["message"], "Item deleted successfully")
        
        # Verify item is deleted
        response = requests.get(f"{BASE_URL}/items/{item_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("error", data)
        
        print("✅ Delete Item: Passed")

    def test_07_stock_movement_entrada(self):
        """Test stock movement - entrada (add stock)"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        # Get current quantity
        response = requests.get(f"{BASE_URL}/items/{self.test_item_id}")
        self.assertEqual(response.status_code, 200)
        current_qty = response.json()["quantity"]
        
        # Create entrada movement
        movement_data = {
            "item_id": self.test_item_id,
            "item_name": self.test_item["name"],
            "movement_type": "entrada",
            "quantity": 25,
            "reason": "Restock",
            "user": "Test User"
        }
        
        response = requests.post(f"{BASE_URL}/movements", json=movement_data)
        self.assertEqual(response.status_code, 200)
        
        # Verify quantity was updated
        response = requests.get(f"{BASE_URL}/items/{self.test_item_id}")
        self.assertEqual(response.status_code, 200)
        new_qty = response.json()["quantity"]
        self.assertEqual(new_qty, current_qty + movement_data["quantity"])
        
        print("✅ Stock Movement (Entrada): Passed")

    def test_08_stock_movement_saida(self):
        """Test stock movement - saida (remove stock)"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        # Get current quantity
        response = requests.get(f"{BASE_URL}/items/{self.test_item_id}")
        self.assertEqual(response.status_code, 200)
        current_qty = response.json()["quantity"]
        
        # Create saida movement
        movement_data = {
            "item_id": self.test_item_id,
            "item_name": self.test_item["name"],
            "movement_type": "saida",
            "quantity": 10,
            "reason": "Customer order",
            "user": "Test User"
        }
        
        response = requests.post(f"{BASE_URL}/movements", json=movement_data)
        self.assertEqual(response.status_code, 200)
        
        # Verify quantity was updated
        response = requests.get(f"{BASE_URL}/items/{self.test_item_id}")
        self.assertEqual(response.status_code, 200)
        new_qty = response.json()["quantity"]
        self.assertEqual(new_qty, current_qty - movement_data["quantity"])
        
        print("✅ Stock Movement (Saida): Passed")

    def test_09_stock_movement_ajuste(self):
        """Test stock movement - ajuste (adjust stock)"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        # Create ajuste movement
        movement_data = {
            "item_id": self.test_item_id,
            "item_name": self.test_item["name"],
            "movement_type": "ajuste",
            "quantity": 100,
            "reason": "Inventory correction",
            "user": "Test User"
        }
        
        response = requests.post(f"{BASE_URL}/movements", json=movement_data)
        self.assertEqual(response.status_code, 200)
        
        # Verify quantity was set to the exact value
        response = requests.get(f"{BASE_URL}/items/{self.test_item_id}")
        self.assertEqual(response.status_code, 200)
        new_qty = response.json()["quantity"]
        self.assertEqual(new_qty, movement_data["quantity"])
        
        print("✅ Stock Movement (Ajuste): Passed")

    def test_10_get_movements(self):
        """Test retrieving stock movements"""
        # First create a movement if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            self.test_07_stock_movement_entrada()
            
        response = requests.get(f"{BASE_URL}/movements")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        
        # Verify our test item has movements
        movement_found = False
        for movement in data:
            if hasattr(self, 'test_item_id') and movement["item_id"] == self.test_item_id:
                movement_found = True
                break
        
        self.assertTrue(movement_found, "No movements found for test item")
        print("✅ Get Movements: Passed")

    def test_11_dashboard_stats(self):
        """Test dashboard statistics"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        response = requests.get(f"{BASE_URL}/dashboard/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify stats fields exist
        required_fields = ["total_items", "total_quantity", "total_value", "low_stock_items", "categories"]
        for field in required_fields:
            self.assertIn(field, data)
            
        # Verify stats are numbers
        for field in required_fields:
            self.assertIsInstance(data[field], (int, float))
            
        print("✅ Dashboard Stats: Passed")

    def test_12_create_user(self):
        """Test creating a new user"""
        response = requests.post(f"{BASE_URL}/users", json=self.test_user)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify user was created
        self.assertIn("id", data)
        self.assertEqual(data["username"], self.test_user["username"])
        self.assertEqual(data["email"], self.test_user["email"])
        self.assertIn("password_hash", data)
        self.assertNotEqual(data["password_hash"], self.test_user["password"])  # Password should be hashed
        
        # Store user ID
        self.test_user_id = data["id"]
        self.created_users.append(data["id"])
        
        print("✅ Create User: Passed")

    def test_13_user_login(self):
        """Test user login"""
        # First create a user if none exists
        if not hasattr(self, 'test_user_id'):
            self.test_12_create_user()
            
        # Test login with correct credentials
        login_data = {
            "username": self.test_user["username"],
            "password": self.test_user["password"]
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", params=login_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("message", data)
        self.assertEqual(data["message"], "Login successful")
        self.assertIn("user", data)
        self.assertEqual(data["user"]["username"], self.test_user["username"])
        
        print("✅ User Login: Passed")

    def test_14_invalid_login(self):
        """Test login with invalid credentials"""
        # First create a user if none exists
        if not hasattr(self, 'test_user_id'):
            self.test_12_create_user()
            
        # Test login with incorrect password
        login_data = {
            "username": self.test_user["username"],
            "password": "WrongPassword123!"
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", params=login_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("error", data)
        self.assertEqual(data["error"], "Invalid credentials")
        
        print("✅ Invalid Login: Passed")

    def test_15_negative_quantity_prevention(self):
        """Test that stock movements prevent negative quantities"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        # Set item quantity to a known value
        update_data = {"quantity": 20}
        requests.put(f"{BASE_URL}/items/{self.test_item_id}", json=update_data)
        
        # Try to remove more than available
        movement_data = {
            "item_id": self.test_item_id,
            "item_name": self.test_item["name"],
            "movement_type": "saida",
            "quantity": 30,  # More than available
            "reason": "Testing negative prevention",
            "user": "Test User"
        }
        
        response = requests.post(f"{BASE_URL}/movements", json=movement_data)
        self.assertEqual(response.status_code, 200)
        
        # Verify quantity was set to 0 and not negative
        response = requests.get(f"{BASE_URL}/items/{self.test_item_id}")
        self.assertEqual(response.status_code, 200)
        new_qty = response.json()["quantity"]
        self.assertEqual(new_qty, 0)
        self.assertGreaterEqual(new_qty, 0)
        
        print("✅ Negative Quantity Prevention: Passed")

    def test_16_duplicate_item_code(self):
        """Test handling of duplicate item codes"""
        # First create an item if none exists
        if not hasattr(self, 'test_item_id'):
            self.test_02_create_item()
            
        # Try to create another item with the same code
        duplicate_item = self.test_item.copy()
        duplicate_item["name"] = f"{self.test_prefix}_Duplicate"
        
        response = requests.post(f"{BASE_URL}/items", json=duplicate_item)
        self.assertEqual(response.status_code, 200)
        
        # The API doesn't currently prevent duplicates, so we're just checking it doesn't error
        # In a real-world scenario, we might expect a 400 error for duplicates
        data = response.json()
        self.assertIn("id", data)
        
        # Clean up the duplicate
        self.created_items.append(data["id"])
        
        print("✅ Duplicate Item Code Handling: Passed (Note: API allows duplicates)")

    def test_17_invalid_item_id(self):
        """Test handling of invalid item IDs"""
        invalid_id = "nonexistent-id-12345"
        
        # Try to get a non-existent item
        response = requests.get(f"{BASE_URL}/items/{invalid_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("error", data)
        
        # Try to update a non-existent item
        update_data = {"name": "This should fail"}
        response = requests.put(f"{BASE_URL}/items/{invalid_id}", json=update_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("error", data)
        
        # Try to delete a non-existent item
        response = requests.delete(f"{BASE_URL}/items/{invalid_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("error", data)
        
        print("✅ Invalid Item ID Handling: Passed")

if __name__ == "__main__":
    # Create a test suite
    test_suite = unittest.TestSuite()
    
    # Add tests in order
    test_suite.addTest(InventoryAPITest('test_01_api_health_check'))
    test_suite.addTest(InventoryAPITest('test_02_create_item'))
    test_suite.addTest(InventoryAPITest('test_03_get_all_items'))
    test_suite.addTest(InventoryAPITest('test_04_get_specific_item'))
    test_suite.addTest(InventoryAPITest('test_05_update_item'))
    test_suite.addTest(InventoryAPITest('test_06_delete_item'))
    test_suite.addTest(InventoryAPITest('test_07_stock_movement_entrada'))
    test_suite.addTest(InventoryAPITest('test_08_stock_movement_saida'))
    test_suite.addTest(InventoryAPITest('test_09_stock_movement_ajuste'))
    test_suite.addTest(InventoryAPITest('test_10_get_movements'))
    test_suite.addTest(InventoryAPITest('test_11_dashboard_stats'))
    test_suite.addTest(InventoryAPITest('test_12_create_user'))
    test_suite.addTest(InventoryAPITest('test_13_user_login'))
    test_suite.addTest(InventoryAPITest('test_14_invalid_login'))
    test_suite.addTest(InventoryAPITest('test_15_negative_quantity_prevention'))
    test_suite.addTest(InventoryAPITest('test_16_duplicate_item_code'))
    test_suite.addTest(InventoryAPITest('test_17_invalid_item_id'))
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(test_suite)