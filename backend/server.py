from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models for Inventory System
class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str
    quantity: int
    price: float
    location: str
    category: str = "General"
    min_stock: int = 10
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryItemCreate(BaseModel):
    name: str
    code: str
    quantity: int
    price: float
    location: str
    category: str = "General"
    min_stock: int = 10

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[float] = None
    location: Optional[str] = None
    category: Optional[str] = None
    min_stock: Optional[int] = None

class StockMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    item_name: str
    movement_type: str  # "entrada", "saida", "ajuste"
    quantity: int
    reason: str
    user: str = "Sistema"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StockMovementCreate(BaseModel):
    item_id: str
    item_name: str
    movement_type: str
    quantity: int
    reason: str
    user: str = "Sistema"

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

# Basic routes
@api_router.get("/")
async def root():
    return {"message": "Sistema de Controle de Estoque API"}

# Inventory routes
@api_router.post("/items", response_model=InventoryItem)
async def create_item(item: InventoryItemCreate):
    item_dict = item.dict()
    item_obj = InventoryItem(**item_dict)
    await db.inventory_items.insert_one(item_obj.dict())
    return item_obj

@api_router.get("/items", response_model=List[InventoryItem])
async def get_items():
    items = await db.inventory_items.find().to_list(1000)
    return [InventoryItem(**item) for item in items]

@api_router.get("/items/{item_id}", response_model=InventoryItem)
async def get_item(item_id: str):
    item = await db.inventory_items.find_one({"id": item_id})
    if item:
        return InventoryItem(**item)
    return {"error": "Item not found"}

@api_router.put("/items/{item_id}", response_model=InventoryItem)
async def update_item(item_id: str, item_update: InventoryItemUpdate):
    update_data = {k: v for k, v in item_update.dict(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.inventory_items.update_one({"id": item_id}, {"$set": update_data})
    updated_item = await db.inventory_items.find_one({"id": item_id})
    
    if updated_item:
        return InventoryItem(**updated_item)
    return {"error": "Item not found"}

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str):
    result = await db.inventory_items.delete_one({"id": item_id})
    if result.deleted_count == 1:
        return {"message": "Item deleted successfully"}
    return {"error": "Item not found"}

# Stock movement routes
@api_router.post("/movements", response_model=StockMovement)
async def create_movement(movement: StockMovementCreate):
    movement_dict = movement.dict()
    movement_obj = StockMovement(**movement_dict)
    await db.stock_movements.insert_one(movement_obj.dict())
    
    # Update item quantity based on movement
    item = await db.inventory_items.find_one({"id": movement.item_id})
    if item:
        current_qty = item["quantity"]
        if movement.movement_type == "entrada":
            new_qty = current_qty + movement.quantity
        elif movement.movement_type == "saida":
            new_qty = max(0, current_qty - movement.quantity)
        else:  # ajuste
            new_qty = movement.quantity
        
        await db.inventory_items.update_one(
            {"id": movement.item_id}, 
            {"$set": {"quantity": new_qty, "updated_at": datetime.utcnow()}}
        )
    
    return movement_obj

@api_router.get("/movements", response_model=List[StockMovement])
async def get_movements():
    movements = await db.stock_movements.find().sort("timestamp", -1).to_list(1000)
    return [StockMovement(**movement) for movement in movements]

# Dashboard stats route
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    # Get all items
    items = await db.inventory_items.find().to_list(1000)
    
    total_items = len(items)
    total_quantity = sum(item["quantity"] for item in items)
    total_value = sum(item["quantity"] * item["price"] for item in items)
    low_stock_items = len([item for item in items if item["quantity"] <= item.get("min_stock", 10)])
    categories = len(set(item.get("category", "General") for item in items))
    
    return {
        "total_items": total_items,
        "total_quantity": total_quantity,
        "total_value": total_value,
        "low_stock_items": low_stock_items,
        "categories": categories
    }

# User routes (basic implementation)
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    # In a real app, hash the password properly
    import hashlib
    password_hash = hashlib.sha256(user.password.encode()).hexdigest()
    
    user_dict = user.dict()
    user_dict["password_hash"] = password_hash
    del user_dict["password"]
    
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    return user_obj

@api_router.post("/auth/login")
async def login(username: str, password: str):
    import hashlib
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    user = await db.users.find_one({"username": username, "password_hash": password_hash})
    if user:
        return {"message": "Login successful", "user": {"id": user["id"], "username": user["username"]}}
    return {"error": "Invalid credentials"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()