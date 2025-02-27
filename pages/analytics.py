import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from utils.analytics import TradeAnalytics

st.title("📈 Trading Analytics")

trades_df = st.session_state.data_manager.get_trades()
analytics = TradeAnalytics()

if not trades_df.empty:
    # Time Period Filter
    st.subheader("Filter Data")
    col1, col2 = st.columns(2)
    with col1:
        start_date = st.date_input("Start Date", pd.to_datetime(trades_df['date']).min())
    with col2:
        end_date = st.date_input("End Date", pd.to_datetime(trades_df['date']).max())

    # Filter data based on date range
    mask = (pd.to_datetime(trades_df['date']).dt.date >= start_date) & \
           (pd.to_datetime(trades_df['date']).dt.date <= end_date)
    filtered_df = trades_df[mask]

    # Performance Metrics
    st.subheader("Performance Metrics")
    metrics = analytics.calculate_basic_metrics(filtered_df)

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Win Rate", f"{metrics['win_rate']}%")
    with col2:
        st.metric("Average Profit", f"${metrics['avg_profit']}")
    with col3:
        st.metric("Largest Win", f"${metrics['max_profit']}")
    with col4:
        st.metric("Largest Loss", f"${metrics['max_loss']}")

    # Profit Distribution
    st.subheader("Profit Distribution")
    fig = px.histogram(filtered_df, x="pnl",
                      title="Distribution of Profits/Losses",
                      nbins=20)
    st.plotly_chart(fig, use_container_width=True)

    # Strategy Analysis
    st.subheader("Strategy Analysis")
    strategy_stats = analytics.get_strategy_performance(filtered_df)
    fig = go.Figure()
    fig.add_trace(go.Bar(
        name="Win Rate",
        x=strategy_stats['strategy'],
        y=strategy_stats['win_rate'],
        yaxis='y',
        offsetgroup=1
    ))
    fig.add_trace(go.Bar(
        name="Average Profit",
        x=strategy_stats['strategy'],
        y=strategy_stats['avg_profit'],
        yaxis='y2',
        offsetgroup=2
    ))
    fig.update_layout(
        yaxis=dict(title="Win Rate (%)"),
        yaxis2=dict(title="Average Profit ($)", overlaying='y', side='right'),
        title="Strategy Performance Analysis"
    )
    st.plotly_chart(fig, use_container_width=True)

    # Monthly Performance
    st.subheader("Monthly Performance")
    filtered_df['month'] = pd.to_datetime(filtered_df['date']).dt.strftime('%Y-%m')
    monthly_performance = filtered_df.groupby('month')['pnl'].sum().reset_index()
    fig = px.bar(monthly_performance, x='month', y='pnl',
                 title="Monthly Profit/Loss")
    st.plotly_chart(fig, use_container_width=True)

    # Symbol Analysis
    st.subheader("Symbol Analysis")
    symbol_stats = filtered_df.groupby('symbol').agg({
        'pnl': ['count', 'mean', 'sum']
    }).reset_index()
    symbol_stats.columns = ['symbol', 'trades', 'avg_profit', 'total_profit']
    st.dataframe(symbol_stats.sort_values('total_profit', ascending=False))

else:
    st.info("No trade data available for analysis")