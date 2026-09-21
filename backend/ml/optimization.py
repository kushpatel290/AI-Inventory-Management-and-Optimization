import math

from ml.predict import predict_product_demand


SERVICE_LEVEL_Z = 1.65


def calculate_optimization(
    current_stock: int,
    lead_time_days: int,
    product_id: int,
    warehouse_id: int,
):
    if current_stock < 0:
        raise ValueError("Current stock cannot be negative.")

    if lead_time_days <= 0:
        raise ValueError("Lead time must be greater than 0.")

    # Get demand prediction.
    prediction = predict_product_demand(
        product_id,
        warehouse_id,
    )

    predicted_daily_demand = prediction["predicted_demand"]
    demand_std = prediction["demand_std"]
    prediction_method = prediction["prediction_method"]

    # Demand during lead time.
    lead_time_demand = (
        predicted_daily_demand
        * lead_time_days
    )

    # Safety stock.
    safety_stock = (
        SERVICE_LEVEL_Z
        * demand_std
        * math.sqrt(lead_time_days)
    )

    # Reorder point.
    reorder_point = (
        lead_time_demand
        + safety_stock
    )

    # Recommended order quantity.
    recommended_order_quantity = max(
        0,
        math.ceil(
            reorder_point - current_stock
        )
    )

    # Determine status.
    if current_stock <= safety_stock:
        status = "CRITICAL"
    elif current_stock < reorder_point:
        status = "REORDER"
    else:
        status = "SUFFICIENT"

    return {
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "current_stock": current_stock,
        "predicted_daily_demand": round(
            predicted_daily_demand,
            2
        ),
        "demand_std": round(
            demand_std,
            2
        ),
        "lead_time_days": lead_time_days,
        "lead_time_demand": round(
            lead_time_demand,
            2
        ),
        "safety_stock": round(
            safety_stock,
            2
        ),
        "reorder_point": round(
            reorder_point,
            2
        ),
        "recommended_order_quantity": (
            recommended_order_quantity
        ),
        "status": status,
        "prediction_method": prediction_method,
    }


if __name__ == "__main__":

    result = calculate_optimization(
        current_stock=50,
        lead_time_days=5,
        product_id=1,
        warehouse_id=1,
    )

    print("\nInventory Optimization")
    print("----------------------")

    for key, value in result.items():
        print(f"{key}: {value}")