import React from 'react';
import { Invest, InvestProps } from './invest/Invest';

export const VoxaInvestSection: React.FC<InvestProps> = (props) => {
  return <Invest {...props} />;
};

export default VoxaInvestSection;
