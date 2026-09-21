import joblib
import pandas as pd

from sklearn.metrics import mean_absolute_error, mean_squared_error


MODEL_PATH = "backend/ml/models/demand_model.pkl"
FEATURES_PATH = "backend/ml/data/features.csv"


def main():
    # Load feature dataset
    df = pd.read_csv(FEATURES_PATH)

    # Sort exactly like the training pipeline
    df["sale_date"] = pd.to_datetime(df["sale_date"])

    df = df.sort_values(
        ["product_id", "warehouse_id", "sale_date"]
    ).reset_index(drop=True)

    # Load trained model
    saved_model = joblib.load(MODEL_PATH)

    model = saved_model["model"]
    features = saved_model["features"]

    target = "quantity"

    # Same chronological 80/20 split as train.py
    split_index = int(len(df) * 0.8)

    train_df = df.iloc[:split_index].copy()
    test_df = df.iloc[split_index:].copy()

    # -----------------------------
    # ML MODEL
    # -----------------------------

    X_test = test_df[features]
    y_test = test_df[target]

    ml_predictions = model.predict(X_test)
    ml_predictions = ml_predictions.clip(min=0)

    ml_mae = mean_absolute_error(
        y_test,
        ml_predictions
    )

    ml_rmse = mean_squared_error(
        y_test,
        ml_predictions
    ) ** 0.5

    # -----------------------------
    # 7-DAY MOVING AVERAGE
    # -----------------------------

    baseline_predictions = []

    # Group historical data by product + warehouse
    grouped = df.groupby(
        ["product_id", "warehouse_id"]
    )

    for index, row in test_df.iterrows():

        key = (
            row["product_id"],
            row["warehouse_id"]
        )

        series = grouped.get_group(key)

        # Only observations before the current test row
        historical = series[
            series.index < index
        ]

        # Last 7 historical observations
        last_7 = historical["quantity"].tail(7)

        if len(last_7) == 0:
            prediction = train_df["quantity"].mean()
        else:
            prediction = last_7.mean()

        baseline_predictions.append(
            max(0, prediction)
        )

    baseline_predictions = pd.Series(
        baseline_predictions,
        index=test_df.index
    )

    baseline_mae = mean_absolute_error(
        y_test,
        baseline_predictions
    )

    baseline_rmse = mean_squared_error(
        y_test,
        baseline_predictions
    ) ** 0.5

    # -----------------------------
    # RESULTS
    # -----------------------------

    print("\nDemand Prediction Evaluation")
    print("============================")

    print(f"Training records: {len(train_df)}")
    print(f"Testing records:  {len(test_df)}")

    print("\nML Model")
    print("--------")
    print(f"MAE:  {ml_mae:.2f}")
    print(f"RMSE: {ml_rmse:.2f}")

    print("\n7-Day Moving Average Baseline")
    print("-----------------------------")
    print(f"MAE:  {baseline_mae:.2f}")
    print(f"RMSE: {baseline_rmse:.2f}")


if __name__ == "__main__":
    main()