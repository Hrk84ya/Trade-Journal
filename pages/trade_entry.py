import streamlit as st
import pandas as pd
from datetime import datetime
from models.trade import Trade

st.title("➕ New Trade Entry")

with st.form("trade_entry_form", clear_on_submit=True):
    col1, col2 = st.columns(2)

    with col1:
        symbol = st.text_input("Symbol", "").upper()
        trade_type = st.selectbox("Trade Type", ["LONG", "SHORT"])
        entry_price = st.number_input("Entry Price", min_value=0.0, step=0.01)
        position_size = st.number_input("Position Size", min_value=0.0, step=0.1)

    with col2:
        exit_price = st.number_input("Exit Price", min_value=0.0, step=0.01)
        stop_loss = st.number_input("Stop Loss", min_value=0.0, step=0.01)
        take_profit = st.number_input("Take Profit", min_value=0.0, step=0.01)

    notes = st.text_area("Trade Notes")

    submitted = st.form_submit_button("Save Trade")

    if submitted:
        if not symbol or entry_price <= 0 or position_size <= 0:
            st.error("Please fill in all required fields")
        else:
            new_trade = Trade(
                date=datetime.now(),
                symbol=symbol,
                entry_price=entry_price,
                exit_price=exit_price,
                position_size=position_size,
                trade_type=trade_type,
                stop_loss=stop_loss if stop_loss > 0 else None,
                take_profit=take_profit if take_profit > 0 else None,
                notes=notes
            )

            st.session_state.data_manager.add_trade(new_trade)
            st.success("Trade saved successfully!")

# Trade History
st.subheader("Trade History")
trades_df = st.session_state.data_manager.get_trades()

if not trades_df.empty:
    # Filters
    col1, col2 = st.columns(2)
    with col1:
        symbol_filter = st.selectbox(
            "Filter by Symbol",
            ["All"] + list(trades_df['symbol'].unique())
        )
    with col2:
        sort_by = st.selectbox(
            "Sort by",
            ["Date (Newest)", "Date (Oldest)", "PnL (High to Low)", "PnL (Low to High)", "ROI (High to Low)"]
        )

    # Apply filters
    filtered_df = trades_df.copy()
    if symbol_filter != "All":
        filtered_df = filtered_df[filtered_df['symbol'] == symbol_filter]

    # Apply sorting
    if sort_by == "Date (Newest)":
        filtered_df = filtered_df.sort_values('date', ascending=False)
    elif sort_by == "Date (Oldest)":
        filtered_df = filtered_df.sort_values('date')
    elif sort_by == "PnL (High to Low)":
        filtered_df = filtered_df.sort_values('pnl', ascending=False)
    elif sort_by == "PnL (Low to High)":
        filtered_df = filtered_df.sort_values('pnl')
    else:  # ROI (High to Low)
        filtered_df = filtered_df.sort_values('roi', ascending=False)

    # Display trades
    st.dataframe(filtered_df)

    # Export button
    if st.button("Export to CSV"):
        csv = st.session_state.data_manager.export_csv()
        st.download_button(
            label="Download CSV",
            data=csv,
            file_name=f"trades_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
else:
    st.info("No trades recorded yet")