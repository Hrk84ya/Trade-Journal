import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from utils.analytics import TradeAnalytics

st.title("📊 Performance Analytics")

# Get trade data
trades_df = st.session_state.data_manager.get_trades()
analytics = TradeAnalytics()

if not trades_df.empty:
    # Date Range Filter
    st.sidebar.header("Filters")
    date_range = st.sidebar.date_input(
        "Select Date Range",
        value=(trades_df['date'].min(), trades_df['date'].max()),
        key='date_range'
    )

    # Filter data based on date range
    mask = (pd.to_datetime(trades_df['date']).dt.date >= date_range[0]) & \
           (pd.to_datetime(trades_df['date']).dt.date <= date_range[1])
    filtered_df = trades_df[mask]

    # Performance Metrics
    metrics = analytics.calculate_basic_metrics(filtered_df)
    volatility = analytics.calculate_volatility_metrics(filtered_df)

    # Key Metrics Dashboard
    st.subheader("Performance Overview")
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total P&L", f"${metrics['total_pnl']:,.2f}")
        st.metric("Win Rate", f"{metrics['win_rate']}%")
    with col2:
        st.metric("Sharpe Ratio", f"{metrics['sharpe_ratio']:.2f}")
        st.metric("Profit Factor", f"{metrics['profit_factor']:.2f}")
    with col3:
        st.metric("Average Win", f"${metrics['avg_win']:,.2f}")
        st.metric("Average Loss", f"${metrics['avg_loss']:,.2f}")
    with col4:
        st.metric("Max Drawdown", f"${abs(metrics['max_drawdown']):,.2f}")
        st.metric("Risk/Reward", f"{metrics['risk_reward_ratio']:.2f}")

    # Equity Curve
    st.subheader("Equity Curve")
    equity_data = analytics.get_equity_curve(filtered_df)
    fig = px.line(equity_data, x='date', y='cumulative_pnl',
                  title='Account Growth')
    fig.update_layout(yaxis_title='Cumulative P&L ($)')
    st.plotly_chart(fig, use_container_width=True)

    # Trading Patterns Analysis
    st.subheader("Trading Patterns")
    patterns = analytics.analyze_trading_patterns(filtered_df)

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### Hourly Performance")
        # Prepare hourly data
        hourly_data = patterns['hourly_performance'].reset_index()
        hourly_data.columns = ['hour', 'mean_pnl', 'sum_pnl', 'count']
        fig_hourly = px.bar(
            hourly_data,
            x='hour',
            y='mean_pnl',
            title='Average P&L by Hour'
        )
        st.plotly_chart(fig_hourly, use_container_width=True)

    with col2:
        st.markdown("#### Daily Performance")
        # Prepare daily data
        daily_data = patterns['daily_performance'].reset_index()
        daily_data.columns = ['day_of_week', 'mean_pnl', 'sum_pnl', 'count']
        fig_daily = px.bar(
            daily_data,
            x='day_of_week',
            y='mean_pnl',
            title='Average P&L by Day'
        )
        st.plotly_chart(fig_daily, use_container_width=True)

    # Risk Metrics
    st.subheader("Risk Analysis")
    col1, col2 = st.columns(2)

    with col1:
        st.metric("Daily Volatility", f"${volatility['daily_std']:,.2f}")
        st.metric("95% VaR", f"${abs(volatility['daily_var_95']):,.2f}")
    with col2:
        st.metric("Worst Day", f"${volatility['worst_day']:,.2f}")
        st.metric("Best Day", f"${volatility['best_day']:,.2f}")

    # P&L Distribution
    st.subheader("P&L Distribution")
    fig = px.histogram(filtered_df, x="pnl",
                      title="Distribution of Daily P&L",
                      nbins=30)
    fig.update_layout(xaxis_title='P&L ($)', yaxis_title='Frequency')
    st.plotly_chart(fig, use_container_width=True)

else:
    st.info("No trading data available for analysis. Please import your trading data to see insights.")