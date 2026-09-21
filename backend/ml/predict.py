import joblib
import pandas as pd
from sqlalchemy import text

from app.database.database import engine


MODEL_PATH = "ml/models/demand_model.pkl"

MIN_HISTORY_DAYS = 14


def load_model():
    saved_model = joblib.load(MODEL_PATH)

    return saved_model["model"], saved_model["features"]


def get_sales_history(product_id: int, warehouse_id: int):
    query = text("""
        SELECT sale_date, quantity
        FROM sales
        WHERE product_id = :product_id
          AND warehouse_id = :warehouse_id
        ORDER BY sale_date ASC
    """)

    with engine.connect() as connection:
        df = pd.read_sql(
            query,
            connection,
            params={
                "product_id": product_id,
                "warehouse_id": warehouse_id,
            },
        )

    if not df.empty:
        df["sale_date"] = pd.to_datetime(df["sale_date"])

    return df


def get_latest_features(product_id: int, warehouse_id: int):
    df = get_sales_history(product_id, warehouse_id)

    if len(df) < MIN_HISTORY_DAYS:
        raise ValueError(
            f"At least {MIN_HISTORY_DAYS} days of sales history "
            f"are required for the ML model."
        )

    # Latest demand values
    lag_1 = df["quantity"].iloc[-1]
    lag_7 = df["quantity"].iloc[-8]

    # Previous 7 days
    rolling_mean_7 = df["quantity"].iloc[-8:-1].mean()
    rolling_std_7 = df["quantity"].iloc[-8:-1].std()

    # Previous 14 days
    rolling_mean_14 = df["quantity"].iloc[-15:-1].mean()

    prediction_date = (
        df["sale_date"].iloc[-1] + pd.Timedelta(days=1)
    )

    day_of_week = prediction_date.dayofweek
    day_of_month = prediction_date.day
    month = prediction_date.month

    trend = len(df)

    return {
        "product_id": product_id,
        "warehouse_id": warehouse_id,
        "day_of_week": day_of_week,
        "day_of_month": day_of_month,
        "month": month,
        "lag_1": lag_1,
        "lag_7": lag_7,
        "rolling_mean_7": rolling_mean_7,
        "rolling_mean_14": rolling_mean_14,
        "rolling_std_7": rolling_std_7,
        "trend": trend,
    }


def fallback_prediction(product_id: int, warehouse_id: int):
    """
    Predict demand when there is not enough history
    for the trained ML model.

    Uses the average available historical demand.
    If no history exists, returns zero demand.
    """

    df = get_sales_history(product_id, warehouse_id)

    if df.empty:
        return {
            "predicted_demand": 0.0,
            "demand_std": 0.0,
            "prediction_method": "no_history_fallback",
        }

    recent_quantity = df["quantity"].tail(7)

    predicted_demand = recent_quantity.mean()

    demand_std = recent_quantity.std()

    if pd.isna(demand_std):
        demand_std = 0.0

    return {
        "predicted_demand": max(0.0, float(predicted_demand)),
        "demand_std": max(0.0, float(demand_std)),
        "prediction_method": "historical_average_fallback",
    }


def predict_product_demand(
    product_id: int,
    warehouse_id: int,
):
    df = get_sales_history(product_id, warehouse_id)

    # Use the trained model when enough history exists.
    if len(df) >= MIN_HISTORY_DAYS:

        model, features = load_model()

        feature_values = get_latest_features(
            product_id,
            warehouse_id,
        )

        input_data = pd.DataFrame([feature_values])
        input_data = input_data[features]

        prediction = model.predict(input_data)[0]

        return {
            "predicted_demand": max(0.0, float(prediction)),
            "demand_std": max(
                0.0,
                float(feature_values["rolling_std_7"])
                if not pd.isna(feature_values["rolling_std_7"])
                else 0.0,
            ),
            "prediction_method": "ml_model",
        }

    # Otherwise use the fallback.
    return fallback_prediction(
        product_id,
        warehouse_id,
    )


if __name__ == "__main__":

    product_id = 1
    warehouse_id = 1

    result = predict_product_demand(
        product_id,
        warehouse_id,
    )

    print(
        f"Product {product_id}, "
        f"Warehouse {warehouse_id}"
    )

    print(
        f"Predicted next-day demand: "
        f"{result['predicted_demand']:.2f} units"
    )

    print(
        f"Prediction method: "
        f"{result['prediction_method']}"
    )