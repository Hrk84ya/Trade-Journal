import streamlit as st
import pandas as pd
from utils.data_manager import DataManager
from utils.analytics import TradeAnalytics

st.set_page_config(
    page_title="Trading Insights Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load custom CSS
with open('assets/styles.css') as f:
    st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)

# Initialize session state
if 'data_manager' not in st.session_state:
    st.session_state.data_manager = DataManager()

st.title("📊 Trading Insights Dashboard")

st.markdown("""
    Welcome to your personal trading insights platform! Analyze your performance,
    discover patterns, and improve your trading strategy through data-driven insights.
""")

# Performance Overview
trades_df = st.session_state.data_manager.get_trades()
analytics = TradeAnalytics()

if not trades_df.empty:
    # Key Performance Indicators
    st.subheader("Key Performance Indicators")
    metrics = analytics.calculate_basic_metrics(trades_df)

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Win Rate", f"{metrics['win_rate']}%", 
                 help="Percentage of profitable trades")
    with col2:
        st.metric("Risk/Reward", f"{metrics['risk_reward_ratio']:.2f}", 
                 help="Ratio of average winning trade to average losing trade")
    with col3:
        st.metric("Profit Factor", f"{metrics['profit_factor']:.2f}",
                 help="Ratio of gross profit to gross loss")
    with col4:
        st.metric("Max Drawdown", f"${abs(metrics['max_drawdown']):.2f}",
                 help="Largest peak-to-trough decline")

    # Performance Chart
    st.subheader("Equity Performance")
    equity_data = analytics.get_equity_curve(trades_df)
    st.line_chart(equity_data.set_index('date')['cumulative_pnl'],
                  use_container_width=True)

    # Trading Activity Summary
    st.subheader("Trading Activity")
    col1, col2 = st.columns(2)

    with col1:
        # Most Traded Symbols
        symbol_stats = trades_df.groupby('symbol').agg({
            'pnl': ['count', 'sum', 'mean']
        }).round(2)
        symbol_stats.columns = ['Trades', 'Total P&L', 'Avg P&L']
        st.markdown("#### Most Traded Symbols")
        st.dataframe(symbol_stats.sort_values(('Trades'), ascending=False).head(),
                    use_container_width=True)

    with col2:
        # Best Performing Days
        trades_df['date'] = pd.to_datetime(trades_df['date']).dt.date
        daily_pnl = trades_df.groupby('date')['pnl'].sum().sort_values(ascending=False)
        st.markdown("#### Best Trading Days")
        st.dataframe(daily_pnl.head().reset_index().rename(
            columns={'pnl': 'P&L'}), use_container_width=True)

else:
    st.info("Import your trading data to see insights and analytics.")

    # Sample data option
    if st.button("Load Sample Data"):
        # TODO: Add sample data generation function
        pass