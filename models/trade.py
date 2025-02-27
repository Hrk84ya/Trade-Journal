from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class Trade:
    date: datetime
    symbol: str
    entry_price: float
    exit_price: float
    position_size: float
    trade_type: str  # 'LONG' or 'SHORT'
    stop_loss: Optional[float]
    take_profit: Optional[float]
    notes: Optional[str]
    
    @property
    def pnl(self) -> float:
        """Calculate profit/loss in dollar terms"""
        if self.trade_type.upper() == 'LONG':
            return (self.exit_price - self.entry_price) * self.position_size
        else:  # SHORT
            return (self.entry_price - self.exit_price) * self.position_size
            
    @property
    def roi(self) -> float:
        """Calculate return on investment as percentage"""
        investment = self.entry_price * self.position_size
        if investment == 0:
            return 0.0
        return (self.pnl / investment) * 100
