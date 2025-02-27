import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple

class TradeAnalytics:
    @staticmethod
    def calculate_win_rate(trades_df: pd.DataFrame) -> float:
        if trades_df.empty:
            return 0.0
        winning_trades = len(trades_df[trades_df['pnl'] > 0])
        return (winning_trades / len(trades_df)) * 100

    @staticmethod
    def calculate_risk_reward_ratio(trades_df: pd.DataFrame) -> float:
        if trades_df.empty:
            return 0.0
        avg_win = trades_df[trades_df['pnl'] > 0]['pnl'].mean()
        avg_loss = abs(trades_df[trades_df['pnl'] < 0]['pnl'].mean())
        return avg_win / avg_loss if avg_loss != 0 else 0.0

    @staticmethod
    def calculate_max_drawdown(trades_df: pd.DataFrame) -> float:
        if trades_df.empty:
            return 0.0
        cumulative = trades_df['pnl'].cumsum()
        rolling_max = cumulative.expanding().max()
        drawdowns = cumulative - rolling_max
        return abs(drawdowns.min())

    @staticmethod
    def calculate_sharpe_ratio(trades_df: pd.DataFrame, risk_free_rate: float = 0.02) -> float:
        if trades_df.empty:
            return 0.0
        daily_returns = trades_df.groupby(pd.to_datetime(trades_df['date']).dt.date)['pnl'].sum()
        excess_returns = daily_returns.mean() - (risk_free_rate / 252)  # Annualized to daily
        return excess_returns / daily_returns.std() if daily_returns.std() != 0 else 0.0

    @staticmethod
    def calculate_basic_metrics(trades_df: pd.DataFrame) -> Dict[str, float]:
        if trades_df.empty:
            return {
                'total_trades': 0,
                'win_rate': 0.0,
                'profit_factor': 0.0,
                'avg_profit': 0.0,
                'max_drawdown': 0.0,
                'risk_reward_ratio': 0.0,
                'max_profit': 0.0,
                'max_loss': 0.0,
                'sharpe_ratio': 0.0,
                'avg_win': 0.0,
                'avg_loss': 0.0,
                'total_pnl': 0.0
            }

        winning_trades = trades_df[trades_df['pnl'] > 0]
        losing_trades = trades_df[trades_df['pnl'] < 0]

        metrics = {
            'total_trades': len(trades_df),
            'win_rate': TradeAnalytics.calculate_win_rate(trades_df),
            'profit_factor': abs(winning_trades['pnl'].sum() / 
                               losing_trades['pnl'].sum()) 
                               if len(losing_trades) > 0 else 0.0,
            'avg_profit': trades_df['pnl'].mean(),
            'max_drawdown': TradeAnalytics.calculate_max_drawdown(trades_df),
            'risk_reward_ratio': TradeAnalytics.calculate_risk_reward_ratio(trades_df),
            'max_profit': trades_df['pnl'].max(),
            'max_loss': trades_df['pnl'].min(),
            'sharpe_ratio': TradeAnalytics.calculate_sharpe_ratio(trades_df),
            'avg_win': winning_trades['pnl'].mean() if not winning_trades.empty else 0.0,
            'avg_loss': losing_trades['pnl'].mean() if not losing_trades.empty else 0.0,
            'total_pnl': trades_df['pnl'].sum()
        }

        # Round all numeric values
        return {k: round(v, 2) if isinstance(v, (float, np.floating)) else v 
                for k, v in metrics.items()}

    @staticmethod
    def get_equity_curve(trades_df: pd.DataFrame) -> pd.DataFrame:
        if trades_df.empty:
            return pd.DataFrame({'date': [], 'cumulative_pnl': []})

        trades_df['date'] = pd.to_datetime(trades_df['date'])
        trades_df = trades_df.sort_values('date')
        trades_df['cumulative_pnl'] = trades_df['pnl'].cumsum()
        return trades_df[['date', 'cumulative_pnl']]

    @staticmethod
    def analyze_trading_patterns(trades_df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
        if trades_df.empty:
            return {}

        trades_df['date'] = pd.to_datetime(trades_df['date'])

        # Time-based analysis
        trades_df['hour'] = trades_df['date'].dt.hour
        trades_df['day_of_week'] = trades_df['date'].dt.day_name()

        hourly_performance = trades_df.groupby('hour').agg({
            'pnl': ['mean', 'sum', 'count']
        }).round(2)

        daily_performance = trades_df.groupby('day_of_week').agg({
            'pnl': ['mean', 'sum', 'count']
        }).round(2)

        return {
            'hourly_performance': hourly_performance,
            'daily_performance': daily_performance
        }

    @staticmethod
    def calculate_volatility_metrics(trades_df: pd.DataFrame) -> Dict[str, float]:
        if trades_df.empty:
            return {}

        daily_pnl = trades_df.groupby(pd.to_datetime(trades_df['date']).dt.date)['pnl'].sum()

        return {
            'daily_std': daily_pnl.std(),
            'daily_var_95': daily_pnl.quantile(0.05),
            'daily_var_99': daily_pnl.quantile(0.01),
            'worst_day': daily_pnl.min(),
            'best_day': daily_pnl.max()
        }

    @staticmethod
    def get_strategy_performance(trades_df: pd.DataFrame) -> pd.DataFrame:
        if trades_df.empty:
            return pd.DataFrame({'strategy': [], 'trades': [], 'win_rate': [], 'avg_profit': [], 'profit_factor': [], 'sharpe_ratio':[], 'avg_win':[], 'avg_loss':[], 'total_pnl':[], 'max_drawdown':[]})

        stats = []
        for strategy in trades_df['strategy'].unique():
            strategy_trades = trades_df[trades_df['strategy'] == strategy]
            metrics = TradeAnalytics.calculate_basic_metrics(strategy_trades)

            stats.append({
                'strategy': strategy,
                'trades': metrics['total_trades'],
                'win_rate': metrics['win_rate'],
                'avg_profit': metrics['avg_profit'],
                'profit_factor': metrics['profit_factor'],
                'sharpe_ratio': metrics['sharpe_ratio'],
                'avg_win': metrics['avg_win'],
                'avg_loss': metrics['avg_loss'],
                'total_pnl': metrics['total_pnl'],
                'max_drawdown': metrics['max_drawdown']
            })

        return pd.DataFrame(stats)