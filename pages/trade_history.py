import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import plotly.express as px
from utils.analytics import TradeAnalytics

st.title("📜 Trade History")

trades_df = st.session_state.data_manager.get_trades()

if not trades_df.empty:
    # Filters Section
    st.sidebar.header("Filters")
    
    # Date Filter
    date_options = ["All Time", "Last 7 Days", "Last 30 Days", "Last 90 Days", "Custom"]
    date_filter = st.sidebar.selectbox("Time Period", date_options)
    
    if date_filter == "Custom":
        start_date = st.sidebar.date_input("Start Date", trades_df['date'].min())
        end_date = st.sidebar.date_input("End Date", trades_df['date'].max())
    else:
        end_date = datetime.now()
        if date_filter == "Last 7 Days":
            start_date = end_date - timedelta(days=7)
        elif date_filter == "Last 30 Days":
            start_date = end_date - timedelta(days=30)
        elif date_filter == "Last 90 Days":
            start_date = end_date - timedelta(days=90)
        else:  # All Time
            start_date = trades_df['date'].min()

    # Symbol Filter
    symbols = ["All"] + sorted(trades_df['symbol'].unique().tolist())
    selected_symbol = st.sidebar.selectbox("Symbol", symbols)
    
    # Trade Type Filter
    trade_types = ["All"] + sorted(trades_df['trade_type'].unique().tolist())
    selected_type = st.sidebar.selectbox("Trade Type", trade_types)

    # Apply filters
    filtered_df = trades_df.copy()
    
    # Date filter
    mask = (pd.to_datetime(filtered_df['date']).dt.date >= pd.to_datetime(start_date).date()) & \
           (pd.to_datetime(filtered_df['date']).dt.date <= pd.to_datetime(end_date).date())
    filtered_df = filtered_df[mask]
    
    # Symbol filter
    if selected_symbol != "All":
        filtered_df = filtered_df[filtered_df['symbol'] == selected_symbol]
    
    # Trade type filter
    if selected_type != "All":
        filtered_df = filtered_df[filtered_df['trade_type'] == selected_type]

    # Summary Statistics
    st.subheader("Summary Statistics")
    analytics = TradeAnalytics()
    metrics = analytics.calculate_basic_metrics(filtered_df)
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Trades", metrics['total_trades'])
        st.metric("Win Rate", f"{metrics['win_rate']}%")
    with col2:
        st.metric("Total P&L", f"${metrics['total_pnl']:,.2f}")
        st.metric("Avg Profit", f"${metrics['avg_profit']:,.2f}")
    with col3:
        st.metric("Best Trade", f"${metrics['max_profit']:,.2f}")
        st.metric("Worst Trade", f"${metrics['max_loss']:,.2f}")
    with col4:
        st.metric("Profit Factor", f"{metrics['profit_factor']:,.2f}")
        st.metric("Risk/Reward", f"{metrics['risk_reward_ratio']:,.2f}")

    # Trade History Table
    st.subheader("Trade Records")
    
    # Sorting options
    sort_options = {
        "Date (Newest First)": ("date", False),
        "Date (Oldest First)": ("date", True),
        "P&L (Highest First)": ("pnl", False),
        "P&L (Lowest First)": ("pnl", True),
        "ROI (Highest First)": ("roi", False),
        "ROI (Lowest First)": ("roi", True)
    }
    sort_by = st.selectbox("Sort by", list(sort_options.keys()))
    sort_column, ascending = sort_options[sort_by]
    
    # Sort the dataframe
    display_df = filtered_df.sort_values(sort_column, ascending=ascending)
    
    # Display trades with expandable details
    for idx, trade in display_df.iterrows():
        with st.expander(f"{trade['date'].strftime('%Y-%m-%d %H:%M')} | {trade['symbol']} | {trade['trade_type']} | P&L: ${trade['pnl']:,.2f}"):
            col1, col2 = st.columns(2)
            with col1:
                st.markdown("#### Trade Details")
                st.write(f"**Entry Price:** ${trade['entry_price']:,.2f}")
                st.write(f"**Exit Price:** ${trade['exit_price']:,.2f}")
                st.write(f"**Position Size:** {trade['position_size']:,.2f}")
                st.write(f"**ROI:** {trade['roi']:.2f}%")
            with col2:
                st.markdown("#### Risk Management")
                st.write(f"**Stop Loss:** ${trade['stop_loss']:,.2f}" if trade['stop_loss'] else "**Stop Loss:** Not Set")
                st.write(f"**Take Profit:** ${trade['take_profit']:,.2f}" if trade['take_profit'] else "**Take Profit:** Not Set")
                if trade['notes']:
                    st.markdown("#### Notes")
                    st.write(trade['notes'])

    # Export functionality
    st.subheader("Export Data")
    if st.button("Export to CSV"):
        csv = filtered_df.to_csv(index=False)
        st.download_button(
            label="Download CSV",
            data=csv,
            file_name=f"trades_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )

else:
    st.info("No trades recorded yet. Start by adding some trades!")
