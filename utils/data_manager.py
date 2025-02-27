import pandas as pd
from datetime import datetime
import streamlit as st
from models.trade import Trade

class DataManager:
    def __init__(self):
        if 'trades' not in st.session_state:
            st.session_state.trades = pd.DataFrame(columns=[
                'date', 'symbol', 'entry_price', 'exit_price', 'position_size',
                'trade_type', 'stop_loss', 'take_profit', 'notes', 'pnl', 'roi'
            ])

        if 'journal_entries' not in st.session_state:
            st.session_state.journal_entries = pd.DataFrame(columns=[
                'date', 'title', 'content', 'mood', 'lessons_learned'
            ])

    def add_trade(self, trade: Trade):
        trade_dict = {
            'date': trade.date,
            'symbol': trade.symbol,
            'entry_price': trade.entry_price,
            'exit_price': trade.exit_price,
            'position_size': trade.position_size,
            'trade_type': trade.trade_type,
            'stop_loss': trade.stop_loss,
            'take_profit': trade.take_profit,
            'notes': trade.notes,
            'pnl': trade.pnl,
            'roi': trade.roi
        }
        st.session_state.trades = pd.concat([
            st.session_state.trades,
            pd.DataFrame([trade_dict])
        ], ignore_index=True)

    def save_journal_entry(self, journal_data: dict):
        journal_data['date'] = datetime.now()
        st.session_state.journal_entries = pd.concat([
            st.session_state.journal_entries,
            pd.DataFrame([journal_data])
        ], ignore_index=True)

    def get_trades(self) -> pd.DataFrame:
        return st.session_state.trades

    def get_journal_entries(self) -> pd.DataFrame:
        return st.session_state.journal_entries

    def export_csv(self) -> str:
        return st.session_state.trades.to_csv(index=False)