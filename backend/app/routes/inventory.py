from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.warehouse import Warehouse
from app.schemas.inventory import InventoryCreate, InventoryResponse


router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"]
)


@router.post(
    "/",
    response_model=InventoryResponse
)
def create_inventory(
    inventory: InventoryCreate,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == inventory.product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    warehouse = db.query(Warehouse).filter(
        Warehouse.id == inventory.warehouse_id
    ).first()

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found"
        )

    if inventory.quantity < 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity cannot be negative"
        )

    existing_inventory = db.query(Inventory).filter(
        Inventory.product_id == inventory.product_id,
        Inventory.warehouse_id == inventory.warehouse_id
    ).first()

    # If inventory already exists, add the new quantity
    # to the existing quantity.
    if existing_inventory is not None:
        existing_inventory.quantity += inventory.quantity
        existing_inventory.reorder_level = inventory.reorder_level

        db.commit()
        db.refresh(existing_inventory)

        return existing_inventory

    # If inventory does not exist, create a new record.
    new_inventory = Inventory(
        product_id=inventory.product_id,
        warehouse_id=inventory.warehouse_id,
        quantity=inventory.quantity
    )

    db.add(new_inventory)
    db.commit()
    db.refresh(new_inventory)

    return new_inventory


@router.get(
    "/",
    response_model=list[InventoryResponse]
)
def get_inventory(
    db: Session = Depends(get_db)
):
    inventory = db.query(Inventory).all()

    return inventory


@router.put("/{inventory_id}", response_model=InventoryResponse)
def update_inventory(
    inventory_id: int,
    quantity: int,
    reorder_level: int | None = None,
    db: Session = Depends(get_db)
):
    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if inventory is None:
        raise HTTPException(status_code=404, detail="Inventory not found")

    if quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")

    inventory.quantity = quantity

    if reorder_level is not None:
        if reorder_level < 0:
            raise HTTPException(status_code=400, detail="Reorder level cannot be negative")
        inventory.reorder_level = reorder_level

    db.commit()
    db.refresh(inventory)

    return inventory

@router.delete(
    "/{inventory_id}"
)
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db)
):
    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if inventory is None:
        raise HTTPException(
            status_code=404,
            detail="Inventory not found"
        )

    db.delete(inventory)
    db.commit()

    return {
        "message": "Inventory deleted successfully"
    }