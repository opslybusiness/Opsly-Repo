# Engineered Features for Forecasting Model

## Features Engineered:

* `ma_3_month` = 3-month rolling average of expenses (smooths short-term fluctuations)
* `ma_6_month` = 6-month rolling average (captures medium-term trends)
* `ma_12_month` = 12-month rolling average (captures long-term baseline)
* `transaction_count_ma3` = 3-month average transaction volume
* `avg_transaction_ma3` = 3-month average transaction size
* `mom_growth` = month-over-month percentage change (captures recent trends)
* `mom_growth_3m_avg` = 3-month average growth rate (smoothes volatility)
* `yoy_growth` = year-over-year percentage change (annual comparison)
* `volatility_3m` = 3-month standard deviation (short-term expense variability)
* `volatility_12m` = 12-month standard deviation (long-term expense stability)
* `category_Money_Transfer` = monthly spending in top category (absolute amount)
* `category_Money_Transfer_ratio` = percentage of total expenses in category
* `category_Grocery_Stores_ratio` = grocery spending as % of total
* `category_Wholesale_Clubs_ratio` = wholesale spending as % of total
* `category_Drug_Stores_ratio` = pharmacy spending as % of total
* `category_Service_Stations_ratio` = gas station spending as % of total
* `category_diversity` = number of unique categories per month (spending variety)
* `online_ratio` = percentage of transactions that are online (0.0 to 1.0)
* `online_ratio_ma3` = 3-month average online transaction ratio
* `month` = month number (1-12) for seasonal patterns
* `quarter` = quarter number (1-4) for quarterly cycles
* `is_month_end` = 1 if last day of month, else 0 (periodic spikes)
* `is_quarter_end` = 1 if end of quarter (Mar/Jun/Sep/Dec), else 0
* `is_holiday_season` = 1 if November or December, else 0 (holiday spending)
* `month_start_dow` = day of week for month start (0=Monday, 6=Sunday)
* `index` = sequential month number (1, 2, 3...) for trend component

